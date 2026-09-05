"""
GenPosFit — SQLAlchemy ORM Models
Definisi tabel database sesuai skema MySQL GenPosFit.
"""
from datetime import datetime, timezone


def utcnow() -> datetime:
    """Current UTC time as a naive datetime (for MySQL DATETIME columns)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
from sqlalchemy import (
    Column, Integer, BigInteger, SmallInteger, String, Text,
    DECIMAL, DateTime, ForeignKey, UniqueConstraint, Index, JSON
)
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    nama = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=True)
    pekerjaan = Column(String(100), nullable=True)
    jam_kerja_hari = Column(SmallInteger, default=8)
    role = Column(String(20), default="user")  # 'user', 'admin'
    poin = Column(Integer, default=0)
    saldo = Column(DECIMAL(18, 2), default=0.00)
    wallet_address = Column(String(42), nullable=True, unique=True)  # EVM (MetaMask) utk reward GPC on-chain
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    # Relationships
    baselines = relationship("PoseBaseline", back_populates="user", cascade="all, delete-orphan")
    posture_logs = relationship("PostureLog", back_populates="user", cascade="all, delete-orphan")
    exercise_sessions = relationship("ExerciseSession", back_populates="user", cascade="all, delete-orphan")


class PoseBaseline(Base):
    __tablename__ = "pose_baseline"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    orientasi = Column(String(20), nullable=False)  # 'frontal', 'lateral_kiri', 'lateral_kanan'
    tipe_pose = Column(String(30), nullable=False)  # 'berdiri_tegak', 'berdiri_rileks', 'duduk_tegak', 'duduk_rileks'
    sudut_leher = Column(DECIMAL(6, 2), nullable=False)
    sudut_punggung = Column(DECIMAL(6, 2), nullable=False)
    level_bahu = Column(DECIMAL(6, 4), nullable=False)
    std_leher = Column(DECIMAL(6, 3), nullable=False)
    std_punggung = Column(DECIMAL(6, 3), nullable=False)
    n_frame = Column(SmallInteger, nullable=False)
    recorded_at = Column(DateTime, default=utcnow)

    user = relationship("User", back_populates="baselines")

    __table_args__ = (
        UniqueConstraint("user_id", "orientasi", "tipe_pose", name="uq_user_pose"),
    )


class PostureLog(Base):
    __tablename__ = "posture_logs"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    sesi_id = Column(String(64), nullable=True)
    timestamp = Column(DateTime, default=utcnow)
    sudut_leher = Column(DECIMAL(6, 2), nullable=False)
    sudut_punggung = Column(DECIMAL(6, 2), nullable=False)
    level_bahu = Column(DECIMAL(6, 4), nullable=True)
    skor_deviasi = Column(DECIMAL(5, 2), nullable=False)
    status = Column(String(20), nullable=False)  # 'bagus', 'ringan', 'buruk'
    # Skor kualitas data telemetri frame ini (0-100) dari analisis_kualitas_landmarks.
    # NULL berarti log dibuat sebelum sistem kualitas data aktif.
    kualitas_data = Column(DECIMAL(5, 2), nullable=True)

    user = relationship("User", back_populates="posture_logs")

    __table_args__ = (
        Index("idx_user_time", "user_id", "timestamp"),
    )


class ExerciseType(Base):
    __tablename__ = "exercise_types"

    type_id = Column(Integer, primary_key=True, autoincrement=True)
    nama = Column(String(100), nullable=False)  # nama jenis latihan (parent)
    deskripsi = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    children = relationship(
        "Exercise", back_populates="parent_type", cascade="all, delete-orphan"
    )


class Exercise(Base):
    __tablename__ = "exercises"

    exercise_id = Column(Integer, primary_key=True, autoincrement=True)
    type_id = Column(Integer, ForeignKey("exercise_types.type_id", ondelete="CASCADE"), nullable=True, index=True)
    nama = Column(String(100), nullable=False)
    deskripsi = Column(Text, nullable=True)
    target_otot = Column(String(150), nullable=True)
    sudut_target = Column(JSON, nullable=True)
    skeleton_data = Column(JSON, nullable=True)  # 33 landmark reference yang direkam admin
    sudut_leher = Column(DECIMAL(6, 2), nullable=True)
    sudut_punggung = Column(DECIMAL(6, 2), nullable=True)
    durasi_detik = Column(SmallInteger, nullable=True)
    reps = Column(SmallInteger, default=10)
    tingkat = Column(String(20), default="pemula")  # 'pemula', 'menengah', 'lanjut'
    is_battle = Column(SmallInteger, default=0)  # 1 = bisa dipakai gerakan battle multiplayer

    sessions = relationship("ExerciseSession", back_populates="exercise")
    parent_type = relationship("ExerciseType", back_populates="children")


class ExerciseSession(Base):
    __tablename__ = "exercise_sessions"

    session_id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    exercise_id = Column(Integer, ForeignKey("exercises.exercise_id"), nullable=False)
    total_reps = Column(SmallInteger, nullable=True)
    avg_skor = Column(DECIMAL(5, 2), nullable=True)
    selesai_at = Column(DateTime, default=utcnow)

    user = relationship("User", back_populates="exercise_sessions")
    exercise = relationship("Exercise", back_populates="sessions")


class Room(Base):
    __tablename__ = "rooms"

    room_id = Column(Integer, primary_key=True, autoincrement=True)
    room_code = Column(String(20), unique=True, nullable=False, index=True)
    nama = Column(String(100), nullable=False)
    password_hash = Column(String(255), nullable=False)
    host_player_id = Column(
        Integer,
        ForeignKey("room_players.player_id", use_alter=True, name="fk_rooms_host"),
        nullable=True,
    )
    status = Column(String(20), default="waiting")  # 'waiting', 'playing', 'ended'
    max_score = Column(Integer, default=10, nullable=False)  # batas poin pemenang battle (ditetapkan host)
    exercises_json = Column(JSON, nullable=True)  # daftar exercise_id untuk challenge dipilih host
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    host = relationship("RoomPlayer", foreign_keys=[host_player_id], post_update=True)
    players = relationship("RoomPlayer", foreign_keys="RoomPlayer.room_id", back_populates="room", cascade="all, delete-orphan")


class RoomPlayer(Base):
    __tablename__ = "room_players"

    player_id = Column(Integer, primary_key=True, autoincrement=True)
    room_id = Column(Integer, ForeignKey("rooms.room_id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=True)  # akun; kosong jika tamu
    guest_key = Column(String(50), nullable=True, index=True)  # identitas sesi tamu (kombinasi IP/browser)
    display_name = Column(String(100), nullable=False)
    warna = Column(String(20), nullable=False)  # hex warna persona
    is_host = Column(SmallInteger, default=0)
    joined_at = Column(DateTime, default=utcnow)

    room = relationship("Room", back_populates="players", foreign_keys=[room_id])
    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("room_id", "warna", name="uq_room_color"),
        UniqueConstraint("room_id", "guest_key", name="uq_room_guest"),
    )


class PointLedger(Base):
    """
    Buku besar mutasi poin. Satu baris = satu perubahan poin user.
    Menjadi sumber kebenaran peringkat bulanan (group per `periode` YYYY-MM),
    sekaligus audit anti-cheat (alasan + referensi sumber poin).
    """
    __tablename__ = "point_ledger"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    delta = Column(Integer, nullable=False)
    alasan = Column(String(50), nullable=False)          # 'misi:xxx', 'battle_menang', 'klaim_admin', dll
    periode = Column(String(7), nullable=False, index=True)  # 'YYYY-MM' (musimming bulanan)
    ref_tipe = Column(String(30), nullable=True)
    ref_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=utcnow, index=True)

    user = relationship("User")

    __table_args__ = (
        Index("idx_ledger_user_periode", "user_id", "periode"),
    )


class Quest(Base):
    """
    Template misi harian / mingguan. `metrik` menentukan dari tabel mana progres
    dihitung otomatis (lihat services/quests.py). Seed default via ensure_quests().
    """
    __tablename__ = "quests"

    quest_id = Column(Integer, primary_key=True, autoincrement=True)
    kode = Column(String(50), unique=True, nullable=False, index=True)
    judul = Column(String(120), nullable=False)
    deskripsi = Column(String(300), nullable=True)
    kategori = Column(String(12), nullable=False)   # 'harian' | 'mingguan'
    metrik = Column(String(50), nullable=False)     # postur_bagus | latihan_selesai | kalibrasi | sesi_multiplayer | battle_menang
    target = Column(Integer, nullable=False, default=5)
    reward_poin = Column(Integer, nullable=False, default=10)
    aktif = Column(SmallInteger, nullable=False, default=1)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class UserQuest(Base):
    """Progres/klaim seorang user terhadap satu quest pada satu periode."""
    __tablename__ = "user_quests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    quest_id = Column(Integer, ForeignKey("quests.quest_id", ondelete="CASCADE"), nullable=False)
    periode = Column(String(10), nullable=False)   # harian 'YYYY-MM-DD', mingguan 'YYYY-Wnn'
    progres = Column(Integer, nullable=False, default=0)
    status = Column(String(12), nullable=False, default="aktif")  # 'aktif' | 'selesai' | 'diklaim'
    created_at = Column(DateTime, default=utcnow)
    claimed_at = Column(DateTime, nullable=True)

    user = relationship("User")
    quest = relationship("Quest")

    __table_args__ = (
        UniqueConstraint("user_id", "quest_id", "periode", name="uq_user_quest_periode"),
        Index("idx_userquest_user", "user_id", "periode"),
    )


class BattleResult(Base):
    """
    Hasil satu battle multiplayer (satu baris per peserta terautentikasi).
    `battle_id` unik per sesi battle yang dilaporkan frontend sehingga
    pelaporan ulang idempoten (anti point-farming).
    """
    __tablename__ = "battle_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    battle_id = Column(String(64), nullable=False, index=True)
    room_code = Column(String(20), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    display_name = Column(String(100), nullable=True)
    score_akhir = Column(Integer, nullable=False, default=0)
    is_winner = Column(SmallInteger, nullable=False, default=0)
    awarded_poin = Column(Integer, nullable=False, default=0)
    quality_ok = Column(SmallInteger, nullable=False, default=1)
    created_at = Column(DateTime, default=utcnow)

    __table_args__ = (
        UniqueConstraint("battle_id", "user_id", name="uq_battle_participant"),
    )
