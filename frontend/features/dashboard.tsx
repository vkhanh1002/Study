"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Award,
  BookOpen,
  Bot,
  Building2,
  Calendar,
  CalendarCheck2,
  CircleHelp,
  Clock,
  Compass,
  ExternalLink,
  FileText,
  GraduationCap,
  Layers,
  LogIn,
  MapPin,
  Plus,
  Search,
  Sparkles,
  UsersRound
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { DemoTag, ErrorNotice, Loading, PageTitle, StatusBadge } from "@/components/ui";

type DashboardData = {
  students: number;
  applications: number;
  majors: number;
  pending_tickets: number;
  admissions_by_month: { month: string; applications: number }[];
  students_by_major: { name: string; students: number }[];
  recent_activity: { title: string; detail: string; at: string; kind: string }[];
  demo_data: boolean;
};

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [studySummary, setStudySummary] = useState<{ upcoming_deadlines: number; upcoming_exams: number; tasks: any[] } | null>(null);
  const [error, setError] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    api<DashboardData>("/dashboard").then(setData).catch((reason) => setError(reason.message));
    if (user) {
      api<{ upcoming_deadlines: number; upcoming_exams: number; tasks: any[] }>("/study/summary")
        .then(setStudySummary)
        .catch(() => {});
    }
  }, [user]);

  const date = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date());

  // ==========================================
  // 1. GIAO DIỆN TÂN SINH VIÊN / HỌC SINH (CHƯA ĐĂNG NHẬP)
  // KHÔNG có lịch học, lịch thi, deadline
  // Tập trung vào Tuyển sinh, Cẩm nang, Ngành học & AI
  // ==========================================
  if (!user) {
    return (
      <div className="dashboard-page" style={{ maxWidth: "1240px", margin: "0 auto", paddingBottom: "60px" }}>
        {/* Top Hero Banner dành cho Khách / Tân sinh viên */}
        <div
          style={{
            background: "linear-gradient(135deg, #1e3a8a 0%, #0369a1 100%)",
            borderRadius: "18px",
            padding: "36px 32px",
            color: "#ffffff",
            boxShadow: "0 10px 30px rgba(3, 105, 161, 0.2)",
            marginBottom: "28px",
            position: "relative",
            overflow: "hidden"
          }}
        >
          <div style={{ maxWidth: "780px", position: "relative", zIndex: 2 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(255, 255, 255, 0.18)",
                padding: "5px 14px",
                borderRadius: "999px",
                fontSize: "12.5px",
                fontWeight: 650,
                letterSpacing: "0.5px",
                marginBottom: "14px",
                backdropFilter: "blur(4px)"
              }}
            >
              <Sparkles size={15} /> CỔNG THÔNG TIN TUYỂN SINH & TÂN SINH VIÊN NEU STUDY
            </span>
            <h1 style={{ fontSize: "30px", fontWeight: 800, margin: "0 0 12px", lineHeight: 1.25 }}>
              Chào mừng bạn đến với Đại học Kinh tế Quốc dân (NEU)!
            </h1>
            <p style={{ fontSize: "15.5px", margin: "0 0 24px", opacity: 0.92, lineHeight: 1.6 }}>
              Không gian thông tin chính thức dành cho các bạn học sinh, sĩ tử và tân sinh viên khóa mới.
              Khám phá đề án tuyển sinh, ngành học thế mạnh, cẩm nang thủ tục nhập học và hệ sinh thái số NEU.
            </p>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <Link
                href="/support"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 20px",
                  borderRadius: "10px",
                  background: "#ffffff",
                  color: "#1e3a8a",
                  fontWeight: 700,
                  fontSize: "14px",
                  textDecoration: "none",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.12)"
                }}
              >
                <BookOpen size={17} /> Mở Cẩm nang tân sinh viên
              </Link>
              <Link
                href="/assistant"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 20px",
                  borderRadius: "10px",
                  background: "rgba(255, 255, 255, 0.2)",
                  color: "#ffffff",
                  fontWeight: 650,
                  fontSize: "14px",
                  textDecoration: "none",
                  border: "1px solid rgba(255, 255, 255, 0.3)"
                }}
              >
                <Bot size={17} /> Hỏi Trợ lý Tuyển sinh AI
              </Link>
            </div>
          </div>
        </div>

        {/* Khối Thống kê Tuyển sinh NEU */}
        <section className="stat-grid" style={{ marginBottom: "28px" }}>
          <StatCard label="Quy mô đào tạo" value={25000} sub="Sinh viên chính quy" icon={UsersRound} color="blue" trend="Hàng đầu VN" up />
          <StatCard label="Chỉ tiêu tuyển sinh" value={6900} sub="Khóa tuyển sinh 2026" icon={FileText} color="violet" trend="Chính thức" up />
          <StatCard label="Ngành & Chương trình" value={60} sub="Đào tạo cử nhân & CLC" icon={GraduationCap} color="green" trend="Chuẩn quốc tế" />
          <StatCard label="Tỉ lệ việc làm" value={98} sub="Sau khi tốt nghiệp" icon={Award} color="amber" trend="98.2% có việc" up />
        </section>

        {/* Grid 2 cột: Khám phá ngành học & Thao tác nhanh */}
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "24px", marginBottom: "28px" }}>
          {/* Cột trái: Ngành học & Điểm chuẩn nổi bật */}
          <div style={{ background: "#ffffff", borderRadius: "16px", padding: "24px", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h2 style={{ fontSize: "17px", fontWeight: 750, color: "#0f172a", margin: "0 0 4px" }}>
                  Các Ngành học Thế mạnh & Điểm chuẩn NEU (2025)
                </h2>
                <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                  Tổng hợp các ngành đào tạo hot nhất với điểm trúng tuyển tham khảo
                </p>
              </div>
              <Link href="/assistant" style={{ fontSize: "12.5px", color: "#0284c7", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                Hỏi AI thêm <ArrowRight size={14} />
              </Link>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { name: "Logistics và Quản lý chuỗi cung ứng", code: "7340115", score: "28.30", hsa: "115.5", note: "Top 1 điểm chuẩn liên tục nhiều năm" },
                { name: "Kiểm toán", code: "7340302", score: "28.15", hsa: "114.0", note: "Cái nôi kiểm toán lớn nhất VN, Big 4 tuyển dụng" },
                { name: "Marketing (Quản trị Marketing)", code: "7340120", score: "28.00", hsa: "113.5", note: "Sáng tạo, truyền thông số đa kênh" },
                { name: "Thương mại điện tử", code: "7340122", score: "27.90", hsa: "112.5", note: "Kết hợp kinh doanh số và thanh toán điện tử" },
                { name: "Trí tuệ nhân tạo (AI) trong Kinh doanh", code: "7480107", score: "27.85", hsa: "112.5", note: "Chương trình Tiên tiến AEP, tiếng Anh 100%" },
                { name: "Khoa học dữ liệu trong Kinh tế & KD (DSEB)", code: "7480108", score: "27.60", hsa: "112.0", note: "Chương trình Tiên tiến chuyên sâu Big Data & ML" },
              ].map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9"
                  }}
                >
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b" }}>{m.name}</div>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>Mã: {m.code} · {m.note}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "15px", fontWeight: 800, color: "#1d4ed8" }}>{m.score} đ</div>
                    <div style={{ fontSize: "11px", color: "#64748b" }}>HSA: {m.hsa}/150</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cột phải: Thao tác nhanh cho Tân sinh viên */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ background: "#ffffff", borderRadius: "16px", padding: "22px", border: "1px solid #e2e8f0" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 750, color: "#0f172a", margin: "0 0 14px" }}>
                Thao tác nhanh cho Bạn
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <Link
                  href="/support"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    background: "#eff6ff",
                    textDecoration: "none",
                    border: "1px solid #dbeafe"
                  }}
                >
                  <span style={{ background: "#3b82f6", color: "#fff", padding: "8px", borderRadius: "8px", display: "inline-flex" }}>
                    <BookOpen size={16} />
                  </span>
                  <div>
                    <strong style={{ display: "block", fontSize: "13.5px", color: "#1e3a8a" }}>1. Cẩm nang Tân sinh viên NEU</strong>
                    <small style={{ color: "#475569" }}>6 giai đoạn nhập học, KTX, học phí</small>
                  </div>
                </Link>

                <Link
                  href="/support"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    background: "#f0fdf4",
                    textDecoration: "none",
                    border: "1px solid #dcfce7"
                  }}
                >
                  <span style={{ background: "#10b981", color: "#fff", padding: "8px", borderRadius: "8px", display: "inline-flex" }}>
                    <Compass size={16} />
                  </span>
                  <div>
                    <strong style={{ display: "block", fontSize: "13.5px", color: "#065f46" }}>2. Khám phá Hệ thống Website NEU</strong>
                    <small style={{ color: "#475569" }}>Cổng đào tạo, thư viện số, LMS, một cửa</small>
                  </div>
                </Link>

                <Link
                  href="/assistant"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    background: "#fdf4ff",
                    textDecoration: "none",
                    border: "1px solid #fae8ff"
                  }}
                >
                  <span style={{ background: "#a855f7", color: "#fff", padding: "8px", borderRadius: "8px", display: "inline-flex" }}>
                    <Bot size={16} />
                  </span>
                  <div>
                    <strong style={{ display: "block", fontSize: "13.5px", color: "#6b21a8" }}>3. Tư vấn Tuyển sinh với AI</strong>
                    <small style={{ color: "#475569" }}>Giải đáp điểm chuẩn, ngành học 24/7</small>
                  </div>
                </Link>
              </div>
            </div>

            {/* Hộp gợi ý Đăng nhập dành cho Sinh viên đang học */}
            <div
              style={{
                background: "linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)",
                borderRadius: "16px",
                padding: "20px",
                border: "1px solid #cbd5e1"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <LogIn size={18} color="#0284c7" />
                <strong style={{ fontSize: "14px", color: "#0f172a" }}>Bạn đã là Sinh viên NEU?</strong>
              </div>
              <p style={{ margin: "0 0 12px", fontSize: "12.5px", color: "#475569", lineHeight: 1.5 }}>
                Đăng nhập bằng tài khoản sinh viên trường cấp để mở khóa tính năng xem Thời khóa biểu, Lịch thi, Deadline bài tập và Hồ sơ cá nhân.
              </p>
              <button
                onClick={() => {
                  const loginBtn = document.querySelector(".top-user-button") as HTMLElement;
                  loginBtn?.click();
                }}
                style={{
                  width: "100%",
                  padding: "8px 14px",
                  borderRadius: "8px",
                  background: "#0284c7",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 650,
                  border: "none",
                  cursor: "pointer"
                }}
              >
                Đăng nhập Cổng sinh viên
              </button>
            </div>
          </div>
        </div>

        {/* Khám phá Cơ sở vật chất & Tòa nhà Thế kỷ */}
        <section
          style={{
            background: "#ffffff",
            borderRadius: "16px",
            padding: "24px",
            border: "1px solid #e2e8f0",
            marginBottom: "28px"
          }}
        >
          <h2 style={{ fontSize: "17px", fontWeight: 750, color: "#0f172a", margin: "0 0 14px" }}>
            Khám phá Khuôn viên & Cơ sở vật chất NEU (207 Giải Phóng)
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
            <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#1e3a8a", marginBottom: "4px" }}>
                🏛️ Tòa nhà Trung tâm Đào tạo (Nhà Thế kỷ A1)
              </div>
              <p style={{ margin: 0, fontSize: "12.5px", color: "#475569", lineHeight: 1.5 }}>
                Kiến trúc xoắn ốc mái vòm biểu tượng, hội trường hiện đại, nơi đặt Phòng Quản lý Đào tạo (210) và Phòng CTCT&QLSV (105).
              </p>
            </div>
            <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#1e3a8a", marginBottom: "4px" }}>
                📚 Thư viện Phạm Văn Đồng
              </div>
              <p style={{ margin: 0, fontSize: "12.5px", color: "#475569", lineHeight: 1.5 }}>
                Không gian tự học đa tầng thông minh, hàng vạn đầu sách giáo trình, kho tài liệu số NEU Reader và phòng đọc yên tĩnh.
              </p>
            </div>
            <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#1e3a8a", marginBottom: "4px" }}>
                🏢 Ký túc xá & Đời sống Sinh viên
              </div>
              <p style={{ margin: 0, fontSize: "12.5px", color: "#475569", lineHeight: 1.5 }}>
                Khu nội trú tiện nghi khép kín, an ninh 24/7, sân thể thao, căn tin và hơn 35 câu lạc bộ sinh viên sôi nổi.
              </p>
            </div>
          </div>
        </section>

        {/* Banner AI Assistant */}
        <section className="ai-banner">
          <div className="ai-banner-art">
            <div className="ai-orb">
              <Bot size={28} />
            </div>
            <span className="sparkle s1">✦</span>
            <span className="sparkle s2">✧</span>
            <span className="orbit orbit-one" />
            <span className="orbit orbit-two" />
          </div>
          <div className="ai-banner-copy">
            <div className="ai-label">
              <Sparkles size={14} /> NEU STUDY AI ASSISTANT
            </div>
            <h2>
              Trợ lý ảo đồng hành,<br className="desktop-break" /> giải đáp mọi thắc mắc về NEU.
            </h2>
            <p>
              Tư vấn phương thức xét tuyển, điểm chuẩn các ngành, học phí và hướng dẫn tân sinh viên làm thủ tục nhập học nhanh chóng.
            </p>
            <Link className="button button-light" href="/assistant">
              Bắt đầu trò chuyện <ArrowRight size={16} />
            </Link>
          </div>
          <div className="ai-banner-chips">
            <span>✦ Tư vấn điểm chuẩn</span>
            <span>⌕ Hướng dẫn nhập học</span>
            <span>◌ Hỗ trợ 24/7*</span>
            <small>* Demo: phản hồi theo nguồn dữ liệu NEU Study</small>
          </div>
        </section>
      </div>
    );
  }

  // ==========================================
  // 2. GIAO DIỆN SINH VIÊN (ĐÃ CÓ TÀI KHOẢN ĐĂNG NHẬP)
  // Có đầy đủ Lịch học, Lịch thi, Deadline, Kế hoạch học tập
  // ==========================================
  return (
    <div className="dashboard-page">
      <PageTitle
        eyebrow="TỔNG QUAN HỌC VỤ"
        title={`Xin chào, ${user.full_name.split(" ").slice(-1)[0]} 👋`}
        description="Theo dõi tiến độ học tập, lịch thi, deadline và tin tức đào tạo mới nhất."
        action={<div className="today-label">{date}</div>}
      />

      {error && <ErrorNotice message={error} />}
      {!data && !error ? (
        <Loading />
      ) : (
        <>
          {/* Widget Deadline & Lịch thi sắp tới DÀNH RIÊNG CHO SINH VIÊN */}
          <section className="study-schedule-widget" style={{ marginBottom: "24px" }}>
            <div className="study-schedule-header">
              <div className="study-schedule-title">
                <span className="schedule-badge">
                  <CalendarCheck2 size={15} /> TIẾN ĐỘ HỌC TẬP CỦA BẠN
                </span>
                <h3>Deadline & Lịch thi sắp tới</h3>
                <p>Tự động nhắc nhở và đồng bộ với Trợ lý AI lập lịch ôn tập</p>
              </div>
              <div className="study-schedule-actions">
                <Link href="/study-planner" className="button button-secondary button-small">
                  Xem tất cả
                </Link>
                <Link href="/assistant" className="button button-primary button-small">
                  <Bot size={15} /> Nhờ AI lập lịch
                </Link>
              </div>
            </div>
            <div className="study-task-cards">
              {(studySummary?.tasks ?? []).filter((t: any) => t.status !== "completed").slice(0, 3).length ? (
                (studySummary?.tasks ?? [])
                  .filter((t: any) => t.status !== "completed")
                  .slice(0, 3)
                  .map((task: any) => {
                    const diff = new Date(task.due_date).getTime() - new Date().getTime();
                    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                    const daysLabel =
                      days < 0 ? `Quá hạn ${Math.abs(days)} ngày` : days === 0 ? "Hôm nay" : days === 1 ? "Ngày mai" : `Còn ${days} ngày`;
                    const isUrgent = days <= 3;
                    return (
                      <div key={task.id} className="study-task-mini-card">
                        <div className="mini-card-top">
                          <span className={`task-badge ${task.task_type}`}>{task.task_type === "exam" ? "Lịch thi" : "Deadline"}</span>
                          <span className={`mini-card-countdown ${isUrgent ? "urgent" : ""}`}>{daysLabel}</span>
                        </div>
                        <h4>{task.title}</h4>
                        <div className="mini-card-foot">
                          <span>{task.course_name}</span>
                          <time>
                            {new Date(task.due_date).toLocaleDateString("vi-VN", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </time>
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className="study-task-empty">
                  <Clock size={16} />
                  <span>
                    Hiện không có deadline hay lịch thi nào cận kề. Hãy mở <Link href="/study-planner">Kế hoạch học tập</Link> để thêm mới!
                  </span>
                </div>
              )}
            </div>
          </section>

          <section className="stat-grid">
            <StatCard label="Tổng sinh viên" value={data?.students ?? 0} sub="Hồ sơ đang quản lý" icon={UsersRound} color="blue" trend="+8.2%" up />
            <StatCard label="Hồ sơ tuyển sinh" value={data?.applications ?? 0} sub="Tổng hồ sơ tiếp nhận" icon={FileText} color="violet" trend="+12.4%" up />
            <StatCard label="Ngành đào tạo" value={data?.majors ?? 0} sub="Chương trình đào tạo" icon={GraduationCap} color="green" trend="60+ ngành NEU" />
            <StatCard label="Dịch vụ hỗ trợ" value={data?.pending_tickets ?? 0} sub="Thủ tục trực tuyến" icon={CircleHelp} color="amber" trend="Đang mở" />
          </section>

          <section className="dashboard-grid">
            <div className="panel admissions-chart-panel">
              <div className="panel-heading">
                <div>
                  <h2>Hoạt động tuyển sinh</h2>
                  <p>Số hồ sơ theo tháng trong năm</p>
                </div>
                <select aria-label="Chọn năm" defaultValue="2026">
                  <option>2026</option>
                  <option>2025</option>
                </select>
              </div>
              <AdmissionsChart data={data?.admissions_by_month ?? []} />
            </div>
            <div className="panel majors-panel">
              <div className="panel-heading">
                <div>
                  <h2>Sinh viên theo ngành</h2>
                  <p>Phân bố hồ sơ sinh viên</p>
                </div>
                <Link href="/profiles" className="panel-icon-link" aria-label="Mở hồ sơ">
                  <ArrowRight size={17} />
                </Link>
              </div>
              <MajorChart data={data?.students_by_major ?? []} />
            </div>
          </section>

          <section className="dashboard-lower">
            <div className="panel activity-panel">
              <div className="panel-heading">
                <div>
                  <h2>Hoạt động gần đây</h2>
                  <p>Cập nhật mới nhất trên hệ thống</p>
                </div>
              </div>
              {(data?.recent_activity ?? []).length ? (
                <div className="activity-list">
                  {data!.recent_activity.map((item, index) => (
                    <div className="activity-item" key={`${item.title}-${index}`}>
                      <div className={`activity-avatar ${item.kind}`} aria-hidden>
                        {item.kind === "support" ? <CircleHelp size={16} /> : <FileText size={16} />}
                      </div>
                      <div className="activity-copy">
                        <strong>{item.title}</strong>
                        <span>{new Date(item.at).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" })}</span>
                      </div>
                      <StatusBadge>{item.detail}</StatusBadge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-inline">Chưa có hoạt động để hiển thị.</div>
              )}
            </div>

            <div className="quick-panel">
              <div className="panel-heading">
                <div>
                  <h2>Thao tác nhanh cho Sinh viên</h2>
                  <p>Đi đến nghiệp vụ thường dùng</p>
                </div>
              </div>
              <Link className="quick-action" href="/study-planner">
                <span className="quick-icon blue">
                  <CalendarCheck2 size={18} />
                </span>
                <span>
                  <strong>Kế hoạch học tập</strong>
                  <small>Quản lý deadline & lịch thi cá nhân</small>
                </span>
                <ArrowRight size={16} />
              </Link>
              <Link className="quick-action" href="/support">
                <span className="quick-icon green">
                  <CircleHelp size={18} />
                </span>
                <span>
                  <strong>Cẩm nang sinh viên NEU</strong>
                  <small>Cẩm nang & tra cứu M12</small>
                </span>
                <ArrowRight size={16} />
              </Link>
              <Link className="quick-action" href="/profiles">
                <span className="quick-icon violet">
                  <UsersRound size={18} />
                </span>
                <span>
                  <strong>Hồ sơ sinh viên</strong>
                  <small>Xem thông tin học vụ & lớp</small>
                </span>
                <ArrowRight size={16} />
              </Link>
              <Link className="quick-action" href="/assistant">
                <span className="quick-icon blue">
                  <Bot size={18} />
                </span>
                <span>
                  <strong>Trợ lý NEU Study AI</strong>
                  <small>Giải đáp học tập & nhắc deadline</small>
                </span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </section>

          <section className="ai-banner">
            <div className="ai-banner-art">
              <div className="ai-orb">
                <Bot size={28} />
              </div>
              <span className="sparkle s1">✦</span>
              <span className="sparkle s2">✧</span>
              <span className="orbit orbit-one" />
              <span className="orbit orbit-two" />
            </div>
            <div className="ai-banner-copy">
              <div className="ai-label">
                <Sparkles size={14} /> NEU STUDY AI ASSISTANT
              </div>
              <h2>
                Trợ lý đại học của bạn,<br className="desktop-break" /> luôn sẵn sàng hỗ trợ.
              </h2>
              <p>Tìm hiểu ngành đào tạo, quy trình tuyển sinh và thủ tục sinh viên từ dữ liệu tri thức của NEU Study.</p>
              <Link className="button button-light" href="/assistant">
                Bắt đầu trò chuyện <ArrowRight size={16} />
              </Link>
            </div>
            <div className="ai-banner-chips">
              <span>✦ Lập lịch ôn thi</span>
              <span>⌕ Tra cứu hồ sơ</span>
              <span>◌ Hỗ trợ 24/7*</span>
              <small>* Demo: phản hồi phụ thuộc cấu hình LLM</small>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  trend,
  up
}: {
  label: string;
  value: number;
  sub: string;
  icon: typeof UsersRound;
  color: string;
  trend: string;
  up?: boolean;
}) {
  return (
    <article className="stat-card">
      <div className="stat-card-top">
        <span>{label}</span>
        <span className={`stat-icon ${color}`}>
          <Icon size={18} />
        </span>
      </div>
      <div className="stat-value">{value.toLocaleString("vi-VN")}</div>
      <div className="stat-footer">
        <span>{sub}</span>
        <span className={`stat-trend ${up ? "positive" : ""}`}>
          {up ? <ArrowUpRight size={13} /> : null}
          {trend}
        </span>
      </div>
    </article>
  );
}

function AdmissionsChart({ data }: { data: DashboardData["admissions_by_month"] }) {
  if (!data.length) return <div className="chart-empty">Chưa có dữ liệu.</div>;
  const max = Math.max(...data.map((item) => item.applications), 1);
  const points = data.map((item, index) => ({
    x: 42 + index * 49,
    y: 160 - (item.applications / max) * 125,
    ...item
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  return (
    <div className="line-chart-wrap">
      <div className="chart-legend">
        <span>
          <i /> Hồ sơ tiếp nhận
        </span>
        <small>Tổng theo tháng · Dữ liệu tuyển sinh NEU</small>
      </div>
      <svg viewBox="0 0 610 205" role="img" aria-label="Biểu đồ hồ sơ tuyển sinh theo tháng" className="line-chart">
        <defs>
          <linearGradient id="line-fill" x1="0" y1="0" y2="1">
            <stop offset="0" stopColor="#66aef4" stopOpacity=".22" />
            <stop offset="1" stopColor="#66aef4" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[35, 75, 115, 155].map((y) => (
          <line key={y} x1="30" x2="590" y1={y} y2={y} stroke="#edf1f5" strokeDasharray="4 5" />
        ))}
        <polygon points={`42,160 ${line} 581,160`} fill="url(#line-fill)" />
        <polyline points={line} fill="none" stroke="#358bd9" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point) => (
          <g key={point.month}>
            <circle cx={point.x} cy={point.y} r="3.5" fill="#fff" stroke="#358bd9" strokeWidth="2" />
            <text x={point.x} y="188" textAnchor="middle" fill="#8995a4" fontSize="10">
              {point.month}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

const chartColors = ["#398fdd", "#80c7aa", "#8c96e8", "#f0bd76", "#7cc4d2", "#d8dfe8"];
function MajorChart({ data }: { data: DashboardData["students_by_major"] }) {
  const total = data.reduce((sum, row) => sum + row.students, 0);
  let start = 0;
  const slices = data.map((row, index) => {
    const percent = total ? row.students / total : 0;
    const dash = percent * 251.2;
    const slice = { ...row, color: chartColors[index % chartColors.length], dash, offset: -start };
    start += dash;
    return slice;
  });
  return (
    <div className="major-chart">
      <div className="donut-wrap">
        <svg viewBox="0 0 120 120" role="img" aria-label="Phân bố sinh viên theo ngành">
          <circle cx="60" cy="60" r="40" fill="none" stroke="#f0f3f6" strokeWidth="15" />
          {slices.map((slice, index) => (
            <circle
              key={slice.name}
              cx="60"
              cy="60"
              r="40"
              fill="none"
              stroke={slice.color}
              strokeWidth="15"
              strokeDasharray={`${slice.dash} ${251.2 - slice.dash}`}
              strokeDashoffset={slice.offset}
              transform="rotate(-90 60 60)"
              className="donut-segment"
            />
          ))}
        </svg>
        <div className="donut-center">
          <strong>{total}</strong>
          <small>tổng SV</small>
        </div>
      </div>
      <div className="major-legend">
        {slices.length ? (
          slices.map((slice) => (
            <div key={slice.name}>
              <span className="legend-dot" style={{ background: slice.color }} />
              <span className="legend-name">{slice.name}</span>
              <strong>{slice.students}</strong>
            </div>
          ))
        ) : (
          <span className="muted-text">Chưa có dữ liệu hồ sơ</span>
        )}
      </div>
    </div>
  );
}
