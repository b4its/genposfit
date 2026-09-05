"""
GenPosFit — Layanan Peringkat Bulanan (Musim)
Bersumber dari PointLedger per 'YYYY-MM'; dipakai endpoint publik user dan
admin. Sekaligus menghitung sisa waktu musim berjalan.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.models import PointLedger, User, utcnow
from app.services.points import periode_bulanan


def _batas_musim(musim: str) -> Dict[str, datetime]:
    tahun, bulan = map(int, musim.split("-"))
    mulai = datetime(tahun, bulan, 1)
    if bulan == 12:
        akhir = datetime(tahun + 1, 1, 1)
    else:
        akhir = datetime(tahun, bulan + 1, 1)
    return {"mulai": mulai, "akhir": akhir}


def peringkat_bulanan(
    db: Session,
    musim: Optional[str] = None,
    limit: int = 50,
    user_id_terkaimana: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Daftar peringkat berdasarkan poin yang DIHASILKAN pada satu musim (bulan)
    berjalan menurut ledger. Musim pertama memakai fallback kolom users.poin
    untuk user lama yang belum punya entri ledger.
    """
    musim = musim or periode_bulanan()
    poin_musim = func.coalesce(
        func.sum(case((PointLedger.periode == musim, PointLedger.delta), else_=0)), 0
    )

    baris = (
        db.query(
            User.user_id,
            User.username,
            User.nama,
            User.poin,
            User.role,
            poin_musim,
        )
        .outerjoin(PointLedger, PointLedger.user_id == User.user_id)
        .group_by(User.user_id)
        .order_by(poin_musim.desc(), User.poin.desc(), User.user_id.asc())
        .all()
    )

    peringkat: List[Dict[str, Any]] = []
    saya: Optional[Dict[str, Any]] = None
    for idx, (uid, uname, nama, poin_total, role, pm) in enumerate(baris, start=1):
        pm = int(pm or 0)
        if pm == 0 and poin_total:
            pm = int(poin_total)  # fallback era sebelum ledger poin
        entri = {
            "rank": idx,
            "user_id": uid,
            "username": uname,
            "nama": nama,
            "poin_musim": pm,
            "poin_total": int(poin_total or 0),
            "role": role or "user",
        }
        if uid == user_id_terkaimana:
            saya = entri
        if idx <= limit:
            peringkat.append(entri)

    batas = _batas_musim(musim)
    now = utcnow()
    sisa = max(0, int((batas["akhir"] - now).total_seconds()))
    return {
        "musim": musim,
        "musim_berjalan": musim == periode_bulanan(now),
        "mulai": batas["mulai"].isoformat(),
        "berakhir": batas["akhir"].isoformat(),
        "sisa_waktu_detik": sisa,
        "sisa_waktu_hari": round(sisa / 86400.0, 1),
        "jumlah_peserta": len(baris),
        "top": peringkat,
        "saya": saya,
    }
