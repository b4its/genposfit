"""Util landmark sintetis 33 titik utk pengujian (format MediaPipe)."""
from typing import Dict, List, Optional


BASE_FRONTAL: Dict[int, Dict[str, float]] = {
    # hidung
    0: {"x": 0.50, "y": 0.22, "z": 0.0, "visibility": 0.98},
    # telinga kiri/kanan
    7: {"x": 0.44, "y": 0.26, "z": 0.0, "visibility": 0.97},
    8: {"x": 0.56, "y": 0.26, "z": 0.0, "visibility": 0.97},
    # bahu kiri/kanan
    11: {"x": 0.36, "y": 0.44, "z": 0.0, "visibility": 0.99},
    12: {"x": 0.64, "y": 0.44, "z": 0.0, "visibility": 0.99},
    # pinggul kiri/kanan
    23: {"x": 0.42, "y": 0.68, "z": 0.0, "visibility": 0.96},
    24: {"x": 0.58, "y": 0.68, "z": 0.0, "visibility": 0.96},
    # lutut kiri/kanan
    25: {"x": 0.42, "y": 0.95, "z": 0.0, "visibility": 0.90},
    26: {"x": 0.58, "y": 0.95, "z": 0.0, "visibility": 0.90},
}


def frontal_landmarks(knee_offset: float = 0.0) -> List[Dict[str, float]]:
    """Skeleton frontal berdiri tegak, semua kunci visibility tinggi."""
    lm: List[Dict[str, float]] = [
        {"x": 0.5, "y": 0.5, "z": 0.0, "visibility": 0.95} for _ in range(33)
    ]
    for idx, point in BASE_FRONTAL.items():
        lm[idx] = dict(point)
    lm[25]["x"] += knee_offset
    lm[26]["x"] += knee_offset
    return lm


def low_visibility_landmarks(visibilitas: float = 0.15) -> List[Dict[str, float]]:
    """Pose tegak frontal tapi keypoint utama hampir tidak terlihat (buram/oklusi)."""
    lm = frontal_landmarks()
    for idx in BASE_FRONTAL:
        lm[idx]["visibility"] = visibilitas
    return lm


def broken_landmarks() -> List[Dict[str, float]]:
    """Geometri anatomy mustahil: bahu DI BAWAH pinggul, wajah di luar bingkai."""
    lm = frontal_landmarks()
    lm[0]["x"] = -0.4
    lm[11]["y"] = 0.90  # bahu kiri di bawah pinggul
    lm[12]["y"] = 0.92
    lm[11]["x"] = 0.10  # bahu miring ekstrem
    return lm


def jitter_frames(n: int = 12, base: Optional[List] = None) -> List[List[Dict[str, float]]]:
    """Rangkaian frame dengan sudut leher melompat bolak-balik secara asimetris
    (deteksi getaran landmark / gerakan liar)."""
    frames: List[List[Dict[str, float]]] = []
    for i in range(n):
        lm = [dict(pt) for pt in (base or frontal_landmarks())]
        if i % 2:  # frame ganjil: kepala bergeser jauh ke satu sisi
            for idx in (0, 7, 8):
                lm[idx]["x"] += 0.22
        frames.append(lm)
    return frames


def shifted_landmarks(base: Optional[List[Dict[str, float]]] = None, dx: float = 0.0, dy: float = 0.0) -> List[Dict[str, float]]:
    src = base if base is not None else frontal_landmarks()
    return [{**p, "x": p["x"] + dx, "y": p["y"] + dy} for p in src]


def blank_landmarks() -> List[Dict[str, float]]:
    """33 titik kosong di tengah frame (buat referensi skeleton uji)."""
    return [{"x": 0.5, "y": 0.5, "z": 0.0, "visibility": 0.95} for _ in range(33)]


def low_quality_landmarks() -> List[Dict[str, float]]:
    """Alias dari low_visibility_landmarks."""
    return low_visibility_landmarks()


def broken_pose_landmarks() -> List[Dict[str, float]]:
    """Alias dari broken_landmarks."""
    return broken_landmarks()


def jitter_stream(n: int = 12) -> List[List[Dict[str, float]]]:
    """Alias dari jitter_frames."""
    return jitter_frames(n=n)
