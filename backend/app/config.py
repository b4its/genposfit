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
