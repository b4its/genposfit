"""
GenPosFit — Skor Deviasi vs Baseline
Menghitung skor kualitas postur dan tingkat deviasi terhadap baseline personal user.
"""
from typing import Optional, Dict, Any

try:
    from sqlalchemy.orm import Session
    from app.models import PoseBaseline
except ImportError:
    Session = Any  # type: ignore
    PoseBaseline = Any  # type: ignore


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
    faktor: float = 2.0
) -> float:
    """
    100 = persis baseline user, 0 = menyimpang jauh.
    Menggunakan toleransi berbasis standar deviasi kalibrasi.
    """
    toleransi = max(float(std_val) * faktor, 5.0)
    deviasi = abs(sudut_live - float(baseline_val))
    score = max(0.0, 100.0 - (deviasi / toleransi) * 100.0)
    return round(score, 2)


def evaluasi_postur_lengkap(
    sudut_leher: float,
    sudut_punggung: float,
    level_bahu: float,
    baseline: Optional[PoseBaseline] = None
) -> Dict[str, Any]:
    """
    Mengevaluasi skor komposit leher, punggung, dan bahu.
    Mengembalikan skor keseluruhan (0-100) dan status ('bagus', 'ringan', 'buruk').
    """
    # Standar default jika baseline pengguna belum dikalibrasi
    base_leher = float(baseline.sudut_leher) if baseline else 165.0
    base_punggung = float(baseline.sudut_punggung) if baseline else 170.0
    std_l = float(baseline.std_leher) if baseline else 2.5
    std_p = float(baseline.std_punggung) if baseline else 2.5

    skor_leher = skor_deviasi_tunggal(sudut_leher, base_leher, std_l)
    skor_punggung = skor_deviasi_tunggal(sudut_punggung, base_punggung, std_p)

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

    return {
        "skor_deviasi": skor_total,
        "skor_leher": skor_leher,
        "skor_punggung": skor_punggung,
        "level_bahu": level_bahu,
        "status": status,
        "feedback": feedback,
        "baseline_terpakai": {
            "sudut_leher": base_leher,
            "sudut_punggung": base_punggung,
            "is_calibrated": baseline is not None,
        }
    }
