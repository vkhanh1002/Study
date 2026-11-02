from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import academics, assistant, auth, dashboard, notifications, personnel, study, support
from app.api.admin_kb import admin_kb_router
from app.api.public_chat import guest_router
from app.core.config import settings

app = FastAPI(
    title="Study – University Management System",
    description="Versioned API for university admissions, student services, profiles, and AI assistance.",
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
