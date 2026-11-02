import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import academics, assistant, auth, dashboard, notifications, personnel, study, support
from app.api.admin_kb import admin_kb_router
from app.api.public_chat import guest_router
from app.core.config import settings

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Study – University Management System",
    description="Versioned API for university admissions, student services, profiles, and AI assistance.",
    version="1.0.0",
)

# Middleware bắt lỗi chưa xử lý để luôn trả về 500 JSON kèm header CORS (được bọc bởi CORSMiddleware bên dưới)
@app.middleware("http")
async def catch_unhandled_errors(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception:
        logger.exception("Unhandled error: %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})

# Danh sách các URL Frontend được phép kết nối qua CORS
FRONTEND_ORIGINS = [
    "http://localhost:3000",                        # Next.js Frontend (Local)
    "http://127.0.0.1:3000",                        # Next.js Frontend (IP)
    "http://localhost:5173",                        # Vite / React (Dev)
    "https://study.vercel.app",                     # Vercel Production
    "https://frontend-one-tawny-98.vercel.app",     # Vercel Frontend bạn của bạn
    "https://study-eta-gray.vercel.app",             # Vercel Frontend của bạn
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS + [o for o in settings.allowed_origins if o not in FRONTEND_ORIGINS],
    allow_origin_regex=r"^(http://(localhost|127\.0\.0\.1)(:\d+)?|https://[a-zA-Z0-9-]+\.vercel\.app)$",
    allow_credentials=True,         # Cho phép gửi cookie / Authorization token
    allow_methods=["*"],            # GET, POST, PUT, DELETE, OPTIONS...
    allow_headers=["*"],            # Authorization, Content-Type, Accept...
)
app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(dashboard.router, prefix=settings.api_prefix)
app.include_router(academics.router, prefix=settings.api_prefix)
app.include_router(support.router, prefix=settings.api_prefix)
app.include_router(assistant.router, prefix=settings.api_prefix)
app.include_router(guest_router, prefix=settings.api_prefix)
app.include_router(admin_kb_router, prefix=settings.api_prefix)
app.include_router(study.router, prefix=settings.api_prefix)
app.include_router(notifications.router, prefix=settings.api_prefix)
app.include_router(personnel.router, prefix=settings.api_prefix)


@app.get("/health")
def health():
    return {"status": "ok", "service": "study-api"}
