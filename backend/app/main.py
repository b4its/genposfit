"""
GenPosFit — FastAPI Entrypoint
Orkestrator API backend untuk registrasi pose, live posture monitoring,
latihan korektif, dan integrasi database MySQL.
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import CORS_ORIGINS
from app.database import engine, Base, check_db_connection, get_db
from sqlalchemy import text
from app.routers import users, registration, monitoring, exercises, auth, multiplayer, admin

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("genposfit.main")


# Kolom/indeks yang wajib ada; ditambahkan via ALTER TABLE jika belum ada
# (karena Base.metadata.create_all() TIDAK mengubah tabel yang sudah ada).
REQUIRED_COLUMNS = {
    "users": [
        ('poin', "INT DEFAULT 0"),
        ('saldo', "DECIMAL(18,2) DEFAULT 0.00"),
        ('role', "VARCHAR(20) DEFAULT 'user'"),
    ],
}


def run_column_migrations():
    """Aman dijalankan berkali-kali: menambah kolom yang belum ada pada tabel existing."""
    try:
        from sqlalchemy import inspect
        inspector = inspect(engine)
        existing_tables = {t for t in inspector.get_table_names() if t in REQUIRED_COLUMNS}
        for table, columns in REQUIRED_COLUMNS.items():
            if table not in existing_tables:
                continue
            existing_cols = {c["name"] for c in inspector.get_columns(table)}
            missing = [c for c in columns if c[0] not in existing_cols]
            for col_name, col_def in missing:
                sql = text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def}")
                with engine.begin() as conn:
                    conn.execute(sql)
                logger.info(f"✔ Migrasi: kolom {table}.{col_name} ditambahkan.")
    except Exception as exc:
        logger.warning(f"Migrasi kolom dilewati: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Pastikan tabel terbuat (jika belum melalui migration)
    logger.info("Memulai inisialisasi aplikasi GenPosFit...")
    try:
        Base.metadata.create_all(bind=engine)
        run_column_migrations()
        logger.info("✔ Tabel-tabel ORM terverifikasi.")
    except Exception as exc:
        logger.warning(f"Koneksi awal database tertunda: {exc}")

    yield

    logger.info("Mematikan server GenPosFit.")


app = FastAPI(
    title="GenPosFit: Genryphem Posture and Fit API",
    description="Backend API untuk analisis biomekanika postur tubuh berbasis MediaPipe, "
                "evaluasi ergonomi, kalibrasi baseline, dan rekomendasi latihan.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(registration.router)
app.include_router(monitoring.router)
app.include_router(exercises.router)
app.include_router(multiplayer.router)
app.include_router(admin.router)


@app.get("/")
def root():
    return {
        "app": "GenPosFit API",
        "version": "1.0.0",
        "status": "online",
        "docs": "/docs",
        "features": [
            "MediaPipe landmark analysis",
            "Personalized baseline calibration",
            "Real-time WebSocket posture evaluation",
            "Posture therapy & exercises"
        ]
    }


@app.get("/api/health")
def health_check():
    db_connected = check_db_connection()
    return {
        "status": "healthy" if db_connected else "degraded",
        "database": "connected" if db_connected else "disconnected",
        "service": "genposfit-backend"
    }
