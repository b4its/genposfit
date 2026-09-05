"""
GenPosFit — Distribusi Reward Token GPC (Erc1155) di Sepolia Testnet
Trigger: tombol manual admin "Distribute Monthly Rewards" & shortcut khusus pengguna.
Idempoten per (periode, user) lewat tabel GpcRewardTx; kegagalan on-chain
bisa di-retry tanpa mengirim dobel ke user yang sudah sukses.
"""
import inspect
import json
import logging
import os
from decimal import Decimal
from functools import lru_cache
from typing import Any, Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import (
    GPC_CHAIN_ID,
    GPC_CONTRACT_ADDRESS,
    GPC_DEFAULT_REWARD_WALLET,
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


def kirim_mint(
    kontak: Any,
    wallet_address: str,
    jumlah_gpc: Decimal,
    private_key: str,
    nonce: Optional[int] = None,
) -> str:
    """Panggil mint(address,uint256) sbg owner; return tx hash."""
    from web3 import Web3

    w3, kontrak = kontak
    rekening = w3.eth.account.from_key(private_key)
    nilai = int(Decimal(str(jumlah_gpc)) * SATUAN_GPC)
    gas_price = GPC_GAS_PRICE_WEI or w3.eth.gas_price
    tx_nonce = nonce if nonce is not None else w3.eth.get_transaction_count(rekening.address, "pending")
    tx = kontrak.functions.mint(
        Web3.to_checksum_address(wallet_address), nilai
    ).build_transaction({
        "from": rekening.address,
        "nonce": tx_nonce,
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


def rencana_penerima(
    db: Session,
    periode: str,
    schedule: Optional[Dict[int, int]] = None,
    hanya_role_user: bool = False,
    use_default_wallet: bool = False,
    custom_default_wallet: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Pemuncak klasemen musim `periode` yg berhak GPC + status kesiapan wallet.
    Hanya user dengan poin_musim > 0 yang dipertimbangkan.
    Jika `hanya_role_user` True, admin dilewati.
    Jika `use_default_wallet` True, user tanpa wallet dialihkan ke dompet komunitas fallback.
    """
    jadwal = schedule or GPC_REWARD_SCHEDULE
    batas = max(jadwal.keys()) if jadwal else 0
    data = peringkat_bulanan(db, periode, limit=max(batas, 1))
    rencana = []
    fallback_target = custom_default_wallet or GPC_DEFAULT_REWARD_WALLET

    for entri in data["top"]:
        if entri["rank"] not in jadwal:
            continue
        if entri["poin_musim"] <= 0:
            continue
        user = db.query(User).filter_by(user_id=entri["user_id"]).first()
        user_role = (getattr(user, "role", None) or entri.get("role") or "user").lower()
        if hanya_role_user and user_role == "admin":
            continue

        raw_wallet = getattr(user, "wallet_address", None)
        is_default_wallet = False
        if not raw_wallet and use_default_wallet and fallback_target:
            wallet_address = fallback_target
            is_default_wallet = True
        else:
            wallet_address = raw_wallet

        rencana.append({
            "rank": entri["rank"],
            "user_id": entri["user_id"],
            "nama": entri["nama"],
            "username": entri["username"],
            "role": user_role,
            "poin_musim": entri["poin_musim"],
            "jumlah_gpc": int(jadwal[entri["rank"]]),
            "wallet_address": wallet_address,
            "is_default_wallet": is_default_wallet,
            "siap": bool(wallet_address),
        })
    return rencana


def ringkas_dompet(db: Session, penerima_siap: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Agregasi reward per alamat dompet tujuan, menghitung total GPC periode ini,
    jumlah user terkait, rincian per user, dan akumulasi historis sukses.
    """
    if not penerima_siap:
        return []

    wallet_addresses = list({r["wallet_address"] for r in penerima_siap if r.get("wallet_address")})
    historis_map: Dict[str, float] = {}
    if wallet_addresses:
        rows = (
            db.query(GpcRewardTx.wallet_address, func.sum(GpcRewardTx.jumlah))
            .filter(GpcRewardTx.status == "sukses", GpcRewardTx.wallet_address.in_(wallet_addresses))
            .group_by(GpcRewardTx.wallet_address)
            .all()
        )
        for w, total in rows:
            if w:
                historis_map[w.lower()] = float(total or 0)

    grup: Dict[str, Dict[str, Any]] = {}
    for r in penerima_siap:
        w = r.get("wallet_address")
        if not w:
            continue
        kunci = w.lower()
        if kunci not in grup:
            grup[kunci] = {
                "wallet_address": w,
                "is_default_wallet": bool(r.get("is_default_wallet", False)),
                "total_gpc_periode": 0,
                "jumlah_user": 0,
                "user_ids": [],
                "users": [],
                "total_gpc_historis": historis_map.get(kunci, 0.0),
                "total_gpc_akumulasi": historis_map.get(kunci, 0.0),
            }
        grup[kunci]["total_gpc_periode"] += int(r["jumlah_gpc"])
        grup[kunci]["jumlah_user"] += 1
        grup[kunci]["user_ids"].append(r["user_id"])
        grup[kunci]["users"].append({
            "user_id": r["user_id"],
            "username": r.get("username"),
            "nama": r.get("nama"),
            "role": r.get("role", "user"),
            "rank": r["rank"],
            "jumlah_gpc": int(r["jumlah_gpc"]),
            "total_gpc_historis": float(r.get("total_gpc_historis", 0.0)),
        })
        grup[kunci]["total_gpc_akumulasi"] = grup[kunci]["total_gpc_historis"] + grup[kunci]["total_gpc_periode"]

    return list(grup.values())


def pratinjau(
    db: Session,
    periode: str,
    hanya_role_user: bool = False,
    use_default_wallet: bool = False,
    custom_default_wallet: Optional[str] = None,
) -> Dict[str, Any]:
    rencana = rencana_penerima(
        db,
        periode,
        hanya_role_user=hanya_role_user,
        use_default_wallet=use_default_wallet,
        custom_default_wallet=custom_default_wallet,
    )
    sudah = {
        (row.user_id): row for row in db.query(GpcRewardTx).filter_by(periode=periode).all()
    }

    user_ids = [r["user_id"] for r in rencana]
    historis_user_map: Dict[int, float] = {}
    if user_ids:
        rows = (
            db.query(GpcRewardTx.user_id, func.sum(GpcRewardTx.jumlah))
            .filter(GpcRewardTx.status == "sukses", GpcRewardTx.user_id.in_(user_ids))
            .group_by(GpcRewardTx.user_id)
            .all()
        )
        for uid, total in rows:
            historis_user_map[uid] = float(total or 0)

    for r in rencana:
        baris = sudah.get(r["user_id"])
        r["riwayat_status"] = baris.status if baris else None
        r["riwayat_tx"] = baris.tx_hash if baris else None
        r["total_gpc_historis"] = historis_user_map.get(r["user_id"], 0.0)

    penerima_siap = [r for r in rencana if r.get("siap")]
    dompet_ringkasan = ringkas_dompet(db, penerima_siap)

    return {
        "periode": periode,
        "schedule_gpc": GPC_REWARD_SCHEDULE,
        "onchain_aktif": GPC_REWARDS_ENABLED,
        "contract_address": GPC_CONTRACT_ADDRESS or None,
        "default_reward_wallet": custom_default_wallet or GPC_DEFAULT_REWARD_WALLET,
        "hanya_role_user": hanya_role_user,
        "use_default_wallet": use_default_wallet,
        "total_gpc_siap": sum(r["jumlah_gpc"] for r in penerima_siap),
        "total_penerima": len(rencana),
        "total_penerima_siap": len(penerima_siap),
        "dompet_ringkasan": dompet_ringkasan,
        "penerima": rencana,
        "tanpa_wallet": [r["user_id"] for r in rencana if not r["siap"]],
    }


def distribusikan(
    db: Session,
    admin_id: int,
    periode: str,
    kering: bool = False,
    hanya_role_user: bool = False,
    use_default_wallet: bool = False,
    custom_default_wallet: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Eksekusi distribusi utk satu periode. dry_run/`kering` = hanya menandai
    baris 'simulasi' tanpa on-chain (tetap idempoten utk preview angka).
    """
    rencana = rencana_penerima(
        db,
        periode,
        hanya_role_user=hanya_role_user,
        use_default_wallet=use_default_wallet,
        custom_default_wallet=custom_default_wallet,
    )
    jika_tanpa = [r for r in rencana if not r.get("wallet_address")]
    untuk_dikirim = [r for r in rencana if r.get("wallet_address")]
    penerima_siap = [r for r in rencana if r.get("siap")]
    dompet_ringkasan = ringkas_dompet(db, penerima_siap)

    hasil = {
        "periode": periode,
        "hanya_role_user": hanya_role_user,
        "use_default_wallet": use_default_wallet,
        "default_wallet": custom_default_wallet or GPC_DEFAULT_REWARD_WALLET,
        "total_gpc_siap": sum(r["jumlah_gpc"] for r in untuk_dikirim),
        "total_penerima": len(rencana),
        "dompet_ringkasan": dompet_ringkasan,
        "dikirim": [],
        "lewat_sudah": [],
        "gagal": [],
        "tanpa_wallet": [],
        "simulasi": [],
    }

    if kering:
        hasil["simulasi"] = rencana  # semua kandidat + flag 'siap' wallet
        hasil["tanpa_wallet"] = hasil_tanpa_wallet(jika_tanpa)
        return hasil

    _syarat_onchain_aktif()
    kontak = _contract()
    w3, _ = kontak

    try:
        rekening = w3.eth.account.from_key(GPC_TREASURY_PRIVATE_KEY)
        current_nonce = w3.eth.get_transaction_count(rekening.address, "pending")
    except Exception:
        current_nonce = None

    for r in untuk_dikirim:
        baris = db.query(GpcRewardTx).filter_by(periode=periode, user_id=r["user_id"]).first()
        if baris and baris.status == "sukses":
            hasil["lewat_sudah"].append({
                "user_id": r["user_id"],
                "tx": baris.tx_hash,
                "jumlah": str(baris.jumlah),
                "wallet_address": baris.wallet_address,
            })
            continue

        if not baris:
            baris = GpcRewardTx(
                periode=periode,
                user_id=r["user_id"],
                rank=r["rank"],
                wallet_address=r["wallet_address"],
                jumlah=Decimal(str(r["jumlah_gpc"])),
                status="pending",
            )
            db.add(baris)
            db.commit()
        else:
            baris.wallet_address = r["wallet_address"]
            baris.jumlah = Decimal(str(r["jumlah_gpc"]))
            baris.status = "pending"
            db.commit()

        try:
            sig = inspect.signature(kirim_mint)
            if "nonce" in sig.parameters and current_nonce is not None:
                hash_tx = kirim_mint(
                    kontak, r["wallet_address"], r["jumlah_gpc"], GPC_TREASURY_PRIVATE_KEY, nonce=current_nonce
                )
                current_nonce += 1
            else:
                hash_tx = kirim_mint(
                    kontak, r["wallet_address"], r["jumlah_gpc"], GPC_TREASURY_PRIVATE_KEY
                )

            baris.status = "sukses"
            baris.tx_hash = hash_tx
            baris.error = None
            db.commit()
            hasil["dikirim"].append({
                "user_id": r["user_id"],
                "tx": hash_tx,
                "jumlah": str(baris.jumlah),
                "wallet_address": r["wallet_address"],
                "is_default_wallet": bool(r.get("is_default_wallet")),
            })
            logger.info("GPC %s -> user %s (%s) tx %s", baris.jumlah, r["user_id"], r["wallet_address"], hash_tx)
        except Exception as exc:  # noqa: BLE001 - catat semua kegagalan RPC/on-chain
            baris = db.query(GpcRewardTx).filter_by(id=baris.id).first()
            if baris is None:
                continue
            baris.status = "gagal"
            baris.error = str(exc)[:500]
            db.add(baris)
            db.commit()
            hasil["gagal"].append({
                "user_id": r["user_id"],
                "error": baris.error,
                "wallet_address": r["wallet_address"],
            })
            logger.exception("Gagal kirim GPC user %s (%s)", r["user_id"], r["wallet_address"])

    hasil["tanpa_wallet"] = hasil_tanpa_wallet(jika_tanpa)
    hasil["total_gpc_dikirim"] = sum(Decimal(str(x["jumlah"])) for x in hasil["dikirim"])
    return hasil


def hasil_tanpa_wallet(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [
        {"user_id": x["user_id"], "nama": x["nama"], "rank": x["rank"]}
        for x in rows
    ]

