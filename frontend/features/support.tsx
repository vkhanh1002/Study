"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Calendar,
  CalendarCheck2,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock,
  Download,
  FileCheck,
  FileEdit,
  FilePlus2,
  FileText,
  GraduationCap,
  HelpCircle,
  MapPin,
  MessageCircle,
  Paperclip,
  Search,
  Send,
  Sparkles,
  Star,
  TicketCheck,
  Upload,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";
import {
  AcademicSchedule,
  Announcement,
  api,
  API_BASE,
  ChecklistResponse,
  ChecklistStep,
  StudentRequest,
  Ticket,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { DemoTag, EmptyState, ErrorNotice, Loading, PageTitle, StatusBadge } from "@/components/ui";
import { StudentHandbook } from "./student-handbook";

type FAQ = { id: string; question: string; answer: string; category: string };
type Agent = { id: string; full_name: string; email: string };
type SupportStats = { total: number; by_status: { status: string; count: number }[]; success_rate: number };

const supportSchema = z.object({
  category: z.string().min(1),
  subject: z.string().min(4, "Tiêu đề cần ít nhất 4 ký tự."),
  description: z.string().min(8, "Mô tả cần ít nhất 8 ký tự."),
  priority: z.string().min(1),
});
type SupportValues = z.infer<typeof supportSchema>;

const categories = [
  "Tuyển sinh",
  "Hồ sơ sinh viên",
  "Học phí và tài chính",
  "Đào tạo và học tập",
  "Giấy tờ và xác nhận",
  "Tài khoản và công nghệ",
  "Cơ sở vật chất",
  "Khác",
];
const staffRoles = ["ADMIN", "super_admin", "support_staff"];

export function Support() {
  const params = useSearchParams();
  const { user } = useAuth();
  const isStaff = Boolean(user && staffRoles.includes(user.role));
  const isStudent = Boolean(user && ["SINH_VIEN", "student", "sinh_vien"].includes(user.role));

  const initialTab =
    (params.get("tab") as "handbook" | "checklist" | "requests" | "schedules" | "announcements" | "tickets") ||
    (isStaff ? "requests" : "handbook");

  const [activeTab, setActiveTab] = useState<"handbook" | "checklist" | "requests" | "schedules" | "announcements" | "tickets">(initialTab);

  // Data states
  const [checklist, setChecklist] = useState<ChecklistResponse | null>(null);
  const [requests, setRequests] = useState<StudentRequest[]>([]);
  const [schedules, setSchedules] = useState<AcademicSchedule[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<SupportStats | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // State nộp đơn sinh viên mới (SV3)
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [reqType, setReqType] = useState("Xác nhận sinh viên");
  const [reqTitle, setReqTitle] = useState("");
  const [reqReason, setReqReason] = useState("");
  const [reqAttachment, setReqAttachment] = useState("minh_chung_kem_theo.pdf");
  const [submittingReq, setSubmittingReq] = useState(false);

  // State đánh giá sao đơn sinh viên (SV7)
  const [ratingModalReq, setRatingModalReq] = useState<StudentRequest | null>(null);
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingFeedback, setRatingFeedback] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);

  // State Admin duyệt đơn sinh viên (AD_HT2)
  const [adminReqModal, setAdminReqModal] = useState<StudentRequest | null>(null);
  const [adminNextStatus, setAdminNextStatus] = useState("DA_DUYET");
  const [adminRejectionReason, setAdminRejectionReason] = useState("");
  const [adminAssignedLecturer, setAdminAssignedLecturer] = useState("");
  const [submittingAdminReq, setSubmittingAdminReq] = useState(false);

  // State ticket kỹ thuật cũ
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [activeTicket, setActiveTicket] = useState<string | null>(null);
  const [busyTicket, setBusyTicket] = useState("");
  const [ticketQuery, setTicketQuery] = useState("");
  const [ticketCategory, setTicketCategory] = useState("");
  const [ticketStatus, setTicketStatus] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [faqRows, annRows] = await Promise.all([
        api<FAQ[]>("/support/faqs").catch(() => []),
        api<Announcement[]>("/support/announcements").catch(() => []),
      ]);
      setFaqs(faqRows);
      setAnnouncements(annRows);

      if (user) {
        if (isStaff) {
          const [allReqs, dash, agList, tickList] = await Promise.all([
            api<StudentRequest[]>("/support/requests/all").catch(() => []),
            api<SupportStats>("/support/dashboard").catch(() => null),
            api<Agent[]>("/support/agents").catch(() => []),
            api<Ticket[]>("/support/tickets").catch(() => []),
          ]);
          setRequests(allReqs);
          setStats(dash);
          setAgents(agList);
          setTickets(tickList);
        } else {
          const [myChecklist, myReqs, myScheds, myTicks] = await Promise.all([
            api<ChecklistResponse>("/support/checklist/me").catch(() => null),
            api<StudentRequest[]>("/support/requests/me").catch(() => []),
            api<AcademicSchedule[]>("/support/schedules/me").catch(() => []),
            api<Ticket[]>("/support/tickets").catch(() => []),
          ]);
          setChecklist(myChecklist);
          setRequests(myReqs);
          setSchedules(myScheds);
          setTickets(myTicks);
        }
      }
    } catch (err: any) {
      setError(err?.message || "Không thể tải dữ liệu hỗ trợ.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [user, isStaff]);

  // Cập nhật tiến độ 1 bước thủ tục nhập học (SV2)
  async function handleToggleStep(step: ChecklistStep) {
    const nextStatus = step.status === "DA_HOAN_THANH" ? "CHUA_HOAN_THANH" : "DA_HOAN_THANH";
    try {
      await api<ChecklistStep>(`/support/checklist/${step.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      const updated = await api<ChecklistResponse>("/support/checklist/me");
      setChecklist(updated);
      setSuccess(`Đã cập nhật bước "${step.step_title}".`);
    } catch (err: any) {
      setError(err?.message || "Lỗi cập nhật bước.");
    }
  }

  // Nộp đơn sinh viên mới (SV3)
  async function handleCreateRequest(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingReq(true);
    setError("");
    try {
      const created = await api<StudentRequest>("/support/requests", {
        method: "POST",
        body: JSON.stringify({
          request_type: reqType,
          title: reqTitle.trim(),
          reason: reqReason.trim(),
          attachments: reqAttachment ? [{ filename: reqAttachment.trim() }] : [],
        }),
      });
      setRequests([created, ...requests]);
      setRequestModalOpen(false);
      setReqTitle("");
      setReqReason("");
      setSuccess(`Đã gửi đơn trực tuyến ${created.code} thành công. Thầy/Cô và bộ phận liên quan sẽ sớm xử lý.`);
    } catch (err: any) {
      setError(err?.message || "Không thể gửi đơn.");
    } finally {
      setSubmittingReq(false);
    }
  }

  // Đánh giá 1-5 sao cho đơn (SV7)
  async function handleSubmitRating(e: React.FormEvent) {
    e.preventDefault();
    if (!ratingModalReq) return;
    setSubmittingRating(true);
    try {
      const updated = await api<StudentRequest>(`/support/requests/${ratingModalReq.id}/rating`, {
        method: "POST",
        body: JSON.stringify({
          rating: ratingStars,
          feedback: ratingFeedback.trim(),
        }),
      });
      setRequests(requests.map((r) => (r.id === updated.id ? updated : r)));
      setRatingModalReq(null);
      setSuccess("Cảm ơn bạn đã đánh giá chất lượng phục vụ của Nhà trường.");
    } catch (err: any) {
      setError(err?.message || "Lỗi khi lưu đánh giá.");
    } finally {
      setSubmittingRating(false);
    }
  }

  // Admin xử lý / phân công đơn sinh viên (AD_HT2)
  async function handleAdminUpdateRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!adminReqModal) return;
    setSubmittingAdminReq(true);
    try {
      const updated = await api<StudentRequest>(`/support/requests/${adminReqModal.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: adminNextStatus,
          rejection_reason: adminRejectionReason.trim(),
          assigned_lecturer_id: adminAssignedLecturer || null,
        }),
      });
      setRequests(requests.map((r) => (r.id === updated.id ? updated : r)));
      setAdminReqModal(null);
      setSuccess(`Đã cập nhật trạng thái đơn ${updated.code} thành công.`);
    } catch (err: any) {
      setError(err?.message || "Không thể cập nhật đơn.");
    } finally {
      setSubmittingAdminReq(false);
    }
  }

  return (
    <div className="module-page" style={{ maxWidth: "1240px", margin: "0 auto", paddingBottom: "60px" }}>
      <PageTitle
        eyebrow="HỖ TRỢ NGƯỜI HỌC · STUDENT SERVICES"
        title="Trung tâm Hỗ trợ & Dịch vụ Sinh viên"
        description="Cẩm nang tân sinh viên, thủ tục nhập học 11 bước, dịch vụ một cửa giải quyết đơn từ trực tuyến và lịch thi."
        action={
          !isStaff && user ? (
            <button className="button button-primary" onClick={() => setRequestModalOpen(true)}>
              <FilePlus2 size={16} /> Gửi đơn trực tuyến
            </button>
          ) : null
        }
      />

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
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <CheckCircle2 size={18} />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#15803d" }}>
            <X size={16} />
          </button>
        </div>
      )}

      {error && <ErrorNotice message={error} />}

      {/* Thanh Tabs chuyển đổi */}
      <div className="personnel-tabs" style={{ marginBottom: "22px" }}>
        <button className={activeTab === "handbook" ? "active" : ""} onClick={() => setActiveTab("handbook")}>
          <BookOpen size={16} /> Cẩm nang & Tra cứu website NEU
        </button>

        {user && !isStaff && (
          <button className={activeTab === "checklist" ? "active" : ""} onClick={() => setActiveTab("checklist")}>
            <CheckCircle2 size={16} /> Thủ tục nhập học 11 bước{" "}
            {checklist ? `(${checklist.progress_pct}%)` : ""}
          </button>
        )}

        {user && (
          <button className={activeTab === "requests" ? "active" : ""} onClick={() => setActiveTab("requests")}>
            <FileText size={16} /> {isStaff ? "Quản lý đơn sinh viên" : "Đơn trực tuyến của tôi"} ({requests.length})
          </button>
        )}

        {user && !isStaff && (
          <button className={activeTab === "schedules" ? "active" : ""} onClick={() => setActiveTab("schedules")}>
            <CalendarCheck2 size={16} /> Thời khóa biểu & Lịch thi
          </button>
        )}

        <button className={activeTab === "announcements" ? "active" : ""} onClick={() => setActiveTab("announcements")}>
          <AlertCircle size={16} /> Thông báo học tập ({announcements.length})
        </button>

        <button className={activeTab === "tickets" ? "active" : ""} onClick={() => setActiveTab("tickets")}>
          <CircleHelp size={16} /> Hỗ trợ kỹ thuật & FAQ ({tickets.length})
        </button>
      </div>

      {loading ? (
        <Loading />
      ) : activeTab === "handbook" ? (
        /* ================= TAB 1: CẨM NANG & SỔ TAY SINH VIÊN ================= */
        <StudentHandbook />
      ) : activeTab === "checklist" ? (
        /* ================= TAB 2: CHECKLIST NHẬP HỌC 11 BƯỚC (SV2) ================= */
        checklist ? (
          <div>
            {/* Thanh tiến độ phần trăm % */}
            <div
              style={{
                background: "linear-gradient(135deg, #1e3a8a 0%, #0369a1 100%)",
                borderRadius: "16px",
                padding: "28px 32px",
                color: "#ffffff",
                marginBottom: "28px",
                boxShadow: "0 8px 24px rgba(3, 105, 161, 0.2)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div>
                  <h3 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 4px", color: "#ffffff" }}>
                    Tiến độ hoàn thành thủ tục nhập học
                  </h3>
                  <p style={{ margin: 0, fontSize: "14px", opacity: 0.9 }}>
                    Đã hoàn thành <strong>{checklist.completed_count} / {checklist.total_steps} bước</strong>. Vui lòng hoàn tất trước ngày khai giảng.
                  </p>
                </div>
                <div style={{ fontSize: "36px", fontWeight: 800 }}>{checklist.progress_pct}%</div>
              </div>

              {/* Progress bar */}
              <div style={{ width: "100%", height: "10px", background: "rgba(255,255,255,0.25)", borderRadius: "999px", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${checklist.progress_pct}%`,
                    height: "100%",
                    background: "#22c55e",
                    borderRadius: "999px",
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>

            {/* Danh sách 11 bước chi tiết */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {checklist.steps.map((step) => {
                const isDone = step.status === "DA_HOAN_THANH";
                return (
                  <div
                    key={step.id}
                    style={{
                      background: "var(--card-bg, #ffffff)",
                      border: `1.5px solid ${isDone ? "#bbf7d0" : "#e2e8f0"}`,
                      borderRadius: "12px",
                      padding: "18px 22px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "16px",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          background: isDone ? "#22c55e" : "#f1f5f9",
                          color: isDone ? "#ffffff" : "#64748b",
                          fontWeight: 700,
                          fontSize: "15px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {isDone ? "✓" : step.step_number}
                      </div>
                      <div>
                        <h4
                          style={{
                            margin: "0 0 4px",
                            fontSize: "15.5px",
                            fontWeight: 700,
                            color: isDone ? "#15803d" : "inherit",
                          }}
                        >
                          Bước {step.step_number}: {step.step_title}
                        </h4>
                        <p style={{ margin: 0, fontSize: "13.5px", color: "#64748b", lineHeight: "1.5" }}>
                          {step.step_description}
                        </p>
                        {step.completed_at && (
                          <small style={{ color: "#16a34a", display: "block", marginTop: "4px" }}>
                            Hoàn thành lúc {new Date(step.completed_at).toLocaleString("vi-VN")}
                          </small>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleStep(step)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "8px",
                        fontSize: "13px",
                        fontWeight: 650,
                        cursor: "pointer",
                        border: isDone ? "1px solid #cbd5e1" : "none",
                        background: isDone ? "transparent" : "#0284c7",
                        color: isDone ? "#475569" : "#ffffff",
                        flexShrink: 0,
                      }}
                    >
                      {isDone ? "Đánh dấu chưa xong" : "Xác nhận hoàn thành"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyState title="Không tìm thấy dữ liệu thủ tục nhập học" description="Chỉ tân sinh viên mới cần thực hiện danh sách thủ tục này." />
        )
      ) : activeTab === "requests" ? (
        /* ================= TAB 3: ĐƠN TRỰC TUYẾN (SV3, SV4, SV7, AD_HT) ================= */
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
              {isStaff
                ? "Danh sách các đơn xác nhận, bảng điểm, bảo lưu kết quả và rút học phí từ sinh viên."
                : "Theo dõi tình trạng xử lý đơn trực tuyến và đánh giá chất lượng phục vụ sau khi hoàn thành."}
            </p>
            {!isStaff && (
              <button className="button button-primary" onClick={() => setRequestModalOpen(true)}>
                <FilePlus2 size={16} /> Gửi đơn mới
              </button>
            )}
          </div>

          {requests.length === 0 ? (
            <EmptyState
              icon={<FileText size={36} />}
              title="Chưa có đơn trực tuyến nào"
              description="Các đơn xin xác nhận sinh viên, cấp bảng điểm hoặc bảo lưu sẽ xuất hiện tại đây."
              action={
                !isStaff ? (
                  <button className="button button-secondary" onClick={() => setRequestModalOpen(true)}>
                    Tạo đơn đầu tiên
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="table-panel">
              <div className="responsive-table">
                <table>
                  <thead>
                    <tr>
                      <th>Mã đơn</th>
                      {isStaff && <th>Sinh viên</th>}
                      <th>Loại thủ tục</th>
                      <th>Tiêu đề & Lý do</th>
                      <th>Cán bộ xử lý</th>
                      <th>Ngày gửi</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <strong className="mono">{r.code}</strong>
                        </td>
                        {isStaff && (
                          <td>
                            <strong>{r.student_name}</strong>
                            <small style={{ display: "block", color: "#64748b" }}>{r.student_number}</small>
                          </td>
                        )}
                        <td>
                          <span style={{ fontWeight: 600, color: "#0284c7" }}>{r.request_type}</span>
                        </td>
                        <td style={{ maxWidth: "260px" }}>
                          <strong>{r.title}</strong>
                          <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>{r.reason}</p>
                          {r.rejection_reason && (
                            <small style={{ display: "block", color: "#dc2626", marginTop: "4px" }}>
                              Lý do: {r.rejection_reason}
                            </small>
                          )}
                        </td>
                        <td>{r.assigned_lecturer_name || "Phòng Đào tạo"}</td>
                        <td>{new Date(r.created_at).toLocaleDateString("vi-VN")}</td>
                        <td>
                          <StatusBadge>{r.status}</StatusBadge>
                        </td>
                        <td>
                          {isStaff ? (
                            <button
                              className="mini-button"
                              onClick={() => {
                                setAdminReqModal(r);
                                setAdminNextStatus(r.status);
                                setAdminRejectionReason(r.rejection_reason || "");
                                setAdminAssignedLecturer(r.assigned_lecturer_id || "");
                              }}
                            >
                              Xử lý đơn
                            </button>
                          ) : (
                            r.status === "DA_DUYET" && (
                              <button
                                className="mini-button"
                                style={{ background: r.rating ? "#f1f5f9" : "#fef3c7", color: r.rating ? "#475569" : "#b45309" }}
                                onClick={() => {
                                  setRatingModalReq(r);
                                  setRatingStars(r.rating || 5);
                                  setRatingFeedback(r.feedback || "");
                                }}
                              >
                                {r.rating ? `★ ${r.rating} sao` : "★ Đánh giá"}
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === "schedules" ? (
        /* ================= TAB 4: THỜI KHÓA BIỂU & LỊCH THI (SV6) ================= */
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          {/* Cột 1: Thời khóa biểu trong tuần */}
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
              <CalendarCheck2 size={18} color="#0284c7" /> Thời khóa biểu học tập học kỳ 1
            </h3>

            {schedules.filter((s) => s.schedule_type === "LICH_HOC").length === 0 ? (
              <EmptyState title="Chưa có thời khóa biểu" description="Lịch học của bạn sẽ hiển thị sau khi hoàn tất đăng ký học phần." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {schedules
                  .filter((s) => s.schedule_type === "LICH_HOC")
                  .map((sch) => (
                    <div
                      key={sch.id}
                      style={{
                        padding: "14px",
                        borderRadius: "10px",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <span
                          style={{
                            background: "#e0f2fe",
                            color: "#0369a1",
                            fontWeight: 700,
                            fontSize: "12px",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            display: "inline-block",
                            marginBottom: "4px",
                          }}
                        >
                          Thứ {sch.day_of_week === 8 ? "CN" : sch.day_of_week} ({sch.start_time} - {sch.end_time})
                        </span>
                        <h4 style={{ margin: "2px 0", fontSize: "14.5px", fontWeight: 700 }}>{sch.course_name}</h4>
                        <small style={{ color: "#64748b" }}>
                          Giảng viên: {sch.lecturer_name} · Mã: {sch.course_code}
                        </small>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <span style={{ fontWeight: 700, color: "#1e293b", fontSize: "14px" }}>{sch.room}</span>
                        <small style={{ display: "block", color: "#64748b" }}>{sch.notes || "Lý thuyết"}</small>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Cột 2: Lịch thi kết thúc học phần */}
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
              <Clock size={18} color="#dc2626" /> Lịch thi kết thúc học phần
            </h3>

            {schedules.filter((s) => s.schedule_type === "LICH_THI").length === 0 ? (
              <EmptyState title="Chưa có lịch thi" description="Lịch thi sẽ được công bố trước đợt thi 2 tuần." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {schedules
                  .filter((s) => s.schedule_type === "LICH_THI")
                  .map((sch) => (
                    <div
                      key={sch.id}
                      style={{
                        padding: "14px",
                        borderRadius: "10px",
                        background: "#fff1f2",
                        border: "1px solid #fecdd3",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <span
                          style={{
                            background: "#ffe4e6",
                            color: "#be123c",
                            fontWeight: 700,
                            fontSize: "12px",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            display: "inline-block",
                            marginBottom: "4px",
                          }}
                        >
                          {sch.schedule_date ? new Date(sch.schedule_date).toLocaleDateString("vi-VN") : "Lịch thi"} · {sch.start_time}
                        </span>
                        <h4 style={{ margin: "2px 0", fontSize: "14.5px", fontWeight: 700 }}>{sch.course_name}</h4>
                        <small style={{ color: "#881337" }}>
                          Hình thức: {sch.exam_format || "Tự luận"} · Giám thị: {sch.lecturer_name}
                        </small>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <strong style={{ color: "#be123c", fontSize: "15px" }}>{sch.room}</strong>
                        <small style={{ display: "block", color: "#64748b" }}>Có mặt trước 15p</small>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      ) : activeTab === "announcements" ? (
        /* ================= TAB 5: THÔNG BÁO HỌC TẬP (SV5) ================= */
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {announcements.map((item) => (
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
      ) : (
        /* ================= TAB 6: TICKETS KỸ THUẬT & FAQ ================= */
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
              Kênh phản ánh sự cố kỹ thuật, tài khoản học tập và câu hỏi thường gặp về quy chế NEU.
            </p>
            {user && (
              <button className="button button-primary" onClick={() => setTicketModalOpen(true)}>
                <CircleHelp size={16} /> Gửi yêu cầu hỗ trợ kỹ thuật
              </button>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px" }}>
            <div className="table-panel">
              <div className="responsive-table">
                <table>
                  <thead>
                    <tr>
                      <th>Mã</th>
                      <th>Chủ đề</th>
                      <th>Nhóm</th>
                      <th>Ngày gửi</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <strong className="mono">{t.code}</strong>
                        </td>
                        <td>
                          <strong>{t.subject}</strong>
                        </td>
                        <td>{t.category}</td>
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

            {/* Cột FAQ */}
            <div
              style={{
                background: "var(--card-bg, #ffffff)",
                border: "1px solid var(--border-color, #e2e8f0)",
                borderRadius: "14px",
                padding: "20px",
              }}
            >
              <h4 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 700 }}>Câu hỏi thường gặp</h4>
              <div className="faq-list">
                {faqs.slice(0, 6).map((faq) => (
                  <details className="faq-item" key={faq.id}>
                    <summary>
                      <span>{faq.question}</span>
                      <ChevronDown size={15} />
                    </summary>
                    <div className="faq-answer">
                      <p>{faq.answer}</p>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GỬI ĐƠN SINH VIÊN MỚI (SV3) */}
      {requestModalOpen && (
        <div className="modal-backdrop" onClick={() => setRequestModalOpen(false)}>
          <section className="form-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "540px" }}>
            <div className="modal-heading">
              <div>
                <div className="eyebrow">DỊCH VỤ MỘT CỬA SINH VIÊN</div>
                <h2>Gửi đơn trực tuyến</h2>
                <p>Chọn đúng loại đơn theo nhu cầu để Phòng Quản lý Đào tạo tiếp nhận xử lý nhanh nhất.</p>
              </div>
              <button className="modal-close" onClick={() => setRequestModalOpen(false)}>
                ×
              </button>
            </div>

            <form className="form-stack" onSubmit={handleCreateRequest}>
              <label>
                Loại thủ tục / Đơn từ *
                <select value={reqType} onChange={(e) => setReqType(e.target.value)}>
                  <option value="Xác nhận sinh viên">1. Giấy xác nhận sinh viên (vé xe bus, vay vốn, hoãn NVQS)</option>
                  <option value="Cấp bảng điểm tạm thời">2. Cấp bảng điểm tạm thời (xét học bổng, việc làm)</option>
                  <option value="Xin bảo lưu kết quả học tập">3. Xin bảo lưu kết quả học tập</option>
                  <option value="Xin rút học phí / hoàn phí">4. Xin rút học phí / hoàn phí</option>
                </select>
              </label>

              <label>
                Tiêu đề đơn *
                <input
                  required
                  value={reqTitle}
                  onChange={(e) => setReqTitle(e.target.value)}
                  placeholder="Ví dụ: Xin cấp giấy xác nhận sinh viên làm thủ tục vay vốn..."
                />
              </label>

              <label>
                Lý do & Nội dung cụ thể *
                <textarea
                  required
                  rows={4}
                  value={reqReason}
                  onChange={(e) => setReqReason(e.target.value)}
                  placeholder="Trình bày rõ lý do, học kỳ và mục đích sử dụng..."
                />
              </label>

              <label>
                Tên tệp minh chứng đính kèm (nếu có)
                <input
                  value={reqAttachment}
                  onChange={(e) => setReqAttachment(e.target.value)}
                  placeholder="minh_chung_ho_ngheo.pdf"
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="button button-ghost" onClick={() => setRequestModalOpen(false)}>
                  Hủy
                </button>
                <button type="submit" className="button button-primary" disabled={submittingReq}>
                  {submittingReq ? "Đang gửi..." : "Gửi đơn trực tuyến"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* MODAL ĐÁNH GIÁ SAO (SV7) */}
      {ratingModalReq && (
        <div className="modal-backdrop" onClick={() => setRatingModalReq(null)}>
          <section className="form-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "460px" }}>
            <div className="modal-heading">
              <div>
                <div className="eyebrow">ĐÁNH GIÁ CHẤT LƯỢNG PHỤC VỤ</div>
                <h2>Đánh giá xử lý đơn {ratingModalReq.code}</h2>
                <p>Thầy/Cô và Phòng ban mong nhận được phản hồi để nâng cao chất lượng hỗ trợ sinh viên.</p>
              </div>
              <button className="modal-close" onClick={() => setRatingModalReq(null)}>
                ×
              </button>
            </div>

            <form className="form-stack" onSubmit={handleSubmitRating}>
              <div style={{ textAlign: "center", margin: "10px 0" }}>
                <span style={{ fontSize: "14px", color: "#64748b", display: "block", marginBottom: "8px" }}>
                  Mức độ hài lòng của bạn:
                </span>
                <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRatingStars(s)}
                      style={{
                        background: "none",
                        border: "none",
                        fontSize: "30px",
                        cursor: "pointer",
                        color: s <= ratingStars ? "#f59e0b" : "#cbd5e1",
                      }}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <label>
                Ý kiến góp ý thêm (tùy chọn):
                <textarea
                  rows={3}
                  value={ratingFeedback}
                  onChange={(e) => setRatingFeedback(e.target.value)}
                  placeholder="Thủ tục nhanh chóng, nhiệt tình..."
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="button button-ghost" onClick={() => setRatingModalReq(null)}>
                  Hủy
                </button>
                <button type="submit" className="button button-primary" disabled={submittingRating}>
                  {submittingRating ? "Đang gửi..." : "Xác nhận đánh giá"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* MODAL ADMIN DUYỆT ĐƠN SINH VIÊN (AD_HT2) */}
      {adminReqModal && (
        <div className="modal-backdrop" onClick={() => setAdminReqModal(null)}>
          <section className="form-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "520px" }}>
            <div className="modal-heading">
              <div>
                <div className="eyebrow">QUẢN TRỊ DỊCH VỤ SINH VIÊN</div>
                <h2>Xử lý đơn {adminReqModal.code}</h2>
                <p>Sinh viên: {adminReqModal.student_name} ({adminReqModal.student_number})</p>
              </div>
              <button className="modal-close" onClick={() => setAdminReqModal(null)}>
                ×
              </button>
            </div>

            <form className="form-stack" onSubmit={handleAdminUpdateRequest}>
              <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <strong>{adminReqModal.request_type}: {adminReqModal.title}</strong>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>{adminReqModal.reason}</p>
              </div>

              <label>
                Trạng thái phê duyệt *
                <select value={adminNextStatus} onChange={(e) => setAdminNextStatus(e.target.value)}>
                  <option value="DANG_XU_LY">Đang xử lý</option>
                  <option value="DA_DUYET">Đã duyệt (Hoàn thành)</option>
                  <option value="YEU_CAU_BO_SUNG">Yêu cầu bổ sung hồ sơ</option>
                  <option value="TU_CHOI">Từ chối đơn</option>
                </select>
              </label>

              <label>
                Lý do / Phản hồi cho sinh viên:
                <textarea
                  rows={3}
                  value={adminRejectionReason}
                  onChange={(e) => setAdminRejectionReason(e.target.value)}
                  placeholder="Ghi rõ hướng dẫn nhận kết quả hoặc lý do từ chối..."
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="button button-ghost" onClick={() => setAdminReqModal(null)}>
                  Hủy
                </button>
                <button type="submit" className="button button-primary" disabled={submittingAdminReq}>
                  {submittingAdminReq ? "Đang lưu..." : "Xác nhận xử lý"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
