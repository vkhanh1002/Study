import asyncio
import logging
import json
import time
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.ai.providers import provider_manager, ProviderError
from app.ai.rag import _fallback_answer_without_llm, classify_intent, retrieve_context, stream_answer
from app.models import ChatFeedback, ChatMessage, Department, FaqItem, UnansweredQuestion
from app.schemas_kb import ChatFeedbackCreate, DepartmentPublic, FaqItemPublic, GuestChatAsk

logger = logging.getLogger(__name__)
guest_router = APIRouter(tags=["Guest AI & Public Knowledge"])

# In-memory IP rate limiter: max 20 requests per minute
GUEST_RATE_LIMIT: dict[str, list[float]] = {}


def check_guest_rate_limit(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    timestamps = [t for t in GUEST_RATE_LIMIT.get(client_ip, []) if now - t < 60]
    if len(timestamps) >= 20:
        raise HTTPException(status_code=429, detail="Bạn đã gửi quá nhiều câu hỏi trong thời gian ngắn. Vui lòng đợi 1 phút.")
    timestamps.append(now)
    GUEST_RATE_LIMIT[client_ip] = timestamps


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"


@guest_router.get("/departments", response_model=list[DepartmentPublic])
def list_public_departments(db: Session = Depends(get_db)):
    """Lấy danh sách các phòng ban chức năng và thông tin liên hệ công khai."""
    return db.scalars(select(Department).order_by(Department.code)).all()


@guest_router.get("/faq", response_model=list[FaqItemPublic])
def list_public_faq(db: Session = Depends(get_db)):
    """Lấy danh sách câu hỏi thường gặp (FAQ) được công bố công khai."""
    return db.scalars(
        select(FaqItem)
        .where(FaqItem.status == "published", FaqItem.audience.in_(["chung", "tuyen_sinh"]))
        .order_by(FaqItem.category)
    ).all()


@guest_router.post("/chat/messages/{message_id}/feedback")
def submit_chat_feedback(message_id: str, data: ChatFeedbackCreate, db: Session = Depends(get_db)):
    """Gửi đánh giá (hữu ích / không hữu ích) cho câu trả lời của AI."""
    feedback = ChatFeedback(
        message_id=message_id,
        is_positive=data.is_positive,
        reason=data.reason.strip(),
        comment=data.comment.strip()
    )
    db.add(feedback)
    db.commit()
    return {"status": "ok", "message": "Cảm ơn bạn đã đóng góp phản hồi cho Study AI!"}


@guest_router.post("/chat/guest/messages")
async def guest_chat_stream(
    data: GuestChatAsk,
    request: Request,
    db: Session = Depends(get_db)
):
    """Chatbot công khai dành cho Khách, Thí sinh và Phụ huynh.
    Chỉ truy xuất tài liệu audience: tuyen_sinh và chung. Không tiết lộ thông tin cá nhân.
    """
    check_guest_rate_limit(request)
    question = data.get_text()
    if not question:
        raise HTTPException(status_code=400, detail="Vui lòng nhập nội dung câu hỏi.")
    intent = classify_intent(question, has_auth=False)

    # Nếu khách hỏi dữ liệu cá nhân -> Yêu cầu đăng nhập, không thực thi
    if intent == "personal_data":
        async def auth_required_stream():
            yield _sse("status", {"state": "generating"})
            msg = (
                "Chào bạn, để tra cứu thông tin cá nhân (lịch thi, thời khóa biểu, hạn nộp bài tập, điểm số, mã sinh viên...), "
                "bạn vui lòng đăng nhập vào tài khoản sinh viên Study của mình nhé!"
            )
            yield _sse("token", {"text": msg})
            yield _sse("complete", {
                "response_mode": "auth_required",
                "message": {"id": "guest-auth-required", "role": "assistant", "content": msg, "sources": []}
            })
        return StreamingResponse(auth_required_stream(), media_type="text/event-stream")

    try:
        sources = await retrieve_context(db, question, audience="tuyen_sinh", limit=5)
    except Exception:
        logger.exception("Guest chat retrieval failed")
        db.rollback()
        sources = []

    # Nếu độ liên quan rất thấp (không có nguồn nào điểm cao), ghi nhận vào unanswered_questions
    max_score = max((s.get("score", 0) for s in sources), default=0)
    if max_score < 0.2:
        try:
            db.add(UnansweredQuestion(
                question=question,
                user_type="guest",
                resolved=False
            ))
            db.commit()
        except Exception:
            logger.exception("Could not record unanswered guest question")
            db.rollback()

    async def guest_event_stream():
        output = []
        try:
            yield _sse("status", {"state": "retrieving"})
            yield _sse("status", {"state": "generating"})
            async for ev in stream_answer(question, sources, [], intent=intent):
                if ev.event == "token":
                    output.append(ev.text)
                    yield _sse("token", {"text": ev.text})
                elif ev.event == "complete":
                    public_sources = [
                        {"title": s["title"], "excerpt": s["excerpt"][:400], "source_type": s["source_type"]}
                        for s in sources
                    ]
                    yield _sse("complete", {
                        "response_mode": "cloud",
                        "provider": ev.provider,
                        "model": ev.model,
                        "message": {
                            "id": f"guest-{int(time.time()*1000)}",
                            "role": "assistant",
                            "content": "".join(output),
                            "sources": public_sources,
                            "created_at": datetime.now(timezone.utc).isoformat()
                        }
                    })
                    return
        except Exception as exc:
            logger.exception("Guest chat streaming error: %s", exc)
            if not output:
                try:
                    fallback_text = _fallback_answer_without_llm(sources)
                    yield _sse("token", {"text": fallback_text})
                    public_sources = [
                        {"title": s["title"], "excerpt": s["excerpt"][:400], "source_type": s["source_type"]}
                        for s in sources
                    ]
                    yield _sse("complete", {
                        "response_mode": "retrieval_only",
                        "provider": "knowledge_base",
                        "model": "neu_rag",
                        "message": {
                            "id": f"guest-{int(time.time()*1000)}",
                            "role": "assistant",
                            "content": fallback_text,
                            "sources": public_sources,
                            "created_at": datetime.now(timezone.utc).isoformat()
                        }
                    })
                    return
                except Exception as fb_exc:
                    logger.warning("Fallback generation failed: %s", fb_exc)
            yield _sse("error", {"message": "Study AI đang gặp sự cố kết nối, bạn vui lòng thử lại sau ít phút."})

    return StreamingResponse(guest_event_stream(), media_type="text/event-stream")
