"""
GenPosFit — Router Admin
Kelola program latihan oleh admin. Endpoint di-proteksi dengan JWT + role='admin'.
Mendukung perekaman skeleton pose dari kamera admin (33 landmark) sebagai referensi
untuk exercise player dan gerakan battle multiplayer.
"""
import logging
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Exercise, User
from app.security import decode_access_token
from app.services.pose_analysis import analisis_postur_dari_landmarks

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
    skeleton_data: Optional[list] = None  # 33 landmark dari kamera admin
    durasi_detik: Optional[int] = None
    reps: int = 10
    tingkat: str = "pemula"
    is_battle: bool = False


class ExerciseUpdate(BaseModel):
    nama: Optional[str] = None
    deskripsi: Optional[str] = None
    target_otot: Optional[str] = None
    sudut_target: Optional[Any] = None
    skeleton_data: Optional[list] = None
    durasi_detik: Optional[int] = None
    reps: Optional[int] = None
    tingkat: Optional[str] = None
    is_battle: Optional[bool] = None


class ExerciseOut(BaseModel):
    exercise_id: int
    nama: str
    deskripsi: Optional[str] = None
    target_otot: Optional[str] = None
    sudut_target: Optional[Any] = None
    skeleton_data: Optional[list] = None
    sudut_leher: Optional[float] = None
    sudut_punggung: Optional[float] = None
    durasi_detik: Optional[int] = None
    reps: Optional[int] = 10
    tingkat: Optional[str] = "pemula"
    is_battle: bool = False

    class Config:
        from_attributes = True


@router.get("/exercises", response_model=List[ExerciseOut])
def admin_get_exercises(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.query(Exercise).all()


@router.post("/exercises", response_model=ExerciseOut, status_code=201)
def admin_create_exercise(payload: ExerciseCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Buat latihan baru. Jika menyertakan skeleton_data, hitung sudut otomatis."""
    data = payload.model_dump()
    skeleton = data.get("skeleton_data")
    if skeleton and len(skeleton) >= 25:
        analisis = analisis_postur_dari_landmarks(skeleton)
        if analisis.get("valid"):
            data["sudut_leher"] = analisis["sudut_leher"]
            data["sudut_punggung"] = analisis["sudut_punggung"]
    ex = Exercise(**data)
    db.add(ex)
    db.commit()
    db.refresh(ex)
    return ex


@router.post("/exercises/record-pose", response_model=ExerciseOut, status_code=201)
def admin_record_pose(payload: ExerciseCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Rekam pose dari kamera (33 landmark) sebagai latihan baru. skeleton_data diisi otomatis."""
    data = payload.model_dump()
    skeleton = data.get("skeleton_data", [])
    if not skeleton or len(skeleton) < 25:
        raise HTTPException(400, "skeleton_data wajib minimal 25 titik landmark.")
    analisis = analisis_postur_dari_landmarks(skeleton)
    if not analisis.get("valid"):
        raise HTTPException(400, "Landmark tidak valid untuk analisis postur.")
    data["sudut_leher"] = analisis["sudut_leher"]
    data["sudut_punggung"] = analisis["sudut_punggung"]
    ex = Exercise(**data)
    db.add(ex)
    db.commit()
    db.refresh(ex)
    return ex


@router.put("/exercises/{exercise_id}", response_model=ExerciseOut)
def admin_update_exercise(exercise_id: int, payload: ExerciseUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    ex = db.query(Exercise).filter_by(exercise_id=exercise_id).first()
    if not ex:
        raise HTTPException(404, "Latihan tidak ditemukan.")
    data = payload.model_dump(exclude_unset=True)
    skeleton = data.get("skeleton_data")
    if skeleton and len(skeleton) >= 25:
        analisis = analisis_postur_dari_landmarks(skeleton)
        if analisis.get("valid"):
            data["sudut_leher"] = analisis["sudut_leher"]
            data["sudut_punggung"] = analisis["sudut_punggung"]
    for key, val in data.items():
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