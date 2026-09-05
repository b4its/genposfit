"""
GenPosFit — Pytest Fixtures
Aplikasi FastAPI di-boot dengan SQLite in-memory (engine StaticPool agar
semua thread TestClient berbagi koneksi yang sama), plus helper user
biasa & admin siap-token.
"""
import os
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Wajib di-set SEBELUM modul app diimpor
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["DEV_MODE"] = "1"
os.environ["SECRET_KEY"] = "test-secret-key"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.database as database

_engine = create_engine(
    "sqlite://",
    poolclass=StaticPool,
    connect_args={"check_same_thread": False},
)
database.engine = _engine
database.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)

from app.database import Base, get_db  # noqa: E402
from app.models import User  # noqa: E402
from app.security import hash_password  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def db_session():
    Base.metadata.drop_all(bind=_engine)
    Base.metadata.create_all(bind=_engine)
    session = database.SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _make_user(db, username, password="password123", role="user", nama="Test User", email=None):
    user = User(
        username=username,
        hashed_password=hash_password(password),
        nama=nama,
        email=email or f"{username}@test.local",
        role=role,
        poin=0,
        saldo=0.0,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def user(db_session):
    return _make_user(db_session, "budi", nama="Budi Santoso")


@pytest.fixture()
def admin(db_session):
    return _make_user(db_session, "adminroot", role="admin", nama="Root Admin")


@pytest.fixture()
def token(client, user):
    res = client.post("/api/auth/login", json={"username": "budi", "password": "password123"})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


@pytest.fixture()
def admin_token(client, admin):
    res = client.post("/api/auth/login", json={"username": "adminroot", "password": "password123"})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


@pytest.fixture()
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}
