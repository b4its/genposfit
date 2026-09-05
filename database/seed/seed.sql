-- ============================================================
-- GenPosFit — Data Awal (Latihan Terapi Dasar)
-- ============================================================
USE genposfit;

-- Jenis latihan (parent) — kategori terapi
INSERT INTO exercise_types (type_id, nama, deskripsi) VALUES
(1, 'Koreksi Leher', 'Latihan untuk menguatkan dan meluruskan posisi leher & kepala'),
(2, 'Koreksi Bahu', 'Latihan untuk peregangan dan postur bahu'),
(3, 'Koreksi Punggung', 'Latihan untuk memperbaiki postur punggung & tulang belakang')
ON DUPLICATE KEY UPDATE nama=VALUES(nama);

INSERT INTO exercises (type_id, nama, deskripsi, target_otot, sudut_target, durasi_detik, reps, tingkat)
VALUES
(1, 'Chin Tuck', 'Tarik dagu ke belakang sejajar leher, tahan 5 detik',
'Deep neck flexors', '{"sudut_leher": 168}', 5, 10, 'pemula'),
(1, 'Neck Side Stretch', 'Miringkan kepala ke samping, tahan peregangan',
'Upper trapezius', NULL, 20, 3, 'pemula'),
(2, 'Shoulder Blade Squeeze', 'Tarik kedua bahu ke belakang lalu rapatkan tulang belakang',
'Rhomboid, trapezius', '{"level_bahu": 0.02}', 5, 10, 'pemula'),
(2, 'Wall Angel', 'Dempel dinding, gerakkan lengan naik-turun seperti snow angel',
'Upper back', '{"sudut_siku": 90}', 3, 8, 'menengah'),
(3, 'Seated Back Extension', 'Duduk tegak, busungkan dada, tahan posisi',
'Erector spinae', '{"sudut_punggung": 172}', 8, 6, 'pemula'),
(3, 'Bird Dog', 'Merangkak, angkat tangan berlawanan dengan kaki',
'Core, lower back', '{"sudut_punggung": 170}', 5, 8, 'menengah')
ON DUPLICATE KEY UPDATE nama=VALUES(nama);
