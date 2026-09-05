"""Landmark sintetis 33 titik (format MediaPipe) untuk pengujian."""
from typing import Dict, List, Optional, Tuple


def blank_landmarks() -> List[Dict[str, float]]:
    return [{"x": 0.5, "y": 0.5, "z": 0.0, "visibility": 1.0} for _ in range(33)]


def frontal_landmarks(nose_offset_x: float = 0.0) -> List[Dict[str, float]]:
    """Berdiri tegak frontal. Hidung digeser maju = neck flexion."""
    lm = blank_landmarks()
    lm[0] = {"x": 0.5 + nose_offset_x, "y": 0.15, "z": 0.0, "visibility": 0.99}
    lm[7] = {"x": 0.46, "y": 0.18, "z": 0.0, "visibility": 0.99}   # left ear
    lm[8] = {"x": 0.54, "y": 0.18, "z": 0.0, "visibility": 0.99}   # right ear
    lm[11] = {"x": 0.35, "y": 0.40, "z": 0.0, "visibility": 0.99}  # left shoulder
    lm[12] = {"x": 0.65, "y": 0.40, "z": 0.0, "visibility": 0.99}  # right shoulder
    lm[23] = {"x": 0.40, "y": 0.70, "z": 0.0, "visibility": 0.99}  # left hip
    lm[24] = {"x": 0.60, "y": 0.70, "z": 0.0, "visibility": 0.99}  # right hip
    lm[25] = {"x": 0.40, "y": 0.90, "z": 0.0, "visibility": 0.99}  # left knee
    lm[26] = {"x": 0.60, "y": 0.90, "z": 0.0, "visibility": 0.99}  # right knee
    return lm


def low_quality_landmarks() -> List[Dict[str, float]]:
    """Pose frontal tapi visibilitas landmark kunci sangat rendah (blur/oklusi)."""
    lm = frontal_landmarks()
    for idx in (0, 7, 8, 11, 12, 23, 24):
        lm[idx]["visibility"] = 0.10
    return lm


def shifted_landmarks(base: List[Dict[str, float]], dx: float, dy: float) -> List[Dict[str, float]]:
    return [
        {**{k: v for k, v in p.items()}, "x": p["x"] + dx, "y": p["y"] + dy}
        for p in base
    ]
