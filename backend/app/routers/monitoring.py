"""
GenPosFit — Endpoint Monitoring Live & Riwayat Postur
Menerima landmark MediaPipe via HTTP/WebSocket, menganalisis sudut & skor deviasi,
serta menyimpan log berkala ke MySQL.
"""
import json
import time
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db, SessionLocal
from app.models import User, PostureLog, PoseBaseline
from app.services.pose_analysis import analisis_postur_dari_landmarks
from app.services.deviation_score import ambil_baseline, evaluasi_postur_lengkap

router = APIRouter(prefix="/api/monitoring", tags=["Monitoring Postur"])


class LandmarkPoint(BaseModel):
    x: float
    y: float
    z: Optional[float] = 0.0
    visibility: Optional[float] = 1.0


class EvaluatePostureRequest(BaseModel):
    user_id: Optional[int] = 1
    landmarks: List[LandmarkPoint]
    tipe_pose: Optional[str] = "duduk_rileks"
    orientasi_override: Optional[str] = None
    simpan_ke_db: Optional[bool] = False
    sesi_id: Optional[str] = "default-session"


class LogPostureDirectRequest(BaseModel):
    user_id: int
    sesi_id: Optional[str] = None
    sudut_leher: float
    sudut_punggung: float
    level_bahu: Optional[float] = 0.0
    skor_deviasi: float
    status: str  # 'bagus', 'ringan', 'buruk'


@router.post("/evaluate")
def evaluate_posture(payload: EvaluatePostureRequest, db: Session = Depends(get_db)):
    """
    Evaluasi landmark tubuh saat ini (HTTP endpoint).
    Mengembalikan sudut leher, sudut punggung, level bahu, skor deviasi, dan status.
    """
    dict_landmarks = [lm.model_dump() for lm in payload.landmarks]
    analisis = analisis_postur_dari_landmarks(dict_landmarks, payload.orientasi_override)

    if not analisis.get("valid"):
        return {
            "valid": False,
            "error": analisis.get("error", "Data landmark tidak valid"),
            "status": "buruk",
            "skor_deviasi": 0.0,
        }

    user_id = payload.user_id or 1
    baseline = ambil_baseline(
        db,
        user_id=user_id,
        tipe_pose=payload.tipe_pose or "duduk_rileks",
        orientasi=analisis["orientasi"]
    )

    evaluasi = evaluasi_postur_lengkap(
        sudut_leher=analisis["sudut_leher"],
        sudut_punggung=analisis["sudut_punggung"],
        level_bahu=analisis["level_bahu"],
        baseline=baseline
    )

    # Simpan snapshot ke database jika diminta
    if payload.simpan_ke_db:
        # Cek apakah user valid di DB
        user_exists = db.query(User).filter_by(user_id=user_id).first()
        if user_exists:
            log_entry = PostureLog(
                user_id=user_id,
                sesi_id=payload.sesi_id,
                sudut_leher=analisis["sudut_leher"],
                sudut_punggung=analisis["sudut_punggung"],
                level_bahu=analisis["level_bahu"],
                skor_deviasi=evaluasi["skor_deviasi"],
                status=evaluasi["status"],
            )
            db.add(log_entry)
            db.commit()

    return {
        "valid": True,
        "orientasi": analisis["orientasi"],
        "sudut_leher": analisis["sudut_leher"],
        "sudut_punggung": analisis["sudut_punggung"],
        "level_bahu": analisis["level_bahu"],
        "skor_deviasi": evaluasi["skor_deviasi"],
        "skor_leher": evaluasi["skor_leher"],
        "skor_punggung": evaluasi["skor_punggung"],
        "status": evaluasi["status"],
        "feedback": evaluasi["feedback"],
        "baseline_terpakai": evaluasi["baseline_terpakai"],
    }


@router.post("/log")
def log_posture(payload: LogPostureDirectRequest, db: Session = Depends(get_db)):
    """Simpan log evaluasi postur secara manual/batch dari client."""
    user = db.query(User).filter_by(user_id=payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")

    entry = PostureLog(
        user_id=payload.user_id,
        sesi_id=payload.sesi_id,
        sudut_leher=payload.sudut_leher,
        sudut_punggung=payload.sudut_punggung,
        level_bahu=payload.level_bahu,
        skor_deviasi=payload.skor_deviasi,
        status=payload.status,
    )
    db.add(entry)
    db.commit()
    return {"message": "Log postur tersimpan", "id": entry.id}


@router.get("/summary/{user_id}")
def get_user_posture_summary(user_id: int, days: int = 7, db: Session = Depends(get_db)):
    """
    Statistik komprehensif riwayat postur user:
    - Rata-rata skor deviasi
    - Distribusi waktu status (bagus, ringan, buruk)
    - Timeline log harian
    """
    since_date = datetime.utcnow() - timedelta(days=days)
    logs = (
        db.query(PostureLog)
        .filter(PostureLog.user_id == user_id, PostureLog.timestamp >= since_date)
        .order_by(PostureLog.timestamp.asc())
        .all()
    )

    total_logs = len(logs)
    if total_logs == 0:
        return {
            "total_logs": 0,
            "avg_skor": 100.0,
            "distribusi": {"bagus": 0, "ringan": 0, "buruk": 0},
            "persentase_bagus": 100.0,
            "timeline": []
        }

    bagus_count = sum(1 for log in logs if log.status == "bagus")
    ringan_count = sum(1 for log in logs if log.status == "ringan")
    buruk_count = sum(1 for log in logs if log.status == "buruk")

    avg_skor = sum(float(log.skor_deviasi) for log in logs) / total_logs
    avg_leher = sum(float(log.sudut_leher) for log in logs) / total_logs
    avg_punggung = sum(float(log.sudut_punggung) for log in logs) / total_logs

    timeline = [
        {
            "id": l.id,
            "timestamp": l.timestamp.isoformat(),
            "skor": float(l.skor_deviasi),
            "sudut_leher": float(l.sudut_leher),
            "sudut_punggung": float(l.sudut_punggung),
            "status": l.status,
        }
        for l in logs[-60:]  # batasi 60 titik terbaru untuk grafik halus
    ]

    return {
        "total_logs": total_logs,
        "avg_skor": round(avg_skor, 1),
        "avg_leher": round(avg_leher, 1),
        "avg_punggung": round(avg_punggung, 1),
        "distribusi": {
            "bagus": bagus_count,
            "ringan": ringan_count,
            "buruk": buruk_count,
        },
        "persentase_bagus": round((bagus_count / total_logs) * 100.0, 1),
        "timeline": timeline,
    }


@router.websocket("/ws/{user_id}")
async def websocket_monitor_endpoint(websocket: WebSocket, user_id: int):
    """
    WebSocket endpoint untuk live monitoring berkecepatan tinggi (15-30 FPS).
    Menerima landmarks JSON secara streaming, menganalisis, mengembalikan skor instan,
    dan menyimpan snapshot ke DB setiap interval tertentu (misal: 60 frame atau 5 detik).
    """
    await websocket.accept()
    db = SessionLocal()
    frame_counter = 0
    last_db_save_time = time.time()

    try:
        # Load baseline user sekali saat koneksi terbuka
        user = db.query(User).filter_by(user_id=user_id).first()
        baseline = None
        if user:
            baseline = ambil_baseline(db, user_id=user_id)

        while True:
            text_data = await websocket.receive_text()
            try:
                data = json.loads(text_data)
            except Exception:
                continue

            landmarks = data.get("landmarks", [])
            tipe_pose = data.get("tipe_pose", "duduk_rileks")
            sesi_id = data.get("sesi_id", "live-session")

            analisis = analisis_postur_dari_landmarks(landmarks)
            if not analisis.get("valid"):
                await websocket.send_json({
                    "valid": False,
                    "error": "Pose tidak terdeteksi dengan jelas"
                })
                continue

            evaluasi = evaluasi_postur_lengkap(
                sudut_leher=analisis["sudut_leher"],
                sudut_punggung=analisis["sudut_punggung"],
                level_bahu=analisis["level_bahu"],
                baseline=baseline
            )

            # Persist ke DB setiap 60 frame atau 5 detik agar tidak membebani database
            frame_counter += 1
            now_time = time.time()
            if (now_time - last_db_save_time >= 5.0 or frame_counter % 60 == 0) and user:
                try:
                    entry = PostureLog(
                        user_id=user_id,
                        sesi_id=sesi_id,
                        sudut_leher=analisis["sudut_leher"],
                        sudut_punggung=analisis["sudut_punggung"],
                        level_bahu=analisis["level_bahu"],
                        skor_deviasi=evaluasi["skor_deviasi"],
                        status=evaluasi["status"],
                    )
                    db.add(entry)
                    db.commit()
                    last_db_save_time = now_time
                except Exception:
                    db.rollback()

            # Respon balik ke frontend secara realtime
            await websocket.send_json({
                "valid": True,
                "frame": frame_counter,
                "orientasi": analisis["orientasi"],
                "sudut_leher": analisis["sudut_leher"],
                "sudut_punggung": analisis["sudut_punggung"],
                "level_bahu": analisis["level_bahu"],
                "skor_deviasi": evaluasi["skor_deviasi"],
                "status": evaluasi["status"],
                "feedback": evaluasi["feedback"],
            })

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        pass
    finally:
        db.close()
