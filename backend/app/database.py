"""
GenPosFit — Koneksi Database (SQLAlchemy)
Mendukung koneksi MySQL via PyMySQL dengan retry/healthcheck.
"""
import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME

logger = logging.getLogger("genposfit.database")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"
)

DEV_MODE = os.getenv("DEV_MODE", "0") == "1"

try:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=3600,
        pool_size=10,
        max_overflow=20,
    )
except Exception as exc:
    if DATABASE_URL.startswith("sqlite"):
        # SQLite (in-memory) tidak mendukung opsi pooling MySQL
        engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    elif DEV_MODE:
        logger.warning(f"Gagal koneksi MySQL ({exc}). Fallback SQLite in-memory (DEV_MODE).")
        DATABASE_URL = "sqlite:///:memory:"
        engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    else:
        logger.error(f"Gagal inisialisasi engine MySQL: {exc}")
        raise

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency FastAPI untuk inject session database"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connection() -> bool:
    """Verifikasi koneksi aktif ke database"""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        return False
