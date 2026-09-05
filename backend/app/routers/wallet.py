"""
GenPosFit - Router Wallet (MetaMask / EVM)
User biasa: minta challenge, verifikasi signature -> simpan wallet_address,
lihat status bindung, lepas wallet. Data alamat dibutuhkan utk distribusi
reward token GPC on-chain (Tahap berikutnya).
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.services import wallet as wallet_service

router = APIRouter(prefix="/api/wallet", tags=["Wallet"])


class ChallengeResponse(BaseModel):
    pesan: str
    nonce: str
    kedaluwarsa_detik: int


class VerifyRequest(BaseModel):
    address: str = Field(..., min_length=42, max_length=42)
    signature: str = Field(..., min_length=60)


class WalletStatus(BaseModel):
    connected: bool
    wallet_address: Optional[str] = None


@router.get("/challenge", response_model=ChallengeResponse)
def minta_challenge(user: User = Depends(get_current_user)):
    """Pesan yang harus ditandatangani via personal_sign (MetaMask)."""
    _, pesan = wallet_service.buat_challenge(user.user_id)
    return ChallengeResponse(pesan=pesan, nonce="rahasia-server", kedaluwarsa_detik=300)


@router.post("/verify", response_model=WalletStatus)
def verifikasi_dan_bind(payload: VerifyRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not wallet_service.alamat_valid(payload.address):
        raise HTTPException(422, "Format alamat wallet salah.")
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
    return WalletStatus(connected=True, wallet_address=hasil)


@router.get("/me", response_model=WalletStatus)
def status_wallet(user: User = Depends(get_current_user)):
    return WalletStatus(connected=bool(user.wallet_address), wallet_address=user.wallet_address)


@router.delete("/me", response_model=WalletStatus)
def lepas_wallet(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.wallet_address = None
    db.commit()
    return WalletStatus(connected=False, wallet_address=None)
