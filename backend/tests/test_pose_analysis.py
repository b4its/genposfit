import unittest
from app.services.pose_analysis import hitung_sudut_3_titik, deteksi_orientasi, analisis_postur_dari_landmarks
from app.services.deviation_score import evaluasi_postur_lengkap


class TestPoseAnalysis(unittest.TestCase):

    def test_hitung_sudut_siku_siku(self):
        angle = hitung_sudut_3_titik((0, 1), (0, 0), (1, 0))
        self.assertAlmostEqual(angle, 90.0, places=4)

    def test_hitung_sudut_lurus(self):
        angle = hitung_sudut_3_titik((-1, 0), (0, 0), (1, 0))
        self.assertAlmostEqual(angle, 180.0, places=4)

    def test_analisis_postur_empty(self):
        res = analisis_postur_dari_landmarks([])
        self.assertFalse(res["valid"])

    def test_evaluasi_postur(self):
        eval_res = evaluasi_postur_lengkap(165.0, 170.0, 0.01)
        self.assertGreaterEqual(eval_res["skor_deviasi"], 85.0)
        self.assertEqual(eval_res["status"], "bagus")


if __name__ == "__main__":
    unittest.main()
