"""
GenPosFit — Configuration Settings
Loads environment variables for database, API server, and security.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Search for .env in current dir, backend/, or parent root
for env_path in [
    Path(".env"),
    Path(__file__).resolve().parent.parent / ".env",
    Path(__file__).resolve().parent.parent.parent / ".env"
]:
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        break

DB_USER = os.getenv("DB_USER", "genposfit_user")
DB_PASSWORD = os.getenv("DB_PASSWORD", "genposfit_secret")
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = os.getenv("DB_PORT", "3348")
DB_NAME = os.getenv("DB_NAME", "genposfit")

BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8042"))
FRONTEND_PORT = int(os.getenv("FRONTEND_PORT", "3042"))

# Allowed CORS origins — set to "*" to allow all (publish jaringan lokal)
# or comma-separated list untuk development.
_raw = os.getenv("CORS_ORIGINS", "*")
if _raw == "*":
    CORS_ORIGIN_REGEX = ".*"
    CORS_ORIGINS = ["*"]
else:
    CORS_ORIGIN_REGEX = ""
    CORS_ORIGINS = [o.strip() for o in _raw.split(",") if o.strip()]

# Fallback localhost origins agar development tetap jalan
if not CORS_ORIGINS or CORS_ORIGINS == ["*"]:
    CORS_ORIGINS = [f"http://localhost:{FRONTEND_PORT}", f"http://127.0.0.1:{FRONTEND_PORT}", "*"]

# ---------------- GPC Rewards (Ethereum Sepolia Testnet) ----------------
# Backend memakai RPC + private key treasury yang sama dgn konfigurasi
# hardhat gpc-contract (.env root). Nilai di-overridable utk docker/tests.
SEPOLIA_RPC_URL = os.getenv("SEPOLIA_RPC_URL", "")
# kontrak GPC (ERC-1155) hasil deploy via `make gpc-publish` / npx hardhat run
GPC_CONTRACT_ADDRESS = os.getenv("GPC_CONTRACT_ADDRESS", "")
if not GPC_CONTRACT_ADDRESS:
    import json
    for _p in ["/app/gpc-contract/deployment.json", "gpc-contract/deployment.json", "../gpc-contract/deployment.json"]:
        if os.path.exists(_p):
            try:
                with open(_p, "r", encoding="utf-8") as _f:
                    _data = json.load(_f)
                    GPC_CONTRACT_ADDRESS = _data.get("contractAddress", "")
                if GPC_CONTRACT_ADDRESS:
                    break
            except Exception:
                pass
# kunci treasury = owner kontrak (yg boleh panggil mint)
GPC_TREASURY_PRIVATE_KEY = os.getenv("GPC_TREASURY_PRIVATE_KEY", os.getenv("PRIVATE_KEY", ""))
# chainId target reward (default 11155111 Sepolia, lihat hardhat.config.js)
GPC_CHAIN_ID = int(os.getenv("GPC_CHAIN_ID", "11155111"))
# master switch; False -> endpoint distribusi menolak kirim nyata (preview tetap jalan)
GPC_REWARDS_ENABLED = os.getenv("GPC_REWARDS_ENABLED", "0") == "1"
# Dompet komunitas default untuk pengguna yang belum memiliki dompet MetaMask sendiri
GPC_DEFAULT_REWARD_WALLET = os.getenv(
    "GPC_DEFAULT_REWARD_WALLET", "0x6EdcA860c066FCdA6c434095d5901810DCE12b48"
)

def _parse_jadwal_reward(raw: str) -> dict:
    """Format env: '1:1000,2:600,3:400' (rank:jumlah GPC utuh)."""
    jadwal = {}
    for part in (raw or "").split(","):
        if ":" in part:
            r, _, n = part.partition(":")
            try:
                jadwal[int(r)] = int(n)
            except ValueError:
                continue
    return jadwal or {1: 1000, 2: 600, 3: 400}

GPC_REWARD_SCHEDULE = _parse_jadwal_reward(os.getenv("GPC_REWARD_SCHEDULE", "1:1000,2:600,3:400"))

# Gas limit cadangan utk mint ERC-1155 (estimasi gagal di beberapa RPC publik)
GPC_GAS_LIMIT = int(os.getenv("GPC_GAS_LIMIT", "150000"))
GPC_GAS_PRICE_WEI = int(os.getenv("GPC_GAS_PRICE_WEI", "0")) or None  # None = auto gasPrice
