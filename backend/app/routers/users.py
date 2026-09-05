"""
GenPosFit — Router Pengguna (Users API)
Manajemen profil pengguna, pengaturan jam kerja, dan pencarian profil.
"""
import hashlib
import secrets
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.security import hash_password as _hash_pwd

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

    class Config:
        from_attributes = True


@router.get("", response_model=List[UserResponse])
def get_all_users(db: Session = Depends(get_db)):
    """Mengambil semua data pengguna terdaftar."""
    return db.query(User).order_by(User.user_id.desc()).all()


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    """Membuat pengguna baru jika email belum ada."""
    if payload.email:
        existing = db.query(User).filter_by(email=payload.email).first()
        if existing:
            return existing

    gen_username = (payload.email or payload.nama or f"user_{secrets.token_hex(4)}").replace(" ", "_").lower()[:50]
    gen_password = _hash_pwd(hashlib.sha256(secrets.token_bytes(32)).hexdigest())
    user = User(
        username=gen_username,
        hashed_password=gen_password,
        nama=payload.nama,
        email=payload.email,
        pekerjaan=payload.pekerjaan,
        jam_kerja_hari=payload.jam_kerja_hari or 8
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserResponse)
def get_user_by_id(user_id: int, db: Session = Depends(get_db)):
    """Mengambil profil user berdasarkan user_id."""
    user = db.query(User).filter_by(user_id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    return user
