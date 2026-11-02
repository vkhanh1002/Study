import json
import logging
import math
import re
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime, timezone
from io import BytesIO

import httpx
from docx import Document as DocxDocument
from pypdf import PdfReader
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.ai.providers import ProviderError, ProviderStreamEvent, provider_manager
from app.ai.tools import get_admission_info, get_admission_scores, get_department_contact, get_tuition
from app.models import (
    AdmissionProgram, AdmissionScore, Department, FAQ, FaqItem,
    KnowledgeChunk, KnowledgeDocument, Major, TuitionFee
)

logger = logging.getLogger(__name__)


@dataclass
class AnswerResult:
    content: str
    mode: str
    provider: str | None = None
    model: str | None = None
    used_fallback: bool = False
    metrics: dict | None = None
    suggested_questions: list[str] | None = None


def chunks_for(text: str, size: int = 900, overlap: int = 140) -> list[str]:
    cleaned = re.sub(r"\s+", " ", text).strip()
    if not cleaned:
        return []
    chunks, start = [], 0
    while start < len(cleaned):
        end = min(start + size, len(cleaned))
        if end < len(cleaned):
            boundary = cleaned.rfind(" ", start + size // 2, end)
            if boundary > start:
                end = boundary
        chunks.append(cleaned[start:end].strip())
        if end >= len(cleaned):
            break
        start = max(end - overlap, start + 1)
    return chunks


async def create_embedding(text: str) -> list[float] | None:
    return None


def lexical_score(query: str, content: str) -> float:
    ignored = {
        "là", "của", "cho", "thế", "nào", "bao", "nhiêu", "tôi", "em", "mình",
        "này", "được", "có", "vậy", "với", "muốn", "hỏi", "giúp", "trường", "tên",
        "gì", "ra", "sao", "bạn", "hiện", "xin", "về", "các", "những"
    }
    # Normalize acronyms
    normalized = query.lower()
    for acr, full in (("hp", "học phí"), ("ktx", "ký túc xá"), ("cntt", "công nghệ thông tin"), ("clc", "chất lượng cao")):
        normalized = re.sub(rf"\b{acr}\b", full, normalized)

    terms = {term for term in re.findall(r"[\wÀ-ỹ]+", normalized) if len(term) > 1 and term not in ignored}
    if not terms:
        return 0.0
    body = content.lower()
    score = sum(1 + min(body.count(term), 3) * 0.15 for term in terms if term in body) / len(terms)
    # Boost if match specific NEU or keywords
    if any(kw in normalized for kw in ("neu", "kinh tế quốc dân", "tuyển sinh", "điểm chuẩn", "học phí", "chỉ tiêu")):
        if any(kw in body for kw in ("neu", "kinh tế quốc dân", "tuyển sinh", "điểm chuẩn", "học phí", "chỉ tiêu")):
            score += 1.2
    return score


def cosine_similarity(left: list[float], right: list[float]) -> float:
    dot = sum(a * b for a, b in zip(left, right))
    norms = math.sqrt(sum(a * a for a in left)) * math.sqrt(sum(b * b for b in right))
    return dot / norms if norms else 0.0


def classify_intent(query: str, has_auth: bool = True) -> str:
    """Phân loại intent câu hỏi theo 5 loại:
    1. personal_data: về lịch, deadline, task, điểm cá nhân (cần đăng nhập)
    2. school_knowledge: tuyển sinh, quy chế, điểm chuẩn, học phí, thủ tục
    3. mixed: kết hợp quy chế chung với tình trạng cá nhân
    4. administrative_human: khiếu nại, phúc khảo, hoàn cảnh cá biệt, quyết định hành chính -> gợi ý gặp phòng ban / tạo ticket
    5. chitchat: chào hỏi, hỏi ngoài phạm vi
    """
    q = query.lower()
    personal_keywords = ("deadline", "hạn nộp", "lịch thi của tôi", "lịch thi của em", "bài tập của tôi",
                         "kế hoạch học tập của tôi", "mã sinh viên", "mssv", "lớp của tôi", "ngành của tôi")
    mixed_keywords = ("tôi còn thiếu bao nhiêu tín chỉ", "học phí kỳ này của tôi", "khi nào tôi được tốt nghiệp",
                      "tôi có đủ điều kiện ra trường không", "tình trạng hồ sơ của tôi")
    human_action_keywords = ("khiếu nại", "phúc khảo điểm thi", "tố cáo", "kỷ luật", "xin xét đặc cách", "hoàn cảnh khó khăn đột xuất")

    if any(k in q for k in mixed_keywords):
        return "mixed"
    if any(k in q for k in personal_keywords):
        return "personal_data"
    if any(k in q for k in human_action_keywords):
        return "administrative_human"

    chitchat_phrases = ("chào bạn", "hello", "hi bạn", "bạn là ai", "thời tiết hôm nay", "kể chuyện cười")
    if any(q.strip() == p or q.startswith(f"{p} ") for p in chitchat_phrases):
        return "chitchat"

    return "school_knowledge"


def strip_accents(text: str) -> str:
    import unicodedata
    nfkd = unicodedata.normalize('NFKD', text)
    return ''.join(c for c in nfkd if not unicodedata.combining(c)).lower()


async def retrieve_context(
    db: Session,
    query: str,
    audience: str = "chung",
    year: int | None = None,
    limit: int = 5
) -> list[dict]:
    """Hybrid search kết hợp:
    1. Bảng dữ liệu có cấu trúc: AdmissionProgram, AdmissionScore, TuitionFee, Department
    2. FaqItem (ưu tiên theo audience)
    3. KnowledgeDocument & Chunks
    """
    candidates: list[dict] = []
    # Expand acronyms for routing
    q_norm = query.lower()
    for acr, full in (("hp", "học phí"), ("ktx", "ký túc xá"), ("cntt", "công nghệ thông tin"), ("clc", "chất lượng cao"), ("dseb", "khoa học dữ liệu")):
        q_norm = re.sub(rf"\b{acr}\b", full, q_norm)
    q_lower = q_norm
    q_unaccent = strip_accents(q_lower)

    # 1. Tra cứu có cấu trúc nếu câu hỏi liên quan đến Điểm chuẩn
    score_triggers = ("điểm chuẩn", "lấy bao nhiêu điểm", "trúng tuyển bao nhiêu điểm", "diem chuan", "diem san", "diem dau vao")
    if any(k in q_lower or k in q_unaccent for k in score_triggers):
        scores = get_admission_scores(db, query=query, year=year)
        if not scores:
            scores = get_admission_scores(db, query="", year=year or 2025)[:8]
        if scores:
            formatted_scores = []
            for s in scores[:6]:
                note_str = f" ({s['note']})" if s.get("note") else ""
                formatted_scores.append(
                    f"- Ngành: {s['program_name']} ({s['program_code']}) | Năm: {s['year']} | Phương thức: {s['method']} | Điểm chuẩn: {s['score']}/{s['scale']}{note_str}"
                )
            candidates.append({
                "title": f"Bảng điểm chuẩn chính thức Đại học Kinh tế Quốc dân (Năm {scores[0]['year']})",
                "excerpt": "Dữ liệu tra cứu bảng điểm chuẩn chính thức:\n" + "\n".join(formatted_scores),
                "source_type": "Bảng điểm chuẩn chính thức",
                "score": 5.0,
                "academic_year": str(scores[0]['year']),
                "department": "Phòng Quản lý Đón tiếp & Tuyển sinh",
            })

    # 2. Tra cứu có cấu trúc nếu câu hỏi liên quan đến Ngành / Chỉ tiêu / Phương thức
    program_triggers = ("ngành", "chỉ tiêu", "phương thức", "tổ hợp", "xét tuyển", "mã ngành", "nganh", "chi tieu", "phuong thuc", "to hop", "xet tuyen", "khoa hoc du lieu")
    if any(k in q_lower or k in q_unaccent for k in program_triggers):
        programs = get_admission_info(db, query=query, year=year or 2026)
        if programs:
            formatted_progs = []
            for p in programs[:5]:
                methods_str = ", ".join(p["methods"])
                formatted_progs.append(
                    f"- {p['name']} (Mã {p['major_code']}) - Hệ {p['program_type']}: Chỉ tiêu {p['quota']}, Tổ hợp: {p['subject_groups']}, Phương thức xét tuyển: [{methods_str}]. Ghi chú: {p['note']}"
                )
            candidates.append({
                "title": f"Đề án Tuyển sinh Đại học Kinh tế Quốc dân {year or 2026}",
                "excerpt": "Dữ liệu chỉ tiêu và phương thức tuyển sinh chính thức:\n" + "\n".join(formatted_progs),
                "source_type": "Đề án tuyển sinh",
                "score": 5.0,
                "academic_year": str(year or 2026),
                "department": "Phòng Quản lý Đón tiếp & Tuyển sinh",
            })

    # 3. Tra cứu có cấu trúc nếu câu hỏi liên quan đến Học phí
    tuition_triggers = ("học phí", "tiền học", "mỗi tín chỉ bao nhiêu", "chi phí học tập", "hoc phi", "tien hoc", "tin chi")
    if any(k in q_lower or k in q_unaccent for k in tuition_triggers):
        fees = get_tuition(db, query=query)
        if not fees:
            fees = get_tuition(db, query="")
        if fees:
            formatted_fees = []
            for f in fees[:5]:
                per_credit = f"{f['per_credit_vnd']:,} đ/tín chỉ" if f['per_credit_vnd'] > 0 else "Học phí trọn gói"
                formatted_fees.append(
                    f"- {f['program_name']} ({f['cohort']}): Mức {f['per_year_vnd']:,} đ/năm ({per_credit}). {f['note']}"
                )
            candidates.append({
                "title": "Bảng biểu mức thu học phí chính thức NEU",
                "excerpt": "Dữ liệu học phí chính thức ban hành:\n" + "\n".join(formatted_fees),
                "source_type": "Biểu mức học phí",
                "score": 5.0,
                "academic_year": "2025-2026",
                "department": "Phòng Tài chính - Kế toán",
            })

    # 4. Tra cứu thông tin liên hệ phòng ban nếu hỏi về phòng ban / liên hệ / ở đâu / hỗ trợ
    dept_triggers = ("phòng ban", "liên hệ", "số điện thoại", "ở đâu", "địa chỉ", "hotline", "gặp ai", "thư viện", "ký túc xá", "quản lý sinh viên", "quản lý đào tạo", "phong ban", "lien he", "so dien thoai", "o dau", "dia chi", "ky tuc xa", "thu vien")
    if any(k in q_lower or k in q_unaccent for k in dept_triggers):
        depts = get_department_contact(db, topic_or_name=query)
        if depts:
            dept_text = []
            for d in depts[:3]:
                dept_text.append(
                    f"🏢 {d['name']} ({d['code']}):\n- Địa điểm: {d['location']}\n- SĐT: {d['phone']} | Email: {d['email']}\n- Giờ làm việc: {d['office_hours']}\n- Nhiệm vụ: {d['description']}"
                )
            candidates.append({
                "title": "Danh bạ liên hệ các Phòng ban chức năng NEU",
                "excerpt": "\n\n".join(dept_text),
                "source_type": "Danh bạ đơn vị",
                "score": 5.0,
                "department": "Trường Đại học Kinh tế Quốc dân",
            })

    # 5. Tra cứu FaqItem (lọc theo audience nếu audience != 'sinh_vien')
    faq_stmt = select(FaqItem).where(FaqItem.status == "published")
    if audience == "tuyen_sinh":
        faq_stmt = faq_stmt.where(FaqItem.audience.in_(["chung", "tuyen_sinh"]))
    for faq in db.scalars(faq_stmt).all():
        q_score = lexical_score(query, faq.question)
        a_score = lexical_score(query, faq.answer)
        score = max(q_score, 0.4 * q_score + 0.6 * a_score)
        if score >= settings.rag_min_score:
            candidates.append({
                "title": f"FAQ: {faq.question}",
                "excerpt": f"Câu hỏi: {faq.question}\nGiải đáp: {faq.answer}",
                "source_type": "FAQ chính thức",
                "score": score + 0.5,
                "category": faq.category,
                "audience": faq.audience,
            })

    # 6. Tra cứu KnowledgeChunks
    doc_stmt = (
        select(KnowledgeChunk, KnowledgeDocument)
        .join(KnowledgeDocument, KnowledgeDocument.id == KnowledgeChunk.document_id)
        .where(KnowledgeDocument.status.in_(["ready", "published"]))
    )
    if audience == "tuyen_sinh":
        doc_stmt = doc_stmt.where(KnowledgeDocument.audience.in_(["chung", "tuyen_sinh"]))
    if year:
        doc_stmt = doc_stmt.where(KnowledgeDocument.academic_year == str(year))

    for chunk, doc in db.execute(doc_stmt.limit(500)).all():
        score = lexical_score(query, chunk.content)
        if score >= settings.rag_min_score:
            candidates.append({
                "title": doc.title or doc.filename,
                "excerpt": chunk.content,
                "source_type": "Văn bản/Quy chế",
                "score": score,
                "academic_year": doc.academic_year,
                "version": doc.version,
                "effective_from": str(doc.effective_from) if doc.effective_from else None,
                "source_url": doc.source_url,
            })

    # Sắp xếp và lọc trùng lặp
    candidates.sort(key=lambda x: x["score"], reverse=True)
    selected, seen = [], set()
    for c in candidates:
        norm_key = re.sub(r"\W+", "", c["excerpt"][:100].lower())
        if norm_key in seen:
            continue
        seen.add(norm_key)
        selected.append(c)
        if len(selected) >= limit:
            break
    return selected


def _redact_provider_text(value: str) -> str:
    """Che thông tin định danh nhạy cảm trước khi gửi tới LLM."""
    value = re.sub(r"\b(?:otp|mã xác thực|mã đăng nhập)\s*(?:là|:)?\s*\d{4,8}\b", "[mã xác thực đã ẩn]", value, flags=re.IGNORECASE)
    value = re.sub(r"\b(?:mật khẩu|password|api key|khóa api|token)\s*(?:là|:|=)\s*\S+", "[bí mật đã ẩn]", value, flags=re.IGNORECASE)
    value = re.sub(r"\b(?:mssv|mã sinh viên|student id)\s*(?:là|:)?\s*[A-Z0-9-]{4,}\b", "[mã sinh viên đã ẩn]", value, flags=re.IGNORECASE)
    value = re.sub(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", "[email đã ẩn]", value, flags=re.IGNORECASE)
    value = re.sub(r"(?<!\w)(?:\+?84|0)(?:[\s().-]*\d){8,10}(?!\w)", "[số điện thoại đã ẩn]", value)
    value = re.sub(r"(?<!\w)\d[\d\s-]{8,16}\d(?!\w)", "[mã định danh/CCCD đã ẩn]", value)
    return value


def _build_generation_prompt(
    question: str,
    context: list[dict],
    history: list[dict],
    private_context: str = "",
    intent: str = "school_knowledge"
) -> tuple[str, list[dict], str]:
    bounded_context = []
    remaining = settings.rag_max_context_chars
    for item in context[:5]:
        if remaining <= 0:
            break
        excerpt = item["excerpt"][:min(1600, remaining)]
        bounded_context.append({**item, "excerpt": excerpt})
        remaining -= len(excerpt)

    source_parts = []
    for index, item in enumerate(bounded_context, 1):
        dept_info = f" | Đơn vị: {item.get('department')}" if item.get('department') else ""
        year_info = f" | Năm áp dụng: {item.get('academic_year')}" if item.get('academic_year') else ""
        source_parts.append(
            f"[Nguồn {index}: {item['title']} ({item['source_type']}{dept_info}{year_info})]\n{_redact_provider_text(item['excerpt'])}"
        )

    if private_context:
        source_parts.insert(0, f"[Dữ liệu học tập & cá nhân đã xác thực của người dùng]\n{_redact_provider_text(private_context)}")

    source_text = "\n\n".join(source_parts) or "Không tìm thấy văn bản quy định hoặc số liệu chính thức cụ thể trong cơ sở dữ liệu."

    system_message = (
        "Bạn là Study AI - Trợ lý Tuyển sinh, Cố vấn Học vụ và Đồng hành Đời sống sinh viên Đại học Kinh tế Quốc dân (NEU).\n\n"
        "NGUYÊN TẮC TƯ DUY & TRẢ LỜI LINH HOẠT (DUAL-MODE THINKING):\n"
        "1. ĐỐI VỚI SỐ LIỆU PHÁP LÝ & TUYỂN SINH CHÍNH THỨC (Điểm chuẩn, Học phí, Chỉ tiêu, Mã ngành, Điều kiện xét tuyển):\n"
        "   - Bắt buộc tuân thủ dữ liệu chính thức trong THÔNG TIN THAM KHẢO được cung cấp bên dưới để đảm bảo tính chuẩn xác 100%, tuyệt đối không tự bịa đặt số liệu năm hoặc điểm chuẩn sai lệch.\n"
        "   - Nếu câu hỏi hỏi về số liệu chưa từng được công bố (ví dụ: điểm chuẩn năm tương lai, quy định chưa ban hành), hãy giải thích lịch sự và hướng dẫn liên hệ Phòng Tuyển sinh/Phòng Đào tạo.\n\n"
        "2. ĐỐI VỚI TẤT CẢ CÂU HỎI MỞ KHÁC VỀ NEU VÀ ĐỜI SỐNG HỌC ĐƯỜNG:\n"
        "   - Cơ sở vật chất: Khuôn viên 207 Giải Phóng, Tòa nhà Thế kỷ A1, Hội trường lớn A2, giảng đường B, C, D, Thư viện Phạm Văn Đồng, hệ thống thang máy, các khu nhà gửi xe (cổng Giải Phóng, cổng Trần Đại Nghĩa, khu ký túc xá), sân thể thao, ký túc xá...\n"
        "   - Đời sống & học tập: Kinh nghiệm học tín chỉ, phương pháp học tập, ăn uống giải trí quanh trường (ngõ Tự Do, phố Trần Đại Nghĩa), câu lạc bộ sinh viên, tâm lý thi cử...\n"
        "   -> BẠN ĐƯỢC TỰ DO VẬN DỤNG TRÍ TUỆ NHÂN TẠO VÀ HIỂU BIẾT SÂU SẮC VỀ NEU ĐỂ SUY NGHĨ, PHÂN TÍCH VÀ TRẢ LỜI TẬN TÌNH, THỰC TẾ, GẦN GŨI VỚI SINH VIÊN. TUYỆT ĐỐI KHÔNG TỪ CHỐI SÁO RỖNG.\n\n"
        "3. PHONG CÁCH DIỄN ĐẠT:\n"
        "   - Tiếng Việt chuẩn mực, thông minh, thân thiện và thấu hiểu sinh viên.\n"
        "   - Trình bày đẹp mắt bằng Markdown: gạch đầu dòng, tiêu đề ngắn, nhấn mạnh các từ khóa quan trọng.\n"
        "   - Cuối câu trả lời, luôn chủ động gợi ý 2-3 câu hỏi tiếp theo liên quan (dưới dạng: 'Gợi ý câu hỏi tiếp theo:').\n\n"
        f"THÔNG TIN THAM KHẢO BỔ TRỢ:\n{source_text}"
    )

    safe_history = [
        {"role": item.get("role", "user"), "content": _redact_provider_text(str(item.get("content", ""))[:1200])}
        for item in history[-8:]
    ]
    return system_message, safe_history, _redact_provider_text(question)[:6000]


def _fallback_answer_without_llm(context: list[dict], private_context: str = "") -> str:
    if private_context:
        return f"Thông tin tra cứu từ hệ thống của bạn:\n{private_context}"
    if not context:
        return "Hiện tại hệ thống chưa tìm thấy tài liệu phù hợp trong cơ sở dữ liệu để giải đáp câu hỏi này."
    lines = ["Dưới đây là thông tin trích xuất từ các tài liệu tham khảo chính thức của Đại học Kinh tế Quốc dân (NEU):"]
    for i, item in enumerate(context[:3], 1):
        lines.append(f"\n**{i}. {item.get('title', 'Tài liệu')}**\n{item.get('excerpt', '')}")
    return "\n".join(lines)


async def stream_answer(
    question: str,
    context: list[dict],
    history: list[dict],
    private_context: str = "",
    intent: str = "school_knowledge",
    on_status=None,
    budget_seconds: float | None = None
) -> AsyncIterator[ProviderStreamEvent]:
    status = provider_manager.status()
    if not (status["configured"] or status["fallback_configured"]):
        yield ProviderStreamEvent("token", text=_fallback_answer_without_llm(context, private_context))
        yield ProviderStreamEvent("complete")
        return

    system_message, safe_history, safe_question = _build_generation_prompt(
        question, context, history, private_context, intent
    )
    async for event in provider_manager.stream(
        system_message, safe_history, safe_question, on_status=on_status, budget_seconds=budget_seconds
    ):
        yield event


async def generate_answer(
    question: str,
    context: list[dict],
    history: list[dict],
    private_context: str = "",
    intent: str = "school_knowledge",
    on_status=None,
    budget_seconds: float | None = None
) -> AnswerResult:
    output: list[str] = []
    completion = None
    async for event in stream_answer(
        question, context, history, private_context, intent, on_status, budget_seconds
    ):
        if event.event == "token":
            output.append(event.text)
        elif event.event == "complete":
            completion = event

    if private_context:
        return AnswerResult("".join(output), "account_data")
    status = provider_manager.status()
    if not (status["configured"] or status["fallback_configured"]):
        return AnswerResult("".join(output), "retrieval_only")
    if completion is None or not completion.provider:
        raise ProviderError(settings.ai_provider, None, "empty_response", error_kind="invalid_response")
    return AnswerResult(
        "".join(output),
        "cloud",
        completion.provider,
        completion.model,
        completion.used_fallback,
        completion.metrics
    )


def extract_document(filename: str, raw: bytes) -> str:
    suffix = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if suffix in {"md", "markdown"}:
        text = raw.decode("utf-8-sig", errors="replace")
        frontmatter = re.match(r"\A---\s*\r?\n(.*?)\r?\n---\s*(?:\r?\n|$)", text, flags=re.DOTALL)
        if frontmatter:
            metadata = {}
            for line in frontmatter.group(1).splitlines():
                key, separator, value = line.partition(":")
                if separator and key.strip() in {"title", "category", "scope"}:
                    metadata[key.strip()] = value.strip().strip("\"'")
            context = "\n".join(
                f"{label}: {metadata[key]}" for key, label in (
                    ("title", "Tài liệu"), ("category", "Chủ đề"), ("scope", "Phạm vi áp dụng")
                ) if metadata.get(key)
            )
            body = text[frontmatter.end():].lstrip()
            return f"{context}\n\n{body}" if context else body
        return text
    if suffix == "txt":
        return raw.decode("utf-8-sig", errors="replace")
    if suffix == "pdf":
        reader = PdfReader(BytesIO(raw))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    if suffix == "docx":
        document = DocxDocument(BytesIO(raw))
        return "\n".join(paragraph.text for paragraph in document.paragraphs)
    raise ValueError("Chỉ chấp nhận tài liệu PDF, DOCX, TXT hoặc Markdown (MD).")


async def ingest_document(db: Session, document: KnowledgeDocument, raw: bytes) -> None:
    try:
        text = extract_document(document.filename, raw)
        pieces = chunks_for(text)
        if not pieces:
            raise ValueError("Tài liệu không có văn bản có thể trích xuất.")
        for ordinal, content in enumerate(pieces):
            db.add(KnowledgeChunk(
                document_id=document.id,
                ordinal=ordinal,
                content=content,
                embedding=None
            ))
        document.status = "ready"
        db.commit()
    except Exception as exc:
        db.rollback()
        document.status = "failed"
        document.error = str(exc)[:1000]
        db.add(document)
        db.commit()

