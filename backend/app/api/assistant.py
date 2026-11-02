import asyncio
import logging
import json
import time
from collections import deque
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.ai.providers import ProviderError, provider_manager
from app.ai.rag import AnswerResult, generate_answer, ingest_document, retrieve_context, stream_answer
from app.api.deps import current_user, require_roles
from app.core.config import settings
from app.core.database import SessionLocal, get_db
from app.models import Applicant, ChatConversation, ChatMessage, KnowledgeDocument, Student, StudyTask, SupportTicket, User
from app.schemas import ChatAsk, ConversationCreate, ConversationPublic, ConversationRename, DocumentPublic

router = APIRouter(tags=["Study AI Assistant"])
ADMIN_ROLES = ("super_admin",)
logger = logging.getLogger(__name__)
ai_runtime_status: dict[str, dict] = {}
ai_metrics: deque[dict] = deque(maxlen=200)


def _report_metric(metric: dict) -> None:
    ai_metrics.appendleft(metric)
    logger.info(
        "Study AI metric provider=%s model=%s retrieval=%.3fs provider_latency=%s ttft=%s generation=%s total=%.3fs status=%s input_tokens=%s output_tokens=%s retry=%s fallback=%s",
        metric.get("provider") or "none", metric.get("model") or "none", metric.get("retrieval_seconds", 0),
        metric.get("provider_seconds"), metric.get("ttft_seconds"), metric.get("generation_seconds"),
        metric.get("total_seconds", 0), metric.get("status"), metric.get("input_tokens"),
        metric.get("output_tokens"), metric.get("retry_count", 0), metric.get("fallback_count", 0),
    )


def _active_request(conversation_id: str) -> bool:
    status = ai_runtime_status.get(conversation_id, {})
    current = status.get("state")
    timestamp = status.get("updated_at")
    if current in {"starting", "retrieving", "requesting", "retrying", "switching", "generating"} and timestamp:
        try:
            age = (datetime.now(timezone.utc) - datetime.fromisoformat(timestamp)).total_seconds()
            if age > settings.ai_total_timeout_seconds + 15:
                ai_runtime_status.pop(conversation_id, None)
                return False
        except ValueError:
            ai_runtime_status.pop(conversation_id, None)
            return False
    return current in {"starting", "retrieving", "requesting", "retrying", "switching", "generating"}


def _set_ai_status(conversation_id: str, state: dict) -> None:
    ai_runtime_status[conversation_id] = {**state, "updated_at": datetime.now(timezone.utc).isoformat()}


async def _prepare_turn(conversation: ChatConversation, message: str, user: User, db: Session) -> tuple[list[dict], str, list[dict], float]:
    recent_messages = conversation.messages[-8:]
    history_has_account_data = any(
        row.role == "assistant" and any(
            isinstance(source, dict) and source.get("source_type") == "Hồ sơ cá nhân"
            for source in (row.sources or [])
        )
        for row in recent_messages
    )
    history = [] if history_has_account_data else [
        {"role": row.role, "content": row.content[:1200]} for row in recent_messages
    ]
    db.add(ChatMessage(conversation_id=conversation.id, role="user", content=message))
    if conversation.title == "Cuộc trò chuyện mới":
        conversation.title = message[:70]
    db.commit()

    private_context = ""
    question = message.lower()
    profile_terms = ("mã sinh viên", "mssv", "ngành của tôi", "lớp của tôi", "thông tin cá nhân",
                     "tình trạng hồ sơ của tôi", "tình trạng hồ sơ của em", "kết quả của tôi",
                     "đã trúng tuyển chưa", "hồ sơ xét tuyển của tôi", "hồ sơ xét tuyển của em")
    unsupported_personal_terms = (
        "gpa của tôi", "gpa của em", "điểm của tôi", "điểm của em", "học phí của tôi", "công nợ của tôi",
        "email của tôi", "email của em", "số điện thoại của tôi", "số điện thoại của em",
        "địa chỉ của tôi", "ngày sinh của tôi", "ngày sinh của em",
    )
    if any(term in question for term in profile_terms):
        student = db.scalar(select(Student).where(Student.user_id == user.id).options(joinedload(Student.major)))
        if student:
            if "mã sinh viên" in question:
                private_context = f"Mã sinh viên: {student.student_number}."
            elif "ngành của tôi" in question:
                private_context = f"Ngành của bạn: {student.major.name}."
            elif "lớp của tôi" in question:
                private_context = f"Lớp của bạn: {student.class_name or 'chưa cập nhật'}."
            else:
                private_context = f"Trạng thái học tập của bạn: {student.study_status}."
        wants_admission = any(term in question for term in ("tình trạng hồ sơ", "hồ sơ xét tuyển", "kết quả của tôi", "đã trúng tuyển chưa"))
        applicants = db.scalars(select(Applicant).where(Applicant.email == user.email).options(joinedload(Applicant.major)).order_by(Applicant.created_at.desc()).limit(5)).all() if wants_admission else []
        if applicants:
            private_context += " Hồ sơ xét tuyển khớp email đăng nhập này: " + "; ".join(
                f"{applicant.full_name}, ngành {applicant.major.name}, phương thức {applicant.admission_method}, trạng thái {applicant.status}"
                for applicant in applicants
            ) + "."
        elif not student:
            private_context = "Tài khoản này chưa liên kết hồ sơ sinh viên hoặc hồ sơ xét tuyển cùng email."
    elif any(term in question for term in unsupported_personal_terms):
        private_context = ("Đây là dữ liệu cá nhân cần truy vấn qua API học vụ/tài chính đã xác thực. "
                           "Study Assistant hiện không có API được xác nhận để trả lời loại thông tin này; hãy xem phân hệ chính thức hoặc liên hệ bộ phận phụ trách.")
    if any(term in question for term in (
        "yêu cầu hỗ trợ của tôi", "yêu cầu hỗ trợ của em", "ticket của tôi", "ticket của em",
        "phản ánh của tôi", "mã yêu cầu", "trạng thái yêu cầu", "yêu cầu của tôi",
    )):
        tickets = db.scalars(select(SupportTicket).where(SupportTicket.owner_id == user.id).order_by(SupportTicket.created_at.desc()).limit(5)).all()
        if tickets:
            private_context += " Yêu cầu hỗ trợ của chính tài khoản này: " + "; ".join(f"{ticket.code} — {ticket.subject}: {ticket.status}" for ticket in tickets)
        elif not private_context:
            private_context = "Tài khoản đang đăng nhập chưa có yêu cầu hỗ trợ phù hợp để tra cứu."
    study_terms = (
        "deadline", "hạn nộp", "lịch thi", "ngày thi", "khi nào thi", "bài tập",
        "kế hoạch học tập", "lập kế hoạch", "sắp xếp thời gian", "lịch ôn tập", "ôn thi",
        "ôn tập", "nhiệm vụ", "study planner", "task", "lịch học",
    )
    if any(term in question for term in study_terms):
        tasks = db.scalars(
            select(StudyTask)
            .where(StudyTask.user_id == user.id)
            .order_by(StudyTask.due_date.asc())
        ).all()
        if tasks:
            task_descriptions = []
            for t in tasks:
                status_vi = "Đã xong" if t.status == "completed" else ("Đang làm" if t.status == "in_progress" else "Chưa làm")
                type_vi = "Lịch thi" if t.task_type == "exam" else ("Bài tập" if t.task_type == "assignment" else ("Kiểm tra" if t.task_type == "quiz" else "Dự án/Đồ án"))
                due_str = t.due_date.strftime("%d/%m/%Y %H:%M")
                task_descriptions.append(f"[{type_vi}] {t.title} - Môn: {t.course_name} (Hạn/Ngày thi: {due_str}, Trạng thái: {status_vi}, Ưu tiên: {t.priority})")
            
            study_context = "Dữ liệu nhiệm vụ học tập, deadline và lịch thi thực tế của sinh viên này:\n" + "\n".join(f"- {d}" for d in task_descriptions)
            study_context += "\nHãy sử dụng danh sách deadline và lịch thi trên để giải đáp thắc mắc, nhắc nhở hoặc lập kế hoạch/thời gian biểu ôn tập cụ thể, thực tế theo yêu cầu của sinh viên."
            if private_context:
                private_context += "\n" + study_context
            else:
                private_context = study_context
        else:
            no_tasks_msg = "Sinh viên này hiện chưa ghi nhận deadline hay lịch thi nào trong hệ thống Kế hoạch học tập."
            private_context = f"{private_context}\n{no_tasks_msg}" if private_context else no_tasks_msg

    retrieval_started = time.perf_counter()
    sources = await retrieve_context(db, message, audience="sinh_vien", limit=5)
    retrieval_seconds = time.perf_counter() - retrieval_started
    if private_context:
        sources.insert(0, {"title": "Thông tin thuộc tài khoản của bạn", "excerpt": private_context.strip(),
                           "source_type": "Hồ sơ cá nhân", "score": 5.0})
    return history, private_context, sources, retrieval_seconds


def _save_assistant_message(db: Session, conversation: ChatConversation, result: AnswerResult,
                            sources: list[dict]) -> dict:
    public_sources = [{key: source[key] for key in ("title", "excerpt", "source_type") if key in source}
                      for source in sources]
    conv_id = conversation.id if hasattr(conversation, "id") else str(conversation)
    try:
        if db and db.is_active:
            assistant_message = ChatMessage(conversation_id=conv_id, role="assistant", content=result.content,
                                            sources=public_sources)
            db.add(assistant_message)
            db.commit()
            db.refresh(assistant_message)
            return {"id": assistant_message.id, "role": "assistant", "content": result.content,
                    "sources": public_sources, "created_at": assistant_message.created_at}
    except Exception as exc:
        logger.warning("Session closed/failed in _save_assistant_message, retrying with fresh SessionLocal: %s", exc)

    with SessionLocal() as fresh_db:
        assistant_message = ChatMessage(conversation_id=conv_id, role="assistant", content=result.content,
                                        sources=public_sources)
        fresh_db.add(assistant_message)
        fresh_db.commit()
        fresh_db.refresh(assistant_message)
        return {"id": assistant_message.id, "role": "assistant", "content": result.content,
                "sources": public_sources, "created_at": assistant_message.created_at}


def conversation_or_404(db: Session, conversation_id: str, user_id: str) -> ChatConversation:
    row = db.scalar(select(ChatConversation).where(ChatConversation.id == conversation_id, ChatConversation.owner_id == user_id).options(joinedload(ChatConversation.messages)))
    if not row:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc trò chuyện.")
    return row


@router.get("/assistant/conversations", response_model=list[ConversationPublic])
def list_conversations(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return db.scalars(select(ChatConversation).where(ChatConversation.owner_id == user.id).order_by(ChatConversation.updated_at.desc()).options(joinedload(ChatConversation.messages))).unique().all()


@router.get("/assistant/status")
def assistant_runtime_status(_user: User = Depends(current_user)):
    status = provider_manager.status()
    return {key: status[key] for key in (
        "provider", "model", "configured", "fallback_provider", "fallback_configured"
    )}


@router.get("/assistant/conversations/{conversation_id}/ai-status")
def conversation_ai_status(conversation_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    conversation_or_404(db, conversation_id, user.id)
    state = ai_runtime_status.get(conversation_id, {"state": "idle"})
    if state.get("updated_at") and (datetime.now(timezone.utc) - datetime.fromisoformat(state["updated_at"])).total_seconds() > 120:
        ai_runtime_status.pop(conversation_id, None)
        return {"state": "idle"}
    return state


@router.post("/assistant/conversations", response_model=ConversationPublic, status_code=201)
def create_conversation(data: ConversationCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    conversation = ChatConversation(owner_id=user.id, title=data.title)
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


@router.get("/assistant/conversations/{conversation_id}", response_model=ConversationPublic)
def get_conversation(conversation_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return conversation_or_404(db, conversation_id, user.id)


@router.patch("/assistant/conversations/{conversation_id}", response_model=ConversationPublic)
def rename_conversation(conversation_id: str, data: ConversationRename, user: User = Depends(current_user), db: Session = Depends(get_db)):
    conversation = conversation_or_404(db, conversation_id, user.id)
    conversation.title = data.title.strip()
    db.commit()
    return conversation


@router.delete("/assistant/conversations/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    conversation = conversation_or_404(db, conversation_id, user.id)
    db.delete(conversation)
    db.commit()


@router.post("/assistant/conversations/{conversation_id}/messages")
async def ask_assistant(conversation_id: str, data: ChatAsk, user: User = Depends(current_user), db: Session = Depends(get_db)):
    conversation = conversation_or_404(db, conversation_id, user.id)
    if _active_request(conversation.id):
        raise HTTPException(status_code=409, detail="Câu hỏi trước trong cuộc trò chuyện này vẫn đang được xử lý.")
    request_started = time.perf_counter()
    report_ai_status = lambda state: _set_ai_status(conversation.id, state)
    report_ai_status({"state": "starting", "provider": settings.ai_provider})
    report_ai_status({"state": "retrieving", "provider": settings.ai_provider})
    history, private_context, sources, retrieval_seconds = await _prepare_turn(conversation, data.message, user, db)

    try:
        budget = max(0.0, settings.ai_total_timeout_seconds - (time.perf_counter() - request_started))
        answer_result = await generate_answer(data.message, sources, history, private_context,
                                              on_status=report_ai_status, budget_seconds=budget)
        report_ai_status({"state": "succeeded", "provider": answer_result.provider,
                          "model": answer_result.model, "used_fallback": answer_result.used_fallback})
    except ProviderError as exc:
        logger.warning("All configured AI providers failed provider=%s status=%s code=%s request_id=%s",
                       exc.provider, exc.status_code, exc.code, exc.request_id)
        answer_result = AnswerResult(
            _stream_error_message(exc), "unavailable", exc.provider, metrics=exc.metrics
        )
        report_ai_status({"state": "failed", "provider": exc.provider, "error_kind": exc.error_kind})
    except Exception as exc:
        logger.exception("Unexpected AI orchestration failure error_type=%s", type(exc).__name__)
        answer_result = AnswerResult(
            "Study AI gặp lỗi khi tạo câu trả lời. Các nguồn tham khảo tìm được vẫn ở bên dưới; bạn có thể thử lại sau.",
            "unavailable",
        )
        report_ai_status({"state": "failed", "error_kind": "internal_error"})
    message = _save_assistant_message(db, conversation, answer_result, sources)
    metrics = answer_result.metrics or {}
    _report_metric({"created_at": datetime.now(timezone.utc).isoformat(), "provider": answer_result.provider,
                    "model": answer_result.model, "retrieval_seconds": round(retrieval_seconds, 3),
                    "provider_seconds": metrics.get("provider_seconds"), "ttft_seconds": metrics.get("ttft_seconds"),
                    "generation_seconds": metrics.get("generation_seconds"),
                    "total_seconds": round(time.perf_counter() - request_started, 3),
                    "input_tokens": metrics.get("input_tokens"), "output_tokens": metrics.get("output_tokens"),
                    "retry_count": metrics.get("retry_count", 0), "fallback_count": metrics.get("fallback_count", 0),
                    "status": "SUCCESS" if answer_result.mode != "unavailable" else "FAILED"})
    return {"message": message,
            "llm_used": answer_result.mode == "cloud", "demo_mode": answer_result.mode != "cloud",
            "response_mode": answer_result.mode, "provider": answer_result.provider, "model": answer_result.model,
            "used_fallback": answer_result.used_fallback}


def _stream_error_message(error: ProviderError) -> str:
    if error.status_code == 429 and error.error_kind == "quota_exhausted":
        return "Các nhà cung cấp AI hiện đã chạm hạn mức khả dụng. Câu hỏi vẫn được giữ lại; bạn có thể thử lại sau."
    if error.error_kind == "timeout":
        return "AI chưa phản hồi trong thời gian cho phép. Nội dung chưa hoàn tất chưa được lưu; bạn có thể gửi lại."
    if error.status_code in {400, 401, 403, 404}:
        return "Cấu hình hoặc yêu cầu gửi đến dịch vụ AI chưa hợp lệ. Quản trị viên cần kiểm tra model và API key."
    if error.status_code == 429:
        return "AI đang bị giới hạn tốc độ và provider dự phòng không khả dụng. Vui lòng thử lại sau ít phút."
    return "Các dịch vụ AI đang tạm thời không khả dụng. Câu hỏi vẫn được giữ lại; hãy thử lại sau."


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"


@router.post("/assistant/conversations/{conversation_id}/messages/stream")
async def ask_assistant_stream(conversation_id: str, data: ChatAsk,
                               user: User = Depends(current_user), db: Session = Depends(get_db)):
    conversation = conversation_or_404(db, conversation_id, user.id)
    if _active_request(conversation.id):
        raise HTTPException(status_code=409, detail="Câu hỏi trước trong cuộc trò chuyện này vẫn đang được xử lý.")
    request_started = time.perf_counter()
    _set_ai_status(conversation.id, {"state": "retrieving", "provider": settings.ai_provider})

    async def event_stream():
        output: list[str] = []
        completed = False
        retrieval_seconds = 0.0
        producer_task = None
        queue: asyncio.Queue = asyncio.Queue()
        try:
            yield _sse("status", {"state": "retrieving"})
            history, private_context, sources, retrieval_seconds = await _prepare_turn(conversation, data.message, user, db)

            def report_ai_status(state: dict):
                _set_ai_status(conversation.id, state)
                queue.put_nowait(("status", state))

            report_ai_status({"state": "requesting", "provider": settings.ai_provider})
            budget = max(0.0, settings.ai_total_timeout_seconds - (time.perf_counter() - request_started))

            async def produce():
                try:
                    async for provider_event in stream_answer(
                        data.message, sources, history, private_context,
                        on_status=report_ai_status, budget_seconds=budget,
                    ):
                        await queue.put(("provider", provider_event))
                except Exception as error:
                    await queue.put(("exception", error))
                finally:
                    await queue.put(("end", None))

            producer_task = asyncio.create_task(produce())
            while True:
                kind, item = await queue.get()
                if kind == "status":
                    yield _sse("status", item)
                elif kind == "exception":
                    raise item
                elif kind == "end":
                    break
                elif kind == "provider" and item.event == "token":
                    output.append(item.text)
                    _set_ai_status(conversation.id, {"state": "generating", "provider": item.provider,
                                                     "model": item.model})
                    yield _sse("status", {"state": "generating", "provider": item.provider, "model": item.model})
                    yield _sse("token", {"text": item.text})
                elif kind == "provider" and item.event == "complete":
                    answer = "".join(output)
                    if item.provider:
                        result = AnswerResult(answer, "cloud", item.provider, item.model,
                                              item.used_fallback, item.metrics)
                    else:
                        result = AnswerResult(answer, "account_data" if private_context else "retrieval_only")
                    message = _save_assistant_message(db, conversation, result, sources)
                    metrics = item.metrics or {}
                    total_seconds = round(time.perf_counter() - request_started, 3)
                    _report_metric({"created_at": datetime.now(timezone.utc).isoformat(), "provider": result.provider,
                                    "model": result.model, "retrieval_seconds": round(retrieval_seconds, 3),
                                    "provider_seconds": metrics.get("provider_seconds"),
                                    "ttft_seconds": metrics.get("ttft_seconds"),
                                    "generation_seconds": metrics.get("generation_seconds"),
                                    "total_seconds": total_seconds, "input_tokens": metrics.get("input_tokens"),
                                    "output_tokens": metrics.get("output_tokens"),
                                    "retry_count": metrics.get("retry_count", 0),
                                    "fallback_count": metrics.get("fallback_count", 0), "status": "SUCCESS"})
                    _set_ai_status(conversation.id, {"state": "succeeded", "provider": result.provider,
                                                     "model": result.model, "used_fallback": result.used_fallback})
                    completed = True
                    yield _sse("complete", {"message": message, "response_mode": result.mode,
                                             "provider": result.provider, "model": result.model,
                                             "used_fallback": result.used_fallback,
                                             "metrics": {**metrics, "retrieval_seconds": round(retrieval_seconds, 3),
                                                         "total_seconds": total_seconds}})
                    return
        except ProviderError as exc:
            logger.warning("All configured AI providers failed provider=%s status=%s code=%s kind=%s request_id=%s partial_output=%s",
                           exc.provider, exc.status_code, exc.code, exc.error_kind, exc.request_id, exc.partial_output)
            _set_ai_status(conversation.id, {"state": "failed", "provider": exc.provider,
                                             "error_kind": exc.error_kind})
            _report_metric({"created_at": datetime.now(timezone.utc).isoformat(), "provider": exc.provider,
                            "model": None, "retrieval_seconds": round(retrieval_seconds, 3),
                            "provider_seconds": (exc.metrics or {}).get("provider_seconds"),
                            "ttft_seconds": (exc.metrics or {}).get("ttft_seconds"),
                            "total_seconds": round(time.perf_counter() - request_started, 3),
                            "retry_count": (exc.metrics or {}).get("retry_count", 0),
                            "fallback_count": (exc.metrics or {}).get("fallback_count", 0),
                            "status": "FAILED", "error_code": exc.code})
            yield _sse("error", {"message": _stream_error_message(exc), "code": exc.code})
        except asyncio.CancelledError:
            _set_ai_status(conversation.id, {"state": "cancelled"})
            raise
        except Exception as exc:
            logger.exception("Unexpected streaming assistant failure error_type=%s: %s", type(exc).__name__, exc)
            _set_ai_status(conversation.id, {"state": "failed", "error_kind": "internal_error"})
            if output:
                try:
                    partial_answer = "".join(output)
                    result = AnswerResult(partial_answer, "cloud", settings.ai_provider)
                    message = _save_assistant_message(db, conversation, result, sources)
                    completed = True
                    yield _sse("complete", {"message": message, "response_mode": result.mode,
                                             "provider": result.provider, "model": result.model,
                                             "used_fallback": True, "metrics": {}})
                    return
                except Exception as save_err:
                    logger.warning("Failed saving partial answer: %s", save_err)
            yield _sse("error", {"message": "Study AI gặp lỗi khi xử lý. Nội dung chưa hoàn tất chưa được lưu; bạn có thể thử lại."})
        finally:
            if producer_task and not producer_task.done():
                producer_task.cancel()
                await asyncio.gather(producer_task, return_exceptions=True)
            if not completed and db.is_active:
                db.rollback()

    return StreamingResponse(event_stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/admin/knowledge-documents", response_model=list[DocumentPublic])
def list_documents(_user: User = Depends(require_roles(*ADMIN_ROLES)), db: Session = Depends(get_db)):
    return db.scalars(select(KnowledgeDocument).order_by(KnowledgeDocument.created_at.desc())).all()


@router.get("/admin/ai-status")
def ai_status(_user: User = Depends(require_roles(*ADMIN_ROLES))):
    status = provider_manager.status()
    return {**status, "llm_configured": status["configured"], "llm_model": status["model"],
            "embedding_model": None, "retrieval_mode": "Tìm kiếm từ khóa"}


@router.get("/admin/ai-metrics")
def ai_performance_metrics(_user: User = Depends(require_roles(*ADMIN_ROLES))):
    recent = list(ai_metrics)[:20]
    completed = [item for item in ai_metrics if item.get("status") == "SUCCESS"]
    average_total = round(sum(item.get("total_seconds", 0) for item in completed) / len(completed), 3) if completed else None
    return {"retained_requests": len(ai_metrics), "successful_requests": len(completed),
            "average_total_seconds": average_total, "recent": recent}


@router.post("/admin/ai-status/check")
async def check_ai_connection(_user: User = Depends(require_roles(*ADMIN_ROLES))):
    """Make a small real request on explicit admin action; never expose credentials."""
    checked_at = datetime.now(timezone.utc).isoformat()
    try:
        result = await provider_manager.generate(
            "Trả lời ngắn bằng tiếng Việt. Đây là phép thử kết nối, không có dữ liệu cá nhân.",
            [], "Trả lời đúng một từ: OK", allow_fallback=True,
        )
        return {"ok": True, "provider": result.provider, "model": result.model,
                "used_fallback": result.used_fallback, "checked_at": checked_at}
    except ProviderError as exc:
        return {"ok": False, "provider": exc.provider, "status_code": exc.status_code,
                "error_code": exc.code, "checked_at": checked_at}


@router.post("/admin/knowledge-documents", response_model=DocumentPublic, status_code=201)
async def upload_document(file: UploadFile = File(...), user: User = Depends(require_roles(*ADMIN_ROLES)), db: Session = Depends(get_db)):
    filename = (file.filename or "document").replace("\\", "/").split("/")[-1]
    if not filename.lower().endswith((".pdf", ".docx", ".txt", ".md", ".markdown")):
        raise HTTPException(status_code=415, detail="Chỉ hỗ trợ PDF, DOCX, TXT và Markdown (MD).")
    raw = await file.read(10 * 1024 * 1024 + 1)
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Kích thước tài liệu tối đa là 10 MB.")
    document = KnowledgeDocument(filename=filename, media_type=file.content_type or "application/octet-stream", uploaded_by=user.id)
    db.add(document)
    db.commit()
    db.refresh(document)
    await ingest_document(db, document, raw)
    db.refresh(document)
    return document


@router.delete("/admin/knowledge-documents/{document_id}", status_code=204)
def delete_document(document_id: str, _user: User = Depends(require_roles(*ADMIN_ROLES)), db: Session = Depends(get_db)):
    document = db.get(KnowledgeDocument, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu.")
    db.delete(document)
    db.commit()
