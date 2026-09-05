"""
GenPosFit — Database Migration Script (MySQL-compatible)
Menambahkan kolom baru yang mungkin belum ada di database lama (idempotent/upgrade safe).
Jalankan setelah container db siap:
    python database/run_migration.py
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
sys.path.insert(0, "/app")

from app.database import SessionLocal
from sqlalchemy import text


def column_exists(db, table: str, column: str) -> bool:
    res = db.execute(text(
        "SELECT COUNT(*) FROM information_schema.COLUMNS "
        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = :c"
    ), {"t": table, "c": column}).scalar()
    return (res or 0) > 0


def table_exists(db, table: str) -> bool:
    res = db.execute(text(
        "SELECT COUNT(*) FROM information_schema.TABLES "
        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t"
    ), {"t": table}).scalar()
    return (res or 0) > 0


def index_exists(db, table: str, index: str) -> bool:
    res = db.execute(text(
        "SELECT COUNT(*) FROM information_schema.STATISTICS "
        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND INDEX_NAME = :i"
    ), {"t": table, "i": index}).scalar()
    return (res or 0) > 0


def add_column(db, table, column, ddl):
    if column_exists(db, table, column):
        print(f"  · {table}.{column} — (sudah ada)")
        return True
    db.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))
    db.commit()
    print(f"  ✔ {table}.{column} ditambahkan")
    return True


def run():
    print("[migrate] Menjalankan migrasi database GenPosFit...")
    db = SessionLocal()
    try:
        if table_exists(db, "users"):
            if not column_exists(db, "users", "username"):
                db.execute(text("ALTER TABLE users ADD COLUMN username VARCHAR(50) NULL AFTER user_id"))
                db.execute(text("UPDATE users SET username = CONCAT('user_', user_id) WHERE username IS NULL"))
                db.execute(text("ALTER TABLE users MODIFY username VARCHAR(50) NOT NULL"))
                if not index_exists(db, "users", "uq_users_username"):
                    db.execute(text("ALTER TABLE users ADD UNIQUE INDEX uq_users_username (username)"))
                db.commit()
                print("  ✔ users.username (dengan unique index) ditambahkan")
            else:
                print("  · users.username — (sudah ada)")
            add_column(db, "users", "hashed_password",
                       "VARCHAR(255) NULL AFTER username")
            if column_exists(db, "users", "hashed_password"):
                db.execute(text(
                    "UPDATE users SET hashed_password = CONCAT('tmp_', MD5(CONCAT(user_id, NOW()))) "
                    "WHERE hashed_password IS NULL OR hashed_password = ''"
                ))
                db.execute(text("ALTER TABLE users MODIFY hashed_password VARCHAR(255) NOT NULL"))
                db.commit()
                print("  ✔ users.hashed_password (NOT NULL) dipastikan")
            add_column(db, "users", "role", "VARCHAR(20) DEFAULT 'user' AFTER jam_kerja_hari")
            add_column(db, "users", "poin", "INT DEFAULT 0 AFTER role")
            add_column(db, "users", "saldo", "DECIMAL(18,2) DEFAULT 0.00 AFTER poin")
        else:
            print("  · tabel users belum ada — migrasi dilewati")

        if not table_exists(db, "exercise_types"):
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS exercise_types (
                    type_id INT AUTO_INCREMENT PRIMARY KEY,
                    nama VARCHAR(100) NOT NULL,
                    deskripsi TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB
            """))
            db.commit()
            print("  ✔ exercise_types dibuat")
        else:
            print("  · exercise_types — (sudah ada)")

        if table_exists(db, "exercises"):
            add_column(db, "exercises", "skeleton_data", "JSON NULL AFTER sudut_target")
            add_column(db, "exercises", "sudut_leher", "DECIMAL(6,2) NULL AFTER skeleton_data")
            add_column(db, "exercises", "sudut_punggung", "DECIMAL(6,2) NULL AFTER sudut_leher")
            add_column(db, "exercises", "is_battle", "TINYINT DEFAULT 0 AFTER tingkat")
            if not column_exists(db, "exercises", "type_id"):
                # Add type_id column and FK (nullable — existing exercises get type_id = NULL)
                db.execute(text("""
                    ALTER TABLE exercises
                    ADD COLUMN type_id INT NULL AFTER exercise_id,
                    ADD INDEX idx_type_id (type_id),
                    ADD FOREIGN KEY fk_exercise_type (type_id) REFERENCES exercise_types(type_id) ON DELETE CASCADE
                """))
                db.commit()
                print("  ✔ exercises.type_id ditambahkan")
            else:
                print("  · exercises.type_id — (sudah ada)")
        else:
            print("  · tabel exercises belum ada — migrasi dilewati")

        if table_exists(db, "posture_logs"):
            add_column(db, "posture_logs", "kualitas_data", "DECIMAL(5,2) NULL AFTER status")
            if not index_exists(db, "posture_logs", "idx_posture_status"):
                db.execute(text("ALTER TABLE posture_logs ADD INDEX idx_posture_status (status)"))
                db.commit()
                print("  ✔ posture_logs.idx_posture_status ditambahkan")
        else:
            print("  · tabel posture_logs belum ada - migrasi dilewati")

        if table_exists(db, "rooms"):
            add_column(db, "rooms", "max_score", "INT NOT NULL DEFAULT 10 AFTER status")
            add_column(db, "rooms", "exercises_json", "JSON NULL AFTER max_score")
        else:
            print("  · tabel rooms belum ada — migrasi dilewati")

        # ---------- GAMIFIKASI + WALLET + GPC (misi, ledger, battle, reward) ----------
        add_column(db, "users", "wallet_address", "VARCHAR(42) NULL AFTER saldo")
        if not index_exists(db, "users", "uq_users_wallet"):
            try:
                db.execute(text("ALTER TABLE users ADD UNIQUE INDEX uq_users_wallet (wallet_address)"))
                db.commit()
                print("  ✔ users.uq_users_wallet dibuat")
            except Exception as exc:
                db.rollback()
                print(f"  · indeks wallet dilewati: {exc}")

        db.execute(text("""
            CREATE TABLE IF NOT EXISTS point_ledger (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                delta INT NOT NULL,
                alasan VARCHAR(50) NOT NULL,
                periode VARCHAR(7) NOT NULL,
                ref_tipe VARCHAR(30) NULL,
                ref_id INT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_ledger_user_periode (user_id, periode),
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB"""))
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS quests (
                quest_id INT AUTO_INCREMENT PRIMARY KEY,
                kode VARCHAR(50) NOT NULL UNIQUE,
                judul VARCHAR(120) NOT NULL,
                deskripsi VARCHAR(300) NULL,
                kategori VARCHAR(12) NOT NULL,
                metrik VARCHAR(50) NOT NULL,
                target INT NOT NULL DEFAULT 5,
                reward_poin INT NOT NULL DEFAULT 10,
                aktif TINYINT NOT NULL DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB
        """))
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS user_quests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                quest_id INT NOT NULL,
                periode VARCHAR(10) NOT NULL,
                progres INT NOT NULL DEFAULT 0,
                status VARCHAR(12) NOT NULL DEFAULT 'aktif',
                claimed_at DATETIME NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_user_quest_periode (user_id, quest_id, periode),
                INDEX idx_userquest_user (user_id, periode),
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (quest_id) REFERENCES quests(quest_id) ON DELETE CASCADE
            ) ENGINE=InnoDB
        """))
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS battle_results (
                id INT AUTO_INCREMENT PRIMARY KEY,
                battle_id VARCHAR(64) NOT NULL,
                room_code VARCHAR(20) NOT NULL,
                user_id INT NOT NULL,
                display_name VARCHAR(100) NULL,
                score_akhir INT NOT NULL DEFAULT 0,
                is_winner TINYINT NOT NULL DEFAULT 0,
                awarded_poin INT NOT NULL DEFAULT 0,
                quality_ok TINYINT NOT NULL DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_battle_participant (battle_id, user_id),
                INDEX idx_battle_room (room_code),
                INDEX idx_battle_user_time (user_id, created_at),
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB
        """))
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS gpc_reward_tx (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                periode VARCHAR(7) NOT NULL,
                user_id INT NOT NULL,
                `rank` INT NOT NULL,
                wallet_address VARCHAR(42) NOT NULL,
                jumlah DECIMAL(18,2) NOT NULL,
                tx_hash VARCHAR(80) NULL,
                status VARCHAR(16) NOT NULL DEFAULT 'pending',
                error TEXT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_gpc_periode_user (periode, user_id),
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB
        """))
        db.commit()
        print("  ✔ tabel gamifikasi/wallet/gpc terverifikasi")

        jumlah_quest = db.execute(text("SELECT COUNT(*) FROM quests")).scalar() or 0
        if jumlah_quest == 0:
            db.execute(text("""
                INSERT IGNORE INTO quests (kode, judul, deskripsi, kategori, metrik, target, reward_poin, aktif) VALUES
                ('postur_prima_harian','Postur Prima Harian','Kumpulkan 12 sampel postur berkualitas berstatus BAGUS hari ini.','harian','postur_bagus',12,10,1),
                ('terapi_bergerak_harian','Terapi Bergerak Harian','Selesaikan 2 sesi latihan terapi postur hari ini.','harian','latihan_selesai',2,10,1),
                ('kalibrasi_ulang','Baseline Segar','Perbarui kalibrasi pose baseline-mu minggu ini.','mingguan','kalibrasi',1,15,1),
                ('konsistensi_pekan','Konsistensi Sepekan','Pantau postur minimal 40 sampel berkualitas di pekan ini.','mingguan','postur_qty',40,30,1),
                ('duel_pilar','Duel Pilar Postur','Menangkan 1 battle multiplayer minggu ini.','mingguan','battle_menang',1,25,1)
            """))
            db.commit()
            print("  ✔ seed misi default dimasukkan")
        else:
            print(f"  · quests sudah ada ({jumlah_quest}) - seed dilewati")

        print("\n[migrate] Selesai.")
    except Exception as e:
        db.rollback()
        print(f"\n[migrate] ERROR: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    run()