"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Award,
  BookOpen,
  Calculator,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck,
  FilePlus2,
  FileText,
  Filter,
  GraduationCap,
  HelpCircle,
  Search,
  Sparkles,
  Upload,
  UserCheck,
  UsersRound,
  X,
  XCircle,
} from "lucide-react";
import { AdmissionScore, api, Applicant, Major } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { DemoTag, EmptyState, ErrorNotice, Loading, PageTitle, StatusBadge } from "@/components/ui";

type PublicLecturer = {
  id: string;
  full_name: string;
  academic_rank: string;
  education_level: string;
  specialty: string;
  faculty_name: string;
  position: string;
  email: string;
  avatar_url: string;
};

export function Admissions() {
  const params = useSearchParams();
  const { user } = useAuth();
  const isAdmin = Boolean(user && ["ADMIN", "super_admin", "admission_staff"].includes(user.role));

  const [majors, setMajors] = useState<Major[]>([]);
  const [scores, setScores] = useState<AdmissionScore[]>([]);
  const [applications, setApplications] = useState<Applicant[]>([]);
  const [lecturers, setLecturers] = useState<PublicLecturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState(params.get("search") ?? "");

  // Tabs:
  // Khách: 'majors' | 'scores' | 'calculator' | 'apply' | 'lookup' | 'lecturers'
  // Admin: 'admin_apps' | 'majors' | 'scores'
  const [tab, setTab] = useState<"majors" | "scores" | "calculator" | "apply" | "lookup" | "lecturers" | "admin_apps">(
    isAdmin ? "admin_apps" : "majors"
  );

  // State cho Form Nộp hồ sơ (TS4)
  const [applyFullName, setApplyFullName] = useState("");
  const [applyEmail, setApplyEmail] = useState("");
  const [applyPhone, setApplyPhone] = useState("");
  const [applyCccd, setApplyCccd] = useState("");
  const [applyDob, setApplyDob] = useState("");
  const [applyAddress, setApplyAddress] = useState("");
  const [applyNv1, setApplyNv1] = useState("");
  const [applyNv2, setApplyNv2] = useState("");
  const [applyNv3, setApplyNv3] = useState("");
  const [applyMethod, setApplyMethod] = useState("Điểm thi tốt nghiệp THPT");
  const [applyPriority, setApplyPriority] = useState<number>(0);
  const [applyTotalScore, setApplyTotalScore] = useState<number>(0);
  const [applyAttachments, setApplyAttachments] = useState<{ filename: string }[]>([
    { filename: "ban_chup_cccd.jpg" },
    { filename: "hoc_ba_thpt.pdf" },
  ]);
  const [submittingApply, setSubmittingApply] = useState(false);
  const [submittedCode, setSubmittedCode] = useState("");

  // State cho Tra cứu hồ sơ (TS5, TS6)
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupResult, setLookupResult] = useState<Applicant | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [extraDocName, setExtraDocName] = useState("");
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // State cho Công cụ tính điểm (TS3)
  const [calcMethod, setCalcMethod] = useState("THPT");
  const [calcSub1, setCalcSub1] = useState(8.5);
  const [calcSub2, setCalcSub2] = useState(8.0);
  const [calcSub3, setCalcSub3] = useState(8.25);
  const [calcIelts, setCalcIelts] = useState(7.0);
  const [calcAptitude, setCalcAptitude] = useState(105);
  const [calcPriority, setCalcPriority] = useState(0.5);
  const [calcResult, setCalcResult] = useState<{ calculated_score: number; scale: number; details: string; eligible_majors: any[] } | null>(null);
  const [calculating, setCalculating] = useState(false);

  // State cho Admin Quản lý tuyển sinh
  const [busyAppId, setBusyAppId] = useState("");
  const [adminStatusModal, setAdminStatusModal] = useState<Applicant | null>(null);
  const [adminNextStatus, setAdminNextStatus] = useState("Đang xét duyệt");
  const [adminStatusNote, setAdminStatusNote] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [m, s, l] = await Promise.all([
        api<Major[]>("/majors"),
        api<AdmissionScore[]>("/admissions/scores").catch(() => []),
        api<PublicLecturer[]>("/personnel/public-lecturers").catch(() => []),
      ]);
      setMajors(m);
      setScores(s);
      setLecturers(l);
      if (m.length > 0 && !applyNv1) {
        setApplyNv1(m[0].id);
      }
      if (isAdmin) {
        const apps = await api<Applicant[]>("/admissions/applications");
        setApplications(apps);
      }
    } catch (err: any) {
      setError(err?.message || "Không thể tải dữ liệu tuyển sinh.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [isAdmin]);

  // Submit hồ sơ tuyển sinh mới (TS4)
  async function handleApplySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!applyCccd.trim() || applyCccd.trim().length < 9) {
      setError("Vui lòng nhập số CCCD / CMND hợp lệ.");
      return;
    }
    setSubmittingApply(true);
    setError("");
    try {
      const res = await api<Applicant>("/admissions/applications", {
        method: "POST",
        body: JSON.stringify({
          full_name: applyFullName,
          email: applyEmail,
          phone: applyPhone,
          identity_card: applyCccd.trim(),
          date_of_birth: applyDob || null,
          address: applyAddress,
          desired_major_id: applyNv1,
          desired_major_2_id: applyNv2 || null,
          desired_major_3_id: applyNv3 || null,
          admission_method: applyMethod,
          priority_score: Number(applyPriority) || 0,
          total_score: Number(applyTotalScore) || 0,
          attachments: applyAttachments,
        }),
      });
      setSubmittedCode(res.application_code || res.id.slice(0, 8).toUpperCase());
      setMessage(`Nộp hồ sơ thành công! Mã hồ sơ của bạn là ${res.application_code}. Hãy lưu lại để tra cứu.`);
      if (isAdmin) await loadData();
    } catch (err: any) {
      setError(err?.message || "Lỗi khi nộp hồ sơ tuyển sinh.");
    } finally {
      setSubmittingApply(false);
    }
  }

  // Tra cứu hồ sơ (TS5)
  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!lookupQuery.trim()) return;
    setLookupLoading(true);
    setLookupError("");
    setLookupResult(null);
    try {
      const q = lookupQuery.trim();
      const res = await api<Applicant>(
        `/admissions/lookup?${q.startsWith("TS") ? `code=${encodeURIComponent(q)}` : `identity_card=${encodeURIComponent(q)}`}`
      );
      setLookupResult(res);
    } catch (err: any) {
      setLookupError(err?.message || "Không tìm thấy hồ sơ nào phù hợp với thông tin đã nhập.");
    } finally {
      setLookupLoading(false);
    }
  }

  // Bổ sung giấy tờ (TS6)
  async function handleAddDocument() {
    if (!lookupResult || !extraDocName.trim()) return;
    setUploadingDoc(true);
    try {
      const updated = await api<Applicant>(`/admissions/applications/${lookupResult.application_code}/documents`, {
        method: "POST",
        body: JSON.stringify({
          attachments: [{ filename: extraDocName.trim(), type: "application/pdf" }],
        }),
      });
      setLookupResult(updated);
      setExtraDocName("");
      setMessage("Đã bổ sung giấy tờ thành công! Hồ sơ đã được chuyển lại ban tuyển sinh để xem xét.");
    } catch (err: any) {
      setLookupError(err?.message || "Không thể tải bổ sung giấy tờ.");
    } finally {
      setUploadingDoc(false);
    }
  }

  // Tính điểm xét tuyển (TS3)
  async function handleCalculateScore(e: React.FormEvent) {
    e.preventDefault();
    setCalculating(true);
    try {
      const res = await api<any>("/admissions/calculate-score", {
        method: "POST",
        body: JSON.stringify({
          admission_method: calcMethod,
          subject_1: Number(calcSub1),
          subject_2: Number(calcSub2),
          subject_3: Number(calcSub3),
          ielts_score: Number(calcIelts),
          aptitude_score: Number(calcAptitude),
          priority_score: Number(calcPriority),
        }),
      });
      setCalcResult(res);
    } catch (err: any) {
      setError(err?.message || "Lỗi khi tính điểm.");
    } finally {
      setCalculating(false);
    }
  }

  // Admin duyệt trạng thái hồ sơ
  async function handleConfirmStatusUpdate() {
    if (!adminStatusModal) return;
    setBusyAppId(adminStatusModal.id);
    setError("");
    try {
      await api(`/admissions/applications/${adminStatusModal.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: adminNextStatus,
          status_note: adminStatusNote.trim(),
        }),
      });
      setAdminStatusModal(null);
      setMessage("Cập nhật trạng thái hồ sơ thành công.");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Cập nhật trạng thái chưa thành công.");
    } finally {
      setBusyAppId("");
    }
  }

  // Admin chuyển trúng tuyển thành sinh viên
  async function handlePromote(applicant: Applicant) {
    setBusyAppId(applicant.id);
    setError("");
    try {
      const res = await api<{ student_number: string }>(`/admissions/applications/${applicant.id}/promote`, {
        method: "POST",
      });
      setMessage(`Đã tạo sinh viên thành công! Mã số sinh viên: ${res.student_number}. Checklist 11 bước đã được kích hoạt.`);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Không thể chuyển thành sinh viên.");
    } finally {
      setBusyAppId("");
    }
  }

  return (
    <div className="module-page" style={{ maxWidth: "1240px", margin: "0 auto", paddingBottom: "60px" }}>
      <PageTitle
        eyebrow="CỔNG TUYỂN SINH · ADMISSIONS PLATFORM"
        title="Tuyển sinh & Đăng ký Xét tuyển"
        description="Cổng thông tin tuyển sinh Đại học Kinh tế Quốc dân: tra cứu điểm chuẩn, tính điểm xét tuyển và nộp hồ sơ trực tuyến."
        action={
          !isAdmin && (
            <button className="button button-primary" onClick={() => setTab("apply")}>
              <FilePlus2 size={16} /> Nộp hồ sơ ngay
            </button>
          )
        }
      />

      {/* Hero Banner Tuyển sinh dành cho Thí sinh */}
      <div
        style={{
          background: "linear-gradient(135deg, #1e3a8a 0%, #0284c7 100%)",
          borderRadius: "16px",
          padding: "28px 32px",
          color: "#ffffff",
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          boxShadow: "0 8px 24px rgba(2, 132, 199, 0.2)",
        }}
      >
        <div>
          <span
            style={{
              display: "inline-block",
              background: "rgba(255,255,255,0.2)",
              padding: "3px 12px",
              borderRadius: "999px",
              fontSize: "12px",
              fontWeight: 700,
              marginBottom: "8px",
            }}
          >
            ĐỀ ÁN TUYỂN SINH ĐẠI HỌC CHÍNH QUY NĂM 2026
          </span>
          <h2 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 6px", color: "#ffffff" }}>
            Trở thành Tân sinh viên NEU với 3 nhóm phương thức xét tuyển
          </h2>
          <p style={{ margin: 0, fontSize: "14px", opacity: 0.9 }}>
            Xét tuyển thẳng theo quy chế Bộ GD&ĐT · Xét tuyển kết hợp chứng chỉ quốc tế · Điểm thi tốt nghiệp THPT
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => setTab("calculator")}
            style={{
              background: "#ffffff",
              color: "#0369a1",
              border: "none",
              padding: "10px 18px",
              borderRadius: "8px",
              fontWeight: 650,
              fontSize: "13.5px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Calculator size={16} /> Công cụ tính điểm
          </button>
          <button
            onClick={() => setTab("lookup")}
            style={{
              background: "rgba(255,255,255,0.15)",
              color: "#ffffff",
              border: "1px solid rgba(255,255,255,0.4)",
              padding: "10px 18px",
              borderRadius: "8px",
              fontWeight: 650,
              fontSize: "13.5px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Search size={16} /> Tra cứu hồ sơ
          </button>
        </div>
      </div>

      {message && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #22c55e",
            borderRadius: "10px",
            padding: "12px 18px",
            marginBottom: "20px",
            color: "#15803d",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <CheckCircle2 size={18} />
            <span>{message}</span>
          </div>
          <button onClick={() => setMessage("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#15803d" }}>
            <X size={16} />
          </button>
        </div>
      )}

      {error && <ErrorNotice message={error} />}

      {/* Tabs thanh điều hướng */}
      <div className="personnel-tabs" style={{ marginBottom: "22px" }}>
        {isAdmin && (
          <button className={tab === "admin_apps" ? "active" : ""} onClick={() => setTab("admin_apps")}>
            <FileText size={16} /> Quản lý hồ sơ xét tuyển ({applications.length})
          </button>
        )}
        <button className={tab === "majors" ? "active" : ""} onClick={() => setTab("majors")}>
          <GraduationCap size={16} /> Ngành đào tạo ({majors.length})
        </button>
        <button className={tab === "scores" ? "active" : ""} onClick={() => setTab("scores")}>
          <Award size={16} /> Điểm chuẩn các năm ({scores.length})
        </button>
        <button className={tab === "calculator" ? "active" : ""} onClick={() => setTab("calculator")}>
          <Calculator size={16} /> Công cụ tính điểm xét tuyển
        </button>
        <button className={tab === "apply" ? "active" : ""} onClick={() => setTab("apply")}>
          <FilePlus2 size={16} /> Nộp hồ sơ trực tuyến
        </button>
        <button className={tab === "lookup" ? "active" : ""} onClick={() => setTab("lookup")}>
          <Search size={16} /> Tra cứu kết quả hồ sơ
        </button>
        <button className={tab === "lecturers" ? "active" : ""} onClick={() => setTab("lecturers")}>
          <UsersRound size={16} /> Đội ngũ giảng viên ({lecturers.length})
        </button>
      </div>

      {loading ? (
        <Loading />
      ) : tab === "admin_apps" && isAdmin ? (
        /* ================= ADMIN QUẢN LÝ HỒ SƠ ================= */
        <div className="table-panel">
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Mã hồ sơ / Thí sinh</th>
                  <th>CCCD</th>
                  <th>Ngành đăng ký</th>
                  <th>Phương thức</th>
                  <th>Điểm xét</th>
                  <th>Ngày nộp</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id}>
                    <td>
                      <strong className="mono">{app.application_code || app.id.slice(0, 8).toUpperCase()}</strong>
                      <div>
                        <strong>{app.full_name}</strong>
                        <small style={{ display: "block", color: "#64748b" }}>{app.email}</small>
                      </div>
                    </td>
                    <td>{app.identity_card || "—"}</td>
                    <td>
                      <strong>NV1: {app.major_name}</strong>
                      {app.major_2_name && <small style={{ display: "block", color: "#64748b" }}>NV2: {app.major_2_name}</small>}
                      {app.major_3_name && <small style={{ display: "block", color: "#64748b" }}>NV3: {app.major_3_name}</small>}
                    </td>
                    <td>{app.admission_method}</td>
                    <td>
                      <strong>{app.total_score}</strong>
                      {app.priority_score > 0 && <small style={{ display: "block", color: "#16a34a" }}>+{app.priority_score} ưu tiên</small>}
                    </td>
                    <td>{new Date(app.created_at).toLocaleDateString("vi-VN")}</td>
                    <td>
                      <StatusBadge>{app.status}</StatusBadge>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <button
                          className="mini-button"
                          onClick={() => {
                            setAdminStatusModal(app);
                            setAdminNextStatus(app.status);
                            setAdminStatusNote(app.status_note || "");
                          }}
                        >
                          Cập nhật
                        </button>
                        {app.status === "Trúng tuyển" && (
                          <button
                            className="mini-button"
                            style={{ background: "#0284c7", color: "#ffffff" }}
                            disabled={busyAppId === app.id}
                            onClick={() => handlePromote(app)}
                          >
                            {app.student_id ? "Đã nhập học" : "Tạo hồ sơ SV"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === "majors" ? (
        /* ================= TS1 & TS2: DANH SÁCH NGÀNH ĐÀO TẠO ================= */
        <div>
          <div className="search-field" style={{ maxWidth: "400px", marginBottom: "20px" }}>
            <Search size={16} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm mã ngành, tên ngành, khoa..." />
          </div>

          <div className="major-card-grid">
            {majors
              .filter((m) => `${m.code} ${m.name} ${m.faculty_name}`.toLowerCase().includes(search.toLowerCase()))
              .map((major) => (
                <article key={major.id} className="major-card">
                  <div className="major-card-head">
                    <div className="major-code">{major.code}</div>
                    <StatusBadge>{major.admission_status}</StatusBadge>
                  </div>
                  <h3>{major.name}</h3>
                  <div className="major-faculty">{major.faculty_name}</div>
                  <p>{major.description}</p>
                  <div className="major-details">
                    <div>
                      <span>Thời gian</span>
                      <strong>{major.duration_years} năm</strong>
                    </div>
                    <div>
                      <span>Học phí / năm</span>
                      <strong>{major.tuition_per_year_vnd.toLocaleString("vi-VN")} ₫</strong>
                    </div>
                    <div>
                      <span>Chỉ tiêu</span>
                      <strong>{major.admission_quota}</strong>
                    </div>
                  </div>
                  <div className="major-card-bottom">
                    <button
                      className="icon-text-button"
                      onClick={() => {
                        setApplyNv1(major.id);
                        setTab("apply");
                      }}
                    >
                      Đăng ký ngay <ArrowRight size={15} />
                    </button>
                  </div>
                </article>
              ))}
          </div>
        </div>
      ) : tab === "scores" ? (
        /* ================= TS2: TRA CỨU ĐIỂM CHUẨN CÁC NĂM ================= */
        <div className="table-panel">
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Năm</th>
                  <th>Mã CTĐT</th>
                  <th>Tên chương trình / Ngành đào tạo</th>
                  <th>Phương thức xét tuyển</th>
                  <th>Điểm chuẩn trúng tuyển</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((sc) => (
                  <tr key={sc.id}>
                    <td>
                      <strong>{sc.year}</strong>
                    </td>
                    <td>
                      <strong className="mono">{sc.program_code}</strong>
                    </td>
                    <td>{sc.program_name}</td>
                    <td>{sc.method}</td>
                    <td>
                      <strong style={{ fontSize: "15px", color: "#0284c7" }}>
                        {sc.score} / {sc.scale}
                      </strong>
                    </td>
                    <td>{sc.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === "calculator" ? (
        /* ================= TS3: CÔNG CỤ TÍNH ĐIỂM XÉT TUYỂN ================= */
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "28px" }}>
          <div
            style={{
              background: "var(--card-bg, #ffffff)",
              border: "1px solid var(--border-color, #e2e8f0)",
              borderRadius: "14px",
              padding: "24px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <h3 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Calculator size={18} /> Nhập điểm thành phần & Chứng chỉ
            </h3>

            <form className="form-stack" onSubmit={handleCalculateScore}>
              <label>
                Phương thức xét tuyển
                <select value={calcMethod} onChange={(e) => setCalcMethod(e.target.value)}>
                  <option value="THPT">Điểm thi tốt nghiệp THPT (Thang 30)</option>
                  <option value="KetHopIELTS">Xét tuyển kết hợp IELTS + 2 môn THPT (Thang 30)</option>
                  <option value="HSA">Đánh giá năng lực ĐHQG Hà Nội (HSA - Thang 150)</option>
                  <option value="TSA">Đánh giá tư duy ĐHBK Hà Nội (TSA - Thang 100)</option>
                </select>
              </label>

              {calcMethod === "THPT" && (
                <div className="form-row">
                  <label>
                    Điểm Môn 1 (Toán)
                    <input type="number" step="0.05" min="0" max="10" value={calcSub1} onChange={(e) => setCalcSub1(Number(e.target.value))} />
                  </label>
                  <label>
                    Điểm Môn 2
                    <input type="number" step="0.05" min="0" max="10" value={calcSub2} onChange={(e) => setCalcSub2(Number(e.target.value))} />
                  </label>
                  <label>
                    Điểm Môn 3
                    <input type="number" step="0.05" min="0" max="10" value={calcSub3} onChange={(e) => setCalcSub3(Number(e.target.value))} />
                  </label>
                </div>
              )}

              {calcMethod === "KetHopIELTS" && (
                <>
                  <div className="form-row">
                    <label>
                      Điểm IELTS (Overall)
                      <select value={calcIelts} onChange={(e) => setCalcIelts(Number(e.target.value))}>
                        <option value="5.5">IELTS 5.5 (Quy đổi 7.0)</option>
                        <option value="6.0">IELTS 6.0 (Quy đổi 7.5)</option>
                        <option value="6.5">IELTS 6.5 (Quy đổi 8.0)</option>
                        <option value="7.0">IELTS 7.0 (Quy đổi 9.0)</option>
                        <option value="7.5">IELTS 7.5 (Quy đổi 9.5)</option>
                        <option value="8.0">IELTS 8.0+ (Quy đổi 10.0)</option>
                      </select>
                    </label>
                    <label>
                      Điểm Môn Toán THPT
                      <input type="number" step="0.05" min="0" max="10" value={calcSub1} onChange={(e) => setCalcSub1(Number(e.target.value))} />
                    </label>
                  </div>
                  <label>
                    Điểm 1 môn khác tổ hợp (Lý/Hóa/Văn...)
                    <input type="number" step="0.05" min="0" max="10" value={calcSub2} onChange={(e) => setCalcSub2(Number(e.target.value))} />
                  </label>
                </>
              )}

              {(calcMethod === "HSA" || calcMethod === "TSA") && (
                <label>
                  Điểm bài thi năng lực / tư duy ({calcMethod === "HSA" ? "Thang 150" : "Thang 100"})
                  <input
                    type="number"
                    min="0"
                    max={calcMethod === "HSA" ? 150 : 100}
                    value={calcAptitude}
                    onChange={(e) => setCalcAptitude(Number(e.target.value))}
                  />
                </label>
              )}

              <label>
                Điểm ưu tiên khu vực & đối tượng
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  max="3"
                  value={calcPriority}
                  onChange={(e) => setCalcPriority(Number(e.target.value))}
                />
              </label>

              <button type="submit" className="button button-primary" style={{ marginTop: "12px" }} disabled={calculating}>
                {calculating ? "Đang tính..." : "Tính điểm quy đổi ngay"}
              </button>
            </form>
          </div>

          {/* Kết quả tính điểm & Gợi ý ngành */}
          <div
            style={{
              background: "var(--card-bg, #ffffff)",
              border: "1px solid var(--border-color, #e2e8f0)",
              borderRadius: "14px",
              padding: "24px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <h3 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 16px" }}>Kết quả quy đổi & Ngành phù hợp</h3>

            {calcResult ? (
              <div>
                <div
                  style={{
                    background: "#f0f9ff",
                    border: "1.5px solid #0284c7",
                    borderRadius: "12px",
                    padding: "18px 20px",
                    marginBottom: "20px",
                    textAlign: "center",
                  }}
                >
                  <small style={{ color: "#0369a1", fontWeight: 600 }}>TỔNG ĐIỂM XÉT TUYỂN QUY ĐỔI</small>
                  <div style={{ fontSize: "36px", fontWeight: 800, color: "#0284c7", margin: "4px 0" }}>
                    {calcResult.calculated_score} <span style={{ fontSize: "18px", color: "#64748b" }}>/ {calcResult.scale}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: "13px", color: "#475569" }}>{calcResult.details}</p>
                </div>

                <h4 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 10px", color: "#334155" }}>
                  Các ngành có điểm chuẩn năm gần nhất phù hợp:
                </h4>

                {calcResult.eligible_majors.length === 0 ? (
                  <p style={{ fontSize: "13.5px", color: "#64748b" }}>
                    Chưa tìm thấy ngành có điểm chuẩn thấp hơn mức điểm hiện tại. Hãy kiểm tra các phương thức khác.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {calcResult.eligible_majors.map((em: any) => (
                      <div
                        key={em.code}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "10px 14px",
                          borderRadius: "8px",
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          fontSize: "13.5px",
                        }}
                      >
                        <div>
                          <strong>{em.name}</strong> <small style={{ color: "#64748b" }}>({em.code})</small>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontWeight: 700, color: "#0284c7" }}>{em.cutoff_score}đ</span>
                          <small style={{ display: "block", color: "#16a34a" }}>Dư +{em.margin}đ</small>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                icon={<Calculator size={32} />}
                title="Chưa có kết quả tính điểm"
                description="Nhập điểm thi hoặc điểm chứng chỉ ở khung bên trái và bấm 'Tính điểm quy đổi ngay'."
              />
            )}
          </div>
        </div>
      ) : tab === "apply" ? (
        /* ================= TS4: NỘP HỒ SƠ TRỰC TUYẾN ================= */
        <div style={{ maxWidth: "760px", margin: "0 auto" }}>
          {submittedCode ? (
            <div
              style={{
                background: "#f0fdf4",
                border: "2px solid #22c55e",
                borderRadius: "16px",
                padding: "36px",
                textAlign: "center",
              }}
            >
              <CheckCircle2 size={56} style={{ color: "#16a34a", margin: "0 auto 16px" }} />
              <h2 style={{ fontSize: "24px", fontWeight: 700, color: "#15803d", margin: "0 0 8px" }}>
                Nộp hồ sơ xét tuyển thành công!
              </h2>
              <p style={{ fontSize: "15px", color: "#374151", margin: "0 0 20px" }}>
                Hồ sơ của bạn đã được ghi nhận trên hệ thống tuyển sinh Đại học Kinh tế Quốc dân.
              </p>

              <div
                style={{
                  background: "#ffffff",
                  border: "1px dashed #22c55e",
                  borderRadius: "12px",
                  padding: "18px 24px",
                  display: "inline-block",
                  marginBottom: "24px",
                }}
              >
                <small style={{ color: "#64748b", display: "block", marginBottom: "4px" }}>MÃ HỒ SƠ TRA CỨU CỦA BẠN</small>
                <strong style={{ fontSize: "28px", letterSpacing: "2px", color: "#0284c7" }} className="mono">
                  {submittedCode}
                </strong>
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
                <button
                  className="button button-primary"
                  onClick={() => {
                    setLookupQuery(submittedCode);
                    setTab("lookup");
                  }}
                >
                  <Search size={16} /> Tra cứu hồ sơ này ngay
                </button>
                <button
                  className="button button-ghost"
                  onClick={() => {
                    setSubmittedCode("");
                    setApplyFullName("");
                    setApplyCccd("");
                  }}
                >
                  Nộp thêm hồ sơ khác
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                background: "var(--card-bg, #ffffff)",
                border: "1px solid var(--border-color, #e2e8f0)",
                borderRadius: "16px",
                padding: "32px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
              }}
            >
              <h3 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 6px" }}>Phiếu Đăng ký Xét tuyển Trực tuyến</h3>
              <p style={{ margin: "0 0 24px", color: "#64748b", fontSize: "14px" }}>
                Vui lòng điền đầy đủ và chính xác thông tin cá nhân và 3 nguyện vọng theo thứ tự ưu tiên.
              </p>

              <form className="form-stack" onSubmit={handleApplySubmit}>
                <div className="form-row">
                  <label>
                    Họ và tên thí sinh *
                    <input required value={applyFullName} onChange={(e) => setApplyFullName(e.target.value)} placeholder="Nguyễn Văn A" />
                  </label>
                  <label>
                    Số CCCD / Định danh cá nhân (12 chữ số) *
                    <input
                      required
                      value={applyCccd}
                      onChange={(e) => setApplyCccd(e.target.value)}
                      placeholder="001204xxxxxx"
                    />
                  </label>
                </div>

                <div className="form-row">
                  <label>
                    Email liên hệ *
                    <input required type="email" value={applyEmail} onChange={(e) => setApplyEmail(e.target.value)} placeholder="thi.sinh@example.com" />
                  </label>
                  <label>
                    Số điện thoại *
                    <input required value={applyPhone} onChange={(e) => setApplyPhone(e.target.value)} placeholder="09xx xxx xxx" />
                  </label>
                </div>

                <div className="form-row">
                  <label>
                    Ngày tháng năm sinh
                    <input type="date" value={applyDob} onChange={(e) => setApplyDob(e.target.value)} />
                  </label>
                  <label>
                    Phương thức xét tuyển chính *
                    <select value={applyMethod} onChange={(e) => setApplyMethod(e.target.value)}>
                      <option value="Điểm thi tốt nghiệp THPT">Điểm thi tốt nghiệp THPT</option>
                      <option value="Xét tuyển kết hợp IELTS">Xét tuyển kết hợp IELTS</option>
                      <option value="Đánh giá năng lực ĐHQGHN (HSA)">Đánh giá năng lực ĐHQGHN (HSA)</option>
                      <option value="Đánh giá tư duy ĐHBK (TSA)">Đánh giá tư duy ĐHBK (TSA)</option>
                      <option value="Xét tuyển thẳng">Xét tuyển thẳng theo quy chế</option>
                    </select>
                  </label>
                </div>

                <label>
                  Địa chỉ thường trú
                  <input value={applyAddress} onChange={(e) => setApplyAddress(e.target.value)} placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/TP" />
                </label>

                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "18px", marginTop: "10px" }}>
                  <h4 style={{ margin: "0 0 14px", fontSize: "15px", fontWeight: 700, color: "#1e293b" }}>
                    Đăng ký các Nguyện vọng Xét tuyển
                  </h4>

                  <label>
                    Nguyện vọng 1 (Ưu tiên cao nhất) *
                    <select required value={applyNv1} onChange={(e) => setApplyNv1(e.target.value)}>
                      <option value="" disabled>
                        Chọn ngành nguyện vọng 1
                      </option>
                      {majors.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} · {m.code} ({m.faculty_name})
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="form-row" style={{ marginTop: "12px" }}>
                    <label>
                      Nguyện vọng 2 (Tùy chọn)
                      <select value={applyNv2} onChange={(e) => setApplyNv2(e.target.value)}>
                        <option value="">Không đăng ký NV2</option>
                        {majors.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} · {m.code}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Nguyện vọng 3 (Tùy chọn)
                      <select value={applyNv3} onChange={(e) => setApplyNv3(e.target.value)}>
                        <option value="">Không đăng ký NV3</option>
                        {majors.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} · {m.code}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="form-row" style={{ marginTop: "12px" }}>
                  <label>
                    Tổng điểm xét tuyển dự kiến
                    <input
                      type="number"
                      step="0.05"
                      value={applyTotalScore}
                      onChange={(e) => setApplyTotalScore(Number(e.target.value))}
                      placeholder="27.5"
                    />
                  </label>
                  <label>
                    Điểm ưu tiên đối tượng / khu vực
                    <input
                      type="number"
                      step="0.25"
                      value={applyPriority}
                      onChange={(e) => setApplyPriority(Number(e.target.value))}
                      placeholder="0.5"
                    />
                  </label>
                </div>

                <div style={{ marginTop: "16px", padding: "14px", background: "#f8fafc", borderRadius: "10px", border: "1px dashed #cbd5e1" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", fontSize: "13.5px", fontWeight: 650 }}>
                    <Upload size={16} /> Giấy tờ minh chứng đính kèm (CCCD, Học bạ, Chứng chỉ)
                  </div>
                  <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "#64748b" }}>
                    {applyAttachments.map((f, i) => (
                      <li key={i}>{f.filename}</li>
                    ))}
                  </ul>
                </div>

                <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
                  <button type="submit" className="button button-primary" disabled={submittingApply} style={{ padding: "12px 24px" }}>
                    {submittingApply ? "Đang xử lý nộp..." : "Xác nhận nộp hồ sơ xét tuyển"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      ) : tab === "lookup" ? (
        /* ================= TS5 & TS6: TRA CỨU HỒ SƠ & BỔ SUNG MINH CHỨNG ================= */
        <div style={{ maxWidth: "760px", margin: "0 auto" }}>
          <div
            style={{
              background: "var(--card-bg, #ffffff)",
              border: "1px solid var(--border-color, #e2e8f0)",
              borderRadius: "16px",
              padding: "28px",
              marginBottom: "24px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 8px" }}>Tra cứu tình trạng hồ sơ xét tuyển</h3>
            <p style={{ margin: "0 0 18px", color: "#64748b", fontSize: "14px" }}>
              Nhập <strong>Mã hồ sơ (ví dụ: TS2026-00101)</strong> hoặc <strong>Số CCCD</strong> để xem kết quả xét duyệt.
            </p>

            <form onSubmit={handleLookup} style={{ display: "flex", gap: "10px" }}>
              <input
                style={{ flex: 1, padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
                placeholder="Nhập Mã hồ sơ hoặc CCCD..."
              />
              <button type="submit" className="button button-primary" disabled={lookupLoading}>
                {lookupLoading ? "Đang tìm..." : "Tra cứu ngay"}
              </button>
            </form>

            {lookupError && <div style={{ marginTop: "14px", color: "#dc2626", fontSize: "13.5px" }}>{lookupError}</div>}
          </div>

          {lookupResult && (
            <div
              style={{
                background: "var(--card-bg, #ffffff)",
                border: "1px solid var(--border-color, #e2e8f0)",
                borderRadius: "16px",
                padding: "28px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" }}>
                <div>
                  <small style={{ color: "#64748b" }}>MÃ HỒ SƠ</small>
                  <h3 style={{ margin: "2px 0 0", fontSize: "20px", color: "#0284c7" }} className="mono">
                    {lookupResult.application_code}
                  </h3>
                </div>
                <StatusBadge>{lookupResult.status}</StatusBadge>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                <div>
                  <small style={{ color: "#64748b", display: "block" }}>Họ và tên thí sinh</small>
                  <strong>{lookupResult.full_name}</strong>
                </div>
                <div>
                  <small style={{ color: "#64748b", display: "block" }}>Số CCCD</small>
                  <strong>{lookupResult.identity_card || "—"}</strong>
                </div>
                <div>
                  <small style={{ color: "#64748b", display: "block" }}>Nguyện vọng 1</small>
                  <strong>{lookupResult.major_name}</strong>
                </div>
                <div>
                  <small style={{ color: "#64748b", display: "block" }}>Phương thức xét tuyển</small>
                  <strong>{lookupResult.admission_method}</strong>
                </div>
              </div>

              {lookupResult.status_note && (
                <div
                  style={{
                    background: lookupResult.status === "Cần bổ sung" ? "#fffbeb" : "#f8fafc",
                    border: `1px solid ${lookupResult.status === "Cần bổ sung" ? "#f59e0b" : "#e2e8f0"}`,
                    borderRadius: "10px",
                    padding: "14px 16px",
                    marginBottom: "20px",
                    fontSize: "13.5px",
                    color: lookupResult.status === "Cần bổ sung" ? "#92400e" : "#334155",
                  }}
                >
                  <strong>Thông báo từ Ban Tuyển sinh:</strong> {lookupResult.status_note}
                </div>
              )}

              {/* BỔ SUNG MINH CHỨNG KHI BỊ "CẦN BỔ SUNG" (TS6) */}
              {lookupResult.status === "Cần bổ sung" && (
                <div
                  style={{
                    borderTop: "1px solid #e2e8f0",
                    paddingTop: "20px",
                    marginTop: "16px",
                  }}
                >
                  <h4 style={{ margin: "0 0 10px", fontSize: "15px", fontWeight: 700, color: "#b45309" }}>
                    Bổ sung giấy tờ minh chứng còn thiếu (TS6)
                  </h4>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <input
                      style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13.5px" }}
                      value={extraDocName}
                      onChange={(e) => setExtraDocName(e.target.value)}
                      placeholder="Tên tệp minh chứng mới (vd: hoc_ba_cong_chung.pdf)..."
                    />
                    <button className="button button-primary" disabled={uploadingDoc} onClick={handleAddDocument}>
                      {uploadingDoc ? "Đang gửi..." : "Tải bổ sung"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ================= TS7: DANH SÁCH GIẢNG VIÊN CÔNG KHAI ================= */
        <div>
          <div style={{ marginBottom: "20px" }}>
            <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
              Đội ngũ Giáo sư, Phó Giáo sư, Tiến sĩ và Giảng viên tâm huyết trực tiếp giảng dạy tại các Khoa, Viện đào tạo của NEU.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
            {lecturers.map((lec) => (
              <div
                key={lec.id}
                style={{
                  background: "var(--card-bg, #ffffff)",
                  border: "1px solid var(--border-color, #e2e8f0)",
                  borderRadius: "14px",
                  padding: "20px",
                  display: "flex",
                  gap: "16px",
                  alignItems: "center",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                }}
              >
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #0284c7 0%, #1e3a8a 100%)",
                    color: "#ffffff",
                    fontSize: "20px",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {lec.full_name.slice(0, 1)}
                </div>
                <div>
                  <h4 style={{ margin: "0 0 3px", fontSize: "15px", fontWeight: 700 }}>{lec.full_name}</h4>
                  <span style={{ fontSize: "12.5px", color: "#0284c7", fontWeight: 600, display: "block" }}>
                    {lec.academic_rank ? `${lec.academic_rank}, ${lec.education_level}` : lec.education_level || "Giảng viên"}
                  </span>
                  <small style={{ color: "#64748b", display: "block", marginTop: "2px" }}>
                    {lec.faculty_name || "Khoa đào tạo"}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL ADMIN CẬP NHẬT TRẠNG THÁI HỒ SƠ TUYỂN SINH */}
      {adminStatusModal && (
        <div className="modal-backdrop" onClick={() => setAdminStatusModal(null)}>
          <section className="form-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
            <div className="modal-heading">
              <div>
                <div className="eyebrow">QUẢN TRỊ TUYỂN SINH</div>
                <h2>Cập nhật trạng thái xét duyệt</h2>
                <p>Thí sinh: {adminStatusModal.full_name} ({adminStatusModal.application_code})</p>
              </div>
              <button className="modal-close" onClick={() => setAdminStatusModal(null)}>
                ×
              </button>
            </div>

            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                handleConfirmStatusUpdate();
              }}
            >
              <label>
                Trạng thái mới *
                <select value={adminNextStatus} onChange={(e) => setAdminNextStatus(e.target.value)}>
                  <option value="Mới tiếp nhận">Mới tiếp nhận</option>
                  <option value="Đang xét duyệt">Đang xét duyệt</option>
                  <option value="Cần bổ sung">Cần bổ sung</option>
                  <option value="Trúng tuyển">Trúng tuyển</option>
                  <option value="Không trúng tuyển">Không trúng tuyển</option>
                </select>
              </label>

              <label>
                Ghi chú / Lý do (Bắt buộc nếu Cần bổ sung hoặc Không trúng tuyển):
                <textarea
                  rows={3}
                  value={adminStatusNote}
                  onChange={(e) => setAdminStatusNote(e.target.value)}
                  placeholder="Ghi rõ lý do hoặc loại giấy tờ yêu cầu bổ sung..."
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="button button-ghost" onClick={() => setAdminStatusModal(null)}>
                  Hủy
                </button>
                <button type="submit" className="button button-primary" disabled={busyAppId === adminStatusModal.id}>
                  {busyAppId === adminStatusModal.id ? "Đang lưu..." : "Xác nhận cập nhật"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
