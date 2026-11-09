from app.models import Applicant, Personnel, Student, SupportTicket


def applicant_public(applicant: Applicant) -> dict:
    return {
        "id": applicant.id,
        "application_code": applicant.application_code or f"TS2026-{applicant.id[:6].upper()}",
        "identity_card": applicant.identity_card or "",
        "email": applicant.email,
        "full_name": applicant.full_name,
        "phone": applicant.phone,
        "date_of_birth": applicant.date_of_birth,
        "address": applicant.address or "",
        "desired_major_id": applicant.desired_major_id,
        "major_name": applicant.major.name if applicant.major else "",
        "desired_major_2_id": applicant.desired_major_2_id,
        "major_2_name": applicant.major_2.name if applicant.major_2 else None,
        "desired_major_3_id": applicant.desired_major_3_id,
        "major_3_name": applicant.major_3.name if applicant.major_3 else None,
        "admission_method": applicant.admission_method,
        "priority_score": applicant.priority_score or 0.0,
        "total_score": applicant.total_score or 0.0,
        "attachments": applicant.attachments or [],
        "status": applicant.status,
        "status_note": applicant.status_note or "",
        "created_at": applicant.created_at,
        "student_id": applicant.student_id,
    }


def student_public(student: Student) -> dict:
    return {
        "id": student.id,
        "student_number": student.student_number,
        "full_name": student.full_name,
        "email": student.email,
        "phone": student.phone,
        "major_id": student.major_id,
        "date_of_birth": student.date_of_birth,
        "gender": student.gender,
        "address": student.address,
        "emergency_contact": student.emergency_contact,
        "major_name": student.major.name if student.major else "",
        "cohort": student.cohort,
        "class_name": student.class_name,
        "study_status": student.study_status,
        "enrollment_date": student.enrollment_date,
        "is_demo": student.is_demo,
    }


def ticket_public(ticket: SupportTicket) -> dict:
    return {
        "id": ticket.id,
        "code": ticket.code,
        "owner_id": ticket.owner_id,
        "owner_name": ticket.owner.full_name if ticket.owner else "",
        "category": ticket.category,
        "subject": ticket.subject,
        "description": ticket.description,
        "priority": ticket.priority,
        "status": ticket.status,
        "assignee_id": ticket.assignee_id,
        "created_at": ticket.created_at,
        "satisfaction_rating": ticket.satisfaction_rating,
        "satisfaction_feedback": ticket.satisfaction_feedback,
        "messages": [
            {"id": message.id, "author_id": message.author_id, "body": message.body, "created_at": message.created_at}
            for message in ticket.messages
        ],
        "attachments": [
            {"id": row.id, "filename": row.filename, "media_type": row.media_type,
             "size_bytes": row.size_bytes, "uploaded_at": row.created_at}
            for row in ticket.attachments
        ],
    }


def personnel_public(row: Personnel) -> dict:
    return {
        "id": row.id,
        "user_id": row.user_id,
        "code": row.code,
        "kind": row.kind,
        "full_name": row.full_name,
        "email": row.email,
        "phone": row.phone,
        "date_of_birth": row.date_of_birth,
        "gender": row.gender,
        "address": row.address,
        "avatar_url": row.avatar_url,
        "education_level": row.education_level,
        "academic_rank": row.academic_rank,
        "specialty": row.specialty,
        "faculty_id": row.faculty_id,
        "faculty_name": row.faculty.name if row.faculty else None,
        "department": row.department,
        "position": row.position,
        "start_date": row.start_date,
        "work_status": row.work_status,
        "profile_status": row.profile_status or "DA_DUYET",
        "rejection_reason": row.rejection_reason or "",
        "pending_updates": row.pending_updates or {},
        "notes": row.notes,
        "is_demo": row.is_demo,
    }
