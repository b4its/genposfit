"""
GenPosFit — Router Autentikasi Pengguna
Mendukung registrasi akun baru (username + password) dan login (mengembalikan JWT token).
"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.security import hash_password, verify_password, create_access_token, decode_access_token

router = APIRouter(prefix="/api/auth", tags=["Autentikasi"])

logger = logging.getLogger("genposfit.auth")


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=4, max_length=128)
    nama: str = Field(..., min_length=1, max_length=100)
    email: str | None = None
    pekerjaan: str | None = None


class LoginRequest(BaseModel):
    username: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    nama: str


class UserInfoResponse(BaseModel):
    user_id: int
    username: str
    nama: str
    email: str | None = None
    pekerjaan: str | None = None
    jam_kerja_hari: int | None = 8


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """Mendaftarkan akun pengguna baru dengan username dan password."""
    existing_user = db.query(User).filter_by(username=payload.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username sudah terdaftar. Silakan pilih username lain."
        )

    if payload.email:
        existing_email = db.query(User).filter_by(email=payload.email).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email sudah terdaftar."
            )

    user = User(
        username=payload.username,
        hashed_password=hash_password(payload.password),
        nama=payload.nama,
        email=payload.email,
        pekerjaan=payload.pekerjaan,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(data={"sub": user.username, "user_id": user.user_id})

    return AuthResponse(
        access_token=access_token,
        user_id=user.user_id,
        username=user.username,
        nama=user.nama,
    )


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Login menggunakan username dan password, mengembalikan JWT token."""
    user = db.query(User).filter_by(username=payload.username).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username atau password salah.",
        )

    access_token = create_access_token(data={"sub": user.username, "user_id": user.user_id})

    return AuthResponse(
        access_token=access_token,
        user_id=user.user_id,
        username=user.username,
        nama=user.nama,
    )


@router.get("/me", response_model=UserInfoResponse)
def get_current_user_info(request: Request, token: str = "", db: Session = Depends(get_db)):
    """Mengembalikan informasi akun berdasarkan JWT token dari header Authorization (Bearer) atau query string."""
    if not token:
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tidak disertakan."
        )
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tidak valid atau telah kedaluwarsa."
        )

    user_id = payload.get("user_id")
    user = db.query(User).filter_by(user_id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")

    return UserInfoResponse(
        user_id=user.user_id,
        username=user.username,
        nama=user.nama,
        email=user.email,
        pekerjaan=user.pekerjaan,
        jam_kerja_hari=user.jam_kerja_hari,
    )