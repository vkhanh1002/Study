import io
from datetime import date, datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import current_user, require_roles
from app.core.database import get_db
from app.models import (
    Faculty, Personnel, PersonnelContract, PersonnelDegree, StatusHistory,
    StudentRequest, SupportTicket, User
)
from app.schemas import (
    DegreeReviewUpdate, PersonnelContractCreate, PersonnelContractPublic,
    PersonnelCreate, PersonnelDegreeCreate, PersonnelDegreePublic,
    PersonnelProfileSelfUpdate, PersonnelPublic, PersonnelReviewUpdate,
    PersonnelUpdate, StudentRequestPublic
)
from app.services.serializers import personnel_public

router = APIRouter(prefix="/personnel", tags=["Personnel"])
ADMIN_ROLES = ("ADMIN", "super_admin")
LECTURER_ROLES = ("GIANG_VIEN", "lecturer", "ADMIN", "super_admin")
ACTIVE = "Đang công tác"


def _base_query():
    return select(Personnel).options(joinedload(Personnel.faculty))


# ==========================================
# 1. API CÔNG KHAI CHO THÍ SINH / KHÁCH (TS7)
# ==========================================

@router.get("/public-lecturers")
def list_public_lecturers(
    q: str | None = None,
    faculty_id: str | None = None,
    db: Session = Depends(get_db),
):
    """Danh mục giảng viên công khai phục vụ tra cứu thông tin tuyển sinh và đội ngũ."""
    query = _base_query().where(Personnel.kind == "lecturer", Personnel.work_status == ACTIVE)
    if faculty_id:
        query = query.where(Personnel.faculty_id == faculty_id)
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        query = query.outerjoin(Faculty, Personnel.faculty_id == Faculty.id).where(
            or_(
                Personnel.full_name.ilike(pattern),
                Personnel.specialty.ilike(pattern),
                Personnel.academic_rank.ilike(pattern),
                Faculty.name.ilike(pattern),
            )
        )
    rows = db.scalars(query.order_by(Personnel.full_name)).unique().all()
    return [
        {
            "id": row.id,
            "full_name": row.full_name,
            "academic_rank": row.academic_rank,
            "education_level": row.education_level,
            "specialty": row.specialty,
            "faculty_name": row.faculty.name if row.faculty else row.department,
            "position": row.position,
            "email": row.email,
            "avatar_url": row.avatar_url,
        }
        for row in rows
    ]


# ==========================================
# 2. API QUẢN TRỊ VIÊN XUẤT FILE EXCEL (AD_NS5)
# ==========================================

@router.get("/export/excel")
def export_personnel_excel(
    _user: User = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    """Xuất danh sách cán bộ, giảng viên ra tệp Excel (.xlsx)."""
    import openpyxl
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

    rows = db.scalars(_base_query().order_by(Personnel.kind, Personnel.code)).unique().all()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Danh sách nhân sự"

    # Header title
    ws.merge_cells("A1:I1")
    title_cell = ws["A1"]
    title_cell.value = "DANH SÁCH NHÂN SỰ & GIẢNG VIÊN - NEU STUDY"
    title_cell.font = Font(name="Arial", size=14, bold=True, color="1E3A8A")
    title_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 35

    headers = [
        "STT", "Mã nhân sự", "Họ và tên", "Loại nhân sự",
        "Đơn vị / Khoa", "Chức vụ", "Trình độ / Học vị", "Email", "Trạng thái công tác"
    ]
    ws.append(headers)
    ws.row_dimensions[2].height = 25

    header_fill = PatternFill(start_color="0284C7", end_color="0284C7", fill_type="solid")
    header_font = Font(name="Arial", size=11, bold=True, color="FFFFFF")
    thin_border = Border(
        left=Side(style="thin", color="CCCCCC"),
        right=Side(style="thin", color="CCCCCC"),
        top=Side(style="thin", color="CCCCCC"),
        bottom=Side(style="thin", color="CCCCCC"),
    )

    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=2, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    for idx, p in enumerate(rows, start=1):
        row_data = [
            idx,
            p.code,
            p.full_name,
            "Giảng viên" if p.kind == "lecturer" else "Nhân viên",
            p.faculty.name if p.faculty else (p.department or "Chưa phân đơn vị"),
            p.position or "—",
            f"{p.academic_rank} {p.education_level}".strip() or "—",
            p.email,
            p.work_status,
        ]
        ws.append(row_data)
        r_num = idx + 2
        ws.row_dimensions[r_num].height = 20
        for col_idx in range(1, len(headers) + 1):
            c = ws.cell(row=r_num, column=col_idx)
            c.border = thin_border
            c.font = Font(name="Arial", size=10)
            if col_idx in (1, 2, 4, 9):
                c.alignment = Alignment(horizontal="center", vertical="center")

    # Tự căn chỉnh chiều rộng cột
    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        col_letter = openpyxl.utils.get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    filename = f"danh_sach_nhan_su_{datetime.now().strftime('%Y%m%d')}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ==========================================
# 3. API DÀNH CHO GIẢNG VIÊN ĐĂNG NHẬP (GV1-GV6)
# ==========================================

@router.get("/me", response_model=PersonnelPublic)
def get_my_personnel_profile(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Giảng viên xem hồ sơ cá nhân của mình."""
    row = db.scalar(_base_query().where(Personnel.user_id == user.id))
    if not row:
        # Fallback thử tìm theo email
        row = db.scalar(_base_query().where(Personnel.email == user.email.lower()))
        if row and not row.user_id:
            row.user_id = user.id
            db.commit()
    if not row:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ giảng viên liên kết với tài khoản này.")
    return personnel_public(row)


@router.patch("/me", response_model=PersonnelPublic)
def update_my_personnel_profile(
    payload: PersonnelProfileSelfUpdate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Giảng viên cập nhật hồ sơ -> Chuyển sang trạng thái CHO_DUYET chờ Admin duyệt."""
    row = db.scalar(_base_query().where(Personnel.user_id == user.id))
    if not row:
        row = db.scalar(_base_query().where(Personnel.email == user.email.lower()))
    if not row:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ giảng viên.")

    updates = payload.model_dump(exclude_unset=True, exclude_none=True)
    if not updates:
        return personnel_public(row)

    old_status = row.profile_status
    row.pending_updates = {**(row.pending_updates or {}), **updates}
    row.profile_status = "CHO_DUYET"
    row.rejection_reason = ""

    # Ghi lại lịch sử trạng thái
    db.add(StatusHistory(
        entity_type="personnel",
        entity_id=row.id,
        old_status=old_status,
        new_status="CHO_DUYET",
        changed_by=user.full_name,
        reason="Giảng viên gửi yêu cầu cập nhật thông tin hồ sơ."
    ))

    db.commit()
    db.refresh(row)
    return personnel_public(row)


# ==========================================
# 4. API DUYỆT HỒ SƠ GIẢNG VIÊN (AD_NS1 - AD_NS2)
# ==========================================

@router.post("/{personnel_id}/review", response_model=PersonnelPublic)
def review_personnel_profile(
    personnel_id: str,
    payload: PersonnelReviewUpdate,
    admin: User = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    """Admin duyệt hoặc từ chối thông tin chỉnh sửa hồ sơ giảng viên."""
    row = db.scalar(_base_query().where(Personnel.id == personnel_id))
    if not row:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ nhân sự.")

    old_status = row.profile_status
    if payload.action == "APPROVE":
        if row.pending_updates:
            for field, val in row.pending_updates.items():
                if hasattr(row, field) and val is not None:
                    setattr(row, field, val)
            row.pending_updates = {}
        row.profile_status = "DA_DUYET"
        row.rejection_reason = ""
        reason = "Admin phê duyệt cập nhật hồ sơ."
    else:
        if not payload.rejection_reason.strip():
            raise HTTPException(status_code=422, detail="Vui lòng nhập lý do từ chối.")
        row.profile_status = "TU_CHOI"
        row.rejection_reason = payload.rejection_reason.strip()
        reason = f"Từ chối: {row.rejection_reason}"

    db.add(StatusHistory(
        entity_type="personnel",
        entity_id=row.id,
        old_status=old_status,
        new_status=row.profile_status,
        changed_by=admin.full_name,
        reason=reason
    ))

    db.commit()
    db.refresh(row)
    return personnel_public(row)


# ==========================================
# 5. API VĂN BẰNG & CHỨNG CHỈ (GV3, AD_NS3)
# ==========================================

@router.get("/{personnel_id}/degrees", response_model=list[PersonnelDegreePublic])
def list_degrees_for_personnel(
    personnel_id: str,
    _user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    degrees = db.scalars(
        select(PersonnelDegree)
        .where(PersonnelDegree.personnel_id == personnel_id)
        .order_by(PersonnelDegree.issue_year.desc())
    ).all()
    return degrees


@router.get("/me/degrees", response_model=list[PersonnelDegreePublic])
def list_my_degrees(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    row = db.scalar(select(Personnel.id).where(Personnel.user_id == user.id))
    if not row:
        row = db.scalar(select(Personnel.id).where(Personnel.email == user.email.lower()))
    if not row:
        return []
    return db.scalars(
        select(PersonnelDegree)
        .where(PersonnelDegree.personnel_id == row)
        .order_by(PersonnelDegree.issue_year.desc())
    ).all()


@router.post("/me/degrees", response_model=PersonnelDegreePublic, status_code=201)
def add_my_degree(
    payload: PersonnelDegreeCreate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Giảng viên tải lên văn bằng/chứng chỉ mới -> Trạng thái CHO_DUYET."""
    person = db.scalar(select(Personnel).where(Personnel.user_id == user.id))
    if not person:
        person = db.scalar(select(Personnel).where(Personnel.email == user.email.lower()))
    if not person:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ giảng viên.")

    degree = PersonnelDegree(
        personnel_id=person.id,
        title=payload.title.strip(),
        degree_type=payload.degree_type,
        issuing_institution=payload.issuing_institution.strip(),
        issue_year=payload.issue_year,
        file_url=payload.file_url,
        status="CHO_DUYET",
        rejection_reason=""
    )
    db.add(degree)
    db.commit()
    db.refresh(degree)
    return degree


@router.patch("/degrees/{degree_id}/review", response_model=PersonnelDegreePublic)
def review_degree(
    degree_id: str,
    payload: DegreeReviewUpdate,
    admin: User = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    """Admin phê duyệt hoặc từ chối văn bằng của giảng viên."""
    degree = db.get(PersonnelDegree, degree_id)
    if not degree:
        raise HTTPException(status_code=404, detail="Không tìm thấy văn bằng.")

    old_status = degree.status
    if payload.action == "APPROVE":
        degree.status = "DA_DUYET"
        degree.rejection_reason = ""
    else:
        if not payload.rejection_reason.strip():
            raise HTTPException(status_code=422, detail="Vui lòng nhập lý do từ chối văn bằng.")
        degree.status = "TU_CHOI"
        degree.rejection_reason = payload.rejection_reason.strip()

    db.add(StatusHistory(
        entity_type="degree",
        entity_id=degree.id,
        old_status=old_status,
        new_status=degree.status,
        changed_by=admin.full_name,
        reason=degree.rejection_reason or "Admin duyệt văn bằng."
    ))

    db.commit()
    db.refresh(degree)
    return degree


# ==========================================
# 6. API HỢP ĐỒNG LAO ĐỘNG (GV4, AD_NS4)
# ==========================================

def _serialize_contract(c: PersonnelContract) -> dict:
    today = date.today()
    days_left = (c.end_date - today).days if c.end_date else None
    # Cảnh báo hết hạn: có ngày kết thúc và còn lại trong vòng 60 ngày
    is_expiring = bool(days_left is not None and 0 <= days_left <= 60 and c.status == "Hiệu lực")
    status = "Sắp hết hạn" if is_expiring else c.status
    return {
        "id": c.id,
        "personnel_id": c.personnel_id,
        "personnel_name": c.personnel.full_name if c.personnel else None,
        "personnel_code": c.personnel.code if c.personnel else None,
        "contract_number": c.contract_number,
        "contract_type": c.contract_type,
        "start_date": c.start_date,
        "end_date": c.end_date,
        "status": status,
        "salary_rate": c.salary_rate,
        "file_url": c.file_url,
        "notes": c.notes,
        "is_expiring_soon": is_expiring,
        "days_left": days_left,
        "created_at": c.created_at,
    }


@router.get("/me/contracts", response_model=list[PersonnelContractPublic])
def list_my_contracts(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Giảng viên xem hợp đồng lao động của mình."""
    person = db.scalar(select(Personnel).where(Personnel.user_id == user.id))
    if not person:
        person = db.scalar(select(Personnel).where(Personnel.email == user.email.lower()))
    if not person:
        return []
    rows = db.scalars(
        select(PersonnelContract)
        .options(joinedload(PersonnelContract.personnel))
        .where(PersonnelContract.personnel_id == person.id)
        .order_by(PersonnelContract.start_date.desc())
    ).all()
    return [_serialize_contract(r) for r in rows]


@router.get("/contracts/all", response_model=list[PersonnelContractPublic])
def list_all_contracts(
    expiring_soon_only: bool = False,
    _admin: User = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    """Admin quản lý toàn bộ hợp đồng với tính năng lọc hợp đồng sắp hết hạn trong 60 ngày."""
    rows = db.scalars(
        select(PersonnelContract)
        .options(joinedload(PersonnelContract.personnel))
        .order_by(PersonnelContract.end_date.asc().nullslast())
    ).all()
    items = [_serialize_contract(r) for r in rows]
    if expiring_soon_only:
        items = [c for c in items if c["is_expiring_soon"]]
    return items


@router.post("/contracts", response_model=PersonnelContractPublic, status_code=201)
def create_contract(
    payload: PersonnelContractCreate,
    _admin: User = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    """Admin tạo hợp đồng mới cho nhân sự."""
    if db.scalar(select(PersonnelContract.id).where(PersonnelContract.contract_number == payload.contract_number)):
        raise HTTPException(status_code=409, detail="Số hợp đồng này đã tồn tại trên hệ thống.")

    contract = PersonnelContract(
        personnel_id=payload.personnel_id,
        contract_number=payload.contract_number.strip(),
        contract_type=payload.contract_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status=payload.status,
        salary_rate=payload.salary_rate.strip(),
        file_url=payload.file_url.strip(),
        notes=payload.notes.strip(),
    )
    db.add(contract)
    db.commit()
    contract = db.scalar(
        select(PersonnelContract)
        .options(joinedload(PersonnelContract.personnel))
        .where(PersonnelContract.id == contract.id)
    )
    return _serialize_contract(contract)


# ==========================================
# 7. CÔNG VIỆC ĐƯỢC GIAO CHO GIẢNG VIÊN (GV5)
# ==========================================

@router.get("/me/assigned-requests", response_model=list[StudentRequestPublic])
def list_my_assigned_requests(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Giảng viên xem các đơn sinh viên hoặc phiếu góp ý được Admin phân công xử lý."""
    rows = db.scalars(
        select(StudentRequest)
        .options(joinedload(StudentRequest.student))
        .where(StudentRequest.assigned_lecturer_id == user.id)
        .order_by(StudentRequest.created_at.desc())
    ).all()
    return [
        {
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
            "assigned_lecturer_name": user.full_name,
            "rating": r.rating,
            "feedback": r.feedback,
            "created_at": r.created_at,
            "updated_at": r.updated_at,
        }
        for r in rows
    ]


# ==========================================
# 8. DANH SÁCH & CRUD NHÂN SỰ CỦA ADMIN
# ==========================================

@router.get("", response_model=list[PersonnelPublic])
def list_personnel(
    kind: str | None = None,
    q: str | None = None,
    status: str | None = None,
    profile_status: str | None = None,
    department: str | None = None,
    faculty_id: str | None = None,
    _user: User = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    query = _base_query()
    if kind in {"lecturer", "employee"}:
        query = query.where(Personnel.kind == kind)
    if status:
        query = query.where(Personnel.work_status == status)
    if profile_status:
        query = query.where(Personnel.profile_status == profile_status)
    if department:
        query = query.where(Personnel.department.ilike(f"%{department}%"))
    if faculty_id:
        query = query.where(Personnel.faculty_id == faculty_id)
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        query = query.outerjoin(Faculty, Personnel.faculty_id == Faculty.id).where(
            or_(
                Personnel.code.ilike(pattern),
                Personnel.full_name.ilike(pattern),
                Personnel.email.ilike(pattern),
                Personnel.specialty.ilike(pattern),
                Personnel.department.ilike(pattern),
                Faculty.name.ilike(pattern),
            )
        )
    rows = db.scalars(query.order_by(Personnel.kind, Personnel.code)).unique().all()
    return [personnel_public(row) for row in rows]


@router.get("/dashboard")
def personnel_dashboard(
    _user: User = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    totals = {
        kind: db.scalar(select(func.count(Personnel.id)).where(Personnel.kind == kind)) or 0
        for kind in ("lecturer", "employee")
    }
    by_status = db.execute(select(Personnel.work_status, func.count(Personnel.id)).group_by(Personnel.work_status)).all()
    by_unit = db.execute(
        select(Personnel.department, func.count(Personnel.id))
        .group_by(Personnel.department)
        .order_by(func.count(Personnel.id).desc())
    ).all()
    active = db.scalar(select(func.count(Personnel.id)).where(Personnel.work_status == ACTIVE)) or 0
    pending_approval = db.scalar(select(func.count(Personnel.id)).where(Personnel.profile_status == "CHO_DUYET")) or 0

    # Đếm số hợp đồng sắp hết hạn trong 60 ngày
    today = date.today()
    exp_threshold = today + timedelta(days=60)
    expiring_contracts = db.scalar(
        select(func.count(PersonnelContract.id))
        .where(
            PersonnelContract.end_date.is_not(None),
            PersonnelContract.end_date >= today,
            PersonnelContract.end_date <= exp_threshold,
            PersonnelContract.status == "Hiệu lực"
        )
    ) or 0

    return {
        "lecturers": totals["lecturer"],
        "employees": totals["employee"],
        "total": sum(totals.values()),
        "active": active,
        "inactive": sum(totals.values()) - active,
        "pending_approval": pending_approval,
        "expiring_contracts": expiring_contracts,
        "by_status": [{"name": name, "count": count} for name, count in by_status],
        "by_unit": [{"name": name or "Chưa phân đơn vị", "count": count} for name, count in by_unit],
    }


@router.post("", response_model=PersonnelPublic, status_code=201)
def create_personnel(
    data: PersonnelCreate,
    _user: User = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    if db.scalar(select(Personnel.id).where(Personnel.code == data.code)):
        raise HTTPException(status_code=409, detail="Mã hồ sơ nhân sự đã tồn tại.")
    if db.scalar(select(Personnel.id).where(Personnel.email == data.email.lower())):
        raise HTTPException(status_code=409, detail="Email nhân sự đã tồn tại.")
    if data.faculty_id and not db.get(Faculty, data.faculty_id):
        raise HTTPException(status_code=422, detail="Không tìm thấy khoa đã chọn.")
    row = Personnel(**data.model_dump(exclude={"email"}), email=data.email.lower())
    db.add(row)
    db.commit()
    row = db.scalar(_base_query().where(Personnel.id == row.id))
    return personnel_public(row)


@router.get("/{personnel_id}", response_model=PersonnelPublic)
def get_personnel(
    personnel_id: str,
    _user: User = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    row = db.scalar(_base_query().where(Personnel.id == personnel_id))
    if not row:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ nhân sự.")
    return personnel_public(row)


@router.patch("/{personnel_id}", response_model=PersonnelPublic)
def update_personnel(
    personnel_id: str,
    data: PersonnelUpdate,
    _user: User = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    row = db.get(Personnel, personnel_id)
    if not row:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ nhân sự.")
    updates = data.model_dump(exclude_unset=True)
    email = updates.get("email")
    if email and db.scalar(select(Personnel.id).where(Personnel.email == email.lower(), Personnel.id != row.id)):
        raise HTTPException(status_code=409, detail="Email nhân sự đã được sử dụng.")
    if updates.get("faculty_id") and not db.get(Faculty, updates["faculty_id"]):
        raise HTTPException(status_code=422, detail="Không tìm thấy khoa đã chọn.")
    if email:
        updates["email"] = email.lower()
    for field, value in updates.items():
        setattr(row, field, value)
    db.commit()
    row = db.scalar(_base_query().where(Personnel.id == personnel_id))
    return personnel_public(row)
