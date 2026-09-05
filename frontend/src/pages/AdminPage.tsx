import React, { useEffect, useState } from 'react';
import {
  ShieldCheck, Plus, Pencil, Trash2, Save, X, AlertTriangle, RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  Button, Card, Input, Label, Textarea, Select, Badge, Pill, PillContent,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui';

interface ExerciseItem {
  exercise_id: number;
  nama: string;
  deskripsi: string | null;
  target_otot: string | null;
  sudut_target: Record<string, number> | null;
  durasi_detik: number | null;
  reps: number;
  tingkat: string;
}

const EMPTY_FORM = {
  nama: '',
  deskripsi: '',
  target_otot: '',
  sudut_target: '',
  durasi_detik: '',
  reps: '10',
  tingkat: 'pemula',
};

const apiUrl = () => import.meta.env?.VITE_API_URL || 'http://localhost:8042';

export const AdminPage: React.FC = () => {
  const { user, token } = useAuth();
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
    });
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

    const payload = {
      nama: form.nama.trim(),
      deskripsi: form.deskripsi || null,
      target_otot: form.target_otot || null,
      sudut_target: sudut.value,
      durasi_detik: form.durasi_detik ? Number(form.durasi_detik) : null,
      reps: Number(form.reps || 10),
      tingkat: form.tingkat,
    };

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