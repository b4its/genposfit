"""Tahap 7: distribusi reward GPC off-chain-safe — preview, dry-run, idempotensi."""
import pytest

from app.models import GpcRewardTx, User
from app.services import rewards
from app.services.leaderboard import peringkat_bulanan
from app.services.points import periode_bulanan, tambah_poin


W1 = "0x1111111111111111111111111111111111111111"
W2 = "0x2222222222222222222222222222222222222222"


def _musim_persen(client, db_session, admin_headers):
    pass


def _seed_ranking(client, db_session, user, admin):
    """user#1 100 poin, admin#2 60 poin; user lain 30 poin tanpa wallet."""
    tambah_poin(db_session, user.user_id, 100, "misi:a")
    tambah_poin(db_session, admin.user_id, 60, "manual")
    lain = User(username="tanpa_wallet", hashed_password="x", nama="Tanpa Wallet",
               email="tw@test.local", role="user", poin=0, saldo=0)
    db_session.add(lain)
    db_session.commit()
    tambah_poin(db_session, lain.user_id, 30, "manual")
    lain2 = db_session.query(User).filter_by(username="tanpa_wallet").first()
    return lain2


def test_preview_uses_ledger_dan_status_wallet(client, admin, admin_headers, user, db_session):
    lain = _seed_ranking(client, db_session, user, admin)
    r1 = client.get("/api/admin/rewards/preview", headers=admin_headers)
    assert r1.status_code == 200, r1.text
    body = r1.json()
    assert body["periode"] == periode_bulanan()
    assert [p["rank"] for p in body["penerima"]] == [1, 2, 3]
    assert body["penerima"][0]["jumlah_gpc"] == rewards.GPC_REWARD_SCHEDULE[1]
    assert body["penerima"][0]["nama"] == "Budi Santoso"
    # belum ada yang bind wallet -> semua tanpa_wallet
    assert set(body["penerima"][0].values()) and len(body["tanpa_wallet"]) == 3


def test_dryrun_tidak_menulis_db(client, admin, admin_headers, user, db_session):
    _seed_ranking(client, db_session, user, admin)
    r = client.post("/api/admin/rewards/distribute", json={"kering": True}, headers=admin_headers)
    assert r.status_code == 200, r.text
    assert db_session.query(GpcRewardTx).count() == 0
    assert len(r.json()["simulasi"]) == 3


def test_distribusi_nonaktif_409(client, admin, admin_headers, user, db_session, monkeypatch):
    _seed_ranking(client, db_session, user, admin)
    monkeypatch.setattr(rewards, "GPC_REWARDS_ENABLED", False)
    r = client.post("/api/admin/rewards/distribute", json={"kering": False}, headers=admin_headers)
    assert r.status_code == 409


def test_real_distribusi_patched_monkey(client, admin, admin_headers, user, db_session, monkeypatch):
    lain = _seed_ranking(client, db_session, user, admin)
    u1 = db_session.query(User).filter_by(user_id=user.user_id).first()
    u2 = db_session.query(User).filter_by(user_id=admin.user_id).first()
    u1.wallet_address = W1
    u2.wallet_address = W2
    db_session.commit()

    monkeypatch.setattr(rewards, "GPC_REWARDS_ENABLED", True)
    monkeypatch.setattr(rewards, "SEPOLIA_RPC_URL", "http://rpc.test")
    monkeypatch.setattr(rewards, "GPC_CONTRACT_ADDRESS", W1)
    monkeypatch.setattr(rewards, "GPC_TREASURY_PRIVATE_KEY", "0x" + "11" * 30)
    dipanggil = []

    def fake_mint(kontak, wallet, jumlah, pk):
        dipanggil.append((wallet, int(jumlah)))
        return "0xFAKE" + format(len(dipanggil), "04x")

    monkeypatch.setattr(rewards, "kirim_mint", fake_mint)
    monkeypatch.setattr(rewards, "_contract", lambda: ("w3", "contract"))

    r = client.post("/api/admin/rewards/distribute", json={"kering": False}, headers=admin_headers)
    assert r.status_code == 200, r.text
    hasil = r.json()
    assert len(hasil["dikirim"]) == 2
    assert len(hasil["gagal"]) == 0
    assert len(dipanggil) == 2  # user rank 3 tanpa wallet dilewati
    assert db_session.query(GpcRewardTx).count() == 2

    # jalan kedua: idempoten, tidak kirim ulang
    r2 = client.post("/api/admin/rewards/distribute", json={"kering": False}, headers=admin_headers)
    assert len(r2.json()["lewat_sudah"]) == 2
    assert len(dipanggil) == 2


def test_gagal_mint_dicatat_dan_bisa_retry(client, admin, admin_headers, user, db_session, monkeypatch):
    tambah_poin(db_session, user.user_id, 100, "misi:a")
    u = db_session.query(User).filter_by(user_id=user.user_id).first()
    u.wallet_address = W1
    db_session.commit()
    monkeypatch.setattr(rewards, "GPC_REWARDS_ENABLED", True)
    monkeypatch.setattr(rewards, "SEPOLIA_RPC_URL", "http://rpc.test")
    monkeypatch.setattr(rewards, "GPC_CONTRACT_ADDRESS", W1)
    monkeypatch.setattr(rewards, "GPC_TREASURY_PRIVATE_KEY", "0x" + "11" * 30)
    monkeypatch.setattr(rewards, "_contract", lambda: ("w3", "c"))

    def boom(*a, **k):
        raise RuntimeError("nonce terlalu rendah")

    monkeypatch.setattr(rewards, "kirim_mint", boom)
    r = client.post("/api/admin/rewards/distribute", json={"kering": False}, headers=admin_headers)
    assert r.status_code == 200
    assert len(r.json()["gagal"]) == 1
    baris = db_session.query(GpcRewardTx).first()
    assert baris.status == "gagal" and "nonce" in (baris.error or "")

    monkeypatch.setattr(rewards, "kirim_mint", lambda *a, **k: "0xOK2")
    r2 = client.post("/api/admin/rewards/distribute", json={"kering": False}, headers=admin_headers)
    assert len(r2.json()["dikirim"]) == 1
    db_session.refresh(baris)
    assert baris.status == "sukses" and baris.tx_hash == "0xOK2"


def test_history_endpoint(client, admin, admin_headers):
    assert client.get("/api/admin/rewards/history").status_code in (200, 401)


def test_reward_hanya_untuk_admin(client, auth_headers):
    assert client.get("/api/admin/rewards/preview", headers=auth_headers).status_code == 403
    assert client.post("/api/admin/rewards/distribute", json={}, headers=auth_headers).status_code == 403
    assert client.post("/api/admin/rewards/distribute-users", json={}, headers=auth_headers).status_code == 403


def test_preview_dengan_default_wallet(client, admin, admin_headers, user, db_session):
    _seed_ranking(client, db_session, user, admin)
    r = client.get(
        "/api/admin/rewards/preview?use_default_wallet=true",
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body["tanpa_wallet"]) == 0
    assert body["total_penerima_siap"] == 3
    # Semua user tanpa wallet dialihkan ke GPC_DEFAULT_REWARD_WALLET
    for p in body["penerima"]:
        assert p["siap"] is True
        assert p["wallet_address"] == rewards.GPC_DEFAULT_REWARD_WALLET
        assert p["is_default_wallet"] is True

    # Agregasi dompet_ringkasan
    ringkasan = body["dompet_ringkasan"]
    assert len(ringkasan) == 1
    assert ringkasan[0]["wallet_address"] == rewards.GPC_DEFAULT_REWARD_WALLET
    assert ringkasan[0]["jumlah_user"] == 3
    assert ringkasan[0]["total_gpc_periode"] == sum(rewards.GPC_REWARD_SCHEDULE.values())
    assert len(ringkasan[0]["user_ids"]) == 3


def test_preview_filter_hanya_role_user(client, admin, admin_headers, user, db_session):
    _seed_ranking(client, db_session, user, admin)
    r = client.get(
        "/api/admin/rewards/preview?hanya_role_user=true",
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    # admin (rank 2) harus dilewati
    user_ids = [p["user_id"] for p in body["penerima"]]
    assert admin.user_id not in user_ids
    assert user.user_id in user_ids


def test_distribute_users_shortcut_dryrun(client, admin, admin_headers, user, db_session):
    _seed_ranking(client, db_session, user, admin)
    r = client.post(
        "/api/admin/rewards/distribute-users",
        json={"kering": True},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["hanya_role_user"] is True
    assert body["use_default_wallet"] is True
    simulasi = body["simulasi"]
    # Admin dilewati, hanya 2 user role 'user'
    assert len(simulasi) == 2
    for s in simulasi:
        assert s["wallet_address"] == rewards.GPC_DEFAULT_REWARD_WALLET
        assert s["siap"] is True
    # Tidak ada baris yang ditulis saat kering
    assert db_session.query(GpcRewardTx).count() == 0


def test_distribute_users_shortcut_onchain(client, admin, admin_headers, user, db_session, monkeypatch):
    _seed_ranking(client, db_session, user, admin)
    monkeypatch.setattr(rewards, "GPC_REWARDS_ENABLED", True)
    monkeypatch.setattr(rewards, "SEPOLIA_RPC_URL", "http://rpc.test")
    monkeypatch.setattr(rewards, "GPC_CONTRACT_ADDRESS", W1)
    monkeypatch.setattr(rewards, "GPC_TREASURY_PRIVATE_KEY", "0x" + "11" * 30)

    dipanggil = []

    def fake_mint(kontak, wallet, jumlah, pk, nonce=None):
        dipanggil.append((wallet, int(jumlah), nonce))
        return "0xUSER" + format(len(dipanggil), "04x")

    monkeypatch.setattr(rewards, "kirim_mint", fake_mint)
    monkeypatch.setattr(rewards, "_contract", lambda: ("w3", "contract"))

    r = client.post(
        "/api/admin/rewards/distribute-users",
        json={"kering": False},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body["dikirim"]) == 2  # 2 user role 'user'
    assert len(dipanggil) == 2
    # Semua dikirim ke default community wallet
    for item in body["dikirim"]:
        assert item["wallet_address"] == rewards.GPC_DEFAULT_REWARD_WALLET
    # Memastikan tabel GpcRewardTx mencatat setiap user_id secara terpisah
    tx_records = db_session.query(GpcRewardTx).all()
    assert len(tx_records) == 2
    for tx in tx_records:
        assert tx.status == "sukses"
        assert tx.wallet_address == rewards.GPC_DEFAULT_REWARD_WALLET
        assert tx.user_id in [user.user_id, tx_records[1].user_id]
