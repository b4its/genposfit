"""Registrasi baseline, daftar latihan, sesi, dan scoring pose."""
from helpers_landmarks import frontal_landmarks, shifted_landmarks, blank_landmarks


# ---------- registration ----------

def test_submit_baseline_creates_profile(client):
    payload = {
        "nama": "Rina Kartika",
        "email": "rina@example.com",
        "data": [{
            "orientasi": "frontal",
            "tipe_pose": "duduk_rileks",
            "sudut_leher": 164.0,
            "sudut_punggung": 171.0,
            "level_bahu": 0.01,
            "std_leher": 2.5,
            "std_punggung": 2.5,
            "n_frame": 80,
        }],
    }
    r = client.post("/api/registration/submit", json=payload)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["nama"] == "Rina Kartika"
    assert body["total_baselines"] == 1

    bl = client.get(f"/api/registration/baselines/{body['user_id']}").json()
    assert len(bl["baselines"]) == 1


def test_baselines_unknown_user_404(client):
    assert client.get("/api/registration/baselines/99999").status_code == 404


def test_submit_upserts_baseline(client, user):
    payload = {
        "user_id": user.user_id,
        "nama": "Budi Ganti Nama",
        "data": [
            {"orientasi": "frontal", "tipe_pose": "duduk_rileks",
             "sudut_leher": 160.0, "sudut_punggung": 170.0},
            {"orientasi": "lateral_kanan", "tipe_pose": "duduk_rileks",
             "sudut_leher": 158.0, "sudut_punggung": 168.0},
        ],
    }
    r = client.post("/api/registration/submit", json=payload)
    assert r.status_code == 200
    assert r.json()["total_baselines"] == 2
    # upsert: submit ulang tidak membuat baris ganda
    r2 = client.post("/api/registration/submit", json=payload)
    assert r2.json()["total_baselines"] == 2
    bl = client.get(f"/api/registration/baselines/{user.user_id}").json()
    assert len(bl["baselines"]) == 2
    assert bl["nama"] == "Budi Ganti Nama"


# ---------- exercises ----------

def test_exercise_list_empty_ok(client):
    assert client.get("/api/exercises").json() == []


def test_exercise_not_found(client):
    assert client.get("/api/exercises/4242").status_code == 404


def test_record_session_requires_existing_user(client):
    r = client.post("/api/exercises/sessions", json={
        "user_id": 99999, "exercise_id": 1, "total_reps": 5, "avg_skor": 88.0,
    })
    assert r.status_code == 404


def test_record_session_flow(client, user, db_session):
    from app.models import Exercise
    ex = Exercise(nama="Chin Tuck", tingkat="pemula")
    db_session.add(ex)
    db_session.commit()
    db_session.refresh(ex)

    r = client.post("/api/exercises/sessions", json={
        "user_id": user.user_id, "exercise_id": ex.exercise_id,
        "total_reps": 10, "avg_skor": 92.5,
    })
    assert r.status_code == 201, r.text
    assert r.json()["avg_skor"] == 92.5

    hist = client.get(f"/api/exercises/sessions/user/{user.user_id}").json()
    assert len(hist) == 1
    assert hist[0]["nama_latihan"] == "Chin Tuck"


def test_score_pose_no_reference(client):
    r = client.post("/api/exercises/score", json={"landmarks": frontal_landmarks()})
    assert r.status_code == 200
    assert r.json()["score"] == 0.0


def test_score_pose_matches_reference(client, db_session):
    from app.models import Exercise
    ref = blank_landmarks()
    ex = Exercise(nama="Target Pose", skeleton_data=ref)
    db_session.add(ex)
    db_session.commit()
    db_session.refresh(ex)

    r = client.post("/api/exercises/score", json={
        "landmarks": shifted_landmarks(ref, 0.0, 0.0), "exercise_id": ex.exercise_id,
    })
    body = r.json()
    assert body["score"] == 100.0
    assert body["status"] == "bagus"

    r2 = client.post("/api/exercises/score", json={
        "landmarks": shifted_landmarks(ref, 0.25, 0.0), "exercise_id": ex.exercise_id,
    })
    assert r2.json()["score"] < 50
