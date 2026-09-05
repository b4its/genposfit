"""
GenPosFit — Database Migration Script (MySQL-compatible)
Menambahkan kolom baru yang mungkin belum ada di database lama (idempotent/upgrade safe).
Jalankan setelah container db siap:
    python database/run_migration.py
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

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

        if table_exists(db, "exercises"):
            add_column(db, "exercises", "skeleton_data", "JSON NULL AFTER sudut_target")
            add_column(db, "exercises", "sudut_leher", "DECIMAL(6,2) NULL AFTER skeleton_data")
            add_column(db, "exercises", "sudut_punggung", "DECIMAL(6,2) NULL AFTER sudut_leher")
            add_column(db, "exercises", "is_battle", "TINYINT DEFAULT 0 AFTER tingkat")
        else:
            print("  · tabel exercises belum ada — migrasi dilewati")

        if table_exists(db, "rooms"):
            add_column(db, "rooms", "max_score", "INT NOT NULL DEFAULT 10 AFTER status")
        else:
            print("  · tabel rooms belum ada — migrasi dilewati")

        print("\n[migrate] Selesai.")
    except Exception as e:
        db.rollback()
        print(f"\n[migrate] ERROR: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    run()