"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ArrowRight, BookOpen, ChevronDown, CircleHelp, Download, MessageCircle, Paperclip, Search, Send, Sparkles, TicketCheck } from "lucide-react";
import { API_BASE, api, Ticket } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { DemoTag, EmptyState, ErrorNotice, Loading, PageTitle, StatusBadge } from "@/components/ui";

import { StudentHandbook } from "./student-handbook";

type FAQ = { id: string; question: string; answer: string; category: string };
type Agent = { id: string; full_name: string; email: string };
type SupportStats = { total: number; by_status: { status: string; count: number }[]; success_rate: number };
const supportSchema = z.object({ category: z.string().min(1), subject: z.string().min(4, "Tiêu đề cần ít nhất 4 ký tự."), description: z.string().min(8, "Mô tả cần ít nhất 8 ký tự."), priority: z.string().min(1) });
type SupportValues = z.infer<typeof supportSchema>;
const categories = ["Tuyển sinh", "Hồ sơ sinh viên", "Học phí và tài chính", "Đào tạo và học tập", "Giấy tờ và xác nhận", "Tài khoản và công nghệ", "Cơ sở vật chất", "Khác"];
const statuses = ["Mới tiếp nhận", "Đang xử lý", "Chờ bổ sung thông tin", "Đã giải quyết", "Đã đóng"];
const staffRoles = ["super_admin", "support_staff"];

export function Support() {
  const { user } = useAuth();
  const isStaff = Boolean(user && staffRoles.includes(user.role));
  const [faqs, setFaqs] = useState<FAQ[]>([]); const [tickets, setTickets] = useState<Ticket[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]); const [stats, setStats] = useState<SupportStats | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  const [formOpen, setFormOpen] = useState(false); const [activeTicket, setActiveTicket] = useState<string | null>(null); const [busyTicket, setBusyTicket] = useState("");
  const [mainTab, setMainTab] = useState<"handbook" | "tickets">("handbook");
  const [query, setQuery] = useState(""); const [category, setCategory] = useState(""); const [status, setStatus] = useState("");

  async function loadTickets() {
    const params = new URLSearchParams();
    if (isStaff && query.trim()) params.set("q", query.trim());
    if (isStaff && category) params.set("category", category);
    if (isStaff && status) params.set("status", status);
    setTickets(await api<Ticket[]>(`/support/tickets${params.size ? `?${params}` : ""}`));
  }
  useEffect(() => {
    let live = true;
    Promise.all([
      api<FAQ[]>("/support/faqs"),
      isStaff ? api<SupportStats>("/support/dashboard") : Promise.resolve(null),
      isStaff ? api<Agent[]>("/support/agents") : Promise.resolve([]),
    ]).then(([faqRows, dashboard, agentRows]) => {
      if (live) { setFaqs(faqRows); setStats(dashboard); setAgents(agentRows); }
    }).catch(reason => { if (live) setError(reason instanceof Error ? reason.message : "Không tải được thông tin hỗ trợ."); });
    return () => { live = false; };
  }, [user?.id, user?.role, isStaff]);
  useEffect(() => {
    let live = true;
    if (!user) { setTickets([]); setLoading(false); return () => { live = false; }; }
    const timer = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams();
      if (isStaff && query.trim()) params.set("q", query.trim());
      if (isStaff && category) params.set("category", category);
      if (isStaff && status) params.set("status", status);
      api<Ticket[]>(`/support/tickets${params.size ? `?${params}` : ""}`)
        .then(rows => { if (live) { setTickets(rows); setError(""); } })
        .catch(reason => { if (live) setError(reason instanceof Error ? reason.message : "Không tải được danh sách yêu cầu."); })
        .finally(() => { if (live) setLoading(false); });
    }, isStaff ? 250 : 0);
    return () => { live = false; clearTimeout(timer); };
  }, [user?.id, user?.role, isStaff, query, category, status]);

  async function reply(ticket: Ticket, body: string) {
    setBusyTicket(ticket.id); setError("");
    try { await api(`/support/tickets/${ticket.id}/messages`, { method: "POST", body: JSON.stringify({ body }) }); await loadTickets(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không gửi được phản hồi."); }
    finally { setBusyTicket(""); }
  }
  async function mutateTicket(ticket: Ticket, path: string, payload: object) {
    setBusyTicket(ticket.id); setError("");
    try {
      await api(`/support/tickets/${ticket.id}/${path}`, { method: "PATCH", body: JSON.stringify(payload) });
      await loadTickets();
      if (isStaff) setStats(await api<SupportStats>("/support/dashboard"));
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không cập nhật được yêu cầu."); }
    finally { setBusyTicket(""); }
  }
  async function rate(ticket: Ticket, rating: number, feedback: string) {
    setBusyTicket(ticket.id); setError("");
    try { await api(`/support/tickets/${ticket.id}/rating`, { method: "POST", body: JSON.stringify({ rating, feedback }) }); await loadTickets(); setSuccess("Cảm ơn bạn đã đánh giá chất lượng hỗ trợ."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không lưu được đánh giá."); }
    finally { setBusyTicket(""); }
  }
  async function downloadAttachment(ticket: Ticket, attachmentId: string, filename: string) {
    try {
      const token = window.sessionStorage.getItem("study_access_token");
      const response = await fetch(`${API_BASE}/support/tickets/${ticket.id}/attachments/${attachmentId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!response.ok) throw new Error("Không tải được tệp đính kèm.");
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a");
      link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không tải được tệp."); }
  }
  const countByStatus = useMemo(() => Object.fromEntries((stats?.by_status ?? []).map(row => [row.status, row.count])), [stats]);

  return <div className="module-page">
    <PageTitle
      eyebrow="MODULE M12 · HỖ TRỢ NGƯỜI HỌC"
      title="Trung tâm hỗ trợ người học NEU Study"
      description="Cẩm nang sinh viên, quy chế đào tạo tín chỉ, tra cứu 40+ website hệ sinh thái số NEU và hệ thống một cửa tiếp nhận yêu cầu."
      action={
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <a href="/assistant" className="button button-secondary" style={{ display: "inline-flex", alignItems: "center", gap: "6px", textDecoration: "none" }}>
            <Sparkles size={16} /> Hỏi NEU Study AI
          </a>
          {user && (
            <button className="button button-primary" onClick={() => { setMainTab("tickets"); setFormOpen(true); }}>
              <MessageCircle size={17} /> Tạo yêu cầu hỗ trợ
            </button>
          )}
        </div>
      }
    />

    <div className="support-nav-tabs" style={{ display: "flex", gap: "8px", borderBottom: "1px solid #e2e8f0", marginBottom: "20px", background: "#f8fafc", padding: "6px 8px 0", borderRadius: "10px 10px 0 0" }}>
      <button
        type="button"
        onClick={() => setMainTab("handbook")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 18px",
          fontSize: "14px",
          fontWeight: 600,
          border: "none",
          borderBottom: mainTab === "handbook" ? "2px solid #0284c7" : "2px solid transparent",
          color: mainTab === "handbook" ? "#0284c7" : "#64748b",
          background: mainTab === "handbook" ? "#ffffff" : "transparent",
          borderRadius: "8px 8px 0 0",
          cursor: "pointer",
          transition: "all 0.15s ease"
        }}
      >
        <BookOpen size={16} /> Cẩm nang sinh viên & Tra cứu NEU
      </button>

      <button
        type="button"
        onClick={() => setMainTab("tickets")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 18px",
          fontSize: "14px",
          fontWeight: 600,
          border: "none",
          borderBottom: mainTab === "tickets" ? "2px solid #0284c7" : "2px solid transparent",
          color: mainTab === "tickets" ? "#0284c7" : "#64748b",
          background: mainTab === "tickets" ? "#ffffff" : "transparent",
          borderRadius: "8px 8px 0 0",
          cursor: "pointer",
          transition: "all 0.15s ease"
        }}
      >
        <TicketCheck size={16} /> {isStaff ? "Quản lý yêu cầu hỗ trợ (Cán bộ)" : "Phiếu yêu cầu của tôi (Một cửa)"}
        {tickets.length > 0 && (
          <span style={{ fontSize: "11px", background: mainTab === "tickets" ? "#e0f2fe" : "#e2e8f0", color: mainTab === "tickets" ? "#0369a1" : "#475569", padding: "1px 7px", borderRadius: "10px", marginLeft: "4px" }}>
            {tickets.length}
          </span>
        )}
      </button>
    </div>

    {mainTab === "handbook" ? (
      <StudentHandbook />
    ) : (
      <>
        {!isStaff && (
          <div className="support-hero">
            <div className="support-hero-icon"><CircleHelp size={24} /></div>
            <div>
              <h2>Chúng tôi có thể giúp gì cho bạn?</h2>
              <p>Chọn chủ đề bên dưới hoặc gửi yêu cầu để bộ phận phụ trách hỗ trợ.</p>
            </div>
            <div className="support-hero-meta">
              <span><i /> Thường phản hồi trong 1 ngày làm việc</span>
              <DemoTag />
            </div>
          </div>
        )}
        {isStaff && stats && (
          <div className="support-stats-grid">
            {[{ label: "Tổng yêu cầu", value: stats.total, status: "" }, ...statuses.map(value => ({ label: value, value: countByStatus[value] ?? 0, status: value }))].map(item => (
              <button key={item.label} className={`support-stat ${status === item.status ? "selected" : ""}`} onClick={() => setStatus(status === item.status ? "" : item.status)}>
                <span>{item.label}</span><strong>{item.value}</strong>
              </button>
            ))}
            <div className="support-stat success-rate">
              <span>Tỷ lệ xử lý thành công</span><strong>{stats.success_rate}%</strong>
            </div>
          </div>
        )}
        {error && <ErrorNotice message={error} />}
        {success && <div className="success-notice"><TicketCheck size={16} />{success}<button onClick={() => setSuccess("")}>×</button></div>}
        <div className="support-grid">
          <section>
            <div className="section-heading">
              <div>
                <h2>{isStaff ? "Danh sách yêu cầu" : "Yêu cầu của tôi"}</h2>
                <p>{isStaff ? "Tìm kiếm, lọc và xử lý yêu cầu" : "Theo dõi trao đổi và trạng thái xử lý"}</p>
              </div>
              <TicketCheck size={20} />
            </div>
            {isStaff && (
              <div className="support-filters">
                <label className="search-field">
                  <Search size={17} />
                  <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Mã yêu cầu, sinh viên hoặc nội dung…" />
                </label>
                <select aria-label="Lọc danh mục" value={category} onChange={event => setCategory(event.target.value)}>
                  <option value="">Tất cả danh mục</option>
                  {categories.map(value => <option key={value}>{value}</option>)}
                </select>
                <select aria-label="Lọc trạng thái" value={status} onChange={event => setStatus(event.target.value)}>
                  <option value="">Tất cả trạng thái</option>
                  {statuses.map(value => <option key={value}>{value}</option>)}
                </select>
              </div>
            )}
            {loading ? (
              <Loading />
            ) : !user ? (
              <EmptyState icon={<MessageCircle size={22} />} title="Đăng nhập để xem yêu cầu" description="Yêu cầu chỉ hiển thị với người gửi và nhân viên được phân quyền." />
            ) : tickets.length === 0 ? (
              <EmptyState icon={<TicketCheck size={22} />} title={isStaff ? "Không tìm thấy yêu cầu" : "Bạn chưa có yêu cầu nào"} description={isStaff ? "Thử thay đổi từ khóa hoặc bộ lọc." : "Tạo yêu cầu mới để được bộ phận phụ trách hỗ trợ."} action={!isStaff ? <button className="button button-secondary" onClick={() => setFormOpen(true)}>Tạo yêu cầu đầu tiên</button> : undefined} />
            ) : (
              <div className="ticket-list">
                {tickets.map(ticket => (
                  <article className={`ticket-card ${activeTicket === ticket.id ? "expanded" : ""}`} key={ticket.id}>
                    <button className="ticket-card-head" onClick={() => setActiveTicket(activeTicket === ticket.id ? null : ticket.id)}>
                      <span className="ticket-code">{ticket.code}</span>
                      <span className="ticket-title">
                        <strong>{ticket.subject}</strong>
                        <small>{ticket.category} · {new Date(ticket.created_at).toLocaleDateString("vi-VN")}{isStaff ? ` · ${ticket.owner_name}` : ""}</small>
                      </span>
                      <StatusBadge>{ticket.status}</StatusBadge>
                      <ChevronDown size={17} />
                    </button>
                    {activeTicket === ticket.id && (
                      <div className="ticket-detail">
                        <p>{ticket.description}</p>
                        {ticket.attachments?.length > 0 && (
                          <div className="attachment-list">
                            {ticket.attachments.map(file => (
                              <button key={file.id} onClick={() => downloadAttachment(ticket, file.id, file.filename)}>
                                <Download size={15} />{file.filename}<small>{(file.size_bytes / 1024).toFixed(0)} KB</small>
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="ticket-thread">
                          {ticket.messages.map(message => (
                            <div className={`thread-message ${message.author_id === user.id ? "own" : ""}`} key={message.id}>
                              <span>{message.author_id === user.id ? "Bạn" : isStaff ? "Người tham gia" : "Bộ phận hỗ trợ"} · {new Date(message.created_at).toLocaleString("vi-VN")}</span>
                              <p>{message.body}</p>
                            </div>
                          ))}
                        </div>
                        <ReplyBox onSend={body => reply(ticket, body)} busy={busyTicket === ticket.id} />
                        {isStaff && (
                          <div className="ticket-manage">
                            <label>Trạng thái
                              <select disabled={busyTicket === ticket.id} value={ticket.status} onChange={event => mutateTicket(ticket, "status", { status: event.target.value })}>
                                {statuses.map(value => <option key={value}>{value}</option>)}
                              </select>
                            </label>
                            <label>Người phụ trách
                              <select disabled={busyTicket === ticket.id} value={ticket.assignee_id ?? ""} onChange={event => mutateTicket(ticket, "assignee", { assignee_id: event.target.value || null })}>
                                <option value="">Chưa phân công</option>
                                {agents.map(agent => <option key={agent.id} value={agent.id}>{agent.full_name}</option>)}
                              </select>
                            </label>
                          </div>
                        )}
                        {!isStaff && ["Đã giải quyết", "Đã đóng"].includes(ticket.status) && (
                          <TicketRating rating={ticket.satisfaction_rating} feedback={ticket.satisfaction_feedback} busy={busyTicket === ticket.id} onRate={(value, feedback) => rate(ticket, value, feedback)} />
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
          <aside className="faq-side">
            <div className="section-heading">
              <div><h2>Câu hỏi thường gặp</h2><p>Câu trả lời nhanh từ NEU Study</p></div>
              <CircleHelp size={20} />
            </div>
            {loading ? (
              <Loading />
            ) : (
              <div className="faq-list">
                {faqs.map(faq => (
                  <details className="faq-item" key={faq.id}>
                    <summary><span>{faq.question}</span><ChevronDown size={17} /></summary>
                    <div className="faq-answer"><span className="faq-category">{faq.category}</span><p>{faq.answer}</p></div>
                  </details>
                ))}
              </div>
            )}
            <button className="faq-ai-link" onClick={() => window.location.assign("/assistant")}>
              <span className="faq-ai-icon">✦</span>
              <span><strong>Cần trợ giúp thêm?</strong><small>Hỏi NEU Study AI Assistant</small></span>
              <ArrowRight size={17} />
            </button>
          </aside>
        </div>
      </>
    )}
    {formOpen && <TicketDialog onClose={() => setFormOpen(false)} onCreated={async (ticket, note) => { setFormOpen(false); await loadTickets(); setActiveTicket(ticket.id); setSuccess(note ? `Đã tạo yêu cầu ${ticket.code}. ${note}` : `Đã tạo yêu cầu ${ticket.code}.`); }} />}
  </div>;
}

function ReplyBox({ onSend, busy }: { onSend: (body: string) => void; busy: boolean }) {
  const [body, setBody] = useState("");
  return <form className="reply-box" onSubmit={event => { event.preventDefault(); if (body.trim()) { onSend(body.trim()); setBody(""); } }}><input value={body} onChange={event => setBody(event.target.value)} placeholder="Viết phản hồi…" /><button className="button button-primary" disabled={busy || !body.trim()} aria-label="Gửi phản hồi"><Send size={16} /></button></form>;
}

function TicketRating({ rating, feedback, busy, onRate }: { rating: number | null; feedback: string | null; busy: boolean; onRate: (rating: number, feedback: string) => void }) {
  const [selected, setSelected] = useState(0); const [note, setNote] = useState("");
  if (rating) return <div className="rating-saved"><span>Đánh giá của bạn</span><strong>{"★".repeat(rating)}{"☆".repeat(5 - rating)}</strong>{feedback && <small>{feedback}</small>}</div>;
  return <div className="ticket-rating"><span>Yêu cầu đã giải quyết — bạn đánh giá thế nào?</span><div className="rating-actions"><div className="rating-stars">{[1, 2, 3, 4, 5].map(value => <button key={value} type="button" className={selected >= value ? "selected" : ""} onClick={() => setSelected(value)} aria-label={`${value} sao`}>★</button>)}</div><input value={note} onChange={event => setNote(event.target.value)} placeholder="Góp ý (không bắt buộc)" maxLength={1000} /><button className="mini-button" disabled={!selected || busy} onClick={() => onRate(selected, note)}>Gửi đánh giá</button></div></div>;
}

function TicketDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (ticket: Ticket, note?: string) => void }) {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [files, setFiles] = useState<FileList | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<SupportValues>({ resolver: zodResolver(supportSchema), defaultValues: { category: "Đào tạo và học tập", priority: "Bình thường" } });
  const submit = async (values: SupportValues) => {
    setBusy(true); setError("");
    try {
      const ticket = await api<Ticket>("/support/tickets", { method: "POST", body: JSON.stringify(values) });
      const uploadErrors: string[] = [];
      if (files) for (const file of Array.from(files)) {
        const data = new FormData(); data.append("file", file);
        try { await api(`/support/tickets/${ticket.id}/attachments`, { method: "POST", body: data }); }
        catch (reason) { uploadErrors.push(`${file.name}: ${reason instanceof Error ? reason.message : "lỗi tải tệp"}`); }
      }
      onCreated(ticket, uploadErrors.length ? `Một số tệp chưa tải lên được (${uploadErrors.join("; ")}).` : undefined);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể gửi yêu cầu."); }
    finally { setBusy(false); }
  };
  return <div className="modal-backdrop" onClick={onClose}><section className="form-modal" role="dialog" aria-modal="true" onClick={event => event.stopPropagation()}><div className="modal-heading"><div><div className="eyebrow">HỖ TRỢ NGƯỜI HỌC</div><h2>Gửi yêu cầu hỗ trợ</h2><p>Bạn có thể đính kèm PDF, DOCX, TXT hoặc ảnh (tối đa 10 MB/tệp).</p></div><button className="modal-close" onClick={onClose}>×</button></div><form className="form-stack" onSubmit={handleSubmit(submit)}><label>Nhóm vấn đề<select {...register("category")}>{categories.map(value => <option key={value}>{value}</option>)}</select></label><label>Tiêu đề<input {...register("subject")} placeholder="Mô tả ngắn gọn vấn đề" />{errors.subject && <small className="field-error">{errors.subject.message}</small>}</label><label>Nội dung<textarea rows={5} {...register("description")} placeholder="Mô tả chi tiết để chúng tôi hỗ trợ nhanh hơn…" />{errors.description && <small className="field-error">{errors.description.message}</small>}</label><label>Mức độ ưu tiên<select {...register("priority")}><option>Bình thường</option><option>Thấp</option><option>Cao</option></select></label><label className="file-picker"><span><Paperclip size={16} /> Tài liệu đính kèm</span><input type="file" multiple accept=".pdf,.docx,.txt,.png,.jpg,.jpeg" onChange={event => setFiles(event.target.files)} /><small>{files?.length ? Array.from(files).map(file => file.name).join(", ") : "Không bắt buộc"}</small></label>{error && <div className="inline-error">{error}</div>}<div className="modal-actions"><button type="button" className="button button-ghost" onClick={onClose}>Hủy</button><button className="button button-primary" disabled={busy}>{busy ? "Đang gửi…" : "Gửi yêu cầu"}<ArrowRight size={16} /></button></div></form></section></div>;
}
