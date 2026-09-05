<div align="center">

# 🧘 GenPosFit — Genryphem Posture and Fit

**Sistem monitoring & latihan postur berbasis AI dengan Pose Enrollment untuk personalisasi**

![React](https://img.shields.io/badge/Frontend-React%2019-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Dev%20Server-Vite-646CFF?logo=vite&logoColor=white)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)
![MediaPipe](https://img.shields.io/badge/MediaPipe-Pose%20Estimation-orange?logo=google)
![MySQL](https://img.shields.io/badge/Database-MySQL%208.0-4479A1?logo=mysql&logoColor=white)
![Docker](https://img.shields.io/badge/Deploy-Docker%20Compose-2496ED?logo=docker&logoColor=white)

</div>

---

## 📑 Daftar Isi

1. [Konsep Besar: Onboarding Pose Sebagai Fondasi](#1-konsep-besar-onboarding-pose-sebagai-fondasi)
2. [Arsitektur Sistem](#2-arsitektur-sistem)
3. [Tech Stack](#3-tech-stack)
4. [Sesi Registrasi Pose: Alur Detail](#4-sesi-registrasi-pose-alur-detail)
5. [Data Baseline yang Diekstraksi & Disimpan](#5-data-baseline-yang-diekstraksi--disimpan)
6. [Struktur Database (MySQL)](#6-struktur-database-mysql)
7. [Backend — API FastAPI](#7-backend--api-fastapi)
8. [Frontend — React](#8-frontend--react)
9. [Baseline Dipakai Saat Live Monitoring](#9-baseline-dipakai-saat-live-monitoring)
10. [Alur Aplikasi](#10-alur-aplikasi)
11. [Validasi & Edge Case](#11-validasi--edge-case)
12. [Instalasi & Menjalankan (Docker Compose)](#12-instalasi--menjalankan-docker-compose)
13. [Struktur Proyek](#13-struktur-proyek)
14. [Roadmap](#14-roadmap)

---

## 1. Konsep Besar: Onboarding Pose Sebagai Fondasi

Setiap pengguna baru **wajib melewati proses registrasi pose** sebelum bisa menggunakan fitur monitoring/latihan. Proses ini membangun **Profil Postur Personal (Posture Baseline Profile)** — acuan unik milik pengguna itu sendiri, bukan standar generik.

**Alur pertama kali:**

1. Pengguna **mengisi profil** → diarahkan ke **registrasi pose**.
2. Pengguna mengikuti pose referensi, direkam dari beberapa sisi:
   - **Frontal** (menghadap kamera)
   - **Lateral kiri** (samping kiri ke kamera)
   - **Lateral kanan** (samping kanan ke kamera)
3. Sistem merekam landmark, menghitung sudut, lalu menyimpannya sebagai **baseline personal**.
4. Profil tersimpan ke MySQL → pengguna bisa mulai **live monitoring**, di mana postur real-time dibandingkan terhadap **baseline user sendiri** (bukan angka standar umum).

**Mengapa penting?** Tubuh setiap orang berbeda — tinggi badan, proporsi bahu, kelengkungan alami tulang belakang, bahkan kebiasaan lama. Memakai threshold generik (*"sudut 160° = bagus"*) untuk semua orang tidak akurat. Dengan baseline personal, deteksi menjadi **deviasi dari postur normal pengguna itu sendiri** → jauh lebih akurat dan personal.

---

## 2. Arsitektur Sistem

| Layer | Komponen | Tanggung Jawab |
|---|---|---|
| **Frontend (React)** | Kamera (`getUserMedia`), MediaPipe Pose JS, UI | Menangkap video kamera, mengekstraksi 33 landmark langsung di browser, menggambar skeleton, menampilkan UI onboarding/monitor/dashboard/latihan |
| **Backend (FastAPI)** | REST API + WebSocket | Mengelola registrasi baseline, menghitung skor deviasi personal, menyimpan log, menyajikan laporan |
| **Database (MySQL 8.0)** | 5 tabel: `users`, `pose_baseline`, `posture_logs`, `exercises`, `exercise_sessions` | Penyimpanan persisten (via Docker volume) |

> Proyek kini berjalan penuh di **Docker Compose** (4 container: `db`, `backend`, `frontend`, `phpmyadmin`) sebagai pengganti stand-alone SQLite.

**Alur komunikasi:**

- React mengekstraksi landmark di browser → mengirim landmark per frame ke FastAPI → backend menghitung sudut, skor deviasi, dan status.
- Komunikasi data historis/agregat via **REST (JSON)**; data real-time per frame via **WebSocket**.
- FastAPI melakukan scoring deviasi vs baseline → hasil dikirim balik ke React untuk ditampilkan.

> **Keputusan desain:** landmark MediaPipe diproses oleh backend (FastAPI + OpenCV + MediaPipe). Fitur tetap ringan dan semua analisis terpusat.

---

## 3. Tech Stack

| Layer | Teknologi | Peran |
|---|---|---|
| **Frontend** | React 19 + Vite + TypeScript | SPA: landing, monitoring, kalibrasi, dashboard, latihan |
| | MediaPipe Pose (CDN) | Deteksi & overlay skeleton |
| | Lucide React | Ikon UI |
| **Backend** | FastAPI + Uvicorn | REST API + WebSocket untuk scoring real-time |
| | SQLAlchemy 2.0 + PyMySQL | ORM + driver koneksi MySQL |
| | MediaPipe + OpenCV + NumPy | Analisis sudut biomekanika landmark |
| | Pydantic | Validasi skema data baseline & log |
| **Database** | MySQL 8.0 | Penyimpanan persisten, InnoDB, FK + index |
| **Infra** | Docker Compose | Orchestrasi 4 container (db, backend, frontend, phpmyadmin) |
| | GitHub Actions (CI) | Backend unit test (`unittest`) + frontend build (`tsc` + Vite) |

---

## 4. Sesi Registrasi Pose: Alur Detail

### Fase 1 — Setup & Pemeriksaan Kamera

1. Pengguna diminta menyiapkan ruangan dengan pencahayaan cukup.
2. Kamera dinyalakan → cek kualitas frame.
3. Instruksi: *"Posisikan diri agar seluruh tubuh atas terlihat di layar."*
4. Jika kamera tidak tersedia/ditolak, sistem beralih ke **Simulator Biomekanika** (landmark sintetis) sehingga alur tetap bisa dilalui untuk demo/presentasi.

### Fase 2 — Panduan Rotasi Sisi (Angle Capture)

Pengguna memilih orientasi kamera (frontal / lateral kiri / lateral kanan) dan tipe pose target (duduk tegak, duduk rileks, berdiri tegak, berdiri rileks).

| Orientasi | Tujuan Data |
|---|---|
| **Frontal (menghadap kamera)** | Kesimetrian bahu, level kemiringan bahu |
| **Lateral kiri (samping kiri ke kamera)** | Kurva leher & punggung dari samping — paling akurat untuk deteksi tech neck & slouching |
| **Lateral kanan** | Validasi silang, deteksi asimetri kiri-kanan |

### Fase 3 — Instruksi Pose Referensi per Orientasi

| Tipe Pose | Fungsi Baseline |
|---|---|
| **Duduk tegak (ideal ergonomis)** | Menangkap kapasitas ideal user |
| **Duduk rileks (posisi kerja alami)** | Menangkap kebiasaan alami user |
| **Berdiri tegak (standing desk)** | Referensi align kepala-bahu-pinggul |
| **Berdiri rileks** | Menangkap postur berdiri alami |

> **Kunci desain:** sistem menyimpan **dua kondisi** — *relaxed* (kebiasaan) dan *tegak* (ideal). Dari selisih keduanya, sistem tahu *"seberapa jauh postur kerja user menyimpang dari kapasitas terbaiknya"* → dasar skoring personal.

### Fase 4 — Perekaman & Ekstraksi

Per pose:

1. Countdown 3 detik (stabilisasi).
2. Rekam 90 frame berturut-turut (~3 detik).
3. Ekstrak landmark MediaPipe per frame.
4. Hitung nilai rata-rata (mean) + standar deviasi per sudut kunci (leher & punggung) serta level bahu.
5. Kirim hasil agregasi ke FastAPI → simpan ke MySQL sebagai baseline.

### Fase 5 — Ringkasan Profil

Pengguna diperlihatkan tabel hasil registrasi: orientasi, tipe pose, sudut rata-rata, dan standar deviasi, lalu **tombol simpan profil ke MySQL**. Setelah sukses, pengguna diarahkan ke **Live Monitor**.

---

## 5. Data Baseline yang Diekstraksi & Disimpan

Dari setiap kombinasi (orientasi × pose), sistem menghitung:

| Parameter | Cara Hitung | Kegunaan Nanti |
|---|---|---|
| **Sudut leher** | Telinga–Bahu–Pinggul (midpoint untuk frontal) | Deteksi tech neck personal |
| **Sudut punggung** | Bahu–Pinggul–Lutut (midpoint untuk frontal) | Deteksi slouch personal |
| **Level bahu** | Selisih y bahu kiri–kanan dibagi lebar bahu | Deteksi bahu miring |
| **Standar deviasi tiap sudut** | Variasi antar frame | Menentukan **toleransi personal** (orang yang gemetar/sering gerak → toleransi lebih lebar) |
| **Jumlah frame** | Panjang perekaman | Menjamin kualitas kalibrasi |

**Normalisasi:** level bahu dinormalkan terhadap jarak antar-bahu sehingga konsisten terlepas dari jarak kamera.

---

## 6. Struktur Database (MySQL)

Database `genposfit` dengan 5 tabel (skema InnoDB, asing-key, index):

| Tabel | Kolom Utama | Fungsi |
|---|---|---|
| `users` | user_id, nama, email (unique), pekerjaan, jam_kerja_hari | Profil pengguna |
| `pose_baseline` | user_id (FK), orientasi, tipe_pose, sudut_leher, sudut_punggung, level_bahu, std_leher, std_punggung, n_frame | Kalibrasi postur personal (unique user+orientasi+tipe) |
| `posture_logs` | user_id (FK), sesi_id, timestamp, sudut_leher, sudut_punggung, level_bahu, skor_deviasi, status | Log evaluasi postur time-series |
| `exercises` | exercise_id, nama, deskripsi, target_otot, sudut_target (JSON), durasi_detik, reps, tingkat | Perpustakaan latihan terapi |
| `exercise_sessions` | session_id, user_id (FK), exercise_id (FK), total_reps, avg_skor, selesai_at | Riwayat sesi latihan selesai |

Skema auto-dijalankan saat container `db` pertama kali dibuat dari `database/init/01_schema.sql`. Data contoh dapat di-seed dengan `make seed` (`database/seed/seed.sql` + `seed_user.py`).

---

## 7. Backend — API FastAPI

Prefix utama: `/api` — dokumentasi otomatis Swagger di `http://localhost:8000/docs`.

### Router & Endpoint

| Router | Endpoint | Fungsi |
|---|---|---|
| **Users** | `GET/POST /api/users`, `GET /api/users/{id}` | CRUD profil pengguna |
| **Registrasi Pose** | `POST /api/registration/submit` | Upsert profil + baseline pose |
| | `GET /api/registration/baselines/{user_id}` | Ambil baseline user |
| **Monitoring Postur** | `POST /api/monitoring/evaluate` | Evaluasi landmark via HTTP |
| | `POST /api/monitoring/log` | Simpan log postur manual |
| | `GET /api/monitoring/summary/{user_id}` | Statistik riwayat postur |
| | **WS** `/api/monitoring/ws/{user_id}` | Live monitoring streaming real-time |
| **Latihan Postur** | `GET /api/exercises`, `GET /api/exercises/{id}` | Daftar + detail latihan |
| | `POST /api/exercises/sessions` | Catat sesi latihan selesai |
| | `GET /api/exercises/sessions/user/{user_id}` | Riwayat latihan user |

### Skor & Status Deviasi

Skor komposit = **55% skor leher + 35% skor punggung − penalti bahu miring** (klamp 0–100).

| Skor | Status | Keterangan |
|---|---|---|
| ≥ 85 | **bagus** | Postur ergonomis ideal |
| 60 – 84 | **ringan** | Dagu agak maju / punggung sedikit membungkuk |
| < 60 | **buruk** | Postur buruk terdeteksi |

---

## 8. Frontend — React

### Halaman / Tab

| Tab | Komponen | Fungsi |
|---|---|---|
| **Overview** (`h`) | `LandingPage` | Landing + simulator postur interaktif + kode contoh (WebSocket/cURL/Python) |
| **Live Monitor** (`m`) | `Monitor` | Monitoring postur real-time via WebSocket, gauge skor, telemetri sudut, alert suara |
| **Calibration** (`c`) | `RegisterPose` | Wizard registrasi & kalibrasi baseline pose |
| **Dashboard** (`d`) | `Dashboard` | KPI, grafik time-series skor, riwayat latihan, inspector telemetri |
| **Therapy Fit** (`e`) | `Exercises` | Latihan terapi Mode B dengan rep counter & hold timer |

### Komponen Pendukung

| Komponen | Fungsi |
|---|---|
| `Navbar` | Navigasi tab + indikator status API + toggle tema |
| `ThemeToggle` | Toggle dark/light mode (persistensi localStorage) |
| `SkeletonOverlay` | Overlay canvas 33 landmark MediaPipe + label sudut berwarna sesuai status |

Navigasi juga mendukung pintasan keyboard: `H`, `M`, `C`, `D`, `E`.

---

## 9. Baseline Dipakai Saat Live Monitoring

Inti personalisasi: **skor deviasi** — seberapa jauh postur saat ini menyimpang dari baseline user sendiri. Dihitung di FastAPI, hasil dikirim ke React via WebSocket.

### Logika keputusan yang dipersonalisasi

| Kondisi Terdeteksi | Respons Sistem |
|---|---|
| Sudut leher/punggung live menyimpang dari baseline sesuai `tipe_pose` | Skor turun sesuai toleransi personal (`std` × faktor) |
| Skor < 60 (status `buruk`) | 🔔 Buzzer audio + banner peringatan + rekomendasi terapi |
| Postur mendekati baseline versi ideal | *"Postur ergonomis ideal. Pertahankan posisi ini!"* |

> Baseline dimuat per `tipe_pose` yang dikirim client (`duduk_rileks`, `duduk_tegak`, dst.), sehingga evaluasi selalu membandingkan terhadap kalibrasi postur yang relevan.

### Keuntungan vs threshold generik

| Aspek | Threshold Generik | Dengan Baseline Personal |
|---|---|---|
| Orang dengan kyphosis ringan bawaan | Salah alert terus (dianggap buruk padahal normal baginya) | Tahu itu baseline-nya; hanya alert jika memburuk |
| Orang postur-nya sudah sangat baik | Alert jarang = kurang terdorong | Target bisa digeser ke baseline `duduk_tegak` (lebih menantang) |
| Ukuran tubuh berbeda-beda | Sudut sama belum tentu artinya sama | Ternormalisasi → konsisten |
| Progres pemulihan | Sulit diukur | Deviasi rata-rata turun terhadap baseline → terukur |

---

## 10. Alur Aplikasi

**1. Onboarding (pengguna baru):**
- Isi profil → pilih orientasi & tipe pose → hitung baseline (90 frame).
- React mengirim baseline ke FastAPI → tersimpan di MySQL sebagai **Posture Baseline Profile**.

**2. Penggunaan harian:**
- **Mode A — Live Monitor:** kirim landmark per frame → WebSocket ke FastAPI → skor deviasi → alert personal di UI (gauge + audio + banner).
- **Mode B — Therapy Exercises:** daftar 6 latihan terapi → rep counter + hold timer → menyimpan sesi selesai ke backend.

**3. Dashboard analitik:**
- Endpoint `/api/monitoring/summary/{user_id}` → KPI rata-rata skor, persentase kepatuhan, distribusi status, dan timeline 60 titik.
- Riwayat sesi latihan dari `exercise_sessions`.

---

## 11. Validasi & Edge Case

| Situasi | Penanganan |
|---|---|
| Landmark tidak mencukupi (< 25 titik) | Endpoint mengembalikan `valid: false` dengan pesan error |
| Kamera ditolak / tidak tersedia | Simulator Biomekanika aktif; webcam bisa dinyalakan belakangan |
| WebSocket terputus / backend offline | Monitor memakai perhitungan skor lokal di sisi client (fallback) |
| Frame landmark tidak stabil | Frame dengan visibility rendah diabaikan saat ekstraksi sudut |
| Standard deviasi tinggi saat kalibrasi | Dijaga minimum 1.0 untuk mencegah toleransi terlalu sempit |
| Orientasi tidak deteksi | Fallback default `frontal` pada analisis landmark |

---

## 12. Instalasi & Menjalankan (Docker Compose)

### Prasyarat

- **Docker** + **Docker Compose** terinstal.
- Salin `.env.example` → `.env` lalu sesuaikan bila perlu.

### Quick Start

```bash
# 1. Siapkan environment
cp .env.example .env

# 2. Build & jalankan semua container (db, backend, frontend, phpmyadmin)
make up            # (alias: docker compose up -d --build)

# 3. Seeder data contoh (opsional)
make seed

# 4. Lihat log
make logs
```

### Akses Aplikasi

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend (Swagger API) | http://localhost:8000/docs |
| Health check | http://localhost:8000/api/health |
| PhpMyAdmin | http://localhost:8080 |

### Command Makefile Berguna

```bash
make up           # jalankan semua container (foreground)
make up-detached  # jalankan di background (detached)
make down         # stop container
make restart      # restart container
make ps           # status container
make db           # masuk CLI MySQL db container
make logs-backend # log backend
make migrate      # jalankan inisialisasi skema
make seed         # seed data latihan + dummy user
make lint-frontend / lint-backend  # cek kualitas kode
make clean        # bersihkan container (tanpa volume)
make nuke         # bersihkan termasuk volume db
```

> Semua command tersedia lengkap dengan menjalankan `make help`.

---

## 13. Struktur Proyek

```
genposfit/
├── .env.example                  # Template environment
├── docker-compose.yml            # Orchestrasi: db, backend, frontend, phpmyadmin
├── Makefile                      # Command operasional (Docker, DB, seed, lint)
├── PRD.md                        # Spesifikasi & arsitektur
├── .github/workflows/ci.yml      # CI: backend test + frontend build
│
├── backend/                      # Python 3.11 + FastAPI
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── app/
│   │   ├── main.py               # Entrypoint FastAPI + CORS
│   │   ├── config.py             # Konfigurasi env
│   │   ├── database.py           # Engine SQLAlchemy + MySQL
│   │   ├── models.py             # 5 ORM model
│   │   ├── routers/              # users, registration, monitoring, exercises
│   │   └── services/             # pose_analysis, deviation_score
│   └── tests/
│       └── test_pose_analysis.py # Unit test backend
│
├── database/
│   ├── init/01_schema.sql        # Skema MySQL (auto-run)
│   └── seed/                     # seed.sql + seed_user.py
│
└── frontend/                     # React 19 + Vite + TypeScript
    ├── Dockerfile
    ├── vite.config.ts
    ├── tsconfig*.json
    ├── eslint.config.js
    └── src/
        ├── App.tsx               # Tab routing
        ├── components/           # Navbar, ThemeToggle, SkeletonOverlay
        └── pages/                # LandingPage, RegisterPose, Monitor, Dashboard, Exercises
```

---

## 14. Roadmap

**Fase 1 — MVP (selesai):**

1. Registrasi pose multi-orientasi → simpan baseline ke MySQL via FastAPI
2. Monitoring live: landmark → WebSocket → skor deviasi di backend
3. Notifikasi deviasi + dashboard rekapitulasi
4. Mode B latihan terapi + pencatatan sesi
5. Deployment penuh via Docker Compose (MySQL + PhpMyAdmin)

**Fase 2 — ditambahkan:**

- Re-registrasi + grafik perbandingan baseline lama vs baru (bukti perbaikan)
- Multi-user (profil per anggota keluarga/karyawan)
- Ekspor laporan PDF dari frontend
- Autentikasi JWT (login/logout di React + OAuth2 di FastAPI)

---

<div align="center">

**GenPosFit** — *Postur personal, bukan standar generik.* 🧘

</div>