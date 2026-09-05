"""
GenPosFit - Skor Deviasi vs Baseline
Menghitung skor kualitas postur dan tingkat deviasi terhadap baseline personal user.
"""
from datetime import datetime, timezone
from typing import Optional, Dict, Any

try:
    from sqlalchemy.orm import Session
    from app.models import PoseBaseline
except ImportError:
    Session = Any  # type: ignore
    PoseBaseline = Any  # type: ignore

# Baseline dianggap masih mencerminkan kondisi terkini user selama umur
# di bawah ambang ini. Lewat itu, toleransi diperlebar secara proporsional
# supaya skor tidak menghukum user yang lupa kalibrasi ulang.
MAX_USIA_BASELINE_HARI = 30
# Pelonggaran toleransi maksimum untuk baseline kedaluwarsa
# (kelipatan faktor normal).
LONGGARAN_TOL_MAX = 2.5
# Kualitas data minimum agar skor dianggap tepercaya penuh.
KUALITAS_TERPERCAYA_MIN = 55.0  # diselaraskan dgn AMBANG_SIMPAN pose_analysis


def _hari_since(dt: Optional[datetime]) -> Optional[int]:
    if dt is None:
        return None
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return max(0, (now - dt).days)


def status_referensi(baseline: Optional[PoseBaseline]) -> Dict[str, Any]:
    """
    Kondisi referensi (baseline) yang dipakai untuk evaluasi saat ini:
      - 'aktual'      : user sudah kalibrasi dan baseline masih fresh
      - 'kedaluwarsa' : sudah kalibrasi tapi terlalu lama -> toleransi dilonggarkan
      - 'default'     : user belum pernah kalibrasi -> pakai standar umum
    """
    if baseline is None:
        return {"status": "default", "usia_hari": None, "pelonggaran_faktor": 2.0}
    usia = _hari_since(getattr(baseline, "recorded_at", None))
    if usia is None or usia <= MAX_USIA_BASELINE_HARI:
        return {"status": "aktual", "usia_hari": usia, "pelonggaran_faktor": 2.0}
    factor = min(LONGGARAN_TOL_MAX, 2.0 * (1.0 + (usia - MAX_USIA_BASELINE_HARI) / 90.0))
    return {"status": "kedaluwarsa", "usia_hari": usia, "pelonggaran_faktor": round(factor, 2)}


def ambil_baseline(
    db: Session,
    user_id: int,
    tipe_pose: str = "duduk_rileks",
    orientasi: Optional[str] = None,
) -> Optional[PoseBaseline]:
    """Mengambil data baseline postur user dari database."""
    query = db.query(PoseBaseline).filter_by(user_id=user_id, tipe_pose=tipe_pose)
    if orientasi:
        query = query.filter_by(orientasi=orientasi)
    baseline = query.first()

    # Fallback ke pose apapun milik user jika kombinasi spesifik belum ada
    if not baseline:
        baseline = db.query(PoseBaseline).filter_by(user_id=user_id).first()

    return baseline


def skor_deviasi_tunggal(
    sudut_live: float,
    baseline_val: float,
    std_val: float,
    faktor: float = 2.0,
) -> float:
    """
    100 = persis baseline user, 0 = menyimpang jauh.
    Toleransi = max(std personal, 4 derajat) * faktor. `faktor` (>2.0) dipakai
    saat referensi kedaluwarsa supaya kondisi terkini tubuh user tidak dihukum
    oleh baseline lama. Floor absolut 8 derajat menjaga skor tetap masuk akal.
    """
    toleransi = max(8.0, max(float(std_val), 4.0) * faktor)
    deviasi = abs(sudut_live - float(baseline_val))
    score = max(0.0, 100.0 - (deviasi / toleransi) * 100.0)
    return round(score, 2)


def evaluasi_postur_lengkap(
    sudut_leher: float,
    sudut_punggung: float,
    level_bahu: float,
    baseline: Optional[PoseBaseline] = None,
    kualitas_data: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Mengevaluasi skor komposit leher, punggung, dan bahu dengan toleransi
    yang beradaptasi pada kondisi terkini pengguna:
      1. Freshness baseline (kedaluwarsa -> toleransi dilonggarkan).
      2. Kualitas data telemetri frame (rendah -> skor diberi catatan tidak tepercaya).
    """
    ref = status_referensi(baseline)

    # Acuan personal jika sudah kalibrasi; jika belum, pakai standar umum
    # ergonomi duduk (165 derajat leher / 170 derajat punggung).
    base_leher = float(baseline.sudut_leher) if baseline else 165.0
    base_punggung = float(baseline.sudut_punggung) if baseline else 170.0
    std_l = float(baseline.std_leher) if baseline else 2.5
    std_p = float(baseline.std_punggung) if baseline else 2.5

    skor_leher = skor_deviasi_tunggal(sudut_leher, base_leher, std_l, faktor=ref["pelonggaran_faktor"])
    skor_punggung = skor_deviasi_tunggal(sudut_punggung, base_punggung, std_p, faktor=ref["pelonggaran_faktor"])

    # Skor bahu: makin miring (level_bahu besar) makin rendah
    skor_bahu = max(0.0, 100.0 - ((level_bahu - 0.02) * 200.0)) if level_bahu > 0.02 else 100.0

    # Bobot skor: 55% leher + 35% punggung + 10% bahu = 100%
    skor_total = (skor_leher * 0.55) + (skor_punggung * 0.35) + (skor_bahu * 0.10)
    skor_total = max(0.0, min(100.0, skor_total))
    skor_total = round(skor_total, 2)

    if skor_total >= 85.0:
        status = "bagus"
        feedback = "Postur ergonomis ideal. Pertahankan posisi ini!"
    elif skor_total >= 60.0:
        status = "ringan"
        feedback = "Peringatan ringan: dagu agak maju atau punggung sedikit membungkuk."
    else:
        status = "buruk"
        feedback = "Postur buruk terdeteksi! Tegakkan punggung dan tarik dagu ke belakang."

    data_terpercaya = kualitas_data is None or kualitas_data >= KUALITAS_TERPERCAYA_MIN
    if not data_terpercaya:
        feedback += " Catatan: kualitas data kamera sedang rendah, skor bisa tidak akurat."
    elif ref["status"] == "kedaluwarsa":
        feedback += f" Baseline berumur {ref['usia_hari']} hari - kalibrasi ulang disarankan."
    elif ref["status"] == "default" and skor_total >= 85.0:
        feedback += " Skor memakai acuan umum; jalani Kalibrasi Postur agar lebih personal."

    return {
        "skor_deviasi": skor_total,
        "skor_leher": skor_leher,
        "skor_punggung": skor_punggung,
        "level_bahu": level_bahu,
        "status": status,
        "feedback": feedback,
        "data_terpercaya": data_terpercaya,
        "baseline_terpakai": {
            "sudut_leher": base_leher,
            "sudut_punggung": base_punggung,
            "is_calibrated": baseline is not None,
            "status_referensi": ref["status"],
            "usia_hari": ref["usia_hari"],
            "pelonggaran_faktor": ref["pelonggaran_faktor"],
        },
    }
