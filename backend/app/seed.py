from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select

from app.core.database import Base, SessionLocal, enable_vector_extension, engine
from app.core.security import hash_password
from app.models import (
    AcademicSchedule, AdmissionChecklistProgress, Announcement, Applicant, FAQ, Faculty,
    Major, Personnel, PersonnelContract, PersonnelDegree, Student, StudentRequest,
    StudyTask, SupportTicket, User
)
from app.ai.seed_admission_data import seed_admission_and_departments


MAJOR_DATA = [
    ("7480201", "Công nghệ thông tin", "Đào tạo nền tảng phát triển phần mềm, dữ liệu và hệ thống máy tính.", "Khoa Công nghệ", 4, 28000000, 240),
    ("7480101", "Khoa học máy tính", "Tập trung vào thuật toán, trí tuệ nhân tạo và nền tảng tính toán.", "Khoa Công nghệ", 4, 29000000, 120),
    ("7480103", "Kỹ thuật phần mềm", "Phát triển kỹ năng phân tích, thiết kế, xây dựng và vận hành phần mềm.", "Khoa Công nghệ", 4, 28000000, 180),
    ("7480104", "Hệ thống thông tin", "Kết nối công nghệ thông tin với quy trình và dữ liệu tổ chức.", "Khoa Công nghệ", 4, 27000000, 120),
    ("7480202", "An toàn thông tin", "Kiến thức về bảo mật hệ thống, mạng và dữ liệu số.", "Khoa Công nghệ", 4, 30000000, 100),
    ("7340101", "Quản trị kinh doanh", "Kiến thức nền tảng về quản trị, vận hành và chiến lược kinh doanh.", "Khoa Kinh tế", 4, 25000000, 200),
    ("7340115", "Marketing", "Nghiên cứu thị trường, thương hiệu và truyền thông tiếp thị.", "Khoa Kinh tế", 4, 26000000, 160),
    ("7340301", "Kế toán", "Thông tin kế toán, báo cáo tài chính và kiểm soát nội bộ.", "Khoa Kinh tế", 4, 24000000, 150),
    ("7340201", "Tài chính – Ngân hàng", "Kiến thức về thị trường tài chính, ngân hàng và quản trị rủi ro.", "Khoa Kinh tế", 4, 26000000, 150),
    ("7220201", "Ngôn ngữ Anh", "Phát triển năng lực tiếng Anh và giao tiếp liên văn hóa.", "Khoa Ngoại ngữ", 4, 23000000, 180),
]

FAQ_DATA = [
    ("Hồ sơ đăng ký xét tuyển gồm những gì?", "Thí sinh chuẩn bị CCCD 12 số, học bạ THPT, các chứng chỉ quốc tế (nếu có) và nộp trực tuyến qua cổng Tuyển sinh NEU Study.", "Tuyển sinh"),
    ("Làm thế nào để gửi yêu cầu hỗ trợ?", "Đăng nhập Study, mở Trung tâm hỗ trợ, chọn nhóm vấn đề, nhập tiêu đề và mô tả rồi gửi. Mã yêu cầu sẽ xuất hiện trong danh sách để bạn theo dõi.", "Hỗ trợ"),
    ("Tôi tra cứu tình trạng hồ sơ ở đâu?", "Mở mục Tuyển sinh và tra cứu bằng CCCD hoặc Mã hồ sơ đã được cấp khi nộp.", "Tuyển sinh"),
    ("Học phí hiển thị trên hệ thống có chính thức không?", "Dữ liệu học phí và chỉ tiêu trong hệ thống là dữ liệu mô phỏng theo đề án năm học của trường.", "Học phí"),
    ("Tài liệu nào được dùng làm nguồn cho AI Assistant?", "AI tìm trong FAQ, danh mục ngành và các tài liệu PDF, DOCX hoặc TXT do quản trị viên tải lên. Khi không đủ nguồn, trợ lý sẽ nêu rõ giới hạn.", "AI Assistant"),
    ("Đại học Kinh tế Quốc dân (NEU) ở đâu?", "Trụ sở chính của Đại học Kinh tế Quốc dân (NEU) tọa lạc tại số 207 Đường Giải Phóng, phường Đồng Tâm, quận Hai Bà Trưng, Hà Nội. Trường nổi tiếng với Tòa nhà Thế kỷ (Building A1) và Thư viện Phạm Văn Đồng hiện đại.", "NEU"),
    ("NEU có những phương thức xét tuyển nào?", "NEU tuyển sinh theo 3 nhóm phương thức chính: (1) Xét tuyển thẳng theo quy chế của Bộ GD&ĐT; (2) Xét tuyển kết hợp (chứng chỉ tiếng Anh quốc tế IELTS/TOEFL kết hợp ĐGNL hoặc điểm thi tốt nghiệp THPT, chứng chỉ SAT/ACT, điểm thi HSA/APT/TSA); (3) Xét tuyển theo kết quả thi tốt nghiệp THPT (các khối A00, A01, D01, D07...).", "NEU"),
    ("Các ngành đào tạo nổi bật nhất tại NEU là gì?", "Các ngành thế mạnh và điểm chuẩn top đầu tại NEU gồm: Logistics và Quản lý chuỗi cung ứng, Kinh doanh quốc tế, Marketing, Kiểm toán, Tài chính - Ngân hàng, Khoa học dữ liệu trong kinh tế, Trí tuệ nhân tạo (AI), Thương mại điện tử và các chương trình Tiên tiến & Chất lượng cao (AEP).", "NEU"),
    ("Học phí của NEU là bao nhiêu?", "Học phí tại NEU dao động theo chương trình đào tạo: Hệ chuẩn (đại trà) khoảng 18 - 25 triệu đồng/năm học tùy khối ngành; Hệ Tiên tiến & Chất lượng cao (AEP, POHE) khoảng 40 - 65 triệu đồng/năm học.", "NEU"),
    ("Chương trình Tiên tiến và Chất lượng cao (AEP) tại NEU là gì?", "AEP (Advanced Educational Programs) là chương trình đào tạo tinh hoa của NEU, giảng dạy bằng tiếng Anh với giáo trình nhập khẩu từ các đại học danh tiếng của Mỹ.", "NEU"),
    ("Quy chế đào tạo và tốt nghiệp tại NEU như thế nào?", "NEU đào tạo theo hệ thống tín chỉ chuẩn 4 năm (có thể học vượt trong 3 - 3.5 năm). Điểm học tập đánh giá theo thang điểm 10 quy đổi sang thang điểm 4.", "NEU"),
    ("Đời sống sinh viên và câu lạc bộ tại NEU ra sao?", "NEU có phong trào sinh viên sôi nổi với hơn 40 câu lạc bộ lớn nhỏ, thư viện Phạm Văn Đồng chuẩn quốc tế và ký túc xá khang trang.", "NEU"),
]

STUDENT_GIVEN_NAMES = ["Minh Anh", "Gia Huy", "Phương Linh", "Hoàng Nam", "Thảo Vy", "Quốc Bảo", "Khánh Ngọc", "Tuấn Kiệt", "Hà My", "Đức Anh", "Bảo Trân", "Nhật Minh", "Thanh Tâm", "Quang Vinh", "Ngọc Hà", "Hữu Phước", "Mai Chi", "Trọng Nghĩa", "Yến Nhi", "Đình Khang", "Kim Anh", "Tiến Đạt", "Khánh Linh", "Đăng Khoa", "Thùy Dương", "Minh Quân", "Bích Ngọc", "Hoài An", "Văn Khải", "Hương Giang", "Anh Tuấn", "Ngọc Diệp", "Phúc Hưng", "Thanh Trúc", "Bảo Long", "Thu Trang", "Duy Khánh", "Quỳnh Mai", "Thành Đạt", "Như Ý"]
STUDENT_FAMILY_NAMES = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương"]
SAMPLE_ADDRESSES = ["Ba Đình, Hà Nội", "Cầu Giấy, Hà Nội", "Hải Châu, Đà Nẵng", "Ninh Kiều, Cần Thơ", "Quận 3, TP. Hồ Chí Minh", "Thủ Đức, TP. Hồ Chí Minh", "Biên Hòa, Đồng Nai", "Thành phố Huế"]

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


def seed_data() -> None:
    enable_vector_extension()
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # 1. Khoa và Ngành
        faculties: dict[str, Faculty] = {}
        for faculty_name in sorted({row[3] for row in MAJOR_DATA}):
            faculty = db.scalar(select(Faculty).where(Faculty.name == faculty_name))
            if not faculty:
                faculty = Faculty(name=faculty_name)
                db.add(faculty)
                db.flush()
            faculties[faculty_name] = faculty
        db.flush()

        majors: dict[str, Major] = {}
        for code, name, description, faculty, years, tuition, quota in MAJOR_DATA:
            major = db.scalar(select(Major).where(Major.code == code))
            if not major:
                major = Major(code=code, name=name, description=description, faculty_id=faculties[faculty].id,
                              duration_years=years, tuition_per_year_vnd=tuition, admission_quota=quota,
                              admission_status="Đang tuyển sinh", is_demo=True)
                db.add(major)
                db.flush()
            majors[name] = major

        # 2. Tài khoản chuẩn 3 vai trò (ADMIN, GIANG_VIEN, SINH_VIEN) + tài khoản cũ
        demo_accounts = [
            ("admin@study.edu.vn", "Quản trị viên Hệ thống", "ADMIN"),
            ("giangvien@study.edu.vn", "TS. Nguyễn Thị Hồng Nhung", "GIANG_VIEN"),
            ("sinhvien@study.edu.vn", "Trần Minh Khoa", "SINH_VIEN"),
            # Legacy accounts for seamless backward compatibility
            ("admissions@study.edu.vn", "Nguyễn Minh Anh", "ADMIN"),
            ("student@study.edu.vn", "Trần Minh Khoa", "SINH_VIEN"),
            ("support@study.edu.vn", "Lê Thu Hà", "ADMIN"),
        ]
        users: dict[str, User] = {}
        for email, name, role in demo_accounts:
            account = db.scalar(select(User).where(User.email == email))
            if not account:
                account = User(email=email, full_name=name, password_hash=hash_password("StudyDemo2026!"), role=role)
                db.add(account)
                db.flush()
            else:
                account.role = role  # Cập nhật chuẩn hóa role
            users[email] = account
        admin_user = users["admin@study.edu.vn"]
        lecturer_user = users["giangvien@study.edu.vn"]
        student_user = users["sinhvien@study.edu.vn"]
        db.flush()

        # 3. Giảng viên & Nhân sự
        lecturer_names = [
            "Nguyễn Thị Hồng Nhung", "Trần Quốc Bảo", "Lê Minh Phương", "Phạm Văn Thành",
            "Vũ Thu Hà", "Đặng Hoàng Long", "Bùi Ngọc Anh", "Đỗ Thanh Tùng",
            "Hồ Mỹ Linh", "Ngô Quang Huy", "Dương Thị Mai", "Hoàng Đức Thịnh"
        ]
        faculties_by_name = {faculty.name: faculty for faculty in faculties.values()}
        lecturers: list[Personnel] = []
        for index, full_name in enumerate(lecturer_names, start=1):
            code = f"GV-DEMO-{index:03d}"
            email = "giangvien@study.edu.vn" if index == 1 else f"giangvien{index:02d}@example.com"
            faculty_name = ("Khoa Công nghệ", "Khoa Kinh tế", "Khoa Ngoại ngữ")[index % 3]
            faculty = faculties_by_name[faculty_name]
            person = db.scalar(select(Personnel).where(Personnel.code == code))
            if not person:
                person = Personnel(
                    code=code, kind="lecturer", full_name=full_name,
                    email=email, phone=f"090700{index:04d}",
                    user_id=lecturer_user.id if index == 1 else None,
                    date_of_birth=date(1975 + index % 15, index % 12 + 1, index % 27 + 1),
                    gender="Nữ" if index % 2 else "Nam", address=SAMPLE_ADDRESSES[index % len(SAMPLE_ADDRESSES)],
                    education_level=("Tiến sĩ", "Thạc sĩ")[index % 2],
                    academic_rank=("Phó Giáo sư" if index % 4 == 0 else ""),
                    specialty=faculty_name.replace("Khoa ", ""), faculty_id=faculty.id,
                    department=faculty_name, position="Giảng viên chính" if index <= 2 else "Giảng viên",
                    start_date=date(2012 + index % 10, 9, 1),
                    work_status="Đang công tác",
                    profile_status="DA_DUYET",
                    notes="Giảng viên cơ hữu giàu kinh nghiệm.", is_demo=True
                )
                db.add(person)
                db.flush()
            else:
                if index == 1 and not person.user_id:
                    person.user_id = lecturer_user.id
            lecturers.append(person)

        # Hợp đồng lao động mẫu cho giảng viên (có hợp đồng sắp hết hạn trong 60 ngày để test alert)
        primary_lecturer = lecturers[0]
        if not db.scalar(select(PersonnelContract.id).where(PersonnelContract.personnel_id == primary_lecturer.id)):
            expiring_date = date.today() + timedelta(days=35)  # Hết hạn sau 35 ngày (< 60 ngày) -> Kích hoạt cảnh báo!
            db.add(PersonnelContract(
                personnel_id=primary_lecturer.id,
                contract_number="HDLD-2023-GV001",
                contract_type="Hợp đồng lao động xác định thời hạn (3 năm)",
                start_date=date(2023, 1, 1),
                end_date=expiring_date,
                status="Sắp hết hạn",
                salary_rate="Hệ số lương 4.40 - Bậc 3",
                notes="Hợp đồng sắp hết hạn, phòng Tổ chức - Cán bộ cần chuẩn bị thủ tục tái ký.",
                file_url="hop_dong_nguyen_thi_hong_nhung_2023.pdf"
            ))

        # Văn bằng chứng chỉ mẫu cho giảng viên
        if not db.scalar(select(PersonnelDegree.id).where(PersonnelDegree.personnel_id == primary_lecturer.id)):
            db.add(PersonnelDegree(
                personnel_id=primary_lecturer.id,
                title="Bằng Tiến sĩ Khoa học Máy tính",
                degree_type="Bằng tiến sĩ",
                issuing_institution="Đại học Bách Khoa Hà Nội",
                issue_year=2018,
                status="DA_DUYET",
                file_url="bang_tien_si_cs.pdf"
            ))
            db.add(PersonnelDegree(
                personnel_id=primary_lecturer.id,
                title="Chứng chỉ Tiếng Anh IELTS 8.0",
                degree_type="Chứng chỉ ngoại ngữ",
                issuing_institution="British Council",
                issue_year=2023,
                status="DA_DUYET",
                file_url="ielts_80_certificate.pdf"
            ))

        # 4. Hồ sơ sinh viên mẫu
        student = db.scalar(select(Student).where(Student.student_number == "STU20260001"))
        if not student:
            student = Student(
                user_id=student_user.id, student_number="STU20260001", full_name=student_user.full_name,
                email=student_user.email, phone="0900000001", major_id=majors["Công nghệ thông tin"].id,
                cohort="2026", class_name="CNTT-K26A", study_status="Đang học",
                enrollment_date=date(2026, 9, 5), is_demo=True
            )
            db.add(student)
            db.flush()
        else:
            if not student.user_id:
                student.user_id = student_user.id

        # Khởi tạo 11 bước thủ tục nhập học cho sinh viên demo
        existing_steps = db.scalars(select(AdmissionChecklistProgress.step_number).where(AdmissionChecklistProgress.student_id == student.id)).all()
        for step_num, step_title, step_desc in CHECKLIST_STEPS:
            if step_num not in existing_steps:
                db.add(AdmissionChecklistProgress(
                    student_id=student.id,
                    step_number=step_num,
                    step_title=step_title,
                    step_description=step_desc,
                    status="DA_HOAN_THANH" if step_num <= 4 else ("CHO_XAC_NHAN" if step_num == 5 else "CHUA_HOAN_THANH"),
                    completed_at=datetime.now(timezone.utc) if step_num <= 4 else None,
                    notes="Đã hoàn thành qua cổng trực tuyến." if step_num <= 4 else ""
                ))

        # 5. Hồ sơ xét tuyển tuyển sinh mẫu (kèm CCCD, mã hồ sơ, 3 nguyện vọng)
        sample_applicants = [
            ("TS2026-00101", "001204008912", "ngoc.mai@example.edu.vn", "Phạm Ngọc Mai", "0900000012",
             majors["Marketing"].id, majors["Quản trị kinh doanh"].id, majors["Tài chính – Ngân hàng"].id,
             "Xét tuyển kết hợp IELTS", 1.5, 27.5, "Trúng tuyển"),
            ("TS2026-00102", "001204009834", "hoang.nam@example.edu.vn", "Đặng Hoàng Nam", "0900000013",
             majors["Công nghệ thông tin"].id, majors["Khoa học máy tính"].id, majors["Kỹ thuật phần mềm"].id,
             "Điểm thi THPT", 0.5, 28.25, "Đang xét duyệt"),
            ("TS2026-00103", "001204007621", "thu.ha@example.edu.vn", "Vũ Thu Hà", "0900000014",
             majors["Kế toán"].id, majors["Tài chính – Ngân hàng"].id, None,
             "Điểm thi ĐGNL (HSA)", 1.0, 106.0, "Cần bổ sung"),
        ]
        for app_code, cccd, email, full_name, phone, nv1, nv2, nv3, method, prio, score, status in sample_applicants:
            if not db.scalar(select(Applicant.id).where(Applicant.application_code == app_code)):
                db.add(Applicant(
                    application_code=app_code,
                    identity_card=cccd,
                    email=email,
                    full_name=full_name,
                    phone=phone,
                    desired_major_id=nv1,
                    desired_major_2_id=nv2,
                    desired_major_3_id=nv3,
                    admission_method=method,
                    priority_score=prio,
                    total_score=score,
                    status=status,
                    attachments=[
                        {"filename": "cccd_mat_truoc.jpg", "type": "image/jpeg"},
                        {"filename": "hoc_ba_thpt.pdf", "type": "application/pdf"}
                    ],
                    status_note="Hồ sơ hợp lệ theo quy chế xét tuyển đợt 1."
                ))

        # 6. Đơn trực tuyến sinh viên mẫu
        if not db.scalar(select(StudentRequest.id).where(StudentRequest.student_id == student.id)):
            db.add(StudentRequest(
                code="DON-2026-001",
                student_id=student.id,
                request_type="Xác nhận sinh viên",
                title="Xin cấp giấy xác nhận sinh viên để làm vé xe buýt tháng",
                reason="Em cần giấy xác nhận sinh viên nộp cho công ty vận tải hành khách công cộng để đăng ký vé xe buýt sinh viên liên tuyến.",
                status="DA_DUYET",
                assigned_lecturer_id=lecturer_user.id,
                rating=5,
                feedback="Thủ tục xác nhận rất nhanh chóng, em cảm ơn thầy cô."
            ))
            db.add(StudentRequest(
                code="DON-2026-002",
                student_id=student.id,
                request_type="Cấp bảng điểm tạm thời",
                title="Xin bảng điểm tạm thời 2 kỳ gần nhất",
                reason="Em xin bảng điểm để nộp hồ sơ xét học bổng doanh nghiệp Vietcombank đợt 1 năm 2026.",
                status="DANG_XU_LY",
                assigned_lecturer_id=lecturer_user.id
            ))

        # 7. Thời khóa biểu & Lịch thi mẫu
        if not db.scalar(select(AcademicSchedule.id).where(AcademicSchedule.student_id == student.id)):
            schedules = [
                ("IT201", "Lập trình Web nâng cao", "TS. Nguyễn Thị Hồng Nhung", "LICH_HOC", 2, "07:30", "09:50", "A1-402", "Phòng máy"),
                ("IT204", "Cơ sở dữ liệu nâng cao", "ThS. Trần Quốc Bảo", "LICH_HOC", 4, "13:00", "15:20", "D2-205", "Lý thuyết"),
                ("IT305", "Trí tuệ nhân tạo", "TS. Lê Minh Phương", "LICH_HOC", 6, "09:55", "12:15", "A1-301", "Lý thuyết & Thảo luận"),
                ("IT201", "Thi cuối kỳ: Lập trình Web nâng cao", "TS. Nguyễn Thị Hồng Nhung", "LICH_THI", 7, "08:00", "09:30", "A2-Hội trường", "Thực hành trên máy"),
            ]
            for c_code, c_name, l_name, s_type, dow, st, et, room, notes in schedules:
                db.add(AcademicSchedule(
                    student_id=student.id,
                    major_id=student.major_id,
                    cohort="2026",
                    course_code=c_code,
                    course_name=c_name,
                    lecturer_name=l_name,
                    schedule_type=s_type,
                    day_of_week=dow,
                    start_time=st,
                    end_time=et,
                    schedule_date=date.today() + timedelta(days=12) if s_type == "LICH_THI" else None,
                    room=room,
                    notes=notes
                ))

        # 8. Thông báo chung
        if not db.scalar(select(Announcement.id)):
            announcements = [
                ("Thông báo về việc nộp hồ sơ xin miễn giảm học phí học kỳ 1 năm học 2026-2027",
                 "Nhà trường thông báo đến toàn thể sinh viên về kế hoạch tiếp nhận hồ sơ xét miễn, giảm học phí theo quy định của Chính phủ...", "Học phí & Học bổng", "SINH_VIEN", True),
                ("Kế hoạch đăng ký đề tài nghiên cứu khoa học giảng viên năm 2026",
                 "Phòng Quản lý Khoa học trân trọng thông báo đến các Khoa, Viện và Giảng viên về hạn nộp thuyết minh đề tài cấp trường...", "Nghiên cứu", "GIANG_VIEN", True),
                ("Thông báo lịch nghỉ lễ và kế hoạch học bù đợt 1",
                 "Toàn trường thực hiện lịch nghỉ lễ theo quy định và học bù theo lịch phòng Đào tạo đã công bố...", "Đào tạo", "ALL", False),
            ]
            for title, content, cat, target, pinned in announcements:
                db.add(Announcement(title=title, content=content, category=cat, target_role=target, is_pinned=pinned))

        # 9. Study Tasks, FAQs, Admissions RAG data
        now = datetime.now(timezone.utc)
        demo_study_tasks = [
            ("Nộp bài tập lớn Cấu trúc dữ liệu & Giải thuật", "Cấu trúc dữ liệu & Giải thuật", "assignment", now + timedelta(days=3), "high", "Cài đặt cây AVL."),
            ("Thi kết thúc học phần Cơ sở dữ liệu", "Cơ sở dữ liệu", "exam", now + timedelta(days=10), "high", "Chuẩn hóa dữ liệu."),
        ]
        for title, course, t_type, due, priority, notes in demo_study_tasks:
            if not db.scalar(select(StudyTask.id).where(StudyTask.user_id == student_user.id, StudyTask.title == title)):
                db.add(StudyTask(
                    user_id=student_user.id, title=title, course_name=course,
                    task_type=t_type, due_date=due, priority=priority,
                    notes=notes, status="pending"
                ))

        for question, answer, category in FAQ_DATA:
            if not db.scalar(select(FAQ.id).where(FAQ.question == question)):
                db.add(FAQ(question=question, answer=answer, category=category, is_published=True))

        db.commit()
        seed_admission_and_departments(db)
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
