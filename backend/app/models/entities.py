from datetime import date, datetime, timezone
from uuid import uuid4

from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Index, Integer, JSON, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, deferred, mapped_column, relationship

from app.core.database import Base


def new_id() -> str:
    return str(uuid4())


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)


class Faculty(TimestampMixin, Base):
    __tablename__ = "faculties"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(160), unique=True, nullable=False)
    majors: Mapped[list["Major"]] = relationship(back_populates="faculty")


class Major(TimestampMixin, Base):
    __tablename__ = "majors"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(180), index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    faculty_id: Mapped[str] = mapped_column(ForeignKey("faculties.id"), index=True, nullable=False)
    duration_years: Mapped[int] = mapped_column(Integer, default=4, nullable=False)
    tuition_per_year_vnd: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    admission_quota: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    admission_status: Mapped[str] = mapped_column(String(30), default="Đang tuyển sinh", nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    faculty: Mapped[Faculty] = relationship(back_populates="majors")


class User(TimestampMixin, Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(180), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(40), default="student", index=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Notification(TimestampMixin, Base):
    __tablename__ = "notifications"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    message: Mapped[str] = mapped_column(String(500), nullable=False)
    href: Mapped[str] = mapped_column(String(300), default="/support", nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Applicant(TimestampMixin, Base):
    __tablename__ = "applicants"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    application_code: Mapped[str] = mapped_column(String(30), default="", index=True, nullable=False)
    identity_card: Mapped[str] = mapped_column(String(20), default="", index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(180), nullable=False)
    phone: Mapped[str] = mapped_column(String(40), default="", nullable=False)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    address: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    desired_major_id: Mapped[str] = mapped_column(ForeignKey("majors.id"), index=True, nullable=False)
    desired_major_2_id: Mapped[str | None] = mapped_column(ForeignKey("majors.id"), nullable=True)
    desired_major_3_id: Mapped[str | None] = mapped_column(ForeignKey("majors.id"), nullable=True)
    admission_method: Mapped[str] = mapped_column(String(100), default="Học bạ (demo)", nullable=False)
    priority_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    attachments: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="Mới tiếp nhận", index=True, nullable=False)
    status_note: Mapped[str] = mapped_column(Text, default="", nullable=False)
    student_id: Mapped[str | None] = mapped_column(ForeignKey("students.id"), nullable=True, unique=True)
    major: Mapped[Major] = relationship(foreign_keys=[desired_major_id])
    major_2: Mapped[Major | None] = relationship(foreign_keys=[desired_major_2_id])
    major_3: Mapped[Major | None] = relationship(foreign_keys=[desired_major_3_id])


class Student(TimestampMixin, Base):
    __tablename__ = "students"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, unique=True)
    applicant_id: Mapped[str | None] = mapped_column(ForeignKey("applicants.id"), nullable=True, unique=True)
    student_number: Mapped[str] = mapped_column(String(30), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(180), nullable=False)
    email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    phone: Mapped[str] = mapped_column(String(40), default="", nullable=False)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str] = mapped_column(String(30), default="Chưa cập nhật", nullable=False)
    address: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    major_id: Mapped[str] = mapped_column(ForeignKey("majors.id"), index=True, nullable=False)
    cohort: Mapped[str] = mapped_column(String(30), default="2026", nullable=False)
    class_name: Mapped[str] = mapped_column(String(60), default="", nullable=False)
    study_status: Mapped[str] = mapped_column(String(40), default="Đang học", index=True, nullable=False)
    enrollment_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    emergency_contact: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    user: Mapped[User | None] = relationship()
    major: Mapped[Major] = relationship()


class Personnel(TimestampMixin, Base):
    """Shared employee record for academic staff and university employees."""
    __tablename__ = "personnel"
    __table_args__ = (
        Index("ix_personnel_type_status", "kind", "work_status"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, unique=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True, nullable=False)
    kind: Mapped[str] = mapped_column(String(30), index=True, nullable=False)  # lecturer | employee
    full_name: Mapped[str] = mapped_column(String(180), index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    phone: Mapped[str] = mapped_column(String(40), default="", nullable=False)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str] = mapped_column(String(30), default="Chưa cập nhật", nullable=False)
    address: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    avatar_url: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    education_level: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    academic_rank: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    specialty: Mapped[str] = mapped_column(String(240), default="", nullable=False)
    faculty_id: Mapped[str | None] = mapped_column(ForeignKey("faculties.id"), index=True, nullable=True)
    department: Mapped[str] = mapped_column(String(180), default="", index=True, nullable=False)
    position: Mapped[str] = mapped_column(String(160), default="", nullable=False)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    work_status: Mapped[str] = mapped_column(String(40), default="Đang công tác", index=True, nullable=False)
    profile_status: Mapped[str] = mapped_column(String(30), default="DA_DUYET", index=True, nullable=False)
    rejection_reason: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    pending_updates: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    faculty: Mapped[Faculty | None] = relationship()
    user: Mapped[User | None] = relationship()


class SupportTicket(TimestampMixin, Base):
    __tablename__ = "support_tickets"
    __table_args__ = (Index("ix_tickets_owner_status", "owner_id", "status"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    code: Mapped[str] = mapped_column(String(24), unique=True, index=True, nullable=False)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column(String(30), default="Bình thường", nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="Mới tiếp nhận", index=True, nullable=False)
    assignee_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    satisfaction_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    satisfaction_feedback: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    owner: Mapped[User] = relationship(foreign_keys=[owner_id])
    messages: Mapped[list["TicketMessage"]] = relationship(back_populates="ticket", cascade="all, delete-orphan", order_by="TicketMessage.created_at")
    attachments: Mapped[list["TicketAttachment"]] = relationship(cascade="all, delete-orphan", order_by="TicketAttachment.created_at")


class TicketMessage(TimestampMixin, Base):
    __tablename__ = "ticket_messages"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    ticket_id: Mapped[str] = mapped_column(ForeignKey("support_tickets.id", ondelete="CASCADE"), index=True, nullable=False)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    ticket: Mapped[SupportTicket] = relationship(back_populates="messages")
    author: Mapped[User] = relationship()


class TicketAttachment(TimestampMixin, Base):
    __tablename__ = "ticket_attachments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    ticket_id: Mapped[str] = mapped_column(ForeignKey("support_tickets.id", ondelete="CASCADE"), index=True, nullable=False)
    uploaded_by: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    media_type: Mapped[str] = mapped_column(String(120), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[bytes] = deferred(mapped_column(LargeBinary, nullable=False))


class ChatConversation(TimestampMixin, Base):
    __tablename__ = "chat_conversations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(180), default="Cuộc trò chuyện mới", nullable=False)
    messages: Mapped[list["ChatMessage"]] = relationship(back_populates="conversation", cascade="all, delete-orphan", order_by="ChatMessage.created_at")


class ChatMessage(TimestampMixin, Base):
    __tablename__ = "chat_messages"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("chat_conversations.id", ondelete="CASCADE"), index=True, nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    sources: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    conversation: Mapped[ChatConversation] = relationship(back_populates="messages")


class KnowledgeDocument(TimestampMixin, Base):
    __tablename__ = "knowledge_documents"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    title: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    media_type: Mapped[str] = mapped_column(String(120), nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), default="document", nullable=False)  # document, url, regulation, admission
    source_url: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    audience: Mapped[str] = mapped_column(String(50), default="chung", index=True, nullable=False)  # tuyen_sinh, sinh_vien, giang_vien, chung
    category: Mapped[str] = mapped_column(String(80), default="tuyển sinh", index=True, nullable=False)
    department_id: Mapped[str | None] = mapped_column(ForeignKey("departments.id"), nullable=True)
    academic_year: Mapped[str] = mapped_column(String(30), default="2025-2026", index=True, nullable=False)
    effective_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    version: Mapped[str] = mapped_column(String(30), default="1.0", nullable=False)
    checksum: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="ready", index=True, nullable=False)  # draft, ready, processing, failed, archived
    uploaded_by: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    chunks: Mapped[list["KnowledgeChunk"]] = relationship(back_populates="document", cascade="all, delete-orphan")
    department: Mapped["Department | None"] = relationship()


class KnowledgeChunk(TimestampMixin, Base):
    __tablename__ = "knowledge_chunks"
    __table_args__ = (
        Index("ix_chunks_document", "document_id"),
        Index("ix_chunks_embedding_cosine", "embedding", postgresql_using="hnsw",
              postgresql_ops={"embedding": "vector_cosine_ops"},
              postgresql_with={"m": 16, "ef_construction": 64}),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    document_id: Mapped[str] = mapped_column(ForeignKey("knowledge_documents.id", ondelete="CASCADE"), nullable=False)
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    heading_path: Mapped[str] = mapped_column(String(300), default="", nullable=False)
    page_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    token_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    chunk_metadata: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(1536).with_variant(JSON(), "sqlite"), nullable=True)
    document: Mapped[KnowledgeDocument] = relationship(back_populates="chunks")


class FAQ(TimestampMixin, Base):
    __tablename__ = "faqs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    question: Mapped[str] = mapped_column(String(500), nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(80), default="Chung", nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class StudyTask(TimestampMixin, Base):
    """Student tasks, assignments, and exam schedules for smart planning."""
    __tablename__ = "study_tasks"
    __table_args__ = (
        Index("ix_study_tasks_user_status", "user_id", "status"),
        Index("ix_study_tasks_due_date", "due_date"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    course_name: Mapped[str] = mapped_column(String(150), nullable=False)
    task_type: Mapped[str] = mapped_column(String(40), default="assignment", nullable=False)  # assignment, exam, quiz, project
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    priority: Mapped[str] = mapped_column(String(20), default="medium", nullable=False)  # high, medium, low
    status: Mapped[str] = mapped_column(String(30), default="pending", nullable=False)  # pending, in_progress, completed
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    user: Mapped[User] = relationship()


class Department(TimestampMixin, Base):
    """University departments and functional offices."""
    __tablename__ = "departments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(180), unique=True, index=True, nullable=False)
    code: Mapped[str] = mapped_column(String(40), default="", nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    email: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    phone: Mapped[str] = mapped_column(String(80), default="", nullable=False)
    location: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    office_hours: Mapped[str] = mapped_column(String(200), default="Thứ 2 - Thứ 6: 08:00 - 17:00", nullable=False)


class AdmissionProgram(TimestampMixin, Base):
    """Structured admission program information."""
    __tablename__ = "admission_programs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    major_code: Mapped[str] = mapped_column(String(30), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), index=True, nullable=False)
    program_type: Mapped[str] = mapped_column(String(50), default="Chuẩn", nullable=False)  # Chuẩn, CLC, POHE, Tiên tiến, IBD
    quota: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    methods: Mapped[list] = mapped_column(JSON, default=list, nullable=False)  # Methods list e.g. ["THPT", "KetHopIELTS", "DGNL_HSA", "TuyenThang"]
    subject_groups: Mapped[str] = mapped_column(String(100), default="A00, A01, D01, D07", nullable=False)
    year: Mapped[int] = mapped_column(Integer, default=2026, index=True, nullable=False)
    note: Mapped[str] = mapped_column(Text, default="", nullable=False)


class AdmissionScore(TimestampMixin, Base):
    """Benchmark admission scores across academic years."""
    __tablename__ = "admission_scores"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    program_code: Mapped[str] = mapped_column(String(30), index=True, nullable=False)
    program_name: Mapped[str] = mapped_column(String(200), nullable=False)
    year: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    method: Mapped[str] = mapped_column(String(100), index=True, nullable=False)  # Điểm thi THPT, ĐGNL ĐHQGHN (HSA), Kết hợp IELTS, ĐGTD BKHN
    score: Mapped[float] = mapped_column(Float, nullable=False)  # Float score e.g. 27.5 or 105.0
    scale: Mapped[int] = mapped_column(Integer, default=30, nullable=False)  # 30 for THPT, 150 for HSA, 100 for TSA
    note: Mapped[str] = mapped_column(String(500), default="", nullable=False)


class TuitionFee(TimestampMixin, Base):
    """Tuition fee schedule by academic program and cohort."""
    __tablename__ = "tuition_fees"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    program_code: Mapped[str] = mapped_column(String(30), index=True, nullable=False)
    program_name: Mapped[str] = mapped_column(String(200), nullable=False)
    cohort: Mapped[str] = mapped_column(String(30), index=True, nullable=False)  # K64, K65, K66, K67 (2025-2026)
    academic_year: Mapped[str] = mapped_column(String(30), default="2025-2026", nullable=False)
    per_credit_vnd: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    per_year_vnd: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    note: Mapped[str] = mapped_column(String(500), default="", nullable=False)


class FaqItem(TimestampMixin, Base):
    """Curated knowledge base FAQ items with audience control."""
    __tablename__ = "faq_items"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    question: Mapped[str] = mapped_column(String(500), nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(80), default="Tuyển sinh", index=True, nullable=False)
    audience: Mapped[str] = mapped_column(String(40), default="chung", index=True, nullable=False)  # chung, tuyen_sinh, sinh_vien
    department_id: Mapped[str | None] = mapped_column(ForeignKey("departments.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="published", index=True, nullable=False)  # draft, published, archived
    department: Mapped[Department | None] = relationship()


class ChatFeedback(TimestampMixin, Base):
    """Feedback on AI responses."""
    __tablename__ = "chat_feedbacks"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    message_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    is_positive: Mapped[bool] = mapped_column(Boolean, nullable=False)
    reason: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    comment: Mapped[str] = mapped_column(Text, default="", nullable=False)


class UnansweredQuestion(TimestampMixin, Base):
    """Questions that RAG could not answer with high confidence."""
    __tablename__ = "unanswered_questions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    user_type: Mapped[str] = mapped_column(String(30), default="guest", nullable=False)  # guest, student, applicant
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False, index=True, nullable=False)
    resolved_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolution_note: Mapped[str] = mapped_column(Text, default="", nullable=False)


class KbAuditLog(TimestampMixin, Base):
    """Audit log for knowledge base changes."""
    __tablename__ = "kb_audit_logs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action: Mapped[str] = mapped_column(String(50), nullable=False)  # create, update, delete, publish, archive
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)  # document, score, program, tuition, faq
    entity_id: Mapped[str] = mapped_column(String(36), nullable=False)
    details: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)


class StatusHistory(TimestampMixin, Base):
    """Audit trail for entity status changes (Applicants, Personnel, Degrees, Requests)."""
    __tablename__ = "status_histories"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    entity_type: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    entity_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    old_status: Mapped[str] = mapped_column(String(50), default="", nullable=False)
    new_status: Mapped[str] = mapped_column(String(50), nullable=False)
    changed_by: Mapped[str] = mapped_column(String(100), default="Hệ thống", nullable=False)
    reason: Mapped[str] = mapped_column(Text, default="", nullable=False)


class PersonnelDegree(TimestampMixin, Base):
    """Degrees and professional certificates of lecturers."""
    __tablename__ = "personnel_degrees"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    personnel_id: Mapped[str] = mapped_column(ForeignKey("personnel.id", ondelete="CASCADE"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    degree_type: Mapped[str] = mapped_column(String(60), default="Bằng đại học", nullable=False)
    issuing_institution: Mapped[str] = mapped_column(String(200), nullable=False)
    issue_year: Mapped[int] = mapped_column(Integer, nullable=False)
    file_url: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="CHO_DUYET", index=True, nullable=False)  # CHO_DUYET, DA_DUYET, TU_CHOI
    rejection_reason: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    personnel: Mapped[Personnel] = relationship()


class PersonnelContract(TimestampMixin, Base):
    """Employment contracts with automatic 60-day expiry warnings."""
    __tablename__ = "personnel_contracts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    personnel_id: Mapped[str] = mapped_column(ForeignKey("personnel.id", ondelete="CASCADE"), index=True, nullable=False)
    contract_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    contract_type: Mapped[str] = mapped_column(String(100), default="Hợp đồng lao động xác định thời hạn", nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="Hiệu lực", index=True, nullable=False)
    salary_rate: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    file_url: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    personnel: Mapped[Personnel] = relationship()


class AdmissionChecklistProgress(TimestampMixin, Base):
    """11-step admission procedure checklist progress for freshmen."""
    __tablename__ = "admission_checklist_progress"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True, nullable=False)
    step_number: Mapped[int] = mapped_column(Integer, nullable=False)
    step_title: Mapped[str] = mapped_column(String(200), nullable=False)
    step_description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="CHUA_HOAN_THANH", index=True, nullable=False)  # CHUA_HOAN_THANH, CHO_XAC_NHAN, DA_HOAN_THANH
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    verified_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    student: Mapped[Student] = relationship()


class StudentRequest(TimestampMixin, Base):
    """Online student petitions and administrative requests."""
    __tablename__ = "student_requests"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True, nullable=False)
    student_id: Mapped[str] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True, nullable=False)
    request_type: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    attachments: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="CHO_TIEP_NHAN", index=True, nullable=False)  # CHO_TIEP_NHAN, DANG_XU_LY, DA_DUYET, TU_CHOI, YEU_CAU_BO_SUNG
    rejection_reason: Mapped[str] = mapped_column(Text, default="", nullable=False)
    assigned_lecturer_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    student: Mapped[Student] = relationship()
    assigned_lecturer: Mapped[User | None] = relationship(foreign_keys=[assigned_lecturer_id])


class AcademicSchedule(TimestampMixin, Base):
    """Class timetables and exam schedules."""
    __tablename__ = "academic_schedules"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    student_id: Mapped[str | None] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True, nullable=True)
    major_id: Mapped[str | None] = mapped_column(ForeignKey("majors.id"), index=True, nullable=True)
    cohort: Mapped[str] = mapped_column(String(30), default="2026", nullable=False)
    course_code: Mapped[str] = mapped_column(String(30), nullable=False)
    course_name: Mapped[str] = mapped_column(String(150), nullable=False)
    lecturer_name: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    schedule_type: Mapped[str] = mapped_column(String(30), default="LICH_HOC", index=True, nullable=False)  # LICH_HOC, LICH_THI
    day_of_week: Mapped[int] = mapped_column(Integer, default=2, nullable=False)  # 2: T2, ..., 7: T7, 8: CN
    start_time: Mapped[str] = mapped_column(String(20), default="07:30", nullable=False)
    end_time: Mapped[str] = mapped_column(String(20), default="09:50", nullable=False)
    schedule_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    room: Mapped[str] = mapped_column(String(50), default="A1-301", nullable=False)
    exam_format: Mapped[str] = mapped_column(String(60), default="Tự luận", nullable=False)
    notes: Mapped[str] = mapped_column(String(300), default="", nullable=False)


class Announcement(TimestampMixin, Base):
    """General academic and administrative announcements."""
    __tablename__ = "announcements"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    title: Mapped[str] = mapped_column(String(250), nullable=False)
    content: Mapped[Text] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(60), default="Đào tạo", index=True, nullable=False)
    target_role: Mapped[str] = mapped_column(String(30), default="ALL", index=True, nullable=False)  # ALL, SINH_VIEN, GIANG_VIEN
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)



