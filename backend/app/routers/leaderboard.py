"""
GenPosFit — Router Peringkat (Leaderboard) Publik
User biasa dapat melihat klasemen musiman (poin ledger bulan berjalan),
sisa waktu musim, dan posisi "saya" — tanpa akses data sensitif admin.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.services.leaderboard import peringkat_bulanan

router = APIRouter(prefix="/api/leaderboard", tags=["Peringkat"])



def _cek_format_musim(musim: Optional[str]) -> None:
    if musim is None:
        return
    import re

    if not re.match(r"^\d{4}-(0[1-9]|1[0-2])$", musim):
        raise HTTPException(400, "Format musim harus 'YYYY-MM'.")


@router.get("/monthly")
def leaderboard_bulanan(
    musim: Optional[str] = None,
    limit: int = 25,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Klasemen poin bulan berjalan (atau musim tertentu bila diminta)."""
    _cek_format_musim(musim)
    limit = max(5, min(200, limit))
    return peringkat_bulanan(db, musim=musim, limit=limit, user_id_terkaimana=user.user_id)
