"""Smoke & auth: health, register, login, /me, users endpoint."""
from app.models import User


def test_root_and_health(client):
    assert client.get("/").status_code == 200
    health = client.get("/api/health").json()
    assert health["status"] in ("healthy", "degraded")


def test_register_login_me_flow(client):
    r = client.post("/api/auth/register", json={
        "username": "sari", "password": "rahasia", "nama": "Sari Dewi",
    })
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["username"] == "sari"
    assert body["access_token"]

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    assert me.json()["username"] == "sari"
    assert me.json()["role"] == "user"


def test_register_duplicate_username_conflict(client):
    payload = {"username": "anjani", "password": "rahasia", "nama": "Anjani"}
    assert client.post("/api/auth/register", json=payload).status_code == 201
    r2 = client.post("/api/auth/register", json=payload)
    assert r2.status_code == 409


def test_register_short_password_422(client):
    r = client.post("/api/auth/register", json={"username": "bola", "password": "ab", "nama": "B"})
    assert r.status_code == 422


def test_login_wrong_password(client):
    client.post("/api/auth/register", json={"username": "galih", "password": "benar123", "nama": "Galih"})
    r = client.post("/api/auth/login", json={"username": "galih", "password": "salah123"})
    assert r.status_code == 401


def test_me_without_token_401(client):
    assert client.get("/api/auth/me").status_code == 401


def test_me_invalid_token_401(client):
    r = client.get("/api/auth/me", headers={"Authorization": "Bearer dustytoken"})
    assert r.status_code == 401


def test_create_user_via_users_api(client):
    r = client.post("/api/users", json={"nama": "Nadia Melati", "email": "nadia@example.com"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["nama"] == "Nadia Melati"
    assert body["username"].startswith("nadia@example.com")
    # Password acak dikembalikan sekali + access_token untuk login langsung
    assert body.get("password")
    assert body.get("access_token")

    login = client.post("/api/auth/login", json={"username": body["username"], "password": body["password"]})
    assert login.status_code == 200


def test_get_user_by_id_404(client):
    assert client.get("/api/users/99999").status_code == 404
