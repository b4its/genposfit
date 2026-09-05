"""
GenPosFit — Endpoint Monitoring Live & Riwayat Postur
Menerima landmark MediaPipe via HTTP/WebSocket, menganalisis sudut & skor deviasi,
serta menyimpan log berkala ke MySQL.
"""
import json
import logging
import time
from collections import deque
from datetime import datetime, timedelta, timezone

def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)
from typing import List, Optional, Literal
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db, SessionLocal
from app.models import User, PostureLog, PoseBaseline
from app.services.pose_analysis import analisis_postur_dari_landmarks, analisis_kualitas_landmarks, AMBANG_SIMPAN
from app.services.deviation_score import ambil_baseline, evaluasi_postur_lengkap

router = APIRouter(prefix="/api/monitoring", tags=["Monitoring Postur"])

logger = logging.getLogger("genposfit.monitoring")


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
    sudut_leher: float = Field(..., ge=0.0, le=180.0)
    sudut_punggung: float = Field(..., ge=0.0, le=180.0)
    level_bahu: Optional[float] = 0.0
    skor_deviasi: float = Field(..., ge=0.0, le=100.0)
    status: Literal['bagus', 'ringan', 'buruk']
    kualitas_data: Optional[float] = Field(None, ge=0.0, le=100.0)


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

    kualitas = analisis_kualitas_landmarks(dict_landmarks)

    evaluasi = evaluasi_postur_lengkap(
        sudut_leher=analisis["sudut_leher"],
        sudut_punggung=analisis["sudut_punggung"],
        level_bahu=analisis["level_bahu"],
        baseline=baseline,
        kualitas_data=kualitas["kualitas"],
    )

    tersimpan = False
    # Simpan snapshot ke database jika diminta DAN kualitas data memenuhi ambang
    if payload.simpan_ke_db and kualitas["layak"]:
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
                kualitas_data=kualitas["kualitas"],
            )
            db.add(log_entry)
            db.commit()
            tersimpan = True

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
        "kualitas_data": kualitas,
        "tersimpan": tersimpan,
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
        kualitas_data=payload.kualitas_data,
    )
    db.add(entry)
    db.commit()
    return {"message": "Log postur tersimpan", "id": entry.id, "kualitas_data": payload.kualitas_data}


@router.get("/summary/{user_id}")
def get_user_posture_summary(user_id: int, days: int = 7, db: Session = Depends(get_db)):
    """
    Statistik komprehensif riwayat postur user:
    - Rata-rata skor deviasi
    - Distribusi waktu status (bagus, ringan, buruk)
    - Timeline log harian
    """
    since_date = utcnow() - timedelta(days=days)
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
            "kualitas": {"rata_kualitas": None, "persen_layak": None, "log_tanpa-nilai_kualitas": 0},
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
    nilai_kualitas = [float(log.kualitas_data) for log in logs if log.kualitas_data is not None]
    rata_kualitas = round(sum(nilai_kualitas) / len(nilai_kualitas), 1) if nilai_kualitas else None
    persen_layak = round(100.0 * sum(1 for q in nilai_kualitas if q >= AMBANG_SIMPAN) / len(logs), 1) if nilai_kualitas else None

    timeline = [
        {
            "id": l.id,
            "timestamp": l.timestamp.isoformat(),
            "skor": float(l.skor_deviasi),
            "sudut_leher": float(l.sudut_leher),
            "sudut_punggung": float(l.sudut_punggung),
            "status": l.status,
            "kualitas": float(l.kualitas_data) if l.kualitas_data is not None else None,
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
        "kualitas": {
            "rata_kualitas": rata_kualitas,
            "persen_layak": persen_layak,
            "log_tanpa-nilai_kualitas": total_logs - len(nilai_kualitas),
        },
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
    current_tipe_pose = "duduk_rileks"
    # Window sudut leher terakhir utk deteksi getaran (jitter) landmark
    riwayat_sudut = deque(maxlen=10)

    try:
        # Load baseline user sekali saat koneksi terbuka
        user = db.query(User).filter_by(user_id=user_id).first()
        baseline = None
        if user:
            baseline = ambil_baseline(db, user_id=user_id, tipe_pose=current_tipe_pose)

        while True:
            text_data = await websocket.receive_text()
            try:
                data = json.loads(text_data)
            except Exception:
                continue

            landmarks = data.get("landmarks", [])
            tipe_pose = data.get("tipe_pose", "duduk_rileks")
            sesi_id = data.get("sesi_id", "live-session")

            # Reload baseline if pose type changed
            if tipe_pose != current_tipe_pose and user:
                current_tipe_pose = tipe_pose
                baseline = ambil_baseline(db, user_id=user_id, tipe_pose=tipe_pose)

            analisis = analisis_postur_dari_landmarks(landmarks)
            if not analisis.get("valid"):
                await websocket.send_json({
                    "valid": False,
                    "error": "Pose tidak terdeteksi dengan jelas"
                })
                continue

            kualitas = analisis_kualitas_landmarks(landmarks)

            # Deteksi jitter: sudut leher antar-frame melompat ekstrem ->
            # landmark tidak stabil / bergoyang, kualitas diturunkan.
            riwayat_sudut.append(analisis["sudut_leher"])
            if len(riwayat_sudut) >= 6:
                rentang = max(riwayat_sudut) - min(riwayat_sudut)
                if rentang > 25.0:
                    kualitas["kualitas"] = max(0.0, kualitas["kualitas"] - 20.0)
                    kualitas["layak"] = kualitas["kualitas"] >= AMBANG_SIMPAN
                    kualitas["alasan"] = list(kualitas["alasan"]) + [
                        "sudut leher melompat tidak wajar antar frame (landmark goyah)"
                    ]

            evaluasi = evaluasi_postur_lengkap(
                sudut_leher=analisis["sudut_leher"],
                sudut_punggung=analisis["sudut_punggung"],
                level_bahu=analisis["level_bahu"],
                baseline=baseline,
                kualitas_data=kualitas["kualitas"],
            )

            # Persist ke DB setiap 60 frame atau 5 detik (hanya data yang layak)
            frame_counter += 1
            now_time = time.time()
            if (now_time - last_db_save_time >= 5.0 or frame_counter % 60 == 0) and user and kualitas["layak"]:
                try:
                    entry = PostureLog(
                        user_id=user_id,
                        sesi_id=sesi_id,
                        sudut_leher=analisis["sudut_leher"],
                        sudut_punggung=analisis["sudut_punggung"],
                        level_bahu=analisis["level_bahu"],
                        skor_deviasi=evaluasi["skor_deviasi"],
                        status=evaluasi["status"],
                        kualitas_data=kualitas["kualitas"],
                    )
                    db.add(entry)
                    db.commit()
                    last_db_save_time = now_time
                except Exception as exc:
                    db.rollback()
                    logger.error(f"Gagal menyimpan postur log: {exc}")

            # Respon balik ke frontend secara realtime
            await websocket.send_json({
                "valid": True,
                "frame": frame_counter,
                "orientasi": analisis["orientasi"],
                "sudut_leher": analisis["sudut_leher"],
                "sudut_punggung": analisis["sudut_punggung"],
                "level_bahu": analisis["level_bahu"],
                "skor_deviasi": evaluasi["skor_deviasi"],
                "skor_leher": evaluasi["skor_leher"],
                "skor_punggung": evaluasi["skor_punggung"],
                "status": evaluasi["status"],
                "feedback": evaluasi["feedback"],
                "kualitas_data": kualitas,
                "baseline_terpakai": evaluasi["baseline_terpakai"],
            })

    except WebSocketDisconnect:
        logger.info(f"WebSocket client {user_id} disconnected")
    except Exception as exc:
        logger.error(f"WebSocket error for user {user_id}: {exc}")
    finally:
        db.close()
