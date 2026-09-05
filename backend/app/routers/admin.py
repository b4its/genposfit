"""
GenPosFit — Router Admin (Dashboard & Leaderboard)
Endpoint khusus untuk dashboard sistem dan peringkat pengguna berdasarkan poin.
"""
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import User, PostureLog, ExerciseSession, Room

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get("/stats")
def get_system_stats(days: int = 30, db: Session = Depends(get_db)):
    """
    Statistik sistem untuk dashboard:
    - Jumlah total pengguna & pengguna baru dalam rentang waktu
    - Total saldo, saldo rata-rata, total poin gabungan
    - Jumlah log postur, aktivitas latihan, ruang multiplayer
    - Distribusi postur (bagus, ringan, buruk)
    - Data latihan per hari (untuk diagram batang)
    """
    since = datetime.utcnow() - timedelta(days=days)

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

    # Aktivitas latihan per hari (30 hari terakhir) untuk bar chart
    session_rows = (
        db.query(
            func.date(ExerciseSession.selesai_at).label("date"),
            func.count(ExerciseSession.session_id).label("count"),
        )
        .filter(ExerciseSession.selesai_at >= since)
        .group_by(func.date(ExerciseSession.selesai_at))
        .order_by(func.date(ExerciseSession.selesai_at).asc())
        .all()
    )
    exercise_daily = [{"date": str(r.date), "count": r.count} for r in session_rows]

    # Log postur per hari untuk bar chart
    log_rows = (
        db.query(
            func.date(PostureLog.timestamp).label("date"),
            func.count(PostureLog.id).label("count"),
        )
        .filter(PostureLog.timestamp >= since)
        .group_by(func.date(PostureLog.timestamp))
        .order_by(func.date(PostureLog.timestamp).asc())
        .all()
    )
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
        "distribusi": {
            "bagus": bagus,
            "ringan": ringan,
            "buruk": buruk,
        },
        "exercise_daily": exercise_daily,
        "posture_daily": posture_daily,
    }


@router.get("/leaderboard")
def get_leaderboard(limit: int = 100, db: Session = Depends(get_db)):
    """
    Urutan peringkat pengguna berdasarkan poin (descending).
    Setiap pengguna membawa saldo wallet aktif (tanpa saldo tertahan).
    """
    users = (
        db.query(User)
        .order_by(User.poin.desc(), User.user_id.asc())
        .limit(limit)
        .all()
    )

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