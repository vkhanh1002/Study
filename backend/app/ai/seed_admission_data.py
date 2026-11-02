import json
import logging
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models import (
    AdmissionProgram, AdmissionScore, Department, FAQ, FaqItem,
    KnowledgeChunk, KnowledgeDocument, TuitionFee, User
)

logger = logging.getLogger(__name__)

DEPARTMENTS_DATA = [
    {
        "name": "Phòng Quản lý Đào tạo",
        "code": "QLDT_NEU",
        "description": "Quản lý kế hoạch giảng dạy, thời khóa biểu, đăng ký học phần tín chỉ trực tuyến, tổ chức thi kết thúc học phần và xét tốt nghiệp sinh viên.",
        "email": "daotao@neu.edu.vn",
        "phone": "024.3628.0280 (máy lẻ 5210, 5211)",
        "location": "Phòng 210, Tòa nhà Trung tâm Đào tạo (Tòa nhà Thế kỷ A1), 207 Giải Phóng, Hai Bà Trưng, Hà Nội",
        "office_hours": "Thứ 2 - Thứ 6: 08:00 - 11:30 & 13:30 - 17:00",
    },
    {
        "name": "Trung tâm Tư vấn Tuyển sinh & Hướng nghiệp",
        "code": "TS_NEU",
        "description": "Tư vấn đề án tuyển sinh đại học chính quy, chương trình Tiên tiến & Chất lượng cao AEP, POHE, hướng dẫn xét tuyển sớm và tiếp nhận hồ sơ nhập học.",
        "email": "tuyensinh@neu.edu.vn",
        "phone": "024.3628.0280 (máy lẻ 5212) - Hotline: 0926.888.207",
        "location": "Sảnh tầng 1, Tòa nhà Trung tâm Đào tạo (Tòa nhà Thế kỷ A1)",
        "office_hours": "Thứ 2 - Thứ 7: 08:00 - 17:30 (Mùa tuyển sinh trực hỗ trợ 24/7 online)",
    },
    {
        "name": "Phòng Công tác Chính trị & Quản lý sinh viên",
        "code": "CTCTQLSV_NEU",
        "description": "Cấp giấy xác nhận sinh viên (hoãn NVQS, vay vốn ngân hàng, ưu đãi xe buýt), cấp phát thẻ sinh viên tích hợp thẻ thư viện, xét học bổng khuyến khích học tập, quản lý điểm rèn luyện và CLB sinh viên.",
        "email": "phongctctqlsv@neu.edu.vn",
        "phone": "024.3628.0280 (máy lẻ 5105)",
        "location": "Phòng 105, Tòa nhà Trung tâm Đào tạo (Tòa nhà Thế kỷ A1)",
        "office_hours": "Thứ 2 - Thứ 6: 08:00 - 11:30 & 13:30 - 17:00",
    },
    {
        "name": "Phòng Tài chính - Kế toán",
        "code": "TCKT_NEU",
        "description": "Tổ chức thu học phí trực tuyến qua cổng thanh toán liên kết ngân hàng, giải quyết các chính sách miễn giảm học phí và chi trả học bổng cho sinh viên.",
        "email": "taichinhketoan@neu.edu.vn",
        "phone": "024.3628.0280 (máy lẻ 5109)",
        "location": "Phòng 109, Tòa nhà Trung tâm Đào tạo (Tòa nhà Thế kỷ A1)",
        "office_hours": "Thứ 2 - Thứ 6: 08:00 - 11:30 & 13:30 - 16:30",
    },
    {
        "name": "Thư viện Phạm Văn Đồng (NEU Library)",
        "code": "LIB_NEU",
        "description": "Không gian tự học hiện đại nhiều tầng, trang bị hệ thống máy tính tra cứu, phòng tự học yên tĩnh, mượn trả tài liệu giáo trình và kho dữ liệu điện tử NEU Reader.",
        "email": "thuvien@neu.edu.vn",
        "phone": "024.3628.0280 (máy lẻ 5301)",
        "location": "Tòa nhà Thư viện Trung tâm (cạnh Tòa nhà Thế kỷ A1)",
        "office_hours": "Thứ 2 - Thứ 7: 07:30 - 21:00; Chủ nhật: 08:00 - 17:00",
    },
    {
        "name": "Ban Quản lý Ký túc xá NEU",
        "code": "KTX_NEU",
        "description": "Tiếp nhận hồ sơ nội trú, bố trí phòng ở sinh viên có điều hòa, bình nóng lạnh, đảm bảo an ninh trật tự, căng tin sinh viên và phòng tự học nội khu.",
        "email": "ktx@neu.edu.vn",
        "phone": "024.3869.4079",
        "location": "Khu Ký túc xá Đại học Kinh tế Quốc dân (cổng phía đường Trần Đại Nghĩa / ngõ Tự Do)",
        "office_hours": "Ban quản lý: 07:30 - 17:30; Trực ban an ninh 24/24",
    },
    {
        "name": "Trung tâm Ứng dụng Công nghệ Thông tin (CAIT)",
        "code": "CAIT_NEU",
        "description": "Quản trị hệ thống máy chủ, cấp phát tài khoản email sinh viên @neu.edu.vn, hệ thống LMS courses.neu.edu.vn, hệ thống tín chỉ tinchi.neu.edu.vn và đường truyền mạng NEU.",
        "email": "cait@neu.edu.vn",
        "phone": "024.3628.0280 (máy lẻ 5401)",
        "location": "Tầng 3, Tòa nhà Trung tâm Đào tạo (Nhà A1)",
        "office_hours": "Thứ 2 - Thứ 6: 08:00 - 17:30",
    },
]

PROGRAMS_NEU = [
    {
        "major_code": "7340115",
        "name": "Logistics và Quản lý chuỗi cung ứng",
        "program_type": "Chuẩn",
        "quota": 250,
        "methods": ["THPT", "KetHopIELTS", "DGNL_HSA", "DGTD_TSA", "XetTuyenThang"],
        "subject_groups": "A00, A01, D01, D07",
        "year": 2026,
        "note": "Ngành có điểm chuẩn dẫn đầu trường liên tục nhiều năm, nhu cầu nhân lực quốc tế lớn.",
    },
    {
        "major_code": "7340302",
        "name": "Kiểm toán",
        "program_type": "Chuẩn",
        "quota": 280,
        "methods": ["THPT", "KetHopIELTS", "DGNL_HSA", "DGTD_TSA", "XetTuyenThang"],
        "subject_groups": "A00, A01, D01, D07",
        "year": 2026,
        "note": "Ngành đào tạo truyền thống top 1 cả nước về kiểm toán, tỉ lệ việc làm cao tại các hãng Big 4.",
    },
    {
        "major_code": "7340120",
        "name": "Marketing (Quản trị Marketing)",
        "program_type": "Chuẩn",
        "quota": 260,
        "methods": ["THPT", "KetHopIELTS", "DGNL_HSA", "DGTD_TSA"],
        "subject_groups": "A00, A01, D01, D07",
        "year": 2026,
        "note": "Ngành đào tạo chuyên sâu marketing số, truyền thông thương hiệu và quản trị khách hàng.",
    },
    {
        "major_code": "7340122",
        "name": "Thương mại điện tử",
        "program_type": "Chuẩn",
        "quota": 200,
        "methods": ["THPT", "KetHopIELTS", "DGNL_HSA", "DGTD_TSA"],
        "subject_groups": "A00, A01, D01, D07",
        "year": 2026,
        "note": "Kết hợp quản trị kinh doanh, mô hình nền tảng số và thanh toán điện tử thời đại công nghệ số.",
    },
    {
        "major_code": "7480107",
        "name": "Trí tuệ nhân tạo (AI) trong Kinh doanh",
        "program_type": "Tiên tiến (AEP)",
        "quota": 150,
        "methods": ["KetHopIELTS", "DGNL_HSA", "DGTD_TSA", "THPT"],
        "subject_groups": "A00, A01, D01, D07",
        "year": 2026,
        "note": "Chương trình tiên tiến giảng dạy bằng tiếng Anh, ứng dụng GenAI, LLMs và thuật toán tự động hóa trong quản trị.",
    },
    {
        "major_code": "7480108",
        "name": "Khoa học dữ liệu trong Kinh tế & Kinh doanh (DSEB)",
        "program_type": "Tiên tiến (AEP)",
        "quota": 150,
        "methods": ["KetHopIELTS", "DGNL_HSA", "DGTD_TSA", "THPT"],
        "subject_groups": "A00, A01, D01, D07",
        "year": 2026,
        "note": "Đào tạo chuyên gia Big Data, Machine Learning và mô hình định lượng phân tích thị trường kinh tế tài chính.",
    },
    {
        "major_code": "7340120",
        "name": "Kinh doanh quốc tế",
        "program_type": "Chuẩn",
        "quota": 300,
        "methods": ["THPT", "KetHopIELTS", "DGNL_HSA", "DGTD_TSA", "XetTuyenThang"],
        "subject_groups": "A00, A01, D01, D07",
        "year": 2026,
        "note": "Đào tạo chuyên môn thương mại quốc tế, đầu tư đa quốc gia và đàm phán hợp đồng thương mại quốc tế.",
    },
    {
        "major_code": "7340201",
        "name": "Tài chính - Ngân hàng",
        "program_type": "Chuẩn",
        "quota": 350,
        "methods": ["THPT", "KetHopIELTS", "DGNL_HSA", "DGTD_TSA", "XetTuyenThang"],
        "subject_groups": "A00, A01, D01, D07",
        "year": 2026,
        "note": "Khối ngành cốt lõi của NEU về ngân hàng thương mại, thị trường vốn, đầu tư chứng khoán và quản trị tài chính.",
    },
]

SCORES_NEU = [
    # 2025 THPT (Thang 30)
    {"program_code": "7340115", "program_name": "Logistics và Quản lý chuỗi cung ứng", "year": 2025, "method": "Điểm thi THPT", "score": 28.30, "scale": 30, "note": "Tiêu chí phụ: Điểm môn Toán >= 8.8"},
    {"program_code": "7340302", "program_name": "Kiểm toán", "year": 2025, "method": "Điểm thi THPT", "score": 28.15, "scale": 30, "note": "Tiêu chí phụ: Điểm môn Toán >= 8.6"},
    {"program_code": "7340120", "program_name": "Kinh doanh quốc tế", "year": 2025, "method": "Điểm thi THPT", "score": 28.10, "scale": 30, "note": "Tiêu chí phụ: Điểm Tiếng Anh >= 8.8"},
    {"program_code": "7340120", "program_name": "Marketing (Quản trị Marketing)", "year": 2025, "method": "Điểm thi THPT", "score": 28.00, "scale": 30, "note": "Tiêu chí phụ: Điểm môn Toán >= 8.4"},
    {"program_code": "7340122", "program_name": "Thương mại điện tử", "year": 2025, "method": "Điểm thi THPT", "score": 27.90, "scale": 30, "note": "Tổ hợp A00, A01, D01, D07"},
    {"program_code": "7480107", "program_name": "Trí tuệ nhân tạo (AI) trong Kinh doanh", "year": 2025, "method": "Điểm thi THPT", "score": 27.85, "scale": 30, "note": "Chương trình Tiên tiến AEP"},
    {"program_code": "7480108", "program_name": "Khoa học dữ liệu trong Kinh tế & Kinh doanh (DSEB)", "year": 2025, "method": "Điểm thi THPT", "score": 27.60, "scale": 30, "note": "Tiêu chí phụ: Điểm môn Toán >= 8.6"},
    {"program_code": "7340201", "program_name": "Tài chính - Ngân hàng", "year": 2025, "method": "Điểm thi THPT", "score": 27.40, "scale": 30, "note": "Tổ hợp A00, A01, D01, D07"},

    # 2025 ĐGNL HSA (Thang 150)
    {"program_code": "7340115", "program_name": "Logistics và Quản lý chuỗi cung ứng", "year": 2025, "method": "ĐGNL HSA (ĐHQGHN)", "score": 115.5, "scale": 150, "note": "Quy đổi theo công thức Đề án NEU"},
    {"program_code": "7340302", "program_name": "Kiểm toán", "year": 2025, "method": "ĐGNL HSA (ĐHQGHN)", "score": 114.0, "scale": 150, "note": "Quy đổi theo công thức Đề án NEU"},
    {"program_code": "7340120", "program_name": "Marketing (Quản trị Marketing)", "year": 2025, "method": "ĐGNL HSA (ĐHQGHN)", "score": 113.5, "scale": 150, "note": "Quy đổi theo công thức Đề án NEU"},
    {"program_code": "7480107", "program_name": "Trí tuệ nhân tạo (AI) trong Kinh doanh", "year": 2025, "method": "ĐGNL HSA (ĐHQGHN)", "score": 112.5, "scale": 150, "note": "Quy đổi theo công thức Đề án NEU"},
    {"program_code": "7480108", "program_name": "Khoa học dữ liệu trong Kinh tế & Kinh doanh (DSEB)", "year": 2025, "method": "ĐGNL HSA (ĐHQGHN)", "score": 112.0, "scale": 150, "note": "Quy đổi theo công thức Đề án NEU"},

    # 2024 THPT (Thang 30)
    {"program_code": "7340115", "program_name": "Logistics và Quản lý chuỗi cung ứng", "year": 2024, "method": "Điểm thi THPT", "score": 28.10, "scale": 30, "note": ""},
    {"program_code": "7340302", "program_name": "Kiểm toán", "year": 2024, "method": "Điểm thi THPT", "score": 28.00, "scale": 30, "note": ""},
    {"program_code": "7340120", "program_name": "Marketing (Quản trị Marketing)", "year": 2024, "method": "Điểm thi THPT", "score": 27.80, "scale": 30, "note": ""},
    {"program_code": "7340122", "program_name": "Thương mại điện tử", "year": 2024, "method": "Điểm thi THPT", "score": 27.65, "scale": 30, "note": ""},
    {"program_code": "7480107", "program_name": "Trí tuệ nhân tạo (AI) trong Kinh doanh", "year": 2024, "method": "Điểm thi THPT", "score": 27.50, "scale": 30, "note": ""},
    {"program_code": "7480108", "program_name": "Khoa học dữ liệu trong Kinh tế & Kinh doanh (DSEB)", "year": 2024, "method": "Điểm thi THPT", "score": 27.30, "scale": 30, "note": ""},
]

TUITION_NEU = [
    {
        "program_code": "NEU_STANDARD",
        "program_name": "Chương trình Đại học Chuẩn (NEU Standard)",
        "cohort": "Khóa 64, 65, 66, 67",
        "academic_year": "2025-2026",
        "per_credit_vnd": 720000,
        "per_year_vnd": 24000000,
        "note": "Học phí chương trình chuẩn dao động khoảng 20 - 25 triệu đồng/năm học tùy số tín chỉ đăng ký (trung bình 650.000 - 750.000 đ/tín chỉ).",
    },
    {
        "program_code": "NEU_AEP",
        "program_name": "Chương trình Tiên tiến & Chất lượng cao (AEP - POHE)",
        "cohort": "Khóa 64, 65, 66, 67",
        "academic_year": "2025-2026",
        "per_credit_vnd": 1600000,
        "per_year_vnd": 55000000,
        "note": "Học phí chương trình Tiên tiến & POHE dao động khoảng 45 - 65 triệu đồng/năm học tùy chuyên ngành cụ thể.",
    },
    {
        "program_code": "NEU_ISME",
        "program_name": "Chương trình Cử nhân Quốc tế (IBD - Viện Đào tạo Quốc tế ISME)",
        "cohort": "Khóa 2024, 2025, 2026",
        "academic_year": "2025-2026",
        "per_credit_vnd": 0,
        "per_year_vnd": 85000000,
        "note": "Học phí thu theo kỳ theo thỏa thuận hợp tác với trường đại học đối tác nước ngoài (Anh Quốc).",
    },
]

FAQ_NEU = [
    {
        "question": "Thí sinh có chứng chỉ IELTS 6.5 trở lên thì được xét tuyển vào NEU theo phương thức nào?",
        "answer": "Thí sinh có chứng chỉ IELTS từ 5.5 trở lên (hoặc TOEFL iBT tương đương) còn hạn sử dụng được xét tuyển theo Phương thức Xét tuyển kết hợp của NEU. Điểm xét tuyển = Điểm IELTS quy đổi + Điểm môn Toán THPT + Điểm 01 môn tổ hợp khác (không phải Tiếng Anh) + Điểm ưu tiên (nếu có). Trong đó, IELTS 6.5 được quy đổi thành 9.5 điểm trong thang điểm xét tuyển của NEU (IELTS 7.0 trở lên quy đổi 10 điểm).",
        "category": "Tuyển sinh",
        "audience": "tuyen_sinh",
    },
    {
        "question": "Đại học Kinh tế Quốc dân (NEU) có mấy tòa nhà và cơ sở vật chất thế nào?",
        "answer": "Đại học Kinh tế Quốc dân (NEU) tọa lạc tại 207 Giải Phóng, Đồng Tâm, Hai Bà Trưng, Hà Nội. Khuôn viên trường nổi tiếng với Tòa nhà Trung tâm Đào tạo (Tòa nhà Thế kỷ A1) kiến trúc xoắn ốc mái vòm hiện đại bậc nhất, Hội trường lớn A2, Thư viện Phạm Văn Đồng, Nhà văn hóa, Khu giảng đường B, C, D, Ký túc xá NEU và hệ thống bãi xe hiện đại (hầm xe Tòa A1, nhà để xe cổng Giải Phóng và cổng Trần Đại Nghĩa).",
        "category": "Cơ sở vật chất",
        "audience": "chung",
    },
    {
        "question": "Quy chế xin hoãn thi hoặc bảo lưu kết quả học tập tại NEU như thế nào?",
        "answer": "Sinh viên có lý do chính đáng (ốm đau đột xuất có xác nhận bệnh viện, hoàn cảnh đặc biệt hoặc tham gia kỳ thi quốc gia) nộp đơn xin hoãn thi trực tuyến trên Cổng Một cửa (onegate.neu.edu.vn) hoặc nộp đơn trực tiếp tại Phòng Quản lý Đào tạo (Phòng 210, Nhà A1) trước giờ thi hoặc tối đa 03 ngày làm việc sau buổi thi kèm minh chứng hợp lệ.",
        "category": "Học vụ",
        "audience": "sinh_vien",
    },
    {
        "question": "Thủ tục xin cấp Giấy xác nhận sinh viên tại NEU để hoãn nghĩa vụ quân sự hoặc vay vốn ngân hàng?",
        "answer": "Sinh viên truy cập Cổng Dịch vụ một cửa NEU (onegate.neu.edu.vn) hoặc liên hệ Phòng Công tác Chính trị & Quản lý sinh viên (Phòng 105, Nhà A1). Bạn đăng nhập bằng tài khoản sinh viên NEU, chọn loại giấy tờ cần cấp (xác nhận sinh viên hoãn NVQS, vay vốn, làm vé xe buýt). Nhà trường cấp bản điện tử có mã QR xác thực hoặc nhận bản cứng tại Phòng 105 sau 1-2 ngày làm việc.",
        "category": "Thủ tục",
        "audience": "sinh_vien",
    },
    {
        "question": "Điều kiện để sinh viên NEU được đăng ký học vượt hoặc tốt nghiệp sớm?",
        "answer": "Sinh viên có điểm trung bình chung tích lũy (GPA) từ 2.50 trở lên và không trong thời gian bị kỷ luật được phép đăng ký tối đa 24 tín chỉ trong mỗi học kỳ chính để học vượt, rút ngắn thời gian đào tạo từ 4 năm xuống còn 3 hoặc 3.5 năm. Sinh viên đăng ký qua hệ thống tín chỉ tinchi.neu.edu.vn theo khung thời gian của Phòng Quản lý Đào tạo.",
        "category": "Học vụ",
        "audience": "sinh_vien",
    },
]


def seed_admission_and_departments(db: Session):
    admin = db.scalars(select(User).where(User.role == "super_admin")).first()
    admin_id = admin.id if admin else "system-admin"

    # Xóa sạch dữ liệu tuyển sinh cũ
    db.query(AdmissionScore).delete()
    db.query(AdmissionProgram).delete()
    db.query(TuitionFee).delete()
    db.query(FaqItem).delete()
    db.query(Department).delete()
    db.commit()

    # Seed Departments NEU
    for d in DEPARTMENTS_DATA:
        dept = Department(**d)
        db.add(dept)
    db.commit()

    # Seed Programs NEU
    for p in PROGRAMS_NEU:
        prog = AdmissionProgram(**p)
        db.add(prog)
    db.commit()

    # Seed Scores NEU
    for s in SCORES_NEU:
        score = AdmissionScore(**s)
        db.add(score)
    db.commit()

    # Seed Tuition Fees NEU
    for t in TUITION_NEU:
        fee = TuitionFee(**t)
        db.add(fee)
    db.commit()

    # Seed FAQ Items NEU
    for f in FAQ_NEU:
        item = FaqItem(**f)
        db.add(item)
    db.commit()

    logger.info("Successfully seeded structured NEU Admission, Scores, Tuition, Departments, and FAQ items!")


if __name__ == "__main__":
    db = SessionLocal()
    seed_admission_and_departments(db)
    print("NEU Study Seed finished successfully!")
