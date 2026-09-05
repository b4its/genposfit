"""
GenPosFit — Endpoint Registrasi Pose → simpan ke MySQL
Mencatat kalibrasi postur referensi personal user (Frontal, Lateral Kiri, Lateral Kanan).
"""
import hashlib
import secrets
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, PoseBaseline
from app.security import hash_password as _hash_pwd

router = APIRouter(prefix="/api/registration", tags=["Registrasi Pose"])


class BaselineItem(BaseModel):
    orientasi: str  # 'frontal', 'lateral_kiri', 'lateral_kanan'
    tipe_pose: str  # 'berdiri_tegak', 'berdiri_rileks', 'duduk_tegak', 'duduk_rileks'
    sudut_leher: float
    sudut_punggung: float
    level_bahu: float = 0.0
    std_leher: float = 1.5
    std_punggung: float = 1.5
    n_frame: int = 90


class PoseBaselineIn(BaseModel):
    user_id: Optional[int] = None
    nama: str
    email: Optional[str] = None
    pekerjaan: Optional[str] = None
    data: List[BaselineItem]


@router.post("/submit")
def submit_registrasi(payload: PoseBaselineIn, db: Session = Depends(get_db)):
    """
    Menyimpan profil pengguna dan kalibrasi pose baseline ke MySQL.
    Jika user sudah ada (berdasarkan user_id atau email), data diperbarui (upsert).
    """
    user = None
    if payload.user_id:
        user = db.query(User).filter_by(user_id=payload.user_id).first()

    if not user and payload.email:
        user = db.query(User).filter_by(email=payload.email).first()

    if not user:
        base_username = (payload.email or payload.nama or f"user_{secrets.token_hex(4)}").replace(" ", "_").lower()[:50]
        gen_username = base_username
        counter = 1
        while db.query(User).filter_by(username=gen_username).first():
            gen_username = f"{base_username}_{counter}"[:50]
            counter += 1
        gen_password = _hash_pwd(hashlib.sha256(secrets.token_bytes(32)).hexdigest())
        user = User(
            username=gen_username,
            hashed_password=gen_password,
            nama=payload.nama,
            email=payload.email,
            pekerjaan=payload.pekerjaan,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user.nama = payload.nama
        if payload.pekerjaan:
            user.pekerjaan = payload.pekerjaan
        if payload.email and user.email != payload.email:
            existing_email = db.query(User).filter(
                User.email == payload.email, User.user_id != user.user_id
            ).first()
            if existing_email:
                raise HTTPException(
                    status_code=409,
                    detail="Email sudah digunakan oleh pengguna lain.",
                )
            user.email = payload.email
        db.commit()

    saved_items = []
    for item in payload.data:
        # Check if baseline already exists for this (user_id, orientasi, tipe_pose)
        existing_b = db.query(PoseBaseline).filter_by(
            user_id=user.user_id,
            orientasi=item.orientasi,
            tipe_pose=item.tipe_pose,
        ).first()

        if existing_b:
            existing_b.sudut_leher = item.sudut_leher
            existing_b.sudut_punggung = item.sudut_punggung
            existing_b.level_bahu = item.level_bahu
            existing_b.std_leher = item.std_leher
            existing_b.std_punggung = item.std_punggung
            existing_b.n_frame = item.n_frame
        else:
            new_b = PoseBaseline(
                user_id=user.user_id,
                orientasi=item.orientasi,
                tipe_pose=item.tipe_pose,
                sudut_leher=item.sudut_leher,
                sudut_punggung=item.sudut_punggung,
                level_bahu=item.level_bahu,
                std_leher=item.std_leher,
                std_punggung=item.std_punggung,
                n_frame=item.n_frame,
            )
            db.add(new_b)

        saved_items.append({
            "orientasi": item.orientasi,
            "tipe_pose": item.tipe_pose,
            "sudut_leher": item.sudut_leher,
            "sudut_punggung": item.sudut_punggung,
        })

    db.commit()

    return {
        "user_id": user.user_id,
        "nama": user.nama,
        "total_baselines": len(saved_items),
        "baselines": saved_items,
        "message": "Profil postur personal GenPosFit tersimpan dengan sukses"
    }


@router.get("/baselines/{user_id}")
def get_user_baselines(user_id: int, db: Session = Depends(get_db)):
    """Mengambil semua baseline postur yang telah direkam untuk user ini."""
    user = db.query(User).filter_by(user_id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")

    baselines = db.query(PoseBaseline).filter_by(user_id=user_id).all()
    return {
        "user_id": user.user_id,
        "nama": user.nama,
        "baselines": [
            {
                "id": b.id,
                "orientasi": b.orientasi,
                "tipe_pose": b.tipe_pose,
                "sudut_leher": float(b.sudut_leher),
                "sudut_punggung": float(b.sudut_punggung),
                "level_bahu": float(b.level_bahu),
                "std_leher": float(b.std_leher),
                "std_punggung": float(b.std_punggung),
                "n_frame": b.n_frame,
                "recorded_at": b.recorded_at.isoformat() if b.recorded_at else None,
            }
            for b in baselines
        ]
    }
