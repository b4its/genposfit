"""
GenPosFit — Router Pengguna (Users API)
Manajemen profil pengguna, pengaturan jam kerja, dan pencarian profil.
"""
import hashlib
import secrets
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.security import hash_password as _hash_pwd
from app.security import create_access_token

router = APIRouter(prefix="/api/users", tags=["Users"])


class UserCreate(BaseModel):
    nama: str
    email: Optional[str] = None
    pekerjaan: Optional[str] = None
    jam_kerja_hari: Optional[int] = 8


class UserResponse(BaseModel):
    user_id: int
    nama: str
    email: Optional[str] = None
    pekerjaan: Optional[str] = None
    jam_kerja_hari: Optional[int] = 8
    poin: int = 0
    saldo: float = 0.0
    role: str = "user"

    class Config:
        from_attributes = True


@router.get("", response_model=List[UserResponse])
def get_all_users(db: Session = Depends(get_db)):
    """Mengambil semua data pengguna terdaftar."""
    return db.query(User).order_by(User.user_id.desc()).all()


@router.post("", status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    """Membuat pengguna baru jika email belum ada."""
    if payload.email:
        existing = db.query(User).filter_by(email=payload.email).first()
        if existing:
            return existing

    base_username = (payload.email or payload.nama or f"user_{secrets.token_hex(4)}").replace(" ", "_").lower()[:50]
    gen_username = base_username
    counter = 1
    while db.query(User).filter_by(username=gen_username).first():
        gen_username = f"{base_username}_{counter}"[:50]
        counter += 1

    # Buat password acak yang dikembalikan sekali sehingga akun tetap dapat dipakai untuk login.
    plain_password = secrets.token_urlsafe(12)
    user = User(
        username=gen_username,
        hashed_password=_hash_pwd(plain_password),
        nama=payload.nama,
        email=payload.email,
        pekerjaan=payload.pekerjaan,
        jam_kerja_hari=payload.jam_kerja_hari or 8
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "user_id": user.user_id,
        "username": gen_username,
        "nama": user.nama,
        "password": plain_password,
        "email": user.email,
        "pekerjaan": user.pekerjaan,
        "jam_kerja_hari": user.jam_kerja_hari,
        "access_token": create_access_token(data={"sub": user.username, "user_id": user.user_id}),
        "message": "Akun dibuat. Gunakan username dan password di atas untuk login melalui /api/auth/login."
    }


@router.get("/{user_id}", response_model=UserResponse)
def get_user_by_id(user_id: int, db: Session = Depends(get_db)):
    """Mengambil profil user berdasarkan user_id."""
    user = db.query(User).filter_by(user_id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    return user
