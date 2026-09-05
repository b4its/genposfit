"""
GenPosFit — Router Misi (Quest) & Poin
Endpoint untuk pengguna terautentikasi: daftar misi harian/mingguan dengan
progres otomatis dari telemetri nyata, klaim hadiah, dan ringkasan kualitas
data terkini.
"""
from datetime import timedelta
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User, utcnow
from app.services import quests as quest_service
from app.services.points import periode_bulanan

router = APIRouter(prefix="/api/quests", tags=["Misi & Poin"])


def _sisa_waktu() -> Dict[str, int]:
    now = utcnow()
    besok = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    # Musim mingguan berakhir Minggu 23:59:59 UTC
    minggu_depan = now + timedelta(days=(6 - now.weekday()))
    akhir_minggu = minggu_depan.replace(hour=23, minute=59, second=59, microsecond=0)
    return {
        "detik_hari_ini": max(0, int((besok - now).total_seconds())),
        "detik_pekan_ini": max(0, int((akhir_minggu - now).total_seconds())),
    }


@router.get("")
def list_misi(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Semua misi aktif + progres & status klaim user pada periode berjalan."""
    quest_service.ensure_quests(db)
    misi = quest_service.daftar_misi_user(db, user.user_id)
    return {
        "user_id": user.user_id,
        "poin_total": int(user.poin or 0),
        "musim": periode_bulanan(),
        "sisa_waktu": _sisa_waktu(),
        "misi": misi,
    }


@router.post("/{quest_id}/claim")
def klaim_misi(quest_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Klaim hadiah misi bila target progres tercapai (sekali per periode)."""
    try:
        hasil = quest_service.klaim_misi(db, user.user_id, quest_id)
    except quest_service.KlaimError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.pesan)
    return hasil


@router.get("/ringkasan")
def ringkasan_terkini(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Kondisi data user saat ini (kualitas telemetri 5 menit terakhir + poin)."""
    laporan = quest_service.ringkas_telemetri(db, user.user_id, menit=5)
    laporan["poin_total"] = int(user.poin or 0)
    laporan["musim"] = periode_bulanan()
    return laporan
