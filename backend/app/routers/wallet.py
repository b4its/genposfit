"""
GenPosFit - Router Wallet (EVM / Dompet Komunitas)
Mendukung koneksi MetaMask (opsional) atau langsung menggunakan dompet komunitas
default (0x6EdcA860c066FCdA6c434095d5901810DCE12b48) tanpa memerlukan ekstensi MetaMask.
Pendapatan GPC dihitung spesifik per akun user_id, bukan saldo total dompet bersama.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import GPC_DEFAULT_REWARD_WALLET
from app.database import get_db
from app.deps import get_current_user
from app.models import GpcRewardTx, User
from app.services import wallet as wallet_service

router = APIRouter(prefix="/api/wallet", tags=["Wallet"])


class ChallengeResponse(BaseModel):
    pesan: str
    nonce: str
    kedaluwarsa_detik: int


class VerifyRequest(BaseModel):
    address: str = Field(..., min_length=42, max_length=42)
    signature: str = Field(..., min_length=60)


class WalletRewardItem(BaseModel):
    id: int
    periode: str
    rank: int
    jumlah: float
    tx_hash: Optional[str] = None
    status: str
    created_at: Optional[str] = None


class WalletStatus(BaseModel):
    connected: bool
    wallet_address: Optional[str] = None
    is_default: bool = False
    default_wallet: str = GPC_DEFAULT_REWARD_WALLET
    total_gpc_diterima: float = 0.0
    jumlah_transaksi_sukses: int = 0
    riwayat_reward: List[WalletRewardItem] = []


def buat_status_wallet(db: Session, user: User) -> WalletStatus:
    addr = user.wallet_address
    is_default = bool(addr and addr.lower() == GPC_DEFAULT_REWARD_WALLET.lower())

    # Pendapatan khusus akun ini dihitung dari riwayat reward sukses user_id terkait
    sukses_rows = (
        db.query(GpcRewardTx)
        .filter(GpcRewardTx.user_id == user.user_id, GpcRewardTx.status == "sukses")
        .order_by(GpcRewardTx.created_at.desc())
        .all()
    )
    total_gpc = sum(float(r.jumlah) for r in sukses_rows)

    riwayat = [
        WalletRewardItem(
            id=r.id,
            periode=r.periode,
            rank=r.rank,
            jumlah=float(r.jumlah),
            tx_hash=r.tx_hash,
            status=r.status,
            created_at=r.created_at.isoformat() if r.created_at else None,
        )
        for r in sukses_rows
    ]

    return WalletStatus(
        connected=bool(user.wallet_address),
        wallet_address=user.wallet_address,
        is_default=is_default,
        default_wallet=GPC_DEFAULT_REWARD_WALLET,
        total_gpc_diterima=total_gpc,
        jumlah_transaksi_sukses=len(sukses_rows),
        riwayat_reward=riwayat,
    )


@router.get("/challenge", response_model=ChallengeResponse)
def minta_challenge(user: User = Depends(get_current_user)):
    """Pesan yang harus ditandatangani via personal_sign (MetaMask)."""
    _, pesan = wallet_service.buat_challenge(user.user_id)
    return ChallengeResponse(pesan=pesan, nonce="rahasia-server", kedaluwarsa_detik=300)


@router.post("/verify", response_model=WalletStatus)
def verifikasi_dan_bind(payload: VerifyRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not wallet_service.alamat_valid(payload.address):
        raise HTTPException(422, "Format alamat wallet salah.")

    # Dompet komunitas default boleh dipakai oleh semua akun
    if payload.address.lower() != GPC_DEFAULT_REWARD_WALLET.lower():
        lain = db.query(User).filter(
            User.wallet_address == payload.address, User.user_id != user.user_id
        ).first()
        if lain:
            raise HTTPException(409, "Alamat wallet sudah terhubung ke akun lain.")

    ok, hasil = wallet_service.verifikasi_challenge(user.user_id, payload.address, payload.signature)
    if not ok:
        raise HTTPException(401, hasil)
    user.wallet_address = hasil
    db.commit()
    return buat_status_wallet(db, user)


@router.post("/bind-default", response_model=WalletStatus)
def gunakan_dompet_default(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Langsung gunakan dompet komunitas default (0x6Edc...2b48) tanpa perlu MetaMask."""
    user.wallet_address = GPC_DEFAULT_REWARD_WALLET
    db.commit()
    return buat_status_wallet(db, user)


@router.get("/me", response_model=WalletStatus)
def status_wallet(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return buat_status_wallet(db, user)


@router.delete("/me", response_model=WalletStatus)
def lepas_wallet(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.wallet_address = None
    db.commit()
    return buat_status_wallet(db, user)

