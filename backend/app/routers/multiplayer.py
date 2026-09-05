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
from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database import get_db, SessionLocal
from app.models import Room, RoomPlayer
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
    players = db.query(RoomPlayer).filter_by(room_id=room.room_id).all()
    return {
        "room_id": room.room_id,
        "room_code": room.room_code,
        "nama": room.nama,
        "status": room.status,
        "host_player_id": room.host_player_id,
        "players": [{"player_id": p.player_id, "display_name": p.display_name, "warna": p.warna, "is_host": bool(p.is_host), "user_id": p.user_id} for p in players],
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
    room = Room(room_code=code, nama=payload.nama, password_hash=hash_password(payload.password))
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
        pass
    except Exception as e:
        logger.error("WS error: %s", e)
    finally:
        if guest_key:
            await hub.broadcast(code, {"type": "leave", "guest_key": guest_key})
        db.close()