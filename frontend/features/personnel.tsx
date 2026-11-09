"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  Clock,
  Download,
  GraduationCap,
  Plus,
  Search,
  UsersRound,
  XCircle,
} from "lucide-react";
import { API_BASE, api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { EmptyState, ErrorNotice, Loading, PageTitle, StatusBadge } from "@/components/ui";

type Kind = "lecturer" | "employee";
type PersonnelRecord = {
  id: string;
  code: string;
  kind: Kind;
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string | null;
  gender: string;
  address: string;
  avatar_url: string;
  education_level: string;
  academic_rank: string;
  specialty: string;
  faculty_id: string | null;
  faculty_name: string | null;
  department: string;
  position: string;
  start_date: string | null;
  work_status: string;
  profile_status?: string;
  rejection_reason?: string;
  pending_updates?: Record<string, any>;
  notes: string;
  is_demo: boolean;
};

type Faculty = { id: string; name: string };
type PersonnelDashboard = {
  lecturers: number;
  employees: number;
  total: number;
  active: number;
  inactive: number;
  pending_approval?: number;
  expiring_contracts?: number;
  by_status: { name: string; count: number }[];
  by_unit: { name: string; count: number }[];
};

const statuses = ["Đang công tác", "Tạm nghỉ", "Đã nghỉ việc"];

export function Personnel({ initialKind = "" }: { initialKind?: "" | Kind }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<PersonnelRecord[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [dashboard, setDashboard] = useState<PersonnelDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [department, setDepartment] = useState("");
  const [selected, setSelected] = useState<PersonnelRecord | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const pageTitle =
    initialKind === "lecturer" ? "Hồ sơ giảng viên" : initialKind === "employee" ? "Hồ sơ nhân viên" : "Tổng quan nhân sự";

  const loadData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (initialKind) params.set("kind", initialKind);
    if (query.trim()) params.set("q", query.trim());
    if (status) params.set("status", status);
    if (department.trim()) params.set("department", department.trim());

    api<PersonnelRecord[]>(`/personnel${params.size ? `?${params}` : ""}`)
      .then((people) => {
        setRows(people);
        setError("");
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Không tải được hồ sơ nhân sự."))
      .finally(() => setLoading(false));
  }, [initialKind, query, status, department]);

  useEffect(() => {
    const timer = setTimeout(loadData, 200);
    return () => clearTimeout(timer);
  }, [loadData]);

  useEffect(() => {
    Promise.all([api<PersonnelDashboard>("/personnel/dashboard"), api<Faculty[]>("/faculties")])
      .then(([summary, facultyRows]) => {
        setDashboard(summary);
        setFaculties(facultyRows);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Không tải được tổng quan nhân sự."));
  }, [user?.id]);

  function upsert(record: PersonnelRecord) {
    setRows((current) =>
      current.some((row) => row.id === record.id)
        ? current.map((row) => (row.id === record.id ? record : row))
        : [...current, record].sort((a, b) => a.code.localeCompare(b.code))
    );
    setSelected(record);
    setCreateOpen(false);
    void api<PersonnelDashboard>("/personnel/dashboard").then(setDashboard).catch(() => {});
  }

  // Xuất file Excel danh sách nhân sự (AD_NS5)
  async function exportExcel() {
    try {
      const token = typeof window !== "undefined" ? window.sessionStorage.getItem("study_access_token") : null;
      const res = await fetch(`${API_BASE}/personnel/export/excel`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Không thể tải file Excel.");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `danh_sach_nhan_su_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      setMessage("Đã xuất danh sách nhân sự thành công ra file Excel (.xlsx).");
    } catch (err: any) {
      setError(err?.message || "Lỗi khi xuất file Excel.");
    }
  }

  const staffKind = initialKind === "lecturer" ? "giảng viên" : "nhân viên";

  return (
    <div className="module-page">
      <PageTitle
        eyebrow="QUẢN LÝ HỒ SƠ"
        title={pageTitle}
        description="Quản lý tập trung hồ sơ giảng viên và nhân viên theo đơn vị, chức vụ, trạng thái công tác và phê duyệt lý lịch."
        action={
          <div style={{ display: "flex", gap: "10px" }}>
            <button className="button button-ghost" onClick={exportExcel} title="Tải danh sách Excel">
              <Download size={16} /> Xuất Excel
            </button>
            <button className="button button-primary" onClick={() => setCreateOpen(true)}>
              <Plus size={17} /> Thêm {initialKind ? staffKind : "nhân sự"}
            </button>
          </div>
        }
      />

      {/* Banner cảnh báo hồ sơ chờ duyệt và hợp đồng sắp hết hạn */}
      {dashboard && (dashboard.pending_approval || dashboard.expiring_contracts) ? (
        <div
          style={{
            background: "#fef3c7",
            border: "1px solid #f59e0b",
            borderRadius: "10px",
            padding: "12px 18px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            color: "#92400e",
            fontSize: "14px",
          }}
        >
          <AlertTriangle size={20} className="flex-shrink-0" />
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
            {dashboard.pending_approval ? (
              <span>
                <strong>{dashboard.pending_approval}</strong> hồ sơ giảng viên đang chờ duyệt cập nhật.
              </span>
            ) : null}
            {dashboard.expiring_contracts ? (
              <span>
                <strong>{dashboard.expiring_contracts}</strong> hợp đồng lao động sắp hết hạn trong vòng 60 ngày!
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {message && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #22c55e",
            borderRadius: "10px",
            padding: "12px 16px",
            marginBottom: "16px",
            color: "#15803d",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <CheckCircle2 size={18} />
          <span>{message}</span>
        </div>
      )}

      {error && <ErrorNotice message={error} />}

      {dashboard && (
        <div className="personnel-stat-grid">
          <div className="personnel-stat-card">
            <span>
              <UsersRound size={18} /> Tổng nhân sự
            </span>
            <strong>{dashboard.total}</strong>
            <small>
              {dashboard.active} đang công tác · {dashboard.inactive} nghỉ/tạm nghỉ
            </small>
          </div>
          <div className="personnel-stat-card">
            <span>
              <GraduationCap size={19} /> Giảng viên
            </span>
            <strong>{dashboard.lecturers}</strong>
            <small>Hồ sơ học thuật và giảng dạy</small>
          </div>
          <div className="personnel-stat-card">
            <span>
              <BriefcaseBusiness size={18} /> Nhân viên
            </span>
            <strong>{dashboard.employees}</strong>
            <small>Hồ sơ theo phòng ban và vị trí</small>
          </div>
          <div className="personnel-stat-card status-breakdown">
            <span>Tình trạng làm việc</span>
            <div>
              {dashboard.by_status.map((item) => (
                <span key={item.name}>
                  <i className={item.name === "Đang công tác" ? "active" : "inactive"} />
                  {item.name}
                  <strong>{item.count}</strong>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="personnel-tabs">
        <a className={initialKind === "" ? "active" : ""} href="/personnel">
          Tổng quan
        </a>
        <a className={initialKind === "lecturer" ? "active" : ""} href="/personnel/lecturers">
          Giảng viên
        </a>
        <a className={initialKind === "employee" ? "active" : ""} href="/personnel/employees">
          Nhân viên
        </a>
      </div>

      <div className="personnel-toolbar">
        <div className="toolbar-count">
          {initialKind ? `Danh sách ${staffKind}` : "Tất cả hồ sơ"} <strong>{rows.length}</strong>
        </div>
        <label className="search-field">
          <Search size={17} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tên, mã, khoa, chuyên môn…" />
        </label>
        <label>
          <span className="sr-only">Lọc phòng ban</span>
          <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Khoa / phòng ban" />
        </label>
        <select aria-label="Lọc trạng thái công tác" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Mọi trạng thái</option>
          {statuses.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<UsersRound size={24} />}
          title="Chưa có hồ sơ phù hợp"
          description="Thay đổi bộ lọc hoặc thêm hồ sơ nhân sự mới."
          action={
            <button className="button button-secondary" onClick={() => setCreateOpen(true)}>
              Thêm hồ sơ
            </button>
          }
        />
      ) : (
        <div className="table-panel">
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Mã hồ sơ</th>
                  <th>Họ và tên</th>
                  <th>Đơn vị / chuyên môn</th>
                  <th>Chức vụ</th>
                  <th>Liên hệ</th>
                  <th>Trạng thái duyệt</th>
                  <th>Công tác</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong className="mono">{row.code}</strong>
                      <small className="personnel-kind">{row.kind === "lecturer" ? "Giảng viên" : "Nhân viên"}</small>
                    </td>
                    <td>
                      <div className="person-cell">
                        {row.avatar_url ? (
                          <img className="personnel-avatar" src={row.avatar_url} alt="" />
                        ) : (
                          <span className="avatar small-avatar">{row.full_name.slice(0, 1)}</span>
                        )}
                        <span>
                          <strong>{row.full_name}</strong>
                          <small>{row.email}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      {row.faculty_name || row.department || "Chưa phân đơn vị"}
                      <small className="personnel-kind">{row.specialty || row.education_level || ""}</small>
                    </td>
                    <td>{row.position || "—"}</td>
                    <td>{row.phone || "—"}</td>
                    <td>
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: "999px",
                          fontSize: "11px",
                          fontWeight: 600,
                          background:
                            row.profile_status === "DA_DUYET"
                              ? "#dcfce7"
                              : row.profile_status === "CHO_DUYET"
                              ? "#fef3c7"
                              : "#fee2e2",
                          color:
                            row.profile_status === "DA_DUYET"
                              ? "#15803d"
                              : row.profile_status === "CHO_DUYET"
                              ? "#b45309"
                              : "#b91c1c",
                        }}
                      >
                        {row.profile_status === "DA_DUYET"
                          ? "Đã duyệt"
                          : row.profile_status === "CHO_DUYET"
                          ? "⏳ Chờ duyệt"
                          : "✕ Từ chối"}
                      </span>
                    </td>
                    <td>
                      <StatusBadge>{row.work_status}</StatusBadge>
                    </td>
                    <td>
                      <button className="mini-button" onClick={() => setSelected(row)}>
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && (
        <PersonnelDialog
          record={selected}
          faculties={faculties}
          onClose={() => setSelected(null)}
          onSaved={upsert}
          onReviewed={() => {
            loadData();
            setSelected(null);
          }}
        />
      )}
      {createOpen && (
        <PersonnelDialog
          kind={initialKind || "lecturer"}
          faculties={faculties}
          onClose={() => setCreateOpen(false)}
          onSaved={upsert}
        />
      )}
    </div>
  );
}

const emptyRecord = (kind: Kind): PersonnelRecord => ({
  id: "",
  code: "",
  kind,
  full_name: "",
  email: "",
  phone: "",
  date_of_birth: null,
  gender: "Chưa cập nhật",
  address: "",
  avatar_url: "",
  education_level: "",
  academic_rank: "",
  specialty: "",
  faculty_id: null,
  faculty_name: null,
  department: "",
  position: "",
  start_date: null,
  work_status: "Đang công tác",
  profile_status: "DA_DUYET",
  notes: "",
  is_demo: true,
});

function PersonnelDialog({
  record,
  kind,
  faculties,
  onClose,
  onSaved,
  onReviewed,
}: {
  record?: PersonnelRecord;
  kind?: Kind;
  faculties: Faculty[];
  onClose: () => void;
  onSaved: (row: PersonnelRecord) => void;
  onReviewed?: () => void;
}) {
  const [editing, setEditing] = useState(!record);
  const [value, setValue] = useState<PersonnelRecord>(() => (record ? { ...record } : emptyRecord(kind ?? "lecturer")));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  function change(field: string, next: string) {
    setValue((current) => ({ ...current, [field]: next }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const payload = {
      ...value,
      date_of_birth: value.date_of_birth || null,
      start_date: value.start_date || null,
      faculty_id: value.faculty_id || null,
    };
    try {
      const { id: _id, faculty_name: _facultyName, is_demo: _isDemo, ...personnelPayload } = payload;
      const body = record
        ? Object.fromEntries(Object.entries(personnelPayload).filter(([key]) => key !== "kind" && key !== "code"))
        : personnelPayload;
      const saved = await api<PersonnelRecord>(record ? `/personnel/${record.id}` : "/personnel", {
        method: record ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      onSaved(saved);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không lưu được hồ sơ.");
    } finally {
      setBusy(false);
    }
  }

  // Admin duyệt hoặc từ chối thông tin chờ duyệt của giảng viên (AD_NS1, AD_NS2)
  async function handleReview(action: "APPROVE" | "REJECT") {
    if (!record) return;
    if (action === "REJECT" && !rejectReason.trim()) {
      setError("Vui lòng nhập lý do từ chối cụ thể.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/personnel/${record.id}/review`, {
        method: "POST",
        body: JSON.stringify({
          action,
          rejection_reason: rejectReason.trim(),
        }),
      });
      if (onReviewed) onReviewed();
    } catch (err: any) {
      setError(err?.message || "Lỗi khi phê duyệt hồ sơ.");
    } finally {
      setBusy(false);
    }
  }

  const field = (label: string, key: keyof typeof value, type = "text") => (
    <label>
      {label}
      <input
        type={type}
        value={(value[key] as string | null) ?? ""}
        readOnly={Boolean(record && key === "code")}
        onChange={(event) => change(key, event.target.value)}
      />
    </label>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="personnel-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="modal-heading">
          <div>
            <div className="eyebrow">{value.kind === "lecturer" ? "HỒ SƠ GIẢNG VIÊN" : "HỒ SƠ NHÂN VIÊN"}</div>
            <h2>{record ? (editing ? "Chỉnh sửa hồ sơ" : value.full_name) : "Thêm hồ sơ nhân sự"}</h2>
            <p>{record ? value.code : "Thông tin được lưu trực tiếp qua API nhân sự."}</p>
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Khối Admin Duyệt hồ sơ khi đang ở trạng thái CHO_DUYET */}
        {!editing && record && record.profile_status === "CHO_DUYET" && (
          <div
            style={{
              background: "#fffbeb",
              border: "1.5px solid #f59e0b",
              borderRadius: "10px",
              padding: "16px",
              marginBottom: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#b45309", marginBottom: "8px" }}>
              <Clock size={18} />
              <strong style={{ fontSize: "14px" }}>Hồ sơ có cập nhật mới đang chờ Admin phê duyệt:</strong>
            </div>

            {record.pending_updates && Object.keys(record.pending_updates).length > 0 && (
              <ul style={{ margin: "0 0 12px", paddingLeft: "20px", fontSize: "13px", color: "#78350f" }}>
                {Object.entries(record.pending_updates).map(([k, v]) => (
                  <li key={k}>
                    <strong>{k}:</strong> {String(v)}
                  </li>
                ))}
              </ul>
            )}

            {showRejectInput && (
              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "13px", color: "#991b1b", display: "block", marginBottom: "4px" }}>
                  Lý do từ chối (bắt buộc):
                </label>
                <input
                  style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid #ef4444" }}
                  placeholder="Nhập lý do chưa đạt chuẩn hoặc yêu cầu bổ sung..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                className="button button-primary"
                style={{ background: "#16a34a", borderColor: "#16a34a", fontSize: "13px" }}
                disabled={busy}
                onClick={() => handleReview("APPROVE")}
              >
                ✓ Phê duyệt cập nhật
              </button>
              {showRejectInput ? (
                <button
                  className="button"
                  style={{ background: "#dc2626", color: "#ffffff", fontSize: "13px" }}
                  disabled={busy}
                  onClick={() => handleReview("REJECT")}
                >
                  Xác nhận từ chối
                </button>
              ) : (
                <button
                  type="button"
                  className="button button-ghost"
                  style={{ color: "#dc2626", fontSize: "13px" }}
                  onClick={() => setShowRejectInput(true)}
                >
                  ✕ Từ chối
                </button>
              )}
            </div>
          </div>
        )}

        {!editing && record ? (
          <>
            <div className="personnel-detail-grid">
              {[
                ["Mã hồ sơ", value.code],
                ["Email", value.email],
                ["Điện thoại", value.phone],
                ["Ngày sinh", value.date_of_birth || "—"],
                ["Giới tính", value.gender],
                ["Địa chỉ", value.address],
                ["Trình độ", value.education_level],
                ["Học hàm / học vị", value.academic_rank],
                ["Chuyên môn", value.specialty],
                ["Khoa / phòng ban", value.faculty_name || value.department],
                ["Chức vụ", value.position],
                ["Ngày bắt đầu", value.start_date || "—"],
                ["Tình trạng", value.work_status],
              ].map(([label, text]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{text || "—"}</strong>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="button button-ghost" onClick={onClose}>
                Đóng
              </button>
              <button className="button button-primary" onClick={() => setEditing(true)}>
                Chỉnh sửa
              </button>
            </div>
          </>
        ) : (
          <form className="form-stack personnel-form" onSubmit={save}>
            <div className="form-row">
              {!record && (
                <label>
                  Loại hồ sơ
                  <select value={value.kind} onChange={(event) => change("kind", event.target.value)}>
                    <option value="lecturer">Giảng viên</option>
                    <option value="employee">Nhân viên</option>
                  </select>
                </label>
              )}
              {field("Mã hồ sơ", "code")}
            </div>
            <div className="form-row">
              {field("Họ và tên", "full_name")}
              {field("Email", "email", "email")}
            </div>
            <div className="form-row">
              {field("Số điện thoại", "phone")}
              {field("Ngày sinh", "date_of_birth", "date")}
            </div>
            <div className="form-row">
              <label>
                Giới tính
                <select value={value.gender} onChange={(event) => change("gender", event.target.value)}>
                  {["Chưa cập nhật", "Nữ", "Nam", "Khác"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              {field("Ảnh đại diện (URL)", "avatar_url")}
            </div>
            {field("Địa chỉ", "address")}
            <div className="form-row">
              {field("Trình độ học vấn", "education_level")}
              {field("Học hàm / học vị", "academic_rank")}
            </div>
            <div className="form-row">
              {field("Chuyên ngành", "specialty")}
              <label>
                Khoa
                <select value={value.faculty_id ?? ""} onChange={(event) => change("faculty_id", event.target.value)}>
                  <option value="">Chọn khoa (nếu có)</option>
                  {faculties.map((faculty) => (
                    <option key={faculty.id} value={faculty.id}>
                      {faculty.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-row">
              {field("Khoa / phòng ban", "department")}
              {field("Chức vụ", "position")}
            </div>
            <div className="form-row">
              {field("Ngày bắt đầu công tác / tuyển dụng", "start_date", "date")}
              <label>
                Trạng thái làm việc
                <select value={value.work_status} onChange={(event) => change("work_status", event.target.value)}>
                  {statuses.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Thông tin bổ sung
              <textarea rows={3} value={value.notes} onChange={(event) => change("notes", event.target.value)} />
            </label>
            {error && <ErrorNotice message={error} />}
            <div className="modal-actions">
              <button type="button" className="button button-ghost" onClick={onClose}>
                Hủy
              </button>
              <button className="button button-primary" disabled={busy}>
                {busy ? "Đang lưu…" : "Lưu hồ sơ"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
