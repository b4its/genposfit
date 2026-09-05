-- ============================================================
-- GenPosFit — SQL-based Column Migration
-- Idempotent (aman diulang). Menambahkan kolom baru untuk
-- tabel yang sudah ada tanpa menghapus data.
-- Jalankan via: make migrate
-- ============================================================

-- Fungsi pembantu: tambah kolom jika belum ada
DROP PROCEDURE IF EXISTS add_col;
DELIMITER ;;
CREATE PROCEDURE add_col(tname VARCHAR(64), cname VARCHAR(64), cdef VARCHAR(500))
BEGIN
  DECLARE cnt INT;
  SELECT COUNT(*) INTO cnt FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tname AND COLUMN_NAME = cname;
  IF cnt = 0 THEN
    SET @sql = CONCAT('ALTER TABLE ', tname, ' ADD COLUMN ', cname, ' ', cdef);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END;;
DELIMITER ;

-- ====================== USERS ======================
CALL add_col('users', 'username', 'VARCHAR(50) NULL AFTER user_id');
UPDATE users SET username = CONCAT('user_', user_id) WHERE username IS NULL;
ALTER TABLE users MODIFY username VARCHAR(50) NOT NULL;
-- Hanya buat index unik jika belum ada
SET @has_idx = (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'uq_users_username');
SET @sql = IF(@has_idx = 0, 'ALTER TABLE users ADD UNIQUE INDEX uq_users_username (username)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CALL add_col('users', 'hashed_password', 'VARCHAR(255) NULL AFTER username');
UPDATE users SET hashed_password = CONCAT('tmp_', MD5(CONCAT(user_id, UNIX_TIMESTAMP()))) WHERE hashed_password IS NULL OR hashed_password = '';
ALTER TABLE users MODIFY hashed_password VARCHAR(255) NOT NULL;

CALL add_col('users', 'role', "VARCHAR(20) DEFAULT 'user' AFTER jam_kerja_hari");
CALL add_col('users', 'poin', "INT DEFAULT 0 AFTER role");
CALL add_col('users', 'saldo', "DECIMAL(18,2) DEFAULT 0.00 AFTER poin");

-- ====================== EXERCISE TYPES ======================
CREATE TABLE IF NOT EXISTS exercise_types (
    type_id INT AUTO_INCREMENT PRIMARY KEY,
    nama VARCHAR(100) NOT NULL,
    deskripsi TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ====================== EXERCISES ======================
CALL add_col('exercises', 'type_id', 'INT NULL AFTER exercise_id');
-- Add index jika belum ada
SET @has_typeidx = (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exercises' AND INDEX_NAME = 'idx_type_id');
SET @sql = IF(@has_typeidx = 0, 'ALTER TABLE exercises ADD INDEX idx_type_id (type_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
-- Add FK jika belum ada (gunakan FK name tetap agar idempotent)
SET @has_fk = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exercises' AND CONSTRAINT_NAME = 'fk_exercise_type');
SET @sql = IF(@has_fk = 0, 'ALTER TABLE exercises ADD FOREIGN KEY fk_exercise_type (type_id) REFERENCES exercise_types(type_id) ON DELETE CASCADE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CALL add_col('exercises', 'skeleton_data', 'JSON NULL AFTER sudut_target');
CALL add_col('exercises', 'sudut_leher', 'DECIMAL(6,2) NULL AFTER skeleton_data');
CALL add_col('exercises', 'sudut_punggung', 'DECIMAL(6,2) NULL AFTER sudut_leher');
CALL add_col('exercises', 'is_battle', "TINYINT DEFAULT 0 AFTER tingkat");

-- ====================== POSTURE LOGS (kualitas data) ======================
CALL add_col('posture_logs', 'kualitas_data', 'DECIMAL(5,2) NULL AFTER status');
-- Index status untuk agregasi dashboard (idempotent via cek STATISTICS)
SET @has_qidx = (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'posture_logs' AND INDEX_NAME = 'idx_posture_status');
SET @sql = IF(@has_qidx = 0, 'ALTER TABLE posture_logs ADD INDEX idx_posture_status (status)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ====================== ROOMS ======================
CALL add_col('rooms', 'max_score', 'INT NOT NULL DEFAULT 10 AFTER status');
CALL add_col('rooms', 'exercises_json', 'JSON NULL AFTER max_score');

-- ====================== GAMIFIKASI (misi, ledger poin, battle) ======================
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



-- ================= SEED MISI DEFAULT (idempoten via kode unik) =================
INSERT IGNORE INTO quests (kode, judul, deskripsi, kategori, metrik, target, reward_poin, aktif) VALUES
 ('postur_prima_harian','Postur Prima Harian','Kumpulkan 12 sampel postur berkualitas berstatus BAGUS hari ini.','harian','postur_bagus',12,10,1),
 ('terapi_bergerak_harian','Terapi Bergerak Harian','Selesaikan 2 sesi latihan terapi postur hari ini.','harian','latihan_selesai',2,10,1),
 ('kalibrasi_ulang','Baseline Segar','Perbarui kalibrasi pose baseline-mu minggu ini.','mingguan','kalibrasi',1,15,1),
 ('konsistensi_pekan','Konsistensi Sepekan','Pantau postur minimal 40 sampel berkualitas di pekan ini.','mingguan','postur_qty',40,30,1),
 ('duel_pilar','Duel Pilar Postur','Menangkan 1 battle multiplayer minggu ini.','mingguan','battle_menang',1,25,1);


-- ====================== WALLET EVM + RIWAYAT DISTRIBUTION GPC ======================
CALL add_col('users', 'wallet_address', 'VARCHAR(42) NULL AFTER saldo');
SET @has_widx = (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'uq_users_wallet');
SET @sql = IF(@has_widx = 0, 'ALTER TABLE users ADD UNIQUE INDEX uq_users_wallet (wallet_address)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS gpc_reward_tx (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    periode VARCHAR(7) NOT NULL,
    user_id INT NOT NULL,
    rank INT NOT NULL,
    wallet_address VARCHAR(42) NOT NULL,
    jumlah DECIMAL(18, 2) NOT NULL,
    tx_hash VARCHAR(80) NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    error TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_gpc_periode_user (periode, user_id),
    INDEX idx_gpc_periode (periode),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Bersihkan prosedur temporary
DROP PROCEDURE IF EXISTS add_col;