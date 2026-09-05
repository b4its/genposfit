"""Tahap 4: Peringkat Bulanan (musim) — ledger-based + endpoint publik."""
from app.services.leaderboard import peringkat_bulanan
from app.services.points import periode_bulanan, tambah_poin


def test_leaderboard_bulanan_memakai_ledger(client, user, admin, db_session):
    tambah_poin(db_session, user.user_id, 100, "misi:x")
    tambah_poin(db_session, admin.user_id, 30, "manual")
    data = peringkat_bulanan(db_session, periode_bulanan(), limit=50, user_id_terkaimana=admin.user_id)
    assert data["musim"] == periode_bulanan()
    assert data["musim_berjalan"] is True
    assert data["top"][0]["username"] == "budi"
    assert data["top"][0]["poin_musim"] == 100
    assert data["top"][1]["username"] == "adminroot"
    assert data["saya"]["rank"] == 2
    assert 0 < data["sisa_waktu_detik"] <= 62 * 86400


def test_poin_musim_lama_terisolasi(client, user, db_session):
    tambah_poin(db_session, user.user_id, 10, "misi:lama", periode="2020-01")
    tambah_poin(db_session, user.user_id, 7, "misi:baru")
    data = peringkat_bulanan(db_session, "2020-01", limit=5)
    entri = next(e for e in data["top"] if e["user_id"] == user.user_id)
    assert entri["poin_musim"] == 10
    assert data["musim_berjalan"] is False
    data_now = peringkat_bulanan(db_session, periode_bulanan(), limit=5)
    entri_now = next(e for e in data_now["top"] if e["user_id"] == user.user_id)
    assert entri_now["poin_musim"] == 7


def test_leaderboard_publik_endpoint(client, user, admin, auth_headers, db_session):
    tambah_poin(db_session, user.user_id, 55, "misi:abc")
    tambah_poin(db_session, admin.user_id, 999, "manual")
    r = client.get("/api/leaderboard/monthly?limit=10", headers=auth_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["top"][0]["username"] == "adminroot"
    assert body["saya"]["username"] == "budi"
    assert body["saya"]["poin_musim"] == 55


def test_format_musim_invalid_400(client, auth_headers):
    r = client.get("/api/leaderboard/monthly?musim=2026-13", headers=auth_headers)
    assert r.status_code == 400


def test_leaderboard_tanpa_login_401(client):
    assert client.get("/api/leaderboard/monthly").status_code == 401


def test_admin_monthly_leaderboard(client, admin_headers, user, db_session):
    tambah_poin(db_session, user.user_id, 45, "misi:zzz")
    r = client.get("/api/admin/leaderboard/monthly", headers=admin_headers)
    assert r.status_code == 200, r.text
    assert r.json()["top"][0]["username"] == "budi"
