"""
GenPosFit - Layanan Wallet EVM (MetaMask)
Proof-of-ownership lewat pesan bertanda tangan (EIP-191 personal_sign).
Tantangan (nonce) disimpan in-memory dengan TTL; nonce sekali pakai.
"""
import re
import secrets
import threading
import time
from typing import Dict, Optional, Tuple

from eth_account import Account
from eth_account.messages import encode_defunct

POLA_ALAMAT = re.compile(r"^0x[a-fA-F0-9]{40}$")
TTL_NONCE_DETIK = 300
_challenge_lock = threading.Lock()
# user_id -> (nonce, pesan, kedaluwarsa_epoch)
_challenge_store: Dict[int, Tuple[str, str, float]] = {}


def _susun_pesan(user_id: int, nonce: str, kedaluwarsa: float) -> str:
    return (
        "GenPosFit Wallet Binding\n"
        f"Akun: #{user_id}\n"
        f"Nonce: {nonce}\n"
        f"Kedaluwarsa: {int(kedaluwarsa)}\n"
        "Tanda tangani pesan ini untuk menghubungkan alamat wallet Anda "
        "ke akun GenPosFit dan menerima reward GPC."
    )


def buat_challenge(user_id: int) -> Tuple[str, str]:
    """Kembalikan (nonce, pesan) yang harus ditandatangani user via MetaMask."""
    nonce = secrets.token_hex(8)
    kedaluwarsa = time.time() + TTL_NONCE_DETIK
    pesan = _susun_pesan(user_id, nonce, kedaluwarsa)
    with _challenge_lock:
        for uid in [u for u, (_, _, d) in _challenge_store.items() if d < time.time()]:
            _challenge_store.pop(uid, None)
        _challenge_store[user_id] = (nonce, pesan, kedaluwarsa)
    return nonce, pesan


def alamat_valid(address: Optional[str]) -> bool:
    return bool(address and POLA_ALAMAT.match(address))


def verifikasi_challenge(user_id: int, address: str, signature: str) -> Tuple[bool, str]:
    """
    Verifikasi signature personal_sign terhadap pesan challenge aktif user.
    Return (ok, pesan_error_atau_address_EIP55). Nonce sekali pakai.
    """
    if not alamat_valid(address):
        return False, "Format alamat wallet tidak valid (0x + 40 hex)."
    try:
        sig_bytes = bytes.fromhex(signature[2:] if signature.startswith("0x") else signature)
    except (ValueError, AttributeError):
        return False, "Signature hex tidak valid."

    with _challenge_lock:
        data = _challenge_store.get(user_id)
    if not data or len(data) < 3:
        return False, "Tidak ada tantangan aktif. Minta /api/wallet/challenge lagi."
    _, pesan, kedaluwarsa = data
    if time.time() > kedaluwarsa:
        with _challenge_lock:
            _challenge_store.pop(user_id, None)
        return False, "Tantangan kedaluwarsa. Ulangi permintaan challenge."

    try:
        recovered = Account.recover_message(encode_defunct(text=pesan), signature=sig_bytes)
    except Exception:
        return False, "Signature tidak dapat diverifikasi."
    if recovered.lower() != address.lower():
        return False, "Signature tidak cocok dengan alamat wallet yang dilaporkan."

    with _challenge_lock:
        _challenge_store.pop(user_id, None)  # nonce habis dipakai
    return True, recovered
