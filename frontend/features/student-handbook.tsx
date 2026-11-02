"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BookMarked,
  BookOpen,
  BookOpenCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  CreditCard,
  ExternalLink,
  FileCheck,
  FileText,
  Filter,
  Globe,
  GraduationCap,
  Heart,
  HelpCircle,
  Info,
  Layers,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  X
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  HANDBOOK_GUIDES,
  HANDBOOK_STAGES,
  HandbookGuide,
  NEU_WEBSITES,
  NeuWebsite,
  STUDENT_NEEDS,
  StudentNeed
} from "./student-handbook-data";

export function StudentHandbook() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"handbook" | "websites">("handbook");

  // State cho Cẩm nang
  const [selectedStage, setSelectedStage] = useState<number>(1);
  const [activeGuide, setActiveGuide] = useState<HandbookGuide | null>(null);
  const [completedGuides, setCompletedGuides] = useState<string[]>([]);

  // State cho Tra cứu Website
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedNeed, setSelectedNeed] = useState<StudentNeed | null>(null);
  const [favoriteWebsites, setFavoriteWebsites] = useState<string[]>([]);

  // Đọc dữ liệu tiến độ từ LocalStorage theo userId
  useEffect(() => {
    const userKey = user ? `user_${user.id}` : "guest";
    try {
      const savedCompleted = localStorage.getItem(`study_handbook_completed_${userKey}`);
      if (savedCompleted) setCompletedGuides(JSON.parse(savedCompleted));
      const savedFavs = localStorage.getItem(`study_handbook_favs_${userKey}`);
      if (savedFavs) setFavoriteWebsites(JSON.parse(savedFavs));
    } catch {
      // Fallback
    }
  }, [user]);

  // Toggle hoàn thành một hướng dẫn
  const toggleGuideComplete = (guideId: string) => {
    const userKey = user ? `user_${user.id}` : "guest";
    setCompletedGuides((prev) => {
      const next = prev.includes(guideId) ? prev.filter((id) => id !== guideId) : [...prev, guideId];
      try {
        localStorage.setItem(`study_handbook_completed_${userKey}`, JSON.stringify(next));
      } catch {
        // Fallback
      }
      return next;
    });
  };

  // Toggle yêu thích website
  const toggleFavoriteWebsite = (siteId: string) => {
    const userKey = user ? `user_${user.id}` : "guest";
    setFavoriteWebsites((prev) => {
      const next = prev.includes(siteId) ? prev.filter((id) => id !== siteId) : [...prev, siteId];
      try {
        localStorage.setItem(`study_handbook_favs_${userKey}`, JSON.stringify(next));
      } catch {
        // Fallback
      }
      return next;
    });
  };

  // Tính phần trăm hoàn thành cẩm nang
  const totalGuides = HANDBOOK_GUIDES.length;
  const completedCount = completedGuides.length;
  const progressPercent = Math.round((completedCount / totalGuides) * 100);

  // Lọc hướng dẫn theo stage
  const currentStageGuides = useMemo(() => {
    return HANDBOOK_GUIDES.filter((g) => g.stage === selectedStage);
  }, [selectedStage]);

  // Lọc websites theo query và category
  const filteredWebsites = useMemo(() => {
    return NEU_WEBSITES.filter((site) => {
      const matchCategory = selectedCategory === "all" || site.category === selectedCategory;
      if (!matchCategory) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const matchName = site.name.toLowerCase().includes(q) || (site.shortName && site.shortName.toLowerCase().includes(q));
      const matchDesc = site.description.toLowerCase().includes(q);
      const matchFeatures = site.features.some((f) => f.toLowerCase().includes(q));
      const matchNeeds = site.needs.some((n) => n.toLowerCase().includes(q));

      return matchName || matchDesc || matchFeatures || matchNeeds;
    });
  }, [searchQuery, selectedCategory]);

  return (
    <div className="module-page" style={{ maxWidth: "1240px", margin: "0 auto", paddingBottom: "60px" }}>
      {/* Top Hero Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #1d5b96 0%, #2980b9 100%)",
          borderRadius: "16px",
          padding: "36px 32px",
          color: "#ffffff",
          boxShadow: "0 10px 30px rgba(29, 91, 150, 0.18)",
          marginBottom: "28px",
          position: "relative",
          overflow: "hidden"
        }}
      >
        <div style={{ position: "relative", zIndex: 2, maxWidth: "760px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(255, 255, 255, 0.15)",
              padding: "6px 14px",
              borderRadius: "999px",
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "0.5px",
              marginBottom: "14px",
              backdropFilter: "blur(4px)"
            }}
          >
            <Sparkles size={16} /> MODULE M12 · TRUNG TÂM HỖ TRỢ NGƯỜI HỌC NEU STUDY
          </div>
          <h1 style={{ fontSize: "32px", fontWeight: 800, margin: "0 0 12px", lineHeight: 1.25 }}>
            Chào mừng bạn đến với NEU Study!
          </h1>
          <p style={{ fontSize: "16px", margin: 0, opacity: 0.92, lineHeight: 1.6 }}>
            Cổng thông tin hướng dẫn toàn diện từ các bước nhập học ban đầu cho tân sinh viên đến việc khám phá,
            tra cứu nhanh mọi hệ sinh thái website trực tuyến của Trường Đại học Kinh tế Quốc dân.
          </p>

          {/* Thanh chuyển Tab chính */}
          <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
            <button
              onClick={() => setActiveTab("handbook")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 20px",
                borderRadius: "10px",
                fontWeight: 650,
                fontSize: "14px",
                border: "none",
                cursor: "pointer",
                transition: "all 0.2s ease",
                background: activeTab === "handbook" ? "#ffffff" : "rgba(255, 255, 255, 0.2)",
                color: activeTab === "handbook" ? "#1d5b96" : "#ffffff",
                boxShadow: activeTab === "handbook" ? "0 4px 12px rgba(0,0,0,0.12)" : "none"
              }}
            >
              <BookOpen size={17} /> 1. Cẩm nang tân sinh viên
            </button>
            <button
              onClick={() => setActiveTab("websites")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 20px",
                borderRadius: "10px",
                fontWeight: 650,
                fontSize: "14px",
                border: "none",
                cursor: "pointer",
                transition: "all 0.2s ease",
                background: activeTab === "websites" ? "#ffffff" : "rgba(255, 255, 255, 0.2)",
                color: activeTab === "websites" ? "#1d5b96" : "#ffffff",
                boxShadow: activeTab === "websites" ? "0 4px 12px rgba(0,0,0,0.12)" : "none"
              }}
            >
              <Globe size={17} /> 2. Tra cứu hệ thống website NEU
            </button>
          </div>
        </div>

        {/* Trang trí góc phải */}
        <div
          style={{
            position: "absolute",
            right: "-20px",
            bottom: "-30px",
            opacity: 0.12,
            pointerEvents: "none",
            transform: "rotate(-10deg)"
          }}
        >
          <Building2 size={260} />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PHẦN 1: CẨM NANG TÂN SINH VIÊN                                           */}
      {/* ========================================================================= */}
      {activeTab === "handbook" && (
        <section>
          {/* Thanh Tiến trình Checklist của sinh viên */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
              padding: "20px 24px",
              marginBottom: "24px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div>
                <span style={{ fontSize: "15px", fontWeight: 700, color: "#1e293b" }}>
                  Tiến độ hoàn thành các bước chuẩn bị
                </span>
                <span style={{ marginLeft: "10px", fontSize: "13px", color: "#64748b" }}>
                  (Đã hoàn thành <strong>{completedCount}</strong> / {totalGuides} nội dung)
                </span>
              </div>
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: 800,
                  color: progressPercent === 100 ? "#10b981" : "#2563eb",
                  background: progressPercent === 100 ? "#ecfdf5" : "#eff6ff",
                  padding: "4px 12px",
                  borderRadius: "20px"
                }}
              >
                {progressPercent}%
              </span>
            </div>
            {/* Thanh bar */}
            <div
              style={{
                width: "100%",
                height: "10px",
                background: "#f1f5f9",
                borderRadius: "999px",
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: "100%",
                  background: progressPercent === 100 ? "#10b981" : "linear-gradient(90deg, #3b82f6, #2563eb)",
                  borderRadius: "999px",
                  transition: "width 0.4s ease"
                }}
              />
            </div>
          </div>

          {/* Bố cục 2 cột: Danh sách giai đoạn & Thẻ hướng dẫn */}
          <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "24px", alignItems: "start" }}>
            {/* Cột trái: 6 Giai đoạn */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "14px",
                padding: "16px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
              }}
            >
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 12px 6px" }}>
                6 Giai đoạn đồng hành
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {HANDBOOK_STAGES.map((st) => {
                  const isActive = selectedStage === st.id;
                  const stageGuides = HANDBOOK_GUIDES.filter((g) => g.stage === st.id);
                  const isStageAllDone = stageGuides.every((g) => completedGuides.includes(g.id));

                  return (
                    <button
                      key={st.id}
                      onClick={() => setSelectedStage(st.id)}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "12px",
                        padding: "12px",
                        borderRadius: "10px",
                        textAlign: "left",
                        border: "none",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        background: isActive ? "#eff6ff" : "transparent",
                        color: isActive ? "#1d4ed8" : "#334155",
                        outline: isActive ? "2px solid #93c5fd" : "none"
                      }}
                    >
                      <div
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "50%",
                          display: "grid",
                          placeItems: "center",
                          fontSize: "13px",
                          fontWeight: 700,
                          flexShrink: 0,
                          marginTop: "2px",
                          background: isStageAllDone ? "#10b981" : isActive ? "#2563eb" : "#e2e8f0",
                          color: isStageAllDone || isActive ? "#ffffff" : "#64748b"
                        }}
                      >
                        {isStageAllDone ? "✓" : st.id}
                      </div>
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 650, lineHeight: 1.35, marginBottom: "3px" }}>
                          {st.title}
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748b", lineHeight: 1.4 }}>
                          {st.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cột phải: Danh sách chi tiết các nội dung trong giai đoạn */}
            <div>
              <div style={{ marginBottom: "16px" }}>
                <h2 style={{ fontSize: "20px", fontWeight: 750, color: "#0f172a", margin: "0 0 6px" }}>
                  {HANDBOOK_STAGES.find((s) => s.id === selectedStage)?.title}
                </h2>
                <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
                  Nhấp vào từng thủ tục để xem giấy tờ cần chuẩn bị, quy trình từng bước và lưu ý quan trọng.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {currentStageGuides.map((guide) => {
                  const isDone = completedGuides.includes(guide.id);

                  return (
                    <div
                      key={guide.id}
                      style={{
                        background: "#ffffff",
                        border: isDone ? "1px solid #a7f3d0" : "1px solid #e2e8f0",
                        borderRadius: "14px",
                        padding: "20px 24px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "20px",
                        transition: "all 0.2s ease"
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: 650,
                              color: isDone ? "#059669" : "#2563eb",
                              background: isDone ? "#ecfdf5" : "#eff6ff",
                              padding: "3px 8px",
                              borderRadius: "6px"
                            }}
                          >
                            {isDone ? "Đã chuẩn bị" : "Cần hoàn thành"}
                          </span>
                          {guide.processingTime && (
                            <span style={{ fontSize: "12px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
                              <Clock size={13} /> {guide.processingTime}
                            </span>
                          )}
                        </div>
                        <h4 style={{ fontSize: "17px", fontWeight: 700, color: "#1e293b", margin: "0 0 6px" }}>
                          {guide.title}
                        </h4>
                        <p style={{ fontSize: "14px", color: "#475569", lineHeight: 1.5, margin: "0 0 12px" }}>
                          {guide.shortDesc}
                        </p>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <button
                            onClick={() => setActiveGuide(guide)}
                            style={{
                              background: "#f1f5f9",
                              color: "#1e293b",
                              border: "none",
                              padding: "7px 14px",
                              borderRadius: "8px",
                              fontSize: "13px",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px"
                            }}
                          >
                            <Info size={14} /> Xem quy trình chi tiết
                          </button>
                          {guide.relatedLink && (
                            <a
                              href={guide.relatedLink.url}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                color: "#2563eb",
                                fontSize: "13px",
                                fontWeight: 600,
                                textDecoration: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                            >
                              {guide.relatedLink.label} <ExternalLink size={13} />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Nút checkmark hoàn thành */}
                      <button
                        onClick={() => toggleGuideComplete(guide.id)}
                        title={isDone ? "Đánh dấu chưa hoàn thành" : "Đánh dấu đã hoàn thành"}
                        style={{
                          background: isDone ? "#10b981" : "transparent",
                          color: isDone ? "#ffffff" : "#94a3b8",
                          border: isDone ? "none" : "2px solid #cbd5e1",
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          display: "grid",
                          placeItems: "center",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          flexShrink: 0
                        }}
                      >
                        <CheckCircle2 size={20} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* PHẦN 2: TRA CỨU HỆ THỐNG WEBSITE NEU                                     */}
      {/* ========================================================================= */}
      {activeTab === "websites" && (
        <section>
          {/* Thanh tìm kiếm nổi bật */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
              padding: "24px 28px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
              marginBottom: "32px"
            }}
          >
            <div style={{ position: "relative", marginBottom: "16px" }}>
              <Search
                size={22}
                style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Bạn đang muốn tìm website hoặc hệ thống nào của NEU? (Ví dụ: Lịch thi, LMS, Thư viện, Đăng ký tín chỉ...)"
                style={{
                  width: "100%",
                  height: "54px",
                  padding: "0 18px 0 52px",
                  fontSize: "16px",
                  border: "1.5px solid #cbd5e1",
                  borderRadius: "12px",
                  outline: "none",
                  color: "#1e293b",
                  background: "#f8fafc",
                  boxSizing: "border-box"
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: "16px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer"
                  }}
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* Các nút lọc phân loại danh mục */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: "13px", fontWeight: 650, color: "#64748b", marginRight: "6px" }}>
                <Filter size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />
                Phân loại:
              </span>
              {[
                { id: "all", label: "Tất cả hệ thống" },
                { id: "daotao", label: "Đào tạo & Học tập" },
                { id: "thutuc", label: "Thủ tục & QLSV" },
                { id: "congnghe", label: "Tài khoản & Công nghệ" },
                { id: "thongtin", label: "Thông tin & Hướng nghiệp" },
                { id: "doisong", label: "Đời sống sinh viên" }
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: "999px",
                    fontSize: "13px",
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    background: selectedCategory === cat.id ? "#2563eb" : "#f1f5f9",
                    color: selectedCategory === cat.id ? "#ffffff" : "#475569"
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Khu vực: Bạn muốn làm gì hôm nay? (10 nhu cầu phổ biến) */}
          <div style={{ marginBottom: "36px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <Compass size={22} color="#2563eb" />
              <h3 style={{ fontSize: "20px", fontWeight: 750, color: "#0f172a", margin: 0 }}>
                Bạn muốn làm gì hôm nay?
              </h3>
              <span style={{ fontSize: "13px", color: "#64748b" }}>
                (Chọn nhu cầu thường gặp để truy cập đúng website)
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: "12px"
              }}
            >
              {STUDENT_NEEDS.map((need) => (
                <button
                  key={need.id}
                  onClick={() => setSelectedNeed(need)}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#93c5fd";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#e2e8f0";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      background: "#eff6ff",
                      color: "#2563eb",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0
                    }}
                  >
                    <CheckCircle2 size={18} />
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 650, color: "#1e293b", lineHeight: 1.3 }}>
                    {need.title}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Danh sách Website Cards */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                Danh bạ hệ thống số NEU ({filteredWebsites.length} website)
              </h3>
              {favoriteWebsites.length > 0 && (
                <span style={{ fontSize: "13px", color: "#e11d48", fontWeight: 600 }}>
                  ❤ Đã lưu {favoriteWebsites.length} website yêu thích
                </span>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
                gap: "20px"
              }}
            >
              {filteredWebsites.map((site) => {
                const isFav = favoriteWebsites.includes(site.id);

                return (
                  <div
                    key={site.id}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "14px",
                      padding: "20px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                      transition: "all 0.2s ease"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.07)";
                      e.currentTarget.style.borderColor = "#cbd5e1";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.03)";
                      e.currentTarget.style.borderColor = "#e2e8f0";
                    }}
                  >
                    <div>
                      {/* Header Card */}
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            style={{
                              width: "42px",
                              height: "42px",
                              borderRadius: "10px",
                              background: "#eff6ff",
                              color: "#2563eb",
                              display: "grid",
                              placeItems: "center",
                              fontWeight: 800,
                              fontSize: "16px"
                            }}
                          >
                            <Globe size={22} />
                          </div>
                          <div>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                              {site.categoryLabel}
                            </div>
                            <h4 style={{ fontSize: "16px", fontWeight: 750, color: "#0f172a", margin: "2px 0 0" }}>
                              {site.name}
                            </h4>
                          </div>
                        </div>

                        {/* Nút Yêu thích */}
                        <button
                          onClick={() => toggleFavoriteWebsite(site.id)}
                          title={isFav ? "Bỏ yêu thích" : "Lưu vào yêu thích"}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: isFav ? "#e11d48" : "#94a3b8",
                            padding: "6px"
                          }}
                        >
                          <Heart size={20} fill={isFav ? "#e11d48" : "none"} />
                        </button>
                      </div>

                      <p style={{ fontSize: "13.5px", color: "#475569", lineHeight: 1.5, margin: "0 0 14px" }}>
                        {site.description}
                      </p>

                      {/* Tags tính năng */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px" }}>
                        {site.features.map((feat) => (
                          <span
                            key={feat}
                            style={{
                              fontSize: "11.5px",
                              background: "#f1f5f9",
                              color: "#475569",
                              padding: "3px 8px",
                              borderRadius: "6px",
                              fontWeight: 500
                            }}
                          >
                            {feat}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Footer Card */}
                    <div
                      style={{
                        paddingTop: "14px",
                        borderTop: "1px solid #f1f5f9",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between"
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: site.isVerified ? "#10b981" : "#f59e0b",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        <ShieldCheck size={14} /> {site.isVerified ? "Hệ thống chính thức NEU" : "Chưa xác minh"}
                      </span>

                      <a
                        href={site.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          background: "#2563eb",
                          color: "#ffffff",
                          padding: "8px 16px",
                          borderRadius: "8px",
                          fontSize: "13px",
                          fontWeight: 650,
                          textDecoration: "none",
                          transition: "background 0.15s ease"
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#1d4ed8")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#2563eb")}
                      >
                        Truy cập website <ArrowUpRight size={15} />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* MODAL CHI TIẾT THỦ TỤC CẨM NANG                                          */}
      {/* ========================================================================= */}
      {activeGuide && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            zIndex: 100,
            display: "grid",
            placeItems: "center",
            padding: "20px",
            backdropFilter: "blur(4px)"
          }}
          onClick={() => setActiveGuide(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "18px",
              maxWidth: "680px",
              width: "100%",
              maxHeight: "88vh",
              overflowY: "auto",
              padding: "32px",
              position: "relative",
              boxShadow: "0 20px 50px rgba(0,0,0,0.2)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveGuide(null)}
              style={{
                position: "absolute",
                right: "20px",
                top: "20px",
                background: "#f1f5f9",
                border: "none",
                borderRadius: "50%",
                width: "36px",
                height: "36px",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                color: "#64748b"
              }}
            >
              <X size={18} />
            </button>

            <span style={{ fontSize: "12px", fontWeight: 700, color: "#2563eb", textTransform: "uppercase" }}>
              {activeGuide.stageTitle}
            </span>
            <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", margin: "6px 0 16px" }}>
              {activeGuide.title}
            </h2>

            {/* Mục đích & Đối tượng */}
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                fontSize: "14px"
              }}
            >
              <div>
                <strong style={{ color: "#334155" }}>🎯 Mục đích:</strong> {activeGuide.purpose}
              </div>
              <div>
                <strong style={{ color: "#334155" }}>👥 Đối tượng áp dụng:</strong> {activeGuide.targetAudience}
              </div>
              <div>
                <strong style={{ color: "#334155" }}>📍 Địa điểm / Kênh thực hiện:</strong> {activeGuide.locationOrUrl}
              </div>
            </div>

            {/* Giấy tờ cần chuẩn bị */}
            <div style={{ marginBottom: "20px" }}>
              <h4 style={{ fontSize: "15px", fontWeight: 700, color: "#1e293b", margin: "0 0 10px", display: "flex", alignItems: "center", gap: "6px" }}>
                <FileText size={17} color="#2563eb" /> Hồ sơ và giấy tờ cần chuẩn bị:
              </h4>
              <ul style={{ margin: 0, paddingLeft: "20px", color: "#475569", fontSize: "14px", lineHeight: 1.6 }}>
                {activeGuide.documentsNeeded.map((doc, idx) => (
                  <li key={idx} style={{ marginBottom: "4px" }}>
                    {doc}
                  </li>
                ))}
              </ul>
            </div>

            {/* Các bước thực hiện */}
            <div style={{ marginBottom: "20px" }}>
              <h4 style={{ fontSize: "15px", fontWeight: 700, color: "#1e293b", margin: "0 0 10px", display: "flex", alignItems: "center", gap: "6px" }}>
                <CheckCircle2 size={17} color="#2563eb" /> Các bước thực hiện cụ thể:
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {activeGuide.steps.map((st, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "#f1f5f9",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      fontSize: "13.5px",
                      color: "#334155",
                      lineHeight: 1.5
                    }}
                  >
                    {st}
                  </div>
                ))}
              </div>
            </div>

            {/* Lưu ý quan trọng */}
            <div style={{ marginBottom: "24px" }}>
              <h4 style={{ fontSize: "15px", fontWeight: 700, color: "#e11d48", margin: "0 0 8px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Info size={17} /> Lưu ý quan trọng:
              </h4>
              <ul style={{ margin: 0, paddingLeft: "20px", color: "#64748b", fontSize: "13.5px", lineHeight: 1.55 }}>
                {activeGuide.importantNotes.map((note, idx) => (
                  <li key={idx} style={{ marginBottom: "4px" }}>
                    {note}
                  </li>
                ))}
              </ul>
            </div>

            {/* Nút hành động */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e2e8f0", paddingTop: "18px" }}>
              <button
                onClick={() => {
                  toggleGuideComplete(activeGuide.id);
                  setActiveGuide(null);
                }}
                style={{
                  background: completedGuides.includes(activeGuide.id) ? "#f1f5f9" : "#10b981",
                  color: completedGuides.includes(activeGuide.id) ? "#475569" : "#ffffff",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "10px",
                  fontWeight: 650,
                  fontSize: "14px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                <CheckCircle2 size={18} />
                {completedGuides.includes(activeGuide.id) ? "Đã xong (Bấm để hủy)" : "Đánh dấu đã hoàn thành"}
              </button>

              {activeGuide.relatedLink && (
                <a
                  href={activeGuide.relatedLink.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    background: "#2563eb",
                    color: "#ffffff",
                    padding: "10px 20px",
                    borderRadius: "10px",
                    fontWeight: 650,
                    fontSize: "14px",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  {activeGuide.relatedLink.label} <ExternalLink size={16} />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL GỢI Ý NHU CẦU SỬ DỤNG                                              */}
      {/* ========================================================================= */}
      {selectedNeed && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            zIndex: 100,
            display: "grid",
            placeItems: "center",
            padding: "20px",
            backdropFilter: "blur(4px)"
          }}
          onClick={() => setSelectedNeed(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "18px",
              maxWidth: "540px",
              width: "100%",
              padding: "28px",
              position: "relative",
              boxShadow: "0 20px 50px rgba(0,0,0,0.2)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedNeed(null)}
              style={{
                position: "absolute",
                right: "18px",
                top: "18px",
                background: "#f1f5f9",
                border: "none",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                color: "#64748b"
              }}
            >
              <X size={16} />
            </button>

            <span style={{ fontSize: "12px", fontWeight: 700, color: "#2563eb", textTransform: "uppercase" }}>
              Nhu cầu phổ biến
            </span>
            <h3 style={{ fontSize: "20px", fontWeight: 750, color: "#0f172a", margin: "4px 0 12px" }}>
              {selectedNeed.title}
            </h3>
            <p style={{ fontSize: "14px", color: "#475569", lineHeight: 1.5, margin: "0 0 18px" }}>
              {selectedNeed.description}
            </p>

            {/* Hướng dẫn thao tác */}
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "20px"
              }}
            >
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "6px" }}>
                Cách thực hiện:
              </div>
              <p style={{ fontSize: "13.5px", color: "#1e293b", lineHeight: 1.6, margin: 0 }}>
                {selectedNeed.usageGuide}
              </p>
            </div>

            {/* Website đề xuất */}
            {(() => {
              const rec = NEU_WEBSITES.find((w) => w.id === selectedNeed.recommendedWebsiteId);
              if (!rec) return null;
              return (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>Website thực hiện:</div>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#1e293b" }}>{rec.name}</div>
                  </div>
                  <a
                    href={rec.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: "#2563eb",
                      color: "#ffffff",
                      padding: "10px 18px",
                      borderRadius: "10px",
                      fontWeight: 650,
                      fontSize: "14px",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    Truy cập ngay <ArrowUpRight size={16} />
                  </a>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
