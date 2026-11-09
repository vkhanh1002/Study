from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: EmailStr
    full_name: str
    role: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserPublic


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class MajorPublic(BaseModel):
    id: str
    code: str
    name: str
    description: str
    faculty_name: str
    duration_years: int
    tuition_per_year_vnd: int
    admission_quota: int
    admission_status: str
    is_demo: bool


class ApplicantCreate(BaseModel):
    identity_card: str = Field(default="", description="CCCD 12 số")
    full_name: str = Field(min_length=2, max_length=180)
    email: EmailStr
    phone: str = Field(default="", min_length=8, max_length=20)
    date_of_birth: date | None = None
    address: str = ""
    desired_major_id: str
    desired_major_2_id: str | None = None
    desired_major_3_id: str | None = None
    admission_method: str = "Học bạ (demo)"
    priority_score: float = 0.0
    total_score: float = 0.0
    attachments: list[dict] = Field(default_factory=list)


class ApplicantStatusUpdate(BaseModel):
    status: str
    status_note: str = ""


class ApplicantPublic(BaseModel):
    id: str
    application_code: str = ""
    identity_card: str = ""
    email: str
    full_name: str
    phone: str
    date_of_birth: date | None = None
    address: str = ""
    desired_major_id: str
    major_name: str
    desired_major_2_id: str | None = None
    major_2_name: str | None = None
    desired_major_3_id: str | None = None
    major_3_name: str | None = None
    admission_method: str
    priority_score: float = 0.0
    total_score: float = 0.0
    attachments: list[dict] = Field(default_factory=list)
    status: str
    status_note: str = ""
    created_at: datetime
    student_id: str | None


class StudentPublic(BaseModel):
    id: str
    student_number: str
    full_name: str
    email: str
    phone: str
    date_of_birth: date | None
    gender: str
    address: str
    emergency_contact: dict
    major_id: str
    major_name: str
    cohort: str
    class_name: str
    study_status: str
    enrollment_date: date | None
    is_demo: bool


class StudentProfileUpdate(BaseModel):
    phone: str | None = Field(default=None, max_length=40)
    address: str | None = Field(default=None, max_length=500)
    gender: str | None = Field(default=None, max_length=30)
    emergency_contact: dict | None = None


class PersonnelCreate(BaseModel):
    code: str = Field(min_length=2, max_length=30)
    kind: Literal["lecturer", "employee"]
    full_name: str = Field(min_length=2, max_length=180)
    email: EmailStr
    phone: str = ""
    date_of_birth: date | None = None
    gender: str = "Chưa cập nhật"
    address: str = ""
    avatar_url: str = ""
    education_level: str = ""
    academic_rank: str = ""
    specialty: str = ""
    faculty_id: str | None = None
    department: str = ""
    position: str = ""
    start_date: date | None = None
    work_status: str = "Đang công tác"
    notes: str = ""


class PersonnelUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=180)
    email: EmailStr | None = None
    phone: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    address: str | None = None
    avatar_url: str | None = None
    education_level: str | None = None
    academic_rank: str | None = None
    specialty: str | None = None
    faculty_id: str | None = None
    department: str | None = None
    position: str | None = None
    start_date: date | None = None
    work_status: str | None = None
    notes: str | None = None


class PersonnelPublic(BaseModel):
    id: str
    user_id: str | None = None
    code: str
    kind: str
    full_name: str
    email: str
    phone: str
    date_of_birth: date | None
    gender: str
    address: str
    avatar_url: str
    education_level: str
    academic_rank: str
    specialty: str
    faculty_id: str | None
    faculty_name: str | None
    department: str
    position: str
    start_date: date | None
    work_status: str
    profile_status: str = "DA_DUYET"
    rejection_reason: str = ""
    pending_updates: dict = Field(default_factory=dict)
    notes: str
    is_demo: bool


class TicketCreate(BaseModel):
    category: str
    subject: str = Field(min_length=4, max_length=200)
    description: str = Field(min_length=8, max_length=10000)
    priority: str = "Bình thường"


class TicketStatusUpdate(BaseModel):
    status: str


class TicketAssign(BaseModel):
    assignee_id: str | None


class TicketRating(BaseModel):
    rating: int = Field(ge=1, le=5)
    feedback: str = Field(default="", max_length=1000)


class TicketReply(BaseModel):
    body: str = Field(min_length=1, max_length=10000)


class TicketMessagePublic(BaseModel):
    id: str
    author_id: str
    body: str
    created_at: datetime


class TicketAttachmentPublic(BaseModel):
    id: str
    filename: str
    media_type: str
    size_bytes: int
    uploaded_at: datetime


class TicketPublic(BaseModel):
    id: str
    code: str
    owner_id: str
    owner_name: str
    category: str
    subject: str
    description: str
    priority: str
    status: str
    assignee_id: str | None
    satisfaction_rating: int | None
    satisfaction_feedback: str | None
    created_at: datetime
    messages: list[TicketMessagePublic]
    attachments: list[TicketAttachmentPublic] = []


class ConversationCreate(BaseModel):
    title: str = "Cuộc trò chuyện mới"


class ConversationRename(BaseModel):
    title: str = Field(min_length=1, max_length=180)


class ChatAsk(BaseModel):
    message: str | None = None
    content: str | None = None
    prompt: str | None = None
    question: str | None = None

    def get_text(self) -> str:
        return (self.message or self.content or self.prompt or self.question or "").strip()


class SourcePublic(BaseModel):
    title: str
    excerpt: str
    source_type: str


class ChatMessagePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    role: str
    content: str
    sources: list[dict]
    created_at: datetime


class ConversationPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    updated_at: datetime
    messages: list[ChatMessagePublic] = []


class FAQPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    question: str
    answer: str
    category: str


class FAQCreate(BaseModel):
    question: str = Field(min_length=6, max_length=500)
    answer: str = Field(min_length=8)
    category: str = "Chung"


class FAQAdminPublic(FAQPublic):
    is_published: bool


class AIStatusPublic(BaseModel):
    provider: str
    model: str
    configured: bool
    fallback_provider: str | None
    fallback_configured: bool
    connection_status: str
    llm_configured: bool
    llm_model: str
    embedding_model: str | None
    embedding_provider: str
    retrieval_mode: str


class NotificationPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    message: str
    href: str
    read_at: datetime | None
    created_at: datetime


class DocumentPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    filename: str
    media_type: str
    status: str
    error: str | None
    created_at: datetime


class DashboardPublic(BaseModel):
    students: int
    applications: int
    majors: int
    pending_tickets: int
    admissions_by_month: list[dict]
    students_by_major: list[dict]
    recent_activity: list[dict]
    demo_data: bool = True


class StudyTaskCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    course_name: str = Field(min_length=2, max_length=150)
    task_type: str = "assignment"  # assignment, exam, quiz, project
    due_date: datetime
    priority: str = "medium"  # high, medium, low
    notes: str = ""


class StudyTaskUpdate(BaseModel):
    title: str | None = None
    course_name: str | None = None
    task_type: str | None = None
    due_date: datetime | None = None
    priority: str | None = None
    status: str | None = None
    notes: str | None = None


class StudyTaskPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: str
    title: str
    course_name: str
    task_type: str
    due_date: datetime
    priority: str
    status: str
    notes: str
    created_at: datetime
    updated_at: datetime


class StudySummary(BaseModel):
    total_tasks: int
    pending_tasks: int
    upcoming_deadlines: int
    upcoming_exams: int
    tasks: list[StudyTaskPublic]


# ==========================================
# CÁC SCHEMA MỚI CHO MODULE NHÂN SỰ
# ==========================================

class PersonnelProfileSelfUpdate(BaseModel):
    phone: str | None = None
    address: str | None = None
    avatar_url: str | None = None
    education_level: str | None = None
    academic_rank: str | None = None
    specialty: str | None = None
    notes: str | None = None


class PersonnelReviewUpdate(BaseModel):
    action: Literal["APPROVE", "REJECT"]
    rejection_reason: str = ""


class PersonnelDegreeCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    degree_type: str = "Bằng đại học"
    issuing_institution: str = Field(min_length=2, max_length=200)
    issue_year: int = Field(ge=1950, le=2100)
    file_url: str = ""


class PersonnelDegreePublic(BaseModel):
    id: str
    personnel_id: str
    title: str
    degree_type: str
    issuing_institution: str
    issue_year: int
    file_url: str
    status: str
    rejection_reason: str
    created_at: datetime


class DegreeReviewUpdate(BaseModel):
    action: Literal["APPROVE", "REJECT"]
    rejection_reason: str = ""


class PersonnelContractCreate(BaseModel):
    personnel_id: str
    contract_number: str
    contract_type: str
    start_date: date
    end_date: date | None = None
    status: str = "Hiệu lực"
    salary_rate: str = ""
    notes: str = ""
    file_url: str = ""


class PersonnelContractPublic(BaseModel):
    id: str
    personnel_id: str
    personnel_name: str | None = None
    personnel_code: str | None = None
    contract_number: str
    contract_type: str
    start_date: date
    end_date: date | None
    status: str
    salary_rate: str
    file_url: str
    notes: str
    is_expiring_soon: bool = False
    days_left: int | None = None
    created_at: datetime


# ==========================================
# CÁC SCHEMA MỚI CHO MODULE TUYỂN SINH
# ==========================================

class ScoreCalculationRequest(BaseModel):
    admission_method: str  # "THPT", "KetHopIELTS", "HSA", "TSA"
    subject_1: float = 0.0
    subject_2: float = 0.0
    subject_3: float = 0.0
    ielts_score: float = 0.0
    aptitude_score: float = 0.0
    priority_score: float = 0.0


class ScoreCalculationResponse(BaseModel):
    calculated_score: float
    scale: int  # 30, 100, 150
    details: str
    eligible_majors: list[dict]


class ApplicantDocumentUpload(BaseModel):
    attachments: list[dict]


# ==========================================
# CÁC SCHEMA MỚI CHO MODULE HỖ TRỢ NGƯỜI HỌC
# ==========================================

class ChecklistStepUpdate(BaseModel):
    status: str  # CHUA_HOAN_THANH, CHO_XAC_NHAN, DA_HOAN_THANH
    notes: str = ""


class ChecklistStepPublic(BaseModel):
    id: str
    student_id: str
    step_number: int
    step_title: str
    step_description: str
    status: str
    completed_at: datetime | None
    notes: str


class StudentRequestCreate(BaseModel):
    request_type: str
    title: str = Field(min_length=3, max_length=200)
    reason: str = Field(min_length=5, max_length=5000)
    attachments: list[dict] = Field(default_factory=list)


class StudentRequestPublic(BaseModel):
    id: str
    code: str
    student_id: str
    student_number: str | None = None
    student_name: str | None = None
    request_type: str
    title: str
    reason: str
    attachments: list[dict]
    status: str
    rejection_reason: str
    assigned_lecturer_id: str | None
    assigned_lecturer_name: str | None = None
    rating: int | None
    feedback: str | None
    created_at: datetime
    updated_at: datetime


class StudentRequestStatusUpdate(BaseModel):
    status: str
    rejection_reason: str = ""
    assigned_lecturer_id: str | None = None


class StudentRequestRating(BaseModel):
    rating: int = Field(ge=1, le=5)
    feedback: str = ""


class AcademicSchedulePublic(BaseModel):
    id: str
    cohort: str
    course_code: str
    course_name: str
    lecturer_name: str
    schedule_type: str
    day_of_week: int
    start_time: str
    end_time: str
    schedule_date: date | None
    room: str
    exam_format: str
    notes: str


class AnnouncementPublic(BaseModel):
    id: str
    title: str
    content: str
    category: str
    target_role: str
    is_pinned: bool
    created_at: datetime


# ==========================================
# CÁC SCHEMA MỚI CHO MODULE QUẢN TRỊ (ADMIN)
# ==========================================

class UserAdminCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=180)
    password: str = Field(min_length=6, max_length=100)
    role: Literal["ADMIN", "GIANG_VIEN", "SINH_VIEN"]


class UserAdminUpdate(BaseModel):
    full_name: str | None = None
    role: str | None = None
    is_active: bool | None = None
    password: str | None = None


class MajorAdminCreate(BaseModel):
    code: str = Field(min_length=2, max_length=20)
    name: str = Field(min_length=2, max_length=180)
    description: str = ""
    faculty_id: str
    duration_years: int = 4
    tuition_per_year_vnd: int = 0
    admission_quota: int = 0
    admission_status: str = "Đang tuyển sinh"


class FacultyAdminCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)


