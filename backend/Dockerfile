# ============================================================
# GenPosFit — Backend (FastAPI + OpenCV + MediaPipe)
# ============================================================
FROM python:3.11-slim

WORKDIR /app

# Install dependency sistem untuk OpenCV & MySQL
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    default-libmysqlclient-dev \
    build-essential \
    pkg-config \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8042

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8042"]
