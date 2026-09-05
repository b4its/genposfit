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
    """Menghasilkan 33 normalized landmarks untuk gerakan terapi postur standar."""
    lms = _base_landmarks()

    if pose_name == "chin_tuck":
        # Kepala tegak lurus ditarik ke belakang, bahu sejajar rileks
        lms[0] = {"x": 0.50, "y": 0.23, "z": 0.0, "visibility": 0.98}  # nose
        lms[7] = {"x": 0.44, "y": 0.22, "z": 0.0, "visibility": 0.98}  # l_ear
        lms[8] = {"x": 0.56, "y": 0.22, "z": 0.0, "visibility": 0.98}  # r_ear
        lms[11] = {"x": 0.38, "y": 0.38, "z": 0.0, "visibility": 0.98} # l_shoulder
        lms[12] = {"x": 0.62, "y": 0.38, "z": 0.0, "visibility": 0.98} # r_shoulder
        lms[13] = {"x": 0.33, "y": 0.52, "z": 0.0, "visibility": 0.95} # l_elbow
        lms[14] = {"x": 0.67, "y": 0.52, "z": 0.0, "visibility": 0.95} # r_elbow
        lms[15] = {"x": 0.32, "y": 0.66, "z": 0.0, "visibility": 0.95} # l_wrist
        lms[16] = {"x": 0.68, "y": 0.66, "z": 0.0, "visibility": 0.95} # r_wrist
        lms[23] = {"x": 0.42, "y": 0.70, "z": 0.0, "visibility": 0.98} # l_hip
        lms[24] = {"x": 0.58, "y": 0.70, "z": 0.0, "visibility": 0.98} # r_hip
        lms[25] = {"x": 0.42, "y": 0.85, "z": 0.0, "visibility": 0.92} # l_knee
        lms[26] = {"x": 0.58, "y": 0.85, "z": 0.0, "visibility": 0.92} # r_knee
        lms[27] = {"x": 0.42, "y": 0.97, "z": 0.0, "visibility": 0.92} # l_ankle
        lms[28] = {"x": 0.58, "y": 0.97, "z": 0.0, "visibility": 0.92} # r_ankle

    elif pose_name == "neck_lateral":
        # Kepala miring ke samping (peregangan leher)
        lms[0] = {"x": 0.47, "y": 0.25, "z": 0.0, "visibility": 0.98}
        lms[7] = {"x": 0.41, "y": 0.22, "z": 0.0, "visibility": 0.98}
        lms[8] = {"x": 0.53, "y": 0.27, "z": 0.0, "visibility": 0.98}
        lms[11] = {"x": 0.38, "y": 0.39, "z": 0.0, "visibility": 0.98}
        lms[12] = {"x": 0.62, "y": 0.39, "z": 0.0, "visibility": 0.98}
        lms[13] = {"x": 0.34, "y": 0.53, "z": 0.0, "visibility": 0.95}
        lms[14] = {"x": 0.66, "y": 0.53, "z": 0.0, "visibility": 0.95}
        lms[15] = {"x": 0.33, "y": 0.67, "z": 0.0, "visibility": 0.95}
        lms[16] = {"x": 0.67, "y": 0.67, "z": 0.0, "visibility": 0.95}
        lms[23] = {"x": 0.42, "y": 0.70, "z": 0.0, "visibility": 0.98}
        lms[24] = {"x": 0.58, "y": 0.70, "z": 0.0, "visibility": 0.98}
        lms[25] = {"x": 0.42, "y": 0.85, "z": 0.0, "visibility": 0.92}
        lms[26] = {"x": 0.58, "y": 0.85, "z": 0.0, "visibility": 0.92}
        lms[27] = {"x": 0.42, "y": 0.97, "z": 0.0, "visibility": 0.92}
        lms[28] = {"x": 0.58, "y": 0.97, "z": 0.0, "visibility": 0.92}

    elif pose_name == "shoulder_squeeze":
        # Bahu ditarik ke belakang, siku ditekuk rapat ke rusuk
        lms[0] = {"x": 0.50, "y": 0.22, "z": 0.0, "visibility": 0.98}
        lms[7] = {"x": 0.44, "y": 0.21, "z": 0.0, "visibility": 0.98}
        lms[8] = {"x": 0.56, "y": 0.21, "z": 0.0, "visibility": 0.98}
        lms[11] = {"x": 0.37, "y": 0.37, "z": 0.0, "visibility": 0.98}
        lms[12] = {"x": 0.63, "y": 0.37, "z": 0.0, "visibility": 0.98}
        lms[13] = {"x": 0.32, "y": 0.49, "z": 0.0, "visibility": 0.95}
        lms[14] = {"x": 0.68, "y": 0.49, "z": 0.0, "visibility": 0.95}
        lms[15] = {"x": 0.30, "y": 0.45, "z": 0.0, "visibility": 0.95}
        lms[16] = {"x": 0.70, "y": 0.45, "z": 0.0, "visibility": 0.95}
        lms[23] = {"x": 0.42, "y": 0.69, "z": 0.0, "visibility": 0.98}
        lms[24] = {"x": 0.58, "y": 0.69, "z": 0.0, "visibility": 0.98}
        lms[25] = {"x": 0.42, "y": 0.85, "z": 0.0, "visibility": 0.92}
        lms[26] = {"x": 0.58, "y": 0.85, "z": 0.0, "visibility": 0.92}
        lms[27] = {"x": 0.42, "y": 0.97, "z": 0.0, "visibility": 0.92}
        lms[28] = {"x": 0.58, "y": 0.97, "z": 0.0, "visibility": 0.92}

    elif pose_name == "wall_angel":
        # Lengan dinaikkan membentuk sudut 90 derajat (W / sayap)
        lms[0] = {"x": 0.50, "y": 0.22, "z": 0.0, "visibility": 0.98}
        lms[7] = {"x": 0.44, "y": 0.21, "z": 0.0, "visibility": 0.98}
        lms[8] = {"x": 0.56, "y": 0.21, "z": 0.0, "visibility": 0.98}
        lms[11] = {"x": 0.38, "y": 0.38, "z": 0.0, "visibility": 0.98}
        lms[12] = {"x": 0.62, "y": 0.38, "z": 0.0, "visibility": 0.98}
        lms[13] = {"x": 0.28, "y": 0.36, "z": 0.0, "visibility": 0.95}
        lms[14] = {"x": 0.72, "y": 0.36, "z": 0.0, "visibility": 0.95}
        lms[15] = {"x": 0.26, "y": 0.22, "z": 0.0, "visibility": 0.95}
        lms[16] = {"x": 0.74, "y": 0.22, "z": 0.0, "visibility": 0.95}
        lms[23] = {"x": 0.43, "y": 0.70, "z": 0.0, "visibility": 0.98}
        lms[24] = {"x": 0.57, "y": 0.70, "z": 0.0, "visibility": 0.98}
        lms[25] = {"x": 0.43, "y": 0.85, "z": 0.0, "visibility": 0.92}
        lms[26] = {"x": 0.57, "y": 0.85, "z": 0.0, "visibility": 0.92}
        lms[27] = {"x": 0.43, "y": 0.97, "z": 0.0, "visibility": 0.92}
        lms[28] = {"x": 0.57, "y": 0.97, "z": 0.0, "visibility": 0.92}

    elif pose_name == "seated_back_extension":
        # Dada dibusungkan, tulang belakang dipanjangkan ke atas
        lms[0] = {"x": 0.50, "y": 0.21, "z": 0.0, "visibility": 0.98}
        lms[7] = {"x": 0.44, "y": 0.20, "z": 0.0, "visibility": 0.98}
        lms[8] = {"x": 0.56, "y": 0.20, "z": 0.0, "visibility": 0.98}
        lms[11] = {"x": 0.37, "y": 0.36, "z": 0.0, "visibility": 0.98}
        lms[12] = {"x": 0.63, "y": 0.36, "z": 0.0, "visibility": 0.98}
        lms[13] = {"x": 0.33, "y": 0.50, "z": 0.0, "visibility": 0.95}
        lms[14] = {"x": 0.67, "y": 0.50, "z": 0.0, "visibility": 0.95}
        lms[15] = {"x": 0.34, "y": 0.64, "z": 0.0, "visibility": 0.95}
        lms[16] = {"x": 0.66, "y": 0.64, "z": 0.0, "visibility": 0.95}
        lms[23] = {"x": 0.42, "y": 0.69, "z": 0.0, "visibility": 0.98}
        lms[24] = {"x": 0.58, "y": 0.69, "z": 0.0, "visibility": 0.98}
        lms[25] = {"x": 0.42, "y": 0.85, "z": 0.0, "visibility": 0.92}
        lms[26] = {"x": 0.58, "y": 0.85, "z": 0.0, "visibility": 0.92}
        lms[27] = {"x": 0.42, "y": 0.97, "z": 0.0, "visibility": 0.92}
        lms[28] = {"x": 0.58, "y": 0.97, "z": 0.0, "visibility": 0.92}

    else:
        # Default tegak netral
        lms[0] = {"x": 0.50, "y": 0.22, "z": 0.0, "visibility": 0.95}
        lms[7] = {"x": 0.44, "y": 0.22, "z": 0.0, "visibility": 0.95}
        lms[8] = {"x": 0.56, "y": 0.22, "z": 0.0, "visibility": 0.95}
        lms[11] = {"x": 0.38, "y": 0.38, "z": 0.0, "visibility": 0.95}
        lms[12] = {"x": 0.62, "y": 0.38, "z": 0.0, "visibility": 0.95}
        lms[13] = {"x": 0.32, "y": 0.52, "z": 0.0, "visibility": 0.9}
        lms[14] = {"x": 0.68, "y": 0.52, "z": 0.0, "visibility": 0.9}
        lms[15] = {"x": 0.30, "y": 0.66, "z": 0.0, "visibility": 0.9}
        lms[16] = {"x": 0.70, "y": 0.66, "z": 0.0, "visibility": 0.9}
        lms[23] = {"x": 0.43, "y": 0.70, "z": 0.0, "visibility": 0.95}
        lms[24] = {"x": 0.57, "y": 0.70, "z": 0.0, "visibility": 0.95}
        lms[25] = {"x": 0.43, "y": 0.85, "z": 0.0, "visibility": 0.9}
        lms[26] = {"x": 0.57, "y": 0.85, "z": 0.0, "visibility": 0.9}
        lms[27] = {"x": 0.43, "y": 0.96, "z": 0.0, "visibility": 0.9}
        lms[28] = {"x": 0.57, "y": 0.96, "z": 0.0, "visibility": 0.9}

    return lms


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
