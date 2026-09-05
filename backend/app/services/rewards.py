"""
GenPosFit — Distribusi Reward Token GPC (Erc1155) di Sepolia Testnet
Trigger: tombol manual admin "Distribute Monthly Rewards".
Idempoten per (periode, user) lewat tabel GpcRewardTx; kegagalan on-chain
bisa di-retry tanpa mengirim dobel ke user yang sudah sukses.
"""
import json
import logging
import os
from decimal import Decimal
from functools import lru_cache
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.config import (
    GPC_CHAIN_ID,
    GPC_CONTRACT_ADDRESS,
    GPC_GAS_LIMIT,
    GPC_GAS_PRICE_WEI,
    GPC_REWARDS_ENABLED,
    GPC_REWARD_SCHEDULE,
    GPC_TREASURY_PRIVATE_KEY,
    SEPOLIA_RPC_URL,
)
from app.models import GpcRewardTx, User, utcnow
from app.services.leaderboard import peringkat_bulanan

logger = logging.getLogger("genposfit.rewards")

SATUAN_GPC = 10 ** 18  # 18 desimal
ABI_PATH = os.path.join(os.path.dirname(__file__), "..", "abis", "gpc_abi.json")


class RewardError(Exception):
    def __init__(self, status: int, pesan: str):
        super().__init__(pesan)
        self.status = status
        self.pesan = pesan


def _load_abi() -> list:
    with open(ABI_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def _contract():
    from web3 import Web3

    w3 = Web3(Web3.HTTPProvider(SEPOLIA_RPC_URL, request_kwargs={"timeout": 30}))
    if not w3.is_connected():
        raise RewardError(503, "RPC Sepolia tidak terjangkau.")
    addr = Web3.to_checksum_address(GPC_CONTRACT_ADDRESS)
    return w3, w3.eth.contract(address=addr, abi=_load_abi())


def kirim_mint(kontak: Any, wallet_address: str, jumlah_gpc: Decimal, private_key: str) -> str:
    """Panggil mint(address,uint256) sbg owner; return tx hash."""
    from web3 import Web3

    w3, kontrak = kontak
    rekening = w3.eth.account.from_key(private_key)
    nilai = int(Decimal(jumlah_gpc) * SATUAN_GPC)
    gas_price = GPC_GAS_PRICE_WEI or w3.eth.gas_price
    tx = kontrak.functions.mint(
        Web3.to_checksum_address(wallet_address), nilai
    ).build_transaction({
        "from": rekening.address,
        "nonce": w3.eth.get_transaction_count(rekening.address),
        "gas": GPC_GAS_LIMIT,
        "gasPrice": gas_price,
        "chainId": GPC_CHAIN_ID,
    })
    bertanda = rekening.sign_transaction(tx)
    raw = getattr(bertanda, "raw_transaction", None) or bertanda["raw"]
    hash_tx = w3.eth.send_raw_transaction(raw)
    return hash_tx.hex()


def _syarat_onchain_aktif() -> None:
    if not GPC_REWARDS_ENABLED:
        raise RewardError(409, "Distribusi on-chain dinonaktifkan (GPC_REWARDS_ENABLED=0).")
    if not (SEPOLIA_RPC_URL and GPC_CONTRACT_ADDRESS and GPC_TREASURY_PRIVATE_KEY):
        raise RewardError(503, "Konfigurasi Sepolia belum lengkap (RPC/contract/private key).")


def rencana_penerima(db: Session, periode: str, schedule: Optional[Dict[int, int]] = None) -> List[Dict[str, Any]]:
    """
    Pemuncak klasemen musim `periode` yg berhak GPC + status kesiapan wallet.
    Hanya user dengan poin_musim > 0 yang dipertimbangkan.
    """
    jadwal = schedule or GPC_REWARD_SCHEDULE
    batas = max(jadwal.keys()) if jadwal else 0
    data = peringkat_bulanan(db, periode, limit=max(batas, 1))
    rencana = []
    for entri in data["top"]:
        if entri["rank"] not in jadwal:
            continue
        if entri["poin_musim"] <= 0:
            continue
        user = db.query(User).filter_by(user_id=entri["user_id"]).first()
        rencana.append({
            "rank": entri["rank"],
            "user_id": entri["user_id"],
            "nama": entri["nama"],
            "username": entri["username"],
            "poin_musim": entri["poin_musim"],
            "jumlah_gpc": int(jadwal[entri["rank"]]),
            "wallet_address": getattr(user, "wallet_address", None),
            "siap": bool(getattr(user, "wallet_address", None)),
        })
    return rencana


def pratinjau(db: Session, periode: str) -> Dict[str, Any]:
    rencana = rencana_penerima(db, periode)
    sudah = {
        (row.user_id): row for row in db.query(GpcRewardTx).filter_by(periode=periode).all()
    }
    for r in rencana:
        baris = sudah.get(r["user_id"])
        r["riwayat_status"] = baris.status if baris else None
        r["riwayat_tx"] = baris.tx_hash if baris else None
    return {
        "periode": periode,
        "schedule_gpc": GPC_REWARD_SCHEDULE,
        "onchain_aktif": GPC_REWARDS_ENABLED,
        "contract_address": GPC_CONTRACT_ADDRESS or None,
        "penerima": rencana,
        "tanpa_wallet": [r["user_id"] for r in rencana if not r["siap"]],
    }


def distribusikan(db: Session, admin_id: int, periode: str, kering: bool = False) -> Dict[str, Any]:
    """
    Eksekusi distribusi utk satu periode. dry_run/`kering` = hanya menandai
    baris 'simulasi' tanpa on-chain (tetap idempoten utk preview angka).
    """
    rencana = rencana_penerima(db, periode)
    jika_tanpa = [r for r in rencana if not r.get("wallet_address")]
    untuk_dikirim = [r for r in rencana if r.get("wallet_address")]

    hasil = {"periode": periode, "dikirim": [], "lewat_sudah": [], "gagal": [], "tanpa_wallet": [], "simulasi": []}
    if kering:
        hasil["simulasi"] = rencana  # semua kandidat + flag 'siap' wallet
        hasil["tanpa_wallet"] = hasil_tanpa_wallet(jika_tanpa)
        return hasil

    _syarat_onchain_aktif()
    kontak = _contract()

    for r in untuk_dikirim:
        baris = db.query(GpcRewardTx).filter_by(periode=periode, user_id=r["user_id"]).first()
        if baris and baris.status == "sukses":
            hasil["lewat_sudah"].append({
                "user_id": r["user_id"], "tx": baris.tx_hash, "jumlah": str(baris.jumlah),
            })
            continue
        if not baris:
            baris = GpcRewardTx(
                periode=periode, user_id=r["user_id"], rank=r["rank"],
                wallet_address=r["wallet_address"], jumlah=Decimal(str(r["jumlah_gpc"])),
                status="pending",
            )
            db.add(baris)
            db.commit()
        try:
            hash_tx = kirim_mint(kontak, r["wallet_address"], r["jumlah_gpc"], GPC_TREASURY_PRIVATE_KEY)
            baris.status = "sukses"
            baris.tx_hash = hash_tx
            baris.error = None
            db.commit()
            hasil["dikirim"].append({"user_id": r["user_id"], "tx": hash_tx, "jumlah": str(baris.jumlah)})
            logger.info("GPC %s -> user %s tx %s", baris.jumlah, r["user_id"], hash_tx)
        except Exception as exc:  # noqa: BLE001 - catat semua kegagalan RPC/on-chain
            baris = db.query(GpcRewardTx).filter_by(id=baris.id).first()
            if baris is None:
                continue
            baris.status = "gagal"
            baris.error = str(exc)[:500]
            db.add(baris)
            db.commit()
            hasil["gagal"].append({"user_id": r["user_id"], "error": baris.error})
            logger.exception("Gagal kirim GPC user %s", r["user_id"])

    hasil["tanpa_wallet"] = hasil_tanpa_wallet(jika_tanpa)
    return hasil


def hasil_tanpa_wallet(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [
        {"user_id": x["user_id"], "nama": x["nama"], "rank": x["rank"]}
        for x in rows
    ]
