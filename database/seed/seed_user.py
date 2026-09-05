"""
GenPosFit — Seed User & Dummy Data
Script to generate sample users, baseline posture calibrations, and logs for dev & testing.
"""
import os
import sys
import random
from datetime import datetime, timedelta

# Append backend directory if executed from host or container
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "..", "backend"))

try:
    from app.database import SessionLocal
    from app.models import User, PoseBaseline, PostureLog, Exercise, ExerciseSession
    from app.security import hash_password
except ImportError:
    # Alternative direct PyMySQL or standalone if backend models not reachable
    import hashlib

    def hash_password(pwd):
        return hashlib.sha256(pwd.encode()).hexdigest()

    import pymysql
    SessionLocal = None


def seed():
    print("🌱 Memulai seeding data user & dev logs...")

    if SessionLocal is not None:
        db = SessionLocal()
        try:
            # Check or create dummy user
            user = db.query(User).filter_by(email="developer@genposfit.local").first()
            if not user:
                user = User(
                    username="demouser",
                    hashed_password=hash_password("demo1234"),
                    nama="Alex Chandra (Dev Tester)",
                    email="developer@genposfit.local",
                    pekerjaan="Software Engineer",
                    jam_kerja_hari=8,
                )
                db.add(user)
                db.commit()
                db.refresh(user)
                print(f"✔ User dibuat: ID {user.user_id} - {user.nama} (username: demouser, password: demo1234)")
            else:
                print(f"ℹ User sudah ada: ID {user.user_id} - {user.nama}")

            # Create or promote admin user
            admin = db.query(User).filter_by(username="admin").first()
            if not admin:
                admin = User(
                    username="admin",
                    hashed_password=hash_password("admin1234"),
                    nama="Administrator GenPosFit",
                    email="admin@genposfit.local",
                    pekerjaan="System Administrator",
                    jam_kerja_hari=8,
                    role="admin",
                )
                db.add(admin)
                db.commit()
                db.refresh(admin)
                print(f"✔ Admin dibuat: {admin.nama} (username: admin, password: admin1234)")
            else:
                if admin.role != "admin":
                    admin.role = "admin"
                    db.commit()
                    print(f"✔ User {admin.username} ditingkatkan menjadi admin.")
                else:
                    print(f"ℹ Admin sudah ada: ID {admin.user_id} - {admin.nama}")

            # Baseline calibrations
            baselines = [
                {
                    "orientasi": "lateral_kiri",
                    "tipe_pose": "duduk_tegak",
                    "sudut_leher": 165.50,
                    "sudut_punggung": 172.00,
                    "level_bahu": 0.0150,
                    "std_leher": 1.450,
                    "std_punggung": 1.200,
                    "n_frame": 90,
                },
                {
                    "orientasi": "lateral_kiri",
                    "tipe_pose": "duduk_rileks",
                    "sudut_leher": 152.30,
                    "sudut_punggung": 164.00,
                    "level_bahu": 0.0210,
                    "std_leher": 2.100,
                    "std_punggung": 1.850,
                    "n_frame": 90,
                },
                {
                    "orientasi": "frontal",
                    "tipe_pose": "duduk_tegak",
                    "sudut_leher": 175.00,
                    "sudut_punggung": 178.00,
                    "level_bahu": 0.0080,
                    "std_leher": 0.950,
                    "std_punggung": 1.100,
                    "n_frame": 90,
                },
                {
                    "orientasi": "frontal",
                    "tipe_pose": "berdiri_tegak",
                    "sudut_leher": 172.00,
                    "sudut_punggung": 176.50,
                    "level_bahu": 0.0050,
                    "std_leher": 0.820,
                    "std_punggung": 0.910,
                    "n_frame": 90,
                },
            ]

            for b_data in baselines:
                existing = db.query(PoseBaseline).filter_by(
                    user_id=user.user_id,
                    orientasi=b_data["orientasi"],
                    tipe_pose=b_data["tipe_pose"],
                ).first()
                if not existing:
                    b_obj = PoseBaseline(user_id=user.user_id, **b_data)
                    db.add(b_obj)
            db.commit()
            print("✔ Baseline postur berhasil disimpan.")

            # Add sample posture logs over the last 24 hours
            existing_logs_count = db.query(PostureLog).filter_by(user_id=user.user_id).count()
            if existing_logs_count < 10:
                now = datetime.utcnow()
                sample_logs = []
                for i in range(25):
                    ts = now - timedelta(minutes=(25 - i) * 15)
                    # simulate slight posture deviations
                    dev_noise = random.uniform(-15.0, 10.0)
                    neck = max(130.0, min(175.0, 155.0 + dev_noise))
                    back = max(140.0, min(178.0, 166.0 + dev_noise * 0.7))
                    shoulder = round(random.uniform(0.005, 0.045), 4)

                    diff = abs(neck - 165.5)
                    if diff < 6:
                        score = 90 + random.uniform(0, 8)
                        status = "bagus"
                    elif diff < 15:
                        score = 70 + random.uniform(0, 15)
                        status = "ringan"
                    else:
                        score = 40 + random.uniform(0, 20)
                        status = "buruk"

                    log = PostureLog(
                        user_id=user.user_id,
                        sesi_id="demo-session-01",
                        timestamp=ts,
                        sudut_leher=round(neck, 2),
                        sudut_punggung=round(back, 2),
                        level_bahu=shoulder,
                        skor_deviasi=round(score, 2),
                        status=status,
                    )
                    sample_logs.append(log)

                db.bulk_save_objects(sample_logs)
                db.commit()
                print(f"✔ Ditambahkan {len(sample_logs)} sample posture logs.")

            # Exercise session
            first_ex = db.query(Exercise).first()
            if first_ex:
                sess = db.query(ExerciseSession).filter_by(user_id=user.user_id).first()
                if not sess:
                    db.add(ExerciseSession(
                        user_id=user.user_id,
                        exercise_id=first_ex.exercise_id,
                        total_reps=10,
                        avg_skor=92.5,
                        selesai_at=datetime.utcnow()
                    ))
                    db.commit()
                    print("✔ Exercise session sample dibuat.")

            print("✨ Seeding dummy selesai secara sukses!")

        finally:
            db.close()
    else:
        # Fallback PyMySQL
        db_user = os.getenv("DB_USER", "genposfit_user")
        db_pass = os.getenv("DB_PASSWORD", "genposfit_secret")
        db_host = os.getenv("DB_HOST", "127.0.0.1")
        db_port = int(os.getenv("DB_PORT", "3348"))
        db_name = os.getenv("DB_NAME", "genposfit")

        conn = pymysql.connect(
            host=db_host,
            user=db_user,
            password=db_pass,
            database=db_name,
            port=db_port,
            autocommit=True
        )
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO users (username, hashed_password, nama, email, pekerjaan, jam_kerja_hari)
                VALUES ('demouser', %s, 'Alex Chandra (Dev Tester)', 'developer@genposfit.local', 'Software Engineer', 8)
                ON DUPLICATE KEY UPDATE user_id=LAST_INSERT_ID(user_id);
            """, (hash_password("demo1234"),))
            user_id = cur.lastrowid
            print(f"✔ User ID: {user_id}")
        conn.close()


if __name__ == "__main__":
    seed()
