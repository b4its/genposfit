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


