from datetime import date, datetime, timezone
import random
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import current_user, require_roles
from app.core.database import get_db
from app.core.security import hash_password
from app.models import (
    AcademicSchedule, AdmissionChecklistProgress, AdmissionScore, Applicant,
    Faculty, Major, StatusHistory, Student, User
)
from app.schemas import (
    ApplicantCreate, ApplicantDocumentUpload, ApplicantPublic, ApplicantStatusUpdate,
    FacultyAdminCreate, MajorAdminCreate, MajorPublic, ScoreCalculationRequest,
    ScoreCalculationResponse, StudentProfileUpdate, StudentPublic, UserAdminCreate,
    UserAdminUpdate, UserPublic
)
from app.services.serializers import applicant_public, student_public

router = APIRouter(tags=["Admissions and profiles"])
ADMIN_ROLES = ("ADMIN", "super_admin", "admission_staff")

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


def major_public(major: Major) -> dict:
    return {
        "id": major.id, "code": major.code, "name": major.name, "description": major.description,
        "faculty_name": major.faculty.name if major.faculty else "", "duration_years": major.duration_years,
        "tuition_per_year_vnd": major.tuition_per_year_vnd, "admission_quota": major.admission_quota,
        "admission_status": major.admission_status, "is_demo": major.is_demo
    }


def _applicant_query():
    return (
        select(Applicant)
        .options(
            joinedload(Applicant.major),
            joinedload(Applicant.major_2),
            joinedload(Applicant.major_3),
        )
    )


# ==========================================
# 1. DANH MỤC NGÀNH & KHOA (TS1 - TS2)
# ==========================================

@router.get("/majors", response_model=list[MajorPublic])
def list_majors(db: Session = Depends(get_db)):
    return [major_public(row) for row in db.scalars(select(Major).options(joinedload(Major.faculty)).order_by(Major.code)).all()]


@router.get("/faculties")
def list_faculties(db: Session = Depends(get_db)):
    return [{"id": row.id, "name": row.name} for row in db.scalars(select(Faculty).order_by(Faculty.name)).all()]


@router.get("/admissions/scores")
def list_admission_scores(
    year: int | None = None,
    method: str | None = None,
    db: Session = Depends(get_db)
):
    """Điểm chuẩn trúng tuyển các năm phục vụ tra cứu thông tin thí sinh (TS2)."""
    query = select(AdmissionScore)
    if year:
        query = query.where(AdmissionScore.year == year)
    if method:
        query = query.where(AdmissionScore.method.ilike(f"%{method}%"))
    rows = db.scalars(query.order_by(AdmissionScore.year.desc(), AdmissionScore.score.desc())).all()
    return [
        {
            "id": r.id,
            "program_code": r.program_code,
            "program_name": r.program_name,
            "year": r.year,
            "method": r.method,
            "score": r.score,
            "scale": r.scale,
            "note": r.note,
        }
        for r in rows
    ]


# ==========================================
# 2. CÔNG CỤ TÍNH ĐIỂM XÉT TUYỂN (TS3)
# ==========================================

@router.post("/admissions/calculate-score", response_model=ScoreCalculationResponse)
def calculate_admission_score(
    payload: ScoreCalculationRequest,
    db: Session = Depends(get_db),
):
    """Tính điểm xét tuyển quy đổi theo từng phương thức và gợi ý các ngành phù hợp."""
    method = payload.admission_method
    calc_score = 0.0
    scale = 30
    details = ""

    if method == "THPT":
        scale = 30
        calc_score = payload.subject_1 + payload.subject_2 + payload.subject_3 + payload.priority_score
        details = f"Tổng 3 môn thi tốt nghiệp THPT ({payload.subject_1:.2f} + {payload.subject_2:.2f} + {payload.subject_3:.2f}) + Điểm ưu tiên ({payload.priority_score:.2f}) = {calc_score:.2f} / 30"
    elif method == "KetHopIELTS":
        scale = 30
        ielts_conv = 10.0 if payload.ielts_score >= 8.0 else (9.5 if payload.ielts_score >= 7.5 else (9.0 if payload.ielts_score >= 7.0 else (8.0 if payload.ielts_score >= 6.5 else (7.0 if payload.ielts_score >= 5.5 else 0.0))))
        calc_score = ielts_conv + payload.subject_1 + payload.subject_2 + payload.priority_score
        details = f"IELTS {payload.ielts_score} quy đổi ({ielts_conv:.1f}) + 2 môn THPT ({payload.subject_1:.2f} + {payload.subject_2:.2f}) + Ưu tiên ({payload.priority_score:.2f}) = {calc_score:.2f} / 30"
    elif method == "HSA":
        scale = 150
        calc_score = payload.aptitude_score + (payload.priority_score * 5.0)
        details = f"Điểm ĐGNL ĐHQGHN ({payload.aptitude_score:.1f}) + Điểm ưu tiên quy đổi thang 150 ({payload.priority_score * 5.0:.1f}) = {calc_score:.1f} / 150"
    elif method == "TSA":
        scale = 100
        calc_score = payload.aptitude_score + (payload.priority_score * 3.33)
        details = f"Điểm ĐGTD ĐHBK Hà Nội ({payload.aptitude_score:.1f}) + Điểm ưu tiên quy đổi thang 100 = {calc_score:.1f} / 100"
    else:
        scale = 30
        calc_score = payload.subject_1 + payload.subject_2 + payload.subject_3 + payload.priority_score
        details = f"Điểm học bạ / tổng hợp = {calc_score:.2f} / 30"

    # Lấy các ngành gợi ý có điểm chuẩn năm gần nhất <= calc_score
    scores = db.scalars(select(AdmissionScore).where(AdmissionScore.scale == scale).order_by(AdmissionScore.score.asc())).all()
    eligible: list[dict] = []
    seen = set()
    for s in scores:
        if s.program_code not in seen and s.score <= calc_score:
            seen.add(s.program_code)
            eligible.append({
                "code": s.program_code,
                "name": s.program_name,
                "cutoff_score": s.score,
                "margin": round(calc_score - s.score, 2),
            })

    return ScoreCalculationResponse(
        calculated_score=round(calc_score, 2),
        scale=scale,
        details=details,
        eligible_majors=eligible[:8],
    )


# ==========================================
# 3. NỘP HỒ SƠ & TRA CỨU TRỰC TUYẾN (TS4, TS5, TS6)
# ==========================================

@router.post("/admissions/applications", response_model=ApplicantPublic, status_code=201)
def create_application(data: ApplicantCreate, db: Session = Depends(get_db)):
    """Thí sinh nộp hồ sơ xét tuyển trực tuyến (không cần đăng nhập)."""
    major = db.get(Major, data.desired_major_id)
    if not major or major.admission_status != "Đang tuyển sinh":
        raise HTTPException(status_code=400, detail="Ngành đăng ký nguyện vọng 1 không mở nhận hồ sơ.")

    # Kiểm tra số CCCD hợp lệ nếu có nhập
    cccd = data.identity_card.strip()
    if cccd and not (cccd.isdigit() and len(cccd) in (9, 12)):
        raise HTTPException(status_code=422, detail="Số CCCD phải gồm đúng 12 chữ số (hoặc CMND 9 số).")

    # Sinh mã hồ sơ duy nhất ngẫu nhiên dạng TS2026-XXXXX
    rand_code = f"TS2026-{random.randint(10000, 99999)}"
    while db.scalar(select(Applicant.id).where(Applicant.application_code == rand_code)):
        rand_code = f"TS2026-{random.randint(10000, 99999)}"

    applicant = Applicant(
        application_code=rand_code,
        identity_card=cccd,
        full_name=data.full_name.strip(),
        email=data.email.lower().strip(),
        phone=data.phone.strip(),
        date_of_birth=data.date_of_birth,
        address=data.address.strip(),
        desired_major_id=data.desired_major_id,
        desired_major_2_id=data.desired_major_2_id or None,
        desired_major_3_id=data.desired_major_3_id or None,
        admission_method=data.admission_method,
        priority_score=data.priority_score,
        total_score=data.total_score,
        attachments=data.attachments,
        status="Mới tiếp nhận",
        status_note="Hồ sơ đã được gửi thành công, đang chờ ban tuyển sinh tiếp nhận.",
    )
    db.add(applicant)
    db.flush()

    db.add(StatusHistory(
        entity_type="applicant",
        entity_id=applicant.id,
        old_status="",
        new_status="Mới tiếp nhận",
        changed_by=applicant.full_name,
        reason="Thí sinh nộp hồ sơ trực tuyến."
    ))

    db.commit()
    db.refresh(applicant)
    row = db.scalar(_applicant_query().where(Applicant.id == applicant.id))
    return applicant_public(row)


@router.get("/admissions/lookup", response_model=ApplicantPublic)
def lookup_application(
    code: str | None = None,
    identity_card: str | None = None,
    email: str | None = None,
    db: Session = Depends(get_db),
):
    """Thí sinh tra cứu kết quả hồ sơ theo Mã hồ sơ, CCCD hoặc Email (TS5)."""
    if not (code or identity_card or email):
        raise HTTPException(status_code=400, detail="Vui lòng nhập Mã hồ sơ hoặc Số CCCD để tra cứu.")

    query = _applicant_query()
    if code and code.strip():
        query = query.where(Applicant.application_code.ilike(code.strip()))
    elif identity_card and identity_card.strip():
        query = query.where(Applicant.identity_card == identity_card.strip())
    elif email and email.strip():
        query = query.where(Applicant.email == email.strip().lower())

    row = db.scalar(query)
    if not row:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ tuyển sinh với thông tin tra cứu đã cung cấp.")
    return applicant_public(row)


@router.post("/admissions/applications/{code}/documents", response_model=ApplicantPublic)
def upload_missing_documents(
    code: str,
    payload: ApplicantDocumentUpload,
    db: Session = Depends(get_db),
):
    """Bổ sung giấy tờ cho hồ sơ tuyển sinh khi nhận được yêu cầu bổ sung (TS6)."""
    applicant = db.scalar(_applicant_query().where(Applicant.application_code.ilike(code.strip())))
    if not applicant:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ theo mã này.")

    existing_files = applicant.attachments or []
    applicant.attachments = existing_files + payload.attachments
    if applicant.status == "Cần bổ sung":
        old_status = applicant.status
        applicant.status = "Đang xét duyệt"
        applicant.status_note = "Thí sinh đã cập nhật bổ sung giấy tờ, ban tuyển sinh đang xét duyệt lại."
        db.add(StatusHistory(
            entity_type="applicant",
            entity_id=applicant.id,
            old_status=old_status,
            new_status="Đang xét duyệt",
            changed_by="Thí sinh",
            reason="Thí sinh đã nộp bổ sung giấy tờ minh chứng."
        ))

    db.commit()
    db.refresh(applicant)
    return applicant_public(applicant)


# ==========================================
# 4. DUYỆT HỒ SƠ TUYỂN SINH CỦA ADMIN (AD_TS)
# ==========================================

@router.get("/admissions/applications", response_model=list[ApplicantPublic])
def list_applications(
    status: str | None = None,
    q: str | None = None,
    _user: User = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    query = _applicant_query().order_by(Applicant.created_at.desc())
    if status:
        query = query.where(Applicant.status == status)
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        query = query.where(
            or_(
                Applicant.application_code.ilike(pattern),
                Applicant.full_name.ilike(pattern),
                Applicant.email.ilike(pattern),
                Applicant.identity_card.ilike(pattern),
            )
        )
    rows = db.scalars(query).all()
    return [applicant_public(row) for row in rows]


@router.patch("/admissions/applications/{applicant_id}/status", response_model=ApplicantPublic)
def update_application_status(
    applicant_id: str,
    data: ApplicantStatusUpdate,
    user: User = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    valid_statuses = {"Mới tiếp nhận", "Đang xét duyệt", "Cần bổ sung", "Trúng tuyển", "Không trúng tuyển"}
    if data.status not in valid_statuses:
        raise HTTPException(status_code=422, detail="Trạng thái hồ sơ không hợp lệ.")

    applicant = db.scalar(_applicant_query().where(Applicant.id == applicant_id))
    if not applicant:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ.")

    if data.status in {"Cần bổ sung", "Không trúng tuyển"} and not data.status_note.strip():
        raise HTTPException(status_code=422, detail="Bắt buộc nhập lý do hoặc yêu cầu chi tiết khi chuyển sang trạng thái này.")

    old_status = applicant.status
    applicant.status = data.status
    applicant.status_note = data.status_note.strip() or f"Cập nhật trạng thái thành {data.status}."

    db.add(StatusHistory(
        entity_type="applicant",
        entity_id=applicant.id,
        old_status=old_status,
        new_status=data.status,
        changed_by=user.full_name,
        reason=applicant.status_note
    ))

    db.commit()
    db.refresh(applicant)
    return applicant_public(applicant)


@router.post("/admissions/applications/{applicant_id}/promote", response_model=StudentPublic)
def promote_applicant(
    applicant_id: str,
    user: User = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    """
    Admin duyệt chuyển hồ sơ trúng tuyển thành sinh viên chính thức:
    - Cấp mã số sinh viên STU2026xxxx
    - Tự động tạo tài khoản đăng nhập (role SINH_VIEN) nếu chưa có
    - Tự động kích hoạt 11 bước thủ tục nhập học
    - Đổi trạng thái tuyển sinh sang 'Đã nhập học'
    """
    applicant = db.scalar(_applicant_query().where(Applicant.id == applicant_id))
    if not applicant:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ.")
    if applicant.status != "Trúng tuyển":
        raise HTTPException(status_code=409, detail="Chỉ có thể chuyển hồ sơ đã trúng tuyển thành sinh viên.")

    if applicant.student_id:
        return student_public(db.scalar(select(Student).where(Student.id == applicant.student_id).options(joinedload(Student.major))))

    count = db.scalar(select(func.count(Student.id))) or 0
    student_number = f"STU{2026}{count + 1:04d}"

    # Kiểm tra hoặc tạo User account cho tân sinh viên
    existing_user = db.scalar(select(User).where(User.email == applicant.email.lower()))
    if not existing_user:
        existing_user = User(
            email=applicant.email.lower(),
            full_name=applicant.full_name,
            password_hash=hash_password("StudyDemo2026!"),
            role="SINH_VIEN",
        )
        db.add(existing_user)
        db.flush()

    student = Student(
        applicant_id=applicant.id,
        user_id=existing_user.id,
        student_number=student_number,
        full_name=applicant.full_name,
        email=applicant.email,
        phone=applicant.phone,
        date_of_birth=applicant.date_of_birth,
        address=applicant.address,
        major_id=applicant.desired_major_id,
        cohort="2026",
        class_name=f"{applicant.major.code[-3:]}-K26A" if applicant.major else "K26A",
        study_status="Đang học",
        enrollment_date=date.today(),
        is_demo=False,
    )
    db.add(student)
    db.flush()

    # Tự động khởi tạo 11 bước thủ tục nhập học
    for step_num, step_title, step_desc in CHECKLIST_STEPS:
        db.add(AdmissionChecklistProgress(
            student_id=student.id,
            step_number=step_num,
            step_title=step_title,
            step_description=step_desc,
            status="DA_HOAN_THANH" if step_num == 1 else "CHUA_HOAN_THANH",
            completed_at=datetime.now(timezone.utc) if step_num == 1 else None,
            notes="Tự động hoàn thành bước xác nhận khi tạo hồ sơ sinh viên." if step_num == 1 else ""
        ))

    applicant.student_id = student.id
    old_status = applicant.status
    applicant.status = "Đã nhập học"
    applicant.status_note = f"Đã nhập học thành công. Mã sinh viên chính thức: {student_number}."

    db.add(StatusHistory(
        entity_type="applicant",
        entity_id=applicant.id,
        old_status=old_status,
        new_status="Đã nhập học",
        changed_by=user.full_name,
        reason=f"Chuyển hồ sơ trúng tuyển thành sinh viên {student_number}."
    ))

    db.commit()
    db.refresh(student)
    return student_public(db.scalar(select(Student).where(Student.id == student.id).options(joinedload(Student.major))))


# ==========================================
# 5. HỒ SƠ SINH VIÊN (SV1, SV8)
# ==========================================

@router.get("/profiles/students", response_model=list[StudentPublic])
def list_students(user: User = Depends(current_user), db: Session = Depends(get_db)):
    query = select(Student).options(joinedload(Student.major)).order_by(Student.student_number)
    if user.role in {"student", "SINH_VIEN", "sinh_vien"}:
        query = query.where(Student.user_id == user.id)
    elif user.role not in ADMIN_ROLES and user.role not in {"GIANG_VIEN", "giang_vien"}:
        raise HTTPException(status_code=403, detail="Bạn không có quyền xem hồ sơ sinh viên.")
    return [student_public(row) for row in db.scalars(query).all()]


@router.get("/profiles/me", response_model=StudentPublic)
def my_student_profile(user: User = Depends(current_user), db: Session = Depends(get_db)):
    student = db.scalar(select(Student).where(Student.user_id == user.id).options(joinedload(Student.major)))
    if not student:
        student = db.scalar(select(Student).where(Student.email == user.email.lower()).options(joinedload(Student.major)))
        if student and not student.user_id:
            student.user_id = user.id
            db.commit()
    if not student:
        raise HTTPException(status_code=404, detail="Tài khoản chưa được liên kết với hồ sơ sinh viên.")
    return student_public(student)


@router.patch("/profiles/me", response_model=StudentPublic)
def update_my_student_profile(data: StudentProfileUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    student = db.scalar(select(Student).where(Student.user_id == user.id).options(joinedload(Student.major)))
    if not student:
        raise HTTPException(status_code=404, detail="Tài khoản chưa được liên kết với hồ sơ sinh viên.")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(student, field, value)
    db.commit()
    return student_public(db.scalar(select(Student).where(Student.id == student.id).options(joinedload(Student.major))))


@router.patch("/profiles/students/{student_id}", response_model=StudentPublic)
def update_student_profile(student_id: str, data: StudentProfileUpdate,
                           _user: User = Depends(require_roles(*ADMIN_ROLES)), db: Session = Depends(get_db)):
    student = db.scalar(select(Student).where(Student.id == student_id).options(joinedload(Student.major)))
    if not student:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ sinh viên.")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(student, field, value)
    db.commit()
    return student_public(db.scalar(select(Student).where(Student.id == student.id).options(joinedload(Student.major))))


# ==========================================
# 6. QUẢN TRỊ TÀI KHOẢN & DANH MỤC (AD1 - AD2)
# ==========================================

@router.get("/admin/users", response_model=list[UserPublic])
def list_users_admin(
    role: str | None = None,
    q: str | None = None,
    _user: User = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    query = select(User).order_by(User.created_at.desc())
    if role:
        query = query.where(User.role == role)
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        query = query.where(or_(User.full_name.ilike(pattern), User.email.ilike(pattern)))
    return db.scalars(query).all()


@router.post("/admin/users", response_model=UserPublic, status_code=201)
def create_user_admin(
    payload: UserAdminCreate,
    _admin: User = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    if db.scalar(select(User.id).where(User.email == payload.email.lower())):
        raise HTTPException(status_code=409, detail="Email này đã được sử dụng trong hệ thống.")

    user = User(
        email=payload.email.lower().strip(),
        full_name=payload.full_name.strip(),
        password_hash=hash_password(payload.password),
        role=payload.role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/admin/users/{user_id}", response_model=UserPublic)
def update_user_admin(
    user_id: str,
    payload: UserAdminUpdate,
    _admin: User = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản người dùng.")

    updates = payload.model_dump(exclude_unset=True)
    if "password" in updates and updates["password"]:
        target.password_hash = hash_password(updates.pop("password"))
    for field, val in updates.items():
        if val is not None:
            setattr(target, field, val)

    db.commit()
    db.refresh(target)
    return target


@router.post("/admin/faculties", status_code=201)
def create_faculty_admin(
    payload: FacultyAdminCreate,
    _admin: User = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    if db.scalar(select(Faculty.id).where(Faculty.name == payload.name.strip())):
        raise HTTPException(status_code=409, detail="Tên khoa đã tồn tại.")
    f = Faculty(name=payload.name.strip())
    db.add(f)
    db.commit()
    db.refresh(f)
    return {"id": f.id, "name": f.name}


@router.post("/admin/majors", response_model=MajorPublic, status_code=201)
def create_major_admin(
    payload: MajorAdminCreate,
    _admin: User = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    if db.scalar(select(Major.id).where(Major.code == payload.code.strip())):
        raise HTTPException(status_code=409, detail="Mã ngành đào tạo đã tồn tại.")
    if not db.get(Faculty, payload.faculty_id):
        raise HTTPException(status_code=422, detail="Không tìm thấy khoa trực thuộc.")

    m = Major(
        code=payload.code.strip(),
        name=payload.name.strip(),
        description=payload.description.strip(),
        faculty_id=payload.faculty_id,
        duration_years=payload.duration_years,
        tuition_per_year_vnd=payload.tuition_per_year_vnd,
        admission_quota=payload.admission_quota,
        admission_status=payload.admission_status,
        is_demo=False,
    )
    db.add(m)
    db.commit()
    m = db.scalar(select(Major).options(joinedload(Major.faculty)).where(Major.id == m.id))
    return major_public(m)
