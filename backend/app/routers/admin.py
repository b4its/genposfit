"""
GenPosFit — Router Admin
Kelola program latihan oleh admin. Endpoint di-proteksi dengan JWT + role='admin'.
"""
import logging
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Exercise, User
from app.security import decode_access_token

router = APIRouter(prefix="/api/admin", tags=["Admin"])

logger = logging.getLogger("genposfit.admin")


def require_admin(request: Request, db: Session = Depends(get_db)) -> User:
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token tidak disertakan.")
    payload = decode_access_token(auth[7:])
    if payload is None:
        raise HTTPException(status_code=401, detail="Token tidak valid.")
    user = db.query(User).filter_by(user_id=payload.get("user_id")).first()
    if not user or user.role != "admin":
        raise HTTPException(status_code=403, detail="Akses ditolak. Hanya admin.")
    return user


class ExerciseCreate(BaseModel):
    nama: str = Field(..., min_length=1, max_length=100)
    deskripsi: Optional[str] = None
    target_otot: Optional[str] = None
    sudut_target: Optional[Any] = None
    durasi_detik: Optional[int] = None
    reps: int = 10
    tingkat: str = "pemula"


class ExerciseUpdate(BaseModel):
    nama: Optional[str] = None
    deskripsi: Optional[str] = None
    target_otot: Optional[str] = None
    sudut_target: Optional[Any] = None
    durasi_detik: Optional[int] = None
    reps: Optional[int] = None
    tingkat: Optional[str] = None


class ExerciseOut(BaseModel):
    exercise_id: int
    nama: str
    deskripsi: Optional[str] = None
    target_otot: Optional[str] = None
    sudut_target: Optional[Any] = None
    durasi_detik: Optional[int] = None
    reps: Optional[int] = 10
    tingkat: Optional[str] = "pemula"

    class Config:
        from_attributes = True


@router.get("/exercises", response_model=List[ExerciseOut])
def admin_get_exercises(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.query(Exercise).all()


@router.post("/exercises", response_model=ExerciseOut, status_code=201)
def admin_create_exercise(payload: ExerciseCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    ex = Exercise(**payload.model_dump())
    db.add(ex)
    db.commit()
    db.refresh(ex)
    return ex


@router.put("/exercises/{exercise_id}", response_model=ExerciseOut)
def admin_update_exercise(exercise_id: int, payload: ExerciseUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    ex = db.query(Exercise).filter_by(exercise_id=exercise_id).first()
    if not ex:
        raise HTTPException(404, "Latihan tidak ditemukan.")
    for key, val in payload.model_dump(exclude_unset=True).items():
        setattr(ex, key, val)
    db.commit()
    db.refresh(ex)
    return ex


@router.delete("/exercises/{exercise_id}", status_code=204)
def admin_delete_exercise(exercise_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    ex = db.query(Exercise).filter_by(exercise_id=exercise_id).first()
    if not ex:
        raise HTTPException(404, "Latihan tidak ditemukan.")
    db.delete(ex)
    db.commit()


@router.post("/users/{user_id}/set-admin")
def set_user_admin(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    target = db.query(User).filter_by(user_id=user_id).first()
    if not target:
        raise HTTPException(404, "User tidak ditemukan.")
    target.role = "admin"
    db.commit()
    return {"message": f"User {target.username} sekarang admin."}