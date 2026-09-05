"""Tahap 6: pengikatan wallet EVM dengan verifikasi signature personal_sign."""
from eth_account import Account
from eth_account.messages import encode_defunct
from app.models import User


def _pasangan_acak():
    acct = Account.create()
    return acct.address, acct


def test_challenge_wajib_login(client):
    assert client.get("/api/wallet/challenge").status_code == 401


def test_alur_bind_wallet_sah(client, user, auth_headers, db_session):
    r = client.get("/api/wallet/challenge", headers=auth_headers)
    assert r.status_code == 200
    pesan = r.json()["pesan"]
    assert "GenPosFit Wallet Binding" in pesan and f"#{user.user_id}" in pesan

    alamat, akun = _pasangan_acak()
    sig = akun.sign_message(encode_defunct(text=pesan))
    v = client.post("/api/wallet/verify", headers=auth_headers, json={
        "address": alamat, "signature": sig.signature.hex(),
    })
    assert v.status_code == 200, v.text
    assert v.json()["connected"] is True
    assert v.json()["wallet_address"].lower() == alamat.lower()

    me = client.get("/api/wallet/me", headers=auth_headers).json()
    assert me["connected"] is True

    db_u = db_session.query(User).filter_by(user_id=user.user_id).first()
    assert db_u.wallet_address is not None


def test_signature_palsu_ditolak(client, auth_headers):
    pesan = client.get("/api/wallet/challenge", headers=auth_headers).json()["pesan"]
    _, akun = _pasangan_acak()
    alamat2, akun2 = _pasangan_acak()
    # akun menandatangani pesan TAPI mengaku alamat lain
    sig = akun.sign_message(encode_defunct(text=pesan))
    v = client.post("/api/wallet/verify", headers=auth_headers, json={
        "address": alamat2, "signature": sig.signature.hex(),
    })
    assert v.status_code == 401


def test_tanpa_challenge_ditolak(client, auth_headers):
    v = client.post("/api/wallet/verify", headers=auth_headers, json={
        "address": "0x" + "ab" * 20, "signature": "0x" + "00" * 65,
    })
    assert v.status_code == 401


def test_nonce_sekali_pakai(client, user, auth_headers):
    pesan = client.get("/api/wallet/challenge", headers=auth_headers).json()["pesan"]
    alamat, akun = _pasangan_acak()
    sig = akun.sign_message(encode_defunct(text=pesan))
    body = {"address": alamat, "signature": sig.signature.hex()}
    assert client.post("/api/wallet/verify", headers=auth_headers, json=body).status_code == 200
    # coba pakai ulang nonce/sig yang sama -> tidak ada tantangan aktif
    assert client.post("/api/wallet/verify", headers=auth_headers, json=body).status_code == 401


def test_wallet_dipakai_dua_akun_409(client, user, admin, token, admin_token, db_session):
    pesan = client.get("/api/wallet/challenge", headers={"Authorization": f"Bearer {token}"}).json()["pesan"]
    alamat, akun = _pasangan_acak()
    sig = akun.sign_message(encode_defunct(text=pesan))
    r1 = client.post("/api/wallet/verify", headers={"Authorization": f"Bearer {token}"}, json={
        "address": alamat, "signature": sig.signature.hex()})
    assert r1.status_code == 200

    pesan2 = client.get("/api/wallet/challenge", headers={"Authorization": f"Bearer {admin_token}"}).json()["pesan"]
    sig2 = akun.sign_message(encode_defunct(text=pesan2))
    r2 = client.post("/api/wallet/verify", headers={"Authorization": f"Bearer {admin_token}"}, json={
        "address": alamat, "signature": sig2.signature.hex()})
    assert r2.status_code == 409


def test_lepas_wallet(client, user, auth_headers):
    bind(client, auth_headers)
    r = client.delete("/api/wallet/me", headers=auth_headers)
    assert r.status_code == 200 and r.json()["connected"] is False


def bind(client, headers):
    pesan = client.get("/api/wallet/challenge", headers=headers).json()["pesan"]
    _, akun = _pasangan_acak()
    sig = akun.sign_message(encode_defunct(text=pesan))
    r = client.post("/api/wallet/verify", headers=headers, json={
        "address": akun.address, "signature": sig.signature.hex()})
    assert r.status_code == 200, r.text
    return akun.address


def test_alamat_invalid_422(client, auth_headers):
    client.get("/api/wallet/challenge", headers=auth_headers)
    r = client.post("/api/wallet/verify", headers=auth_headers, json={
        "address": "bukan-alamat", "signature": "0x" + "00" * 65,
    })
    assert r.status_code == 422
