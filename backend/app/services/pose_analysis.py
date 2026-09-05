"""
GenPosFit — Pose Analysis Service
Menghitung sudut biomekanika postur (leher, punggung, bahu),
mendeteksi orientasi tubuh (frontal, lateral kiri, lateral kanan),
dan mengevaluasi postur berdasarkan standar ergonomi & baseline.
"""
from typing import Dict, List, Optional, Tuple, Any
import math

try:
    import numpy as np
except ImportError:
    np = None


class PoseIndices:
    """Indeks landmark standar MediaPipe Pose (33 titik)"""
    NOSE = 0
    LEFT_EYE_INNER = 1
    LEFT_EYE = 2
    LEFT_EYE_OUTER = 3
    RIGHT_EYE_INNER = 4
    RIGHT_EYE = 5
    RIGHT_EYE_OUTER = 6
    LEFT_EAR = 7
    RIGHT_EAR = 8
    MOUTH_LEFT = 9
    MOUTH_RIGHT = 10
    LEFT_SHOULDER = 11
    RIGHT_SHOULDER = 12
    LEFT_ELBOW = 13
    RIGHT_ELBOW = 14
    LEFT_WRIST = 15
    RIGHT_WRIST = 16
    LEFT_PINKY = 17
    RIGHT_PINKY = 18
    LEFT_INDEX = 19
    RIGHT_INDEX = 20
    LEFT_THUMB = 21
    RIGHT_THUMB = 22
    LEFT_HIP = 23
    RIGHT_HIP = 24
    LEFT_KNEE = 25
    RIGHT_KNEE = 26
    LEFT_ANKLE = 27
    RIGHT_ANKLE = 28
    LEFT_HEEL = 29
    RIGHT_HEEL = 30
    LEFT_FOOT_INDEX = 31
    RIGHT_FOOT_INDEX = 32


def hitung_sudut_3_titik(
    a: Tuple[float, float],
    b: Tuple[float, float],
    c: Tuple[float, float]
) -> float:
    """
    Menghitung sudut pada titik B (vertex) dalam derajat (0 - 180°).
    a, b, c adalah koordinat (x, y).
    """
    ba_x = a[0] - b[0]
    ba_y = a[1] - b[1]
    bc_x = c[0] - b[0]
    bc_y = c[1] - b[1]

    norm_ba = math.hypot(ba_x, ba_y)
    norm_bc = math.hypot(bc_x, bc_y)

    if norm_ba < 1e-7 or norm_bc < 1e-7:
        return 180.0

    dot_product = ba_x * bc_x + ba_y * bc_y
    cosine_angle = dot_product / (norm_ba * norm_bc)
    cosine_angle = max(-1.0, min(1.0, cosine_angle))
    angle = math.degrees(math.acos(cosine_angle))
    return float(angle)


def deteksi_orientasi(landmarks: List[Dict[str, float]]) -> str:
    """
    Mendeteksi orientasi tubuh pengguna: 'frontal', 'lateral_kiri', atau 'lateral_kanan'.
    Landmarks adalah daftar 33 dict {'x': ..., 'y': ..., 'z': ..., 'visibility': ...}.
    """
    if len(landmarks) < 25:
        return "frontal"

    l_shoulder = landmarks[PoseIndices.LEFT_SHOULDER]
    r_shoulder = landmarks[PoseIndices.RIGHT_SHOULDER]
    l_ear = landmarks[PoseIndices.LEFT_EAR]
    r_ear = landmarks[PoseIndices.RIGHT_EAR]
    nose = landmarks[PoseIndices.NOSE]

    # Jarak horizontal antar bahu
    shoulder_width = abs(l_shoulder.get("x", 0.0) - r_shoulder.get("x", 0.0))

    # Visibilitas atau keyakinan
    l_vis = (l_shoulder.get("visibility", 0.5) + l_ear.get("visibility", 0.5)) / 2
    r_vis = (r_shoulder.get("visibility", 0.5) + r_ear.get("visibility", 0.5)) / 2

    # Jika kedua bahu tampak lebar dan simetris -> frontal
    if shoulder_width > 0.16 and abs(l_vis - r_vis) < 0.4:
        return "frontal"

    # Jika tubuh menyamping
    nose_x = nose.get("x", 0.5)
    shoulder_mid_x = (l_shoulder.get("x", 0.5) + r_shoulder.get("x", 0.5)) / 2

    # Jika hidung condong ke kiri kamera vs bahu
    if nose_x < shoulder_mid_x or l_vis > r_vis + 0.2:
        return "lateral_kiri"
    else:
        return "lateral_kanan"


def analisis_postur_dari_landmarks(
    landmarks: List[Dict[str, float]],
    orientasi_override: Optional[str] = None
) -> Dict[str, Any]:
    """
    Menganalisis 33 landmarks MediaPipe untuk mengekstrak sudut leher,
    sudut punggung, level kemiringan bahu, dan status kelayakan postur.
    """
    if not landmarks or len(landmarks) < 25:
        return {
            "valid": False,
            "error": "Landmark tidak mencukupi (minimal 25 titik)",
            "sudut_leher": 0.0,
            "sudut_punggung": 0.0,
            "level_bahu": 0.0,
            "orientasi": "frontal",
            "status": "buruk",
        }

    orientasi = orientasi_override or deteksi_orientasi(landmarks)

    l_ear = (landmarks[PoseIndices.LEFT_EAR]["x"], landmarks[PoseIndices.LEFT_EAR]["y"])
    r_ear = (landmarks[PoseIndices.RIGHT_EAR]["x"], landmarks[PoseIndices.RIGHT_EAR]["y"])
    l_shoulder = (landmarks[PoseIndices.LEFT_SHOULDER]["x"], landmarks[PoseIndices.LEFT_SHOULDER]["y"])
    r_shoulder = (landmarks[PoseIndices.RIGHT_SHOULDER]["x"], landmarks[PoseIndices.RIGHT_SHOULDER]["y"])
    l_hip = (landmarks[PoseIndices.LEFT_HIP]["x"], landmarks[PoseIndices.LEFT_HIP]["y"])
    r_hip = (landmarks[PoseIndices.RIGHT_HIP]["x"], landmarks[PoseIndices.RIGHT_HIP]["y"])
    l_knee = (landmarks[PoseIndices.LEFT_KNEE]["x"], landmarks[PoseIndices.LEFT_KNEE]["y"])
    r_knee = (landmarks[PoseIndices.RIGHT_KNEE]["x"], landmarks[PoseIndices.RIGHT_KNEE]["y"])

    # Titik tengah (midpoint) untuk frontal
    mid_ear = ((l_ear[0] + r_ear[0]) / 2, (l_ear[1] + r_ear[1]) / 2)
    mid_shoulder = ((l_shoulder[0] + r_shoulder[0]) / 2, (l_shoulder[1] + r_shoulder[1]) / 2)
    mid_hip = ((l_hip[0] + r_hip[0]) / 2, (l_hip[1] + r_hip[1]) / 2)
    mid_knee = ((l_knee[0] + r_knee[0]) / 2, (l_knee[1] + r_knee[1]) / 2)

    # Level kemiringan bahu (Frontal): selisih vertikal dibagi lebar bahu
    shoulder_dist = math.hypot(r_shoulder[0] - l_shoulder[0], r_shoulder[1] - l_shoulder[1])
    if shoulder_dist > 1e-4:
        level_bahu = abs(r_shoulder[1] - l_shoulder[1]) / shoulder_dist
    else:
        level_bahu = 0.0

    if orientasi == "lateral_kiri":
        # Gunakan sisi kiri tubuh
        sudut_leher = hitung_sudut_3_titik(l_ear, l_shoulder, l_hip)
        sudut_punggung = hitung_sudut_3_titik(l_shoulder, l_hip, l_knee)
    elif orientasi == "lateral_kanan":
        # Gunakan sisi kanan tubuh
        sudut_leher = hitung_sudut_3_titik(r_ear, r_shoulder, r_hip)
        sudut_punggung = hitung_sudut_3_titik(r_shoulder, r_hip, r_knee)
    else:
        # Frontal: periksa kesejajaran kepala dan tegak tubuh
        sudut_leher = hitung_sudut_3_titik(mid_ear, mid_shoulder, mid_hip)
        sudut_punggung = hitung_sudut_3_titik(mid_shoulder, mid_hip, mid_knee)

    # Normalisasi sudut
    sudut_leher = round(float(sudut_leher), 2)
    sudut_punggung = round(float(sudut_punggung), 2)
    level_bahu = round(float(level_bahu), 4)

    return {
        "valid": True,
        "orientasi": orientasi,
        "sudut_leher": sudut_leher,
        "sudut_punggung": sudut_punggung,
        "level_bahu": level_bahu,
    }
