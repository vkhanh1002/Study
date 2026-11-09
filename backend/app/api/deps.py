import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.models import User

bearer = HTTPBearer(auto_error=False)

ROLE_ALIASES: dict[str, set[str]] = {
    "ADMIN": {"ADMIN", "super_admin", "admin", "admission_staff", "support_staff"},
    "GIANG_VIEN": {"GIANG_VIEN", "giang_vien", "lecturer"},
    "SINH_VIEN": {"SINH_VIEN", "sinh_vien", "student"},
    "super_admin": {"ADMIN", "super_admin", "admin", "admission_staff", "support_staff"},
    "admission_staff": {"ADMIN", "super_admin", "admin", "admission_staff", "support_staff"},
    "support_staff": {"ADMIN", "super_admin", "admin", "admission_staff", "support_staff"},
    "student": {"SINH_VIEN", "sinh_vien", "student"},
    "lecturer": {"GIANG_VIEN", "giang_vien", "lecturer"},
}


def normalize_role(role: str | None) -> str:
    if not role:
        return "GUEST"
    r = role.strip()
    if r in {"super_admin", "admin", "admission_staff", "support_staff", "ADMIN"}:
        return "ADMIN"
    if r in {"giang_vien", "lecturer", "GIANG_VIEN"}:
        return "GIANG_VIEN"
    if r in {"student", "sinh_vien", "SINH_VIEN"}:
        return "SINH_VIEN"
    return r


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Vui lòng đăng nhập.")
    try:
        user_id = decode_token(credentials.credentials)
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Phiên đăng nhập không hợp lệ hoặc đã hết hạn.") from None
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Tài khoản không hoạt động.")
    return user


def require_roles(*roles: str):
    allowed_roles: set[str] = set()
    for r in roles:
        allowed_roles.update(ROLE_ALIASES.get(r, {r}))

    def dependency(user: User = Depends(current_user)) -> User:
        if user.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Bạn không có quyền thực hiện thao tác này.")
        return user

    return dependency
