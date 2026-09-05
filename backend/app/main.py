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
from app.database import engine, Base, check_db_connection
from app.routers import users, registration, monitoring, exercises

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("genposfit.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Pastikan tabel terbuat (jika belum melalui migration)
    logger.info("Memulai inisialisasi aplikasi GenPosFit...")
    try:
        Base.metadata.create_all(bind=engine)
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
app.include_router(users.router)
app.include_router(registration.router)
app.include_router(monitoring.router)
app.include_router(exercises.router)


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
