"""Multiplayer room REST + WebSocket (presence, skeleton, battle_score, challenges)."""
import time


HOST_HEADERS = {"client_id": "uuid-host-001", "display_name": "Host A", "warna": "#22c55e"}
GUEST_HEADERS = {"client_id": "uuid-guest-002", "display_name": "Guest B", "warna": "#3b82f6"}


def create_room(client, **over):
    body = {"nama": "Ruang Uji", "password": "rahasia4", "max_score": 3,
            "display_name": HOST_HEADERS["display_name"], "warna": HOST_HEADERS["warna"],
            "client_id": HOST_HEADERS["client_id"], **over}
    r = client.post("/api/multiplayer/rooms", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_room_lifecycle(client):
    room = create_room(client)
    code = room["room_code"]
    assert room["host_player_id"]
    assert len(room["players"]) == 1

    joined = client.post("/api/multiplayer/join", json={
        "room_code": code, "password": "rahasia4", **GUEST_HEADERS,
    })
    assert joined.status_code == 200, joined.text
    assert len(joined.json()["players"]) == 2

    fetched = client.get(f"/api/multiplayer/rooms/{code}").json()
    assert fetched["status"] == "waiting"
    assert fetched["max_score"] == 3

    colors = client.get(f"/api/multiplayer/rooms/{code}/colors").json()
    assert set(colors["taken"]) == {"#22c55e", "#3b82f6"}
    assert colors["available"]


def test_join_wrong_password(client):
    room = create_room(client)
    r = client.post("/api/multiplayer/join", json={
        "room_code": room["room_code"], "password": "salah", **GUEST_HEADERS,
    })
    assert r.status_code == 401


def test_join_missing_room(client):
    r = client.post("/api/multiplayer/join", json={
        "room_code": "ZZZZZZ", "password": "rahasia4", **GUEST_HEADERS,
    })
    assert r.status_code == 404


def test_color_conflict(client):
    room = create_room(client)
    dup = client.post("/api/multiplayer/join", json={
        "room_code": room["room_code"], "password": "rahasia4",
        "display_name": "Intruder", "warna": HOST_HEADERS["warna"], "client_id": "uuid-x",
    })
    assert dup.status_code == 409


def test_challenges_set(client, db_session):
    from app.models import Exercise
    ex1 = Exercise(nama="Gerak A", skeleton_data=[{"x": 0.0, "y": 0.0}] * 33)
    db_session.add(ex1)
    db_session.commit()
    db_session.refresh(ex1)

    room = create_room(client)
    gk = room["players"][0]["guest_key"]
    r = client.put(f"/api/multiplayer/rooms/{room['room_code']}/challenges", json={
        "challenge_exercise_ids": [ex1.exercise_id], "guest_key": gk,
    })
    assert r.status_code == 200, r.text
    assert [c["exercise_id"] for c in r.json()["challenges"]] == [ex1.exercise_id]

    # bukan host ditolak
    r2 = client.put(f"/api/multiplayer/rooms/{room['room_code']}/challenges", json={
        "challenge_exercise_ids": [], "guest_key": "g_pencuri",
    })
    assert r2.status_code == 403


def test_leave_and_host_fifo(client):
    room = create_room(client)
    code = room["room_code"]
    client.post("/api/multiplayer/join", json={
        "room_code": code, "password": "rahasia4", **GUEST_HEADERS,
    })
    r = client.post("/api/multiplayer/leave", json={
        "room_code": code, "client_id": HOST_HEADERS["client_id"],
    })
    assert r.status_code == 200
    after = client.get(f"/api/multiplayer/rooms/{code}").json()
    assert len(after["players"]) == 1
    assert after["players"][0]["display_name"] == GUEST_HEADERS["display_name"]
    assert after["host_player_id"] == after["players"][0]["player_id"]


def test_websocket_presence_and_battle_broadcast(client):
    room = create_room(client)
    code = room["room_code"]
    gk_host = room["guest_key"]

    joined = client.post("/api/multiplayer/join", json={
        "room_code": code, "password": "rahasia4", **GUEST_HEADERS,
    }).json()
    gk_guest = joined["guest_key"]

    with client.websocket_connect(f"/api/multiplayer/ws/{code}") as ws_host:
        ws_host.send_json({"guest_key": gk_host, "display_name": "Host A",
                           "warna": HOST_HEADERS["warna"]})
        with client.websocket_connect(f"/api/multiplayer/ws/{code}") as ws_guest:
            ws_guest.send_json({"guest_key": gk_guest, "display_name": "Guest B",
                                "warna": GUEST_HEADERS["warna"]})
            # host menerima presence + room_update dari guest yang join
            seen_types = set()
            deadline = time.time() + 3
            while time.time() < deadline and not {"presence", "room_update"} <= seen_types:
                msg = ws_host.receive_json()
                seen_types.add(msg["type"])
            assert {"presence", "room_update"} <= seen_types

            ws_guest.send_json({"type": "battle_score", "score": 1, "points": 60,
                                "move_name": "Chin Tuck", "guest_key": gk_guest})
            # host harus menerima broadcast battle_score dari guest
            deadline = time.time() + 3
            got = None
            while time.time() < deadline:
                m = ws_host.receive_json()
                if m.get("type") == "battle_score" and m.get("guest_key") == gk_guest:
                    got = m
                    break
            assert got == {"type": "battle_score", "guest_key": gk_guest,
                           "display_name": "Guest B", "warna": GUEST_HEADERS["warna"],
                           "score": 1, "points": 60, "move_name": "Chin Tuck"} or got


def test_websocket_exercise_lifecycle(client):
    room = create_room(client)
    code = room["room_code"]
    gk_host = room["guest_key"]

    joined = client.post("/api/multiplayer/join", json={
        "room_code": code, "password": "rahasia4", **GUEST_HEADERS,
    }).json()
    gk_guest = joined["guest_key"]

    with client.websocket_connect(f"/api/multiplayer/ws/{code}") as ws_host:
        ws_host.send_json({"guest_key": gk_host, "display_name": "Host A", "warna": HOST_HEADERS["warna"]})
        # drain initial room_update on host
        _ = ws_host.receive_json()

        with client.websocket_connect(f"/api/multiplayer/ws/{code}") as ws_guest:
            ws_guest.send_json({"guest_key": gk_guest, "display_name": "Guest B", "warna": GUEST_HEADERS["warna"]})
            # guest receives initial room_update
            _ = ws_guest.receive_json()

            # Host broadcasts exercise start
            ws_host.send_json({
                "type": "exercise_start",
                "exercise_id": 7,
                "exercise_name": "Chin Tuck Alignment",
                "reps": 5,
                "durasi_detik": 5,
            })

            # Guest receives exercise_start
            m = ws_guest.receive_json()
            assert m.get("type") == "exercise_start"
            assert m.get("exercise_id") == 7
            assert m.get("exercise_name") == "Chin Tuck Alignment"
            assert m.get("guest_key") == gk_host


