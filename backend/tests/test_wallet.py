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


def test_bind_dompet_default_tanpa_metamask(client, auth_headers):
    r = client.post("/api/wallet/bind-default", headers=auth_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["connected"] is True
    assert data["is_default"] is True
    assert data["wallet_address"] == "0x6EdcA860c066FCdA6c434095d5901810DCE12b48"

    me = client.get("/api/wallet/me", headers=auth_headers).json()
    assert me["connected"] is True
    assert me["wallet_address"] == "0x6EdcA860c066FCdA6c434095d5901810DCE12b48"
    assert me["is_default"] is True


def test_dompet_default_bisa_dipakai_banyak_akun(client, token, admin_token):
    h1 = {"Authorization": f"Bearer {token}"}
    h2 = {"Authorization": f"Bearer {admin_token}"}
    r1 = client.post("/api/wallet/bind-default", headers=h1)
    r2 = client.post("/api/wallet/bind-default", headers=h2)
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json()["wallet_address"] == r2.json()["wallet_address"]


def test_pendapatan_wallet_berbeda_per_akun(client, db_session, user, admin, token, admin_token):
    from decimal import Decimal
    from app.models import GpcRewardTx
    from app.config import GPC_DEFAULT_REWARD_WALLET

    # Kedua user memakai dompet komunitas yang sama
    h1 = {"Authorization": f"Bearer {token}"}
    h2 = {"Authorization": f"Bearer {admin_token}"}
    client.post("/api/wallet/bind-default", headers=h1)
    client.post("/api/wallet/bind-default", headers=h2)

    # Catat reward sukses: user=1000 GPC, admin=600 GPC
    tx1 = GpcRewardTx(
        periode="2026-09",
        user_id=user.user_id,
        rank=1,
        wallet_address=GPC_DEFAULT_REWARD_WALLET,
        jumlah=Decimal("1000.00"),
        tx_hash="0xTXUSER1",
        status="sukses",
    )
    tx2 = GpcRewardTx(
        periode="2026-09",
        user_id=admin.user_id,
        rank=2,
        wallet_address=GPC_DEFAULT_REWARD_WALLET,
        jumlah=Decimal("600.00"),
        tx_hash="0xTXUSER2",
        status="sukses",
    )
    db_session.add_all([tx1, tx2])
    db_session.commit()

    # Periksa status masing-masing akun: pendapatan harus terpisah per akun
    me1 = client.get("/api/wallet/me", headers=h1).json()
    me2 = client.get("/api/wallet/me", headers=h2).json()

    assert me1["total_gpc_diterima"] == 1000.0
    assert me1["jumlah_transaksi_sukses"] == 1
    assert me1["riwayat_reward"][0]["jumlah"] == 1000.0

    assert me2["total_gpc_diterima"] == 600.0
    assert me2["jumlah_transaksi_sukses"] == 1
    assert me2["riwayat_reward"][0]["jumlah"] == 600.0

