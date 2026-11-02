from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select

from app.core.database import Base, SessionLocal, enable_vector_extension, engine
from app.core.security import hash_password
from app.models import Applicant, FAQ, Faculty, Major, Personnel, Student, StudyTask, SupportTicket, User


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
    ("7340116", "Logistics và Quản lý chuỗi cung ứng", "Chuyên ngành đào tạo quản trị chuỗi cung ứng hàng đầu cả nước.", "Khoa Kinh tế", 4, 28000000, 180),
    ("7340302", "Kiểm toán", "Cái nôi kiểm toán lớn nhất Việt Nam, định hướng chứng chỉ CPA, ACCA.", "Khoa Kinh tế", 4, 28000000, 200),
    ("7340122", "Thương mại điện tử", "Kinh doanh số, sàn TMĐT và tiếp thị số đa nền tảng.", "Khoa Kinh tế", 4, 28000000, 160),
    ("7480108", "Khoa học dữ liệu trong Kinh tế & KD (DSEB)", "Chương trình tiên tiến chuyên sâu AI và Big Data.", "Khoa Công nghệ", 4, 45000000, 100),
    ("7480107", "Trí tuệ nhân tạo (AI) trong Kinh doanh", "Ứng dụng máy học, mô hình ngôn ngữ và tự động hóa trong quản trị kinh doanh.", "Khoa Công nghệ", 4, 45000000, 100),
]

FAQ_DATA = [
    ("Hồ sơ đăng ký xét tuyển gồm những gì?", "Trong dữ liệu demo, thí sinh chuẩn bị thông tin cá nhân, thông tin liên hệ, nguyện vọng và giấy tờ theo hướng dẫn của đợt tuyển sinh. Danh mục này không phải yêu cầu chính thức; hãy đối chiếu đề án tuyển sinh của trường.", "Tuyển sinh"),
    ("Làm thế nào để gửi yêu cầu hỗ trợ?", "Đăng nhập Study, mở Trung tâm hỗ trợ, chọn nhóm vấn đề, nhập tiêu đề và mô tả rồi gửi. Mã yêu cầu sẽ xuất hiện trong danh sách để bạn theo dõi.", "Hỗ trợ"),
    ("Tôi tra cứu tình trạng hồ sơ ở đâu?", "Mở mục Tuyển sinh và tra cứu bằng tài khoản đã đăng ký. Nhân viên có thể xem danh sách hồ sơ theo quyền được cấp.", "Tuyển sinh"),
    ("Học phí hiển thị trên hệ thống có chính thức không?", "Không. Học phí và chỉ tiêu trong bản Study demo là dữ liệu tham khảo minh họa, không đại diện cho thông tin chính thức của trường.", "Học phí"),
    ("Tài liệu nào được dùng làm nguồn cho AI Assistant?", "AI tìm trong FAQ, danh mục ngành và các tài liệu PDF, DOCX hoặc TXT do quản trị viên tải lên. Khi không đủ nguồn, trợ lý sẽ nêu rõ giới hạn.", "AI Assistant"),
    ("Đại học Kinh tế Quốc dân (NEU) ở đâu?", "Trụ sở chính của Đại học Kinh tế Quốc dân (NEU) tọa lạc tại số 207 Đường Giải Phóng, phường Đồng Tâm, quận Hai Bà Trưng, Hà Nội. Trường nổi tiếng với Tòa nhà Thế kỷ (Building A1) và Thư viện Phạm Văn Đồng hiện đại.", "NEU"),
    ("NEU có những phương thức xét tuyển nào?", "NEU tuyển sinh theo 3 nhóm phương thức chính: (1) Xét tuyển thẳng theo quy chế của Bộ GD&ĐT; (2) Xét tuyển kết hợp (chứng chỉ tiếng Anh quốc tế IELTS/TOEFL kết hợp ĐGNL hoặc điểm thi tốt nghiệp THPT, chứng chỉ SAT/ACT, điểm thi HSA/APT/TSA); (3) Xét tuyển theo kết quả thi tốt nghiệp THPT (các khối A00, A01, D01, D07...).", "NEU"),
    ("Các ngành đào tạo nổi bật nhất tại NEU là gì?", "Các ngành thế mạnh và điểm chuẩn top đầu tại NEU gồm: Logistics và Quản lý chuỗi cung ứng, Kinh doanh quốc tế, Marketing, Kiểm toán, Tài chính - Ngân hàng, Khoa học dữ liệu trong kinh tế, Trí tuệ nhân tạo (AI), Thương mại điện tử và các chương trình Tiên tiến & Chất lượng cao (AEP).", "NEU"),
    ("Học phí của NEU là bao nhiêu?", "Học phí tại NEU dao động theo chương trình đào tạo: Hệ chuẩn (đại trà) khoảng 18 - 25 triệu đồng/năm học tùy khối ngành; Hệ Tiên tiến & Chất lượng cao (AEP, POHE) khoảng 40 - 65 triệu đồng/năm học.", "NEU"),
    ("Chương trình Tiên tiến và Chất lượng cao (AEP) tại NEU là gì?", "AEP (Advanced Educational Programs) là chương trình đào tạo tinh hoa của NEU, giảng dạy bằng tiếng Anh với giáo trình nhập khẩu từ các đại học danh tiếng của Mỹ (như California State University, Long Beach). Sinh viên được học tập trong môi trường quốc tế và cơ hội liên kết du học cao.", "NEU"),
    ("Quy chế đào tạo và tốt nghiệp tại NEU như thế nào?", "NEU đào tạo theo hệ thống tín chỉ chuẩn 4 năm (có thể học vượt trong 3 - 3.5 năm). Điểm học tập đánh giá theo thang điểm 10 quy đổi sang thang điểm 4. Để tốt nghiệp, sinh viên cần hoàn thành đủ số tín chỉ, đạt chuẩn đầu ra Tiếng Anh, chuẩn Tin học và Giáo dục thể chất, quốc phòng.", "NEU"),
    ("Đời sống sinh viên và câu lạc bộ tại NEU ra sao?", "NEU có phong trào sinh viên vô cùng sôi nổi với hơn 40 câu lạc bộ lớn nhỏ (như CLB Nhà Kinh tế trẻ YEC, CLB Kế toán Kiểm toán A&A, CLB Marketing MGC...). Trường có ký túc xá khang trang, sân bóng, hội trường A2 hiện đại và thư viện Phạm Văn Đồng 4 tầng chuẩn quốc tế.", "NEU"),
]

STUDENT_GIVEN_NAMES = [
    "Minh Anh", "Gia Huy", "Phương Linh", "Hoàng Nam", "Thảo Vy", "Quốc Bảo", "Khánh Ngọc", "Tuấn Kiệt",
    "Hà My", "Đức Anh", "Bảo Trân", "Nhật Minh", "Thanh Tâm", "Quang Vinh", "Ngọc Hà", "Hữu Phước",
    "Mai Chi", "Trọng Nghĩa", "Yến Nhi", "Đình Khang", "Kim Anh", "Tiến Đạt", "Khánh Linh", "Đăng Khoa",
    "Thùy Dương", "Minh Quân", "Bích Ngọc", "Hoài An", "Văn Khải", "Hương Giang", "Anh Tuấn", "Ngọc Diệp",
    "Phúc Hưng", "Thanh Trúc", "Bảo Long", "Thu Trang", "Duy Khánh", "Quỳnh Mai", "Thành Đạt", "Như Ý",
    "Bảo Châu", "Gia Bảo", "Phương Anh", "Huy Hoàng", "Bích Trâm", "Hải Đăng", "Cẩm Ly", "Việt Dũng",
    "Lan Hương", "Hồng Phúc", "Thục Quyên", "Mạnh Hùng", "Ánh Dương", "Thanh Phong", "Khánh Vy", "Chí Thiện",
    "Yến Trang", "Tấn Phát", "Thảo My", "Đức Huy", "Kiều Oanh", "Hoàng Long", "Trúc Mai", "Quốc Anh"
]
STUDENT_FAMILY_NAMES = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương"]
SAMPLE_ADDRESSES = ["Ba Đình, Hà Nội", "Cầu Giấy, Hà Nội", "Hải Châu, Đà Nẵng", "Ninh Kiều, Cần Thơ", "Quận 3, TP. Hồ Chí Minh", "Thủ Đức, TP. Hồ Chí Minh", "Biên Hòa, Đồng Nai", "Thành phố Huế"]


def seed_data() -> None:
    enable_vector_extension()
    # Repair an interrupted/partially initialized database before checking seed state.
    # Alembic remains the schema migration mechanism; create_all is idempotent and
    # ensures the initial tables exist if a prior startup recorded the revision early.
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
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

        demo_accounts = [
            ("admin@study.edu.vn", "Quản trị Study", "super_admin"),
            ("admissions@study.edu.vn", "Nguyễn Minh Anh", "admission_staff"),
            ("student@study.edu.vn", "Trần Minh Khoa", "student"),
            ("support@study.edu.vn", "Lê Thu Hà", "support_staff"),
        ]
        users: dict[str, User] = {}
        for email, name, role in demo_accounts:
            account = db.scalar(select(User).where(User.email == email))
            if not account:
                account = User(email=email, full_name=name, password_hash=hash_password("StudyDemo2026!"), role=role)
                db.add(account)
                db.flush()
            users[email] = account
        admin = users["admin@study.edu.vn"]
        admissions = users["admissions@study.edu.vn"]
        student_user = users["student@study.edu.vn"]
        support_user = users["support@study.edu.vn"]
        db.flush()

        # 1. Main demo student: Trần Minh Khoa
        primary_student = db.scalar(select(Student).where(Student.student_number == "STU20260001"))
        khoa_emergency = {
            "parent_name": "Trần Văn Hùng",
            "parent_phone": "0912345678",
            "relationship": "Bố",
            "citizen_id": "001202018899",
            "citizen_issued_date": "15/04/2021",
            "citizen_issued_place": "Cục Cảnh sát QLHC về TTXH",
            "ethnic": "Kinh",
            "religion": "Không",
            "hometown": "Nam Định",
            "personal_email": "khoa.tran2004@gmail.com",
            "advisor_name": "TS. Nguyễn Hoàng Nam",
            "advisor_email": "namnh@neu.edu.vn",
            "faculty": "Khoa Công nghệ thông tin",
            "program_type": "Đại học Chính quy (Hệ Chuẩn)",
            "credits_accumulated": 78,
            "credits_total": 130,
            "credits_general": 32,
            "credits_foundation": 28,
            "credits_specialized": 18,
            "gpa_4": 3.48,
            "gpa_10": 8.35,
            "academic_rank": "Giỏi",
            "training_points": 88,
            "training_rank": "Tốt",
            "english_cert": "IELTS 6.5 (Đạt Chuẩn đầu ra)",
            "it_cert": "MOS Word, Excel (Đạt Chuẩn đầu ra)",
            "national_defense": "Đã hoàn thành (Loại Giỏi)",
            "physical_education": "Đã tích lũy đủ 4/4 học phần",
            "awards": [
                "Học bổng Khuyến khích học tập Loại Giỏi Học kỳ 1 (2025-2026)",
                "Giải Ba Cuộc thi Nghiên cứu Khoa học Sinh viên cấp Khoa",
                "Sinh viên 5 Tốt cấp Trường năm học 2024-2025",
                "Thành viên tích cực CLB Nhà Kinh tế trẻ NEU (YEC)"
            ]
        }
        if not primary_student:
            if not db.scalar(select(Student.id).where(Student.user_id == student_user.id)):
                db.add(Student(user_id=student_user.id, student_number="STU20260001", full_name=student_user.full_name,
                               email=student_user.email, phone="0900000001", major_id=majors["Công nghệ thông tin"].id,
                               cohort="2026", class_name="CNTT-K26A", study_status="Đang học",
                               date_of_birth=date(2004, 5, 18), gender="Nam",
                               address="Số 207 Giải Phóng, Phường Đồng Tâm, Quận Hai Bà Trưng, Hà Nội",
                               emergency_contact=khoa_emergency,
                               enrollment_date=date(2026, 9, 5), is_demo=True))
        else:
            primary_student.date_of_birth = date(2004, 5, 18)
            primary_student.gender = "Nam"
            primary_student.address = "Số 207 Giải Phóng, Phường Đồng Tâm, Quận Hai Bà Trưng, Hà Nội"
            primary_student.emergency_contact = khoa_emergency

        # 2. Additive seed for rich student records
        advisors = [
            ("TS. Nguyễn Hoàng Nam", "namnh@neu.edu.vn"),
            ("PGS.TS. Trần Thị Bích", "bicht@neu.edu.vn"),
            ("TS. Lê Quốc Trung", "trunglq@neu.edu.vn"),
            ("ThS. Phạm Mai Anh", "anhpm@neu.edu.vn"),
            ("PGS.TS. Đỗ Thanh Tùng", "tungdt@neu.edu.vn")
        ]
        all_majors = list(majors.values())
        for index, given_name in enumerate(STUDENT_GIVEN_NAMES, start=2):
            cohort_year = (2022, 2023, 2024, 2025, 2026)[index % 5]
            cohort = str(cohort_year)
            student_number = f"STU{cohort}{index:04d}"
            sample_email = f"sv{index:02d}@example.com"
            major = all_majors[(index - 2) % len(all_majors)]
            family = STUDENT_FAMILY_NAMES[(index * 3) % len(STUDENT_FAMILY_NAMES)]
            full_name = f"{family} {given_name}"
            study_status = "Tạm nghỉ" if index % 13 == 0 else ("Đã tốt nghiệp" if cohort_year < 2023 else ("Bảo lưu" if index % 11 == 0 else "Đang học"))
            adv_name, adv_email = advisors[index % len(advisors)]
            gpa = round(2.8 + (index * 7 % 13) * 0.09, 2)
            gpa_10 = round(gpa * 2.3 + 0.3, 1)
            rank = "Xuất sắc" if gpa >= 3.6 else ("Giỏi" if gpa >= 3.2 else ("Khá" if gpa >= 2.5 else "Trung bình"))
            credits_acc = min(130, 28 + (2026 - cohort_year) * 26 + (index % 10))
            student_meta = {
                "parent_name": f"{family} Văn {['Hải', 'Thành', 'Tuấn', 'Dũng', 'Minh'][index % 5]}",
                "parent_phone": f"0912{index:06d}",
                "relationship": "Phụ huynh",
                "citizen_id": f"00120{index % 4}{index:06d}",
                "citizen_issued_date": "10/06/2021",
                "citizen_issued_place": "Cục Cảnh sát QLHC về TTXH",
                "ethnic": "Kinh",
                "religion": "Không",
                "hometown": ("Hà Nội", "Hải Phòng", "Nam Định", "Đà Nẵng", "Nghệ An", "Thanh Hóa", "TP. Hồ Chí Minh")[index % 7],
                "personal_email": f"{given_name.lower().replace(' ', '')}{index}@gmail.com",
                "advisor_name": adv_name,
                "advisor_email": adv_email,
                "faculty": major.faculty.name if hasattr(major, "faculty") and major.faculty else "Khoa Kinh tế",
                "program_type": ("Chương trình Tiên tiến AEP", "Chương trình Chuẩn", "Chất lượng cao POHE")[index % 3],
                "credits_accumulated": credits_acc,
                "credits_total": 130,
                "credits_general": min(32, int(credits_acc * 0.35)),
                "credits_foundation": min(36, int(credits_acc * 0.4)),
                "credits_specialized": max(0, credits_acc - min(32, int(credits_acc * 0.35)) - min(36, int(credits_acc * 0.4))),
                "gpa_4": gpa,
                "gpa_10": gpa_10,
                "academic_rank": rank,
                "training_points": 75 + (index * 5 % 24),
                "training_rank": "Tốt" if (75 + (index * 5 % 24)) >= 80 else "Khá",
                "english_cert": ("IELTS 7.0 (Đạt)", "IELTS 6.5 (Đạt)", "TOEIC 750 (Đạt)", "Chưa nộp CĐR")[index % 4],
                "it_cert": ("MOS Word & Excel (Đạt)", "IC3 GS5 (Đạt)", "Chưa nộp CĐR")[index % 3],
                "national_defense": "Đã hoàn thành",
                "physical_education": f"Đã tích lũy {min(4, 1 + (2026 - cohort_year))}/4 học phần",
                "awards": [
                    f"Khen thưởng thành tích học tập Khóa {cohort}",
                    f"Thành viên CLB Sinh viên NEU"
                ] if gpa >= 3.2 else []
            }
            
            existing = db.scalar(select(Student).where(Student.student_number == student_number))
            if existing:
                if not existing.emergency_contact:
                    existing.emergency_contact = student_meta
                if not existing.date_of_birth:
                    existing.date_of_birth = date(2002 + index % 5, index % 12 + 1, index % 27 + 1)
                if not existing.address:
                    existing.address = SAMPLE_ADDRESSES[index % len(SAMPLE_ADDRESSES)]
                continue

            db.add(Student(student_number=student_number, full_name=full_name,
                           email=sample_email, phone=f"09{index % 10}{index:07d}",
                           date_of_birth=date(2002 + index % 5, index % 12 + 1, index % 27 + 1),
                           gender=("Nam", "Nữ", "Khác")[index % 3], address=SAMPLE_ADDRESSES[index % len(SAMPLE_ADDRESSES)],
                           major_id=major.id, cohort=cohort, class_name=f"{major.code[-3:]}-K{cohort[-2:]}{chr(65 + index % 3)}",
                           study_status=study_status, enrollment_date=date(cohort_year, 9, 5),
                           emergency_contact=student_meta, is_demo=True))

        lecturer_names = ["Nguyễn Thị Hồng Nhung", "Trần Quốc Bảo", "Lê Minh Phương", "Phạm Văn Thành", "Vũ Thu Hà", "Đặng Hoàng Long", "Bùi Ngọc Anh", "Đỗ Thanh Tùng", "Hồ Mỹ Linh", "Ngô Quang Huy", "Dương Thị Mai", "Hoàng Đức Thịnh"]
        faculties_by_name = {faculty.name: faculty for faculty in faculties.values()}
        for index, full_name in enumerate(lecturer_names, start=1):
            code = f"GV-DEMO-{index:03d}"
            email = f"giangvien{index:02d}@example.com"
            if (db.scalar(select(Personnel.id).where(Personnel.code == code))
                    or db.scalar(select(Personnel.id).where(Personnel.email == email))):
                continue
            faculty_name = ("Khoa Công nghệ", "Khoa Kinh tế", "Khoa Ngoại ngữ")[index % 3]
            faculty = faculties_by_name[faculty_name]
            db.add(Personnel(code=code, kind="lecturer", full_name=full_name,
                             email=email, phone=f"090700{index:04d}",
                             date_of_birth=date(1975 + index % 15, index % 12 + 1, index % 27 + 1),
                             gender="Nữ" if index % 2 else "Nam", address=SAMPLE_ADDRESSES[index % len(SAMPLE_ADDRESSES)],
                             education_level=("Tiến sĩ", "Thạc sĩ")[index % 2],
                             academic_rank=("Phó Giáo sư" if index % 4 == 0 else ""),
                             specialty=faculty_name.replace("Khoa ", ""), faculty_id=faculty.id,
                             department=faculty_name, position="Giảng viên", start_date=date(2012 + index % 10, 9, 1),
                             work_status="Tạm nghỉ" if index == 12 else "Đang công tác", notes="Hồ sơ mẫu.", is_demo=True))

        employee_records = [
            ("NV-DEMO-001", "Phạm Thu Hằng", "Phòng Công tác sinh viên", "Chuyên viên hỗ trợ"),
            ("NV-DEMO-002", "Nguyễn Thành Trung", "Phòng Đào tạo", "Chuyên viên đào tạo"),
            ("NV-DEMO-003", "Lê Khánh Vy", "Phòng Tài chính", "Kế toán viên"),
            ("NV-DEMO-004", "Trần Minh Đức", "Phòng Công nghệ thông tin", "Quản trị hệ thống"),
            ("NV-DEMO-005", "Võ Ngọc Diễm", "Phòng Tuyển sinh", "Chuyên viên tuyển sinh"),
            ("NV-DEMO-006", "Bùi Quốc Khánh", "Thư viện", "Thủ thư"),
            ("NV-DEMO-007", "Đặng Mỹ Linh", "Phòng Công tác sinh viên", "Chuyên viên hồ sơ"),
            ("NV-DEMO-008", "Hồ Anh Tuấn", "Phòng Hành chính", "Chuyên viên hành chính"),
        ]
        for index, (code, full_name, department, position) in enumerate(employee_records, start=1):
            email = f"nhanvien{index:02d}@example.com"
            if (db.scalar(select(Personnel.id).where(Personnel.code == code))
                    or db.scalar(select(Personnel.id).where(Personnel.email == email))):
                continue
            db.add(Personnel(code=code, kind="employee", full_name=full_name,
                             email=email, phone=f"090600{index:04d}",
                             date_of_birth=date(1985 + index % 10, index % 12 + 1, index % 27 + 1),
                             gender="Nữ" if index % 2 else "Nam", address=SAMPLE_ADDRESSES[(index + 2) % len(SAMPLE_ADDRESSES)],
                             department=department, position=position, start_date=date(2018 + index % 7, 3, 15),
                             work_status="Đã nghỉ việc" if index == 8 else "Đang công tác",
                             notes="Hồ sơ mẫu.", is_demo=True))

        if not db.scalar(select(Applicant.id).where(Applicant.email == "ngoc.mai@example.edu.vn")):
            db.add(Applicant(email="ngoc.mai@example.edu.vn", full_name="Phạm Ngọc Mai", phone="0900000012",
                             desired_major_id=majors["Marketing"].id, admission_method="Học bạ (demo)", status="Đang xét duyệt"))
        if not db.scalar(select(SupportTicket.id).where(SupportTicket.code == "ST-DEMO1001")):
            db.add(SupportTicket(code="ST-DEMO1001", owner_id=student_user.id, category="Hồ sơ sinh viên",
                                 subject="Xác nhận thông tin lớp hành chính", description="Em muốn xác nhận lớp hành chính của mình.",
                                 priority="Bình thường", status="Đang xử lý", assignee_id=support_user.id))
        ticket_samples = [
            ("ST-DEMO1002", "Tư vấn hồ sơ tuyển sinh", "Tuyển sinh", "Mới tiếp nhận"),
            ("ST-DEMO1003", "Xác nhận học phí", "Học phí và tài chính", "Chờ bổ sung thông tin"),
            ("ST-DEMO1004", "Xin giấy xác nhận sinh viên", "Giấy tờ và xác nhận", "Đã giải quyết"),
            ("ST-DEMO1005", "Không đăng nhập được cổng sinh viên", "Tài khoản và công nghệ", "Đang xử lý"),
            ("ST-DEMO1006", "Hỏi lịch đăng ký học phần", "Đào tạo và học tập", "Đã đóng"),
        ]
        for code, subject, category, status in ticket_samples:
            if not db.scalar(select(SupportTicket.id).where(SupportTicket.code == code)):
                db.add(SupportTicket(code=code, owner_id=student_user.id, category=category, subject=subject,
                                     description="Yêu cầu mẫu để minh họa quy trình hỗ trợ.", priority="Bình thường",
                                     status=status, assignee_id=support_user.id if status != "Mới tiếp nhận" else None))
        now = datetime.now(timezone.utc)
        demo_study_tasks = [
            ("Nộp bài tập lớn Cấu trúc dữ liệu & Giải thuật", "Cấu trúc dữ liệu & Giải thuật", "assignment", now + timedelta(days=3), "high", "Cài đặt cây nhị phân tìm kiếm AVL và báo cáo benchmark."),
            ("Thi kết thúc học phần Cơ sở dữ liệu", "Cơ sở dữ liệu", "exam", now + timedelta(days=10), "high", "Phạm vi: Chuẩn hóa 3NF, BCNF, viết truy vấn SQL nâng cao và tối ưu chỉ mục."),
            ("Quiz trắc nghiệm Lý thuyết Mạng máy tính", "Mạng máy tính", "quiz", now + timedelta(days=5), "medium", "Kiểm tra 30 câu mô hình OSI, giao thức TCP/UDP và định tuyến IP."),
            ("Báo cáo tiến độ Đồ án Công nghệ phần mềm", "Công nghệ phần mềm", "project", now + timedelta(days=14), "medium", "Nộp tài liệu SRS và bản vẽ thiết kế kiến trúc Figma."),
            ("Thi giữa kỳ môn Lập trình Web nâng cao", "Lập trình Web nâng cao", "exam", now + timedelta(days=18), "high", "Thi thực hành xây dựng RESTful API với Next.js và FastAPI."),
        ]
        for title, course, t_type, due, priority, notes in demo_study_tasks:
            if not db.scalar(select(StudyTask.id).where(StudyTask.user_id == student_user.id, StudyTask.title == title)):
                db.add(StudyTask(
                    user_id=student_user.id,
                    title=title,
                    course_name=course,
                    task_type=t_type,
                    due_date=due,
                    priority=priority,
                    notes=notes,
                    status="pending",
                ))

        for question, answer, category in FAQ_DATA:
            if not db.scalar(select(FAQ.id).where(FAQ.question == question)):
                db.add(FAQ(question=question, answer=answer, category=category, is_published=True))
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
