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

-- ====================== EXERCISES ======================
CALL add_col('exercises', 'skeleton_data', 'JSON NULL AFTER sudut_target');
CALL add_col('exercises', 'sudut_leher', 'DECIMAL(6,2) NULL AFTER skeleton_data');
CALL add_col('exercises', 'sudut_punggung', 'DECIMAL(6,2) NULL AFTER sudut_leher');
CALL add_col('exercises', 'is_battle', "TINYINT DEFAULT 0 AFTER tingkat");

-- ====================== ROOMS ======================
CALL add_col('rooms', 'max_score', 'INT NOT NULL DEFAULT 10 AFTER status');

-- Bersihkan prosedur temporary
DROP PROCEDURE IF EXISTS add_col;