"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, ShieldAlert, UserRound, UserRoundPen } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { DemoTag, EmptyState, ErrorNotice, Loading, PageTitle, StatusBadge } from "@/components/ui";

type Student = { id: string; student_number: string; full_name: string; email: string; phone: string; address: string; gender: string; major_id: string; major_name: string; cohort: string; class_name: string; study_status: string; enrollment_date: string | null; is_demo: boolean };

export function Profiles() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Student | null>(null);
  useEffect(() => {
    api<Student[]>("/profiles/students").then(setRows).catch(reason => setError(reason.message)).finally(() => setLoading(false));
  }, [user]);
  const filtered = useMemo(() => rows.filter(row => `${row.student_number} ${row.full_name} ${row.email} ${row.major_name}`.toLowerCase().includes(query.toLowerCase())), [rows, query]);
  return <div className="module-page">
    <PageTitle eyebrow="HỒ SƠ TẬP TRUNG" title="Hồ sơ người học" description="Thông tin sinh viên được quản lý tập trung và giới hạn theo quyền tài khoản." action={user?.role === "super_admin" ? <button className="button button-secondary" disabled title="MVP: tạo hồ sơ qua chuyển đổi tuyển sinh"><UserRoundPen size={16} /> Tạo từ hồ sơ trúng tuyển</button> : null} />
    <div className="module-notice neutral"><ShieldAlert size={16} /><span>Sinh viên chỉ xem được hồ sơ gắn với tài khoản của mình. Tài khoản nhân viên được giới hạn theo vai trò API.</span>{rows.some(row => row.is_demo) && <DemoTag />}</div>
    {error && <ErrorNotice message={error} />}
    {loading ? <Loading /> : rows.length === 0 && user?.role !== "super_admin" ? <EmptyState icon={<UserRound size={23} />} title={user ? "Chưa liên kết hồ sơ sinh viên" : "Đăng nhập để xem hồ sơ"} description={user ? "Tài khoản này chưa được gắn với hồ sơ người học." : "Đăng nhập để xem thông tin cá nhân theo quyền được cấp."} /> : <>
      {user?.role === "super_admin" && <div className="module-toolbar"><div className="toolbar-count">Tất cả sinh viên <strong>{filtered.length}</strong></div><div className="search-field"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm mã SV, họ tên, ngành…" /></div></div>}
      <div className="table-panel"><div className="responsive-table"><table><thead><tr><th>Mã sinh viên</th><th>Họ tên</th><th>Ngành đào tạo</th><th>Khóa / lớp</th><th>Trạng thái</th><th></th></tr></thead><tbody>{(user?.role === "super_admin" ? filtered : rows).map(row => <tr key={row.id}><td><strong className="mono">{row.student_number}</strong></td><td><div className="person-cell"><span className="avatar small-avatar">{row.full_name.slice(0, 1)}</span><span><strong>{row.full_name}</strong><small>{row.email}</small></span></div></td><td>{row.major_name}</td><td>{row.cohort} · {row.class_name || "Chưa xếp lớp"}</td><td><StatusBadge>{row.study_status}</StatusBadge></td><td><button className="mini-button" onClick={() => setSelected(row)}>Chi tiết</button></td></tr>)}</tbody></table></div></div>
      {rows.length > 0 && <p className="table-footnote">Hiển thị thông tin hồ sơ theo phạm vi quyền tài khoản đang đăng nhập.</p>}
    </>}
    {selected && <ProfileDetail student={selected} isAdmin={user?.role === "super_admin"} onClose={() => setSelected(null)} onUpdated={updated => { setSelected(updated); setRows(current => current.map(row => row.id === updated.id ? updated : row)); }} />}
  </div>;
}

function ProfileField({ label, value }: { label: string; value: string }) { return <div className="profile-field"><span>{label}</span><strong>{value}</strong></div>; }

function ProfileDetail({ student, isAdmin, onClose, onUpdated }: { student: Student; isAdmin: boolean; onClose: () => void; onUpdated: (row: Student) => void }) {
  const [editing, setEditing] = useState(false); const [phone, setPhone] = useState(student.phone); const [address, setAddress] = useState(student.address ?? ""); const [gender, setGender] = useState(student.gender ?? ""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const path = isAdmin ? `/profiles/students/${student.id}` : "/profiles/me";
      const updated = await api<Student>(path, { method: "PATCH", body: JSON.stringify({ phone, address, gender }) });
      onUpdated(updated); setEditing(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không lưu được thông tin."); }
    finally { setBusy(false); }
  }
  return <div className="modal-backdrop" onClick={onClose}><section className="profile-modal" role="dialog" aria-modal="true" onClick={event => event.stopPropagation()}><div className="profile-modal-top"><span className="profile-large-avatar">{student.full_name.slice(0, 1)}</span><div><div className="eyebrow">HỒ SƠ SINH VIÊN</div><h2>{student.full_name}</h2><p>{student.student_number}</p></div><button className="modal-close" onClick={onClose}>×</button></div>
    {editing ? <form className="form-stack" onSubmit={save}><label>Số điện thoại<input value={phone} onChange={event => setPhone(event.target.value)} maxLength={40} /></label><label>Giới tính<input value={gender} onChange={event => setGender(event.target.value)} maxLength={30} /></label><label>Địa chỉ<textarea rows={3} value={address} onChange={event => setAddress(event.target.value)} maxLength={500} /></label>{error && <div className="inline-error">{error}</div>}<div className="modal-actions"><button type="button" className="button button-ghost" onClick={() => setEditing(false)}>Hủy</button><button className="button button-primary" disabled={busy}>{busy ? "Đang lưu…" : "Lưu thay đổi"}</button></div></form> : <><div className="profile-detail-grid"><ProfileField label="Email" value={student.email} /><ProfileField label="Điện thoại" value={student.phone || "Chưa cập nhật"} /><ProfileField label="Giới tính" value={student.gender || "Chưa cập nhật"} /><ProfileField label="Địa chỉ" value={student.address || "Chưa cập nhật"} /><ProfileField label="Ngành đào tạo" value={student.major_name} /><ProfileField label="Khóa / lớp" value={`${student.cohort} · ${student.class_name || "Chưa xếp lớp"}`} /><ProfileField label="Ngày nhập học" value={student.enrollment_date ? new Date(student.enrollment_date).toLocaleDateString("vi-VN") : "Chưa cập nhật"} /><ProfileField label="Trạng thái" value={student.study_status} /></div>{student.is_demo && <div className="profile-demo"><DemoTag /> Thông tin hồ sơ mẫu để minh họa giao diện.</div>}<div className="modal-actions"><button className="button button-secondary" onClick={() => setEditing(true)}><UserRoundPen size={14} /> Cập nhật liên hệ</button></div></>}</section></div>;
}
