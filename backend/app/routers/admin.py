"""
GenPosFit — Router Admin
Kelola program latihan (Exercise) + Dashboard Sistem & Leaderboard.
Semua endpoint di-proteksi dengan JWT + role='admin'.
"""
import logging
from datetime import datetime, timedelta, timezone

def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import (
    Exercise, ExerciseType, ExerciseSession, PointLedger, PostureLog, Quest, Room, User,
)
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


class ExerciseTypeCreate(BaseModel):
    nama: str = Field(..., min_length=1, max_length=100)
    deskripsi: Optional[str] = None


class ExerciseTypeOut(BaseModel):
    type_id: int
    nama: str
    deskripsi: Optional[str] = None
    created_at: Optional[datetime] = None
    children: List["ExerciseOut"] = []

    class Config:
        from_attributes = True


class ExerciseCreate(BaseModel):
    type_id: Optional[int] = None
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
    type_id: Optional[int] = None
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

    class Config:
        from_attributes = True


@router.get("/exercises", response_model=List[ExerciseOut])
def admin_get_exercises(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.query(Exercise).order_by(Exercise.type_id, Exercise.nama).all()


# ---------------- JENIS LATIHAN (parent) ----------------

@router.get("/exercise-types", response_model=List[ExerciseTypeOut])
def admin_get_exercise_types(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Daftar jenis latihan (parent) beserta gerakan anaknya (children)."""
    return db.query(ExerciseType).order_by(ExerciseType.nama).all()


@router.post("/exercise-types", response_model=ExerciseTypeOut, status_code=201)
def admin_create_exercise_type(payload: ExerciseTypeCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Buat jenis latihan baru (parent)."""
    ex_type = ExerciseType(nama=payload.nama, deskripsi=payload.deskripsi)
    db.add(ex_type)
    db.commit()
    db.refresh(ex_type)
    return ex_type


@router.put("/exercise-types/{type_id}", response_model=ExerciseTypeOut)
def admin_update_exercise_type(type_id: int, payload: ExerciseTypeCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    ex_type = db.query(ExerciseType).filter_by(type_id=type_id).first()
    if not ex_type:
        raise HTTPException(404, "Jenis latihan tidak ditemukan.")
    if payload.nama:
        ex_type.nama = payload.nama
    ex_type.deskripsi = payload.deskripsi
    db.commit()
    db.refresh(ex_type)
    return ex_type


@router.delete("/exercise-types/{type_id}", status_code=204)
def admin_delete_exercise_type(type_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    ex_type = db.query(ExerciseType).filter_by(type_id=type_id).first()
    if not ex_type:
        raise HTTPException(404, "Jenis latihan tidak ditemukan.")
    db.delete(ex_type)  # cascade menghapus semua children
    db.commit()


@router.post("/exercise-types/{type_id}/exercises", response_model=ExerciseOut, status_code=201)
def admin_create_child_exercise(type_id: int, payload: ExerciseCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Tambah gerakan (child) ke dalam jenis latihan. skeleton_data direkam dari kamera admin."""
    ex_type = db.query(ExerciseType).filter_by(type_id=type_id).first()
    if not ex_type:
        raise HTTPException(404, "Jenis latihan tidak ditemukan.")
    data = payload.model_dump()
    data["type_id"] = type_id
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


@router.post("/exercises", response_model=ExerciseOut, status_code=201)
def admin_create_exercise(payload: ExerciseCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Buat latihan baru. Jika menyertakan skeleton_data, hitung sudut otomatis."""
    data = payload.model_dump()
    if data.get("type_id"):
        ex_type = db.query(ExerciseType).filter_by(type_id=data["type_id"]).first()
        if not ex_type:
            raise HTTPException(404, "Jenis latihan tidak ditemukan.")
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
    if data.get("type_id"):
        ex_type = db.query(ExerciseType).filter_by(type_id=data["type_id"]).first()
        if not ex_type:
            raise HTTPException(404, "Jenis latihan tidak ditemukan.")
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
@router.post("/exercises/seed-defaults")
def admin_seed_default_exercises(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Memuat atau mereset set latihan default dengan skeleton data lengkap."""
    from app.services.default_exercises import seed_default_exercises
    result = seed_default_exercises(db, force=True)
    return {"message": "Data latihan standar berhasil dimuat.", **result}

@router.post("/users/{user_id}/set-admin")
def set_user_admin(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    target = db.query(User).filter_by(user_id=user_id).first()
    if not target:
        raise HTTPException(404, "User tidak ditemukan.")
    target.role = "admin"
    db.commit()
    return {"message": f"User {target.username} sekarang admin."}

@router.get("/stats")
def get_system_stats(days: int = 30, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Statistik sistem untuk dashboard admin (pengguna, saldo, poin, latihan, postur, room)."""
    since = utcnow() - timedelta(days=days)

    total_users = db.query(User).count()
    new_users = db.query(User).filter(User.created_at >= since).count()
    total_poin = db.query(func.coalesce(func.sum(User.poin), 0)).scalar() or 0
    total_saldo = db.query(func.coalesce(func.sum(User.saldo), 0)).scalar() or 0.0
    avg_saldo = db.query(func.avg(User.saldo)).scalar() or 0.0
    total_logs = db.query(PostureLog).count()
    logs_since = db.query(PostureLog).filter(PostureLog.timestamp >= since).count()
    bagus = db.query(PostureLog).filter(PostureLog.status == "bagus").count()
    ringan = db.query(PostureLog).filter(PostureLog.status == "ringan").count()
    buruk = db.query(PostureLog).filter(PostureLog.status == "buruk").count()
    total_sessions = db.query(ExerciseSession).count()
    total_rooms = db.query(Room).count()

    session_rows = db.query(
        func.date(ExerciseSession.selesai_at).label("date"),
        func.count(ExerciseSession.session_id).label("count"),
    ).filter(ExerciseSession.selesai_at >= since).group_by(func.date(ExerciseSession.selesai_at)).order_by(func.date(ExerciseSession.selesai_at).asc()).all()
    exercise_daily = [{"date": str(r.date), "count": r.count} for r in session_rows]

    log_rows = db.query(
        func.date(PostureLog.timestamp).label("date"),
        func.count(PostureLog.id).label("count"),
    ).filter(PostureLog.timestamp >= since).group_by(func.date(PostureLog.timestamp)).order_by(func.date(PostureLog.timestamp).asc()).all()
    posture_daily = [{"date": str(r.date), "count": r.count} for r in log_rows]

    return {
        "days": days,
        "kpi": {
            "total_users": total_users,
            "new_users": new_users,
            "total_poin": int(total_poin),
            "total_saldo": float(total_saldo),
            "avg_saldo": round(float(avg_saldo), 2),
            "total_logs": total_logs,
            "logs_since": logs_since,
            "total_sessions": total_sessions,
            "total_rooms": total_rooms,
        },
        "distribusi": {"bagus": bagus, "ringan": ringan, "buruk": buruk},
        "exercise_daily": exercise_daily,
        "posture_daily": posture_daily,
    }


@router.get("/leaderboard")
def get_leaderboard(limit: int = 100, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Peringkat pengguna berdasarkan poin (descending), dengan saldo wallet."""
    users = db.query(User).order_by(User.poin.desc(), User.user_id.asc()).limit(limit).all()
    lb = []
    for idx, u in enumerate(users, start=1):
        lb.append({
            "rank": idx,
            "user_id": u.user_id,
            "username": u.username,
            "nama": u.nama,
            "pekerjaan": u.pekerjaan,
            "poin": int(u.poin or 0),
            "saldo": float(u.saldo or 0.0),
            "role": u.role or "user",
        })
    return {"count": len(lb), "users": lb}



# ---------------- MISI / QUEST (CRUD Admin) ----------------

class QuestCreate(BaseModel):
    kode: Optional[str] = None
    judul: str = Field(..., min_length=1, max_length=120)
    deskripsi: Optional[str] = Field(None, max_length=300)
    kategori: str = Field(default="harian")   # harian | mingguan
    metrik: str = Field(default="latihan_selesai")
    target: int = Field(default=5, ge=1)
    reward_poin: int = Field(default=10, ge=1)

class QuestUpdate(BaseModel):
    judul: Optional[str] = None
    deskripsi: Optional[str] = None
    kategori: Optional[str] = None
    metrik: Optional[str] = None
    target: Optional[int] = Field(None, ge=1)
    reward_poin: Optional[int] = Field(None, ge=1)
    aktif: Optional[bool] = None

def quest_dict(q: Quest) -> dict:
    return {
        "quest_id": q.quest_id, "kode": q.kode, "judul": q.judul, "deskripsi": q.deskripsi,
        "kategori": q.kategori, "metrik": q.metrik, "target": q.target,
        "reward_poin": q.reward_poin, "aktif": bool(q.aktif),
    }

@router.get("/quests", response_model=List[dict])
def admin_list_quests(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.services.quests import ensure_quests
    ensure_quests(db)
    return [quest_dict(q) for q in db.query(Quest).order_by(Quest.kategori, Quest.quest_id).all()]

@router.post("/quests", response_model=dict, status_code=201)
def admin_create_quest(payload: QuestCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    kode = payload.kode or f"misi_{abs(hash(payload.judul)) % 10**8:08d}"
    if db.query(Quest).filter_by(kode=kode).first():
        raise HTTPException(409, f"Kode misi '{kode}' sudah dipakai.")
    q = Quest(
        kode=kode, judul=payload.judul, deskripsi=payload.deskripsi,
        kategori=payload.kategori, metrik=payload.metrik,
        target=payload.target, reward_poin=payload.reward_poin, aktif=1,
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    logger.info("Admin %s membuat misi %s", admin.username, q.kode)
    return quest_dict(q)

@router.put("/quests/{quest_id}", response_model=dict)
def admin_update_quest(quest_id: int, payload: QuestUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    q = db.query(Quest).filter_by(quest_id=quest_id).first()
    if not q:
        raise HTTPException(404, "Misi tidak ditemukan.")
    data = payload.model_dump(exclude_unset=True)
    data["aktif"] = int(data["aktif"]) if "aktif" in data and data["aktif"] is not None else None
    for key, val in data.items():
        if val is not None:
            setattr(q, key, val)
    db.commit()
    db.refresh(q)
    return quest_dict(q)

@router.delete("/quests/{quest_id}", status_code=204)
def admin_delete_quest(quest_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Soft-delete (dinonaktifkan) agar ledger/klaim lama tetap konsisten."""
    q = db.query(Quest).filter_by(quest_id=quest_id).first()
    if not q:
        raise HTTPException(404, "Misi tidak ditemukan.")
    q.aktif = 0
    db.commit()


# ---------------- LEADERBOARD BULANAN (dipakai juga oleh publik) ----------------

@router.get("/leaderboard/monthly")
def admin_leaderboard_monthly(musim: Optional[str] = None, limit: int = 50, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Peringkat poin murni per musim (bulan) dari PointLedger."""
    from app.services.leaderboard import peringkat_bulanan
    return peringkat_bulanan(db, musim=musim, limit=limit)


# Resolve forward reference (ExerciseTypeOut → ExerciseOut) setelah ExerciseOut didefinisikan.
ExerciseTypeOut.model_rebuild()


# ---------------- DISTRIBUTION REWARD GPC (MANUAL, ADMIN ONLY) ----------------

class DistribusiGpcRequest(BaseModel):
    periode: Optional[str] = None  # 'YYYY-MM' default musim berjalan
    kering: bool = True            # True = simulasi/preview; False = kirim nyata


@router.get("/rewards/preview")
def admin_preview_rewards(periode: Optional[str] = None, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Pratinjau penerima GPC bulan berjalan (tanpa mengirim on-chain apa pun)."""
    from app.services.points import periode_bulanan
    from app.services.rewards import pratinjau
    return pratinjau(db, periode or periode_bulanan())


@router.post("/rewards/distribute")
def admin_distribusi_rewards(payload: DistribusiGpcRequest, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """
    Tombol 'Distribute Monthly Rewards'. dry_run/`kering` default True (aman).
    Nyata: perlu GPC_REWARDS_ENABLED=1 + konfigurasi Sepolia di backend.
    """
    from app.services.points import periode_bulanan
    from app.services.rewards import RewardError, distribusikan
    try:
        hasil = distribusikan(
            db, admin.user_id, payload.periode or periode_bulanan(), kering=payload.kering
        )
    except RewardError as exc:
        raise HTTPException(exc.status, exc.pesan)
    return hasil


@router.get("/rewards/history")
def admin_history_rewards(limit: int = 100, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.models import GpcRewardTx
    rows = (
        db.query(GpcRewardTx, User)
        .join(User, User.user_id == GpcRewardTx.user_id)
        .order_by(GpcRewardTx.created_at.desc())
        .limit(min(max(limit, 1), 500))
        .all()
    )
    return {
        "count": len(rows),
        "distribusi": [
            {
                "id": g.id, "periode": g.periode, "rank": g.rank,
                "user_id": g.user_id, "username": u.username, "nama": u.nama,
                "wallet_address": g.wallet_address, "jumlah": float(g.jumlah),
                "tx_hash": g.tx_hash, "status": g.status,
                "created_at": g.created_at.isoformat() if g.created_at else None,
            }
            for g, u in rows
        ],
    }
