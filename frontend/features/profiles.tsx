"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  ExternalLink,
  FileCheck,
  FileText,
  Filter,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  Printer,
  QrCode,
  Search,
  ShieldAlert,
  Sparkles,
  User,
  UserCheck,
  UserRound,
  UserRoundPen,
  Users
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { DemoTag, EmptyState, ErrorNotice, Loading, PageTitle, StatusBadge } from "@/components/ui";

export type EmergencyContact = {
  parent_name?: string;
  parent_phone?: string;
  relationship?: string;
  citizen_id?: string;
  citizen_issued_date?: string;
  citizen_issued_place?: string;
  ethnic?: string;
  religion?: string;
  hometown?: string;
  personal_email?: string;
  advisor_name?: string;
  advisor_email?: string;
  faculty?: string;
  program_type?: string;
  credits_accumulated?: number;
  credits_total?: number;
  credits_general?: number;
  credits_foundation?: number;
  credits_specialized?: number;
  gpa_4?: number;
  gpa_10?: number;
  academic_rank?: string;
  training_points?: number;
  training_rank?: string;
  english_cert?: string;
  it_cert?: string;
  national_defense?: string;
  physical_education?: string;
  awards?: string[];
};

export type Student = {
  id: string;
  student_number: string;
  full_name: string;
  email: string;
  phone: string;
  date_of_birth?: string | null;
  gender: string;
  address: string;
  major_id: string;
  major_name: string;
  cohort: string;
  class_name: string;
  study_status: string;
  enrollment_date: string | null;
  emergency_contact?: EmergencyContact;
  is_demo: boolean;
};

export function Profiles() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedCohort, setSelectedCohort] = useState("all");
  const [selectedMajor, setSelectedMajor] = useState("all");
  const [selected, setSelected] = useState<Student | null>(null);
  const [activeTab, setActiveTab] = useState<"academic" | "progress" | "personal" | "awards">("academic");

  useEffect(() => {
    api<Student[]>("/profiles/students")
      .then(setRows)
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [user]);

  const uniqueCohorts = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.cohort))).sort().reverse();
  }, [rows]);

  const uniqueMajors = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.major_name))).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const matchQuery = `${row.student_number} ${row.full_name} ${row.email} ${row.major_name}`
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchCohort = selectedCohort === "all" || row.cohort === selectedCohort;
      const matchMajor = selectedMajor === "all" || row.major_name === selectedMajor;
      return matchQuery && matchCohort && matchMajor;
    });
  }, [rows, query, selectedCohort, selectedMajor]);

  // Nếu người dùng là Sinh viên (xem hồ sơ cá nhân trực tiếp)
  const isStudent = user?.role === "student";
  const myStudent = rows[0] || null;

  return (
    <div className="module-page" style={{ maxWidth: "1280px", margin: "0 auto", paddingBottom: "60px" }}>
      <PageTitle
        eyebrow="HỆ THỐNG QUẢN LÝ THÔNG TIN NGƯỜI HỌC"
        title="Hồ sơ sinh viên NEU Study"
        description="Thông tin học vụ, tiến độ đào tạo, hồ sơ nhân thân và thẻ sinh viên số được tích hợp tập trung."
        action={
          isStudent && myStudent ? (
            <button
              className="button button-secondary"
              onClick={() => window.print()}
              style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
            >
              <Printer size={16} /> In sơ yếu lý lịch
            </button>
          ) : user?.role === "super_admin" ? (
            <button className="button button-secondary" disabled title="Tính năng tạo từ hồ sơ trúng tuyển tuyển sinh">
              <UserRoundPen size={16} /> Tạo từ tuyển sinh
            </button>
          ) : null
        }
      />

      <div className="module-notice neutral" style={{ marginBottom: "24px" }}>
        <ShieldAlert size={16} />
        <span>
          {isStudent
            ? "Bạn đang xem hồ sơ sinh viên chính thức của tài khoản cá nhân. Dữ liệu được đồng bộ từ Phòng Quản lý Đào tạo và Phòng Công tác Chính trị & QLSV."
            : "Hệ thống quản lý hồ sơ tập trung. Quyền quản trị cho phép tra cứu, rà soát tiến độ học tập và thông tin liên hệ của sinh viên toàn trường."}
        </span>
        {rows.some((row) => row.is_demo) && <DemoTag />}
      </div>

      {error && <ErrorNotice message={error} />}

      {loading ? (
        <Loading />
      ) : rows.length === 0 && !isStudent ? (
        <EmptyState
          icon={<UserRound size={28} />}
          title={user ? "Chưa liên kết hồ sơ sinh viên" : "Đăng nhập để xem hồ sơ"}
          description={user ? "Tài khoản này chưa được gắn với hồ sơ người học." : "Đăng nhập để xem thông tin cá nhân theo quyền được cấp."}
        />
      ) : isStudent && myStudent ? (
        // GIAO DIỆN HỒ SƠ TOÀN DIỆN CHO SINH VIÊN
        <StudentFullProfileView
          student={myStudent}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onUpdateContact={(updated) => setRows([updated])}
        />
      ) : (
        // GIAO DIỆN DANH SÁCH DÀNH CHO ADMIN / QUẢN TRỊ VIÊN
        <>
          <div
            className="module-toolbar"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "14px",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
              background: "#ffffff",
              padding: "16px 20px",
              borderRadius: "14px",
              border: "1px solid #e2e8f0"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <div className="toolbar-count" style={{ fontSize: "14.5px" }}>
                Tổng số sinh viên: <strong style={{ color: "#1e3a8a", fontSize: "16px" }}>{filtered.length}</strong> / {rows.length}
              </div>

              {/* Lọc theo khóa */}
              <select
                value={selectedCohort}
                onChange={(e) => setSelectedCohort(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13.5px",
                  background: "#f8fafc",
                  color: "#1e293b",
                  outline: "none"
                }}
              >
                <option value="all">Tất cả các khóa</option>
                {uniqueCohorts.map((c) => (
                  <option key={c} value={c}>
                    Khóa {c} (K{Number(c) - 1958})
                  </option>
                ))}
              </select>

              {/* Lọc theo ngành */}
              <select
                value={selectedMajor}
                onChange={(e) => setSelectedMajor(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13.5px",
                  background: "#f8fafc",
                  color: "#1e293b",
                  outline: "none",
                  maxWidth: "240px"
                }}
              >
                <option value="all">Tất cả ngành đào tạo</option>
                {uniqueMajors.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="search-field" style={{ minWidth: "280px" }}>
              <Search size={16} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm mã SV, họ tên, email, ngành..."
              />
            </div>
          </div>

          <div className="table-panel">
            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>Mã sinh viên</th>
                    <th>Họ và tên</th>
                    <th>Ngành đào tạo</th>
                    <th>Khóa / Lớp</th>
                    <th>GPA / Tín chỉ</th>
                    <th>Trạng thái</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const gpa = row.emergency_contact?.gpa_4 ?? "—";
                    const credits = row.emergency_contact?.credits_accumulated ?? "—";
                    return (
                      <tr key={row.id}>
                        <td>
                          <strong className="mono" style={{ color: "#1e3a8a", fontWeight: 700 }}>
                            {row.student_number}
                          </strong>
                        </td>
                        <td>
                          <div className="person-cell">
                            <span className="avatar small-avatar" style={{ background: "#e0f2fe", color: "#0369a1", fontWeight: 700 }}>
                              {row.full_name.slice(0, 1)}
                            </span>
                            <span>
                              <strong>{row.full_name}</strong>
                              <small>{row.email}</small>
                            </span>
                          </div>
                        </td>
                        <td>{row.major_name}</td>
                        <td>
                          {row.cohort} · {row.class_name || "Chưa xếp lớp"}
                        </td>
                        <td>
                          <span style={{ fontWeight: 650, color: Number(gpa) >= 3.2 ? "#16a34a" : "#1e293b" }}>
                            {gpa} / 4.0
                          </span>
                          <small style={{ display: "block", color: "#64748b" }}>{credits}/130 TC</small>
                        </td>
                        <td>
                          <StatusBadge>{row.study_status}</StatusBadge>
                        </td>
                        <td>
                          <button
                            className="mini-button"
                            onClick={() => setSelected(row)}
                            style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                          >
                            Xem hồ sơ
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <p className="table-footnote" style={{ marginTop: "12px", color: "#64748b", fontSize: "13px" }}>
            Hiển thị thông tin hồ sơ theo phạm vi quyền quản trị tài khoản NEU Study.
          </p>
        </>
      )}

      {selected && (
        <ProfileDetailModal
          student={selected}
          isAdmin={user?.role === "super_admin"}
          onClose={() => setSelected(null)}
          onUpdated={(updated) => {
            setSelected(updated);
            setRows((current) => current.map((row) => (row.id === updated.id ? updated : row)));
          }}
        />
      )}
    </div>
  );
}

// =========================================================================
// GIAO DIỆN HỒ SƠ SINH VIÊN TOÀN DIỆN (FULL STUDENT VIEW)
// =========================================================================
function StudentFullProfileView({
  student,
  activeTab,
  setActiveTab,
  onUpdateContact
}: {
  student: Student;
  activeTab: "academic" | "progress" | "personal" | "awards";
  setActiveTab: (tab: "academic" | "progress" | "personal" | "awards") => void;
  onUpdateContact: (updated: Student) => void;
}) {
  const [editing, setEditing] = useState(false);
  const meta = student.emergency_contact || {};

  const gpa4 = meta.gpa_4 ?? 3.48;
  const gpa10 = meta.gpa_10 ?? 8.35;
  const creditsAcc = meta.credits_accumulated ?? 78;
  const creditsTotal = meta.credits_total ?? 130;
  const progressPercent = Math.min(100, Math.round((creditsAcc / creditsTotal) * 100));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* 1. THẺ SINH VIÊN ĐIỆN TỬ NEU SMART ID CARD & BANNER */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 0.8fr",
          gap: "24px",
          alignItems: "stretch"
        }}
      >
        {/* Thẻ sinh viên số mặt trước */}
        <div
          style={{
            background: "linear-gradient(135deg, #1e3a8a 0%, #0284c7 100%)",
            borderRadius: "18px",
            padding: "26px 28px",
            color: "#ffffff",
            boxShadow: "0 12px 28px rgba(3, 105, 161, 0.22)",
            position: "relative",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: "260px"
          }}
        >
          {/* Card Top Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  background: "#ffffff",
                  color: "#1e3a8a",
                  width: "44px",
                  height: "44px",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                  fontSize: "18px",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.15)"
                }}
              >
                NEU
              </div>
              <div>
                <div style={{ fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase", opacity: 0.85, fontWeight: 700 }}>
                  ĐẠI HỌC KINH TẾ QUỐC DÂN
                </div>
                <div style={{ fontSize: "16px", fontWeight: 800 }}>THẺ SINH VIÊN ĐIỆN TỬ</div>
              </div>
            </div>
            <span
              style={{
                background: "rgba(255, 255, 255, 0.2)",
                padding: "4px 12px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 650,
                backdropFilter: "blur(4px)"
              }}
            >
              {student.study_status}
            </span>
          </div>

          {/* Card Body */}
          <div style={{ display: "flex", alignItems: "center", gap: "20px", margin: "16px 0" }}>
            <div
              style={{
                width: "80px",
                height: "96px",
                borderRadius: "10px",
                background: "#ffffff",
                border: "3px solid rgba(255, 255, 255, 0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 6px 14px rgba(0,0,0,0.15)",
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: "#e0f2fe",
                  color: "#0369a1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "34px",
                  fontWeight: 800
                }}
              >
                {student.full_name.slice(0, 1)}
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "0.2px", marginBottom: "4px" }}>
                {student.full_name}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span style={{ fontSize: "13px", opacity: 0.9 }}>Mã SV:</span>
                <strong style={{ fontFamily: "monospace", fontSize: "16px", letterSpacing: "1px", background: "rgba(0,0,0,0.18)", padding: "2px 8px", borderRadius: "6px" }}>
                  {student.student_number}
                </strong>
              </div>
              <div style={{ fontSize: "13px", opacity: 0.92, lineHeight: 1.4 }}>
                <strong>{student.major_name}</strong>
                <div style={{ fontSize: "12.5px", opacity: 0.85 }}>
                  Lớp: {student.class_name || "CNTT-K26A"} · Khóa {student.cohort} (K{Number(student.cohort) - 1958})
                </div>
              </div>
            </div>
          </div>

          {/* Card Bottom / Barcode simulation */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderTop: "1px solid rgba(255, 255, 255, 0.2)",
              paddingTop: "10px"
            }}
          >
            <div style={{ fontSize: "11px", opacity: 0.8 }}>
              Hệ: {meta.program_type || "Chính quy chuẩn"} · Giá trị đến: 09/2026
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontFamily: "monospace", fontSize: "11px", letterSpacing: "2px", opacity: 0.75 }}>
              ||| | |||| || ||| | ||||| {student.student_number}
            </div>
          </div>
        </div>

        {/* Thẻ tóm tắt chỉ số học tập & Tác vụ nhanh */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "18px",
            padding: "24px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between"
          }}
        >
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 750, color: "#0f172a", margin: 0 }}>
                Chỉ số học tập tích lũy
              </h3>
              <span
                style={{
                  background: "#dcfce7",
                  color: "#15803d",
                  fontSize: "12px",
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: "999px"
                }}
              >
                Học lực: {meta.academic_rank || "Giỏi"}
              </span>
            </div>

            {/* GPA & Điểm rèn luyện */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "12px", color: "#64748b" }}>GPA Tích lũy (Hệ 4)</span>
                <div style={{ fontSize: "22px", fontWeight: 800, color: "#1d4ed8", marginTop: "2px" }}>
                  {gpa4} <small style={{ fontSize: "13px", color: "#64748b", fontWeight: 500 }}>/ 4.0</small>
                </div>
                <small style={{ color: "#059669", fontWeight: 600 }}>Thang 10: {gpa10}</small>
              </div>

              <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "12px", color: "#64748b" }}>Điểm rèn luyện</span>
                <div style={{ fontSize: "22px", fontWeight: 800, color: "#0284c7", marginTop: "2px" }}>
                  {meta.training_points || 88} <small style={{ fontSize: "13px", color: "#64748b", fontWeight: 500 }}>/ 100</small>
                </div>
                <small style={{ color: "#0284c7", fontWeight: 600 }}>Loại: {meta.training_rank || "Tốt"}</small>
              </div>
            </div>

            {/* Tiến độ tích lũy tín chỉ */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px" }}>
                <span style={{ color: "#475569", fontWeight: 600 }}>Tín chỉ đã tích lũy</span>
                <strong style={{ color: "#1e293b" }}>
                  {creditsAcc} / {creditsTotal} TC ({progressPercent}%)
                </strong>
              </div>
              <div style={{ height: "9px", background: "#e2e8f0", borderRadius: "999px", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${progressPercent}%`,
                    background: "linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%)",
                    borderRadius: "999px"
                  }}
                />
              </div>
            </div>

            {/* Cố vấn học tập */}
            <div
              style={{
                background: "#eff6ff",
                padding: "10px 14px",
                borderRadius: "10px",
                border: "1px solid #dbeafe",
                display: "flex",
                alignItems: "center",
                gap: "10px"
              }}
            >
              <UserCheck size={18} color="#2563eb" />
              <div style={{ fontSize: "12.5px" }}>
                <span style={{ color: "#1e40af" }}>Cố vấn học tập (CVHT): </span>
                <strong style={{ color: "#1e3a8a" }}>{meta.advisor_name || "TS. Nguyễn Hoàng Nam"}</strong>
                <span style={{ color: "#64748b" }}> ({meta.advisor_email || "namnh@neu.edu.vn"})</span>
              </div>
            </div>
          </div>

          {/* Quick Actions Button */}
          <div style={{ display: "flex", gap: "10px", marginTop: "16px", flexWrap: "wrap" }}>
            <button
              className="button button-secondary"
              onClick={() => setEditing(true)}
              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "13px" }}
            >
              <UserRoundPen size={14} /> Cập nhật liên hệ
            </button>
            <Link
              href="/support"
              className="button button-primary"
              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "13px", textDecoration: "none" }}
            >
              <FileCheck size={14} /> Xin giấy xác nhận SV
            </Link>
          </div>
        </div>
      </div>

      {/* 2. TAB NAVIGATION BAR */}
      <div
        style={{
          display: "flex",
          borderBottom: "2px solid #e2e8f0",
          gap: "8px",
          overflowX: "auto"
        }}
      >
        {[
          { key: "academic", label: "Thông tin Học vụ & Đào tạo", icon: GraduationCap },
          { key: "progress", label: "Tiến độ Học tập & Chuẩn đầu ra", icon: BookOpen },
          { key: "personal", label: "Hồ sơ Cá nhân & Nhân thân", icon: User },
          { key: "awards", label: "Khen thưởng & Ngoại khóa", icon: Award }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 18px",
                border: "none",
                background: "transparent",
                color: isActive ? "#0284c7" : "#64748b",
                fontWeight: isActive ? 750 : 600,
                fontSize: "14px",
                cursor: "pointer",
                borderBottom: isActive ? "3px solid #0284c7" : "3px solid transparent",
                marginBottom: "-2px",
                transition: "all 0.15s ease"
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 3. NỘI DUNG TỪNG TAB */}
      <div style={{ background: "#ffffff", borderRadius: "16px", padding: "28px", border: "1px solid #e2e8f0" }}>
        {/* TAB 1: THÔNG TIN HỌC VỤ & ĐÀO TẠO */}
        {activeTab === "academic" && (
          <div>
            <h3 style={{ fontSize: "17px", fontWeight: 750, color: "#0f172a", marginBottom: "6px" }}>
              Thông tin Học vụ & Chương trình Đào tạo NEU
            </h3>
            <p style={{ fontSize: "13.5px", color: "#64748b", marginBottom: "20px" }}>
              Chi tiết về chương trình cử nhân, viện/khoa quản lý và các thông số định danh học thuật chính thức tại Đại học Kinh tế Quốc dân.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "16px",
                marginBottom: "24px"
              }}
            >
              <ProfileItemCard label="Mã sinh viên chính thức" value={student.student_number} highlight mono />
              <ProfileItemCard label="Ngành đào tạo" value={student.major_name} highlight />
              <ProfileItemCard label="Mã ngành đào tạo" value={student.major_id || "7480201"} mono />
              <ProfileItemCard label="Khoa / Viện chủ quản" value={meta.faculty || "Khoa Công nghệ thông tin"} />
              <ProfileItemCard label="Lớp sinh hoạt chuyên ngành" value={student.class_name || "CNTT-K26A"} />
              <ProfileItemCard label="Khóa sinh viên" value={`Khóa ${student.cohort} (K${Number(student.cohort) - 1958})`} />
              <ProfileItemCard label="Hệ đào tạo" value={meta.program_type || "Đại học Chính quy (Hệ Chuẩn)"} />
              <ProfileItemCard label="Thời gian đào tạo chuẩn" value="4 năm (130 tín chỉ)" />
              <ProfileItemCard
                label="Ngày vào trường / Nhập học"
                value={student.enrollment_date ? new Date(student.enrollment_date).toLocaleDateString("vi-VN") : "05/09/2026"}
              />
              <ProfileItemCard label="Tình trạng học vụ" value={student.study_status} badge />
              <ProfileItemCard label="Cố vấn học tập (CVHT)" value={meta.advisor_name || "TS. Nguyễn Hoàng Nam"} />
              <ProfileItemCard label="Email cố vấn học tập" value={meta.advisor_email || "namnh@neu.edu.vn"} />
            </div>

            <div
              style={{
                background: "#f8fafc",
                padding: "16px 20px",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                fontSize: "13px",
                color: "#475569",
                lineHeight: 1.6
              }}
            >
              <strong style={{ color: "#1e293b", display: "block", marginBottom: "4px" }}>
                Ghi chú Quy chế Đào tạo tín chỉ NEU:
              </strong>
              Sinh viên hoàn thành tối thiểu 130 tín chỉ theo khung chương trình quy định. Điểm học phần đánh giá theo thang điểm 10,
              quy đổi sang thang điểm chữ (A, B, C, D, F) và thang điểm 4. Để duy trì học lực bình thường, sinh viên cần tích lũy đủ số tín chỉ tối thiểu mỗi kỳ và không bị cảnh báo học vụ.
            </div>
          </div>
        )}

        {/* TAB 2: TIẾN ĐỘ HỌC TẬP & CHUẨN ĐẦU RA */}
        {activeTab === "progress" && (
          <div>
            <h3 style={{ fontSize: "17px", fontWeight: 750, color: "#0f172a", marginBottom: "6px" }}>
              Tiến độ Tích lũy Tín chỉ & Chuẩn đầu ra Tốt nghiệp
            </h3>
            <p style={{ fontSize: "13.5px", color: "#64748b", marginBottom: "20px" }}>
              Theo dõi việc hoàn thành các khối kiến thức bắt buộc và điều kiện xét tốt nghiệp cử nhân NEU.
            </p>

            {/* Phân rã khối kiến thức */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "28px" }}>
              <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "12px", color: "#64748b" }}>1. Khối Đại cương</span>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#1e293b", margin: "4px 0" }}>
                  {meta.credits_general || 32} <small style={{ fontSize: "13px", color: "#64748b" }}>/ 32 TC</small>
                </div>
                <small style={{ color: "#16a34a", fontWeight: 600 }}>100% Hoàn thành</small>
              </div>

              <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "12px", color: "#64748b" }}>2. Khối Cơ sở ngành</span>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#1e293b", margin: "4px 0" }}>
                  {meta.credits_foundation || 28} <small style={{ fontSize: "13px", color: "#64748b" }}>/ 36 TC</small>
                </div>
                <small style={{ color: "#0284c7", fontWeight: 600 }}>77.8% Đang học</small>
              </div>

              <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "12px", color: "#64748b" }}>3. Khối Chuyên ngành</span>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#1e293b", margin: "4px 0" }}>
                  {meta.credits_specialized || 18} <small style={{ fontSize: "13px", color: "#64748b" }}>/ 52 TC</small>
                </div>
                <small style={{ color: "#d97706", fontWeight: 600 }}>34.6% Đang hoàn thiện</small>
              </div>

              <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "12px", color: "#64748b" }}>4. Thực tập & Khóa luận</span>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#1e293b", margin: "4px 0" }}>
                  0 <small style={{ fontSize: "13px", color: "#64748b" }}>/ 10 TC</small>
                </div>
                <small style={{ color: "#64748b", fontWeight: 600 }}>Dự kiến Kỳ 8</small>
              </div>
            </div>

            {/* Bảng Chuẩn đầu ra */}
            <h4 style={{ fontSize: "15px", fontWeight: 750, color: "#1e293b", marginBottom: "12px" }}>
              Tình trạng các Chứng chỉ Chuẩn đầu ra bắt buộc
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { title: "Chuẩn Ngoại ngữ đầu ra (Tiếng Anh)", status: meta.english_cert || "IELTS 6.5 (Đạt Chuẩn đầu ra)", pass: true, note: "Yêu cầu tối thiểu tương đương B2 / IELTS 5.5+" },
                { title: "Chuẩn Tin học ứng dụng", status: meta.it_cert || "MOS Word & Excel (Đạt Chuẩn)", pass: true, note: "Yêu cầu chứng chỉ MOS Word, Excel hoặc IC3 quốc tế" },
                { title: "Chứng chỉ Giáo dục Quốc phòng - An ninh", status: meta.national_defense || "Đã hoàn thành (Loại Giỏi)", pass: true, note: "Hoàn thành tại Trung tâm GDQP-AN NEU" },
                { title: "Chứng chỉ Giáo dục Thể chất", status: meta.physical_education || "Đã tích lũy đủ 4/4 học phần", pass: true, note: "Bao gồm Điền kinh, Bơi lội và Môn tự chọn" }
              ].map((cdr, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 18px",
                    borderRadius: "10px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <CheckCircle2 size={18} color="#16a34a" />
                    <div>
                      <strong style={{ fontSize: "14px", color: "#1e293b" }}>{cdr.title}</strong>
                      <div style={{ fontSize: "12.5px", color: "#64748b" }}>{cdr.note}</div>
                    </div>
                  </div>
                  <span
                    style={{
                      background: cdr.pass ? "#dcfce7" : "#fee2e2",
                      color: cdr.pass ? "#15803d" : "#b91c1c",
                      fontSize: "13px",
                      fontWeight: 700,
                      padding: "5px 12px",
                      borderRadius: "6px"
                    }}
                  >
                    {cdr.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: THÔNG TIN CÁ NHÂN & NHÂN THÂN */}
        {activeTab === "personal" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 style={{ fontSize: "17px", fontWeight: 750, color: "#0f172a", margin: "0 0 4px" }}>
                  Hồ sơ Cá nhân, Căn cước & Thông tin Liên hệ
                </h3>
                <p style={{ margin: 0, fontSize: "13.5px", color: "#64748b" }}>
                  Thông tin định danh công dân và người bảo hộ phục vụ công tác quản lý sinh viên.
                </p>
              </div>
              <button
                className="button button-secondary"
                onClick={() => setEditing(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px" }}
              >
                <UserRoundPen size={14} /> Chỉnh sửa
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "16px",
                marginBottom: "28px"
              }}
            >
              <ProfileItemCard label="Họ và tên khai sinh" value={student.full_name} highlight />
              <ProfileItemCard
                label="Ngày tháng năm sinh"
                value={student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString("vi-VN") : "18/05/2004"}
              />
              <ProfileItemCard label="Giới tính" value={student.gender || "Nam"} />
              <ProfileItemCard label="Dân tộc / Tôn giáo" value={`${meta.ethnic || "Kinh"} · ${meta.religion || "Không"}`} />
              <ProfileItemCard label="Số Căn cước công dân (CCCD)" value={meta.citizen_id || "001202018899"} mono highlight />
              <ProfileItemCard label="Ngày cấp CCCD" value={meta.citizen_issued_date || "15/04/2021"} />
              <ProfileItemCard label="Nơi cấp" value={meta.citizen_issued_place || "Cục Cảnh sát QLHC về TTXH"} />
              <ProfileItemCard label="Quê quán" value={meta.hometown || "Nam Định"} />
              <ProfileItemCard label="Số điện thoại liên hệ" value={student.phone || "0900000001"} mono />
              <ProfileItemCard label="Email sinh viên NEU" value={student.email} mono />
              <ProfileItemCard label="Email cá nhân" value={meta.personal_email || "khoa.tran2004@gmail.com"} />
              <ProfileItemCard
                label="Địa chỉ thường trú / Hiện tại"
                value={student.address || "Số 207 Giải Phóng, Phường Đồng Tâm, Quận Hai Bà Trưng, Hà Nội"}
              />
            </div>

            {/* Thông tin phụ huynh / Người liên hệ khẩn cấp */}
            <h4 style={{ fontSize: "15px", fontWeight: 750, color: "#1e293b", marginBottom: "12px" }}>
              Thông tin Người giám hộ & Liên hệ khẩn cấp
            </h4>
            <div
              style={{
                background: "#f8fafc",
                padding: "18px 20px",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "14px"
              }}
            >
              <div>
                <span style={{ fontSize: "12px", color: "#64748b" }}>Họ tên người giám hộ</span>
                <div style={{ fontSize: "15px", fontWeight: 700, color: "#1e293b", marginTop: "2px" }}>
                  {meta.parent_name || "Trần Văn Hùng"}
                </div>
              </div>
              <div>
                <span style={{ fontSize: "12px", color: "#64748b" }}>Mối quan hệ</span>
                <div style={{ fontSize: "15px", fontWeight: 700, color: "#1e293b", marginTop: "2px" }}>
                  {meta.relationship || "Bố"}
                </div>
              </div>
              <div>
                <span style={{ fontSize: "12px", color: "#64748b" }}>Số điện thoại liên lạc</span>
                <div style={{ fontSize: "15px", fontWeight: 700, color: "#1d4ed8", marginTop: "2px", fontFamily: "monospace" }}>
                  {meta.parent_phone || "0912345678"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: KHEN THƯỞNG & NGOẠI KHÓA */}
        {activeTab === "awards" && (
          <div>
            <h3 style={{ fontSize: "17px", fontWeight: 750, color: "#0f172a", marginBottom: "6px" }}>
              Thành tích Học bổng, Khen thưởng & Hoạt động Ngoại khóa
            </h3>
            <p style={{ fontSize: "13.5px", color: "#64748b", marginBottom: "20px" }}>
              Ghi nhận các giải thưởng nghiên cứu khoa học, danh hiệu thi đua và hoạt động Đoàn - Hội tại Đại học Kinh tế Quốc dân.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {(meta.awards && meta.awards.length > 0
                ? meta.awards
                : [
                    "Học bổng Khuyến khích học tập Loại Giỏi Học kỳ 1 (2025-2026)",
                    "Giải Ba Cuộc thi Nghiên cứu Khoa học Sinh viên cấp Khoa",
                    "Sinh viên 5 Tốt cấp Trường năm học 2024-2025",
                    "Thành viên tích cực CLB Nhà Kinh tế trẻ NEU (YEC)"
                  ]
              ).map((award, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    padding: "14px 18px",
                    borderRadius: "10px",
                    background: "#f0fdf4",
                    border: "1px solid #dcfce7"
                  }}
                >
                  <span
                    style={{
                      background: "#22c55e",
                      color: "#ffffff",
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}
                  >
                    <Award size={18} />
                  </span>
                  <div>
                    <strong style={{ fontSize: "14px", color: "#14532d" }}>{award}</strong>
                    <div style={{ fontSize: "12px", color: "#16a34a" }}>Được ghi nhận chính thức trong hồ sơ rèn luyện</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {editing && (
        <ContactEditModal
          student={student}
          onClose={() => setEditing(false)}
          onUpdated={(updated) => {
            onUpdateContact(updated);
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}

// =========================================================================
// MODAL CHI TIẾT HỒ SƠ DÀNH CHO ADMIN
// =========================================================================
function ProfileDetailModal({
  student,
  isAdmin,
  onClose,
  onUpdated
}: {
  student: Student;
  isAdmin: boolean;
  onClose: () => void;
  onUpdated: (row: Student) => void;
}) {
  const [modalTab, setModalTab] = useState<"general" | "academic" | "personal">("general");
  const [editing, setEditing] = useState(false);
  const meta = student.emergency_contact || {};

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="profile-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "780px", width: "95%", borderRadius: "18px" }}
      >
        <div className="profile-modal-top" style={{ paddingBottom: "16px", borderBottom: "1px solid #e2e8f0" }}>
          <span className="profile-large-avatar" style={{ background: "#e0f2fe", color: "#0369a1", fontWeight: 800 }}>
            {student.full_name.slice(0, 1)}
          </span>
          <div>
            <div className="eyebrow" style={{ color: "#0284c7" }}>HỒ SƠ SINH VIÊN NEU STUDY</div>
            <h2 style={{ fontSize: "20px", margin: "2px 0" }}>{student.full_name}</h2>
            <p style={{ fontFamily: "monospace", fontSize: "14px", color: "#1e3a8a", fontWeight: 700 }}>
              {student.student_number} · {student.major_name} ({student.cohort})
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Modal Tabs */}
        <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #e2e8f0", padding: "10px 0", marginBottom: "16px" }}>
          <button
            onClick={() => setModalTab("general")}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              border: "none",
              background: modalTab === "general" ? "#eff6ff" : "transparent",
              color: modalTab === "general" ? "#1d4ed8" : "#64748b",
              fontWeight: 650,
              fontSize: "13px",
              cursor: "pointer"
            }}
          >
            Tổng quan & Kết quả
          </button>
          <button
            onClick={() => setModalTab("academic")}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              border: "none",
              background: modalTab === "academic" ? "#eff6ff" : "transparent",
              color: modalTab === "academic" ? "#1d4ed8" : "#64748b",
              fontWeight: 650,
              fontSize: "13px",
              cursor: "pointer"
            }}
          >
            Học vụ & Cố vấn
          </button>
          <button
            onClick={() => setModalTab("personal")}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              border: "none",
              background: modalTab === "personal" ? "#eff6ff" : "transparent",
              color: modalTab === "personal" ? "#1d4ed8" : "#64748b",
              fontWeight: 650,
              fontSize: "13px",
              cursor: "pointer"
            }}
          >
            Nhân thân & CCCD
          </button>
        </div>

        {modalTab === "general" && (
          <div className="profile-detail-grid" style={{ marginBottom: "16px" }}>
            <ProfileField label="Email sinh viên" value={student.email} />
            <ProfileField label="Số điện thoại" value={student.phone || "Chưa cập nhật"} />
            <ProfileField label="Ngành đào tạo" value={student.major_name} />
            <ProfileField label="Khóa / Lớp" value={`${student.cohort} · ${student.class_name || "Chưa xếp lớp"}`} />
            <ProfileField label="GPA Hệ 4" value={`${meta.gpa_4 ?? "—"} / 4.0 (${meta.academic_rank ?? "Giỏi"})`} />
            <ProfileField label="Tín chỉ tích lũy" value={`${meta.credits_accumulated ?? "—"} / 130 tín chỉ`} />
            <ProfileField label="Điểm rèn luyện" value={`${meta.training_points ?? "—"} (${meta.training_rank ?? "Tốt"})`} />
            <ProfileField label="Trạng thái học vụ" value={student.study_status} />
          </div>
        )}

        {modalTab === "academic" && (
          <div className="profile-detail-grid" style={{ marginBottom: "16px" }}>
            <ProfileField label="Khoa / Viện chủ quản" value={meta.faculty || "Khoa Công nghệ thông tin"} />
            <ProfileField label="Hệ đào tạo" value={meta.program_type || "Chính quy chuẩn"} />
            <ProfileField label="Cố vấn học tập" value={meta.advisor_name || "TS. Nguyễn Hoàng Nam"} />
            <ProfileField label="Email cố vấn" value={meta.advisor_email || "namnh@neu.edu.vn"} />
            <ProfileField label="Chuẩn Ngoại ngữ" value={meta.english_cert || "IELTS 6.5 (Đạt)"} />
            <ProfileField label="Chuẩn Tin học" value={meta.it_cert || "MOS Word, Excel (Đạt)"} />
            <ProfileField label="Ngày nhập học" value={student.enrollment_date ? new Date(student.enrollment_date).toLocaleDateString("vi-VN") : "05/09/2026"} />
            <ProfileField label="Thời gian đào tạo" value="4 năm (8 học kỳ chính)" />
          </div>
        )}

        {modalTab === "personal" && (
          <div className="profile-detail-grid" style={{ marginBottom: "16px" }}>
            <ProfileField label="Số CCCD" value={meta.citizen_id || "001202018899"} />
            <ProfileField label="Ngày cấp CCCD" value={meta.citizen_issued_date || "15/04/2021"} />
            <ProfileField label="Nơi cấp" value={meta.citizen_issued_place || "Cục Cảnh sát QLHC về TTXH"} />
            <ProfileField label="Dân tộc / Tôn giáo" value={`${meta.ethnic || "Kinh"} / ${meta.religion || "Không"}`} />
            <ProfileField label="Quê quán" value={meta.hometown || "Nam Định"} />
            <ProfileField label="Địa chỉ hiện tại" value={student.address || "Chưa cập nhật"} />
            <ProfileField label="Người giám hộ" value={meta.parent_name || "Trần Văn Hùng"} />
            <ProfileField label="SĐT Người giám hộ" value={meta.parent_phone || "0912345678"} />
          </div>
        )}

        {student.is_demo && (
          <div className="profile-demo" style={{ marginBottom: "16px" }}>
            <DemoTag /> Dữ liệu hồ sơ mẫu minh họa quản lý thông tin sinh viên NEU Study.
          </div>
        )}

        <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button className="button button-ghost" onClick={onClose}>
            Đóng
          </button>
          <button className="button button-secondary" onClick={() => setEditing(true)}>
            <UserRoundPen size={14} /> Chỉnh sửa liên hệ
          </button>
        </div>

        {editing && (
          <ContactEditModal
            student={student}
            isAdmin={isAdmin}
            onClose={() => setEditing(false)}
            onUpdated={(updated) => {
              onUpdated(updated);
              setEditing(false);
            }}
          />
        )}
      </section>
    </div>
  );
}

// =========================================================================
// MODAL CẬP NHẬT THÔNG TIN LIÊN HỆ
// =========================================================================
function ContactEditModal({
  student,
  isAdmin = false,
  onClose,
  onUpdated
}: {
  student: Student;
  isAdmin?: boolean;
  onClose: () => void;
  onUpdated: (row: Student) => void;
}) {
  const [phone, setPhone] = useState(student.phone);
  const [address, setAddress] = useState(student.address ?? "");
  const [gender, setGender] = useState(student.gender ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const path = isAdmin ? `/profiles/students/${student.id}` : "/profiles/me";
      const updated = await api<Student>(path, {
        method: "PATCH",
        body: JSON.stringify({ phone, address, gender })
      });
      onUpdated(updated);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không lưu được thông tin.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <section
        className="profile-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "520px" }}
      >
        <div className="profile-modal-top">
          <div>
            <div className="eyebrow">CẬP NHẬT LIÊN HỆ</div>
            <h2>{student.full_name}</h2>
            <p>{student.student_number}</p>
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form className="form-stack" onSubmit={save}>
          <label>
            Số điện thoại
            <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} required />
          </label>
          <label>
            Giới tính
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1"
              }}
            >
              <option value="Nam">Nam</option>
              <option value="Nữ">Nữ</option>
              <option value="Khác">Khác</option>
            </select>
          </label>
          <label>
            Địa chỉ thường trú / Nơi ở hiện tại
            <textarea rows={3} value={address} onChange={(e) => setAddress(e.target.value)} maxLength={500} required />
          </label>

          {error && <div className="inline-error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="button button-ghost" onClick={onClose}>
              Hủy
            </button>
            <button className="button button-primary" disabled={busy}>
              {busy ? "Đang lưu…" : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="profile-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProfileItemCard({
  label,
  value,
  highlight = false,
  mono = false,
  badge = false
}: {
  label: string;
  value: string;
  highlight?: boolean;
  mono?: boolean;
  badge?: boolean;
}) {
  return (
    <div
      style={{
        background: highlight ? "#f0fdf4" : "#f8fafc",
        padding: "14px 16px",
        borderRadius: "10px",
        border: highlight ? "1px solid #bbf7d0" : "1px solid #f1f5f9"
      }}
    >
      <div style={{ fontSize: "12px", color: highlight ? "#166534" : "#64748b", marginBottom: "4px" }}>
        {label}
      </div>
      {badge ? (
        <StatusBadge>{value}</StatusBadge>
      ) : (
        <div
          style={{
            fontSize: "14.5px",
            fontWeight: highlight ? 750 : 650,
            color: highlight ? "#14532d" : "#1e293b",
            fontFamily: mono ? "monospace" : "inherit"
          }}
        >
          {value || "Chưa cập nhật"}
        </div>
      )}
    </div>
  );
}
