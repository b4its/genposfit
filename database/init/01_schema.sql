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
