"""Monitoring postur: evaluate HTTP, /log, /summary, dan WebSocket live."""
from helpers_landmarks import frontal_landmarks, low_visibility_landmarks, broken_landmarks, jitter_frames


def test_evaluate_posture_valid(client, user):
    r = client.post("/api/monitoring/evaluate", json={
        "user_id": user.user_id,
        "landmarks": frontal_landmarks(),
        "tipe_pose": "duduk_rileks",
        "simpan_ke_db": False,
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["valid"] is True
    assert body["status"] in ("bagus", "ringan", "buruk")
    assert 0 <= body["skor_deviasi"] <= 100
    assert body["orientasi"] == "frontal"


def test_evaluate_posture_too_few_landmarks(client):
    r = client.post("/api/monitoring/evaluate", json={
        "user_id": 999,
        "landmarks": [{"x": 0.1, "y": 0.2}] * 5,
    })
    assert r.status_code == 200
    assert r.json()["valid"] is False


def test_evaluate_saves_log_when_requested(client, user):
    r = client.post("/api/monitoring/evaluate", json={
        "user_id": user.user_id,
        "landmarks": frontal_landmarks(),
        "simpan_ke_db": True,
        "sesi_id": "unit-test",
    })
    assert r.status_code == 200
    s = client.get(f"/api/monitoring/summary/{user.user_id}?days=7").json()
    assert s["total_logs"] == 1


def test_log_posture_requires_angles(client, user):
    r = client.post("/api/monitoring/log", json={
        "user_id": user.user_id, "status": "bagus",
    })
    assert r.status_code == 422


def test_log_posture_rejects_unknown_user(client):
    r = client.post("/api/monitoring/log", json={
        "user_id": 12345, "sudut_leher": 160, "sudut_punggung": 170,
        "skor_deviasi": 90, "status": "bagus",
    })
    assert r.status_code == 404


def test_log_and_summary_flow(client, user):
    for status in ["bagus", "bagus", "ringan", "buruk"]:
        r = client.post("/api/monitoring/log", json={
            "user_id": user.user_id,
            "sesi_id": "flow",
            "sudut_leher": 164.5,
            "sudut_punggung": 171.2,
            "skor_deviasi": 87.0,
            "status": status,
        })
        assert r.status_code == 200, r.text
    s = client.get(f"/api/monitoring/summary/{user.user_id}?days=7").json()
    assert s["total_logs"] == 4
    assert s["distribusi"]["bagus"] == 2
    assert s["persentase_bagus"] == 50.0


def test_summary_empty_user(client, user):
    s = client.get(f"/api/monitoring/summary/{user.user_id}?days=7").json()
    assert s["total_logs"] == 0
    assert s["avg_skor"] == 100.0


def test_websocket_monitor_roundtrip(client, user):
    with client.websocket_connect(f"/api/monitoring/ws/{user.user_id}") as ws:
        ws.send_json({"landmarks": frontal_landmarks(), "tipe_pose": "duduk_rileks"})
        data = ws.receive_json()
        assert data["valid"] is True
        assert data["status"] in ("bagus", "ringan", "buruk")
        ws.send_json({"landmarks": [{"x": 0.1, "y": 0.2}] * 3, "tipe_pose": "duduk_rileks"})
        bad = ws.receive_json()
        assert bad["valid"] is False


# ---------- Tahap 2: penguatan kualitas data kondisi terkini ----------

def test_evaluate_exposes_kualitas_data(client, user):
    r = client.post("/api/monitoring/evaluate", json={
        "user_id": user.user_id,
        "landmarks": frontal_landmarks(),
    })
    body = r.json()
    k = body["kualitas_data"]
    assert k["layak"] is True
    assert k["kualitas"] >= 80.0


def test_evaluate_low_quality_not_saved(client, user):
    r = client.post("/api/monitoring/evaluate", json={
        "user_id": user.user_id,
        "landmarks": low_visibility_landmarks(),
        "simpan_ke_db": True,
    })
    body = r.json()
    assert body["kualitas_data"]["kualitas"] < 55.0
    assert body["tersimpan"] is False
    s = client.get(f"/api/monitoring/summary/{user.user_id}").json()
    assert s["total_logs"] == 0


def test_evaluate_impossible_anatomy_gate(client, user):
    r = client.post("/api/monitoring/evaluate", json={
        "user_id": user.user_id,
        "landmarks": broken_landmarks(),
        "simpan_ke_db": True,
    })
    body = r.json()
    assert body["tersimpan"] is False
    alasan = " ".join(body["kualitas_data"]["alasan"])
    assert "bahu" in alasan.lower() or "bingkai" in alasan.lower()


def test_direct_log_accepts_kualitas_data(client, user):
    r = client.post("/api/monitoring/log", json={
        "user_id": user.user_id,
        "sesi_id": "quality",
        "sudut_leher": 162.0,
        "sudut_punggung": 168.0,
        "skor_deviasi": 91.0,
        "status": "bagus",
        "kualitas_data": 93.5,
    })
    assert r.status_code == 200
    assert r.json()["kualitas_data"] == 93.5


def test_summary_reports_kualitas(client, user):
    client.post("/api/monitoring/evaluate", json={
        "user_id": user.user_id, "landmarks": frontal_landmarks(), "simpan_ke_db": True,
    })
    client.post("/api/monitoring/evaluate", json={
        "user_id": user.user_id, "landmarks": low_visibility_landmarks(), "simpan_ke_db": True,
    })
    s = client.get(f"/api/monitoring/summary/{user.user_id}").json()
    assert s["total_logs"] == 1
    assert s["kualitas"]["rata_kualitas"] >= 80.0


def test_ws_exposes_kualitas_data(client, user):
    with client.websocket_connect(f"/api/monitoring/ws/{user.user_id}") as ws:
        ws.send_json({"landmarks": low_visibility_landmarks(), "tipe_pose": "duduk_rileks"})
        msg = ws.receive_json()
        assert msg["kualitas_data"]["layak"] is False


def test_ws_jitter_detection(client, user):
    """Frame dengan sudut leher melompat-lompat -> kualitas turun + alasan jitter."""
    with client.websocket_connect(f"/api/monitoring/ws/{user.user_id}") as ws:
        last = None
        for frame in jitter_frames(n=12):
            ws.send_json({"landmarks": frame, "tipe_pose": "duduk_rileks"})
            last = ws.receive_json()
        assert last is not None
        assert last["kualitas_data"]["layak"] is False or last["kualitas_data"]["kualitas"] < 80.0


def test_stale_baseline_lowers_confidence(client, user, db_session, admin):
    """Baseline berumur >30 hari membuat evaluasi menandai perlu kalibrasi ulang."""
    from datetime import datetime, timedelta, timezone
    from app.models import PoseBaseline
    old = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=90)
    db_session.add(PoseBaseline(
        user_id=user.user_id, orientasi="frontal", tipe_pose="duduk_rileks",
        sudut_leher=178.5, sudut_punggung=178.0, level_bahu=0.01,
        std_leher=2.0, std_punggung=2.0, n_frame=120, recorded_at=old,
    ))
    db_session.commit()
    r = client.post("/api/monitoring/evaluate", json={
        "user_id": user.user_id, "landmarks": frontal_landmarks(),
    })
    body = r.json()
    assert body["baseline_terpakai"]["is_calibrated"] is True
    assert body["baseline_terpakai"]["usia_hari"] >= 89
    assert body["baseline_terpakai"]["status_referensi"] == "kedaluwarsa"
    assert body["baseline_terpakai"]["pelonggaran_faktor"] > 2.0
    # baseline basi + data berkualitas penuh -> skor tetap tinggi (tidak menghukum)
    assert body["skor_deviasi"] >= 80.0


def test_log_rejects_out_of_range(client, user):
    r = client.post("/api/monitoring/log", json={
        "user_id": user.user_id,
        "sudut_leher": 162.0,
        "sudut_punggung": 400.0,   # mustahil
        "skor_deviasi": 91.0,
        "status": "bagus",
    })
    assert r.status_code == 422
