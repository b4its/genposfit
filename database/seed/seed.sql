-- ============================================================
-- GenPosFit — Data Awal (Latihan Terapi Dasar)
-- ============================================================
USE genposfit;

INSERT INTO exercises (nama, deskripsi, target_otot, sudut_target, durasi_detik, reps, tingkat)
VALUES
('Chin Tuck', 'Tarik dagu ke belakang sejajar leher, tahan 5 detik',
'Deep neck flexors', '{"sudut_leher": 168}', 5, 10, 'pemula'),

('Shoulder Blade Squeeze', 'Tarik kedua bahu ke belakang lalu rapatkan tulang belakang',
'Rhomboid, trapezius', '{"level_bahu": 0.02}', 5, 10, 'pemula'),

('Wall Angel', 'Dempel dinding, gerakkan lengan naik-turun seperti snow angel',
'Upper back', '{"sudut_siku": 90}', 3, 8, 'menengah'),

('Seated Back Extension', 'Duduk tegak, busungkan dada, tahan posisi',
'Erector spinae', '{"sudut_punggung": 172}', 8, 6, 'pemula'),

('Bird Dog', 'Merangkak, angkat tangan berlawanan dengan kaki',
'Core, lower back', '{"sudut_punggung": 170}', 5, 8, 'menengah'),

('Neck Side Stretch', 'Miringkan kepala ke samping, tahan peregangan',
'Upper trapezius', NULL, 20, 3, 'pemula')
ON DUPLICATE KEY UPDATE nama=VALUES(nama);
