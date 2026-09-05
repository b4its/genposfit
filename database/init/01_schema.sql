-- ============================================================
-- GenPosFit — Skema Database MySQL
-- Auto-dijalankan saat container db pertama kali dibuat
-- ============================================================

CREATE DATABASE IF NOT EXISTS genposfit CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE genposfit;

-- ------------------------- USERS ----------------------------
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    nama VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE,
    pekerjaan VARCHAR(100),
    jam_kerja_hari TINYINT DEFAULT 8,
    role VARCHAR(20) DEFAULT 'user',
    poin INT DEFAULT 0,
    saldo DECIMAL(18,2) DEFAULT 0.00,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username)
) ENGINE=InnoDB;

-- --------------------- POSE BASELINE ------------------------
CREATE TABLE IF NOT EXISTS pose_baseline (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    orientasi ENUM('frontal','lateral_kiri','lateral_kanan') NOT NULL,
    tipe_pose ENUM('berdiri_tegak','berdiri_rileks','duduk_tegak','duduk_rileks') NOT NULL,
    sudut_leher DECIMAL(6,2) NOT NULL,
    sudut_punggung DECIMAL(6,2) NOT NULL,
    level_bahu DECIMAL(6,4) NOT NULL,
    std_leher DECIMAL(6,3) NOT NULL,
    std_punggung DECIMAL(6,3) NOT NULL,
    n_frame SMALLINT NOT NULL,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_pose (user_id, orientasi, tipe_pose)
) ENGINE=InnoDB;

-- ---------------------- POSTURE LOGS ------------------------
CREATE TABLE IF NOT EXISTS posture_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    sesi_id VARCHAR(64),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    sudut_leher DECIMAL(6,2) NOT NULL,
    sudut_punggung DECIMAL(6,2) NOT NULL,
    level_bahu DECIMAL(6,4),
    skor_deviasi DECIMAL(5,2) NOT NULL,
    status ENUM('bagus','ringan','buruk') NOT NULL,
    kualitas_data DECIMAL(5,2) NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user_time (user_id, timestamp),
    INDEX idx_posture_status (status)
) ENGINE=InnoDB;

-- ------------------- JENIS LATIHAN (Parent) ------------------
CREATE TABLE IF NOT EXISTS exercise_types (
    type_id INT AUTO_INCREMENT PRIMARY KEY,
    nama VARCHAR(100) NOT NULL,
    deskripsi TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------- LATIHAN (Mode B) -----------------------
CREATE TABLE IF NOT EXISTS exercises (
    exercise_id INT AUTO_INCREMENT PRIMARY KEY,
    type_id INT,
    nama VARCHAR(100) NOT NULL,
    deskripsi TEXT,
    target_otot VARCHAR(150),
    sudut_target JSON,
    skeleton_data JSON,
    sudut_leher DECIMAL(6,2),
    sudut_punggung DECIMAL(6,2),
    durasi_detik SMALLINT,
    reps TINYINT DEFAULT 10,
    tingkat ENUM('pemula','menengah','lanjut') DEFAULT 'pemula',
    is_battle TINYINT DEFAULT 0,
    FOREIGN KEY (type_id) REFERENCES exercise_types(type_id) ON DELETE CASCADE,
    INDEX idx_type_id (type_id)
) ENGINE=InnoDB;

-- ------------------ SESSION LATIHAN -------------------------
CREATE TABLE IF NOT EXISTS exercise_sessions (
    session_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    exercise_id INT NOT NULL,
    total_reps TINYINT,
    avg_skor DECIMAL(5,2),
    selesai_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(exercise_id)
) ENGINE=InnoDB;

-- --------------------- ROOMS --------------------------------
CREATE TABLE IF NOT EXISTS rooms (
    room_id INT AUTO_INCREMENT PRIMARY KEY,
    room_code VARCHAR(20) NOT NULL UNIQUE,
    nama VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    host_player_id INT,
    status VARCHAR(20) DEFAULT 'waiting',
    max_score INT DEFAULT 10 NOT NULL,
    exercises_json JSON DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_room_code (room_code)
) ENGINE=InnoDB;

-- ------------------- ROOM PLAYERS ---------------------------
CREATE TABLE IF NOT EXISTS room_players (
    player_id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    user_id INT,
    guest_key VARCHAR(50),
    display_name VARCHAR(100) NOT NULL,
    warna VARCHAR(20) NOT NULL,
    is_host TINYINT DEFAULT 0,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY uq_room_color (room_id, warna),
    UNIQUE KEY uq_room_guest (room_id, guest_key),
    INDEX idx_guest_key (guest_key)
) ENGINE=InnoDB;

ALTER TABLE rooms ADD FOREIGN KEY (host_player_id) REFERENCES room_players(player_id)
    ON DELETE SET NULL;

-- ================= SEED MISI DEFAULT (idempoten via kode unik) =================
INSERT IGNORE INTO quests (kode, judul, deskripsi, kategori, metrik, target, reward_poin, aktif) VALUES
 ('postur_prima_harian','Postur Prima Harian','Kumpulkan 12 sampel postur berkualitas berstatus BAGUS hari ini.','harian','postur_bagus',12,10,1),
 ('terapi_bergerak_harian','Terapi Bergerak Harian','Selesaikan 2 sesi latihan terapi postur hari ini.','harian','latihan_selesai',2,10,1),
 ('kalibrasi_ulang','Baseline Segar','Perbarui kalibrasi pose baseline-mu minggu ini.','mingguan','kalibrasi',1,15,1),
 ('konsistensi_pekan','Konsistensi Sepekan','Pantau postur minimal 40 sampel berkualitas di pekan ini.','mingguan','postur_qty',40,30,1),
 ('duel_pilar','Duel Pilar Postur','Menangkan 1 battle multiplayer minggu ini.','mingguan','battle_menang',1,25,1);

CREATE TABLE IF NOT EXISTS point_ledger (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    delta INT NOT NULL,
    alasan VARCHAR(120) NOT NULL,
    periode VARCHAR(7) NOT NULL,
    ref_tipe VARCHAR(30),
    ref_id INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ledger_user_periode (user_id, periode),
    INDEX idx_ledger_periode (periode),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS quests (
    quest_id INT AUTO_INCREMENT PRIMARY KEY,
    kode VARCHAR(50) NOT NULL UNIQUE,
    judul VARCHAR(120) NOT NULL,
    deskripsi TEXT,
    kategori VARCHAR(12) NOT NULL,
    metrik VARCHAR(50) NOT NULL,
    target INT NOT NULL DEFAULT 5,
    reward_poin INT NOT NULL DEFAULT 10,
    aktif TINYINT NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_quest_kode (kode)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_quests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    quest_id INT NOT NULL,
    periode VARCHAR(10) NOT NULL,
    progres INT NOT NULL DEFAULT 0,
    status VARCHAR(12) NOT NULL DEFAULT 'aktif',
    diklaim_pada DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_quest_periode (user_id, quest_id, periode),
    INDEX idx_userquest_user (user_id, periode),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (quest_id) REFERENCES quests(quest_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS battle_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    battle_id VARCHAR(64) NOT NULL,
    room_code VARCHAR(20) NOT NULL,
    user_id INT NOT NULL,
    display_name VARCHAR(100),
    score_akhir INT NOT NULL DEFAULT 0,
    is_winner TINYINT NOT NULL DEFAULT 0,
    awarded_poin INT NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_battle_participant (battle_id, user_id),
    INDEX idx_battle_room (room_code),
    INDEX idx_battle_user_time (user_id, created_at),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Backfill ledger dari total poin lama supaya peringkat musim berjalan adil:
-- poin historis dianggap earned di periode sekarang, TANPA duplikasi.
INSERT INTO point_ledger (user_id, delta, alasan, periode, ref_tipe)
SELECT u.user_id, u.poin, 'backfill_lama', DATE_FORMAT(NOW(), '%Y-%m'), 'legacy'
FROM users u
WHERE u.poin > 0
  AND NOT EXISTS (SELECT 1 FROM point_ledger pl WHERE pl.user_id = u.user_id);
