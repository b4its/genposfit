"""Endpoint admin: proteksi role + CRUD jenis latihan/latihan + stats + leaderboard."""
from helpers_landmarks import frontal_landmarks


def test_admin_endpoints_require_auth(client):
    assert client.get("/api/admin/stats").status_code == 401
    assert client.get("/api/admin/leaderboard").status_code == 401
    assert client.get("/api/admin/exercise-types").status_code == 401


def test_admin_forbidden_for_regular_user(client, auth_headers):
    for url in ("/api/admin/stats", "/api/admin/leaderboard", "/api/admin/exercise-types"):
        r = client.get(url, headers=auth_headers)
        assert r.status_code == 403, url


def test_exercise_type_crud(client, admin_headers):
    r = client.post("/api/admin/exercise-types", json={"nama": "T", "deskripsi": "d"}, headers=admin_headers)
    print("CRUD FIRST:", r.status_code, r.text[:120])
    assert r.status_code == 201, r.text
    tid = r.json()["type_id"]

    child = client.post(f"/api/admin/exercise-types/{tid}/exercises", headers=admin_headers, json={
        "nama": "Chin Tuck", "reps": 10, "is_battle": True,
        "skeleton_data": frontal_landmarks(),
    })
    assert child.status_code == 201, child.text
    body = child.json()
    assert body["type_id"] == tid
    assert body["is_battle"] is True
    # sudut terhitung dari skeleton frontal (tegak ~180 derajat)
    assert body["sudut_leher"] > 120

    types = client.get("/api/admin/exercise-types", headers=admin_headers).json()
    assert any(t["type_id"] == tid and len(t["children"]) == 1 for t in types)

    assert client.delete(f"/api/admin/exercise-types/{tid}", headers=admin_headers).status_code == 204
    assert client.get("/api/admin/exercise-types", headers=admin_headers).json() == []


def test_record_pose_endpoint(client, admin_headers):
    r = client.post("/api/admin/exercises/record-pose", headers=admin_headers, json={
        "nama": "Rekam Pose", "skeleton_data": frontal_landmarks(),
    })
    assert r.status_code == 201, r.text
    assert r.json()["skeleton_data"]


def test_stats_and_leaderboard(client, admin_headers, user, db_session):
    from app.models import PostureLog
    db_session.add(PostureLog(user_id=user.user_id, sudut_leher=160, sudut_punggung=170,
                              skor_deviasi=88, status="bagus"))
    db_session.commit()

    s = client.get("/api/admin/stats?days=7", headers=admin_headers).json()
    assert s["kpi"]["total_users"] == 2  # budi + adminroot
    assert s["distribusi"]["bagus"] == 1
    assert len(s["posture_daily"]) == 1

    lb = client.get("/api/admin/leaderboard", headers=admin_headers).json()
    assert lb["count"] == 2
    assert lb["users"][0]["rank"] == 1


def test_set_admin_endpoint(client, admin_headers, user):
    r = client.post(f"/api/admin/users/{user.user_id}/set-admin", headers=admin_headers)
    assert r.status_code == 200
    from app.models import User
    db_user = client.get(f"/api/users/{user.user_id}").json()
    assert db_user["role"] == "admin"


def test_exercise_presets_endpoint(client, admin_headers):
    r = client.get("/api/admin/exercise-presets", headers=admin_headers)
    assert r.status_code == 200
    presets = r.json()
    assert len(presets) >= 30
    assert any(p["preset_id"] == "chin_tuck_desk" for p in presets)
    assert any(p["kategori_key"] == "leher" for p in presets)
    assert any(p["kategori_key"] == "bahu" for p in presets)
    assert any(p["kategori_key"] == "punggung" for p in presets)
    assert any(p["kategori_key"] == "pinggul" for p in presets)
    assert any(p["kategori_key"] == "kantor" for p in presets)

    # Filter kategori
    r_filtered = client.get("/api/admin/exercise-presets?kategori=leher", headers=admin_headers)
    assert r_filtered.status_code == 200
    leher_presets = r_filtered.json()
    assert len(leher_presets) >= 8
    assert all("leher" in p["kategori_key"].lower() or "leher" in p["kategori_rekomendasi"].lower() for p in leher_presets)


def test_batch_exercises_and_extended_pose_items(client, admin_headers):
    # Buat jenis latihan
    t = client.post("/api/admin/exercise-types", json={"nama": "Koreksi Batch Test", "deskripsi": "Testing batch"}, headers=admin_headers)
    assert t.status_code == 201
    tid = t.json()["type_id"]

    # Ambil 3 preset variasi gerakan
    presets = client.get("/api/admin/exercise-presets", headers=admin_headers).json()[:3]
    batch_payload = []
    for p in presets:
        batch_payload.append({
            "nama": p["nama"],
            "deskripsi": p["deskripsi"],
            "target_otot": p["target_otot"],
            "tingkat": p["tingkat"],
            "durasi_detik": p["durasi_detik"],
            "reps": p["reps"],
            "is_battle": p["is_battle"],
            "skeleton_data": p["skeleton_data"],
            "sudut_target": p["sudut_target"],
        })

    res = client.post(f"/api/admin/exercise-types/{tid}/batch-exercises", json=batch_payload, headers=admin_headers)
    assert res.status_code == 201, res.text
    created = res.json()
    assert len(created) == 3
    for c in created:
        assert c["type_id"] == tid
        assert c["sudut_target"] is not None
        assert "orientasi_kamera" in c["sudut_target"]
        assert "posisi_tubuh" in c["sudut_target"]
        assert "variasi_gerakan" in c["sudut_target"]
        assert c["sudut_leher"] is not None
        assert c["sudut_punggung"] is not None



