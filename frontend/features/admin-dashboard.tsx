"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  FileCheck,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Unlock,
  UserCheck,
  UserPlus,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { api, API_BASE, Faculty, Major, User } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { EmptyState, ErrorNotice, Loading, PageTitle, StatusBadge } from "@/components/ui";
import { KnowledgeAdmin } from "./knowledge-admin";

type AdminStats = {
  students: number;
  applications: number;
  personnel: number;
  pending_requests: number;
};

export function AdminDashboard() {
  const params = useSearchParams();
  const { user } = useAuth();
  const initialTab =
    (params.get("tab") as "overview" | "system" | "kb") || "overview";

  const [activeTab, setActiveTab] = useState<"overview" | "system" | "kb">(initialTab);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [majors, setMajors] = useState<Major[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("");

  // Modal tạo tài khoản người dùng mới (AD1)
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newPassword, setNewPassword] = useState("StudyDemo2026!");
  const [newRole, setNewRole] = useState<"ADMIN" | "GIANG_VIEN" | "SINH_VIEN">("SINH_VIEN");
  const [savingUser, setSavingUser] = useState(false);

  // Modal thêm khoa / ngành mới (AD2)
  const [facultyModalOpen, setFacultyModalOpen] = useState(false);
  const [newFacultyName, setNewFacultyName] = useState("");
  const [savingFaculty, setSavingFaculty] = useState(false);

  const [majorModalOpen, setMajorModalOpen] = useState(false);
  const [newMajorCode, setNewMajorCode] = useState("");
  const [newMajorName, setNewMajorName] = useState("");
  const [newMajorFacultyId, setNewMajorFacultyId] = useState("");
  const [newMajorTuition, setNewMajorTuition] = useState(25000000);
  const [newMajorQuota, setNewMajorQuota] = useState(150);
  const [savingMajor, setSavingMajor] = useState(false);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [uList, fList, mList, dash] = await Promise.all([
        api<User[]>("/admin/users").catch(() => []),
        api<Faculty[]>("/faculties").catch(() => []),
        api<Major[]>("/majors").catch(() => []),
        api<any>("/dashboard").catch(() => ({})),
      ]);
      setUsers(uList);
      setFaculties(fList);
      setMajors(mList);
      if (fList.length > 0 && !newMajorFacultyId) {
        setNewMajorFacultyId(fList[0].id);
      }
      setStats({
        students: dash.students || 0,
        applications: dash.applications || 0,
        personnel: 20,
        pending_requests: dash.pending_tickets || 0,
      });
    } catch (err: any) {
      setError(err?.message || "Không thể tải dữ liệu quản trị.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [user]);

  // Tạo tài khoản người dùng mới (AD1)
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setSavingUser(true);
    setError("");
    try {
      const created = await api<User>("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: newEmail.trim(),
          full_name: newFullName.trim(),
          password: newPassword,
          role: newRole,
        }),
      });
      setUsers([created, ...users]);
      setUserModalOpen(false);
      setNewEmail("");
      setNewFullName("");
      setMessage(`Đã tạo tài khoản cho ${created.full_name} (${created.role}) thành công.`);
    } catch (err: any) {
      setError(err?.message || "Lỗi khi tạo tài khoản.");
    } finally {
      setSavingUser(false);
    }
  }

  // Khóa / Mở khóa tài khoản (AD1)
  async function toggleUserStatus(u: User, currentActive: boolean) {
    try {
      const updated = await api<User>(`/admin/users/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !currentActive }),
      });
      setUsers(users.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
      setMessage(`Đã ${!currentActive ? "kích hoạt" : "tạm khóa"} tài khoản ${u.email}.`);
    } catch (err: any) {
      setError(err?.message || "Lỗi cập nhật tài khoản.");
    }
  }

  // Thêm Khoa mới (AD2)
  async function handleCreateFaculty(e: React.FormEvent) {
    e.preventDefault();
    setSavingFaculty(true);
    try {
      const created = await api<Faculty>("/admin/faculties", {
        method: "POST",
        body: JSON.stringify({ name: newFacultyName.trim() }),
      });
      setFaculties([...faculties, created]);
      setFacultyModalOpen(false);
      setNewFacultyName("");
      setMessage(`Đã thêm khoa "${created.name}" vào danh mục.`);
    } catch (err: any) {
      setError(err?.message || "Không thể thêm khoa.");
    } finally {
      setSavingFaculty(false);
    }
  }

  // Thêm Ngành mới (AD2)
  async function handleCreateMajor(e: React.FormEvent) {
    e.preventDefault();
    setSavingMajor(true);
    try {
      const created = await api<Major>("/admin/majors", {
        method: "POST",
        body: JSON.stringify({
          code: newMajorCode.trim(),
          name: newMajorName.trim(),
          faculty_id: newMajorFacultyId,
          tuition_per_year_vnd: Number(newMajorTuition),
          admission_quota: Number(newMajorQuota),
        }),
      });
      setMajors([...majors, created]);
      setMajorModalOpen(false);
      setNewMajorCode("");
      setNewMajorName("");
      setMessage(`Đã thêm ngành "${created.name}" (${created.code}) vào danh mục.`);
    } catch (err: any) {
      setError(err?.message || "Không thể thêm ngành.");
    } finally {
      setSavingMajor(false);
    }
  }

  const visibleUsers = useMemo(() => {
    return users.filter((u) => {
      const matchText = `${u.full_name} ${u.email}`.toLowerCase().includes(userQuery.toLowerCase());
      const matchRole = !userRoleFilter || u.role.toUpperCase() === userRoleFilter.toUpperCase();
      return matchText && matchRole;
    });
  }, [users, userQuery, userRoleFilter]);

  return (
    <div className="module-page" style={{ maxWidth: "1240px", margin: "0 auto", paddingBottom: "60px" }}>
      <PageTitle
        eyebrow="QUẢN TRỊ TOÀN DIỆN · UNIFIED ADMIN DASHBOARD"
        title="Trung tâm Quản trị NEU Study"
        description="Quản trị tập trung 3 module Tuyển sinh, Nhân sự, Hỗ trợ người học và Cấu hình hệ thống."
        action={
          <div style={{ display: "flex", gap: "10px" }}>
            <button className="button button-ghost" onClick={() => loadData()}>
              <RefreshCw size={15} /> Làm mới
            </button>
            <button className="button button-primary" onClick={() => setUserModalOpen(true)}>
              <UserPlus size={16} /> Thêm tài khoản
            </button>
          </div>
        }
      />

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

      {/* Tabs Quản trị hợp nhất */}
      <div className="personnel-tabs" style={{ marginBottom: "22px" }}>
        <button className={activeTab === "overview" ? "active" : ""} onClick={() => setActiveTab("overview")}>
          <LayoutDashboard size={16} /> Tổng quan hệ thống
        </button>
        <button className={activeTab === "system" ? "active" : ""} onClick={() => setActiveTab("system")}>
          <Settings size={16} /> Quản lý tài khoản & Danh mục
        </button>
        <button className={activeTab === "kb" ? "active" : ""} onClick={() => setActiveTab("kb")}>
          <BookOpen size={16} /> Kho tri thức AI Assistant
        </button>
      </div>

      {loading ? (
        <Loading />
      ) : activeTab === "overview" ? (
        /* ================= TAB 1: TỔNG QUAN HỆ THỐNG ================= */
        <div>
          {stats && (
            <div className="personnel-stat-grid" style={{ marginBottom: "28px" }}>
              <div className="personnel-stat-card">
                <span>
                  <GraduationCap size={18} /> Sinh viên chính quy
                </span>
                <strong>{stats.students}</strong>
                <small>Hồ sơ sinh viên đang quản lý</small>
              </div>
              <div className="personnel-stat-card">
                <span>
                  <FileText size={18} /> Hồ sơ tuyển sinh
                </span>
                <strong>{stats.applications}</strong>
                <small>Hồ sơ đăng ký xét tuyển 2026</small>
              </div>
              <div className="personnel-stat-card">
                <span>
                  <UsersRound size={18} /> Cán bộ & Giảng viên
                </span>
                <strong>{stats.personnel}</strong>
                <small>Đội ngũ giảng viên và nhân viên</small>
              </div>
              <div className="personnel-stat-card">
                <span>
                  <Clock size={18} /> Yêu cầu & Đơn cần xử lý
                </span>
                <strong>{stats.pending_requests}</strong>
                <small>Đang chờ bộ phận tiếp nhận</small>
              </div>
            </div>
          )}

          {/* Quick links tới 3 module chính */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px", marginBottom: "28px" }}>
            <div
              style={{
                background: "var(--card-bg, #ffffff)",
                border: "1px solid var(--border-color, #e2e8f0)",
                borderRadius: "14px",
                padding: "24px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", color: "#0284c7" }}>
                <FileCheck size={22} />
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700 }}>Phân hệ Tuyển sinh</h3>
              </div>
              <p style={{ margin: "0 0 16px", fontSize: "13.5px", color: "#64748b", lineHeight: "1.5" }}>
                Duyệt hồ sơ thí sinh, cập nhật điểm xét tuyển và chuyển hồ sơ trúng tuyển thành tài khoản sinh viên chính thức.
              </p>
              <a href="/admissions" className="button button-primary" style={{ fontSize: "13px", display: "inline-block" }}>
                Vào Quản lý Tuyển sinh →
              </a>
            </div>

            <div
              style={{
                background: "var(--card-bg, #ffffff)",
                border: "1px solid var(--border-color, #e2e8f0)",
                borderRadius: "14px",
                padding: "24px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", color: "#16a34a" }}>
                <UsersRound size={22} />
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700 }}>Phân hệ Nhân sự</h3>
              </div>
              <p style={{ margin: "0 0 16px", fontSize: "13.5px", color: "#64748b", lineHeight: "1.5" }}>
                Phê duyệt lý lịch khoa học, quản lý hợp đồng lao động, cảnh báo hợp đồng 60 ngày và xuất Excel danh sách cán bộ.
              </p>
              <a href="/personnel" className="button button-primary" style={{ fontSize: "13px", display: "inline-block" }}>
                Vào Quản lý Nhân sự →
              </a>
            </div>

            <div
              style={{
                background: "var(--card-bg, #ffffff)",
                border: "1px solid var(--border-color, #e2e8f0)",
                borderRadius: "14px",
                padding: "24px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", color: "#f59e0b" }}>
                <FileText size={22} />
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700 }}>Phân hệ Hỗ trợ người học</h3>
              </div>
              <p style={{ margin: "0 0 16px", fontSize: "13.5px", color: "#64748b", lineHeight: "1.5" }}>
                Dịch vụ một cửa giải quyết đơn sinh viên (xác nhận, bảng điểm, bảo lưu), phân công cho giảng viên và xem đánh giá.
              </p>
              <a href="/support" className="button button-primary" style={{ fontSize: "13px", display: "inline-block" }}>
                Vào Quản lý Hỗ trợ →
              </a>
            </div>
          </div>
        </div>
      ) : activeTab === "system" ? (
        /* ================= TAB 2: QUẢN LÝ TÀI KHOẢN & DANH MỤC (AD1, AD2) ================= */
        <div>
          {/* Section 1: Quản lý tài khoản (AD1) */}
          <div style={{ marginBottom: "32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 4px" }}>Quản lý Tài khoản người dùng (AD1)</h3>
                <p style={{ margin: 0, color: "#64748b", fontSize: "13.5px" }}>
                  Phân quyền chuẩn hóa theo đúng 3 vai trò: <strong>ADMIN</strong>, <strong>GIANG_VIEN</strong>, <strong>SINH_VIEN</strong>.
                </p>
              </div>
              <button className="button button-primary" onClick={() => setUserModalOpen(true)}>
                <UserPlus size={16} /> Thêm tài khoản
              </button>
            </div>

            <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
              <div className="search-field" style={{ flex: 1 }}>
                <Search size={16} />
                <input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="Tìm theo tên hoặc email..." />
              </div>
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13.5px" }}
              >
                <option value="">Tất cả vai trò</option>
                <option value="ADMIN">ADMIN (Quản trị viên)</option>
                <option value="GIANG_VIEN">GIANG_VIEN (Giảng viên)</option>
                <option value="SINH_VIEN">SINH_VIEN (Sinh viên)</option>
              </select>
            </div>

            <div className="table-panel">
              <div className="responsive-table">
                <table>
                  <thead>
                    <tr>
                      <th>Họ và tên</th>
                      <th>Email tài khoản</th>
                      <th>Vai trò hệ thống</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleUsers.map((u: any) => (
                      <tr key={u.id}>
                        <td>
                          <strong>{u.full_name}</strong>
                        </td>
                        <td>{u.email}</td>
                        <td>
                          <span
                            style={{
                              padding: "3px 10px",
                              borderRadius: "999px",
                              fontSize: "12px",
                              fontWeight: 700,
                              background:
                                u.role === "ADMIN" || u.role === "super_admin"
                                  ? "#e0e7ff"
                                  : u.role === "GIANG_VIEN" || u.role === "lecturer"
                                  ? "#dcfce7"
                                  : "#f1f5f9",
                              color:
                                u.role === "ADMIN" || u.role === "super_admin"
                                  ? "#4338ca"
                                  : u.role === "GIANG_VIEN" || u.role === "lecturer"
                                  ? "#15803d"
                                  : "#334155",
                            }}
                          >
                            {u.role.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: u.is_active !== false ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                            {u.is_active !== false ? "● Hoạt động" : "○ Đã khóa"}
                          </span>
                        </td>
                        <td>
                          <button
                            className="mini-button"
                            onClick={() => toggleUserStatus(u, u.is_active !== false)}
                          >
                            {u.is_active !== false ? "Khóa" : "Kích hoạt"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section 2: Quản lý Khoa & Ngành (AD2) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            {/* Cột Khoa */}
            <div
              style={{
                background: "var(--card-bg, #ffffff)",
                border: "1px solid var(--border-color, #e2e8f0)",
                borderRadius: "14px",
                padding: "20px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>Danh mục Khoa / Viện ({faculties.length})</h4>
                <button className="button button-ghost" style={{ fontSize: "12.5px" }} onClick={() => setFacultyModalOpen(true)}>
                  <Plus size={14} /> Thêm khoa
                </button>
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {faculties.map((f) => (
                  <li
                    key={f.id}
                    style={{
                      padding: "8px 12px",
                      borderBottom: "1px solid #f1f5f9",
                      fontSize: "13.5px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Building2 size={15} color="#0284c7" />
                    <strong>{f.name}</strong>
                  </li>
                ))}
              </ul>
            </div>

            {/* Cột Ngành */}
            <div
              style={{
                background: "var(--card-bg, #ffffff)",
                border: "1px solid var(--border-color, #e2e8f0)",
                borderRadius: "14px",
                padding: "20px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>Danh mục Ngành đào tạo ({majors.length})</h4>
                <button className="button button-ghost" style={{ fontSize: "12.5px" }} onClick={() => setMajorModalOpen(true)}>
                  <Plus size={14} /> Thêm ngành
                </button>
              </div>
              <div style={{ maxHeight: "320px", overflowY: "auto" }}>
                {majors.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      padding: "8px 12px",
                      borderBottom: "1px solid #f1f5f9",
                      fontSize: "13px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <strong>{m.name}</strong> <small style={{ color: "#64748b" }}>({m.code})</small>
                    </div>
                    <span style={{ fontSize: "12px", color: "#0284c7" }}>{m.faculty_name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ================= TAB 3: KHO TRI THỨC AI ================= */
        <KnowledgeAdmin />
      )}

      {/* MODAL TẠO TÀI KHOẢN MỚI (AD1) */}
      {userModalOpen && (
        <div className="modal-backdrop" onClick={() => setUserModalOpen(false)}>
          <section className="form-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
            <div className="modal-heading">
              <div>
                <div className="eyebrow">QUẢN LÝ NGƯỜI DÙNG</div>
                <h2>Thêm tài khoản hệ thống</h2>
                <p>Khởi tạo tài khoản theo đúng 3 vai trò chuẩn: ADMIN, GIANG_VIEN, SINH_VIEN.</p>
              </div>
              <button className="modal-close" onClick={() => setUserModalOpen(false)}>
                ×
              </button>
            </div>

            <form className="form-stack" onSubmit={handleCreateUser}>
              <label>
                Họ và tên *
                <input required value={newFullName} onChange={(e) => setNewFullName(e.target.value)} placeholder="Nguyễn Văn A" />
              </label>

              <label>
                Email đăng nhập *
                <input required type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@study.edu.vn" />
              </label>

              <label>
                Mật khẩu khởi tạo *
                <input required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </label>

              <label>
                Vai trò tài khoản *
                <select value={newRole} onChange={(e) => setNewRole(e.target.value as any)}>
                  <option value="ADMIN">ADMIN - Quản trị viên toàn hệ thống</option>
                  <option value="GIANG_VIEN">GIANG_VIEN - Cán bộ giảng viên</option>
                  <option value="SINH_VIEN">SINH_VIEN - Sinh viên chính quy</option>
                </select>
              </label>

              <div className="modal-actions">
                <button type="button" className="button button-ghost" onClick={() => setUserModalOpen(false)}>
                  Hủy
                </button>
                <button type="submit" className="button button-primary" disabled={savingUser}>
                  {savingUser ? "Đang lưu..." : "Tạo tài khoản"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* MODAL THÊM KHOA MỚI (AD2) */}
      {facultyModalOpen && (
        <div className="modal-backdrop" onClick={() => setFacultyModalOpen(false)}>
          <section className="form-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "420px" }}>
            <div className="modal-heading">
              <div>
                <div className="eyebrow">DANH MỤC KHOA / VIỆN</div>
                <h2>Thêm Khoa đào tạo</h2>
              </div>
              <button className="modal-close" onClick={() => setFacultyModalOpen(false)}>
                ×
              </button>
            </div>

            <form className="form-stack" onSubmit={handleCreateFaculty}>
              <label>
                Tên khoa / viện *
                <input required value={newFacultyName} onChange={(e) => setNewFacultyName(e.target.value)} placeholder="Khoa Kinh tế quốc tế..." />
              </label>

              <div className="modal-actions">
                <button type="button" className="button button-ghost" onClick={() => setFacultyModalOpen(false)}>
                  Hủy
                </button>
                <button type="submit" className="button button-primary" disabled={savingFaculty}>
                  {savingFaculty ? "Đang lưu..." : "Thêm khoa"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* MODAL THÊM NGÀNH MỚI (AD2) */}
      {majorModalOpen && (
        <div className="modal-backdrop" onClick={() => setMajorModalOpen(false)}>
          <section className="form-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
            <div className="modal-heading">
              <div>
                <div className="eyebrow">DANH MỤC NGÀNH ĐÀO TẠO</div>
                <h2>Thêm Ngành đào tạo mới</h2>
              </div>
              <button className="modal-close" onClick={() => setMajorModalOpen(false)}>
                ×
              </button>
            </div>

            <form className="form-stack" onSubmit={handleCreateMajor}>
              <div className="form-row">
                <label>
                  Mã ngành *
                  <input required value={newMajorCode} onChange={(e) => setNewMajorCode(e.target.value)} placeholder="7480201" />
                </label>
                <label>
                  Tên ngành đào tạo *
                  <input required value={newMajorName} onChange={(e) => setNewMajorName(e.target.value)} placeholder="Trí tuệ nhân tạo..." />
                </label>
              </div>

              <label>
                Khoa trực thuộc *
                <select value={newMajorFacultyId} onChange={(e) => setNewMajorFacultyId(e.target.value)}>
                  {faculties.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="form-row">
                <label>
                  Học phí / năm (VNĐ)
                  <input
                    type="number"
                    step="1000000"
                    value={newMajorTuition}
                    onChange={(e) => setNewMajorTuition(Number(e.target.value))}
                  />
                </label>
                <label>
                  Chỉ tiêu tuyển sinh
                  <input
                    type="number"
                    value={newMajorQuota}
                    onChange={(e) => setNewMajorQuota(Number(e.target.value))}
                  />
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="button button-ghost" onClick={() => setMajorModalOpen(false)}>
                  Hủy
                </button>
                <button type="submit" className="button button-primary" disabled={savingMajor}>
                  {savingMajor ? "Đang lưu..." : "Thêm ngành"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
