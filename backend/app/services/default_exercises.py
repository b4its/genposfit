"""
GenPosFit — Default Exercise Seeder
Menyediakan set data latihan terapi postur standar lengkap dengan 33 titik MediaPipe skeleton data.
Dapat di-load otomatis jika database kosong, atau di-trigger oleh admin.
"""
from typing import Dict, List, Any
from sqlalchemy.orm import Session
from app.models import Exercise, ExerciseType
from app.services.pose_analysis import analisis_postur_dari_landmarks


def _base_landmarks() -> List[Dict[str, float]]:
    """Membuat 33 titik MediaPipe default dengan visibilitas 0.95."""
    return [{"x": 0.5, "y": 0.5, "z": 0.0, "visibility": 0.95} for _ in range(33)]


def generate_standard_skeleton(pose_name: str) -> List[Dict[str, float]]:
    """Menghasilkan 33 normalized landmarks untuk beragam variasi gerakan terapi postur standar."""
    lms = _base_landmarks()

    # Default netral berdiri tegak ergonomis
    lms[0] = {"x": 0.50, "y": 0.22, "z": 0.0, "visibility": 0.98}   # nose
    lms[7] = {"x": 0.44, "y": 0.21, "z": 0.0, "visibility": 0.98}   # l_ear
    lms[8] = {"x": 0.56, "y": 0.21, "z": 0.0, "visibility": 0.98}   # r_ear
    lms[11] = {"x": 0.38, "y": 0.38, "z": 0.0, "visibility": 0.98}  # l_shoulder
    lms[12] = {"x": 0.62, "y": 0.38, "z": 0.0, "visibility": 0.98}  # r_shoulder
    lms[13] = {"x": 0.32, "y": 0.52, "z": 0.0, "visibility": 0.95}  # l_elbow
    lms[14] = {"x": 0.68, "y": 0.52, "z": 0.0, "visibility": 0.95}  # r_elbow
    lms[15] = {"x": 0.30, "y": 0.66, "z": 0.0, "visibility": 0.95}  # l_wrist
    lms[16] = {"x": 0.70, "y": 0.66, "z": 0.0, "visibility": 0.95}  # r_wrist
    lms[23] = {"x": 0.42, "y": 0.70, "z": 0.0, "visibility": 0.98}  # l_hip
    lms[24] = {"x": 0.58, "y": 0.70, "z": 0.0, "visibility": 0.98}  # r_hip
    lms[25] = {"x": 0.42, "y": 0.85, "z": 0.0, "visibility": 0.92}  # l_knee
    lms[26] = {"x": 0.58, "y": 0.85, "z": 0.0, "visibility": 0.92}  # r_knee
    lms[27] = {"x": 0.42, "y": 0.97, "z": 0.0, "visibility": 0.92}  # l_ankle
    lms[28] = {"x": 0.58, "y": 0.97, "z": 0.0, "visibility": 0.92}  # r_ankle

    p = pose_name.lower()

    # Variasi posisi duduk
    if any(k in p for k in ["seated", "duduk", "chair", "desk", "figure_four", "twist"]):
        lms[23]["y"] = 0.72
        lms[24]["y"] = 0.72
        lms[25]["y"] = 0.82
        lms[26]["y"] = 0.82
        lms[27]["y"] = 0.96
        lms[28]["y"] = 0.96

    if "chin_tuck" in p:
        # Kepala tegak lurus ditarik ke belakang, leher servikal lurus
        lms[0] = {"x": 0.50, "y": 0.23, "z": 0.0, "visibility": 0.98}
        lms[7] = {"x": 0.44, "y": 0.22, "z": 0.0, "visibility": 0.98}
        lms[8] = {"x": 0.56, "y": 0.22, "z": 0.0, "visibility": 0.98}
        if "manual" in p or "res" in p:
            lms[16] = {"x": 0.52, "y": 0.28, "z": 0.0, "visibility": 0.95}

    elif "cervical_retract" in p:
        lms[0] = {"x": 0.50, "y": 0.20, "z": 0.0, "visibility": 0.98}
        lms[7] = {"x": 0.44, "y": 0.19, "z": 0.0, "visibility": 0.98}
        lms[8] = {"x": 0.56, "y": 0.19, "z": 0.0, "visibility": 0.98}

    elif "neck_lateral" in p or "lateral" in p:
        if "_r" in p or "kanan" in p:
            lms[0] = {"x": 0.53, "y": 0.25, "z": 0.0, "visibility": 0.98}
            lms[7] = {"x": 0.47, "y": 0.27, "z": 0.0, "visibility": 0.98}
            lms[8] = {"x": 0.59, "y": 0.22, "z": 0.0, "visibility": 0.98}
        else:
            lms[0] = {"x": 0.47, "y": 0.25, "z": 0.0, "visibility": 0.98}
            lms[7] = {"x": 0.41, "y": 0.22, "z": 0.0, "visibility": 0.98}
            lms[8] = {"x": 0.53, "y": 0.27, "z": 0.0, "visibility": 0.98}

    elif "levator" in p:
        lms[0] = {"x": 0.46, "y": 0.27, "z": 0.0, "visibility": 0.98}
        lms[7] = {"x": 0.40, "y": 0.24, "z": 0.0, "visibility": 0.98}
        lms[8] = {"x": 0.52, "y": 0.28, "z": 0.0, "visibility": 0.98}

    elif "upper_trap" in p:
        lms[11]["y"] = 0.42
        lms[0] = {"x": 0.53, "y": 0.24, "z": 0.0, "visibility": 0.98}

    elif "shoulder_squeeze" in p or "squeeze" in p:
        lms[13] = {"x": 0.32, "y": 0.49, "z": 0.0, "visibility": 0.95}
        lms[14] = {"x": 0.68, "y": 0.49, "z": 0.0, "visibility": 0.95}
        lms[15] = {"x": 0.30, "y": 0.45, "z": 0.0, "visibility": 0.95}
        lms[16] = {"x": 0.70, "y": 0.45, "z": 0.0, "visibility": 0.95}
        if "standing" in p:
            lms[15]["x"] = 0.27
            lms[16]["x"] = 0.73

    elif "wall_angel" in p:
        lms[13] = {"x": 0.28, "y": 0.36, "z": 0.0, "visibility": 0.95}
        lms[14] = {"x": 0.72, "y": 0.36, "z": 0.0, "visibility": 0.95}
        lms[15] = {"x": 0.26, "y": 0.22, "z": 0.0, "visibility": 0.95}
        lms[16] = {"x": 0.74, "y": 0.22, "z": 0.0, "visibility": 0.95}

    elif "wall_slide" in p:
        lms[13] = {"x": 0.34, "y": 0.34, "z": 0.0, "visibility": 0.95}
        lms[14] = {"x": 0.66, "y": 0.34, "z": 0.0, "visibility": 0.95}
        lms[15] = {"x": 0.34, "y": 0.20, "z": 0.0, "visibility": 0.95}
        lms[16] = {"x": 0.66, "y": 0.20, "z": 0.0, "visibility": 0.95}

    elif "doorway" in p:
        lms[13] = {"x": 0.25, "y": 0.37, "z": 0.0, "visibility": 0.95}
        lms[14] = {"x": 0.75, "y": 0.37, "z": 0.0, "visibility": 0.95}
        lms[15] = {"x": 0.24, "y": 0.24, "z": 0.0, "visibility": 0.95}
        lms[16] = {"x": 0.76, "y": 0.24, "z": 0.0, "visibility": 0.95}

    elif "ytw" in p:
        lms[13] = {"x": 0.28, "y": 0.26, "z": 0.0, "visibility": 0.95}
        lms[14] = {"x": 0.72, "y": 0.26, "z": 0.0, "visibility": 0.95}
        lms[15] = {"x": 0.20, "y": 0.12, "z": 0.0, "visibility": 0.95}
        lms[16] = {"x": 0.80, "y": 0.12, "z": 0.0, "visibility": 0.95}

    elif "cross_body" in p:
        lms[14] = {"x": 0.55, "y": 0.40, "z": 0.0, "visibility": 0.95}
        lms[16] = {"x": 0.32, "y": 0.38, "z": 0.0, "visibility": 0.95}

    elif "overhead" in p:
        lms[13] = {"x": 0.36, "y": 0.24, "z": 0.0, "visibility": 0.95}
        lms[14] = {"x": 0.64, "y": 0.24, "z": 0.0, "visibility": 0.95}
        lms[15] = {"x": 0.45, "y": 0.10, "z": 0.0, "visibility": 0.95}
        lms[16] = {"x": 0.55, "y": 0.10, "z": 0.0, "visibility": 0.95}

    elif "chest_opener" in p:
        lms[13] = {"x": 0.26, "y": 0.30, "z": 0.0, "visibility": 0.95}
        lms[14] = {"x": 0.74, "y": 0.30, "z": 0.0, "visibility": 0.95}
        lms[15] = {"x": 0.44, "y": 0.20, "z": 0.0, "visibility": 0.95}
        lms[16] = {"x": 0.56, "y": 0.20, "z": 0.0, "visibility": 0.95}

    elif "seated_back_extension" in p:
        lms[0] = {"x": 0.50, "y": 0.21, "z": 0.0, "visibility": 0.98}
        lms[11]["y"] = 0.36
        lms[12]["y"] = 0.36
        lms[13] = {"x": 0.33, "y": 0.50, "z": 0.0, "visibility": 0.95}
        lms[14] = {"x": 0.67, "y": 0.50, "z": 0.0, "visibility": 0.95}
        lms[15] = {"x": 0.34, "y": 0.64, "z": 0.0, "visibility": 0.95}
        lms[16] = {"x": 0.66, "y": 0.64, "z": 0.0, "visibility": 0.95}

    elif "standing_lumbar" in p:
        lms[13] = {"x": 0.36, "y": 0.58, "z": 0.0, "visibility": 0.95}
        lms[14] = {"x": 0.64, "y": 0.58, "z": 0.0, "visibility": 0.95}
        lms[15] = {"x": 0.40, "y": 0.68, "z": 0.0, "visibility": 0.95}
        lms[16] = {"x": 0.60, "y": 0.68, "z": 0.0, "visibility": 0.95}

    elif "cat_cow" in p or "bird_dog" in p:
        lms[11] = {"x": 0.35, "y": 0.45, "z": 0.0, "visibility": 0.95}
        lms[12] = {"x": 0.65, "y": 0.45, "z": 0.0, "visibility": 0.95}
        lms[15] = {"x": 0.35, "y": 0.70, "z": 0.0, "visibility": 0.95}
        lms[16] = {"x": 0.65, "y": 0.70, "z": 0.0, "visibility": 0.95}
        lms[23] = {"x": 0.40, "y": 0.55, "z": 0.0, "visibility": 0.95}
        lms[24] = {"x": 0.60, "y": 0.55, "z": 0.0, "visibility": 0.95}
        lms[25] = {"x": 0.40, "y": 0.80, "z": 0.0, "visibility": 0.95}
        lms[26] = {"x": 0.60, "y": 0.80, "z": 0.0, "visibility": 0.95}

    elif "wrist" in p:
        lms[13] = {"x": 0.35, "y": 0.42, "z": 0.0, "visibility": 0.95}
        lms[14] = {"x": 0.65, "y": 0.42, "z": 0.0, "visibility": 0.95}
        lms[15] = {"x": 0.38, "y": 0.44, "z": 0.0, "visibility": 0.95}
        lms[16] = {"x": 0.62, "y": 0.44, "z": 0.0, "visibility": 0.95}

    return lms


# =============================================================================
# KATALOG VARIASI LENGKAP PRESET GERAKAN TERAPI POSTUR (32 VARIASI KAYA)
# =============================================================================
EXERCISE_PRESET_VARIATIONS: List[Dict[str, Any]] = [
    # ---------------- 1. KOREKSI LEHER (8 VARIASI) ----------------
    {
        "preset_id": "chin_tuck_standard",
        "nama": "Chin Tuck Alignment (Berdiri)",
        "variasi": "Berdiri Ergonomis",
        "kategori_rekomendasi": "Koreksi Leher",
        "kategori_key": "leher",
        "posisi_tubuh": "berdiri",
        "orientasi_kamera": "frontal",
        "peralatan": "Tanpa Alat",
        "target_otot": "Deep cervical flexors (longus colli, longus capitis), Upper trapezius",
        "tingkat": "pemula",
        "durasi_detik": 5,
        "reps": 10,
        "is_battle": True,
        "sudut_leher": 168.0,
        "sudut_punggung": 175.0,
        "toleransi_derajat": 12,
        "ambang_akurasi": 75,
        "petunjuk_koreksi": "Tarik dagu lurus ke belakang sejajar leher tanpa menundukkan dagu ke dada.",
        "deskripsi": "Gerakan dasar meluruskan kelengkungan servikal leher dari posisi berdiri tegap.",
        "pose_key": "chin_tuck",
    },
    {
        "preset_id": "chin_tuck_desk",
        "nama": "Chin Tuck Kursi Kantor",
        "variasi": "Duduk di Kursi Kerja",
        "kategori_rekomendasi": "Koreksi Leher",
        "kategori_key": "leher",
        "posisi_tubuh": "duduk",
        "orientasi_kamera": "frontal",
        "peralatan": "Kursi Kerja",
        "target_otot": "Deep neck flexors, Scalenes anterior",
        "tingkat": "pemula",
        "durasi_detik": 5,
        "reps": 8,
        "is_battle": True,
        "sudut_leher": 168.0,
        "sudut_punggung": 176.0,
        "toleransi_derajat": 12,
        "ambang_akurasi": 75,
        "petunjuk_koreksi": "Duduk tegak bersandar di kursi, tarik dagu ke belakang seperti membuat lipatan dagu ganda.",
        "deskripsi": "Variasi chin tuck saat duduk di meja kerja untuk meredakan forward head posture akibat layar.",
        "pose_key": "chin_tuck_seated",
    },
    {
        "preset_id": "chin_tuck_manual_res",
        "nama": "Chin Tuck Tahanan Jari",
        "variasi": "Isometrik dengan Tahanan Tangan",
        "kategori_rekomendasi": "Koreksi Leher",
        "kategori_key": "leher",
        "posisi_tubuh": "duduk",
        "orientasi_kamera": "frontal",
        "peralatan": "Tanpa Alat",
        "target_otot": "Deep neck flexors, Suboccipital muscles",
        "tingkat": "menengah",
        "durasi_detik": 6,
        "reps": 6,
        "is_battle": True,
        "sudut_leher": 170.0,
        "sudut_punggung": 175.0,
        "toleransi_derajat": 10,
        "ambang_akurasi": 80,
        "petunjuk_koreksi": "Tempelkan dua jari di dagu, dorong kepala melawan jari secara lembut tanpa membungkuk.",
        "deskripsi": "Variasi resistensi manual untuk memperkuat stabilisator servikal dalam secara isometrik.",
        "pose_key": "chin_tuck_manual_res",
    },
    {
        "preset_id": "cervical_retract_ext",
        "nama": "Cervical Retraction & Extension",
        "variasi": "Dinamis Retraksi & Ekstensi",
        "kategori_rekomendasi": "Koreksi Leher",
        "kategori_key": "leher",
        "posisi_tubuh": "berdiri",
        "orientasi_kamera": "sagital_kanan",
        "peralatan": "Tanpa Alat",
        "target_otot": "Cervical extensors, Splenius capitis",
        "tingkat": "menengah",
        "durasi_detik": 6,
        "reps": 8,
        "is_battle": True,
        "sudut_leher": 165.0,
        "sudut_punggung": 174.0,
        "toleransi_derajat": 12,
        "ambang_akurasi": 75,
        "petunjuk_koreksi": "Tarik dagu ke belakang, lalu angkat kepala mendongak ke atas perlahan dengan kontrol halus.",
        "deskripsi": "Melatih mobilitas sendi leher bagian atas dan membuka diskus vertebra servikal.",
        "pose_key": "cervical_retract_ext",
    },
    {
        "preset_id": "neck_lateral_l",
        "nama": "Neck Lateral Stretch (Kiri)",
        "variasi": "Peregangan Lateral Sisi Kiri",
        "kategori_rekomendasi": "Koreksi Leher",
        "kategori_key": "leher",
        "posisi_tubuh": "duduk",
        "orientasi_kamera": "frontal",
        "peralatan": "Kursi Kerja",
        "target_otot": "Left Sternocleidomastoid, Scalenes",
        "tingkat": "pemula",
        "durasi_detik": 6,
        "reps": 6,
        "is_battle": True,
        "sudut_leher": 150.0,
        "sudut_punggung": 175.0,
        "toleransi_derajat": 15,
        "ambang_akurasi": 75,
        "petunjuk_koreksi": "Miringkan telinga kiri ke bahu kiri secara perlahan, jangan biarkan bahu kanan terangkat.",
        "deskripsi": "Melepaskan ketegangan otot leher bagian samping kiri akibat postur menengok monitor miring.",
        "pose_key": "neck_lateral_l",
    },
    {
        "preset_id": "neck_lateral_r",
        "nama": "Neck Lateral Stretch (Kanan)",
        "variasi": "Peregangan Lateral Sisi Kanan",
        "kategori_rekomendasi": "Koreksi Leher",
        "kategori_key": "leher",
        "posisi_tubuh": "duduk",
        "orientasi_kamera": "frontal",
        "peralatan": "Kursi Kerja",
        "target_otot": "Right Sternocleidomastoid, Scalenes",
        "tingkat": "pemula",
        "durasi_detik": 6,
        "reps": 6,
        "is_battle": True,
        "sudut_leher": 150.0,
        "sudut_punggung": 175.0,
        "toleransi_derajat": 15,
        "ambang_akurasi": 75,
        "petunjuk_koreksi": "Miringkan telinga kanan ke bahu kanan perlahan, pastikan bahu kiri rileks ke bawah.",
        "deskripsi": "Melepaskan ketegangan leher samping kanan untuk keseimbangan postur leher bilateral.",
        "pose_key": "neck_lateral_r",
    },
    {
        "preset_id": "levator_stretch",
        "nama": "Levator Scapulae Stretch",
        "variasi": "Peregangan Serong 45°",
        "kategori_rekomendasi": "Koreksi Leher",
        "kategori_key": "leher",
        "posisi_tubuh": "duduk",
        "orientasi_kamera": "oblique",
        "peralatan": "Tanpa Alat",
        "target_otot": "Levator scapulae, Posterior cervical muscles",
        "tingkat": "pemula",
        "durasi_detik": 7,
        "reps": 5,
        "is_battle": True,
        "sudut_leher": 155.0,
        "sudut_punggung": 172.0,
        "toleransi_derajat": 15,
        "ambang_akurasi": 70,
        "petunjuk_koreksi": "Tolehkan kepala 45 derajat ke kanan lalu tundukkan pandangan ke arah ketiak secara lembut.",
        "deskripsi": "Target spesifik untuk meredakan titik simpul kaku pada pangkal leher atas dan belikat.",
        "pose_key": "levator_stretch",
    },
    {
        "preset_id": "upper_trap_release",
        "nama": "Upper Trapezius Release",
        "variasi": "Depresi Bahu & Aksial",
        "kategori_rekomendasi": "Koreksi Leher",
        "kategori_key": "leher",
        "posisi_tubuh": "duduk",
        "orientasi_kamera": "frontal",
        "peralatan": "Kursi Kerja",
        "target_otot": "Upper trapezius, Levator scapulae",
        "tingkat": "pemula",
        "durasi_detik": 7,
        "reps": 5,
        "is_battle": True,
        "sudut_leher": 152.0,
        "sudut_punggung": 174.0,
        "toleransi_derajat": 12,
        "ambang_akurasi": 75,
        "petunjuk_koreksi": "Rendahkan bahu yang diregangkan ke arah lantai sambil meregangkan leher ke sisi sebaliknya.",
        "deskripsi": "Membongkar ketegangan bahu-leher yang kronis akibat stres kerja dan mengetik lama.",
        "pose_key": "upper_trap_release",
    },

    # ---------------- 2. KOREKSI BAHU & SKAPULA (8 VARIASI) ----------------
    {
        "preset_id": "shoulder_squeeze_standard",
        "nama": "Shoulder Blade Squeeze (Duduk)",
        "variasi": "Retraksi Skapula Duduk",
        "kategori_rekomendasi": "Koreksi Bahu",
        "kategori_key": "bahu",
        "posisi_tubuh": "duduk",
        "orientasi_kamera": "frontal",
        "peralatan": "Kursi Kerja",
        "target_otot": "Rhomboids major/minor, Middle trapezius",
        "tingkat": "pemula",
        "durasi_detik": 5,
        "reps": 10,
        "is_battle": True,
        "sudut_leher": 168.0,
        "sudut_punggung": 176.0,
        "toleransi_derajat": 12,
        "ambang_akurasi": 80,
        "petunjuk_koreksi": "Tarik kedua siku ke belakang dan dekatkan tulang belikat saling merapat ke arah tulang belakang.",
        "deskripsi": "Mengaktifkan otot punggung tengah untuk melawan postur bahu condong ke depan (rounded shoulders).",
        "pose_key": "shoulder_squeeze",
    },
    {
        "preset_id": "shoulder_squeeze_standing",
        "nama": "Standing Scapular & Chest Opener",
        "variasi": "Berdiri dengan Rotasi Eksternal",
        "kategori_rekomendasi": "Koreksi Bahu",
        "kategori_key": "bahu",
        "posisi_tubuh": "berdiri",
        "orientasi_kamera": "frontal",
        "peralatan": "Tanpa Alat",
        "target_otot": "Rhomboids, Infraspinatus, Pectoralis minor",
        "tingkat": "pemula",
        "durasi_detik": 6,
        "reps": 8,
        "is_battle": True,
        "sudut_leher": 170.0,
        "sudut_punggung": 175.0,
        "toleransi_derajat": 12,
        "ambang_akurasi": 78,
        "petunjuk_koreksi": "Buka telapak tangan ke luar, putar bahu ke belakang dan kencangkan belikat selama 6 detik.",
        "deskripsi": "Membuka rongga dada sekaligus mengencangkan retraktor bahu dari posisi berdiri.",
        "pose_key": "shoulder_squeeze_standing",
    },
    {
        "preset_id": "wall_angel",
        "nama": "Wall Angels (Malaikat Dinding 90°)",
        "variasi": "Bersandar Dinding Sudut 90°",
        "kategori_rekomendasi": "Koreksi Bahu",
        "kategori_key": "bahu",
        "posisi_tubuh": "dinding",
        "orientasi_kamera": "frontal",
        "peralatan": "Dinding Rata",
        "target_otot": "Lower trapezius, Serratus anterior, Rotator cuff",
        "tingkat": "menengah",
        "durasi_detik": 5,
        "reps": 8,
        "is_battle": True,
        "sudut_leher": 170.0,
        "sudut_punggung": 176.0,
        "toleransi_derajat": 12,
        "ambang_akurasi": 80,
        "petunjuk_koreksi": "Rapatkan punggung, siku, dan pergelangan tangan ke dinding sambil menggerakkan lengan naik-turun.",
        "deskripsi": "Latihan standar emas fisioterapi untuk mobilitas toraks dan aktivasi lower trapezius.",
        "pose_key": "wall_angel",
    },
    {
        "preset_id": "wall_slide",
        "nama": "Wall Slide Forearm",
        "variasi": "Luncuran Lengan Bawah Dinding",
        "kategori_rekomendasi": "Koreksi Bahu",
        "kategori_key": "bahu",
        "posisi_tubuh": "dinding",
        "orientasi_kamera": "frontal",
        "peralatan": "Dinding Rata",
        "target_otot": "Serratus anterior, Upper back",
        "tingkat": "menengah",
        "durasi_detik": 6,
        "reps": 8,
        "is_battle": True,
        "sudut_leher": 168.0,
        "sudut_punggung": 174.0,
        "toleransi_derajat": 15,
        "ambang_akurasi": 75,
        "petunjuk_koreksi": "Tempelkan lengan bawah vertikal ke dinding, dorong naik perlahan tanpa mengangkat bahu ke telinga.",
        "deskripsi": "Mengaktifkan serratus anterior untuk mencegah belikat bersayap (scapular winging).",
        "pose_key": "wall_slide",
    },
    {
        "preset_id": "doorway_stretch",
        "nama": "Doorway Pectoral Stretch",
        "variasi": "Peregangan Dada di Kusen Pintu",
        "kategori_rekomendasi": "Koreksi Bahu",
        "kategori_key": "bahu",
        "posisi_tubuh": "berdiri",
        "orientasi_kamera": "frontal",
        "peralatan": "Kusen Pintu / Dinding",
        "target_otot": "Pectoralis major & minor, Anterior deltoid",
        "tingkat": "pemula",
        "durasi_detik": 8,
        "reps": 6,
        "is_battle": True,
        "sudut_leher": 170.0,
        "sudut_punggung": 175.0,
        "toleransi_derajat": 15,
        "ambang_akurasi": 70,
        "petunjuk_koreksi": "Tempatkan siku pada kusen pintu, langkahkan satu kaki ke depan perlahan hingga dada terasa meregang.",
        "deskripsi": "Peregangan mendalam pada otot dada depan yang memendek akibat mengetik.",
        "pose_key": "doorway_stretch",
    },
    {
        "preset_id": "ytw_pose",
        "nama": "Y-T-W Posture Exercise",
        "variasi": "Tiga Tahap Huruf Y-T-W",
        "kategori_rekomendasi": "Koreksi Bahu",
        "kategori_key": "bahu",
        "posisi_tubuh": "berdiri",
        "orientasi_kamera": "frontal",
        "peralatan": "Tanpa Alat",
        "target_otot": "Lower/Middle trapezius, Infraspinatus, Deltoid posterior",
        "tingkat": "lanjut",
        "durasi_detik": 6,
        "reps": 6,
        "is_battle": True,
        "sudut_leher": 170.0,
        "sudut_punggung": 176.0,
        "toleransi_derajat": 14,
        "ambang_akurasi": 78,
        "petunjuk_koreksi": "Bentuk huruf Y dengan tangan diagonal ke atas, lalu turunkan ke T mendatar, dan tarik ke W.",
        "deskripsi": "Protokol komprehensif memperkuat seluruh rantai posterior korset bahu.",
        "pose_key": "ytw_pose",
    },
    {
        "preset_id": "cross_body_shoulder",
        "nama": "Cross-Body Shoulder Stretch",
        "variasi": "Peregangan Bahu Melintang",
        "kategori_rekomendasi": "Koreksi Bahu",
        "kategori_key": "bahu",
        "posisi_tubuh": "duduk",
        "orientasi_kamera": "frontal",
        "peralatan": "Tanpa Alat",
        "target_otot": "Posterior deltoid, Infraspinatus, Teres minor",
        "tingkat": "pemula",
        "durasi_detik": 7,
        "reps": 5,
        "is_battle": True,
        "sudut_leher": 168.0,
        "sudut_punggung": 174.0,
        "toleransi_derajat": 15,
        "ambang_akurasi": 72,
        "petunjuk_koreksi": "Tarik lengan lurus melintasi dada dengan bantuan tangan lainnya tanpa memutar pinggang.",
        "deskripsi": "Melepaskan kapsul sendi bahu bagian belakang untuk memperluas jangkauan gerak bahu.",
        "pose_key": "cross_body_shoulder",
    },
    {
        "preset_id": "overhead_reach",
        "nama": "Overhead Lat & Shoulder Reach",
        "variasi": "Rentang Lengan ke Atas",
        "kategori_rekomendasi": "Koreksi Bahu",
        "kategori_key": "bahu",
        "posisi_tubuh": "berdiri",
        "orientasi_kamera": "frontal",
        "peralatan": "Tanpa Alat",
        "target_otot": "Latissimus dorsi, Thoracic erectors, Triceps",
        "tingkat": "pemula",
        "durasi_detik": 6,
        "reps": 8,
        "is_battle": True,
        "sudut_leher": 172.0,
        "sudut_punggung": 178.0,
        "toleransi_derajat": 12,
        "ambang_akurasi": 78,
        "petunjuk_koreksi": "Jalin jari kedua tangan lalu dorong telapak tangan ke atas langit-langit sambil menarik napas dalam.",
        "deskripsi": "Mendekompresi sendi bahu dan memanjangkan tulang belakang toraks secara simultan.",
        "pose_key": "overhead_reach",
    },

    # ---------------- 3. KOREKSI PUNGGUNG & TULANG BELAKANG (8 VARIASI) ----------------
    {
        "preset_id": "seated_back_extension",
        "nama": "Seated Back Extension",
        "variasi": "Ekstensi Punggung Duduk",
        "kategori_rekomendasi": "Koreksi Punggung",
        "kategori_key": "punggung",
        "posisi_tubuh": "duduk",
        "orientasi_kamera": "frontal",
        "peralatan": "Kursi Kerja",
        "target_otot": "Erector spinae, Thoracic extensors",
        "tingkat": "pemula",
        "durasi_detik": 6,
        "reps": 8,
        "is_battle": True,
        "sudut_leher": 168.0,
        "sudut_punggung": 176.0,
        "toleransi_derajat": 12,
        "ambang_akurasi": 75,
        "petunjuk_koreksi": "Duduk tegak, letakkan tangan di punggung bawah, busungkan dada ke depan dan rentangkan punggung ke atas.",
        "deskripsi": "Mengembalikan lordosis fisiologis punggung bawah setelah berjam-jam duduk melengkung.",
        "pose_key": "seated_back_extension",
    },
    {
        "preset_id": "standing_lumbar_ext",
        "nama": "Standing Lumbar Extension (McKenzie)",
        "variasi": "Ekstensi Pinggang Berdiri",
        "kategori_rekomendasi": "Koreksi Punggung",
        "kategori_key": "punggung",
        "posisi_tubuh": "berdiri",
        "orientasi_kamera": "sagital_kanan",
        "peralatan": "Tanpa Alat",
        "target_otot": "Lumbar erector spinae, Anterior abdominal fascia",
        "tingkat": "pemula",
        "durasi_detik": 5,
        "reps": 8,
        "is_battle": True,
        "sudut_leher": 166.0,
        "sudut_punggung": 172.0,
        "toleransi_derajat": 14,
        "ambang_akurasi": 75,
        "petunjuk_koreksi": "Letakkan telapak tangan di pinggang belakang, dorong panggul sedikit ke depan dan lengkungkan punggung secara lembut.",
        "deskripsi": "Protokol McKenzie terbukti klinis untuk mengurangi tekanan pada bantalan diskus lumbar L4-S1.",
        "pose_key": "standing_lumbar_ext",
    },
    {
        "preset_id": "cat_cow",
        "nama": "Cat-Cow Spine Mobilization",
        "variasi": "Fleksi-Ekstensi di Matras",
        "kategori_rekomendasi": "Koreksi Punggung",
        "kategori_key": "punggung",
        "posisi_tubuh": "matras",
        "orientasi_kamera": "sagital_kanan",
        "peralatan": "Matras Olahraga",
        "target_otot": "Entire spinal erector group, Multifidus, Abdominals",
        "tingkat": "pemula",
        "durasi_detik": 5,
        "reps": 10,
        "is_battle": True,
        "sudut_leher": 165.0,
        "sudut_punggung": 170.0,
        "toleransi_derajat": 15,
        "ambang_akurasi": 70,
        "petunjuk_koreksi": "Di posisi merangkak: tarik napas sambil melengkungkan punggung ke bawah (Cow), buang napas sambil membulatkan punggung ke atas (Cat).",
        "deskripsi": "Mobilisasi berirama untuk melumasi seluruh persendian facet tulang belakang dari leher hingga pinggang.",
        "pose_key": "cat_cow",
    },
    {
        "preset_id": "seated_twist",
        "nama": "Seated Spinal Gentle Rotation",
        "variasi": "Rotasi Halus Kursi Kerja",
        "kategori_rekomendasi": "Koreksi Punggung",
        "kategori_key": "punggung",
        "posisi_tubuh": "duduk",
        "orientasi_kamera": "frontal",
        "peralatan": "Kursi Kerja",
        "target_otot": "Internal & external obliques, Thoracic rotators",
        "tingkat": "pemula",
        "durasi_detik": 6,
        "reps": 6,
        "is_battle": True,
        "sudut_leher": 168.0,
        "sudut_punggung": 175.0,
        "toleransi_derajat": 12,
        "ambang_akurasi": 75,
        "petunjuk_koreksi": "Duduk tegak sempurna, putar torso perlahan ke satu sisi sambil memegang sandaran tangan kursi.",
        "deskripsi": "Meningkatkan mobilitas rotasi vertebra torakalis tanpa membebani lumbar.",
        "pose_key": "seated_twist",
    },
    {
        "preset_id": "bird_dog",
        "nama": "Bird-Dog Core & Spine Stabilization",
        "variasi": "Keseimbangan Diagonal Matras",
        "kategori_rekomendasi": "Koreksi Punggung",
        "kategori_key": "punggung",
        "posisi_tubuh": "matras",
        "orientasi_kamera": "sagital_kanan",
        "peralatan": "Matras Olahraga",
        "target_otot": "Multifidus, Gluteus maximus, Transverse abdominis",
        "tingkat": "menengah",
        "durasi_detik": 5,
        "reps": 8,
        "is_battle": True,
        "sudut_leher": 168.0,
        "sudut_punggung": 176.0,
        "toleransi_derajat": 12,
        "ambang_akurasi": 78,
        "petunjuk_koreksi": "Rentangkan tangan kiri ke depan dan kaki kanan lurus ke belakang sejajar punggung, tahan tanpa goyang.",
        "deskripsi": "Latihan McGill Big 3 untuk mengunci stabilitas inti tubuh dan mencegah nyeri punggung berulang.",
        "pose_key": "bird_dog",
    },
    {
        "preset_id": "child_pose",
        "nama": "Child's Pose Spinal Decompression",
        "variasi": "Dekompresi Pasif Matras",
        "kategori_rekomendasi": "Koreksi Punggung",
        "kategori_key": "punggung",
        "posisi_tubuh": "matras",
        "orientasi_kamera": "sagital_kanan",
        "peralatan": "Matras Olahraga",
        "target_otot": "Latissimus dorsi, Paraspinal extensors, Hip extensors",
        "tingkat": "pemula",
        "durasi_detik": 10,
        "reps": 4,
        "is_battle": True,
        "sudut_leher": 160.0,
        "sudut_punggung": 168.0,
        "toleransi_derajat": 18,
        "ambang_akurasi": 65,
        "petunjuk_koreksi": "Duduk di atas tumit, julurkan kedua tangan jauh ke depan di lantai, rilekskan kening ke matras.",
        "deskripsi": "Meregangkan seluruh rantai punggung secara pasif untuk relaksasi mendalam di akhir sesi.",
        "pose_key": "child_pose",
    },
    {
        "preset_id": "cobra_pose",
        "nama": "Sphinx / Cobra Gentle Extension",
        "variasi": "Tengkurap Ekstensi Toraks",
        "kategori_rekomendasi": "Koreksi Punggung",
        "kategori_key": "punggung",
        "posisi_tubuh": "tengkurap",
        "orientasi_kamera": "sagital_kanan",
        "peralatan": "Matras Olahraga",
        "target_otot": "Thoracic extensors, Anterior abdominal wall",
        "tingkat": "menengah",
        "durasi_detik": 8,
        "reps": 5,
        "is_battle": True,
        "sudut_leher": 165.0,
        "sudut_punggung": 170.0,
        "toleransi_derajat": 15,
        "ambang_akurasi": 72,
        "petunjuk_koreksi": "Tengkurap, topang tubuh bagian atas dengan siku di bawah bahu, angkat dada perlahan ke depan atas.",
        "deskripsi": "Menguatkan ekstensor torakolumbar dengan aman tanpa memberi beban aksial berlebih.",
        "pose_key": "cobra_pose",
    },
    {
        "preset_id": "pelvic_tilt",
        "nama": "Pelvic Tilt Lumbar Alignment",
        "variasi": "Kontrol Kemiringan Panggul",
        "kategori_rekomendasi": "Koreksi Punggung",
        "kategori_key": "punggung",
        "posisi_tubuh": "matras",
        "orientasi_kamera": "sagital_kanan",
        "peralatan": "Matras Olahraga",
        "target_otot": "Rectus abdominis, Gluteus maximus, Lumbar stabilizers",
        "tingkat": "pemula",
        "durasi_detik": 5,
        "reps": 10,
        "is_battle": True,
        "sudut_leher": 170.0,
        "sudut_punggung": 178.0,
        "toleransi_derajat": 12,
        "ambang_akurasi": 75,
        "petunjuk_koreksi": "Kencangkan perut bagian bawah, ratakan punggung bawah ke matras, lalu kembalikan ke posisi netral.",
        "deskripsi": "Melatih kesadaran posisi netral panggul untuk mengatasi anterior atau posterior pelvic tilt.",
        "pose_key": "pelvic_tilt",
    },

    # ---------------- 4. KOREKSI PINGGUL & KAKI (4 VARIASI) ----------------
    {
        "preset_id": "figure_four",
        "nama": "Seated Figure-4 Piriformis Stretch",
        "variasi": "Silang Lutut Duduk di Kursi",
        "kategori_rekomendasi": "Koreksi Pinggul",
        "kategori_key": "pinggul",
        "posisi_tubuh": "duduk",
        "orientasi_kamera": "frontal",
        "peralatan": "Kursi Kerja",
        "target_otot": "Piriformis, Gluteus medius, Deep hip rotators",
        "tingkat": "pemula",
        "durasi_detik": 8,
        "reps": 5,
        "is_battle": True,
        "sudut_leher": 168.0,
        "sudut_punggung": 174.0,
        "toleransi_derajat": 14,
        "ambang_akurasi": 72,
        "petunjuk_koreksi": "Letakkan pergelangan kaki kanan di atas lutut kiri, condongkan dada ke depan dengan punggung tetap lurus.",
        "deskripsi": "Melegakan otot piriformis yang menekan saraf skiatik akibat terlalu lama duduk.",
        "pose_key": "figure_four",
    },
    {
        "preset_id": "hip_flexor_lunge",
        "nama": "Standing Hip Flexor Lunge",
        "variasi": "Lunge Berdiri Peregangan Pinggul",
        "kategori_rekomendasi": "Koreksi Pinggul",
        "kategori_key": "pinggul",
        "posisi_tubuh": "berdiri",
        "orientasi_kamera": "sagital_kanan",
        "peralatan": "Tanpa Alat",
        "target_otot": "Iliopsoas, Rectus femoris",
        "tingkat": "menengah",
        "durasi_detik": 7,
        "reps": 6,
        "is_battle": True,
        "sudut_leher": 168.0,
        "sudut_punggung": 175.0,
        "toleransi_derajat": 14,
        "ambang_akurasi": 74,
        "petunjuk_koreksi": "Langkahkan satu kaki ke depan, tekuk lutut, tegakkan tubuh dan dorong panggul ke depan perlahan.",
        "deskripsi": "Memanjangkan otot fleksor pinggul yang memendek kaku karena posisi duduk seharian.",
        "pose_key": "hip_flexor_lunge",
    },
    {
        "preset_id": "chair_squat",
        "nama": "Ergonomic Chair Squat (Sit-to-Stand)",
        "variasi": "Fungsional Duduk-Berdiri Kursi",
        "kategori_rekomendasi": "Koreksi Pinggul",
        "kategori_key": "pinggul",
        "posisi_tubuh": "berdiri",
        "orientasi_kamera": "sagital_kanan",
        "peralatan": "Kursi Kerja",
        "target_otot": "Quadriceps, Gluteus maximus, Hamstrings",
        "tingkat": "pemula",
        "durasi_detik": 4,
        "reps": 10,
        "is_battle": True,
        "sudut_leher": 166.0,
        "sudut_punggung": 172.0,
        "toleransi_derajat": 15,
        "ambang_akurasi": 75,
        "petunjuk_koreksi": "Berdiri tegak dari kursi lalu turunkan pinggul kembali seolah menyentuh kursi tanpa menghempas.",
        "deskripsi": "Melatih mekanisme rantai kinetik duduk-berdiri dengan beban terbagi rata di panggul dan lutut.",
        "pose_key": "chair_squat",
    },
    {
        "preset_id": "calf_raise",
        "nama": "Standing Calf & Posture Balance",
        "variasi": "Jinjit Keseimbangan Postur",
        "kategori_rekomendasi": "Koreksi Pinggul",
        "kategori_key": "pinggul",
        "posisi_tubuh": "berdiri",
        "orientasi_kamera": "frontal",
        "peralatan": "Tanpa Alat",
        "target_otot": "Gastrocnemius, Soleus, Tibialis posterior",
        "tingkat": "pemula",
        "durasi_detik": 3,
        "reps": 12,
        "is_battle": True,
        "sudut_leher": 170.0,
        "sudut_punggung": 176.0,
        "toleransi_derajat": 12,
        "ambang_akurasi": 80,
        "petunjuk_koreksi": "Angkat kedua tumit jinjit setinggi mungkin dengan tubuh tegak tegak lurus, tahan di puncak 3 detik.",
        "deskripsi": "Meningkatkan sirkulasi darah vena tungkai bawah dan menyelaraskan penumpuan beban telapak kaki.",
        "pose_key": "calf_raise",
    },

    # ---------------- 5. ERGONOMI KANTOR & MEJA KERJA (4 VARIASI) ----------------
    {
        "preset_id": "desk_reset",
        "nama": "Desk Posture 30-Second Reset",
        "variasi": "Reset Cepat Ergonomi Meja",
        "kategori_rekomendasi": "Ergonomi Meja Kerja",
        "kategori_key": "kantor",
        "posisi_tubuh": "duduk",
        "orientasi_kamera": "frontal",
        "peralatan": "Kursi Kerja",
        "target_otot": "Full upper postural kinetic chain (cervical, scapular, thoracic)",
        "tingkat": "pemula",
        "durasi_detik": 10,
        "reps": 3,
        "is_battle": True,
        "sudut_leher": 170.0,
        "sudut_punggung": 176.0,
        "toleransi_derajat": 12,
        "ambang_akurasi": 80,
        "petunjuk_koreksi": "Duduk tegak, tarik dagu ke belakang, jatuhkan bahu rileks ke bawah, tarik napas dalam diafragma.",
        "deskripsi": "Protokol reset 30 detik di sela-sela jam kerja untuk menyegarkan postur dan konsentrasi kerja.",
        "pose_key": "desk_reset",
    },
    {
        "preset_id": "wrist_stretch",
        "nama": "Wrist Extensor & Flexor Stretch",
        "variasi": "Pencegahan RSI/CTS Mengetik",
        "kategori_rekomendasi": "Ergonomi Meja Kerja",
        "kategori_key": "kantor",
        "posisi_tubuh": "duduk",
        "orientasi_kamera": "frontal",
        "peralatan": "Meja Kerja",
        "target_otot": "Wrist flexors and extensors, Pronator teres",
        "tingkat": "pemula",
        "durasi_detik": 6,
        "reps": 8,
        "is_battle": True,
        "sudut_leher": 168.0,
        "sudut_punggung": 174.0,
        "toleransi_derajat": 14,
        "ambang_akurasi": 75,
        "petunjuk_koreksi": "Rentangkan satu tangan ke depan, gunakan tangan lain untuk menarik telapak tangan ke belakang perlahan.",
        "deskripsi": "Mencegah carpal tunnel syndrome dan kelelahan tendon pergelangan tangan pada pengguna mouse & keyboard.",
        "pose_key": "wrist_stretch",
    },
    {
        "preset_id": "chest_opener_desk",
        "nama": "Seated Hands-Behind-Head Chest Opener",
        "variasi": "Buka Rongga Dada Duduk",
        "kategori_rekomendasi": "Ergonomi Meja Kerja",
        "kategori_key": "kantor",
        "posisi_tubuh": "duduk",
        "orientasi_kamera": "frontal",
        "peralatan": "Kursi Kerja",
        "target_otot": "Pectoralis major, Anterior deltoid, Intercostals",
        "tingkat": "pemula",
        "durasi_detik": 7,
        "reps": 6,
        "is_battle": True,
        "sudut_leher": 170.0,
        "sudut_punggung": 176.0,
        "toleransi_derajat": 12,
        "ambang_akurasi": 78,
        "petunjuk_koreksi": "Letakkan kedua tangan di belakang kepala, rentangkan siku selebar mungkin ke belakang sambil membusungkan dada.",
        "deskripsi": "Mengembalikan kapasitas ekspansi rongga toraks setelah duduk membungkuk di depan komputer.",
        "pose_key": "chest_opener",
    },
    {
        "preset_id": "hamstring_chair",
        "nama": "Hamstring Seated Chair Reach",
        "variasi": "Paha Belakang Kursi Kerja",
        "kategori_rekomendasi": "Ergonomi Meja Kerja",
        "kategori_key": "kantor",
        "posisi_tubuh": "duduk",
        "orientasi_kamera": "sagital_kanan",
        "peralatan": "Kursi Kerja",
        "target_otot": "Biceps femoris, Semitendinosus, Gastrocnemius",
        "tingkat": "pemula",
        "durasi_detik": 8,
        "reps": 5,
        "is_battle": True,
        "sudut_leher": 166.0,
        "sudut_punggung": 172.0,
        "toleransi_derajat": 15,
        "ambang_akurasi": 70,
        "petunjuk_koreksi": "Duduk di ujung kursi, luruskan satu kaki ke depan dengan tumit di lantai, condongkan dada ke arah jari kaki.",
        "deskripsi": "Melepaskan ketegangan hamstring dan mengurangi tarikan posterior pada tulang ekor dan lumbar.",
        "pose_key": "hamstring_stretch",
    },
]


def get_all_exercise_presets() -> List[Dict[str, Any]]:
    """
    Mengembalikan katalog lengkap 32 variasi gerakan terapi ilmiah
    lengkap dengan skeleton_data (33 MediaPipe landmarks) dan sudut_target metadata.
    """
    presets_output: List[Dict[str, Any]] = []

    for item in EXERCISE_PRESET_VARIATIONS:
        p = dict(item)
        skeleton = generate_standard_skeleton(p["pose_key"])
        p["skeleton_data"] = skeleton

        analisis = analisis_postur_dari_landmarks(skeleton)
        if analisis.get("valid"):
            p["sudut_leher"] = p.get("sudut_leher") or analisis["sudut_leher"]
            p["sudut_punggung"] = p.get("sudut_punggung") or analisis["sudut_punggung"]

        p["sudut_target"] = {
            "sudut_leher": p["sudut_leher"],
            "sudut_punggung": p["sudut_punggung"],
            "toleransi_derajat": p.get("toleransi_derajat", 15),
            "ambang_akurasi": p.get("ambang_akurasi", 75),
            "orientasi_kamera": p.get("orientasi_kamera", "frontal"),
            "posisi_tubuh": p.get("posisi_tubuh", "berdiri"),
            "variasi_gerakan": p.get("variasi", "Standar"),
            "peralatan": p.get("peralatan", "Tanpa Alat"),
            "petunjuk_koreksi": p.get("petunjuk_koreksi", "Pertahankan postur tegak ergonomis."),
        }

        presets_output.append(p)

    return presets_output


DEFAULT_TYPES_DATA = [
    {
        "nama": "Koreksi Leher",
        "deskripsi": "Latihan untuk menguatkan dan meluruskan posisi leher & kepala",
        "exercises": [
            {
                "nama": "Chin Tuck Alignment",
                "deskripsi": "Tarik dagu ke belakang sejajar leher, tahan posisi tegak lurus selama 5 detik untuk meluruskan servikal.",
                "target_otot": "Deep neck flexors, Upper trapezius",
                "durasi_detik": 5,
                "reps": 10,
                "tingkat": "pemula",
                "is_battle": True,
                "pose_key": "chin_tuck",
            },
            {
                "nama": "Neck Lateral Stretch",
                "deskripsi": "Miringkan kepala perlahan ke sisi bahu berlawanan, regangkan otot leher lateral secara teratur.",
                "target_otot": "Sternocleidomastoid, Scalenes",
                "durasi_detik": 6,
                "reps": 6,
                "tingkat": "pemula",
                "is_battle": True,
                "pose_key": "neck_lateral",
            },
        ],
    },
    {
        "nama": "Koreksi Bahu",
        "deskripsi": "Latihan untuk peregangan, mobilisasi, dan postur bahu",
        "exercises": [
            {
                "nama": "Shoulder Blade Squeeze",
                "deskripsi": "Tarik kedua bahu ke belakang lalu rapatkan tulang belikat ke arah tulang belakang.",
                "target_otot": "Rhomboids, Middle trapezius",
                "durasi_detik": 5,
                "reps": 10,
                "tingkat": "pemula",
                "is_battle": True,
                "pose_key": "shoulder_squeeze",
            },
            {
                "nama": "Wall Angel",
                "deskripsi": "Angkat kedua siku membentuk sudut 90 derajat menyerupai sayap malaikat, gerakkan naik-turun perlahan.",
                "target_otot": "Upper back, Serratus anterior",
                "durasi_detik": 5,
                "reps": 8,
                "tingkat": "menengah",
                "is_battle": True,
                "pose_key": "wall_angel",
            },
        ],
    },
    {
        "nama": "Koreksi Punggung",
        "deskripsi": "Latihan untuk memperbaiki postur punggung & tulang belakang toraks",
        "exercises": [
            {
                "nama": "Seated Back Extension",
                "deskripsi": "Duduk tegak, busungkan dada ke depan dan rentangkan tulang belakang ke atas, tahan posisi.",
                "target_otot": "Erector spinae, Thoracic extensors",
                "durasi_detik": 6,
                "reps": 8,
                "tingkat": "pemula",
                "is_battle": True,
                "pose_key": "seated_back_extension",
            },
        ],
    },
]


def seed_default_exercises(db: Session, force: bool = False) -> Dict[str, Any]:
    """
    Menyimpan atau memperbarui latihan default dengan skeleton data.
    Jika force=True, perbarui juga data skeleton pada latihan yang skeletonnya masih null.
    """
    created_types = 0
    created_exercises = 0
    updated_exercises = 0

    for t_data in DEFAULT_TYPES_DATA:
        ex_type = db.query(ExerciseType).filter_by(nama=t_data["nama"]).first()
        if not ex_type:
            ex_type = ExerciseType(nama=t_data["nama"], deskripsi=t_data["deskripsi"])
            db.add(ex_type)
            db.commit()
            db.refresh(ex_type)
            created_types += 1

        for e_data in t_data["exercises"]:
            existing = db.query(Exercise).filter_by(type_id=ex_type.type_id, nama=e_data["nama"]).first()
            skeleton = generate_standard_skeleton(e_data["pose_key"])
            analisis = analisis_postur_dari_landmarks(skeleton)

            sudut_leher = analisis["sudut_leher"] if analisis.get("valid") else 168.0
            sudut_punggung = analisis["sudut_punggung"] if analisis.get("valid") else 174.0

            if not existing:
                # Cek barangkali nama serupa
                existing_by_name = db.query(Exercise).filter_by(nama=e_data["nama"]).first()
                if existing_by_name:
                    existing_by_name.type_id = ex_type.type_id
                    if force or existing_by_name.skeleton_data is None:
                        existing_by_name.skeleton_data = skeleton
                        existing_by_name.sudut_leher = sudut_leher
                        existing_by_name.sudut_punggung = sudut_punggung
                        existing_by_name.is_battle = True
                        updated_exercises += 1
                    continue

                ex = Exercise(
                    type_id=ex_type.type_id,
                    nama=e_data["nama"],
                    deskripsi=e_data["deskripsi"],
                    target_otot=e_data["target_otot"],
                    sudut_target={"sudut_leher": sudut_leher, "sudut_punggung": sudut_punggung},
                    skeleton_data=skeleton,
                    sudut_leher=sudut_leher,
                    sudut_punggung=sudut_punggung,
                    durasi_detik=e_data["durasi_detik"],
                    reps=e_data["reps"],
                    tingkat=e_data["tingkat"],
                    is_battle=e_data["is_battle"],
                )
                db.add(ex)
                created_exercises += 1
            else:
                if force or existing.skeleton_data is None:
                    existing.skeleton_data = skeleton
                    existing.sudut_leher = sudut_leher
                    existing.sudut_punggung = sudut_punggung
                    existing.is_battle = True
                    updated_exercises += 1

    # Perbarui juga latihan lama tanpa skeleton jika ada di database
    old_exercises = db.query(Exercise).filter(Exercise.skeleton_data.is_(None)).all()
    for oe in old_exercises:
        k = "chin_tuck"
        if "wall" in oe.nama.lower(): k = "wall_angel"
        elif "shoulder" in oe.nama.lower(): k = "shoulder_squeeze"
        elif "back" in oe.nama.lower() or "extension" in oe.nama.lower(): k = "seated_back_extension"
        elif "lateral" in oe.nama.lower() or "side" in oe.nama.lower(): k = "neck_lateral"

        skel = generate_standard_skeleton(k)
        an = analisis_postur_dari_landmarks(skel)
        oe.skeleton_data = skel
        oe.sudut_leher = an["sudut_leher"] if an.get("valid") else 168.0
        oe.sudut_punggung = an["sudut_punggung"] if an.get("valid") else 174.0
        oe.is_battle = True
        updated_exercises += 1

    db.commit()
    return {
        "created_types": created_types,
        "created_exercises": created_exercises,
        "updated_exercises": updated_exercises,
        "total_exercises": db.query(Exercise).count(),
    }
