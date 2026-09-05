"""
GenPosFit — Router Multiplayer Room
Mendukung pembuatan & bergabung room ber-password, identitas pengunjung (session log)
berdasarkan header IP/browser (tanpa login), pengelolaan warna persona unik per room,
serta broadcast live skeleton semua player via WebSocket.
"""
import hashlib
import logging
import secrets
import json
from typing import List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import asc
from app.database import get_db, SessionLocal
from app.models import Room, RoomPlayer, Exercise
from app.security import hash_password, verify_password

router = APIRouter(prefix="/api/multiplayer", tags=["Multiplayer"])

logger = logging.getLogger("genposfit.multiplayer")

AVAILABLE_COLORS = [
    "#22c55e",  # hijau
    "#3b82f6",  # biru
    "#ef4444",  # merah
    "#f59e0b",  # amber
    "#8b5cf6",  # ungu
    "#ec4899",  # pink
    "#06b6d4",  # cyan
    "#f97316",  # oranye
]


class CreateRoomRequest(BaseModel):
    nama: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=4, max_length=128)
    display_name: str = Field(..., min_length=1, max_length=100)
    warna: str
    user_id: Optional[int] = None
    max_score: int = Field(default=10, ge=1, le=999)


class JoinRoomRequest(BaseModel):
    room_code: str
    password: str
    display_name: str = Field(..., min_length=1, max_length=100)
    warna: str
    user_id: Optional[int] = None


def guest_key_from_request(request: Request) -> str:
    ua = request.headers.get("user-agent", "")
    ip = request.client.host if request.client else ""
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    source = forwarded or ip
    return "g_" + hashlib.sha256(f"{source}|{ua[:80]}".encode()).hexdigest()[:16]


def register_player(
    db: Session, room: Room, name: str, warna: str, user_id: Optional[int], guest_key: str, is_host: bool = False
):
    taken = db.query(RoomPlayer).filter(RoomPlayer.room_id == room.room_id, RoomPlayer.warna == warna).first()
    if taken:
        raise HTTPException(status_code=409, detail="Warna sudah dipakai pemain lain.")
    existing = db.query(RoomPlayer).filter_by(room_id=room.room_id, guest_key=guest_key).first()
    if existing:
        existing.display_name = name
        existing.warna = warna
        existing.is_host = 1 if is_host else existing.is_host
        db.commit()
        db.refresh(existing)
        return existing
    p = RoomPlayer(room_id=room.room_id, user_id=user_id, guest_key=guest_key, display_name=name, warna=warna, is_host=1 if is_host else 0)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def room_dict(db: Session, room: Room) -> dict:
    ex_ids = room.exercises_json or []
    challenges = []
    if ex_ids:
        rows = db.query(Exercise).filter(Exercise.exercise_id.in_(ex_ids)).all()
        by_id = {r.exercise_id: r for r in rows}
        # Urutkan mengikuti order yang dipilih host
        challenges = [
            {"exercise_id": eid, "nama": by_id[eid].nama if eid in by_id else "Latihan"}
            for eid in ex_ids if eid in by_id
        ]
    return {
        "room_id": room.room_id,
        "room_code": room.room_code,
        "nama": room.nama,
        "status": room.status,
        "max_score": room.max_score,
        "challenge_exercise_ids": ex_ids,
        "challenges": challenges,
        "host_player_id": room.host_player_id,
        "players": [{"player_id": p.player_id, "display_name": p.display_name, "warna": p.warna, "is_host": bool(p.is_host), "user_id": p.user_id, "guest_key": p.guest_key} for p in room.players],
    }


@router.get("/colors")
def list_colors():
    return {"colors": AVAILABLE_COLORS}


@router.post("/rooms", status_code=201)
def create_room(payload: CreateRoomRequest, request: Request, db: Session = Depends(get_db)):
    guest_key = guest_key_from_request(request)
    code = secrets.token_hex(3).upper()
    while db.query(Room).filter_by(room_code=code).first():
        code = secrets.token_hex(3).upper()
    room = Room(room_code=code, nama=payload.nama, password_hash=hash_password(payload.password), max_score=payload.max_score)
    db.add(room)
    db.flush()
    p = register_player(db, room, payload.display_name, payload.warna, payload.user_id, guest_key, is_host=True)
    room.host_player_id = p.player_id
    db.commit()
    db.refresh(room)
    return {**room_dict(db, room), "guest_key": guest_key}


@router.post("/join")
def join_room(payload: JoinRoomRequest, request: Request, db: Session = Depends(get_db)):
    room = db.query(Room).filter_by(room_code=payload.room_code.strip().upper()).first()
    if not room:
        raise HTTPException(404, "Room tidak ditemukan.")
    if room.status == "ended":
        raise HTTPException(410, "Room sudah diakhiri.")
    if not verify_password(payload.password, room.password_hash):
        raise HTTPException(401, "Password room salah.")
    guest_key = guest_key_from_request(request)
    register_player(db, room, payload.display_name, payload.warna, payload.user_id, guest_key)
    return {**room_dict(db, room), "guest_key": guest_key}


@router.get("/rooms/{room_code}")
def get_room(room_code: str, db: Session = Depends(get_db)):
    room = db.query(Room).filter_by(room_code=room_code.strip().upper()).first()
    if not room:
        raise HTTPException(404, "Room tidak ditemukan.")
    return room_dict(db, room)


@router.get("/rooms/{room_code}/colors")
def room_taken_colors(room_code: str, db: Session = Depends(get_db)):
    room = db.query(Room).filter_by(room_code=room_code.strip().upper()).first()
    if not room:
        raise HTTPException(404, "Room tidak ditemukan.")
    players = db.query(RoomPlayer).filter_by(room_id=room.room_id).all()
    taken = [p.warna for p in players]
    return {"taken": taken, "available": [c for c in AVAILABLE_COLORS if c not in taken]}


class SetChallengeRequest(BaseModel):
    challenge_exercise_ids: List[int] = []


@router.put("/rooms/{room_code}/challenges")
def set_room_challenges(room_code: str, payload: SetChallengeRequest, request: Request, db: Session = Depends(get_db)):
    """Host mengatur daftar gerakan latihan yang akan ditantangkan di room (bisa lebih dari satu)."""
    room = db.query(Room).filter_by(room_code=room_code.strip().upper()).first()
    if not room:
        raise HTTPException(404, "Room tidak ditemukan.")
    guest_key = guest_key_from_request(request)
    # Verifikasi bahwa yang request adalah host
    host_player = db.query(RoomPlayer).filter_by(room_id=room.room_id, player_id=room.host_player_id).first()
    if not host_player or (host_player.guest_key != guest_key and host_player.user_id is None):
        raise HTTPException(403, "Hanya host room yang bisa mengatur tantangan.")
    # Validasi exercise_ids exist
    if payload.challenge_exercise_ids:
        count = db.query(Exercise).filter(Exercise.exercise_id.in_(payload.challenge_exercise_ids)).count()
        if count != len(payload.challenge_exercise_ids):
            raise HTTPException(400, "Beberapa ID latihan tidak ditemukan.")
    room.exercises_json = payload.challenge_exercise_ids
    db.commit()
    db.refresh(room)
    return room_dict(db, room)


def transfer_host_fifo(db: Session, room: Room, leaving_key: str | None = None):
    """Jika host keluar (atau socket host disconnect) dan masih ada pemain lain,
    pindahkan host secara FIFO (pemain yang masuk paling awal menjadi host baru).
    Room TIDAK dibubarkan selama masih ada pemain. Jika tidak ada pemain lagi,
    room baru ditandai 'ended' (tidak dibubarkan, tetap tersimpan untuk riwayat)."""
    players = (
        db.query(RoomPlayer)
        .filter(RoomPlayer.room_id == room.room_id)
        .order_by(asc(RoomPlayer.joined_at), asc(RoomPlayer.player_id))
        .all()
    )
    if not players:
        # Tidak ada pemain tersisa → room diakhiri tetapi TIDAK dihapus.
        room.status = "ended"
        room.host_player_id = None
        db.commit()
        return None

    # Ambil pemain non-host pertama (FIFO) sebagai host baru
    new_host = players[0]
    room.host_player_id = new_host.player_id
    room.status = "waiting"
    for p in players:
        p.is_host = 1 if p.player_id == new_host.player_id else 0
    db.commit()
    db.refresh(room)
    return new_host


class LeaveRoomRequest(BaseModel):
    room_code: str
    guest_key: Optional[str] = None
    user_id: Optional[int] = None


@router.post("/leave")
def leave_room(payload: LeaveRoomRequest, request: Request, db: Session = Depends(get_db)):
    """Pemain keluar dari room. Jika ia host & masih ada pemain lain, host
    dipindah FIFO ke pemain tercepat masuk. Room tetap tersimpan (tidak dilarut)."""
    room = db.query(Room).filter_by(room_code=payload.room_code.strip().upper()).first()
    if not room:
        raise HTTPException(404, "Room tidak ditemukan.")
    if room.status == "ended":
        return {"message": "Room sudah diakhiri.", "room": room_dict(db, room)}

    # Temukan pemain yang keluar
    leaving = None
    if payload.guest_key:
        leaving = db.query(RoomPlayer).filter_by(room_id=room.room_id, guest_key=payload.guest_key).first()
    elif payload.user_id:
        leaving = db.query(RoomPlayer).filter_by(room_id=room.room_id, user_id=payload.user_id).first()
    else:
        guest_key = guest_key_from_request(request)
        leaving = db.query(RoomPlayer).filter_by(room_id=room.room_id, guest_key=guest_key).first()

    is_host = leaving is not None and room.host_player_id is not None and leaving.player_id == room.host_player_id

    if not leaving:
        return {"message": "Pemain tidak ditemukan di room.", "room": room_dict(db, room)}

    if is_host:
        # Host keluar → transfer host FIFO ke pemain lain TERLEBIH DAHULU
        # (sebelum menghapus host, agar FK host_player_id tetap valid)
        next_host = (
            db.query(RoomPlayer)
            .filter(RoomPlayer.room_id == room.room_id, RoomPlayer.player_id != leaving.player_id)
            .order_by(asc(RoomPlayer.joined_at), asc(RoomPlayer.player_id))
            .first()
        )
        if next_host:
            room.host_player_id = next_host.player_id
            for p in db.query(RoomPlayer).filter(RoomPlayer.room_id == room.room_id).all():
                p.is_host = 1 if p.player_id == next_host.player_id else 0
            db.flush()
            # Hapus host lama
            db.delete(leaving)
            db.commit()
            logger.info(f"Host transfer FIFO ke player {next_host.display_name}")
        else:
            # Tidak ada pemain lain → akhiri room (tetap tersimpan)
            room.host_player_id = None
            room.status = "ended"
            db.flush()
            db.delete(leaving)
            db.commit()
    else:
        # Bukan host → hapus langsung
        db.delete(leaving)
        db.commit()

    return {"message": "Berhasil keluar dari room.", "room": room_dict(db, room)}


# --- WebSocket ---

class WSClient:
    def __init__(self, ws: WebSocket, code: str, key: str):
        self.ws = ws
        self.code = code
        self.key = key


class RoomHub:
    def __init__(self):
        self.rooms: Dict[str, list[WSClient]] = {}

    def add(self, c: WSClient):
        self.rooms.setdefault(c.code, []).append(c)

    def remove(self, c: WSClient):
        ls = self.rooms.get(c.code, [])
        if c in ls:
            ls.remove(c)
        if not ls:
            self.rooms.pop(c.code, None)

    async def broadcast(self, code: str, msg: dict, exclude: WSClient | None = None):
        for c in list(self.rooms.get(code, [])):
            if c is exclude:
                continue
            try:
                await c.ws.send_json(msg)
            except Exception:
                pass


hub = RoomHub()


@router.websocket("/ws/{room_code}")
async def multiplayer_ws(websocket: WebSocket, room_code: str):
    await websocket.accept()
    code = room_code.strip().upper()
    db = SessionLocal()
    guest_key = ""
    name = "Player"
    warna = "#22c55e"
    client = None
    try:
        data = json.loads(await websocket.receive_text())
        guest_key = data.get("guest_key", "")
        name = data.get("display_name", "Player")
        warna = data.get("warna", "#22c55e")

        client = WSClient(websocket, code, guest_key)
        hub.add(client)
        await hub.broadcast(code, {"type": "presence", "guest_key": guest_key, "display_name": name, "warna": warna})

        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get("type", "skeleton")
            if msg_type == "battle_score":
                # Skor battle dari pemain; broadcast ke semua (excl sender).
                await hub.broadcast(code, {
                    "type": "battle_score",
                    "guest_key": guest_key,
                    "display_name": name,
                    "warna": warna,
                    "score": msg.get("score", 0),
                    "points": msg.get("points", 0),
                    "move_name": msg.get("move_name", ""),
                }, exclude=client)
                continue
            if msg_type == "challenge_update":
                # Host mengatur daftar gerakan tantangan; simpan ke DB dan broadcast ke semua.
                ids = msg.get("challenge_exercise_ids", [])
                room = db.query(Room).filter_by(room_code=code).first()
                if room and room.host_player_id:
                    host_player = db.query(RoomPlayer).filter_by(room_id=room.room_id, player_id=room.host_player_id).first()
                    if host_player and host_player.guest_key == guest_key:
                        room.exercises_json = ids
                        db.commit()
                await hub.broadcast(code, {
                    "type": "challenge_update",
                    "guest_key": guest_key,
                    "challenge_exercise_ids": ids,
                })
                continue
            landmarks = msg.get("landmarks", [])
            if landmarks:
                await hub.broadcast(code, {
                    "type": "skeleton",
                    "guest_key": guest_key,
                    "display_name": name,
                    "warna": warna,
                    "landmarks": landmarks,
                    "tipe_pose": msg.get("tipe_pose", "duduk_rileks"),
                }, exclude=client)
    except WebSocketDisconnect:
        if client is not None:
            hub.remove(client)
        logger.info(f"Client {guest_key} disconnected from {code}")
        # Jika host socket-nya disconnect, transfer host FIFO ke pemain lain (room tetap ada)
        try:
            room = db.query(Room).filter_by(room_code=code).first()
            if room and room.host_player_id and guest_key:
                host_player = db.query(RoomPlayer).filter_by(
                    room_id=room.room_id, player_id=room.host_player_id
                ).first()
                if host_player and host_player.guest_key == guest_key:
                    next_host = (
                        db.query(RoomPlayer)
                        .filter(RoomPlayer.room_id == room.room_id, RoomPlayer.player_id != host_player.player_id)
                        .order_by(asc(RoomPlayer.joined_at), asc(RoomPlayer.player_id))
                        .first()
                    )
                    if next_host:
                        room.host_player_id = next_host.player_id
                        for p in db.query(RoomPlayer).filter(RoomPlayer.room_id == room.room_id).all():
                            p.is_host = 1 if p.player_id == next_host.player_id else 0
                        db.commit()
                        logger.info(f"Host transfer FIFO (disconnect) ke {next_host.display_name}")
                    else:
                        room.status = "ended"
                        room.host_player_id = None
                        db.commit()
        except Exception:
            pass
    except Exception as e:
        if client is not None:
            hub.remove(client)
        logger.error("WS error: %s", e)
    finally:
        if guest_key:
            await hub.broadcast(code, {"type": "leave", "guest_key": guest_key})
            # Broadcast host transfer info
            try:
                room = db.query(Room).filter_by(room_code=code).first()
                if room:
                    await hub.broadcast(code, {"type": "room_update", "room": room_dict(db, room)})
            except Exception:
                pass
        db.close()