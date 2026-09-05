"""Monitoring postur: evaluate HTTP, /log, /summary, dan WebSocket live."""
from helpers_landmarks import frontal_landmarks


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
