# Study — University Management System

Study là bản MVP có thể chạy của nền tảng quản lý đại học: Next.js/TypeScript ở frontend, FastAPI ở backend, PostgreSQL + pgvector ở tầng dữ liệu và Study AI Assistant với RAG. Dữ liệu mẫu được gắn nhãn demo; học phí, chỉ tiêu và hoạt động biểu đồ không phải thông tin chính thức của một trường.

## Chạy toàn bộ hệ thống

Yêu cầu: Docker Desktop và Docker Compose v2.

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
docker compose up --build -d
docker compose ps
```

Khi database và backend báo `healthy`, frontend báo `running`, mở giao diện tại [http://localhost:3000](http://localhost:3000), API tại [http://localhost:8000](http://localhost:8000), và tài liệu OpenAPI tại [http://localhost:8000/docs](http://localhost:8000/docs). Compose chạy ở chế độ nền; dùng `docker compose logs -f backend` để xem log và `docker compose down` để dừng. Nếu chạy `docker compose up --build` không có `-d`, terminal sẽ tiếp tục mở để hiển thị log — đó là hành vi bình thường, nhưng cần đợi backend báo healthy trước khi mở giao diện. Lần đầu seed tạo 41 hồ sơ sinh viên, 12 giảng viên, 8 nhân viên và một số yêu cầu hỗ trợ; các lần chạy sau chỉ thêm hồ sơ mẫu còn thiếu, không ghi đè hồ sơ đã có.

Nếu trước đó backend liên tục báo `relation "users" does not exist` hoặc unhealthy, hãy để Docker Desktop chạy rồi build lại image với code mới bằng `docker compose up --build -d`. Kiểm tra `docker compose ps` và `docker compose logs --tail=100 backend`; không dùng `docker compose down -v` vì tùy chọn `-v` sẽ xóa volume cơ sở dữ liệu.

## Tài khoản đăng nhập demo (3 vai trò chuẩn)

Hệ thống tuân thủ nghiêm ngặt 3 vai trò tài khoản:

| Vai trò | Email | Mật khẩu | Phạm vi quyền hạn |
| --- | --- | --- | --- |
| **ADMIN** | dmin@study.edu.vn | StudyDemo2026! | Quản lý toàn bộ 3 module: Tuyển sinh, Nhân sự, Hỗ trợ người học, Quản lý tài khoản, Danh mục khoa/ngành |
| **GIANG_VIEN** | giangvien@study.edu.vn | StudyDemo2026! | Cổng giảng viên (/personnel/me), cập nhật hồ sơ chờ duyệt, tải văn bằng/chứng chỉ, cảnh báo hợp đồng sắp hết hạn (<60 ngày), xử lý đơn được giao |
| **SINH_VIEN** | sinhvien@study.edu.vn | StudyDemo2026! | Cổng sinh viên (/support), checklist 11 bước nhập học, nộp 4 loại đơn trực tuyến, tra cứu lịch học/lịch thi, đánh giá 1-5 sao |
| **Thí sinh (Khách)** | *Không cần đăng nhập* | — | Tra cứu ngành, tính điểm xét tuyển (TS3), nộp hồ sơ online CCCD + 3 nguyện vọng (TS4), tra cứu kết quả (TS5), nộp bổ sung hồ sơ (TS6), danh bạ giảng viên (TS7) |

*(Ghi chú: Các tài khoản cũ student@study.edu.vn, dmissions@study.edu.vn, support@study.edu.vn vẫn đăng nhập được với vai trò tương ứng nhờ cơ chế role normalization).*

Thay mật khẩu và `STUDY_SECRET_KEY` trước khi dùng ở môi trường thật. AI mặc định chọn Groq (`AI_PROVIDER=groq`, model `openai/gpt-oss-120b`) và dùng Gemini (`gemini-3.8-flash`) làm dự phòng. Để bật Groq:

1. Tạo API key trong [GroqCloud](https://console.groq.com/keys).
2. Mở `.env` ở thư mục gốc và đặt `GROQ_API_KEY=...`, `GROQ_MODEL=openai/gpt-oss-120b`. Đặt `GEMINI_API_KEY=...` từ [Google AI Studio](https://aistudio.google.com/apikey) để bật dự phòng. Không dán khóa vào mã nguồn, trình duyệt hoặc chat.
3. Chạy `docker compose up --build -d`, rồi mở **Quản trị → Kho tri thức → Kiểm tra kết nối**.

Backend xác minh model Groq trong endpoint `/models`; nếu GPT-OSS 120B không khả dụng, thử GPT-OSS 20B rồi dùng Gemini fallback nếu được cấu hình. Không tự nâng gói. Hạn mức và giá phụ thuộc tài khoản; xem Groq Console trước khi dùng thường xuyên. Điều khoản Gemini free tier cho phép Google sử dụng dữ liệu gửi lên để cải thiện sản phẩm, vì vậy tuyệt đối không gửi hồ sơ thật/tài liệu mật. API key chỉ nằm ở backend. Nếu không có provider khả dụng, chatbot báo lỗi cho lượt đó và giữ nguồn RAG, không tạo câu trả lời giả lập.

## Tính năng hiện có

- Dashboard tổng hợp số sinh viên, hồ sơ, ngành, yêu cầu hỗ trợ; chuỗi biểu đồ tuyển sinh được ghi nhãn dữ liệu minh họa.
- 10 ngành mẫu, tìm kiếm ngành, gửi hồ sơ đăng ký, cập nhật trạng thái theo vai trò và chuyển hồ sơ đã trúng tuyển thành sinh viên có liên kết ngược với thí sinh.
- Hồ sơ người học: sinh viên chỉ đọc/cập nhật liên hệ của chính mình; Super Admin có thể xem danh sách và cập nhật thông tin liên hệ. API không dựa vào việc ẩn nút trên giao diện để bảo vệ dữ liệu.
- Hồ sơ giảng viên và nhân viên dùng chung bảng nhân sự, hỗ trợ tìm kiếm/lọc, xem/thêm/chỉnh sửa, trạng thái công tác và dashboard phân bố theo khoa/phòng ban.
- Cổng hỗ trợ người học: sinh viên gửi yêu cầu kèm tệp, theo dõi lịch sử/phản hồi; nhân viên tìm kiếm, lọc, phân công và cập nhật trạng thái; dashboard, FAQ, thông báo và đánh giá sau xử lý.
- AI Assistant: lịch sử hội thoại riêng theo tài khoản, tạo/đổi tên/xóa hội thoại, truy xuất FAQ/ngành/tài liệu, nguồn tham khảo; có thể lấy hồ sơ và yêu cầu hỗ trợ gắn với chính người đăng nhập.
- Quản trị tri thức: tải PDF, DOCX, TXT, Markdown (tối đa 10 MB), trích xuất/chia đoạn, tùy chọn OpenAI embeddings, quản lý FAQ và kiểm tra kết nối provider AI.
- Mật khẩu Argon2, access token + refresh token JWT, kiểm tra vai trò ở backend, CORS được giới hạn theo cấu hình.

## Cấu trúc

```text
frontend/                 Next.js App Router, React, TypeScript, Tailwind, RHF, Zod
backend/app/api/          REST API phiên bản /api/v1
backend/app/models/       SQLAlchemy entities
backend/app/ai/           RAG, embedding, LLM orchestration, file extraction
backend/migrations/       Alembic migrations (initial schema + personnel/attachments)
backend/tests/            pytest API và helper tests
docker-compose.yml        frontend + API + PostgreSQL/pgvector
```

## Chạy kiểm thử

Backend tests dùng SQLite in-memory để chạy độc lập với PostgreSQL:

```powershell
cd backend
python -m pip install -r requirements.txt
python -m pytest
```

Frontend:

```powershell
cd frontend
npm install
npm test
npm run typecheck
npm run build
```

## API chính

- `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `GET /api/v1/auth/me`
- `GET /api/v1/dashboard`, `GET /api/v1/majors`
- `/api/v1/personnel` và `/api/v1/personnel/dashboard` (Super Admin)
- `POST /api/v1/admissions/applications`, danh sách/trạng thái/chuyển đổi hồ sơ qua `/api/v1/admissions/applications/...`
- `/api/v1/profiles/...`, `/api/v1/support/...` (tickets, assignments, attachments, dashboard), `/api/v1/assistant/...`
- `/api/v1/admin/knowledge-documents`, `/api/v1/admin/faqs`, `/api/v1/admin/ai-status` (Super Admin)
- Chat có endpoint SSE `/api/v1/assistant/conversations/{id}/messages/stream`; các câu trả lời hoàn tất vẫn được lưu cùng nguồn. Lỗi sau khi đã phát token không được ghép model fallback và không lưu phần trả lời dở.
- Retry/timeout được quản lý một nơi trong `AIProviderManager`: tối đa một retry Groq khi lỗi tạm thời, Gemini fallback tối đa 8 giây, ngân sách provider tối đa 18 giây kể cả thời gian fallback. Giao diện quản trị Kho tri thức có thống kê latency gần đây; số liệu được giữ trong RAM backend (tối đa 200 lượt, mất khi container khởi động lại).

## Ghi chú triển khai

- Cấu hình môi trường nằm ở `.env`; `.env.example` chỉ có giá trị phát triển. Không đưa khóa LLM, mật khẩu DB hoặc signing key thật vào source control.
- Thay các tài khoản demo, signing key, mật khẩu PostgreSQL, CORS và chính sách lưu token trước khi triển khai công khai; cân nhắc cookie `HttpOnly` cho phiên đăng nhập, rate limiting, audit log và quy trình backup/retention dữ liệu cá nhân.
- Study AI chỉ gọi Groq (chính) và Gemini (dự phòng). RAG hiện tra cứu FAQ, tài liệu và danh mục bằng tìm kiếm từ khóa; không gửi câu hỏi sang dịch vụ embedding. Các vector đã có trong PostgreSQL không bị xóa.
- `.env.example` chỉ dùng để tạo `.env` lần đầu. Nếu `.env` đã có, không chép đè; thêm/cập nhật biến `GEMINI_API_KEY` trong file hiện tại rồi chạy lại Compose.
- Đây là nền tảng MVP: chưa có tích hợp SSO, storage object cho hồ sơ đính kèm, phân quyền từng permission/cơ sở, quy trình admission period/method quản trị riêng, hoặc triển khai nền xử lý tài liệu hàng đợi. Các trường admission hiện được đánh dấu demo.
