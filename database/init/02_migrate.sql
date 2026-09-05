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

-- Bersihkan prosedur temporary
DROP PROCEDURE IF EXISTS add_col;