import unittest
from app.services.pose_analysis import hitung_sudut_3_titik, deteksi_orientasi, analisis_postur_dari_landmarks
from app.services.deviation_score import evaluasi_postur_lengkap


def test_hitung_sudut_siku_siku():
    # 90 degree angle: A=(0, 1), B=(0, 0), C=(1, 0)
    angle = hitung_sudut_3_titik((0, 1), (0, 0), (1, 0))
    assert abs(angle - 90.0) < 1e-4


def test_hitung_sudut_lurus():
    # 180 degree angle: A=(-1, 0), B=(0, 0), C=(1, 0)
    angle = hitung_sudut_3_titik((-1, 0), (0, 0), (1, 0))
    assert abs(angle - 180.0) < 1e-4


def test_analisis_postur_empty():
    res = analisis_postur_dari_landmarks([])
    assert res["valid"] is False


def test_evaluasi_postur():
    eval_res = evaluasi_postur_lengkap(165.0, 170.0, 0.01)
    assert eval_res["skor_deviasi"] >= 85.0
    assert eval_res["status"] == "bagus"


if __name__ == "__main__":
    test_hitung_sudut_siku_siku()
    test_hitung_sudut_lurus()
    test_analisis_postur_empty()
    test_evaluasi_postur()
    print("✔ All unit tests passed successfully!")
