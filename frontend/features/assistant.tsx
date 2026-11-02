"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, Check, FileText, MessageCircle, MessageSquarePlus, MoreHorizontal, Pencil, Plus, Send, Sparkles, Square, Trash2, UserRound, X } from "lucide-react";
import { API_BASE, getApiBase, api, ApiError, authenticatedFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { EmptyState, ErrorNotice, Loading } from "@/components/ui";

type ChatMessage = { id: string; role: string; content: string; sources: { title: string; excerpt: string; source_type: string }[]; created_at: string };
type Conversation = { id: string; title: string; updated_at: string; messages: ChatMessage[] };
const suggestions = [
  "Đại học Kinh tế Quốc dân (NEU) ở đâu và có gì nổi bật?",
  "NEU có những phương thức xét tuyển nào năm nay?",
  "Các ngành học hot nhất và điểm chuẩn của NEU là gì?",
  "Chương trình Tiên tiến & Chất lượng cao (AEP) của NEU là gì?",
  "Học phí và chính sách học bổng tại NEU như thế nào?",
  "Những deadline và lịch thi nào của tôi sắp đến hạn?",
];

export function Assistant() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [providerLabel, setProviderLabel] = useState("");
  const [thinkingStatus, setThinkingStatus] = useState("Đang tìm nguồn và soạn câu trả lời…");
  const [menuId, setMenuId] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const requestController = useRef<AbortController | null>(null);

  async function loadConversations() {
    const rows = await api<Conversation[]>("/assistant/conversations");
    setConversations(rows);
    if (rows.length) {
      const current = rows.find(row => row.id === activeId) ?? rows[0];
      setActiveId(current.id); setMessages(current.messages ?? []);
    } else { setActiveId(""); setMessages([]); }
  }
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    api<Conversation[]>("/assistant/conversations").then(rows => {
      setConversations(rows);
      if (rows.length) { setActiveId(rows[0].id); setMessages(rows[0].messages ?? []); }
      api<{ provider: string; model: string; configured: boolean; fallback_provider: string | null; fallback_configured: boolean }>("/assistant/status")
        .then(status => {
          setDemoMode(!status.configured && !status.fallback_configured);
          setProviderLabel(status.configured
            ? `${status.provider} · ${status.model}${status.fallback_configured ? ` · dự phòng ${status.fallback_provider}` : ""}`
            : status.fallback_configured
              ? `Dự phòng ${status.fallback_provider} · sẽ dùng khi gửi câu hỏi`
              : "Chỉ tra cứu tài liệu");
        }).catch(() => { /* Chat still works if the optional status request fails. */ });
    }).catch(reason => setError(reason.message)).finally(() => setLoading(false));
  }, [user]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, thinking]);
  useEffect(() => () => requestController.current?.abort(), []);

  async function newConversation() {
    requestController.current?.abort();
    setError("");
    try {
      const row = await api<Conversation>("/assistant/conversations", { method: "POST", body: JSON.stringify({ title: "Cuộc trò chuyện mới" }) });
      setConversations(current => [row, ...current]); setActiveId(row.id); setMessages([]); setDemoMode(false); inputRef.current?.focus();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tạo cuộc trò chuyện."); }
  }
  async function chooseConversation(row: Conversation) {
    requestController.current?.abort();
    setActiveId(row.id); setMessages(row.messages ?? []); setDemoMode(false); setError("");
    try {
      const fresh = await api<Conversation>(`/assistant/conversations/${row.id}`);
      if (activeId === row.id) setMessages(fresh.messages ?? []);
    } catch { /* The list already includes the saved conversation messages. */ }
  }
  async function sendMessage(text = input) {
    const prompt = text.trim();
    if (!prompt || thinking) return;
    setInput(""); setError(""); setThinking(true);
    let conversationId = activeId;
    const controller = new AbortController();
    requestController.current = controller;
    const pendingId = `pending-${crypto.randomUUID()}`;
    let receivedTerminalEvent = false;
    let accumulatedText = "";
    try {
      const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: prompt, sources: [], created_at: new Date().toISOString() };
      setMessages(current => [...current, userMessage, { id: pendingId, role: "assistant", content: "", sources: [], created_at: new Date().toISOString() }]);
      setThinkingStatus("Đang truy xuất tài liệu liên quan…");

      let response: Response;
      if (!user) {
        response = await fetch(`${getApiBase()}/chat/guest/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify({ message: prompt }),
          signal: controller.signal
        });
      } else {
        if (!conversationId) {
          const created = await api<Conversation>("/assistant/conversations", { method: "POST", body: JSON.stringify({ title: prompt.slice(0, 70) }) });
          conversationId = created.id; setActiveId(created.id); setConversations(current => [created, ...current]);
        }
        response = await authenticatedFetch(`/assistant/conversations/${conversationId}/messages/stream`, {
          method: "POST", body: JSON.stringify({ message: prompt }), signal: controller.signal,
          headers: { Accept: "text/event-stream" },
        });
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new ApiError(body.detail ?? "Không gửi được câu hỏi đến NEU Study AI.", response.status);
      }
      if (!response.body) throw new ApiError("Trình duyệt không nhận được luồng trả lời.", 0);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const handleFrame = (frame: string) => {
        const lines = frame.split("\n");
        const eventName = lines.find(line => line.startsWith("event:"))?.slice(6).trim();
        const rawData = lines.filter(line => line.startsWith("data:")).map(line => line.slice(5).trim()).join("\n");
        if (!eventName || !rawData) return;
        const payload = JSON.parse(rawData);
        if (eventName === "status") {
          if (payload.state === "retrieving") setThinkingStatus("Đang truy xuất tài liệu liên quan…");
          else if (payload.state === "requesting") setThinkingStatus("Đang kết nối nhà cung cấp AI…");
          else if (payload.state === "retrying") setThinkingStatus(`${payload.provider === "gemini" ? "Gemini" : "Groq"} đang thử lại (${payload.attempt}/${payload.max_attempts})…`);
          else if (payload.state === "switching") setThinkingStatus(`Đang chuyển từ ${payload.provider} sang ${payload.fallback_provider}…`);
          else if (payload.state === "generating") setThinkingStatus("Đang tạo câu trả lời…");
        } else if (eventName === "token") {
          const chunkText = String(payload.text ?? "");
          accumulatedText += chunkText;
          setMessages(current => current.map(message => message.id === pendingId
            ? { ...message, content: message.content + chunkText }
            : message));
          setThinkingStatus("Đang tạo câu trả lời…");
        } else if (eventName === "complete") {
          receivedTerminalEvent = true;
          const result = payload as { message: ChatMessage; response_mode: string; provider: string | null; model: string | null; used_fallback: boolean };
          setMessages(current => current.map(message => message.id === pendingId ? result.message : message));
          setDemoMode(result.response_mode !== "cloud");
          setProviderLabel(result.response_mode === "cloud" && result.provider
            ? `${result.provider}${result.model ? ` · ${result.model}` : ""}${result.used_fallback ? " (dự phòng)" : ""}`
            : result.response_mode === "retrieval_only" ? "Chỉ tra cứu tài liệu" : "Tra cứu dữ liệu tài khoản");
          setConversations(current => current.map(row => row.id === conversationId
            ? { ...row, title: row.title === "Cuộc trò chuyện mới" ? prompt.slice(0, 70) : row.title, updated_at: new Date().toISOString() }
            : row));
        } else if (eventName === "error") {
          receivedTerminalEvent = true;
          // Keep accumulated text if partial generation succeeded
          if (!accumulatedText.trim()) {
            setMessages(current => current.filter(message => message.id !== pendingId));
          }
          setError(String(payload.message ?? "NEU Study AI tạm thời không thể trả lời."));
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        buffer = (buffer + decoder.decode(value, { stream: !done })).replace(/\r\n/g, "\n");
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          handleFrame(frame);
          boundary = buffer.indexOf("\n\n");
        }
        if (done) break;
      }
      if (!receivedTerminalEvent && !accumulatedText.trim()) {
        throw new ApiError("Kết nối bị đóng trước khi NEU Study AI hoàn tất câu trả lời.", 0);
      }
    } catch (reason) {
      if (!accumulatedText.trim()) {
        setMessages(current => current.filter(message => message.id !== pendingId));
      }
      if (controller.signal.aborted) {
        setError("Đã dừng tạo câu trả lời. Nội dung chưa hoàn tất không được lưu.");
      } else if (reason instanceof TypeError && String(reason.message).toLowerCase().includes("fetch")) {
        setError(`Không thể kết nối máy chủ API (${getApiBase()}). Vui lòng kiểm tra biến môi trường NEXT_PUBLIC_API_URL trên Vercel hoặc đảm bảo Backend Cloud đang hoạt động.`);
      } else {
        setError(reason instanceof Error ? reason.message : "Không gửi được tin nhắn.");
      }
    } finally {
      requestController.current = null;
      setThinkingStatus("Đang truy xuất tài liệu liên quan…");
      setThinking(false);
    }
  }
  function stopGeneration() { requestController.current?.abort(); }
  async function renameConversation(row: Conversation) {
    const title = window.prompt("Tên cuộc trò chuyện", row.title);
    if (!title?.trim()) return;
    try { const updated = await api<Conversation>(`/assistant/conversations/${row.id}`, { method: "PATCH", body: JSON.stringify({ title: title.trim() }) }); setConversations(current => current.map(item => item.id === row.id ? { ...item, title: updated.title } : item)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không đổi được tên."); }
    setMenuId("");
  }
  async function deleteConversation(row: Conversation) {
    if (!window.confirm(`Xóa cuộc trò chuyện “${row.title}”?`)) return;
    try { await api(`/assistant/conversations/${row.id}`, { method: "DELETE" }); await loadConversations(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không xóa được cuộc trò chuyện."); }
    setMenuId("");
  }

  return <div className="assistant-layout">
    <aside className="conversation-sidebar"><div className="conversation-head"><div><div className="eyebrow">TRỢ LÝ ĐẠI HỌC</div><h1>{user ? "AI Assistant" : "Tư vấn Tuyển sinh"}</h1></div>{user && <button className="new-chat-button" onClick={newConversation} title="Cuộc trò chuyện mới"><Plus size={17} /></button>}</div>
      {user ? (
        <>
          <button className="button button-primary full-width new-chat-main" onClick={newConversation}><MessageSquarePlus size={16} /> Cuộc trò chuyện mới</button>
          <div className="conversation-list-label">GẦN ĐÂY <span>{conversations.length}</span></div>
          {loading ? <Loading label="Đang tải hội thoại…" /> : <div className="conversation-list">{conversations.map(row => <div className={`conversation-row ${activeId === row.id ? "active" : ""}`} key={row.id}><button onClick={() => chooseConversation(row)}><MessageSquarePlus size={15} /><span>{row.title}</span></button><div className="conversation-menu-wrap"><button className="conversation-more" onClick={() => setMenuId(menuId === row.id ? "" : row.id)} aria-label="Tùy chọn hội thoại"><MoreHorizontal size={17} /></button>{menuId === row.id && <div className="conversation-menu"><button onClick={() => renameConversation(row)}><Pencil size={14} /> Đổi tên</button><button className="danger" onClick={() => deleteConversation(row)}><Trash2 size={14} /> Xóa cuộc trò chuyện</button></div>}</div></div>)}</div>}
          <div className="conversation-sidebar-foot"><span className="privacy-shield">✓</span><span><strong>Trò chuyện riêng tư</strong><small>Chỉ bạn truy cập được lịch sử này.</small></span></div>
        </>
      ) : (
        <div style={{ padding: "16px 8px", fontSize: "13px", color: "#64748b", lineHeight: 1.6 }}>
          <div style={{ background: "#f0f9ff", padding: "14px", borderRadius: "12px", border: "1px solid #bae6fd", marginBottom: "16px", color: "#0369a1" }}>
            <strong>💡 Chế độ Khách / Tân sinh viên</strong>
            <p style={{ margin: "6px 0 0", fontSize: "12px" }}>Bạn có thể hỏi tự do về điểm chuẩn, chỉ tiêu, ngành học, cơ sở vật chất và cẩm nang nhập học NEU mà không cần đăng nhập.</p>
          </div>
          <div style={{ fontSize: "12px" }}>
            Sinh viên NEU cần tra cứu lịch học, lịch thi, deadline cá nhân? Vui lòng sử dụng nút <strong>Đăng nhập</strong> ở góc trên bên phải.
          </div>
        </div>
      )}
    </aside>
    <section className="chat-main"><div className="chat-topline"><div className="assistant-identity"><span className="assistant-avatar"><Bot size={19} /></span><span><strong>NEU Study AI Assistant</strong><small><i /> Trợ lý tri thức NEU Study</small></span></div><div className="chat-topline-actions"><a className="chat-support-link" href="/support"><FileText size={15} /> Cẩm nang & Biểu mẫu NEU</a></div></div>
      {error && <div className="chat-error"><ErrorNotice message={error} /><button onClick={() => setError("")} aria-label="Đóng"><X size={15} /></button></div>}
      <div className="chat-scroll" ref={scrollRef}>
      {messages.length === 0 ? <div className="chat-welcome"><div className="welcome-mark"><Bot size={27} /></div><div className="eyebrow">NEU STUDY AI ASSISTANT</div><h2>{user ? `Xin chào ${user.full_name.split(" ").slice(-1)[0]}!` : "Chào bạn! Mình là Trợ lý NEU Study AI"}<br />{user ? "Hôm nay mình có thể giúp gì cho việc học của bạn?" : "Bạn đang quan tâm đến thông tin tuyển sinh hay ngành học nào?"}</h2><p>{user ? "Hỏi về quy chế đào tạo, môn học, thời khóa biểu hoặc lịch thi." : "Tư vấn điểm chuẩn 2024-2025, phương thức xét tuyển, học phí và cẩm nang tân sinh viên NEU."}</p><div className="suggestion-grid">{(user ? suggestions : [
        "Điểm chuẩn ngành Logistics và Kiểm toán năm 2025 là bao nhiêu?",
        "Học phí NEU một năm khoảng bao nhiêu tiền?",
        "Thí sinh có chứng chỉ IELTS được xét tuyển vào NEU theo phương thức nào?",
        "Tân sinh viên cần chuẩn bị những hồ sơ nhập học gì?",
        "Đại học Kinh tế Quốc dân có mấy tòa nhà và cơ sở vật chất thế nào?"
      ]).map(prompt => <button key={prompt} onClick={() => sendMessage(prompt)}><span>✦</span>{prompt}</button>)}</div><div className="chat-data-note"><Sparkles size={14} /> Phản hồi dựa trên Đề án tuyển sinh & Quy chế chính thức của Đại học Kinh tế Quốc dân.</div></div> : <div className="message-list">{messages.map(message => <MessageBubble key={message.id} message={message} />)}{thinking && <div className="assistant-message"><span className="message-avatar"><Bot size={16} /></span><div className="thinking-bubble"><span /><span /><span />{thinkingStatus}</div></div>}</div>}
      </div>
      <div className="composer-area"><form className="composer" onSubmit={event => { event.preventDefault(); void sendMessage(); }}><textarea ref={inputRef} rows={1} value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Nhập câu hỏi của bạn…" aria-label="Tin nhắn" /><div className="composer-bottom"><span><Sparkles size={13} /> Trả lời có nguồn tham khảo từ NEU Study</span><button type={thinking ? "button" : "submit"} onClick={thinking ? stopGeneration : undefined} disabled={!thinking && !input.trim()} className="send-button" aria-label={thinking ? "Dừng tạo câu trả lời" : "Gửi câu hỏi"}>{thinking ? <Square size={14} /> : <Send size={16} />}</button></div></form><p>AI có thể trả lời chưa chính xác. Kiểm tra các nguồn tham khảo với thông tin quan trọng.</p></div>
    </section>
  </div>;
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const userMessage = message.role === "user";
  if (!userMessage && message.id.startsWith("pending-") && !message.content) return null;
  return <div className={`chat-message-row ${userMessage ? "user-row" : "assistant-row"}`}>{!userMessage && <span className="message-avatar"><Bot size={18} /></span>}<div className="chat-message-content"><div className={`message-bubble ${userMessage ? "user-bubble" : "assistant-bubble"}`}>{userMessage ? <p>{message.content}</p> : <div className="markdown-body"><ReactMarkdown>{message.content}</ReactMarkdown></div>}</div><div className="message-meta">{new Date(message.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}{!userMessage && <span><Check size={14} /> NEU Study AI</span>}</div></div>{userMessage && <span className="message-avatar user-message-avatar"><UserRound size={16} /></span>}</div>;
}
