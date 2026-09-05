"""
GenPosFit — Deps autentikasi bersama (JWT bearer).
"""
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.security import decode_access_token


def bearer_token(request: Request) -> str:
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token tidak disertakan.")
    return auth[7:]


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = bearer_token(request)
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Token tidak valid.")
    user = db.query(User).filter_by(user_id=payload.get("user_id")).first()
    if not user:
        raise HTTPException(status_code=401, detail="Akun tidak ditemukan.")
    return user


def require_admin(request: Request, db: Session = Depends(get_db)) -> User:
    user = get_current_user(request, db)
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Akses ditolak. Hanya admin.")
    return user
