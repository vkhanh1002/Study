const defaultApiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export function getApiBase(): string {
  if (typeof window !== "undefined") {
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    if (envUrl) {
      return envUrl.endsWith("/") ? envUrl.slice(0, -1) : envUrl;
    }
    const host = window.location.hostname;
    // Chỉ tự động thêm port :8000 khi chạy dưới môi trường cục bộ (localhost / 127.0.0.1 / IP LAN)
    if (host === "localhost" || host === "127.0.0.1" || host.startsWith("192.168.") || host.startsWith("10.") || host.endsWith(".local")) {
      return `${window.location.protocol}//${host}:8000/api/v1`;
    }
  }
  return defaultApiUrl;
}

export const API_BASE = defaultApiUrl;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export async function authenticatedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const browser = typeof window !== "undefined";
  const token = browser ? window.sessionStorage.getItem("study_access_token") : null;
  const formData = typeof FormData !== "undefined" && options.body instanceof FormData;
  async function send(accessToken: string | null) {
    const headers = new Headers(options.headers);
    if (!formData) headers.set("Content-Type", "application/json");
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    return fetch(`${getApiBase()}${path}`, { ...options, headers, cache: "no-store" });
  }
  let response: Response;
  try { response = await send(token); }
  catch { throw new ApiError("Không thể kết nối API. Hãy kiểm tra backend và Docker Compose.", 0); }
  if (response.status === 401 && browser && path !== "/auth/login" && path !== "/auth/refresh") {
    const refreshToken = window.sessionStorage.getItem("study_refresh_token");
    if (refreshToken) {
      try {
        const refreshed = await fetch(`${getApiBase()}/auth/refresh`, { method: "POST", headers: { Authorization: `Bearer ${refreshToken}` }, cache: "no-store" });
        if (refreshed.ok) {
          const pair = await refreshed.json();
          window.sessionStorage.setItem("study_access_token", pair.access_token);
          window.sessionStorage.setItem("study_refresh_token", pair.refresh_token);
          if (pair.user) window.sessionStorage.setItem("study_user", JSON.stringify(pair.user));
          response = await send(pair.access_token);
        } else {
          window.sessionStorage.removeItem("study_access_token"); window.sessionStorage.removeItem("study_refresh_token"); window.sessionStorage.removeItem("study_user");
        }
      } catch { /* The original API response below carries the authentication failure. */ }
    }
  }
  return response;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await authenticatedFetch(path, options);
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(body.detail ?? "Có lỗi xảy ra. Vui lòng thử lại.", response.status);
  return body as T;
}

export type User = { id: string; email: string; full_name: string; role: string };
export type Major = {
  id: string; code: string; name: string; description: string; faculty_name: string;
  duration_years: number; tuition_per_year_vnd: number; admission_quota: number;
  admission_status: string; is_demo: boolean;
};
export type Ticket = {
  id: string; code: string; owner_id: string; owner_name: string; category: string;
  subject: string; description: string; priority: string; status: string; assignee_id?: string;
  satisfaction_rating: number | null; satisfaction_feedback: string | null;
  created_at: string; messages: { id: string; author_id: string; body: string; created_at: string }[];
  attachments: { id: string; filename: string; media_type: string; size_bytes: number; uploaded_at: string }[];
};
