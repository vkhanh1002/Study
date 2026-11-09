"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  FileCheck,
  FileEdit,
  FileText,
  GraduationCap,
  Info,
  Mail,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserRound,
  XCircle,
} from "lucide-react";
import {
  Announcement,
  api,
  PersonnelContract,
  PersonnelDegree,
  PersonnelRecord,
  StudentRequest,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { DemoTag, EmptyState, ErrorNotice, Loading, PageTitle, StatusBadge } from "@/components/ui";

export function LecturerPortal() {
  const params = useSearchParams();
  const { user } = useAuth();
  const initialTab = (params.get("tab") as "profile" | "degrees" | "contracts" | "tasks" | "news") || "profile";

  const [activeTab, setActiveTab] = useState<"profile" | "degrees" | "contracts" | "tasks" | "news">(initialTab);
  const [profile, setProfile] = useState<PersonnelRecord | null>(null);
  const [degrees, setDegrees] = useState<PersonnelDegree[]>([]);
  const [contracts, setContracts] = useState<PersonnelContract[]>([]);
  const [tasks, setTasks] = useState<StudentRequest[]>([]);
  const [news, setNews] = useState<Announcement[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // State cho Modal Cập nhật hồ sơ
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [academicRank, setAcademicRank] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [notes, setNotes] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // State cho Modal Thêm văn bằng
  const [degreeModalOpen, setDegreeModalOpen] = useState(false);
  const [degreeTitle, setDegreeTitle] = useState("");
  const [degreeType, setDegreeType] = useState("Bằng đại học");
  const [issuingInstitution, setIssuingInstitution] = useState("");
  const [issueYear, setIssueYear] = useState(new Date().getFullYear());
  const [degreeFile, setDegreeFile] = useState("");
  const [savingDegree, setSavingDegree] = useState(false);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [p, d, c, t, n] = await Promise.all([
        api<PersonnelRecord>("/personnel/me").catch(() => null),
        api<PersonnelDegree[]>("/personnel/me/degrees").catch(() => []),
        api<PersonnelContract[]>("/personnel/me/contracts").catch(() => []),
        api<StudentRequest[]>("/personnel/me/assigned-requests").catch(() => []),
        api<Announcement[]>("/support/announcements?target_role=GIANG_VIEN").catch(() => []),
      ]);
      setProfile(p);
      setDegrees(d);
      setContracts(c);
      setTasks(t);
      setNews(n);

      if (p) {
        setPhone(p.phone || "");
        setAddress(p.address || "");
        setEducationLevel(p.education_level || "");
        setAcademicRank(p.academic_rank || "");
        setSpecialty(p.specialty || "");
        setNotes(p.notes || "");
      }
    } catch (err: any) {
      setError(err?.message || "Không thể tải dữ liệu hồ sơ giảng viên.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [user]);

  // Cập nhật thông tin chờ duyệt (GV2)
  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setError("");
    try {
      const updated = await api<PersonnelRecord>("/personnel/me", {
        method: "PATCH",
        body: JSON.stringify({
          phone,
          address,
          education_level: educationLevel,
          academic_rank: academicRank,
          specialty,
          notes,
        }),
      });
      setProfile(updated);
      setEditModalOpen(false);
      setSuccess("Đã gửi yêu cầu cập nhật thông tin hồ sơ. Vui lòng chờ Ban Giám hiệu / Quản trị viên xét duyệt.");
    } catch (err: any) {
      setError(err?.message || "Không thể cập nhật hồ sơ.");
    } finally {
      setSavingProfile(false);
    }
  }

  // Thêm văn bằng chứng chỉ mới (GV3)
  async function handleAddDegree(e: React.FormEvent) {
    e.preventDefault();
    setSavingDegree(true);
    setError("");
    try {
      const created = await api<PersonnelDegree>("/personnel/me/degrees", {
        method: "POST",
        body: JSON.stringify({
          title: degreeTitle,
          degree_type: degreeType,
          issuing_institution: issuingInstitution,
          issue_year: Number(issueYear),
          file_url: degreeFile || "minh_chung_van_bang.pdf",
        }),
      });
      setDegrees([created, ...degrees]);
      setDegreeModalOpen(false);
      setDegreeTitle("");
      setIssuingInstitution("");
      setDegreeFile("");
      setSuccess("Đã thêm văn bằng mới thành công. Hồ sơ đã chuyển sang trạng thái chờ duyệt.");
    } catch (err: any) {
      setError(err?.message || "Không thể thêm văn bằng.");
    } finally {
      setSavingDegree(false);
    }
  }

  // Tìm hợp đồng sắp hết hạn trong 60 ngày để cảnh báo (GV4)
  const expiringContract = contracts.find((c) => c.is_expiring_soon);

  return (
    <div className="module-page" style={{ maxWidth: "1200px", margin: "0 auto", paddingBottom: "60px" }}>
      <PageTitle
        eyebrow="CỔNG GIẢNG VIÊN · FACULTY PORTAL"
        title="Hồ sơ & Công tác Giảng viên"
        description="Quản lý lý lịch khoa học, hồ sơ học thuật, văn bằng chứng chỉ và hợp đồng lao động tại NEU."
        action={
          <button className="button button-primary" onClick={() => setEditModalOpen(true)}>
            <FileEdit size={16} /> Cập nhật hồ sơ
          </button>
        }
      />

      {/* CẢNH BÁO HỢP ĐỒNG SẮP HẾT HẠN (GV4) */}
      {expiringContract && (
        <div
          style={{
            background: "#fffbeb",
            border: "1.5px solid #f59e0b",
            borderRadius: "12px",
            padding: "16px 20px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            color: "#92400e",
          }}
        >
          <AlertTriangle size={28} className="text-amber-600 flex-shrink-0" />
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: "15px", display: "block", marginBottom: "3px" }}>
              Cảnh báo: Hợp đồng lao động sắp hết hạn trong {expiringContract.days_left} ngày!
            </strong>
            <span style={{ fontSize: "13.5px", lineHeight: "1.5" }}>
              Hợp đồng số <strong>{expiringContract.contract_number}</strong> ({expiringContract.contract_type}) sẽ hết hạn vào ngày{" "}
              <strong>{new Date(expiringContract.end_date!).toLocaleDateString("vi-VN")}</strong>. Thầy/Cô vui lòng liên hệ Phòng Tổ chức - Cán bộ (Tầng 3, Nhà A1) để thực hiện thủ tục gia hạn hoặc tái ký hợp đồng.
            </span>
          </div>
        </div>
      )}

      {/* THÔNG BÁO TRẠNG THÁI HỒ SƠ CHỜ DUYỆT / TỪ CHỐI (GV1, GV2) */}
      {profile && profile.profile_status === "CHO_DUYET" && (
        <div
          style={{
            background: "#f0f9ff",
            border: "1px solid #0284c7",
            borderRadius: "10px",
            padding: "14px 18px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            color: "#0369a1",
          }}
        >
          <Clock size={20} />
          <span>
            <strong>Hồ sơ đang ở trạng thái chờ duyệt:</strong> Yêu cầu cập nhật thông tin cá nhân của Thầy/Cô đang được Quản trị viên xem xét.
          </span>
        </div>
      )}

      {profile && profile.profile_status === "TU_CHOI" && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #ef4444",
            borderRadius: "10px",
            padding: "14px 18px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            color: "#b91c1c",
          }}
        >
          <XCircle size={22} className="flex-shrink-0 mt-0.5" />
          <div>
            <strong>Yêu cầu cập nhật hồ sơ bị từ chối:</strong>
            <p style={{ marginTop: "4px", fontSize: "13.5px" }}>{profile.rejection_reason || "Vui lòng kiểm tra lại thông tin và minh chứng đính kèm."}</p>
          </div>
        </div>
      )}

      {success && (
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
            gap: "10px",
          }}
        >
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      {error && <ErrorNotice message={error} />}

      {/* Tabs chuyển đổi giữa các mục */}
      <div className="personnel-tabs" style={{ marginBottom: "22px" }}>
        <button className={activeTab === "profile" ? "active" : ""} onClick={() => setActiveTab("profile")}>
          <UserRound size={16} /> Thông tin cá nhân
        </button>
        <button className={activeTab === "degrees" ? "active" : ""} onClick={() => setActiveTab("degrees")}>
          <Award size={16} /> Văn bằng & Chứng chỉ ({degrees.length})
        </button>
        <button className={activeTab === "contracts" ? "active" : ""} onClick={() => setActiveTab("contracts")}>
          <FileText size={16} /> Hợp đồng lao động ({contracts.length})
        </button>
        <button className={activeTab === "tasks" ? "active" : ""} onClick={() => setActiveTab("tasks")}>
          <FileCheck size={16} /> Đơn được phân công ({tasks.length})
        </button>
        <button className={activeTab === "news" ? "active" : ""} onClick={() => setActiveTab("news")}>
          <BookOpen size={16} /> Thông báo nhân sự ({news.length})
        </button>
      </div>

      {loading ? (
        <Loading />
      ) : activeTab === "profile" ? (
        /* TAB 1: XEM HỒ SƠ CÁ NHÂN (GV1) */
        profile ? (
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "24px" }}>
            {/* Cột trái: Card đại diện */}
            <div
              style={{
                background: "var(--card-bg, #ffffff)",
                border: "1px solid var(--border-color, #e2e8f0)",
                borderRadius: "14px",
                padding: "24px",
                textAlign: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  width: "90px",
                  height: "90px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #0284c7 0%, #1e3a8a 100%)",
                  color: "#ffffff",
                  fontSize: "32px",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                  boxShadow: "0 4px 12px rgba(2, 132, 199, 0.25)",
                }}
              >
                {profile.full_name.slice(0, 1)}
              </div>
              <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 4px" }}>{profile.full_name}</h2>
              <span style={{ fontSize: "13px", color: "var(--text-muted, #64748b)", display: "block", marginBottom: "12px" }}>
                {profile.code}
              </span>

              <div style={{ display: "inline-block", marginBottom: "16px" }}>
                <span
                  style={{
                    padding: "4px 12px",
                    borderRadius: "999px",
                    fontSize: "12px",
                    fontWeight: 600,
                    background:
                      profile.profile_status === "DA_DUYET"
                        ? "#dcfce7"
                        : profile.profile_status === "CHO_DUYET"
                        ? "#fef3c7"
                        : "#fee2e2",
                    color:
                      profile.profile_status === "DA_DUYET"
                        ? "#15803d"
                        : profile.profile_status === "CHO_DUYET"
                        ? "#b45309"
                        : "#b91c1c",
                  }}
                >
                  {profile.profile_status === "DA_DUYET"
                    ? "✓ Hồ sơ đã duyệt"
                    : profile.profile_status === "CHO_DUYET"
                    ? "⏳ Chờ duyệt cập nhật"
                    : "✕ Bị từ chối"}
                </span>
              </div>

              <div style={{ borderTop: "1px solid var(--border-color, #e2e8f0)", paddingTop: "16px", textAlign: "left", fontSize: "13px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", color: "var(--text-muted, #64748b)" }}>
                  <Mail size={15} /> <span>{profile.email}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", color: "var(--text-muted, #64748b)" }}>
                  <Phone size={15} /> <span>{profile.phone || "Chưa cập nhật"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-muted, #64748b)" }}>
                  <MapPin size={15} /> <span>{profile.address || "Hà Nội"}</span>
                </div>
              </div>
            </div>

            {/* Cột phải: Thông tin chi tiết */}
            <div
              style={{
                background: "var(--card-bg, #ffffff)",
                border: "1px solid var(--border-color, #e2e8f0)",
                borderRadius: "14px",
                padding: "24px 28px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 style={{ fontSize: "17px", fontWeight: 700, margin: 0 }}>Lý lịch Khoa học & Giảng dạy</h3>
                <button className="button button-ghost" style={{ fontSize: "13px" }} onClick={() => setEditModalOpen(true)}>
                  <FileEdit size={14} /> Chỉnh sửa thông tin
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "18px 24px" }}>
                <div>
                  <small style={{ color: "#64748b", display: "block", marginBottom: "2px" }}>Học hàm / Học vị</small>
                  <strong>{profile.academic_rank ? `${profile.academic_rank}, ${profile.education_level}` : profile.education_level || "Thạc sĩ"}</strong>
                </div>
                <div>
                  <small style={{ color: "#64748b", display: "block", marginBottom: "2px" }}>Chuyên ngành</small>
                  <strong>{profile.specialty || "Công nghệ phần mềm"}</strong>
                </div>
                <div>
                  <small style={{ color: "#64748b", display: "block", marginBottom: "2px" }}>Khoa / Phòng ban</small>
                  <strong>{profile.faculty_name || profile.department || "Khoa Công nghệ"}</strong>
                </div>
                <div>
                  <small style={{ color: "#64748b", display: "block", marginBottom: "2px" }}>Chức vụ hiện tại</small>
                  <strong>{profile.position || "Giảng viên"}</strong>
                </div>
                <div>
                  <small style={{ color: "#64748b", display: "block", marginBottom: "2px" }}>Tình trạng công tác</small>
                  <StatusBadge>{profile.work_status}</StatusBadge>
                </div>
                <div>
                  <small style={{ color: "#64748b", display: "block", marginBottom: "2px" }}>Ngày bắt đầu công tác</small>
                  <strong>{profile.start_date ? new Date(profile.start_date).toLocaleDateString("vi-VN") : "01/09/2018"}</strong>
                </div>
              </div>

              {profile.notes && (
                <div style={{ marginTop: "24px", paddingTop: "18px", borderTop: "1px solid var(--border-color, #e2e8f0)" }}>
                  <small style={{ color: "#64748b", display: "block", marginBottom: "4px" }}>Ghi chú học thuật / Giới thiệu</small>
                  <p style={{ margin: 0, fontSize: "13.5px", lineHeight: "1.6" }}>{profile.notes}</p>
                </div>
              )}

              {/* So sánh pending_updates nếu đang chờ duyệt */}
              {profile.profile_status === "CHO_DUYET" && profile.pending_updates && Object.keys(profile.pending_updates).length > 0 && (
                <div
                  style={{
                    marginTop: "24px",
                    background: "#f8fafc",
                    border: "1px dashed #cbd5e1",
                    borderRadius: "10px",
                    padding: "16px",
                  }}
                >
                  <h4 style={{ margin: "0 0 10px", fontSize: "14px", color: "#334155", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Clock size={16} /> Thông tin vừa chỉnh sửa đang chờ phê duyệt:
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "#475569" }}>
                    {Object.entries(profile.pending_updates).map(([k, v]) => (
                      <li key={k} style={{ marginBottom: "4px" }}>
                        <strong>{k}:</strong> {String(v)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ) : (
          <EmptyState title="Chưa có dữ liệu hồ sơ" description="Tài khoản này chưa được liên kết với hồ sơ cán bộ giảng viên." />
        )
      ) : activeTab === "degrees" ? (
        /* TAB 2: QUẢN LÝ VĂN BẰNG & CHỨNG CHỈ (GV3) */
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
              Danh mục các bằng cấp đại học, sau đại học và chứng chỉ nghề nghiệp/ngoại ngữ được hệ thống xác thực.
            </p>
            <button className="button button-primary" onClick={() => setDegreeModalOpen(true)}>
              <Plus size={16} /> Thêm văn bằng
            </button>
          </div>

          {degrees.length === 0 ? (
            <EmptyState
              icon={<Award size={36} />}
              title="Chưa có văn bằng nào"
              description="Thầy/Cô hãy tải lên văn bằng hoặc chứng chỉ học thuật của mình."
              action={
                <button className="button button-secondary" onClick={() => setDegreeModalOpen(true)}>
                  Thêm văn bằng ngay
                </button>
              }
            />
          ) : (
            <div className="table-panel">
              <div className="responsive-table">
                <table>
                  <thead>
                    <tr>
                      <th>Tên văn bằng / Chứng chỉ</th>
                      <th>Loại</th>
                      <th>Cơ sở đào tạo / Cấp bằng</th>
                      <th>Năm cấp</th>
                      <th>Trạng thái</th>
                      <th>Minh chứng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {degrees.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <strong>{d.title}</strong>
                        </td>
                        <td>{d.degree_type}</td>
                        <td>{d.issuing_institution}</td>
                        <td>{d.issue_year}</td>
                        <td>
                          <span
                            style={{
                              padding: "3px 10px",
                              borderRadius: "999px",
                              fontSize: "12px",
                              fontWeight: 600,
                              background:
                                d.status === "DA_DUYET" ? "#dcfce7" : d.status === "CHO_DUYET" ? "#fef3c7" : "#fee2e2",
                              color:
                                d.status === "DA_DUYET" ? "#15803d" : d.status === "CHO_DUYET" ? "#b45309" : "#b91c1c",
                            }}
                          >
                            {d.status === "DA_DUYET"
                              ? "✓ Đã duyệt"
                              : d.status === "CHO_DUYET"
                              ? "⏳ Chờ duyệt"
                              : `✕ Từ chối: ${d.rejection_reason || ""}`}
                          </span>
                        </td>
                        <td>
                          <a
                            href={`#minh-chung-${d.id}`}
                            onClick={(e) => {
                              e.preventDefault();
                              alert(`Minh chứng tệp đính kèm: ${d.file_url || "minh_chung_goc.pdf"}`);
                            }}
                            style={{ color: "#0284c7", fontSize: "13px", fontWeight: 600 }}
                          >
                            Xem tệp
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === "contracts" ? (
        /* TAB 3: HỢP ĐỒNG LAO ĐỘNG (GV4) */
        <div>
          <div style={{ marginBottom: "16px" }}>
            <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
              Danh mục các hợp đồng lao động đã ký kết với Đại học Kinh tế Quốc dân. Hệ thống sẽ tự động cảnh báo trước 60 ngày khi hợp đồng sắp hết hạn.
            </p>
          </div>

          {contracts.length === 0 ? (
            <EmptyState icon={<FileText size={36} />} title="Chưa có dữ liệu hợp đồng" description="Hợp đồng lao động của Thầy/Cô sẽ được cập nhật bởi Phòng Tổ chức - Cán bộ." />
          ) : (
            <div className="table-panel">
              <div className="responsive-table">
                <table>
                  <thead>
                    <tr>
                      <th>Số hợp đồng</th>
                      <th>Loại hợp đồng</th>
                      <th>Ngày bắt đầu</th>
                      <th>Ngày hết hạn</th>
                      <th>Hệ số lương / Thù lao</th>
                      <th>Tình trạng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contracts.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <strong className="mono">{c.contract_number}</strong>
                        </td>
                        <td>{c.contract_type}</td>
                        <td>{new Date(c.start_date).toLocaleDateString("vi-VN")}</td>
                        <td>{c.end_date ? new Date(c.end_date).toLocaleDateString("vi-VN") : "Vô thời hạn"}</td>
                        <td>{c.salary_rate || "Theo quy chế chi tiêu nội bộ"}</td>
                        <td>
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: "999px",
                              fontSize: "12px",
                              fontWeight: 600,
                              background:
                                c.is_expiring_soon
                                  ? "#fee2e2"
                                  : c.status === "Hiệu lực"
                                  ? "#dcfce7"
                                  : "#f1f5f9",
                              color:
                                c.is_expiring_soon
                                  ? "#b91c1c"
                                  : c.status === "Hiệu lực"
                                  ? "#15803d"
                                  : "#475569",
                            }}
                          >
                            {c.is_expiring_soon
                              ? `⚠️ Sắp hết hạn (${c.days_left} ngày)`
                              : c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === "tasks" ? (
        /* TAB 4: ĐƠN ĐƯỢC PHÂN CÔNG (GV5) */
        <div>
          <div style={{ marginBottom: "16px" }}>
            <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
              Các đơn xin xác nhận, bảng điểm hoặc khiếu nại của sinh viên được Ban Giám hiệu / Phòng Quản lý Đào tạo phân công Thầy/Cô xử lý.
            </p>
          </div>

          {tasks.length === 0 ? (
            <EmptyState icon={<FileCheck size={36} />} title="Không có đơn nào cần xử lý" description="Thầy/Cô hiện tại không có nhiệm vụ hoặc đơn từ sinh viên nào được phân công." />
          ) : (
            <div className="table-panel">
              <div className="responsive-table">
                <table>
                  <thead>
                    <tr>
                      <th>Mã đơn</th>
                      <th>Sinh viên</th>
                      <th>Loại đơn</th>
                      <th>Nội dung</th>
                      <th>Ngày gửi</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <strong className="mono">{t.code}</strong>
                        </td>
                        <td>
                          <strong>{t.student_name}</strong>
                          <small style={{ display: "block", color: "#64748b" }}>{t.student_number}</small>
                        </td>
                        <td>{t.request_type}</td>
                        <td style={{ maxWidth: "280px" }}>
                          <strong>{t.title}</strong>
                          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#64748b" }}>{t.reason}</p>
                        </td>
                        <td>{new Date(t.created_at).toLocaleDateString("vi-VN")}</td>
                        <td>
                          <StatusBadge>{t.status}</StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* TAB 5: THÔNG BÁO NHÂN SỰ (GV6) */
        <div>
          <div style={{ marginBottom: "16px" }}>
            <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
              Các thông báo hành chính, lịch họp khoa và văn bản chỉ đạo điều hành của trường.
            </p>
          </div>

          {news.length === 0 ? (
            <EmptyState icon={<BookOpen size={36} />} title="Chưa có thông báo mới" description="Các thông báo từ Nhà trường sẽ xuất hiện tại đây." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {news.map((item) => (
                <article
                  key={item.id}
                  style={{
                    background: "var(--card-bg, #ffffff)",
                    border: "1px solid var(--border-color, #e2e8f0)",
                    borderRadius: "12px",
                    padding: "20px",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          background: "#e0f2fe",
                          color: "#0369a1",
                          fontSize: "12px",
                          fontWeight: 650,
                          padding: "3px 10px",
                          borderRadius: "999px",
                        }}
                      >
                        {item.category}
                      </span>
                      {item.is_pinned && (
                        <span
                          style={{
                            background: "#fef3c7",
                            color: "#b45309",
                            fontSize: "11.5px",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "999px",
                          }}
                        >
                          Ghim quan trọng
                        </span>
                      )}
                    </div>
                    <small style={{ color: "#94a3b8" }}>{new Date(item.created_at).toLocaleDateString("vi-VN")}</small>
                  </div>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 8px", color: "var(--text-main, #0f172a)" }}>
                    {item.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.6", color: "#475569" }}>{item.content}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL CẬP NHẬT HỒ SƠ CHỜ DUYỆT (GV2) */}
      {editModalOpen && (
        <div className="modal-backdrop" onClick={() => setEditModalOpen(false)}>
          <section className="form-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "560px" }}>
            <div className="modal-heading">
              <div>
                <div className="eyebrow">QUY TRÌNH DUYỆT HỒ SƠ GIẢNG VIÊN</div>
                <h2>Cập nhật thông tin cá nhân</h2>
                <p>Thông tin cập nhật sẽ được chuyển sang trạng thái "Chờ duyệt" và lưu chính thức sau khi Quản trị viên phê duyệt.</p>
              </div>
              <button className="modal-close" onClick={() => setEditModalOpen(false)}>
                ×
              </button>
            </div>

            <form className="form-stack" onSubmit={handleUpdateProfile}>
              <div className="form-row">
                <label>
                  Số điện thoại liên hệ
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xx xxx xxx" />
                </label>
                <label>
                  Trình độ học vấn
                  <select value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)}>
                    <option value="Thạc sĩ">Thạc sĩ</option>
                    <option value="Tiến sĩ">Tiến sĩ</option>
                    <option value="Đại học">Đại học</option>
                  </select>
                </label>
              </div>

              <div className="form-row">
                <label>
                  Học hàm / Học vị
                  <select value={academicRank} onChange={(e) => setAcademicRank(e.target.value)}>
                    <option value="">Không có</option>
                    <option value="Phó Giáo sư">Phó Giáo sư</option>
                    <option value="Giáo sư">Giáo sư</option>
                  </select>
                </label>
                <label>
                  Chuyên môn chính
                  <input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Công nghệ thông tin..." />
                </label>
              </div>

              <label>
                Địa chỉ thường trú / Nơi ở hiện tại
                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Quận Hai Bà Trưng, Hà Nội" />
              </label>

              <label>
                Ghi chú học thuật / Lĩnh vực nghiên cứu
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Tóm tắt hướng nghiên cứu chính..." />
              </label>

              <div className="modal-actions">
                <button type="button" className="button button-ghost" onClick={() => setEditModalOpen(false)}>
                  Hủy
                </button>
                <button type="submit" className="button button-primary" disabled={savingProfile}>
                  {savingProfile ? "Đang gửi…" : "Gửi yêu cầu xét duyệt"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* MODAL THÊM VĂN BẰNG (GV3) */}
      {degreeModalOpen && (
        <div className="modal-backdrop" onClick={() => setDegreeModalOpen(false)}>
          <section className="form-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "520px" }}>
            <div className="modal-heading">
              <div>
                <div className="eyebrow">HỒ SƠ HỌC THUẬT</div>
                <h2>Thêm Văn bằng / Chứng chỉ</h2>
                <p>Khai báo thông tin văn bằng và minh chứng để cập nhật vào lý lịch cán bộ.</p>
              </div>
              <button className="modal-close" onClick={() => setDegreeModalOpen(false)}>
                ×
              </button>
            </div>

            <form className="form-stack" onSubmit={handleAddDegree}>
              <label>
                Tên văn bằng hoặc chứng chỉ *
                <input
                  required
                  value={degreeTitle}
                  onChange={(e) => setDegreeTitle(e.target.value)}
                  placeholder="Bằng Tiến sĩ Khoa học Máy tính / IELTS 8.0..."
                />
              </label>

              <div className="form-row">
                <label>
                  Loại văn bằng
                  <select value={degreeType} onChange={(e) => setDegreeType(e.target.value)}>
                    <option value="Bằng đại học">Bằng đại học</option>
                    <option value="Bằng thạc sĩ">Bằng thạc sĩ</option>
                    <option value="Bằng tiến sĩ">Bằng tiến sĩ</option>
                    <option value="Chứng chỉ nghề nghiệp">Chứng chỉ nghề nghiệp</option>
                    <option value="Chứng chỉ ngoại ngữ">Chứng chỉ ngoại ngữ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </label>
                <label>
                  Năm cấp bằng *
                  <input
                    type="number"
                    required
                    min={1950}
                    max={2100}
                    value={issueYear}
                    onChange={(e) => setIssueYear(Number(e.target.value))}
                  />
                </label>
              </div>

              <label>
                Cơ sở đào tạo / Tổ chức cấp bằng *
                <input
                  required
                  value={issuingInstitution}
                  onChange={(e) => setIssuingInstitution(e.target.value)}
                  placeholder="Đại học Bách Khoa Hà Nội / British Council..."
                />
              </label>

              <label>
                Tên tệp minh chứng (PDF hoặc ảnh)
                <input
                  value={degreeFile}
                  onChange={(e) => setDegreeFile(e.target.value)}
                  placeholder="minh_chung_bang_tien_si.pdf"
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="button button-ghost" onClick={() => setDegreeModalOpen(false)}>
                  Hủy
                </button>
                <button type="submit" className="button button-primary" disabled={savingDegree}>
                  {savingDegree ? "Đang lưu…" : "Thêm văn bằng"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
