"""Tahap 3: sistem Misi (Quest) Harian/Mingguan + Ledger Poin."""
from app.models import Exercise, PointLedger, Quest, User, UserQuest
from app.services.quests import QUEST_DEFAULTS, klaim_misi
from app.services.points import periode_bulanan, tambah_poin


def _kalibrasi_baseline(client, user, sudut_leher=180.0, sudut_punggung=180.0):
    """Daftarkan baseline agar postur frontal tegak = skor 'bagus' bagi user ini."""
    r = client.post("/api/registration/submit", json={
        "user_id": user.user_id, "nama": user.nama, "email": user.email,
        "data": [{
            "orientasi": "frontal", "tipe_pose": "duduk_rileks",
            "sudut_leher": sudut_leher, "sudut_punggung": sudut_punggung,
            "level_bahu": 0.0, "std_leher": 2.5, "std_punggung": 2.5, "n_frame": 80,
        }],
    })
    assert r.status_code == 200, r.text


def _postur_bag_us(client, user, n):
    _kalibrasi_baseline(client, user)
    from helpers_landmarks import frontal_landmarks
    for _ in range(n):
        r = client.post("/api/monitoring/evaluate", json={
            "user_id": user.user_id, "landmarks": frontal_landmarks(),
            "simpan_ke_db": True,
        })
        assert r.json()["tersimpan"] is True


def _make_exercise(db):
    ex = db.query(Exercise).first()
    if not ex:
        ex = Exercise(nama="Neck Release", tingkat="pemula")
        db.add(ex)
        db.commit()
        db.refresh(ex)
    return ex


def test_ensure_quests_seed_idempoten(client, db_session, auth_headers):
    r = client.get("/api/quests", headers=auth_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["musim"] == periode_bulanan()
    n1 = db_session.query(Quest).count()
    client.get("/api/quests", headers=auth_headers)
    assert db_session.query(Quest).count() == n1 == len(QUEST_DEFAULTS)
    assert len(body["misi"]) == n1
    assert set(m["status"] for m in body["misi"]) == {"aktif"}


def test_misi_tanpa_token_401(client):
    assert client.get("/api/quests").status_code == 401
    assert client.get("/api/quests/ringkasan").status_code == 401


def test_progres_postur_bagus_terhitung_dan_klaim(client, user, auth_headers, db_session):
    kodian = "postur_prima_harian"
    q = db_session.query(Quest).filter_by(kode=kodian).first()
    if q is None:
        client.get("/api/quests", headers=auth_headers)
        q = db_session.query(Quest).filter_by(kode=kodian).first()

    _postur_bag_us(client, user, 12)

    misi = client.get("/api/quests", headers=auth_headers).json()["misi"]
    m = next(x for x in misi if x["kode"] == kodian)
    assert m["progres"] == 12
    assert m["status"] == "selesai"

    res = client.post(f"/api/quests/{q.quest_id}/claim", headers=auth_headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["reward_poin"] == m["reward_poin"]
    assert body["total_poin"] == m["reward_poin"]

    db_user = db_session.query(User).filter_by(user_id=user.user_id).first()
    assert db_user.poin == m["reward_poin"]
    led = db_session.query(PointLedger).filter_by(user_id=user.user_id).first()
    assert led.alasan == f"misi:{kodian}"
    assert led.periode == periode_bulanan()
    uq = db_session.query(UserQuest).filter_by(user_id=user.user_id, quest_id=q.quest_id).first()
    assert uq.status == "diklaim" and uq.claimed_at is not None


def test_klaim_ganda_ditolak(client, user, auth_headers, db_session):
    ex = _make_exercise(db_session)
    for _ in range(2):
        client.post("/api/exercises/sessions", json={
            "user_id": user.user_id, "exercise_id": ex.exercise_id, "avg_skor": 90.0,
        })
    q = db_session.query(Quest).filter_by(kode="terapi_bergerak_harian").first() or None
    if q is None:
        client.get("/api/quests", headers=auth_headers)
        q = db_session.query(Quest).filter_by(kode="terapi_bergerak_harian").first()
    r1 = client.post(f"/api/quests/{q.quest_id}/claim", headers=auth_headers)
    assert r1.status_code == 200, r1.text
    r2 = client.post(f"/api/quests/{q.quest_id}/claim", headers=auth_headers)
    assert r2.status_code == 409


def test_klaim_service_idempoten_dua_kali_di_satu_waktu(client, user, auth_headers, db_session):
    from app.services.quests import ensure_quests
    ensure_quests(db_session)
    q = db_session.query(Quest).filter_by(kode="postur_prima_harian").first()
    _postur_bag_us(client, user, 12)
    hasil = klaim_misi(db_session, user.user_id, q.quest_id)
    assert hasil["total_poin"] == q.reward_poin
    from app.services.quests import KlaimError
    try:
        klaim_misi(db_session, user.user_id, q.quest_id)
        assert False, "harus KlaimError"
    except KlaimError as exc:
        assert exc.status == 409
    assert db_session.query(PointLedger).filter_by(user_id=user.user_id).count() == 1


def test_sampel_berkualitas_rendah_tidak_menghitung(client, user, auth_headers, db_session):
    from helpers_landmarks import low_quality_landmarks
    for _ in range(15):
        r = client.post("/api/monitoring/evaluate", json={
            "user_id": user.user_id, "landmarks": low_quality_landmarks(),
            "simpan_ke_db": True,
        })
        assert r.json()["tersimpan"] is False
    misi = client.get("/api/quests", headers=auth_headers).json()["misi"]
    m = next(x for x in misi if x["kode"] == "postur_prima_harian")
    assert m["progres"] == 0
    assert m["status"] == "aktif"


def test_klaim_belum_tercapai_400(client, user, auth_headers, db_session):
    db_session.query(Quest).first() or client.get("/api/quests", headers=auth_headers)
    q = db_session.query(Quest).filter_by(kode="duel_pilar").first()
    if q is None:
        client.get("/api/quests", headers=auth_headers)
        q = db_session.query(Quest).filter_by(kode="duel_pilar").first()
    r = client.post(f"/api/quests/{q.quest_id}/claim", headers=auth_headers)
    assert r.status_code == 400
    assert db_session.query(PointLedger).filter_by(user_id=user.user_id).count() == 0


def test_service_tambah_poin_dasar(client, user, db_session):
    e1 = tambah_poin(db_session, user.user_id, 25, "manual")
    assert e1.delta == 25
    db_user = db_session.query(User).filter_by(user_id=user.user_id).first()
    assert db_user.poin == 25
    tambah_poin(db_session, user.user_id, -30, "koreksi")
    db_session.refresh(db_user)
    assert db_user.poin == 0  # tidak pernah negatif


# ---------- admin CRUD quest ----------

def test_admin_quest_crud(client, admin_headers, db_session):
    r = client.post("/api/admin/quests", json={
        "kode": "kirim_semangat", "judul": "Sapa Rekan", "kategori": "harian",
        "metrik": "latihan_selesai", "target": 3, "reward_poin": 12,
    }, headers=admin_headers)
    assert r.status_code == 201, r.text

    qid = r.json()["quest_id"]
    listing = client.get("/api/admin/quests", headers=admin_headers)
    assert listing.status_code == 200
    assert any(q["kode"] == "kirim_semangat" for q in listing.json())

    upd = client.put(f"/api/admin/quests/{qid}", json={"target": 5}, headers=admin_headers)
    assert upd.status_code == 200 and upd.json()["target"] == 5

    assert client.delete(f"/api/admin/quests/{qid}", headers=admin_headers).status_code == 204
    q = db_session.query(Quest).filter_by(kode="kirim_semangat").first()
    assert q.aktif == 0


def test_admin_quest_ditolak_untuk_user(client, auth_headers):
    r = client.post("/api/admin/quests", json={"judul": "J", "metrik": "latihan_selesai"}, headers=auth_headers)
    assert r.status_code == 403
