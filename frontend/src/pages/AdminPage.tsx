import React, { useEffect, useState, useRef } from 'react';
import {
  ShieldCheck, Plus, Pencil, Trash2, Save, X, AlertTriangle, RefreshCw,
  Camera, CameraOff, CheckCircle2, Target
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  Button, Card, Input, Label, Textarea, Select, Badge, Pill, PillContent,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui';
import { SkeletonOverlay, type Landmark } from '../components/SkeletonOverlay';

interface ExerciseItem {
  exercise_id: number;
  nama: string;
  deskripsi: string | null;
  target_otot: string | null;
  sudut_target: Record<string, number> | null;
  skeleton_data: Landmark[] | null;
  sudut_leher: number | null;
  sudut_punggung: number | null;
  durasi_detik: number | null;
  reps: number;
  tingkat: string;
  is_battle: boolean;
}

const EMPTY_FORM = {
  nama: '',
  deskripsi: '',
  target_otot: '',
  sudut_target: '',
  durasi_detik: '',
  reps: '10',
  tingkat: 'pemula',
  is_battle: false as boolean,
};

function generateIdleLandmarks(): Landmark[] {
  const lms: Landmark[] = [];
  for (let i = 0; i < 33; i++) lms.push({ x: 0.5, y: 0.5, visibility: 0.8 });
  lms[0] = { x: 0.5, y: 0.28, visibility: 0.95 };
  lms[7] = { x: 0.44, y: 0.32, visibility: 0.95 };
  lms[8] = { x: 0.56, y: 0.32, visibility: 0.95 };
  lms[11] = { x: 0.45, y: 0.44, visibility: 0.95 };
  lms[12] = { x: 0.55, y: 0.44, visibility: 0.95 };
  lms[23] = { x: 0.46, y: 0.76, visibility: 0.95 };
  lms[24] = { x: 0.54, y: 0.76, visibility: 0.95 };
  lms[13] = { x: 0.39, y: 0.6, visibility: 0.9 };
  lms[14] = { x: 0.61, y: 0.6, visibility: 0.9 };
  return lms;
}

const apiUrl = () => import.meta.env?.VITE_API_URL || 'http://localhost:8042';

export const AdminPage: React.FC = () => {
  const { user, token } = useAuth();
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Camera pose recording
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordedLandmarks, setRecordedLandmarks] = useState<Landmark[] | null>(null);
  const [previewLandmarks, setPreviewLandmarks] = useState<Landmark[]>(() => generateIdleLandmarks());
  const captureLoopRef = useRef<number | null>(null);

  const isAdmin = user?.role === 'admin';

  const headers = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  });

  const fetchExercises = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl()}/api/admin/exercises`, { headers: headers() });
      if (res.ok) {
        setExercises(await res.json());
      } else {
        setError('Gagal memuat data. Pastikan Anda login sebagai admin.');
      }
    } catch {
      setError('Tidak dapat terhubung ke server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin && token) fetchExercises();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, token]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError(null);
    setRecordedLandmarks(null);
  };

  const startEdit = (ex: ExerciseItem) => {
    setEditingId(ex.exercise_id);
    setForm({
      nama: ex.nama,
      deskripsi: ex.deskripsi || '',
      target_otot: ex.target_otot || '',
      sudut_target: ex.sudut_target ? JSON.stringify(ex.sudut_target) : '',
      durasi_detik: ex.durasi_detik != null ? String(ex.durasi_detik) : '',
      reps: String(ex.reps ?? 10),
      tingkat: ex.tingkat || 'pemula',
      is_battle: !!ex.is_battle,
    });
    setRecordedLandmarks(ex.skeleton_data || null);
    setError(null);
  };

  const parseSudutTarget = (): { ok: true; value: Record<string, number> | null } | { ok: false } => {
    if (!form.sudut_target.trim()) return { ok: true, value: null };
    try {
      const parsed = JSON.parse(form.sudut_target);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Harus berupa objek JSON');
      }
      Object.values(parsed).forEach((v) => {
        if (typeof v !== 'number') throw new Error('Nilai harus angka');
      });
      return { ok: true, value: parsed };
    } catch {
      setError('Format sudut_target tidak valid. Contoh: {"sudut_leher": 168}');
      return { ok: false };
    }
  };

  const handleSave = async () => {
    setError(null);
    if (!form.nama.trim()) { setError('Nama wajib diisi.'); return; }

    const sudut = parseSudutTarget();
    if (!sudut.ok) return;

    const payload: Record<string, unknown> = {
      nama: form.nama.trim(),
      deskripsi: form.deskripsi || null,
      target_otot: form.target_otot || null,
      sudut_target: sudut.value,
      durasi_detik: form.durasi_detik ? Number(form.durasi_detik) : null,
      reps: Number(form.reps || 10),
      tingkat: form.tingkat,
      is_battle: form.is_battle,
    };

    if (recordedLandmarks && recordedLandmarks.length >= 25) {
      payload.skeleton_data = recordedLandmarks;
    }

    setSaving(true);
    const isEdit = editingId != null;
    const url = isEdit ? `${apiUrl()}/api/admin/exercises/${editingId}` : `${apiUrl()}/api/admin/exercises`;
    try {
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: headers(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.detail || 'Gagal menyimpan latihan.');
        return;
      }
      resetForm();
      fetchExercises();
    } catch {
      setError('Tidak dapat terhubung ke server.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ex: ExerciseItem) => {
    if (!window.confirm(`Hapus latihan "${ex.nama}"?`)) return;
    try {
      const res = await fetch(`${apiUrl()}/api/admin/exercises/${ex.exercise_id}`, {
        method: 'DELETE',
        headers: headers(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.detail || 'Gagal menghapus.');
        return;
      }
      setExercises(prev => prev.filter(e => e.exercise_id !== ex.exercise_id));
      if (editingId === ex.exercise_id) resetForm();
    } catch {
      setError('Tidak dapat terhubung ke server.');
    }
  };

  // ---- Camera pose recording ----
  const startRecord = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setRecording(true);
      captureLoopRef.current = window.setInterval(captureFrame, 200);
    } catch {
      setError('Kamera tidak tersedia atau izin ditolak.');
      setRecording(false);
    }
  };

  const stopRecord = () => {
    if (captureLoopRef.current) {
      clearInterval(captureLoopRef.current);
      captureLoopRef.current = null;
    }
    const v = videoRef.current;
    if (v?.srcObject) {
      (v.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      v.srcObject = null;
    }
    setRecording(false);
  };

  const captureFrame = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || v.readyState < 2) return;
    c.width = v.videoWidth || 640;
    c.height = v.videoHeight || 480;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    setPreviewLandmarks(generateIdleLandmarks());
  };

  const capturePose = () => {
    setRecordedLandmarks(previewLandmarks.map(p => ({ ...p })));
    setError(null);
  };

  const clearRecorded = () => setRecordedLandmarks(null);

  if (!token) {
    return <NoAccess message="Anda harus login terlebih dahulu." />;
  }

  if (!isAdmin) {
    return <NoAccess message="Halaman ini hanya untuk admin." />;
  }

  const set = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <Pill variant="info" size="md" className="mb-2">
            <ShieldCheck size={13} />
            <PillContent>KONTROL ADMIN</PillContent>
          </Pill>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Kelola Program Latihan
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Tambah, ubah, dan hapus latihan yang ditampilkan untuk pengguna/player.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchExercises}>
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Card */}
        <Card className="lg:col-span-4 p-5 self-start">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 mb-5">
            {editingId ? <Pencil size={15} className="text-blue-500" /> : <Plus size={15} className="text-emerald-500" />}
            <span>{editingId ? 'Ubah Latihan' : 'Tambah Latihan'}</span>
          </h2>

          <div className="space-y-4 text-xs">
            <div>
              <Label className="mb-1.5 block">Nama Latihan *</Label>
              <Input type="text" value={form.nama} onChange={set('nama')} placeholder="Chin Tuck" />
            </div>
            <div>
              <Label className="mb-1.5 block">Deskripsi</Label>
              <Textarea value={form.deskripsi} onChange={set('deskripsi')} placeholder="Instruksi gerakan" />
            </div>
            <div>
              <Label className="mb-1.5 block">Target Otot</Label>
              <Input type="text" value={form.target_otot} onChange={set('target_otot')} placeholder="Deep neck flexors" />
            </div>
            <div>
              <Label className="mb-1.5 block">Sudut Target (JSON)</Label>
              <Input type="text" value={form.sudut_target} onChange={set('sudut_target')} placeholder='{"sudut_leher": 168}' />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">Durasi (detik)</Label>
                <Input type="number" value={form.durasi_detik} onChange={set('durasi_detik')} placeholder="5" />
              </div>
              <div>
                <Label className="mb-1.5 block">Repetisi</Label>
                <Input type="number" value={form.reps} onChange={set('reps')} placeholder="10" />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">Tingkat</Label>
              <Select value={form.tingkat} onChange={set('tingkat')}>
                <option value="pemula">Pemula</option>
                <option value="menengah">Menengah</option>
                <option value="lanjut">Lanjut</option>
              </Select>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="default" size="sm" className="flex-1" onClick={handleSave} disabled={saving}>
                <Save size={14} /> {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Tambah'}
              </Button>
              {editingId != null && (
                <Button variant="outline" size="sm" onClick={resetForm}>
                  <X size={14} /> Batal
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Table of exercises */}
        <Card className="lg:col-span-8 p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Daftar Latihan</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {exercises.length} program aktif · tampil untuk pengguna di halaman Latihan Terapi
              </p>
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-xs text-slate-400">Memuat...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Reps × Durasi</TableHead>
                  <TableHead>Tingkat</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exercises.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-xs text-slate-400">
                      Belum ada latihan. Tambahkan lewat form di samping.
                    </TableCell>
                  </TableRow>
                ) : (
                  exercises.map(ex => (
                    <TableRow key={ex.exercise_id}>
                      <TableCell className="font-mono text-xs text-slate-500">{ex.exercise_id}</TableCell>
                      <TableCell>
                        <div className="font-semibold text-slate-900 dark:text-white">{ex.nama}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[220px]">{ex.deskripsi}</div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">{ex.target_otot || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{ex.reps} × {ex.durasi_detik ?? '—'}s</TableCell>
                      <TableCell>
                        <Badge variant={ex.tingkat === 'pemula' ? 'success' : ex.tingkat === 'menengah' ? 'warning' : 'destructive'}>
                          {ex.tingkat}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="outline" size="icon-sm" onClick={() => startEdit(ex)} title="Ubah">
                            <Pencil size={14} />
                          </Button>
                          <Button variant="destructive" size="icon-sm" onClick={() => handleDelete(ex)} title="Hapus">
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
};

const NoAccess: React.FC<{ message: string }> = ({ message }) => (
  <div className="min-h-[60vh] flex items-center justify-center px-4">
    <Card className="p-8 text-center max-w-sm w-full">
      <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
        <ShieldCheck size={24} className="text-rose-500" />
      </div>
      <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Akses Ditolak</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
    </Card>
  </div>
);