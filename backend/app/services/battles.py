"""
GenPosFit — Layanan Hasil Battle (Multiplayer Reward Settlement)
Mencatat hasil battle multiplayer ke DB, membagikan poin (menang / ikut
bertanding) via PointLedger, dan memberi progres misi 'battle_menang'.
Idempoten per battle_id (anti double-report / point farming).
"""
from typing import Any, Dict, List, Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import BattleResult, Room, RoomPlayer, User, utcnow
from app.services.points import periode_bulanan, tambah_poin

POIN_MENANG = 25
POIN_BERTANDING = 8
MIN_PESERTA_BERAKUN = 1   # minimal 1 akun manusia; tamu boleh ikut tercatat? (lihat quality_ok)


class BattleInvalidError(Exception):
    def __init__(self, status: int, pesan: str):
        super().__init__(pesan)
        self.status = status
        self.pesan = pesan


def _skor_incaran(room: Optional[Room]) -> Optional[int]:
    return room.max_score if room else None


def catat_hasil_battle(
    db: Session,
    *,
    room_code: str,
    battle_id: str,
    hasil: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    hasil: daftar [{"guest_key": str, "skor": int, "is_pemenang": bool}]
    - room_code + battle_id wajib; battle_id unik per sesi pertandingan.
    - Pemenang = tepat satu dengan skor tertinggi; seri ditolak.
    - Poin hanya utk peserta dengan user_id terverifikasi (akun login),
      dihitung ulang dari data RoomPlayer (client TIDAK bisa mengaku user_id).
    """
    if not battle_id or not battle_id.strip():
        raise BattleInvalidError(422, "battle_id wajib diisi.")
    if not hasil or len(hasil) < 2:
        raise BattleInvalidError(422, "Battle requires minimal 2 pemain untuk mencatat hasil.")

    battle_id = battle_id.strip()[:64]
    room = db.query(Room).filter_by(room_code=room_code.strip().upper()).first()
    if not room:
        raise BattleInvalidError(404, "Room tidak ditemukan.")

    # tolak laporan ganda (idempoten)
    ada = db.query(BattleResult).filter_by(battle_id=battle_id).first()
    if ada:
        return {
            "status": "duplicate",
            "battle_id": battle_id,
            "message": "Hasil battle ini sudah dicatat sebelumnya.",
            "dibagikan": 0,
        }

    # normalisasi + kunci identitas dari DB
    players = db.query(RoomPlayer).filter_by(room_id=room.room_id).all()
    by_key = {p.guest_key: p for p in players if p.guest_key}

    entri: List[Dict[str, Any]] = []
    seen = set()
    for h in hasil:
        gk = str(h.get("guest_key") or "").strip()
        if not gk or gk in seen:
            raise BattleInvalidError(422, "guest_key kosong atau dobel dalam laporan.")
        seen.add(gk)
        p = by_key.get(gk)
        if not p:
            raise BattleInvalidError(403, f"guest_key {gk} bukan pemain room ini.")
        try:
            skor = int(h.get("skor", 0))
        except (TypeError, ValueError):
            raise BattleInvalidError(422, "skor harus integer.")
        if skor < 0:
            raise BattleInvalidError(422, "skor tidak boleh negatif.")
        entri.append({
            "player": p,
            "guest_key": gk,
            "skor": skor,
            "is_pemenang": bool(h.get("is_pemenang")),
        })

    pemenang = [e for e in entri if e["is_pemenang"]]
    if len(pemenang) != 1:
        raise BattleInvalidError(422, "Harus ada tepat satu is_pemenang=true.")
    skor_maks = max(e["skor"] for e in entri)
    if any(e["skor"] == skor_maks for e in entri if not e["is_pemenang"]):
        raise BattleInvalidError(422, "Skor pemenang seri dengan peserta lain.")
    target_skor = _skor_incaran(room)
    if target_skor is not None and pemenang[0]["skor"] < target_skor:
        raise BattleInvalidError(422, f"Skor pemenang di bawah target room ({target_skor}).")

    peserta_berawat = [e for e in entri if e["player"].user_id]
    quality_ok = len(peserta_berawat) >= 1 and len(entri) >= 2

    dibagikan = 0
    baris = []
    for e in entri:
        u_id = e["player"].user_id
        poin = 0
        if u_id and quality_ok:
            poin = POIN_MENANG if e["is_pemenang"] else POIN_BERTANDING
            tambah_poin(
                db, u_id, poin,
                alasan="battle_menang" if e["is_pemenang"] else "battle_bertanding",
                periode=periode_bulanan(),
                ref_tipe="battle", commit=False,
            )
            dibagikan += poin
        baris.append(BattleResult(
            battle_id=battle_id,
            room_code=room.room_code,
            user_id=u_id or 0,
            display_name=e["player"].display_name,
            score_akhir=e["skor"],
            is_winner=1 if e["is_pemenang"] else 0,
            awarded_poin=poin,
            quality_ok=1 if quality_ok else 0,
            created_at=utcnow(),
        ))
    try:
        db.add_all(baris)
        db.commit()
    except IntegrityError:
        db.rollback()
        return {
            "status": "duplicate",
            "battle_id": battle_id,
            "message": "Hasil battle ini sudah dicatat (raciness).",
            "dibagikan": 0,
        }

    return {
        "status": "recorded",
        "battle_id": battle_id,
        "room_code": room.room_code,
        "dibagikan_total": dibagikan,
        "pemenang": {
            "guest_key": pemenang[0]["guest_key"],
            "display_name": pemenang[0]["player"].display_name,
            "user_id": pemenang[0]["player"].user_id,
            "poin": POIN_MENANG if (pemenang[0]["player"].user_id and quality_ok) else 0,
        },
        "kualitas_valid": quality_ok,
        "hasil": [
            {
                "guest_key": e["guest_key"],
                "user_id": e["player"].user_id,
                "skor": e["skor"],
                "is_pemenang": e["is_pemenang"],
                "poin": (POIN_MENANG if e["is_pemenang"] else POIN_BERTANDING) if (e["player"].user_id and quality_ok) else 0,
            }
            for e in entri
        ],
    }
