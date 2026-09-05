"""
GenPosFit — Layanan Poin & Ledger
Satu-satunya jalur penulisan users.poin adalah lewat tambah_poin() supaya
setiap mutasi tercatat (audit + dasar peringkat bulanan per periode 'YYYY-MM').
"""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.models import utcnow
from app.models import PointLedger, User


def periode_bulanan(at: Optional[datetime] = None) -> str:
    """Kunci musim peringkat bulanan, format 'YYYY-MM' (UTC)."""
    at = at or utcnow()
    return f"{at.year:04d}-{at.month:02d}"


def tambah_poin(
    db: Session,
    user_id: int,
    delta: int,
    alasan: str,
    *,
    periode: Optional[str] = None,
    ref_tipe: Optional[str] = None,
    ref_id: Optional[int] = None,
    commit: bool = True,
) -> PointLedger:
    """
    Tambah (atau kurangi) poin user + tulis baris ledger atomik.
    Delta boleh negatif untuk koreksi admin; saldo user tidak pernah di bawah 0.
    """
    if delta == 0:
        raise ValueError("delta poin tidak boleh 0")
    user = db.query(User).filter_by(user_id=user_id).first()
    if not user:
        raise ValueError(f"user_id {user_id} tidak ditemukan")

    user.poin = max(0, int(user.poin or 0) + int(delta))
    entri = PointLedger(
        user_id=user_id,
        delta=int(delta),
        alasan=alasan,
        periode=periode or periode_bulanan(),
        ref_tipe=ref_tipe,
        ref_id=ref_id,
    )
    db.add(entri)
    if commit:
        db.commit()
        db.refresh(entri)
    else:
        db.flush()
    return entri


def leaderboard_bulanan(db: Session, musim: str, limit: int = 50, offset: int = 0):
    """
    Peringkat berdasarkan poin LEDGER satu musim (bulan) berjalan;
    fallback ke users.poin untuk user lama yang belum punya entri ledger
    di musim itu tetapi total-poinnya tercatat sebelum sistem ledger aktif.
    """
    sum_ledger = func.coalesce(func.sum(PointLedger.delta), 0)
    baris = (
        db.query(User, sum_ledger.label("poin_musim"))
        .outerjoin(PointLedger, (PointLedger.user_id == User.user_id) & (PointLedger.periode == musim))
        .group_by(User.user_id)
        .order_by(func.sum(PointLedger.delta).desc().nullslast(), User.poin.desc(), User.user_id.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    hasil = []
    for u, poin_musim in baris:
        pm = int(poin_musim or 0)
        # User lama tanpa mutasi ledger musim ini: pakai total historisnya.
        if pm == 0 and u.poin:
            pm = int(u.poin)
        hasil.append((u, pm))
    hasil.sort(key=lambda t: (-t[1], t[0].user_id))
    return hasil
