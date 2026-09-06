"""
GenPosFit — Endpoint Latihan Terapi Postur (Mode B)
Mendukung daftar latihan peregangan, instruksi sudut target / skeleton data dari admin,
pencatatan sesi latihan, dan scoring perbandingan pose gerakan battle.
"""
from typing import List, Optional, Any, Dict
from datetime import datetime, timezone

def utcnow() -> datetime:
    """Naive UTC now, cocok untuk kolom MySQL DATETIME."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Exercise, ExerciseSession, ExerciseType, User
from app.services.pose_analysis import analisis_postur_dari_landmarks
from app.services.deviation_score import skor_deviasi_tunggal

router = APIRouter(prefix="/api/exercises", tags=["Latihan Postur"])


class ExerciseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    exercise_id: int
    type_id: Optional[int] = None
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


class ExerciseTypeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    type_id: int
    nama: str
    deskripsi: Optional[str] = None
    children: List["ExerciseOut"] = []


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


@router.get("/types", response_model=List[ExerciseTypeOut])
def get_exercise_types(db: Session = Depends(get_db)):
    """Mengambil semua jenis latihan (parent) beserta gerakan anaknya (children)."""
    types = db.query(ExerciseType).order_by(ExerciseType.nama).all()
    if not types:
        from app.services.default_exercises import seed_default_exercises
        seed_default_exercises(db)
        types = db.query(ExerciseType).order_by(ExerciseType.nama).all()
    return types


ExerciseTypeOut.model_rebuild()


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
        selesai_at=utcnow()
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


class ScorePoseRequest(BaseModel):
    landmarks: List[Dict[str, Any]]
    exercise_id: Optional[int] = None


@router.post("/score")
def score_pose(payload: ScorePoseRequest, db: Session = Depends(get_db)):
    """
    Membandingkan pose player (landmarks) terhadap skeleton referensi latihan.
    Mengembalikan skor kesesuaian (0-100) yang dipakai untuk exercise & battle.
    """
    lms = payload.landmarks
    if not lms or len(lms) < 29:
        return {"score": 0.0, "status": "buruk", "message": "Landmark tidak mencukupi."}

    exercise = None
    if payload.exercise_id:
        exercise = db.query(Exercise).filter_by(exercise_id=payload.exercise_id).first()
    else:
        exercise = db.query(Exercise).filter(Exercise.skeleton_data.isnot(None)).first()
        if not exercise:
            return {"score": 0.0, "status": "buruk", "message": "Tidak ada latihan referensi."}

    if not exercise or not exercise.skeleton_data:
        return {"score": 0.0, "status": "buruk", "message": "Latihan tidak punya skeleton referensi."}

    ref = exercise.skeleton_data
    if len(ref) < 29:
        return {"score": 0.0, "status": "buruk", "message": "Skeleton referensi tidak valid."}

    # Skor berbasis jarak antar titik kunci (normalized).
    KEY = [0, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
    total = 0.0
    count = 0
    for i in KEY:
        if i >= len(lms) or i >= len(ref):
            continue
        a, b = lms[i], ref[i]
        if a is None or b is None:
            continue
        ax, ay = a.get("x", 0.5), a.get("y", 0.5)
        bx, by = b.get("x", 0.5), b.get("y", 0.5)
        dist = ((ax - bx) ** 2 + (ay - by) ** 2) ** 0.5
        # Jarak normalize terhadap bounding; 0.05 → 100, semakin jauh turun garis lurus.
        per_point = max(0.0, 100.0 - (dist / 0.15) * 100.0)
        total += per_point
        count += 1

    score = round(total / count, 2) if count else 0.0
    if score >= 85:
        status_label = "bagus"
        message = "Pose hampir sempurna menirukan referensi!"
    elif score >= 60:
        status_label = "ringan"
        message = "Pose cukup mirip, sedikit penyesuaian lagi."
    else:
        status_label = "buruk"
        message = "Pose belum menyerupai gerakan referensi."

    return {
        "exercise_id": exercise.exercise_id,
        "nama": exercise.nama,
        "score": score,
        "status": status_label,
        "message": message,
    }
