"""Tahap 5: pencatatan hasil battle multiplayer -> poin + progres misi."""
import time

from app.models import BattleResult, PointLedger
from app.services.battles import (
    BattleInvalidError, POIN_BERTANDING, POIN_MENANG, catat_hasil_battle,
)

HOST = {"client_id": "bh-1", "display_name": "Juara", "warna": "#22c55e"}
OPP = {"client_id": "bh-2", "display_name": "Penantang", "warna": "#3b82f6"}


def _dua_pemain(client, db_session, user, admin):
    """Buat room dengan dua pemain terautentikasi (user & admin)."""
    room = client.post("/api/multiplayer/rooms", json={
        "nama": "Duel Reward", "password": "kunci4", "max_score": 2,
        "user_id": user.user_id, **HOST,
    }).json()
    join = client.post("/api/multiplayer/join", json={
        "room_code": room["room_code"], "password": "kunci4", "user_id": admin.user_id, **OPP,
    }).json()
    keys = [p["guest_key"] for p in join["players"]]
    return room, dict(zip([HOST["client_id"], OPP["client_id"]], keys)), keys


def test_catat_hasil_membagi_poin(client, db_session, user, admin):
    room, _, (gk_a, gk_b) = _dua_pemain(client, db_session, user, admin)
    hasil = catat_hasil_battle(db_session, room_code=room["room_code"], battle_id="b1", hasil=[
        {"guest_key": gk_a, "skor": 2, "is_pemenang": True},
        {"guest_key": gk_b, "skor": 1},
    ])
    assert hasil["status"] == "recorded"
    from app.models import User
    winner = db_session.query(User).filter_by(user_id=user.user_id).first()
    runner = db_session.query(User).filter_by(user_id=admin.user_id).first()
    assert winner.poin == POIN_MENANG
    assert runner.poin == POIN_BERTANDING
    assert db_session.query(PointLedger).filter_by(alasan="battle_menang").count() == 1
    assert db_session.query(BattleResult).filter_by(battle_id="b1").count() == 2


def test_laporan_ganda_idempoten(client, db_session, user, admin):
    room, _, (gk_a, gk_b) = _dua_pemain(client, db_session, user, admin)
    h = lambda: [
        {"guest_key": gk_a, "skor": 2, "is_pemenang": True},
        {"guest_key": gk_b, "skor": 0},
    ]
    first = catat_hasil_battle(db_session, room_code=room["room_code"], battle_id="dup1", hasil=h())
    second = catat_hasil_battle(db_session, room_code=room["room_code"], battle_id="dup1", hasil=h())
    assert second["status"] == "duplicate" and first["status"] == "recorded"


def test_validasi_pemenang(client, db_session, user, admin):
    room, _, (gk_a, gk_b) = _dua_pemain(client, db_session, user, admin)
    # seri skor + pemenang dobel -> 422
    try:
        catat_hasil_battle(db_session, room_code=room["room_code"], battle_id="x", hasil=[
            {"guest_key": gk_a, "skor": 2, "is_pemenang": True},
            {"guest_key": gk_b, "skor": 2, "is_pemenang": True},
        ])
        assert False
    except BattleInvalidError as exc:
        assert exc.status in (422,)
    # guest_key asing -> 403
    try:
        catat_hasil_battle(db_session, room_code=room["room_code"], battle_id="y", hasil=[
            {"guest_key": "g_palsu", "skor": 9, "is_pemenang": True},
            {"guest_key": gk_b, "skor": 0},
        ])
        assert False
    except BattleInvalidError as exc:
        assert exc.status in (403, 404)


def test_guest_tanpa_akun_tidak_dapat_poin(client, db_session, user):
    room = client.post("/api/multiplayer/rooms", json={
        "nama": "Duel Guest", "password": "kunci4", "max_score": 2,
        "user_id": user.user_id, **HOST,
    }).json()
    joined = client.post("/api/multiplayer/join", json={
        "room_code": room["room_code"], "password": "kunci4",
        "display_name": "Hantu", "warna": "#f59e0b", "client_id": "bh-guest",
    }).json()
    gk_host = [p["guest_key"] for p in joined["players"] if p["display_name"] == "Juara"][0]
    gk_ghost = [p["guest_key"] for p in joined["players"] if p["display_name"] == "Hantu"][0]
    r = catat_hasil_battle(db_session, room_code=room["room_code"], battle_id="g1", hasil=[
        {"guest_key": gk_ghost, "skor": 2, "is_pemenang": True},
        {"guest_key": gk_host, "skor": 1},
    ])
    from app.models import User
    ghost_poin = r["hasil"][0]["poin"] if r["hasil"][0]["guest_key"] == gk_ghost else r["hasil"][1]["poin"]
    assert ghost_poin == 0


def test_rest_report_endpoint(client, db_session, user, admin):
    room, _, (gk_a, gk_b) = _dua_pemain(client, db_session, user, admin)
    r = client.post(f"/api/multiplayer/rooms/{room['room_code']}/result", json={
        "battle_id": "rest-1",
        "hasil": [
            {"guest_key": gk_a, "skor": 2, "is_pemenang": True},
            {"guest_key": gk_b, "skor": 1},
        ],
    })
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "recorded"


def test_battle_finished_melalui_websocket(client, db_session, user, admin):
    room, _, (gk_a, gk_b) = _dua_pemain(client, db_session, user, admin)
    code = room["room_code"]
    with client.websocket_connect(f"/api/multiplayer/ws/{code}") as ws1:
        ws1.send_json({"guest_key": gk_a, "display_name": "Juara", "warna": HOST["warna"]})
        with client.websocket_connect(f"/api/multiplayer/ws/{code}") as ws2:
            ws2.send_json({"guest_key": gk_b, "display_name": "Penantang", "warna": OPP["warna"]})
            ws2.send_json({
                "type": "battle_finished", "guest_key": gk_b, "battle_id": "ws-1",
                "hasil": [
                    {"guest_key": gk_a, "skor": 2, "is_pemenang": True},
                    {"guest_key": gk_b, "skor": 1},
                ],
            })
            dl = time.time() + 5
            got = None
            while time.time() < dl:
                m = ws1.receive_json()
                if m.get("type") == "battle_result":
                    got = m
                    break
            assert got is not None
            assert got["hasil"]["status"] == "recorded"


def test_kemenangan_menaikkan_progres_misi_duel(client, user, auth_headers, admin, db_session):
    # pastikan quest default terseeding
    client.get("/api/quests", headers=auth_headers)
    room, _, (gk_a, gk_b) = _dua_pemain(client, db_session, user, admin)
    catat_hasil_battle(db_session, room_code=room["room_code"], battle_id="qm-1", hasil=[
        {"guest_key": gk_a, "skor": 2, "is_pemenang": True},
        {"guest_key": gk_b, "skor": 0},
    ])
    misi = client.get("/api/quests", headers=auth_headers).json()["misi"]
    duel = next(x for x in misi if x["kode"] == "duel_pilar")
    assert duel["progres"] == 1
    assert duel["status"] == "selesai"
    r = client.post(f"/api/quests/{duel['quest_id']}/claim", headers=auth_headers)
    assert r.status_code == 200
    total = POIN_MENANG + duel["reward_poin"]
    assert r.json()["total_poin"] == total
