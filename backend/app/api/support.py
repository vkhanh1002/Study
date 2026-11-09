from datetime import date, datetime, timezone
import random
from urllib.parse import quote
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import current_user, require_roles
from app.core.database import get_db
from app.models import (
    AcademicSchedule, AdmissionChecklistProgress, Announcement, FAQ,
    Notification, StatusHistory, Student, StudentRequest, SupportTicket,
    TicketAttachment, TicketMessage, User
)
from app.schemas import (
    AcademicSchedulePublic, AnnouncementPublic, ChecklistStepPublic,
    ChecklistStepUpdate, FAQAdminPublic, FAQCreate, FAQPublic,
    StudentRequestCreate, StudentRequestPublic, StudentRequestRating,
    StudentRequestStatusUpdate, TicketAssign, TicketCreate, TicketPublic,
    TicketRating, TicketReply, TicketStatusUpdate
)
from app.services.serializers import ticket_public

router = APIRouter(tags=["Student support"])
SUPPORT_ROLES = ("ADMIN", "super_admin", "support_staff")
TICKET_STATES = {"Mới tiếp nhận", "Đang xử lý", "Chờ bổ sung thông tin", "Đã giải quyết", "Đã đóng"}

CHECKLIST_STEPS = [
    (1, "Xác nhận nhập học trực tuyến", "Truy cập cổng tuyển sinh NEU, xác nhận nhập học và nhận mã sinh viên tạm thời."),
    (2, "Nộp học phí tạm thu học kỳ 1", "Chuyển khoản học phí qua cổng thanh toán số hoặc tài khoản ngân hàng của trường."),
    (3, "Khai báo lý lịch sinh viên trực tuyến", "Hoàn thiện hồ sơ lý lịch điện tử, thông tin người liên hệ khẩn cấp."),
    (4, "Nộp hồ sơ bản cứng tại trường", "Nộp học bạ gốc, giấy khai sinh, giấy chứng nhận tốt nghiệp THPT tạm thời."),
    (5, "Chụp ảnh thẻ sinh viên & nhận thẻ", "Chụp ảnh tại Tòa nhà A1 hoặc đăng ký tích hợp thẻ sinh viên đa năng qua app ngân hàng."),
    (6, "Khám sức khỏe đầu khóa", "Khám sức khỏe theo lịch phân bổ của Trạm Y tế NEU."),
    (7, "Đăng ký ký túc xá sinh viên", "Đăng ký phòng ở KTX trực tuyến cho sinh viên ngoại tỉnh có nhu cầu."),
    (8, "Tham gia Tuần sinh hoạt công dân sinh viên", "Tham gia các buổi học chính trị, phổ biến quy chế đào tạo đầu khóa."),
    (9, "Kiểm tra trình độ tiếng Anh phân lớp", "Thi bài kiểm tra xếp lớp tiếng Anh đầu vào theo khung CEFR."),
    (10, "Kích hoạt email sinh viên & Cổng đào tạo", "Đăng nhập hòm thư @neu.edu.vn và cổng Quản lý đào tạo tín chỉ."),
    (11, "Nhận thời khóa biểu học kỳ 1", "Xem lịch học, giảng đường và thông tin giảng viên cố vấn học tập."),
]


# ==========================================
# 1. CHECKLIST NHẬP HỌC 11 BƯỚC (SV2, AD_HT)
# ==========================================

@router.get("/support/checklist/me")
def get_my_admission_checklist(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Lấy danh sách 11 bước thủ tục nhập học và % tiến độ của sinh viên."""
    student = db.scalar(select(Student).where(Student.user_id == user.id))
    if not student:
        student = db.scalar(select(Student).where(Student.email == user.email.lower()))
    if not student:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ sinh viên liên kết với tài khoản này.")

    # Tự động nạp 11 bước nếu sinh viên chưa có bản ghi
    existing = db.scalars(
        select(AdmissionChecklistProgress)
        .where(AdmissionChecklistProgress.student_id == student.id)
        .order_by(AdmissionChecklistProgress.step_number.asc())
    ).all()

    if not existing:
        for s_num, s_title, s_desc in CHECKLIST_STEPS:
            db.add(AdmissionChecklistProgress(
                student_id=student.id,
                step_number=s_num,
                step_title=s_title,
                step_description=s_desc,
                status="DA_HOAN_THANH" if s_num == 1 else "CHUA_HOAN_THANH",
                completed_at=datetime.now(timezone.utc) if s_num == 1 else None,
            ))
        db.commit()
        existing = db.scalars(
            select(AdmissionChecklistProgress)
            .where(AdmissionChecklistProgress.student_id == student.id)
            .order_by(AdmissionChecklistProgress.step_number.asc())
        ).all()

    completed_count = sum(1 for s in existing if s.status == "DA_HOAN_THANH")
    total_steps = len(existing)
    pct = round(completed_count * 100 / total_steps) if total_steps else 0

    return {
        "progress_pct": pct,
        "completed_count": completed_count,
        "total_steps": total_steps,
        "steps": [
            {
                "id": s.id,
                "step_number": s.step_number,
                "step_title": s.step_title,
                "step_description": s.step_description,
                "status": s.status,
                "completed_at": s.completed_at,
                "notes": s.notes,
            }
            for s in existing
        ],
    }


@router.patch("/support/checklist/{step_id}", response_model=ChecklistStepPublic)
def update_checklist_step(
    step_id: str,
    payload: ChecklistStepUpdate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Sinh viên cập nhật tiến độ bước thủ tục nhập học."""
    step = db.get(AdmissionChecklistProgress, step_id)
    if not step:
        raise HTTPException(status_code=404, detail="Không tìm thấy bước thủ tục.")

    step.status = payload.status
    if payload.status == "DA_HOAN_THANH":
        step.completed_at = datetime.now(timezone.utc)
    elif payload.status == "CHUA_HOAN_THANH":
        step.completed_at = None
    if payload.notes:
        step.notes = payload.notes.strip()

    db.commit()
    db.refresh(step)
    return step


# ==========================================
# 2. ĐƠN TRỰC TUYẾN SINH VIÊN (SV3, SV4, SV7, AD_HT)
# ==========================================

VALID_REQUEST_TYPES = {
    "Xác nhận sinh viên",
    "Cấp bảng điểm tạm thời",
    "Xin bảo lưu kết quả học tập",
    "Xin rút học phí / hoàn phí",
}


def _serialize_request(r: StudentRequest) -> dict:
    return {
        "id": r.id,
        "code": r.code,
        "student_id": r.student_id,
        "student_number": r.student.student_number if r.student else "",
        "student_name": r.student.full_name if r.student else "",
        "request_type": r.request_type,
        "title": r.title,
        "reason": r.reason,
        "attachments": r.attachments or [],
        "status": r.status,
        "rejection_reason": r.rejection_reason or "",
        "assigned_lecturer_id": r.assigned_lecturer_id,
        "assigned_lecturer_name": r.assigned_lecturer.full_name if r.assigned_lecturer else None,
        "rating": r.rating,
        "feedback": r.feedback,
        "created_at": r.created_at,
        "updated_at": r.updated_at,
    }


@router.get("/support/requests/me", response_model=list[StudentRequestPublic])
def list_my_requests(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Sinh viên xem danh sách các đơn đã gửi."""
    student = db.scalar(select(Student).where(Student.user_id == user.id))
    if not student:
        student = db.scalar(select(Student).where(Student.email == user.email.lower()))
    if not student:
        return []
    rows = db.scalars(
        select(StudentRequest)
        .options(joinedload(StudentRequest.student), joinedload(StudentRequest.assigned_lecturer))
        .where(StudentRequest.student_id == student.id)
        .order_by(StudentRequest.created_at.desc())
    ).all()
    return [_serialize_request(r) for r in rows]


@router.post("/support/requests", response_model=StudentRequestPublic, status_code=201)
def create_student_request(
    payload: StudentRequestCreate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Sinh viên nộp đơn trực tuyến mới (SV3)."""
    student = db.scalar(select(Student).where(Student.user_id == user.id))
    if not student:
        student = db.scalar(select(Student).where(Student.email == user.email.lower()))
    if not student:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ sinh viên.")

    if payload.request_type not in VALID_REQUEST_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"Loại đơn không hợp lệ. Chỉ chấp nhận: {', '.join(VALID_REQUEST_TYPES)}",
        )

    code = f"DON-2026-{random.randint(1000, 9999)}"
    while db.scalar(select(StudentRequest.id).where(StudentRequest.code == code)):
        code = f"DON-2026-{random.randint(1000, 9999)}"

    req = StudentRequest(
        code=code,
        student_id=student.id,
        request_type=payload.request_type,
        title=payload.title.strip(),
        reason=payload.reason.strip(),
        attachments=payload.attachments or [],
        status="CHO_TIEP_NHAN",
    )
    db.add(req)
    db.flush()

    db.add(StatusHistory(
        entity_type="student_request",
        entity_id=req.id,
        old_status="",
        new_status="CHO_TIEP_NHAN",
        changed_by=student.full_name,
        reason=f"Sinh viên nộp đơn {payload.request_type}."
    ))

    db.commit()
    db.refresh(req)
    req = db.scalar(
        select(StudentRequest)
        .options(joinedload(StudentRequest.student), joinedload(StudentRequest.assigned_lecturer))
        .where(StudentRequest.id == req.id)
    )
    return _serialize_request(req)


@router.get("/support/requests/all", response_model=list[StudentRequestPublic])
def list_all_student_requests(
    request_type: str | None = None,
    status: str | None = None,
    q: str | None = None,
    _user: User = Depends(require_roles(*SUPPORT_ROLES)),
    db: Session = Depends(get_db),
):
    """Admin xem và lọc toàn bộ đơn từ sinh viên (AD_HT1)."""
    query = (
        select(StudentRequest)
        .options(joinedload(StudentRequest.student), joinedload(StudentRequest.assigned_lecturer))
        .order_by(StudentRequest.created_at.desc())
    )
    if request_type:
        query = query.where(StudentRequest.request_type == request_type)
    if status:
        query = query.where(StudentRequest.status == status)
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        query = query.join(StudentRequest.student).where(
            or_(
                StudentRequest.code.ilike(pattern),
                StudentRequest.title.ilike(pattern),
                Student.full_name.ilike(pattern),
                Student.student_number.ilike(pattern),
            )
        )
    rows = db.scalars(query).all()
    return [_serialize_request(r) for r in rows]


@router.patch("/support/requests/{request_id}/status", response_model=StudentRequestPublic)
def update_student_request_status(
    request_id: str,
    payload: StudentRequestStatusUpdate,
    admin: User = Depends(require_roles(*SUPPORT_ROLES)),
    db: Session = Depends(get_db),
):
    """Admin tiếp nhận, phân công xử lý hoặc phê duyệt/từ chối đơn (AD_HT2)."""
    req = db.scalar(
        select(StudentRequest)
        .options(joinedload(StudentRequest.student), joinedload(StudentRequest.assigned_lecturer))
        .where(StudentRequest.id == request_id)
    )
    if not req:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn yêu cầu.")

    old_status = req.status
    req.status = payload.status
    if payload.rejection_reason:
        req.rejection_reason = payload.rejection_reason.strip()
    if payload.assigned_lecturer_id:
        req.assigned_lecturer_id = payload.assigned_lecturer_id

    db.add(StatusHistory(
        entity_type="student_request",
        entity_id=req.id,
        old_status=old_status,
        new_status=payload.status,
        changed_by=admin.full_name,
        reason=payload.rejection_reason or f"Cập nhật trạng thái thành {payload.status}."
    ))

    # Gửi thông báo cho sinh viên
    if req.student and req.student.user_id:
        db.add(Notification(
            owner_id=req.student.user_id,
            title="Cập nhật trạng thái đơn",
            message=f"Đơn {req.code} · {req.title} đã chuyển sang trạng thái '{req.status}'.",
            href="/support"
        ))

    db.commit()
    db.refresh(req)
    req = db.scalar(
        select(StudentRequest)
        .options(joinedload(StudentRequest.student), joinedload(StudentRequest.assigned_lecturer))
        .where(StudentRequest.id == request_id)
    )
    return _serialize_request(req)


@router.post("/support/requests/{request_id}/rating", response_model=StudentRequestPublic)
def rate_student_request(
    request_id: str,
    payload: StudentRequestRating,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Sinh viên đánh giá chất lượng xử lý đơn từ 1 đến 5 sao (SV7)."""
    req = db.scalar(
        select(StudentRequest)
        .options(joinedload(StudentRequest.student), joinedload(StudentRequest.assigned_lecturer))
        .where(StudentRequest.id == request_id)
    )
    if not req:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn.")
    if req.student.user_id != user.id:
        raise HTTPException(status_code=403, detail="Bạn không thể đánh giá đơn của người khác.")

    req.rating = payload.rating
    req.feedback = payload.feedback.strip()
    db.commit()
    db.refresh(req)
    return _serialize_request(req)


# ==========================================
# 3. THỜI KHÓA BIỂU & LỊCH THI (SV6)
# ==========================================

@router.get("/support/schedules/me", response_model=list[AcademicSchedulePublic])
def list_my_schedules(
    schedule_type: str | None = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Sinh viên xem thời khóa biểu học tập và lịch thi theo tuần (SV6)."""
    student = db.scalar(select(Student).where(Student.user_id == user.id))
    if not student:
        student = db.scalar(select(Student).where(Student.email == user.email.lower()))
    if not student:
        return []

    query = select(AcademicSchedule).where(
        or_(AcademicSchedule.student_id == student.id, AcademicSchedule.major_id == student.major_id)
    )
    if schedule_type:
        query = query.where(AcademicSchedule.schedule_type == schedule_type)
    query = query.order_by(AcademicSchedule.day_of_week.asc(), AcademicSchedule.start_time.asc())
    return db.scalars(query).all()


# ==========================================
# 4. THÔNG BÁO CHUNG (SV5)
# ==========================================

@router.get("/support/announcements", response_model=list[AnnouncementPublic])
def list_announcements(
    target_role: str | None = None,
    category: str | None = None,
    db: Session = Depends(get_db),
):
    """Danh sách thông báo học tập, học phí, lịch thi cho sinh viên và giảng viên."""
    query = select(Announcement).order_by(Announcement.is_pinned.desc(), Announcement.created_at.desc())
    if target_role and target_role != "ALL":
        query = query.where(or_(Announcement.target_role == target_role, Announcement.target_role == "ALL"))
    if category:
        query = query.where(Announcement.category == category)
    return db.scalars(query).all()


# ==========================================
# 5. TICKET HỖ TRỢ KỸ THUẬT & FAQ CŨ
# ==========================================

@router.get("/support/faqs", response_model=list[FAQPublic])
def list_faqs(db: Session = Depends(get_db)):
    return db.scalars(select(FAQ).where(FAQ.is_published.is_(True)).order_by(FAQ.category, FAQ.question)).all()


@router.get("/support/tickets", response_model=list[TicketPublic])
def list_tickets(
    q: str | None = None, category: str | None = None, status: str | None = None,
    user: User = Depends(current_user), db: Session = Depends(get_db)
):
    query = select(SupportTicket).options(joinedload(SupportTicket.owner), joinedload(SupportTicket.messages), joinedload(SupportTicket.attachments)).order_by(SupportTicket.created_at.desc())
    if user.role not in SUPPORT_ROLES:
        query = query.where(SupportTicket.owner_id == user.id)
    if category:
        query = query.where(SupportTicket.category == category)
    if status:
        query = query.where(SupportTicket.status == status)
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        query = query.join(SupportTicket.owner).where(
            or_(SupportTicket.code.ilike(pattern), SupportTicket.subject.ilike(pattern),
                SupportTicket.description.ilike(pattern), User.full_name.ilike(pattern))
        )
    return [ticket_public(row) for row in db.scalars(query).unique().all()]


@router.get("/support/agents")
def list_support_agents(_user: User = Depends(require_roles(*SUPPORT_ROLES)), db: Session = Depends(get_db)):
    agents = db.scalars(select(User).where(User.role.in_(SUPPORT_ROLES), User.is_active.is_(True)).order_by(User.full_name)).all()
    return [{"id": row.id, "full_name": row.full_name, "email": row.email} for row in agents]


@router.get("/support/dashboard")
def support_dashboard(_user: User = Depends(require_roles(*SUPPORT_ROLES)), db: Session = Depends(get_db)):
    counts = {status: db.scalar(select(func.count(SupportTicket.id)).where(SupportTicket.status == status)) or 0 for status in TICKET_STATES}
    total = sum(counts.values())
    resolved = counts["Đã giải quyết"] + counts["Đã đóng"]
    recent = db.scalars(select(SupportTicket).options(joinedload(SupportTicket.owner)).order_by(SupportTicket.created_at.desc()).limit(5)).all()
    pending_requests = db.scalar(select(func.count(StudentRequest.id)).where(StudentRequest.status.in_(["CHO_TIEP_NHAN", "DANG_XU_LY"]))) or 0
    return {
        "total": total,
        "by_status": [{"status": key, "count": value} for key, value in counts.items()],
        "success_rate": round(resolved * 100 / total, 1) if total else 0,
        "pending_requests": pending_requests,
        "recent": [
            {
                "id": row.id, "code": row.code, "subject": row.subject, "owner_name": row.owner.full_name,
                "status": row.status, "category": row.category, "created_at": row.created_at
            }
            for row in recent
        ],
    }


@router.post("/support/tickets", response_model=TicketPublic, status_code=201)
def create_ticket(data: TicketCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    ticket = SupportTicket(code=f"ST-{uuid4().hex[:8].upper()}", owner_id=user.id, **data.model_dump())
    db.add(ticket)
    db.commit()
    ticket = db.scalar(select(SupportTicket).where(SupportTicket.id == ticket.id).options(joinedload(SupportTicket.owner), joinedload(SupportTicket.messages)))
    return ticket_public(ticket)


@router.post("/support/tickets/{ticket_id}/messages", response_model=TicketPublic)
def reply_ticket(ticket_id: str, data: TicketReply, user: User = Depends(current_user), db: Session = Depends(get_db)):
    ticket = db.scalar(select(SupportTicket).where(SupportTicket.id == ticket_id).options(joinedload(SupportTicket.owner), joinedload(SupportTicket.messages)))
    if not ticket:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu hỗ trợ.")
    if ticket.owner_id != user.id and user.role not in SUPPORT_ROLES:
        raise HTTPException(status_code=403, detail="Bạn không có quyền truy cập yêu cầu này.")
    ticket.messages.append(TicketMessage(author_id=user.id, body=data.body))
    if user.id != ticket.owner_id:
        db.add(Notification(owner_id=ticket.owner_id, title="Phản hồi yêu cầu hỗ trợ",
                            message=f"Bộ phận hỗ trợ đã phản hồi {ticket.code} · {ticket.subject}.", href="/support"))
    db.commit()
    ticket = db.scalar(select(SupportTicket).where(SupportTicket.id == ticket_id).options(joinedload(SupportTicket.owner), joinedload(SupportTicket.messages)))
    return ticket_public(ticket)


@router.post("/support/tickets/{ticket_id}/attachments", response_model=TicketPublic, status_code=201)
async def upload_ticket_attachment(
    ticket_id: str, file: UploadFile = File(...), user: User = Depends(current_user), db: Session = Depends(get_db)
):
    ticket = db.scalar(select(SupportTicket).where(SupportTicket.id == ticket_id).options(joinedload(SupportTicket.owner), joinedload(SupportTicket.messages), joinedload(SupportTicket.attachments)))
    if not ticket:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu hỗ trợ.")
    if ticket.owner_id != user.id and user.role not in SUPPORT_ROLES:
        raise HTTPException(status_code=403, detail="Bạn không có quyền truy cập yêu cầu này.")
    filename = (file.filename or "attachment").replace("\\", "/").split("/")[-1]
    if not filename.lower().endswith((".pdf", ".docx", ".txt", ".png", ".jpg", ".jpeg")):
        raise HTTPException(status_code=415, detail="Chỉ chấp nhận PDF, DOCX, TXT, PNG hoặc JPG.")
    content = await file.read(10 * 1024 * 1024 + 1)
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Mỗi tệp đính kèm tối đa 10 MB.")
    ticket.attachments.append(TicketAttachment(uploaded_by=user.id, filename=filename,
                                                media_type=file.content_type or "application/octet-stream",
                                                size_bytes=len(content), content=content))
    db.commit()
    ticket = db.scalar(select(SupportTicket).where(SupportTicket.id == ticket_id).options(joinedload(SupportTicket.owner), joinedload(SupportTicket.messages), joinedload(SupportTicket.attachments)))
    return ticket_public(ticket)


@router.get("/support/tickets/{ticket_id}/attachments/{attachment_id}")
def download_attachment(ticket_id: str, attachment_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    ticket = db.scalar(select(SupportTicket).where(SupportTicket.id == ticket_id))
    if not ticket:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu hỗ trợ.")
    if ticket.owner_id != user.id and user.role not in SUPPORT_ROLES:
        raise HTTPException(status_code=403, detail="Bạn không có quyền tải tệp này.")
    att = db.scalar(select(TicketAttachment).where(TicketAttachment.id == attachment_id, TicketAttachment.ticket_id == ticket_id))
    if not att:
        raise HTTPException(status_code=404, detail="Không tìm thấy tệp đính kèm.")
    ascii_name = "".join(ch for ch in att.filename if 32 <= ord(ch) < 127).strip() or "attachment"
    encoded_name = quote(att.filename)
    disposition = f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{encoded_name}"
    return Response(content=att.content, media_type=att.media_type, headers={"Content-Disposition": disposition})


@router.patch("/support/tickets/{ticket_id}/status", response_model=TicketPublic)
def update_ticket_status(ticket_id: str, data: TicketStatusUpdate, _user: User = Depends(require_roles(*SUPPORT_ROLES)), db: Session = Depends(get_db)):
    if data.status not in TICKET_STATES:
        raise HTTPException(status_code=422, detail="Trạng thái không hợp lệ.")
    ticket = db.scalar(select(SupportTicket).where(SupportTicket.id == ticket_id).options(joinedload(SupportTicket.owner), joinedload(SupportTicket.messages)))
    if not ticket:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu hỗ trợ.")
    ticket.status = data.status
    db.add(Notification(owner_id=ticket.owner_id, title="Trạng thái yêu cầu thay đổi",
                        message=f"{ticket.code} chuyển sang trạng thái: {ticket.status}.", href="/support"))
    db.commit()
    return ticket_public(ticket)


@router.patch("/support/tickets/{ticket_id}/assign", response_model=TicketPublic)
def assign_ticket(ticket_id: str, data: TicketAssign, _user: User = Depends(require_roles(*SUPPORT_ROLES)), db: Session = Depends(get_db)):
    ticket = db.scalar(select(SupportTicket).where(SupportTicket.id == ticket_id).options(joinedload(SupportTicket.owner), joinedload(SupportTicket.messages)))
    if not ticket:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu hỗ trợ.")
    if data.assignee_id and not db.get(User, data.assignee_id):
        raise HTTPException(status_code=422, detail="Không tìm thấy người xử lý.")
    ticket.assignee_id = data.assignee_id
    if ticket.status == "Mới tiếp nhận":
        ticket.status = "Đang xử lý"
    if ticket.assignee_id:
        db.add(Notification(owner_id=ticket.owner_id, title="Yêu cầu đã được phân công",
                            message=f"{ticket.code} · {ticket.subject} đang được nhân viên hỗ trợ xử lý.", href="/support"))
    db.commit()
    return ticket_public(ticket)


@router.post("/support/tickets/{ticket_id}/rating", response_model=TicketPublic)
def rate_ticket(ticket_id: str, data: TicketRating, user: User = Depends(current_user), db: Session = Depends(get_db)):
    ticket = db.scalar(select(SupportTicket).where(SupportTicket.id == ticket_id).options(joinedload(SupportTicket.owner), joinedload(SupportTicket.messages)))
    if not ticket:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu hỗ trợ.")
    if ticket.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền đánh giá yêu cầu này.")
    if ticket.status not in {"Đã giải quyết", "Đã đóng"}:
        raise HTTPException(status_code=409, detail="Chỉ đánh giá được yêu cầu đã giải quyết hoặc đã đóng.")
    ticket.satisfaction_rating = data.rating
    ticket.satisfaction_feedback = data.feedback
    db.commit()
    return ticket_public(ticket)


@router.get("/admin/faqs", response_model=list[FAQAdminPublic])
def admin_list_faqs(_user: User = Depends(require_roles(*SUPPORT_ROLES)), db: Session = Depends(get_db)):
    return db.scalars(select(FAQ).order_by(FAQ.category, FAQ.question)).all()


@router.post("/admin/faqs", response_model=FAQAdminPublic, status_code=201)
def create_faq(data: FAQCreate, _user: User = Depends(require_roles(*SUPPORT_ROLES)), db: Session = Depends(get_db)):
    faq = FAQ(**data.model_dump(), is_published=True)
    db.add(faq)
    db.commit()
    db.refresh(faq)
    return faq


@router.delete("/admin/faqs/{faq_id}", status_code=204)
def delete_faq(faq_id: str, _user: User = Depends(require_roles(*SUPPORT_ROLES)), db: Session = Depends(get_db)):
    faq = db.get(FAQ, faq_id)
    if not faq:
        raise HTTPException(status_code=404, detail="Không tìm thấy FAQ.")
    db.delete(faq)
    db.commit()
