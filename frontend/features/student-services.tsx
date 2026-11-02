"use client";

import { useState } from "react";
import {
  Award,
  BookOpen,
  Building2,
  Calculator,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileCheck,
  FileDown,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  HelpCircle,
  Info,
  Mail,
  MapPin,
  Phone,
  Printer,
  Sparkles,
  UserCheck
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

// ==================== DỮ LIỆU BIỂU MẪU ====================
interface FormTemplate {
  id: string;
  code: string;
  title: string;
  department: string;
  location: string;
  processingTime: string;
  description: string;
  requiredDocs: string[];
  templateGenerator: (data: FormInputData) => string;
}

interface FormInputData {
  fullName: string;
  studentId: string;
  className: string;
  major: string;
  phone: string;
  email: string;
  reason: string;
  targetTerm?: string;
  courseName?: string;
}

const FORM_TEMPLATES: FormTemplate[] = [
  {
    id: "xac-nhan-sinh-vien",
    code: "BM-CTSV-01",
    title: "Đơn xin cấp Giấy xác nhận sinh viên",
    department: "Phòng Công tác Chính trị & Quản lý sinh viên",
    location: "Phòng 105, Tòa nhà Thế kỷ (Nhà A1)",
    processingTime: "01 ngày làm việc (Cấp trực tuyến có mã QR)",
    description: "Sử dụng để hoãn nghĩa vụ quân sự, làm hồ sơ vay vốn Ngân hàng Chính sách xã hội, làm vé tháng xe buýt hoặc bổ sung hồ sơ gia đình.",
    requiredDocs: ["Thẻ sinh viên / CCCD gắn chip", "Không bị kỷ luật đình chỉ học tập"],
    templateGenerator: (d) => `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
-------------------------
ĐƠN XIN CẤP GIẤY XÁC NHẬN SINH VIÊN

Kính gửi: 
- Ban Giám hiệu Trường Đại học Kinh tế Quốc dân (NEU);
- Phòng Công tác Chính trị & Quản lý sinh viên (Phòng 105 - Nhà A1).

Tên em là: ${d.fullName || "...................................................."}
Mã số sinh viên: ${d.studentId || "........................................"}
Lớp chuyên ngành: ${d.className || "......................................"}
Khóa: ${d.className ? d.className.replace(/\D/g, "") : "........"}  -  Khoa/Viện: ${d.major || "......................................."}
Số điện thoại liên hệ: ${d.phone || ".................................."}  -  Email: ${d.email || "...................................."}

Nay em làm đơn này kính xin Nhà trường cấp cho em 01 Giấy xác nhận sinh viên.
Lý do xin cấp: ${d.reason || "Bổ sung hồ sơ hoãn nghĩa vụ quân sự / vay vốn học tập."}

Em cam đoan các thông tin khai báo trên là hoàn toàn chính xác.
Kính mong Nhà trường xem xét và giải quyết.

Hà Nội, ngày ..... tháng ..... năm 2026
Người làm đơn
(Ký và ghi rõ họ tên)`
  },
  {
    id: "hoan-thi",
    code: "BM-QLDT-02",
    title: "Đơn xin hoãn thi kết thúc học phần",
    department: "Phòng Quản lý Đào tạo & Khảo thí",
    location: "Phòng 210, Tòa nhà Thế kỷ (Nhà A1)",
    processingTime: "02 - 03 ngày làm việc",
    description: "Dành cho sinh viên gặp lý do bất khả kháng (sức khỏe cấp cứu, hoàn cảnh gia đình đột xuất hoặc trùng lịch thi quốc gia) cần hoãn thi sang kỳ phụ.",
    requiredDocs: ["Giấy xác nhận nằm viện / bệnh án từ cấp huyện trở lên", "Lịch thi bị trùng hoặc minh chứng hợp lệ"],
    templateGenerator: (d) => `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
-------------------------
ĐƠN XIN HOÃN THI KẾT THÚC HỌC PHẦN

Kính gửi:
- Phòng Quản lý Đào tạo - Trường Đại học Kinh tế Quốc dân;
- Giảng viên phụ trách học phần.

Em tên là: ${d.fullName || "...................................................."}
Mã số sinh viên: ${d.studentId || "........................................"}
Lớp sinh hoạt: ${d.className || "........................................"}  -  Ngành: ${d.major || "......................................."}
Điện thoại: ${d.phone || ".................................................."}

Em xin phép được hoãn thi học phần: ${d.courseName || "...................................................."}
Mã lớp học phần: .......................................  Thời gian thi: ..................... Ca thi: .........
Học kỳ: ${d.targetTerm || "Kỳ 2 năm học 2025 - 2026"}
Lý do xin hoãn thi: ${d.reason || "Lý do sức khỏe đột xuất (kèm giấy chứng nhận viện)."}

Em xin cam kết sẽ tham gia thi bù vào đợt thi học phần tiếp theo do Nhà trường tổ chức.
Hồ sơ minh chứng đính kèm gồm có: ....................................................

Hà Nội, ngày ..... tháng ..... năm 2026
Người làm đơn
(Ký và ghi rõ họ tên)`
  },
  {
    id: "bao-luu",
    code: "BM-QLDT-03",
    title: "Đơn xin tạm dừng học tập (Bảo lưu học kỳ)",
    department: "Phòng Quản lý Đào tạo",
    location: "Phòng 210, Tòa nhà Thế kỷ (Nhà A1)",
    processingTime: "05 ngày làm việc",
    description: "Sinh viên có nguyện vọng tạm dừng tiến độ học tập 01 - 02 học kỳ vì lý do sức khỏe, tham gia nghĩa vụ quân sự hoặc hoàn cảnh cá nhân đặc biệt.",
    requiredDocs: ["Đơn bảo lưu có chữ ký phụ huynh", "Bệnh án y tế hoặc Lệnh gọi NVQS", "Bảng điểm tích lũy đến kỳ gần nhất"],
    templateGenerator: (d) => `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
-------------------------
ĐƠN XIN TẠM DỪNG HỌC TẬP VÀ BẢO LƯU KẾT QUẢ

Kính gửi:
- Ban Giám hiệu Trường Đại học Kinh tế Quốc dân;
- Phòng Quản lý Đào tạo;
- Ban Chủ nhiệm Khoa/Viện: ${d.major || "......................................."}

Tên em là: ${d.fullName || "...................................................."}
MSSV: ${d.studentId || "...................................................."}  -  Lớp: ${d.className || "...................................."}
Địa chỉ thường trú: ............................................................................
Số điện thoại: ${d.phone || ".................................................."}

Em kính xin Nhà trường cho phép em được tạm dừng học tập trong thời gian:
Từ học kỳ: ................................. Đến hết học kỳ: ................................
Lý do tạm dừng: ${d.reason || "Hoàn cảnh gia đình / điều trị sức khỏe theo chỉ định y tế."}

Ý kiến của Phụ huynh học sinh:                     Hà Nội, ngày ..... tháng ..... năm 2026
(Ký và ghi rõ họ tên)                                              Người làm đơn
                                                                (Ký và ghi rõ họ tên)`
  },
  {
    id: "phuc-khao",
    code: "BM-KT-04",
    title: "Đơn xin phúc khảo điểm thi kết thúc học phần",
    department: "Phòng Quản lý Đào tạo & Khảo thí",
    location: "Phòng 210, Tòa nhà Thế kỷ (Nhà A1)",
    processingTime: "07 ngày làm việc sau khi hết hạn nhận đơn",
    description: "Nộp trong vòng 07 ngày làm việc kể từ ngày công bố điểm thi chính thức trên cổng thông tin người học nếu có thắc mắc về kết quả chấm.",
    requiredDocs: ["Bản in điểm thi trên hệ thống", "Lệ phí phúc khảo theo quy chế NEU"],
    templateGenerator: (d) => `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
-------------------------
ĐƠN XIN PHÚC KHẢO ĐIỂM THI

Kính gửi:
- Phòng Quản lý Đào tạo & Khảo thí - Đại học Kinh tế Quốc dân.

Em tên là: ${d.fullName || "...................................................."}
Mã sinh viên: ${d.studentId || "............................................"}  -  Lớp: ${d.className || "...................................."}
Khoa/Viện: ${d.major || "...................................................."}  -  Số ĐT: ${d.phone || "................................"}

Em xin phúc khảo điểm thi môn: ${d.courseName || "...................................................."}
Mã học phần: ..............................................  Phòng thi: ....................... Số báo danh: .........
Ngày thi: ....................................................  Ca thi: ...........................
Điểm đã công bố: .......................................  Hình thức thi: (Tự luận / Trắc nghiệm / Vấn đáp)
Lý do xin phúc khảo: ${d.reason || "Đối chiếu đáp án thấy bài làm có khả năng đạt điểm cao hơn kết quả công bố."}

Kính đề nghị Nhà trường xem xét chấm lại bài thi giúp em.

Hà Nội, ngày ..... tháng ..... năm 2026
Người làm đơn
(Ký và ghi rõ họ tên)`
  },
  {
    id: "thuc-tap",
    code: "BM-CTSV-05",
    title: "Giấy giới thiệu liên hệ thực tập tốt nghiệp",
    department: "Phòng Công tác Chính trị & Quản lý sinh viên",
    location: "Phòng 105, Nhà A1",
    processingTime: "02 ngày làm việc",
    description: "Dành cho sinh viên năm 3, năm 4 đi thực tập doanh nghiệp, nghiên cứu đề tài khóa luận hoặc chuyên đề tốt nghiệp.",
    requiredDocs: ["Bảng điểm tích lũy", "Giấy tiếp nhận sơ bộ của cơ quan/doanh nghiệp (nếu có)"],
    templateGenerator: (d) => `TRƯỜNG ĐẠI HỌC KINH TẾ QUỐC DÂN        CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
PHÒNG CÔNG TÁC CHÍNH TRỊ & QLSV          Độc lập - Tự do - Hạnh phúc
Số: ...... /GGT-NEU                                    -------------------------

GIẤY GIỚI THIỆU THỰC TẬP TỐT NGHIỆP

Kính gửi Ban Giám đốc: ${d.reason || "Quý Cơ quan / Doanh nghiệp / Tổ chức tín dụng"}

Trường Đại học Kinh tế Quốc dân trân trọng giới thiệu:
Sinh viên: ${d.fullName || "...................................................................."}
Mã số sinh viên: ${d.studentId || "........................................................"}
Lớp chuyên ngành: ${d.className || ".................................................."}  Khóa: ........
Khoa/Viện: ${d.major || "................................................................"}

Được đến Quý cơ quan liên hệ thực tập và nghiên cứu thực tế tốt nghiệp.
Thời gian thực tập: Từ ngày ...../...../2026 đến ngày ...../...../2026.
Nội dung thực tập: Tìm hiểu thực tế quản lý, thu thập số liệu phục vụ Báo cáo chuyên đề tốt nghiệp.

Nhà trường rất mong nhận được sự quan tâm, tạo điều kiện thuận lợi của Quý cơ quan giúp sinh viên hoàn thành tốt đợt thực tập.

Hà Nội, ngày ..... tháng ..... năm 2026
TL. HIỆU TRƯỞNG
TRƯỞNG PHÒNG CTCT & QLSV
(Ký tên và đóng dấu)`
  }
];

export function StudentServices() {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<"forms" | "gpa" | "directory">("forms");

  // State cho Form Generator
  const [selectedForm, setSelectedForm] = useState<FormTemplate>(FORM_TEMPLATES[0]);
  const [formData, setFormData] = useState<FormInputData>({
    fullName: user?.full_name || "",
    studentId: user?.role === "student" ? "11234567" : "",
    className: "Kinh tế đầu tư 65A",
    major: "Kinh tế học & Quản lý",
    phone: "0988.123.456",
    email: user?.email || "",
    reason: "",
    targetTerm: "Học kỳ 2 (2025 - 2026)",
    courseName: "Kinh tế vi mô 2"
  });
  const [generatedText, setGeneratedText] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  // State cho GPA Calculator
  const [creditsEarned, setCreditsEarned] = useState<number>(65);
  const [currentGpa, setCurrentGpa] = useState<number>(3.15);
  const [totalCredits, setTotalCredits] = useState<number>(130);
  const [targetDegree, setTargetDegree] = useState<"xuat_sac" | "gioi" | "kha">("gioi");

  // Xử lý tạo đơn
  const handleGenerateForm = () => {
    const text = selectedForm.templateGenerator(formData);
    setGeneratedText(text);
  };

  const handleCopy = () => {
    if (!generatedText) return;
    navigator.clipboard.writeText(generatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    if (!generatedText) return;
    const blob = new Blob([generatedText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedForm.id}_NEU.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Tính toán GPA dự phóng
  const targetGpaMap = {
    xuat_sac: 3.60,
    gioi: 3.20,
    kha: 2.50
  };
  const targetGpa = targetGpaMap[targetDegree];
  const creditsRemaining = Math.max(0, totalCredits - creditsEarned);
  const requiredRemainingGpa =
    creditsRemaining > 0
      ? (targetGpa * totalCredits - currentGpa * creditsEarned) / creditsRemaining
      : currentGpa;

  return (
    <div style={{ maxWidth: "1240px", margin: "0 auto", paddingBottom: "60px" }}>
      {/* Top Banner Tiện ích */}
      <div
        style={{
          background: "linear-gradient(135deg, #1e3a8a 0%, #0369a1 100%)",
          borderRadius: "16px",
          padding: "30px 28px",
          color: "#ffffff",
          boxShadow: "0 10px 25px rgba(2, 132, 199, 0.15)",
          marginBottom: "24px"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div style={{ maxWidth: "700px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 12px",
                borderRadius: "999px",
                background: "rgba(255, 255, 255, 0.18)",
                fontSize: "12px",
                fontWeight: 650,
                marginBottom: "12px"
              }}
            >
              <Sparkles size={14} /> TIỆN ÍCH DỊCH VỤ SINH VIÊN NEU STUDY
            </span>
            <h1 style={{ fontSize: "26px", fontWeight: 800, margin: "0 0 8px", lineHeight: 1.3 }}>
              Cổng Dịch vụ Thủ tục & Tiện ích Học vụ
            </h1>
            <p style={{ margin: 0, opacity: 0.9, fontSize: "14.5px", lineHeight: 1.5 }}>
              Bộ công cụ hỗ trợ người học thông minh: Tự động điền biểu mẫu thủ tục hành chính nộp về Tòa nhà Thế kỷ A1,
              công cụ dự phóng GPA tốt nghiệp theo hệ tín chỉ NEU và danh bạ hỗ trợ trực tuyến.
            </p>
          </div>

          {/* Sub tabs */}
          <div style={{ display: "flex", background: "rgba(255,255,255,0.15)", padding: "4px", borderRadius: "12px", gap: "6px" }}>
            <button
              onClick={() => setActiveSubTab("forms")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                fontSize: "13px",
                fontWeight: 650,
                cursor: "pointer",
                background: activeSubTab === "forms" ? "#ffffff" : "transparent",
                color: activeSubTab === "forms" ? "#0369a1" : "#ffffff",
                transition: "all 0.2s"
              }}
            >
              <FileText size={16} /> Biểu mẫu trực tuyến
            </button>
            <button
              onClick={() => setActiveSubTab("gpa")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                fontSize: "13px",
                fontWeight: 650,
                cursor: "pointer",
                background: activeSubTab === "gpa" ? "#ffffff" : "transparent",
                color: activeSubTab === "gpa" ? "#0369a1" : "#ffffff",
                transition: "all 0.2s"
              }}
            >
              <Calculator size={16} /> Dự phóng GPA & Tốt nghiệp
            </button>
            <button
              onClick={() => setActiveSubTab("directory")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                fontSize: "13px",
                fontWeight: 650,
                cursor: "pointer",
                background: activeSubTab === "directory" ? "#ffffff" : "transparent",
                color: activeSubTab === "directory" ? "#0369a1" : "#ffffff",
                transition: "all 0.2s"
              }}
            >
              <Building2 size={16} /> Danh bạ Phòng ban A1
            </button>
          </div>
        </div>
      </div>

      {/* ================= PHÂN HỆ 1: BIỂU MẪU ĐIỆN TỬ ================= */}
      {activeSubTab === "forms" && (
        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "24px" }}>
          {/* Cột trái: Danh sách biểu mẫu */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 4px", color: "#1e293b" }}>
              Danh mục biểu mẫu hành chính NEU
            </h3>
            {FORM_TEMPLATES.map((item) => {
              const isSelected = selectedForm.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedForm(item);
                    setGeneratedText("");
                  }}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "12px",
                    background: isSelected ? "#eff6ff" : "#ffffff",
                    border: `1.5px solid ${isSelected ? "#3b82f6" : "#e2e8f0"}`,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    boxShadow: isSelected ? "0 4px 12px rgba(59, 130, 246, 0.12)" : "none"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: isSelected ? "#1d4ed8" : "#64748b", textTransform: "uppercase" }}>
                      {item.code}
                    </span>
                    <span style={{ fontSize: "11px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Clock size={12} /> {item.processingTime.split(" ")[0]} {item.processingTime.split(" ")[1]}
                    </span>
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: isSelected ? "#1e3a8a" : "#1e293b", marginBottom: "4px" }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>
                    {item.department}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cột phải: Form nhập dữ liệu & Preview */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Box thông tin thủ tục */}
            <div style={{ background: "#ffffff", padding: "20px 24px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                <div>
                  <h2 style={{ fontSize: "18px", fontWeight: 750, color: "#0f172a", margin: "0 0 6px" }}>
                    {selectedForm.title}
                  </h2>
                  <p style={{ margin: 0, fontSize: "13.5px", color: "#475569" }}>{selectedForm.description}</p>
                </div>
                <span style={{ background: "#f1f5f9", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 650, color: "#334155" }}>
                  {selectedForm.code}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px", color: "#334155", background: "#f8fafc", padding: "12px", borderRadius: "10px" }}>
                <div><strong>🏢 Nơi tiếp nhận:</strong> {selectedForm.location}</div>
                <div><strong>⏱️ Thời gian xử lý:</strong> {selectedForm.processingTime}</div>
                <div style={{ gridColumn: "span 2" }}>
                  <strong>📋 Hồ sơ kèm theo:</strong> {selectedForm.requiredDocs.join(" · ")}
                </div>
              </div>
            </div>

            {/* Form điền thông tin */}
            <div style={{ background: "#ffffff", padding: "20px 24px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "#0f172a" }}>
                  Điền thông tin sinh viên để phát sinh đơn
                </h3>
                {user && (
                  <span style={{ fontSize: "12px", color: "#059669", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <CheckCircle2 size={14} /> Đã đồng bộ từ tài khoản {user.full_name}
                  </span>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>Họ và tên sinh viên</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="Nguyễn Văn A"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13.5px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>Mã sinh viên (MSSV)</label>
                  <input
                    type="text"
                    value={formData.studentId}
                    onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                    placeholder="11234567"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13.5px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>Lớp chuyên ngành</label>
                  <input
                    type="text"
                    value={formData.className}
                    onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                    placeholder="Logistics 65A"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13.5px" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>Khoa / Viện / Chuyên ngành</label>
                  <input
                    type="text"
                    value={formData.major}
                    onChange={(e) => setFormData({ ...formData, major: e.target.value })}
                    placeholder="Khoa Quản trị Kinh doanh"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13.5px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>Số điện thoại liên hệ</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="0988xxxxxx"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13.5px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>Môn học / Kỳ học liên quan</label>
                  <input
                    type="text"
                    value={formData.courseName}
                    onChange={(e) => setFormData({ ...formData, courseName: e.target.value })}
                    placeholder="Kinh tế vi mô 2"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13.5px" }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>Lý do cụ thể / Nội dung đề đạt</label>
                <textarea
                  rows={2}
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Ví dụ: Xin giấy xác nhận để hoàn thiện hồ sơ hoãn NVQS năm 2026 tại địa phương..."
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13.5px", resize: "vertical" }}
                />
              </div>

              <button
                onClick={handleGenerateForm}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 22px",
                  borderRadius: "10px",
                  background: "#1d4ed8",
                  color: "#ffffff",
                  fontWeight: 650,
                  fontSize: "14px",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(29, 78, 216, 0.25)"
                }}
              >
                <Sparkles size={16} /> Tạo và xem trước bản thảo đơn
              </button>
            </div>

            {/* Khung bản thảo xem trước */}
            {generatedText && (
              <div style={{ background: "#ffffff", padding: "20px 24px", borderRadius: "14px", border: "1px solid #bfdbfe", boxShadow: "0 6px 20px rgba(59, 130, 246, 0.08)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#1e3a8a", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <FileCheck size={18} /> Bản thảo đơn hoàn chỉnh
                  </span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={handleCopy}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        background: copied ? "#dcfce7" : "#ffffff",
                        color: copied ? "#15803d" : "#334155",
                        fontSize: "12.5px",
                        fontWeight: 600,
                        cursor: "pointer"
                      }}
                    >
                      {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />} {copied ? "Đã sao chép!" : "Sao chép đơn"}
                    </button>
                    <button
                      onClick={handleDownloadTxt}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 12px",
                        borderRadius: "8px",
                        border: "none",
                        background: "#0284c7",
                        color: "#ffffff",
                        fontSize: "12.5px",
                        fontWeight: 600,
                        cursor: "pointer"
                      }}
                    >
                      <Download size={14} /> Tải tệp văn bản (.txt)
                    </button>
                  </div>
                </div>

                <pre
                  style={{
                    background: "#f8fafc",
                    padding: "20px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    fontFamily: "monospace",
                    fontSize: "13px",
                    lineHeight: "1.6",
                    whiteSpace: "pre-wrap",
                    color: "#0f172a",
                    margin: 0,
                    maxHeight: "360px",
                    overflowY: "auto"
                  }}
                >
                  {generatedText}
                </pre>
                <div style={{ marginTop: "12px", fontSize: "12.5px", color: "#64748b", fontStyle: "italic" }}>
                  💡 Bạn có thể sao chép nội dung trên sang Microsoft Word hoặc Cổng Một cửa trực tuyến (onegate.neu.edu.vn) để nộp về {selectedForm.location}.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= PHÂN HỆ 2: TÍNH ĐIỂM & DỰ PHÓNG GPA ================= */}
      {activeSubTab === "gpa" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          {/* Box nhập liệu tính toán */}
          <div style={{ background: "#ffffff", padding: "24px", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 750, color: "#0f172a", margin: "0 0 16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Calculator size={20} color="#0284c7" /> Công cụ Dự phóng GPA Tốt nghiệp NEU
            </h2>
            <p style={{ fontSize: "13.5px", color: "#475569", margin: "0 0 20px" }}>
              Nhập số tín chỉ và điểm tích lũy hiện tại của bạn để tính toán chính xác mục tiêu điểm trung bình cần đạt trong các kỳ còn lại.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 650, color: "#334155", marginBottom: "6px" }}>
                  Số tín chỉ đã tích lũy hiện tại: <strong>{creditsEarned}</strong> / {totalCredits} tín chỉ
                </label>
                <input
                  type="range"
                  min="0"
                  max={totalCredits}
                  step="1"
                  value={creditsEarned}
                  onChange={(e) => setCreditsEarned(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#0284c7" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 650, color: "#334155", marginBottom: "6px" }}>
                  Điểm GPA tích lũy hiện tại (thang 4.0):
                </label>
                <input
                  type="number"
                  min="0"
                  max="4.0"
                  step="0.05"
                  value={currentGpa}
                  onChange={(e) => setCurrentGpa(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 650, color: "#334155", marginBottom: "6px" }}>
                  Tổng số tín chỉ toàn khóa đào tạo:
                </label>
                <select
                  value={totalCredits}
                  onChange={(e) => setTotalCredits(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13.5px" }}
                >
                  <option value={130}>130 tín chỉ (Chương trình Đại học Chuẩn NEU)</option>
                  <option value={135}>135 tín chỉ (Chương trình Tiên tiến AEP / POHE)</option>
                  <option value={140}>140 tín chỉ (Chương trình Kỹ sư / Song bằng)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 650, color: "#334155", marginBottom: "8px" }}>
                  Mục tiêu xếp loại bằng tốt nghiệp mong muốn:
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                  <button
                    onClick={() => setTargetDegree("xuat_sac")}
                    style={{
                      padding: "10px",
                      borderRadius: "10px",
                      border: `1.5px solid ${targetDegree === "xuat_sac" ? "#854d0e" : "#e2e8f0"}`,
                      background: targetDegree === "xuat_sac" ? "#fef9c3" : "#ffffff",
                      color: "#854d0e",
                      fontWeight: 700,
                      fontSize: "13px",
                      cursor: "pointer"
                    }}
                  >
                    🏆 Xuất sắc (≥ 3.60)
                  </button>
                  <button
                    onClick={() => setTargetDegree("gioi")}
                    style={{
                      padding: "10px",
                      borderRadius: "10px",
                      border: `1.5px solid ${targetDegree === "gioi" ? "#1e40af" : "#e2e8f0"}`,
                      background: targetDegree === "gioi" ? "#dbeafe" : "#ffffff",
                      color: "#1e40af",
                      fontWeight: 700,
                      fontSize: "13px",
                      cursor: "pointer"
                    }}
                  >
                    🥇 Giỏi (≥ 3.20)
                  </button>
                  <button
                    onClick={() => setTargetDegree("kha")}
                    style={{
                      padding: "10px",
                      borderRadius: "10px",
                      border: `1.5px solid ${targetDegree === "kha" ? "#065f46" : "#e2e8f0"}`,
                      background: targetDegree === "kha" ? "#d1fae5" : "#ffffff",
                      color: "#065f46",
                      fontWeight: 700,
                      fontSize: "13px",
                      cursor: "pointer"
                    }}
                  >
                    🥈 Khá (≥ 2.50)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Cột phải: Kết quả dự đoán & Lộ trình */}
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div
              style={{
                background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
                borderRadius: "16px",
                padding: "24px",
                border: "1px solid #bae6fd"
              }}
            >
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                KẾT QUẢ DỰ PHÓNG LỘ TRÌNH
              </span>
              <div style={{ display: "flex", alignItems: "baseline", gap: "10px", margin: "10px 0 6px" }}>
                <span style={{ fontSize: "38px", fontWeight: 850, color: requiredRemainingGpa > 4.0 ? "#dc2626" : "#0284c7" }}>
                  {creditsRemaining === 0 ? currentGpa.toFixed(2) : Math.max(0, requiredRemainingGpa).toFixed(2)}
                </span>
                <span style={{ fontSize: "15px", color: "#64748b", fontWeight: 600 }}>/ 4.0 điểm</span>
              </div>
              <div style={{ fontSize: "14px", fontWeight: 650, color: "#0f172a", marginBottom: "12px" }}>
                {creditsRemaining === 0
                  ? "Bạn đã hoàn thành đủ số tín chỉ toàn khóa!"
                  : requiredRemainingGpa > 4.0
                  ? "⚠️ Mục tiêu này vượt quá khả năng tối đa 4.0 của các tín chỉ còn lại. Bạn nên xem xét học cải thiện điểm các môn D hoặc hạ mục tiêu xếp loại."
                  : requiredRemainingGpa < 0
                  ? "🎉 Chúc mừng! Điểm hiện tại đã chắc chắn đảm bảo đạt mục tiêu tốt nghiệp này!"
                  : `Để tốt nghiệp loại ${targetDegree === "xuat_sac" ? "Xuất sắc" : targetDegree === "gioi" ? "Giỏi" : "Khá"}, bạn cần duy trì GPA tối thiểu ${requiredRemainingGpa.toFixed(2)} cho ${creditsRemaining} tín chỉ còn lại.`}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "13px", color: "#334155" }}>
                <div style={{ background: "#ffffff", padding: "10px 14px", borderRadius: "10px" }}>
                  Tín chỉ đã học: <strong>{creditsEarned} TC</strong>
                </div>
                <div style={{ background: "#ffffff", padding: "10px 14px", borderRadius: "10px" }}>
                  Tín chỉ còn lại: <strong>{creditsRemaining} TC</strong>
                </div>
              </div>
            </div>

            {/* Bảng quy chế xếp loại NEU */}
            <div style={{ background: "#ffffff", padding: "20px", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 10px", color: "#0f172a" }}>
                Bảng quy đổi thang điểm đào tạo tín chỉ NEU
              </h3>
              <table style={{ width: "100%", fontSize: "12.5px", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "1.5px solid #e2e8f0", color: "#64748b" }}>
                    <th style={{ padding: "6px" }}>Điểm chữ</th>
                    <th style={{ padding: "6px" }}>Thang 4</th>
                    <th style={{ padding: "6px" }}>Thang 10</th>
                    <th style={{ padding: "6px" }}>Đánh giá</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}><td style={{ padding: "6px", fontWeight: 700, color: "#16a34a" }}>A</td><td>4.0</td><td>8.5 - 10.0</td><td>Giỏi / Xuất sắc</td></tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}><td style={{ padding: "6px", fontWeight: 700, color: "#2563eb" }}>B+</td><td>3.5</td><td>7.8 - 8.4</td><td>Khá giỏi</td></tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}><td style={{ padding: "6px", fontWeight: 700, color: "#2563eb" }}>B</td><td>3.0</td><td>7.0 - 7.7</td><td>Khá</td></tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}><td style={{ padding: "6px", fontWeight: 700, color: "#d97706" }}>C+ / C</td><td>2.5 / 2.0</td><td>5.5 - 6.9</td><td>Trung bình</td></tr>
                  <tr><td style={{ padding: "6px", fontWeight: 700, color: "#dc2626" }}>D / F</td><td>1.0 / 0.0</td><td>&lt; 5.5</td><td>Yếu / Cần học lại</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= PHÂN HỆ 3: DANH BẠ PHÒNG BAN ================= */}
      {activeSubTab === "directory" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          {[
            {
              name: "Phòng Quản lý Đào tạo",
              code: "QLDT_NEU",
              room: "Phòng 210, Nhà A1 (Tòa nhà Thế kỷ)",
              phone: "024.3628.0280 (máy lẻ 5210, 5211)",
              email: "daotao@neu.edu.vn",
              tasks: "Đăng ký học phần tín chỉ, lịch học, lịch thi, bảo lưu, hoãn thi và xét cấp bằng tốt nghiệp."
            },
            {
              name: "Phòng Công tác Chính trị & Quản lý sinh viên",
              code: "CTCTQLSV_NEU",
              room: "Phòng 105, Nhà A1",
              phone: "024.3628.0280 (máy lẻ 5105)",
              email: "phongctctqlsv@neu.edu.vn",
              tasks: "Cấp giấy xác nhận sinh viên, thẻ sinh viên tích hợp, học bổng khuyến khích, điểm rèn luyện và CLB."
            },
            {
              name: "Trung tâm Tư vấn Tuyển sinh & Hướng nghiệp",
              code: "TS_NEU",
              room: "Sảnh Tầng 1, Nhà A1",
              phone: "Hotline: 0926.888.207 / 024.3628.0280 (máy lẻ 5212)",
              email: "tuyensinh@neu.edu.vn",
              tasks: "Tư vấn đề án tuyển sinh đại học, chương trình Tiên tiến AEP, POHE và tiếp nhận hồ sơ nhập học."
            },
            {
              name: "Phòng Tài chính - Kế toán",
              code: "TCKT_NEU",
              room: "Phòng 109, Nhà A1",
              phone: "024.3628.0280 (máy lẻ 5109)",
              email: "taichinhketoan@neu.edu.vn",
              tasks: "Học phí trực tuyến, xác nhận hoàn thành nghĩa vụ tài chính và giải quyết chính sách miễn giảm học phí."
            },
            {
              name: "Thư viện Phạm Văn Đồng",
              code: "LIB_NEU",
              room: "Tòa nhà Thư viện trung tâm (cạnh Nhà A1)",
              phone: "024.3628.0280 (máy lẻ 5301)",
              email: "thuvien@neu.edu.vn",
              tasks: "Mượn trả giáo trình, tài khoản số NEU Reader, phòng tự học thông minh và tài liệu nghiên cứu."
            },
            {
              name: "Trung tâm Ứng dụng CNTT (CAIT)",
              code: "CAIT_NEU",
              room: "Tầng 3, Nhà A1",
              phone: "024.3628.0280 (máy lẻ 5401)",
              email: "cait@neu.edu.vn",
              tasks: "Cấp lại mật khẩu email @neu.edu.vn, tài khoản LMS courses.neu.edu.vn và wifi campus."
            }
          ].map((dept, index) => (
            <div
              key={index}
              style={{
                background: "#ffffff",
                padding: "20px 22px",
                borderRadius: "14px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 750, color: "#1e3a8a", margin: 0 }}>
                  {dept.name}
                </h3>
                <span style={{ fontSize: "11px", fontWeight: 700, background: "#f1f5f9", padding: "2px 8px", borderRadius: "4px", color: "#475569" }}>
                  {dept.code}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#334155", marginBottom: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <MapPin size={14} color="#0284c7" /> <strong>Địa điểm:</strong> {dept.room}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Phone size={14} color="#0284c7" /> <strong>Điện thoại:</strong> {dept.phone}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Mail size={14} color="#0284c7" /> <strong>Email:</strong> {dept.email}
                </div>
              </div>
              <p style={{ margin: 0, fontSize: "12.5px", color: "#64748b", lineHeight: 1.5, background: "#f8fafc", padding: "8px 12px", borderRadius: "8px" }}>
                <strong>Phạm vi giải quyết:</strong> {dept.tasks}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
