# GenPosFit: Genryphem Posture and Fit
### Arsitektur Docker Compose + MySQL + Makefile Commands

---

## 1. Arsitektur Infrastruktur

```
┌─────────────────────────────────────────────────────────────────────┐
│                    GENPOSFIT — DOCKER ENVIRONMENT                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐               ┌──────────────────────────────┐│
│  │  FRONTEND :3000  │               │       BACKEND :8000          ││
│  │  (React/Next.js) │───── HTTP ───▶│   (FastAPI + OpenCV +        ││
│  │  • Webcam via    │      WS       │      MediaPipe)              ││
│  │    browser       │◀──────────────│   • /api/registration        ││
│  │  • Skeleton UI   │               │   • /api/monitoring/ws       ││
│  └──────────────────┘               │   • Analisis sudut & skor    ││
│           │                         └──────────┬───────────────────┘│
│           │                                    │                    │
│           ▼                                    ▼                    │
│  ┌──────────────────┐               ┌──────────────────────────────┐│
│  │ PHPMYADMIN :8080 │◀──────────────│        MYSQL DB :3306        ││
│  │ (GUI database)   │               │         genposfit          ││
│  └──────────────────┘               │   • users                    ││
│                                     │   • pose_baseline            ││
│                                     │   • posture_logs             ││
│                                     │   • exercises                ││
│                                     │   • exercise_sessions        ││
│                                     └──────────────────────────────┘│
│                                                                     │
│  Volume: db_data (persistensi database)                             │
│  Network: genposfit-net (bridge)                                    │
└─────────────────────────────────────────────────────────────────────┘
```

> **Catatan Webcam di Docker:** Browser frontend mengambil webcam via `getUserMedia()`, pose estimation berjalan di browser (MediaPipe JS) atau mengirim landmark/frame ke backend via WebSocket. Backend menerima **landmark** (bukan video mentah), menghitung sudut, membandingkan baseline, dan menyimpan ke MySQL. Dengan cara ini, aplikasi tetap berjalan penuh di container tanpa masalah akses kamera host.

---

## 2. Struktur Proyek

```
genposfit/
│
├── docker-compose.yml       # Orkestrasi semua service
├── Makefile                 # Semua command operasional
├── .env                     # Kredensial database & config (ignored in git)
├── .env.example             # Template env
│
├── database/
│   ├── init/
│   │   └── 01_schema.sql    # Skema tabel (auto-run saat pertama up)
│   └── seed/
│       ├── seed.sql         # Data awal (latihan, config)
│       └── seed_user.py     # Seeder data dummy untuk development
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── tests/
│   └── app/
│       ├── main.py          # FastAPI entrypoint
│       ├── config.py        # Baca .env
│       ├── database.py      # Koneksi MySQL
│       ├── models.py        # Tabel ORM (SQLAlchemy)
│       ├── routers/
│       │   ├── users.py
│       │   ├── registration.py # Endpoint registrasi pose
│       │   ├── monitoring.py   # Endpoint monitoring live & WebSocket
│       │   └── exercises.py    # Endpoint latihan terapi postur
│       └── services/
│           ├── pose_analysis.py   # Hitung sudut, deteksi orientasi
│           └── deviation_score.py # Skor deviasi vs baseline
│
└── frontend/
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── pages/
        │   ├── LandingPage.tsx   # Minimal devtools landing page
        │   ├── RegisterPose.jsx  # Alur registrasi pose
        │   ├── Monitor.jsx       # Mode monitoring live
        │   ├── Dashboard.jsx     # Laporan progres
        │   └── Exercises.tsx     # Mode B Latihan Terapi
        └── components/
            ├── SkeletonOverlay.jsx # Skeleton canvas visualizer
            ├── Navbar.tsx
            └── ThemeToggle.tsx
```

---

## 3. Quickstart & Operasional

```bash
# 1. Siapkan environment
cp .env.example .env

# 2. Build semua image container
make build

# 3. Jalankan container di background
make up-detached

# 4. Verifikasi health status
make health

# 5. Isi data awal & dummy user
make seed
make seed-dummy
```
