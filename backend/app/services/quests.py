"""
GenPosFit — Engine Misi (Quest) Harian & Mingguan
Progres misi dihitung OTOMATIS dari data telemetri nyata user (postur,
latihan, battle), dengan gerbang kualitas data: hanya sampel berkualitas
yang bernilai poin. Klaim hadiah oleh user -> tercatat di PointLedger.
"""
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models import (
    ExerciseSession, PoseBaseline, PostureLog, Quest, User, UserQuest, utcnow,
)
from app.services.points import periode_bulanan, tambah_poin

# Konstanta ambang
KUALITAS_MIN = 55.0          # di bawah ini log dianggap sampah / tidak dihitung
KUALITAS_BERTUJUAN = 80.0    # sampel "premium" (bonus progres)
MIN_INTERVAL_LOG_DETIK = 10  # dua log < 10 detik dianggap spam (anti-cheat)

# Seed misi default (idempoten via kode unik)
QUEST_DEFAULTS: List[Dict[str, Any]] = [
    {
        "kode": "postur_prima_harian",
        "judul": "Postur Prima Harian",
        "deskripsi": "Kumpulkan 12 sampel postur berkualitas berstatus BAGUS hari ini.",
        "kategori": "harian", "metrik": "postur_bagus", "target": 12, "reward_poin": 10,
    },
    {
        "kode": "terapi_bergerak_harian",
        "judul": "Terapi Bergerak Harian",
        "deskripsi": "Selesaikan 2 sesi latihan terapi postur hari ini.",
        "kategori": "harian", "metrik": "latihan_selesai", "target": 2, "reward_poin": 10,
    },
    {
        "kode": "konsistensi_7hari",
        "judul": "Konsistensi Tujuh Hari",
        "deskripsi": "Pantau postur minimal 40 sampel berkualitas mingguan ini.",
        "kategori": "mingguan", "metrik": "postur_qty", "target": 40, "reward_poin": 30,
    },
    {
        "kode": "kalibrasi_ulang",
        "judul": "Baseline Segar",
        "deskripsi": "Perbarui kalibrasi pose baseline-mu minggu ini.",
        "kategori": "mingguan", "metrik": "kalibrasi", "target": 1, "reward_poin": 15,
    },
    {
        "kode": "duel_pilar",
        "judul": "Duel Pilar Postur",
        "deskripsi": "Menangkan 1 battle multiplayer minggu ini.",
        "kategori": "mingguan", "metrik": "battle_menang", "target": 1, "reward_poin": 25,
    },
]


def kunci_periode(kategori: str, now: Optional[datetime] = None) -> str:
    now = now or utcnow()
    if kategori == "harian":
        return now.strftime("%Y-%m-%d")
    iso = now.isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


def window_periode(periode: str) -> tuple[datetime, datetime]:
    """Rentang [mulai, selesai) UTC utk kunci periode harian/mingguan."""
    if periode.count("-") == 2 and "-W" not in periode:
        hari = datetime.strptime(periode, "%Y-%m-%d")
        return hari, hari + timedelta(days=1)
    tahun, minggu = periode.split("-W")
    mulai = datetime.fromisocalendar(int(tahun), int(minggu), 1)
    return mulai, mulai + timedelta(days=7)


def ensure_quests(db: Session, sumber: Optional[List[Dict[str, Any]]] = None) -> int:
    """Insert quest default yang belum ada (berdasarkan kode). Return jumlah baru."""
    baru = 0
    for q in (sumber or QUEST_DEFAULTS):
        ada = db.query(Quest).filter_by(kode=q["kode"]).first()
        if not ada:
            db.add(Quest(**q))
            baru += 1
    if baru:
        db.commit()
    return baru


# ----------------- perhitungan progres per metrik -----------------

KUNCI_METRIK = ("postur_bagus", "postur_qty", "latihan_selesai", "kalibrasi", "battle_menang")


def hitung_progres(db: Session, user_id: int, metrik: str, periode: str) -> int:
    mulai, selesai = window_periode(periode)
    kondisi_waktu = None

    if metrik in ("postur_bagus", "postur_qty"):
        kual = or_(PostureLog.kualitas_data.is_(None), PostureLog.kualitas_data >= KUALITAS_MIN)
        base = db.query(PostureLog).filter(
            PostureLog.user_id == user_id,
            PostureLog.timestamp >= mulai,
            PostureLog.timestamp < selesai,
            kual,
        )
        if metrik == "postur_bagus":
            return base.filter(PostureLog.status == "bagus").count()
        return base.count()

    if metrik == "latihan_selesai":
        return (
            db.query(ExerciseSession)
            .filter(
                ExerciseSession.user_id == user_id,
                ExerciseSession.selesai_at >= mulai,
                ExerciseSession.selesai_at < selesai,
                or_(ExerciseSession.avg_skor.is_(None), ExerciseSession.avg_skor >= 60.0),
            )
            .count()
        )

    if metrik == "kalibrasi":
        return (
            db.query(PoseBaseline)
            .filter(
                PoseBaseline.user_id == user_id,
                PoseBaseline.recorded_at >= mulai,
                PoseBaseline.recorded_at < selesai,
            )
            .count()
        )

    if metrik == "battle_menang":
        from app.models import BattleResult  # ada sejak tahap multiplayer reward
        return (
            db.query(BattleResult)
            .filter(
                BattleResult.user_id == user_id,
                BattleResult.is_winner == 1,
                BattleResult.created_at >= mulai,
                BattleResult.created_at < selesai,
            )
            .count()
        )

    return 0


# ----------------- laporan & klaim -----------------

def daftar_misi_user(db: Session, user_id: int, now: Optional[datetime] = None) -> List[Dict[str, Any]]:
    """Semua quest aktif + progres + klaim user pada periode berjalan."""
    now = now or utcnow()
    quests = db.query(Quest).filter(Quest.aktif == 1).order_by(Quest.kategori, Quest.quest_id).all()
    kunci = {k: kunci_periode(k, now) for k in ("harian", "mingguan")}
    existing = {
        (uq.quest_id, uq.periode): uq for uq in db.query(UserQuest).filter_by(user_id=user_id).all()
    }
    hasil = []
    for q in quests:
        periode = kunci[q.kategori]
        uq = existing.get((q.quest_id, periode))
        progres = uq.progres if uq else hitung_progres(db, user_id, q.metrik, periode)
        if not uq:
            uq = UserQuest(user_id=user_id, quest_id=q.quest_id, periode=periode, progres=progres, status="aktif")
            db.add(uq)
        elif uq.status == "aktif":
            progres = max(int(progres), hitung_progres(db, user_id, q.metrik, periode))
            if int(uq.progres) < progres:
                uq.progres = progres
        if uq.status == "aktif" and progres >= q.target:
            uq.status = "selesai"
        hasil.append({
            "quest_id": q.quest_id,
            "kode": q.kode,
            "judul": q.judul,
            "deskripsi": q.deskripsi,
            "kategori": q.kategori,
            "metrik": q.metrik,
            "target": q.target,
            "reward_poin": q.reward_poin,
            "progres": int(min(progres, q.target)),
            "persen": round(min(100.0, 100.0 * progres / max(1, q.target)), 1),
            "status": uq.status or "aktif",
            "periode": periode,
            "diklaim_pada": uq.claimed_at.isoformat() if uq.claimed_at else None,
        })
    db.commit()
    return hasil


class KlaimError(Exception):
    def __init__(self, status: int, pesan: str):
        super().__init__(pesan)
        self.status = status
        self.pesan = pesan


def klaim_misi(db: Session, user_id: int, quest_id: int) -> Dict[str, Any]:
    quest = db.query(Quest).filter_by(quest_id=quest_id, aktif=1).first()
    if not quest:
        raise KlaimError(404, "Misi tidak ditemukan atau tidak aktif.")
    periode = kunci_periode(quest.kategori)
    uq = db.query(UserQuest).filter_by(user_id=user_id, quest_id=quest_id, periode=periode).first()
    if uq and uq.status == "diklaim":
        raise KlaimError(409, "Hadiah misi ini sudah diklaim pada periode berjalan.")
    progres = hitung_progres(db, user_id, quest.metrik, periode)
    if progres < quest.target:
        raise KlaimError(400, f"Progres misi belum mencapai target ({progres}/{quest.target}).")

    entri = tambah_poin(
        db, user_id, quest.reward_poin,
        alasan=f"misi:{quest.kode}",
        periode=periode_bulanan(),
        ref_tipe="quest", ref_id=quest.quest_id, commit=False,
    )
    if not uq:
        uq = UserQuest(user_id=user_id, quest_id=quest_id, periode=periode)
        db.add(uq)
    uq.progres = progres
    uq.status = "diklaim"
    uq.claimed_at = utcnow()
    db.commit()
    user = db.query(User).filter_by(user_id=user_id).first()
    return {
        "message": f"Klaim '{quest.judul}' berhasil.",
        "reward_poin": quest.reward_poin,
        "total_poin": int(user.poin or 0),
        "ledger_id": entri.id,
    }


def ringkas_telemetri(db: Session, user_id: int, menit: int = 5) -> Dict[str, Any]:
    """
    'Kondisi terkini' user utk UI: kualitas sampel menit terakhir,
    streak, dan poin musim berjalan.
    """
    sejak = utcnow() - timedelta(minutes=menit)
    logs = db.query(PostureLog).filter(
        PostureLog.user_id == user_id, PostureLog.timestamp >= sejak
    ).all()
    q_vals = [float(l.kualitas_data) for l in logs if l.kualitas_data is not None]
    dari_baseline = db.query(PoseBaseline).filter_by(user_id=user_id).order_by(PoseBaseline.recorded_at.desc()).first()
    from app.services.deviation_score import status_referensi
    ref = status_referensi(dari_baseline)
    return {
        "user_id": user_id,
        "dalam_menit_terakhir": menit,
        "jumlah_sampel": len(logs),
        "kualitas_rata": round(sum(q_vals) / len(q_vals), 1) if q_vals else None,
        "persentase_bag_us": round(100.0 * sum(1 for l in logs if l.status == "bagus") / len(logs), 1) if logs else None,
        "baseline": {
            "ada": ref["status"] != "default",
            "status": ref["status"],
            "usia_hari": ref["usia_hari"],
            "perlu_kalibrasi_ulang": ref["status"] == "kedaluwarsa",
        },
    }
