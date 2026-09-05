"""
GenPosFit — Endpoint Latihan Terapi Postur (Mode B)
Mendukung daftar latihan peregangan, instruksi sudut target, dan pencatatan sesi latihan.
"""
from typing import List, Optional, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Exercise, ExerciseSession, User

router = APIRouter(prefix="/api/exercises", tags=["Latihan Postur"])


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


class SessionCreate(BaseModel):
    user_id: int
    exercise_id: int
    total_reps: int = 10
    avg_skor: float = 90.0


@router.get("", response_model=List[ExerciseOut])
def get_exercises(tingkat: Optional[str] = None, db: Session = Depends(get_db)):
    """Mengambil daftar menu latihan terapi postur."""
    query = db.query(Exercise)
    if tingkat:
        query = query.filter_by(tingkat=tingkat)
    return query.all()


@router.get("/{exercise_id}", response_model=ExerciseOut)
def get_exercise_by_id(exercise_id: int, db: Session = Depends(get_db)):
    """Mengambil detail latihan berdasarkan ID."""
    exercise = db.query(Exercise).filter_by(exercise_id=exercise_id).first()
    if not exercise:
        raise HTTPException(status_code=404, detail="Latihan tidak ditemukan")
    return exercise


@router.post("/sessions", status_code=status.HTTP_201_CREATED)
def record_exercise_session(payload: SessionCreate, db: Session = Depends(get_db)):
    """Mencatat penyelesaian sesi latihan user ke database."""
    user = db.query(User).filter_by(user_id=payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")

    exercise = db.query(Exercise).filter_by(exercise_id=payload.exercise_id).first()
    if not exercise:
        raise HTTPException(status_code=404, detail="Latihan tidak ditemukan")

    session_record = ExerciseSession(
        user_id=payload.user_id,
        exercise_id=payload.exercise_id,
        total_reps=payload.total_reps,
        avg_skor=payload.avg_skor,
        selesai_at=datetime.utcnow()
    )
    db.add(session_record)
    db.commit()
    db.refresh(session_record)

    return {
        "session_id": session_record.session_id,
        "message": f"Sesi latihan '{exercise.nama}' berhasil dicatat",
        "avg_skor": float(session_record.avg_skor),
    }


@router.get("/sessions/user/{user_id}")
def get_user_exercise_history(user_id: int, db: Session = Depends(get_db)):
    """Mengambil riwayat latihan yang pernah diselesaikan pengguna."""
    sessions = (
        db.query(ExerciseSession)
        .filter_by(user_id=user_id)
        .order_by(ExerciseSession.selesai_at.desc())
        .all()
    )

    return [
        {
            "session_id": s.session_id,
            "exercise_id": s.exercise_id,
            "nama_latihan": s.exercise.nama if s.exercise else "Latihan",
            "total_reps": s.total_reps,
            "avg_skor": float(s.avg_skor) if s.avg_skor else 0.0,
            "selesai_at": s.selesai_at.isoformat() if s.selesai_at else None,
        }
        for s in sessions
    ]
