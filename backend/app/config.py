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
DB_PORT = os.getenv("DB_PORT", "3306")
DB_NAME = os.getenv("DB_NAME", "genposfit")

BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000"))
FRONTEND_PORT = int(os.getenv("FRONTEND_PORT", "3000"))

CORS_ORIGINS = [
    f"http://localhost:{FRONTEND_PORT}",
    f"http://127.0.0.1:{FRONTEND_PORT}",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "*",
]
