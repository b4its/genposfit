<div align="center">

# 🧘 GenPosFit — Genryphem Posture and Fit

**Sistem monitoring & latihan postur berbasis AI dengan Pose Enrollment untuk personalisasi**

![React](https://img.shields.io/badge/Frontend-React%2018-61DAFB?logo=react&logoColor=white)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)
![MediaPipe](https://img.shields.io/badge/MediaPipe-Pose%20Estimation-orange?logo=google)
![SQLite](https://img.shields.io/badge/Database-SQLite-lightgrey?logo=sqlite)

</div>

---

## 📑 Daftar Isi

1. [Konsep Besar: Onboarding Pose Sebagai Fondasi](#1-konsep-besar-onboarding-pose-sebagai-fondasi)
2. [Arsitektur Sistem](#2-arsitektur-sistem)
3. [Tech Stack](#3-tech-stack)
4. [Sesi Registrasi Pose: Alur Detail](#4-sesi-registrasi-pose-alur-detail)
5. [Data Baseline yang Diekstraksi & Disimpan](#5-data-baseline-yang-diekstraksi--disimpan)
6. [Struktur Database (SQLite)](#6-struktur-database-sqlite)
7. [Backend — API FastAPI](#7-backend--api-fastapi)
8. [Frontend — React](#8-frontend--react)
9. [Baseline Dipakai Saat Live Monitoring](#9-baseline-dipakai-saat-live-monitoring)
10. [Alur Aplikasi](#10-alur-aplikasi)
11. [Validasi & Edge Case](#11-validasi--edge-case)
12. [Instalasi & Menjalankan](#12-instalasi--menjalankan)
13. [Struktur Proyek](#13-struktur-proyek)
14. [Roadmap](#14-roadmap)

---

## 1. Konsep Besar: Onboarding Pose Sebagai Fondasi

Setiap pengguna baru **wajib melewati proses registrasi pose** sebelum bisa menggunakan fitur monitoring/latihan. Proses ini membangun **Profil Postur Personal (Posture Baseline Profile)** — acuan unik milik pengguna itu sendiri, bukan standar generik.

**Alur pertama kali:**

1. Pengguna **daftar akun** → diarahkan ke **registrasi pose**.
2. Pengguna mengikuti pose referensi yang tampil di layar, direkam dari beberapa sisi:
   - **Frontal** (menghadap kamera)
   - **Lateral kiri** (samping kiri ke kamera)
   - **Lateral kanan** (samping kanan ke kamera)
3. Sistem merekam landmark, menghitung sudut, lalu menyimpannya sebagai **baseline personal**.
4. Profil tersimpan → pengguna bisa mulai **live monitoring**, di mana postur real-time dibandingkan terhadap **baseline user sendiri** (bukan angka standar umum).

**Mengapa penting?** Tubuh setiap orang berbeda — tinggi badan, proporsi bahu, kelengkungan alami tulang belakang, bahkan kebiasaan lama. Memakai threshold generik (*"sudut 160° = bagus"*) untuk semua orang tidak akurat. Dengan baseline personal, deteksi menjadi **deviasi dari postur normal pengguna itu sendiri** → jauh lebih akurat dan personal.

---

## 2. Arsitektur Sistem

| Layer | Komponen | Tanggung Jawab |
|---|---|---|
| **Frontend (React)** | Kamera (`getUserMedia`), MediaPipe Pose JS, UI | Menangkap video kamera, mengekstraksi 33 landmark langsung di browser, menggambar skeleton, menampilkan UI onboarding/dashboard/laporan |
| **Backend (FastAPI)** | REST API + WebSocket | Mengelola registrasi baseline, menghitung skor deviasi personal, menyimpan log, menyajikan laporan |
| **Database (SQLite)** | Tabel `users`, `pose_baseline`, `posture_logs` | Penyimpanan lokal ringan |

**Alur komunikasi:**

- React mengekstraksi landmark di browser → menghitung fitur (sudut, rasio) → mengirim fitur ke FastAPI.
- Komunikasi data historis/agregat via **REST (JSON)**; data real-time per frame via **WebSocket**.
- FastAPI melakukan scoring deviasi vs baseline → hasil dikirim balik ke React untuk ditampilkan.

> **Keputusan desain:** MediaPipe berjalan di browser (JS), bukan di server. Hanya fitur hasil ekstraksi (angka sudut) yang dikirim ke backend — lebih hemat bandwidth dan latensi rendah.

---

## 3. Tech Stack

| Layer | Teknologi | Peran |
|---|---|---|
| **Frontend** | React 18 + Vite | SPA: onboarding, dashboard, visualisasi skeleton |
| | MediaPipe Tasks Vision (JS) | Deteksi 33 landmark pose langsung di browser |
| | Recharts | Grafik progres deviasi & laporan |
| **Backend** | FastAPI | REST API + WebSocket untuk scoring real-time |
| | Pydantic | Validasi skema data baseline & log |
| | SQLite + SQLAlchemy | Database lokal ringan |
| | NumPy | Agregasi mean/std baseline |
| **Infra** | Uvicorn | ASGI server |
| | CORS Middleware | Komunikasi React ↔ FastAPI |

---

## 4. Sesi Registrasi Pose: Alur Detail

### Fase 1 — Setup & Pemeriksaan Kamera

1. Pengguna diminta menyiapkan ruangan dengan pencahayaan cukup.
2. Kamera dinyalakan → cek kualitas frame (terang? user terlihat penuh?).
3. Instruksi: *"Posisikan diri agar seluruh tubuh atas terlihat di layar."*
4. Validasi: sistem cek landmark MediaPipe terdeteksi stabil ≥ 10 frame.
   - Jika tidak → beri panduan (mundur/maju/perbaiki pencahayaan), lalu ulangi pengecekan.

### Fase 2 — Panduan Rotasi Sisi (Angle Capture)

Pengguna **diarahkan oleh sistem** (dengan visual + countdown) untuk memutar tubuh ke beberapa orientasi. Skeleton di layar berubah warna saat orientasi sudah benar.

| Tahap | Orientasi yang Diminta | Tujuan Data |
|---|---|---|
| 1 | **Frontal (menghadap kamera)** | Kesimetrian bahu, kemiringan kepala, deteksi asimetri pinggul |
| 2 | **Lateral kiri (samping kiri ke kamera)** | Kurva leher & punggung dari samping — paling akurat untuk deteksi tech neck & slouching |
| 3 | **Lateral kanan** | Validasi silang, deteksi asimetri kiri-kanan |
| 4 | *(opsional)* **Posterior (belakang)** | Screening asimetri tulang belakang, bahu |

**Deteksi otomatis orientasi:** sistem sendiri yang mengenali user sudah menghadap ke arah yang benar (dari rasio lebar bahu terhadap kedalaman landmark — jika bahu "menyempit" berarti user sedang menyamping). Baru setelah itu perekaman dimulai.

**Urutan proses per orientasi:**

1. Sistem menampilkan ilustrasi + instruksi orientasi yang diminta.
2. Sistem mendeteksi orientasi user secara otomatis.
   - Belum sesuai → tampilkan instruksi perbaikan, kembali ke langkah 2.
   - Sudah sesuai → skeleton berubah warna sebagai tanda.
3. Countdown *"bertahan di posisi... 3.. 2.. 1.."*
4. Perekaman pose dimulai otomatis.

### Fase 3 — Instruksi Pose Referensi per Orientasi

Di setiap orientasi, pengguna diarahkan mengikuti **2–3 pose** yang ditampilkan sebagai ilustrasi/skeleton contoh di layar:

| Orientasi | Pose yang Diminta | Fungsi Baseline |
|---|---|---|
| Frontal | a) Berdiri rileks natural | Menangkap kebiasaan alami user |
| Frontal | b) Berdiri tegak maksimal ("dada dibusukkan") | Menangkap kapasitas ideal user |
| Frontal | c) Duduk normal seperti saat bekerja | Baseline postur kerja frontal |
| Samping kiri/kanan | a) Duduk rileks | Menangkap kecenderungan slouch user |
| Samping kiri/kanan | b) Duduk tegak | Baseline postur ideal duduk |
| Samping kiri/kanan | c) Berdiri tegak | Referensi align kepala-bahu-pinggul |

> **Kunci desain:** sistem menyimpan **dua kondisi** — *relaxed* (kebiasaan) dan *upright* (ideal). Dari selisih keduanya, sistem tahu *"seberapa jauh postur kerja user menyimpang dari kapasitas terbaiknya"* → dasar skoring personal.

### Fase 4 — Perekaman & Ekstraksi

Per pose:

1. Countdown 3 detik (stabilisasi).
2. Rekam 30–45 frame berturut-turut (~1,5 detik).
3. Ekstrak 33 landmark MediaPipe per frame.
4. Buang frame dengan visibility landmark rendah (< 0.5).
5. Hitung nilai rata-rata (mean) + standar deviasi per sudut kunci.
6. Kirim hasil agregasi ke FastAPI → simpan ke SQLite sebagai baseline.

### Fase 5 — Ringkasan Profil

Pengguna diperlihatkan hasil registrasi: skeleton posturnya, sudut-sudut kunci, dan skor awal. Data tersimpan sebagai **Posture Profile** melalui API backend.

---

## 5. Data Baseline yang Diekstraksi & Disimpan

Dari setiap kombinasi (orientasi × pose), sistem menghitung:

| Parameter | Cara Hitung | Kegunaan Nanti |
|---|---|---|
| **Sudut leher** | Telinga–Bahu vs vertikal | Deteksi tech neck personal |
| **Sudut punggung** | Bahu–Pinggul vs vertikal | Deteksi slouch personal |
| **Level bahu** | Selisih y bahu kiri–kanan (frontal) | Deteksi bahu miring |
| **Selisih maju bahu** | Posisi x bahu vs telinga (samping) | Deteksi rounded shoulders |
| **Jarak kepala–bahu (lebar bahu sebagai unit)** | Normalisasi skala | Konsisten untuk semua ukuran tubuh |
| **Align bahu–pinggul** | Offset horizontal | Deteksi postur condong |
| **Standar deviasi tiap sudut** | Variasi antar frame | Menentukan **toleransi personal** (orang yang gemetar/sering gerak → toleransi lebih lebar) |

**Normalisasi skala:** semua jarak dibagi lebar bahu user (`scale = jarak_bahu_kiri_ke_kanan`), sehingga profil tetap valid dihitung dari jarak kamera berapa pun.

---

---

## 8. Frontend — React

### Komponen Utama

| Komponen | Fungsi |
|---|---|
| `<OnboardingFlow />` | Wizard registrasi pose 5 fase (setup kamera → rotasi sisi → pose → rekam → ringkasan) |
| `<CameraCanvas />` | Akses `getUserMedia` + render video + overlay skeleton dari MediaPipe JS |
| `<PoseGuide />` | Ilustrasi pose referensi + deteksi orientasi otomatis + countdown |
| `<MonitorDashboard />` | Live monitoring: skor deviasi real-time via WebSocket |
| `<ProgressReport />` | Grafik deviasi mingguan (Recharts) |

---

## 9. Baseline Dipakai Saat Live Monitoring

Inti personalisasi: **skor deviasi** — seberapa jauh postur saat ini menyimpang dari baseline user sendiri. Dihitung di FastAPI, hasil dikirim ke React via WebSocket.

### Logika keputusan yang dipersonalisasi

| Kondisi Terdeteksi | Respons Sistem |
|---|---|
| `sudut_leher_live` jauh lebih besar dari baseline `duduk_relaxed` | *"Kepalamu lebih maju dari biasanya — tarik kepala ke belakang"* |
| `sudut_punggung_live` jauh lebih besar dari baseline | *"Kamu lebih membungkuk dari postur normalmu"* |
| Skor deviasi < 60 selama > 10 detik | 🔔 Notifikasi muncul |
| Postur mendekati baseline versi `duduk_tegak` | *"Mantap! Posturmu mendekati posisi idealmu"* |

### Keuntungan vs threshold generik

| Aspek | Threshold Generik | Dengan Baseline Personal |
|---|---|---|
| Orang dengan kyphosis ringan bawaan | Salah alert terus (dianggap buruk padahal normal baginya) | Tahu itu baseline-nya; hanya alert jika memburuk |
| Orang postur-nya sudah sangat baik | Alert jarang = kurang terdorong | Target bisa digeser ke baseline `duduk_tegak` (lebih menantang) |
| Ukuran tubuh berbeda-beda | Sudut sama belum tentu artinya sama | Ternormalisasi lebar bahu → konsisten |
| Progres pemulihan | Sulit diukur | "Minggu ini deviasi rata-rata turun 15% dari baseline" → terukur |

---

## 10. Alur Aplikasi

**1. Onboarding (pengguna baru, ±5–7 menit):**
- Registrasi pose: 3 orientasi × 2–3 pose, dengan countdown + rekam otomatis.
- React mengirim baseline ke FastAPI → tersimpan di SQLite sebagai **Posture Baseline Profile**.

**2. Penggunaan harian:**
- **Mode A — Posture Monitor:** MediaPipe JS ekstraksi landmark → WebSocket ke FastAPI → skor deviasi → alert personal di UI.
- **Mode B — Latihan Terpandu:** target mengikuti baseline versi *"tegak"* milik user (bukan skeleton generik).
- **Laporan:** endpoint `/api/users/{id}/laporan` → grafik progres deviasi (Recharts).

**3. Re-registrasi (opsional, tiap 1–3 bulan):**
- Baseline diperbarui → memantau perbaikan postur dari waktu ke waktu.

**Fitur penting — Re-registrasi berkala:** karena tujuan aplikasi adalah *perbaikan* postur, baseline idealnya di-refresh tiap 1–3 bulan. Kalau baseline user membaik (sudut tegak-nya berubah), itu **bukti terukur bahwa terapi bekerja** → fitur laporan progres yang kuat, sekaligus motivator.

---

## 11. Validasi & Edge Case

| Situasi | Penanganan |
|---|---|
| Orientasi tidak terdeteksi terus-menerus | Timeout 30 detik → tampilkan ilustrasi + tips ("putar badan 90° ke kiri") |
| Frame buram / landmark patah-patah | Frame dengan visibility < 0.5 dibuang; jika >50% frame dibuang → ulangi perekaman |
| User bergerak saat perekaman | Standar deviasi tinggi → sistem minta ulang pose tersebut |
| User pakai jas besar/rambut menutupi telinga | Deteksi landmark telinga lemah → fallback ke hidung + midpoint bahu |
| Registrasi di posisi kamera berbeda dari nanti | Instruksi: "gunakan posisi kamera yang sama seperti saat bekerja"; normalisasi lebar bahu mengurangi efek ini |
| Baseline "relaxed" dan "tegak" hampir identik | User sudah punya postur sangat baik → program fokus pencegahan & endurans |
| WebSocket terputus di tengah sesi | React auto-reconnect + buffer data → kirim ulang ke FastAPI |
| Kamera ditolak oleh browser | Tampilkan panduan izin kamera per-browser (Chrome/Edge/Firefox) |

---


## 14. Roadmap

**Fase 1 — MVP:**

1. Sistem registrasi pose 6 sesi (3 orientasi × 2 pose) → simpan baseline ke SQLite via FastAPI
2. Monitoring live: MediaPipe JS → WebSocket → skor deviasi di backend
3. Notifikasi deviasi + rekap sederhana di React

**Fase 2 — ditambahkan:**

- Re-registrasi + grafik perbandingan baseline lama vs baru (bukti perbaikan)
- Multi-user (profil per anggota keluarga/karyawan)
- Ekspor laporan PDF dari frontend
- Autentikasi JWT (login/logout di React + OAuth2 di FastAPI)

---

<div align="center">

**GenPosFit** — *Postur personal, bukan standar generik.* 🧘

</div>
ubah database pakai mysql, dan tambahkan docker compose sebagai container
<div align="center">

# 🧘 GenPosFit — Genryphem Posture and Fit

**Sistem monitoring & latihan postur berbasis AI dengan Pose Enrollment untuk personalisasi**

![React](https://img.shields.io/badge/Frontend-React%2018-61DAFB?logo=react&logoColor=white)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)
![MediaPipe](https://img.shields.io/badge/MediaPipe-Pose%20Estimation-orange?logo=google)
![SQLite](https://img.shields.io/badge/Database-SQLite-lightgrey?logo=sqlite)

</div>

---

## 📑 Daftar Isi

1. [Konsep Besar: Onboarding Pose Sebagai Fondasi](#1-konsep-besar-onboarding-pose-sebagai-fondasi)
2. [Arsitektur Sistem](#2-arsitektur-sistem)
3. [Tech Stack](#3-tech-stack)
4. [Sesi Registrasi Pose: Alur Detail](#4-sesi-registrasi-pose-alur-detail)
5. [Data Baseline yang Diekstraksi & Disimpan](#5-data-baseline-yang-diekstraksi--disimpan)
6. [Struktur Database (SQLite)](#6-struktur-database-sqlite)
7. [Backend — API FastAPI](#7-backend--api-fastapi)
8. [Frontend — React](#8-frontend--react)
9. [Baseline Dipakai Saat Live Monitoring](#9-baseline-dipakai-saat-live-monitoring)
10. [Alur Aplikasi](#10-alur-aplikasi)
11. [Validasi & Edge Case](#11-validasi--edge-case)
12. [Instalasi & Menjalankan](#12-instalasi--menjalankan)
13. [Struktur Proyek](#13-struktur-proyek)
14. [Roadmap](#14-roadmap)

---

## 1. Konsep Besar: Onboarding Pose Sebagai Fondasi

Setiap pengguna baru **wajib melewati proses registrasi pose** sebelum bisa menggunakan fitur monitoring/latihan. Proses ini membangun **Profil Postur Personal (Posture Baseline Profile)** — acuan unik milik pengguna itu sendiri, bukan standar generik.

**Alur pertama kali:**

1. Pengguna **daftar akun** → diarahkan ke **registrasi pose**.
2. Pengguna mengikuti pose referensi yang tampil di layar, direkam dari beberapa sisi:
   - **Frontal** (menghadap kamera)
   - **Lateral kiri** (samping kiri ke kamera)
   - **Lateral kanan** (samping kanan ke kamera)
3. Sistem merekam landmark, menghitung sudut, lalu menyimpannya sebagai **baseline personal**.
4. Profil tersimpan → pengguna bisa mulai **live monitoring**, di mana postur real-time dibandingkan terhadap **baseline user sendiri** (bukan angka standar umum).

**Mengapa penting?** Tubuh setiap orang berbeda — tinggi badan, proporsi bahu, kelengkungan alami tulang belakang, bahkan kebiasaan lama. Memakai threshold generik (*"sudut 160° = bagus"*) untuk semua orang tidak akurat. Dengan baseline personal, deteksi menjadi **deviasi dari postur normal pengguna itu sendiri** → jauh lebih akurat dan personal.

---

## 2. Arsitektur Sistem

| Layer | Komponen | Tanggung Jawab |
|---|---|---|
| **Frontend (React)** | Kamera (`getUserMedia`), MediaPipe Pose JS, UI | Menangkap video kamera, mengekstraksi 33 landmark langsung di browser, menggambar skeleton, menampilkan UI onboarding/dashboard/laporan |
| **Backend (FastAPI)** | REST API + WebSocket | Mengelola registrasi baseline, menghitung skor deviasi personal, menyimpan log, menyajikan laporan |
| **Database (SQLite)** | Tabel `users`, `pose_baseline`, `posture_logs` | Penyimpanan lokal ringan |

**Alur komunikasi:**

- React mengekstraksi landmark di browser → menghitung fitur (sudut, rasio) → mengirim fitur ke FastAPI.
- Komunikasi data historis/agregat via **REST (JSON)**; data real-time per frame via **WebSocket**.
- FastAPI melakukan scoring deviasi vs baseline → hasil dikirim balik ke React untuk ditampilkan.

> **Keputusan desain:** MediaPipe berjalan di browser (JS), bukan di server. Hanya fitur hasil ekstraksi (angka sudut) yang dikirim ke backend — lebih hemat bandwidth dan latensi rendah.

---

## 3. Tech Stack

| Layer | Teknologi | Peran |
|---|---|---|
| **Frontend** | React 18 + Vite | SPA: onboarding, dashboard, visualisasi skeleton |
| | MediaPipe Tasks Vision (JS) | Deteksi 33 landmark pose langsung di browser |
| | Recharts | Grafik progres deviasi & laporan |
| **Backend** | FastAPI | REST API + WebSocket untuk scoring real-time |
| | Pydantic | Validasi skema data baseline & log |
| | SQLite + SQLAlchemy | Database lokal ringan |
| | NumPy | Agregasi mean/std baseline |
| **Infra** | Uvicorn | ASGI server |
| | CORS Middleware | Komunikasi React ↔ FastAPI |

---

## 4. Sesi Registrasi Pose: Alur Detail

### Fase 1 — Setup & Pemeriksaan Kamera

1. Pengguna diminta menyiapkan ruangan dengan pencahayaan cukup.
2. Kamera dinyalakan → cek kualitas frame (terang? user terlihat penuh?).
3. Instruksi: *"Posisikan diri agar seluruh tubuh atas terlihat di layar."*
4. Validasi: sistem cek landmark MediaPipe terdeteksi stabil ≥ 10 frame.
   - Jika tidak → beri panduan (mundur/maju/perbaiki pencahayaan), lalu ulangi pengecekan.

### Fase 2 — Panduan Rotasi Sisi (Angle Capture)

Pengguna **diarahkan oleh sistem** (dengan visual + countdown) untuk memutar tubuh ke beberapa orientasi. Skeleton di layar berubah warna saat orientasi sudah benar.

| Tahap | Orientasi yang Diminta | Tujuan Data |
|---|---|---|
| 1 | **Frontal (menghadap kamera)** | Kesimetrian bahu, kemiringan kepala, deteksi asimetri pinggul |
| 2 | **Lateral kiri (samping kiri ke kamera)** | Kurva leher & punggung dari samping — paling akurat untuk deteksi tech neck & slouching |
| 3 | **Lateral kanan** | Validasi silang, deteksi asimetri kiri-kanan |
| 4 | *(opsional)* **Posterior (belakang)** | Screening asimetri tulang belakang, bahu |

**Deteksi otomatis orientasi:** sistem sendiri yang mengenali user sudah menghadap ke arah yang benar (dari rasio lebar bahu terhadap kedalaman landmark — jika bahu "menyempit" berarti user sedang menyamping). Baru setelah itu perekaman dimulai.

**Urutan proses per orientasi:**

1. Sistem menampilkan ilustrasi + instruksi orientasi yang diminta.
2. Sistem mendeteksi orientasi user secara otomatis.
   - Belum sesuai → tampilkan instruksi perbaikan, kembali ke langkah 2.
   - Sudah sesuai → skeleton berubah warna sebagai tanda.
3. Countdown *"bertahan di posisi... 3.. 2.. 1.."*
4. Perekaman pose dimulai otomatis.

### Fase 3 — Instruksi Pose Referensi per Orientasi

Di setiap orientasi, pengguna diarahkan mengikuti **2–3 pose** yang ditampilkan sebagai ilustrasi/skeleton contoh di layar:

| Orientasi | Pose yang Diminta | Fungsi Baseline |
|---|---|---|
| Frontal | a) Berdiri rileks natural | Menangkap kebiasaan alami user |
| Frontal | b) Berdiri tegak maksimal ("dada dibusukkan") | Menangkap kapasitas ideal user |
| Frontal | c) Duduk normal seperti saat bekerja | Baseline postur kerja frontal |
| Samping kiri/kanan | a) Duduk rileks | Menangkap kecenderungan slouch user |
| Samping kiri/kanan | b) Duduk tegak | Baseline postur ideal duduk |
| Samping kiri/kanan | c) Berdiri tegak | Referensi align kepala-bahu-pinggul |

> **Kunci desain:** sistem menyimpan **dua kondisi** — *relaxed* (kebiasaan) dan *upright* (ideal). Dari selisih keduanya, sistem tahu *"seberapa jauh postur kerja user menyimpang dari kapasitas terbaiknya"* → dasar skoring personal.

### Fase 4 — Perekaman & Ekstraksi

Per pose:

1. Countdown 3 detik (stabilisasi).
2. Rekam 30–45 frame berturut-turut (~1,5 detik).
3. Ekstrak 33 landmark MediaPipe per frame.
4. Buang frame dengan visibility landmark rendah (< 0.5).
5. Hitung nilai rata-rata (mean) + standar deviasi per sudut kunci.
6. Kirim hasil agregasi ke FastAPI → simpan ke SQLite sebagai baseline.

### Fase 5 — Ringkasan Profil

Pengguna diperlihatkan hasil registrasi: skeleton posturnya, sudut-sudut kunci, dan skor awal. Data tersimpan sebagai **Posture Profile** melalui API backend.

---

## 5. Data Baseline yang Diekstraksi & Disimpan

Dari setiap kombinasi (orientasi × pose), sistem menghitung:

| Parameter | Cara Hitung | Kegunaan Nanti |
|---|---|---|
| **Sudut leher** | Telinga–Bahu vs vertikal | Deteksi tech neck personal |
| **Sudut punggung** | Bahu–Pinggul vs vertikal | Deteksi slouch personal |
| **Level bahu** | Selisih y bahu kiri–kanan (frontal) | Deteksi bahu miring |
| **Selisih maju bahu** | Posisi x bahu vs telinga (samping) | Deteksi rounded shoulders |
| **Jarak kepala–bahu (lebar bahu sebagai unit)** | Normalisasi skala | Konsisten untuk semua ukuran tubuh |
| **Align bahu–pinggul** | Offset horizontal | Deteksi postur condong |
| **Standar deviasi tiap sudut** | Variasi antar frame | Menentukan **toleransi personal** (orang yang gemetar/sering gerak → toleransi lebih lebar) |

**Normalisasi skala:** semua jarak dibagi lebar bahu user (`scale = jarak_bahu_kiri_ke_kanan`), sehingga profil tetap valid dihitung dari jarak kamera berapa pun.

---

---

## 8. Frontend — React

### Komponen Utama

| Komponen | Fungsi |
|---|---|
| `<OnboardingFlow />` | Wizard registrasi pose 5 fase (setup kamera → rotasi sisi → pose → rekam → ringkasan) |
| `<CameraCanvas />` | Akses `getUserMedia` + render video + overlay skeleton dari MediaPipe JS |
| `<PoseGuide />` | Ilustrasi pose referensi + deteksi orientasi otomatis + countdown |
| `<MonitorDashboard />` | Live monitoring: skor deviasi real-time via WebSocket |
| `<ProgressReport />` | Grafik deviasi mingguan (Recharts) |

---

## 9. Baseline Dipakai Saat Live Monitoring

Inti personalisasi: **skor deviasi** — seberapa jauh postur saat ini menyimpang dari baseline user sendiri. Dihitung di FastAPI, hasil dikirim ke React via WebSocket.

### Logika keputusan yang dipersonalisasi

| Kondisi Terdeteksi | Respons Sistem |
|---|---|
| `sudut_leher_live` jauh lebih besar dari baseline `duduk_relaxed` | *"Kepalamu lebih maju dari biasanya — tarik kepala ke belakang"* |
| `sudut_punggung_live` jauh lebih besar dari baseline | *"Kamu lebih membungkuk dari postur normalmu"* |
| Skor deviasi < 60 selama > 10 detik | 🔔 Notifikasi muncul |
| Postur mendekati baseline versi `duduk_tegak` | *"Mantap! Posturmu mendekati posisi idealmu"* |

### Keuntungan vs threshold generik

| Aspek | Threshold Generik | Dengan Baseline Personal |
|---|---|---|
| Orang dengan kyphosis ringan bawaan | Salah alert terus (dianggap buruk padahal normal baginya) | Tahu itu baseline-nya; hanya alert jika memburuk |
| Orang postur-nya sudah sangat baik | Alert jarang = kurang terdorong | Target bisa digeser ke baseline `duduk_tegak` (lebih menantang) |
| Ukuran tubuh berbeda-beda | Sudut sama belum tentu artinya sama | Ternormalisasi lebar bahu → konsisten |
| Progres pemulihan | Sulit diukur | "Minggu ini deviasi rata-rata turun 15% dari baseline" → terukur |

---

## 10. Alur Aplikasi

**1. Onboarding (pengguna baru, ±5–7 menit):**
- Registrasi pose: 3 orientasi × 2–3 pose, dengan countdown + rekam otomatis.
- React mengirim baseline ke FastAPI → tersimpan di SQLite sebagai **Posture Baseline Profile**.

**2. Penggunaan harian:**
- **Mode A — Posture Monitor:** MediaPipe JS ekstraksi landmark → WebSocket ke FastAPI → skor deviasi → alert personal di UI.
- **Mode B — Latihan Terpandu:** target mengikuti baseline versi *"tegak"* milik user (bukan skeleton generik).
- **Laporan:** endpoint `/api/users/{id}/laporan` → grafik progres deviasi (Recharts).

**3. Re-registrasi (opsional, tiap 1–3 bulan):**
- Baseline diperbarui → memantau perbaikan postur dari waktu ke waktu.

**Fitur penting — Re-registrasi berkala:** karena tujuan aplikasi adalah *perbaikan* postur, baseline idealnya di-refresh tiap 1–3 bulan. Kalau baseline user membaik (sudut tegak-nya berubah), itu **bukti terukur bahwa terapi bekerja** → fitur laporan progres yang kuat, sekaligus motivator.

---

## 11. Validasi & Edge Case

| Situasi | Penanganan |
|---|---|
| Orientasi tidak terdeteksi terus-menerus | Timeout 30 detik → tampilkan ilustrasi + tips ("putar badan 90° ke kiri") |
| Frame buram / landmark patah-patah | Frame dengan visibility < 0.5 dibuang; jika >50% frame dibuang → ulangi perekaman |
| User bergerak saat perekaman | Standar deviasi tinggi → sistem minta ulang pose tersebut |
| User pakai jas besar/rambut menutupi telinga | Deteksi landmark telinga lemah → fallback ke hidung + midpoint bahu |
| Registrasi di posisi kamera berbeda dari nanti | Instruksi: "gunakan posisi kamera yang sama seperti saat bekerja"; normalisasi lebar bahu mengurangi efek ini |
| Baseline "relaxed" dan "tegak" hampir identik | User sudah punya postur sangat baik → program fokus pencegahan & endurans |
| WebSocket terputus di tengah sesi | React auto-reconnect + buffer data → kirim ulang ke FastAPI |
| Kamera ditolak oleh browser | Tampilkan panduan izin kamera per-browser (Chrome/Edge/Firefox) |

---


## 14. Roadmap

**Fase 1 — MVP:**

1. Sistem registrasi pose 6 sesi (3 orientasi × 2 pose) → simpan baseline ke SQLite via FastAPI
2. Monitoring live: MediaPipe JS → WebSocket → skor deviasi di backend
3. Notifikasi deviasi + rekap sederhana di React

**Fase 2 — ditambahkan:**

- Re-registrasi + grafik perbandingan baseline lama vs baru (bukti perbaikan)
- Multi-user (profil per anggota keluarga/karyawan)
- Ekspor laporan PDF dari frontend
- Autentikasi JWT (login/logout di React + OAuth2 di FastAPI)

---

<div align="center">

**GenPosFit** — *Postur personal, bukan standar generik.* 🧘

</div>
