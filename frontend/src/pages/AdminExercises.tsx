import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  ShieldCheck, Plus, Pencil, Trash2, Save, X, AlertTriangle, RefreshCw,
  Camera, CameraOff, CheckCircle2, Target, FolderOpen,
  Timer, Square
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Input, Label, Textarea, Select, Badge, Pill, PillContent, Button } from '@/components/ui';
import { SkeletonOverlay, type Landmark } from '../components/SkeletonOverlay';
import { usePoseDetector } from '../hooks/usePoseDetector';
import { useCamera } from '../hooks/useCamera';
import { cn } from '@/lib/utils';

interface ChildExercise {
  exercise_id: number;
  type_id: number;
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

interface ExerciseType {
  type_id: number;
  nama: string;
  deskripsi: string | null;
  children: ChildExercise[];
}

const apiUrl = () => import.meta.env?.VITE_API_URL || 'http://localhost:8042';

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

export const AdminExercises: React.FC = () => {
  const { user, token } = useAuth();
  const [types, setTypes] = useState<ExerciseType[]>([]);
  const [selectedType, setSelectedType] = useState<ExerciseType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Type form
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
  const [typeNama, setTypeNama] = useState('');
  const [typeDeskripsi, setTypeDeskripsi] = useState('');

  // Child form
  const [showChildForm, setShowChildForm] = useState(false);
  const [editingChildId, setEditingChildId] = useState<number | null>(null);
  const [childNama, setChildNama] = useState('');
  const [childDeskripsi, setChildDeskripsi] = useState('');
  const [childTarget, setChildTarget] = useState('');
  const [childReps, setChildReps] = useState('10');
  const [childTingkat, setChildTingkat] = useState('pemula');
  const [childDurasi, setChildDurasi] = useState('5');
  const [childIsBattle, setChildIsBattle] = useState(false);
  const [childSkeleton, setChildSkeleton] = useState<Landmark[] | null>(null);
  const [saving, setSaving] = useState(false);

  // Camera & skeleton recording
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { error: camError, started: camStarted, stream: camStream, start: startCam, stop: stopCam } = useCamera();
  const { landmarks: realLandmarks } = usePoseDetector(videoRef, camStarted);
  const [camActive, setCamActive] = useState(false);
  const [previewLandmarks, setPreviewLandmarks] = useState<Landmark[]>(() => generateIdleLandmarks());

  // Recording state
  const [recording, setRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(10);
  const [recordingCountdown, setRecordingCountdown] = useState(0);
  const [showDurationModal, setShowDurationModal] = useState(false);
  const [capturedFrames, setCapturedFrames] = useState<Landmark[][]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const captureTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef(0);
  const recordingRef = useRef(false);

  useEffect(() => {
    if (videoRef.current && camStream) {
      videoRef.current.srcObject = camStream;
      videoRef.current.play();
    }
  }, [camStream]);

  useEffect(() => {
    setCamActive(camStarted);
  }, [camStarted]);

  useEffect(() => {
    if (camActive && realLandmarks && realLandmarks.length >= 25) {
      setPreviewLandmarks(realLandmarks);
    }
  }, [camActive, realLandmarks]);

  const isAdmin = user?.role === 'admin';

  const headers = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  });

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl()}/api/admin/exercise-types`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setTypes(data);
        setSelectedType(prev => {
          if (data.length === 0) return null;
          if (prev) {
            const updated = data.find((t: ExerciseType) => t.type_id === prev.type_id);
            return updated ?? data[0];
          }
          return data[0];
        });
      } else {
        setError('Gagal memuat data. Pastikan Anda login sebagai admin.');
      }
    } catch {
      setError('Tidak dapat terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isAdmin && token) fetchTypes();
  }, [isAdmin, token, fetchTypes]);

  // Camera cleanup
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (captureTimerRef.current) clearInterval(captureTimerRef.current);
    };
  }, []);

  // ---- Recording logic ----
  const startDurationModal = () => {
    setShowDurationModal(true);
    setRecordingDuration(10);
  };

  const beginRecording = async () => {
    setShowDurationModal(false);
    const ok = await startCam();
    if (!ok) {
      if (camError) setError(camError);
      return;
    }
    setRecording(true);
    setCapturedFrames([]);
    recordingRef.current = true;
    countdownRef.current = recordingDuration;
    setRecordingCountdown(recordingDuration);

    // Capture skeleton every 1 second during duration
    const fps = 5;
    const intervalMs = 1000 / fps;
    let frames = 0;
    const maxFrames = recordingDuration * fps;

    captureTimerRef.current = setInterval(() => {
      if (!recordingRef.current || frames >= maxFrames) return;
      if (realLandmarks && realLandmarks.length >= 25) {
        setCapturedFrames(prev => [...prev, realLandmarks.map(p => ({ ...p }))]);
        frames++;
      }
    }, intervalMs);

    // Countdown
    recordingTimerRef.current = setInterval(() => {
      countdownRef.current -= 1;
      setRecordingCountdown(countdownRef.current);
      if (countdownRef.current <= 0) {
        stopRecording();
      }
    }, 1000);
  };

  const stopRecording = () => {
    recordingRef.current = false;
    setRecording(false);
    setRecordingCountdown(0);
    if (captureTimerRef.current) { clearInterval(captureTimerRef.current); captureTimerRef.current = null; }
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
  };

  useEffect(() => {
    if (recording) return;
    setCapturedFrames(prev => {
      if (prev.length > 0) {
        return prev;
      }
      return prev;
    });
  }, [recording]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (recording) return;
    if (capturedFrames.length === 0) return;
    setChildSkeleton(averageLandmarks(capturedFrames));
  }, [capturedFrames, recording]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (capturedFrames.length > 1 && !recording) {
      const avg = averageLandmarks(capturedFrames);
      setChildSkeleton(avg);
    }
  }, [recording, capturedFrames.length]);

  const averageLandmarks = (frames: Landmark[][]): Landmark[] => {
    if (frames.length === 0) return [];
    const result: Landmark[] = [];
    for (let i = 0; i < frames[0].length; i++) {
      let x = 0, y = 0, vis = 0;
      let count = 0;
      for (const frame of frames) {
        if (frame[i]) {
          x += frame[i].x;
          y += frame[i].y;
          vis += frame[i].visibility || 0.8;
          count++;
        }
      }
      result.push({
        x: count > 0 ? x / count : 0.5,
        y: count > 0 ? y / count : 0.5,
        visibility: count > 0 ? vis / count : 0.8,
      });
    }
    return result;
  };

  const stopCamIfActive = () => {
    stopCam();
    setCamActive(false);
    setRecording(false);
    setRecordingCountdown(0);
    if (captureTimerRef.current) { clearInterval(captureTimerRef.current); captureTimerRef.current = null; }
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
  };

  const captureSinglePose = () => {
    if (camActive && realLandmarks && realLandmarks.length >= 25) {
      setChildSkeleton(realLandmarks.map(p => ({ ...p })));
    }
  };

  const clearSkeleton = () => setChildSkeleton(null);

  const resetChildForm = () => {
    setShowChildForm(false);
    setEditingChildId(null);
    setChildNama('');
    setChildDeskripsi('');
    setChildTarget('');
    setChildReps('10');
    setChildTingkat('pemula');
    setChildDurasi('5');
    setChildIsBattle(false);
    setChildSkeleton(null);
    stopCamIfActive();
  };

  const resetTypeForm = () => {
    setShowTypeForm(false);
    setEditingTypeId(null);
    setTypeNama('');
    setTypeDeskripsi('');
  };

  // ---- Type CRUD ----
  const openAddType = () => {
    resetTypeForm();
    setShowTypeForm(true);
  };

  const openEditType = (t: ExerciseType) => {
    setEditingTypeId(t.type_id);
    setTypeNama(t.nama);
    setTypeDeskripsi(t.deskripsi || '');
    setShowTypeForm(true);
  };

  const saveType = async () => {
    setError(null);
    if (!typeNama.trim()) { setError('Nama jenis latihan wajib diisi.'); return; }
    setSaving(true);
    const isEdit = editingTypeId != null;
    const url = isEdit ? `${apiUrl()}/api/admin/exercise-types/${editingTypeId}` : `${apiUrl()}/api/admin/exercise-types`;
    try {
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: headers(),
        body: JSON.stringify({ nama: typeNama.trim(), deskripsi: typeDeskripsi || null }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d?.detail || 'Gagal menyimpan.'); return; }
      resetTypeForm();
      await fetchTypes();
    } catch { setError('Tidak dapat terhubung ke server.'); }
    finally { setSaving(false); }
  };

  const deleteType = async (t: ExerciseType) => {
    if (!window.confirm(`Hapus jenis latihan "${t.nama}" beserta semua gerakannya?`)) return;
    try {
      const res = await fetch(`${apiUrl()}/api/admin/exercise-types/${t.type_id}`, {
        method: 'DELETE', headers: headers(),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d?.detail || 'Gagal menghapus.'); return; }
      setTypes(prev => prev.filter(tt => tt.type_id !== t.type_id));
      if (selectedType?.type_id === t.type_id) setSelectedType(null);
    } catch { setError('Tidak dapat terhubung ke server.'); }
  };

  // ---- Child CRUD ----
  const openAddChild = (t: ExerciseType) => {
    resetChildForm();
    setSelectedType(t);
    setShowChildForm(true);
    setChildDurasi('5');
  };

  const openEditChild = (child: ChildExercise) => {
    setShowChildForm(true);
    setEditingChildId(child.exercise_id);
    setChildNama(child.nama);
    setChildDeskripsi(child.deskripsi || '');
    setChildTarget(child.target_otot || '');
    setChildReps(String(child.reps || 10));
    setChildTingkat(child.tingkat || 'pemula');
    setChildDurasi(String(child.durasi_detik || 5));
    setChildIsBattle(!!child.is_battle);
    setChildSkeleton(child.skeleton_data || null);
  };

  const saveChild = async () => {
    setError(null);
    if (!childNama.trim()) { setError('Nama gerakan wajib diisi.'); return; }
    if (!selectedType) { setError('Pilih jenis latihan terlebih dahulu.'); return; }
    setSaving(true);
    const payload: Record<string, unknown> = {
      type_id: selectedType.type_id,
      nama: childNama.trim(),
      deskripsi: childDeskripsi || null,
      target_otot: childTarget || null,
      reps: Number(childReps || 10),
      tingkat: childTingkat,
      durasi_detik: Number(childDurasi || 5),
      is_battle: childIsBattle,
    };
    if (childSkeleton && childSkeleton.length >= 25) {
      payload.skeleton_data = childSkeleton;
    }
    const isEdit = editingChildId != null;
    const url = isEdit
      ? `${apiUrl()}/api/admin/exercises/${editingChildId}`
      : `${apiUrl()}/api/admin/exercise-types/${selectedType.type_id}/exercises`;
    try {
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: headers(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d?.detail || 'Gagal menyimpan gerakan.'); return; }
      resetChildForm();
      await fetchTypes();
    } catch { setError('Tidak dapat terhubung ke server.'); }
    finally { setSaving(false); }
  };

  const deleteChild = async (child: ChildExercise) => {
    if (!window.confirm(`Hapus gerakan "${child.nama}"?`)) return;
    try {
      const res = await fetch(`${apiUrl()}/api/admin/exercises/${child.exercise_id}`, {
        method: 'DELETE', headers: headers(),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d?.detail || 'Gagal menghapus.'); return; }
      await fetchTypes();
    } catch { setError('Tidak dapat terhubung ke server.'); }
  };

  if (!token) return <NoAccess message="Anda harus login terlebih dahulu." />;
  if (!isAdmin) return <NoAccess message="Halaman ini hanya untuk admin." />;

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
            Kelola Latihan Terapi
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Tambah jenis latihan (parent) dan gerakan-gerakan anak (child) dengan skeleton dari kamera.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchTypes}>
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button variant="default" size="sm" onClick={openAddType}>
            <Plus size={14} /> Tambah Latihan Terapi
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 flex items-start gap-2 text-xs">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
          <button className="ml-auto text-rose-500 hover:text-rose-700" onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {/* Type form */}
      {showTypeForm && (
        <Card className="p-5 mb-6 border-blue-500/30">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 mb-4">
            {editingTypeId ? <Pencil size={15} className="text-blue-500" /> : <FolderOpen size={15} className="text-emerald-500" />}
            <span>{editingTypeId ? 'Ubah Jenis Latihan' : 'Tambah Jenis Latihan (Parent)'}</span>
          </h2>
          <div className="space-y-4 text-xs">
            <div>
              <Label className="mb-1.5 block">Nama Jenis Latihan *</Label>
              <Input type="text" value={typeNama} onChange={e => setTypeNama(e.target.value)} placeholder="Contoh: Koreksi Leher" />
            </div>
            <div>
              <Label className="mb-1.5 block">Deskripsi</Label>
              <Textarea value={typeDeskripsi} onChange={e => setTypeDeskripsi(e.target.value)} placeholder="Jelaskan jenis latihan ini" />
            </div>
            <div className="flex gap-2">
              <Button variant="default" size="sm" className="flex-1" onClick={saveType} disabled={saving}>
                <Save size={14} /> {saving ? 'Menyimpan...' : editingTypeId ? 'Simpan Perubahan' : 'Tambah'}
              </Button>
              <Button variant="outline" size="sm" onClick={resetTypeForm}><X size={14} /> Batal</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Main layout: types sidebar + children area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar: types list */}
        <Card className="lg:col-span-4 p-4 self-start">
          <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">
            Jenis Latihan ({types.length})
          </h2>
          {loading ? (
            <div className="text-xs text-slate-400 py-4 text-center">Memuat...</div>
          ) : types.length === 0 ? (
            <div className="text-xs text-slate-400 py-4 text-center">
              Belum ada jenis latihan. Klik "Tambah Latihan Terapi" untuk memulai.
            </div>
          ) : (
            <div className="space-y-1">
              {types.map(t => (
                <button
                  key={t.type_id}
                  onClick={() => { setSelectedType(t); resetChildForm(); }}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center justify-between transition-all',
                    selectedType?.type_id === t.type_id
                      ? 'bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent text-slate-700 dark:text-slate-300'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FolderOpen size={14} className="shrink-0" />
                    <span className="font-semibold truncate">{t.nama}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="info" className="text-[10px] h-4 px-1.5">{t.children?.length || 0}</Badge>
                    <button onClick={e => { e.stopPropagation(); openEditType(t); }} className="p-1 hover:text-blue-500"><Pencil size={12} /></button>
                    <button onClick={e => { e.stopPropagation(); deleteType(t); }} className="p-1 hover:text-rose-500"><Trash2 size={12} /></button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Right: children of selected type */}
        <div className="lg:col-span-8 space-y-4">
          {selectedType ? (
            <>
              {/* Header */}
              <Card className="p-4 border-purple-500/30">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <FolderOpen size={16} className="text-purple-500" />
                      {selectedType.nama}
                    </h2>
                    {selectedType.deskripsi && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{selectedType.deskripsi}</p>
                    )}
                  </div>
                  <Button variant="default" size="sm" onClick={() => openAddChild(selectedType)}>
                    <Plus size={14} /> Tambah Gerakan
                  </Button>
                </div>
              </Card>

              {/* Child form */}
              {showChildForm && (
                <Card className="p-5 border-emerald-500/30">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                    {editingChildId ? <Pencil size={14} className="text-blue-500" /> : <Plus size={14} className="text-emerald-500" />}
                    <span>{editingChildId ? 'Ubah Gerakan' : 'Tambah Gerakan Baru'}</span>
                    <Badge variant="info" className="text-[10px]">Skor: +1 per kecocokan</Badge>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* Camera recording */}
                    <div className="md:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="p-0">Rekam Gerakan dari Kamera</Label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={childIsBattle} onChange={e => setChildIsBattle(e.target.checked)} className="accent-purple-500" />
                          <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">Bisa Battle</span>
                        </label>
                      </div>

                      {/* Camera + skeleton */}
                      <div className="relative w-full h-48 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden mb-2">
                        <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${camActive ? 'block' : 'hidden'}`} />
                        <SkeletonOverlay
                          landmarks={childSkeleton || previewLandmarks}
                          width={320} height={192}
                          orientasi="frontal"
                          showAngles={false}
                          color={childSkeleton ? '#10b981' : '#8b5cf6'}
                          className="absolute inset-0"
                        />
                        {!camActive && !childSkeleton && (
                          <div className="absolute inset-0 flex items-center justify-center text-[11px] text-slate-400">
                            Buka kamera & lakukan gerakan. Skeleton akan otomatis terekam sesuai durasi.
                          </div>
                        )}
                        {/* Recording overlay */}
                        {recording && (
                          <div className="absolute top-3 left-3 flex items-center gap-2 px-2 py-1 rounded-lg bg-rose-600/80 text-white text-[11px] font-bold z-20">
                            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                            Rekam {recordingCountdown}s
                          </div>
                        )}
                        {childSkeleton && !recording && (
                          <div className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-emerald-600/80 text-white text-[10px] font-bold z-20 flex items-center gap-1">
                            <CheckCircle2 size={12} /> Skeleton terekam
                          </div>
                        )}
                      </div>

                      {/* Camera controls */}
                      <div className="flex flex-wrap gap-2">
                        {!camActive ? (
                          <Button variant="outline" size="sm" className="flex-1" onClick={startDurationModal}>
                            <Camera size={14} /> Mulai Rekam Gerakan
                          </Button>
                        ) : recording ? (
                          <Button variant="secondary" size="sm" className="flex-1" onClick={stopRecording}>
                            <Square size={14} /> Hentikan Rekam
                          </Button>
                        ) : (
                          <>
                            <Button variant="outline" size="sm" className="flex-1" onClick={startDurationModal}>
                              <Timer size={14} /> Rekam Ulang ({recordingDuration}s)
                            </Button>
                            <Button variant="success" size="sm" className="flex-1" onClick={captureSinglePose} disabled={!realLandmarks || realLandmarks.length < 25}>
                              <Target size={14} /> Tangkap Sekarang
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="sm" onClick={stopCamIfActive} title="Matikan kamera">
                          <CameraOff size={14} />
                        </Button>
                        {childSkeleton && (
                          <Button variant="ghost" size="sm" onClick={clearSkeleton} title="Hapus skeleton">
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                      {childSkeleton && !recording && (
                        <div className="mt-2 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium flex items-center gap-1">
                          <CheckCircle2 size={13} /> Skeleton tersimpan ({childSkeleton.length} titik) — referensi gerakan.
                        </div>
                      )}
                      {camError && (
                        <div className="mt-2 text-rose-600 dark:text-rose-400 text-[11px] flex items-center gap-1">
                          <AlertTriangle size={13} /> {camError}
                        </div>
                      )}
                    </div>

                    {/* Child form fields */}
                    <div>
                      <Label className="mb-1.5 block">Nama Gerakan *</Label>
                      <Input type="text" value={childNama} onChange={e => setChildNama(e.target.value)} placeholder="Contoh: Chin Tuck" />
                    </div>
                    <div>
                      <Label className="mb-1.5 block">Deskripsi</Label>
                      <Input type="text" value={childDeskripsi} onChange={e => setChildDeskripsi(e.target.value)} placeholder="Instruksi singkat" />
                    </div>
                    <div>
                      <Label className="mb-1.5 block">Target Otot</Label>
                      <Input type="text" value={childTarget} onChange={e => setChildTarget(e.target.value)} placeholder="Deep neck flexors" />
                    </div>
                    <div>
                      <Label className="mb-1.5 block">Durasi (detik)/rep</Label>
                      <Input type="number" min={1} value={childDurasi} onChange={e => setChildDurasi(e.target.value)} placeholder="5" />
                    </div>
                    <div>
                      <Label className="mb-1.5 block">Repetisi</Label>
                      <Input type="number" min={1} value={childReps} onChange={e => setChildReps(e.target.value)} placeholder="10" />
                    </div>
                    <div>
                      <Label className="mb-1.5 block">Tingkat</Label>
                      <Select value={childTingkat} onChange={e => setChildTingkat(e.target.value)}>
                        <option value="pemula">Pemula</option>
                        <option value="menengah">Menengah</option>
                        <option value="lanjut">Lanjut</option>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button variant="default" size="sm" className="flex-1" onClick={saveChild} disabled={saving}>
                      <Save size={14} /> {saving ? 'Menyimpan...' : editingChildId ? 'Simpan Perubahan' : 'Tambah Gerakan'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={resetChildForm}><X size={14} /> Batal</Button>
                  </div>
                </Card>
              )}

              {/* Children list */}
              <Card className="p-0 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Daftar Gerakan ({selectedType.children?.length || 0})
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Setiap gerakan bernilai +1 skor ketika dicocokkan dengan benar di mode battle multiplayer.
                  </p>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(!selectedType.children || selectedType.children.length === 0) ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      Belum ada gerakan. Klik "Tambah Gerakan" untuk menambahkan.
                    </div>
                  ) : (
                    selectedType.children.map(child => (
                      <div key={child.exercise_id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/40">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                            <Target size={14} className="text-purple-500" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                              {child.nama}
                              {child.is_battle && <Badge variant="warning" className="text-[9px] h-4 px-1">Battle</Badge>}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                              {child.target_otot && <span>Otot: {child.target_otot}</span>}
                              <span>Reps: {child.reps}</span>
                              <span>Durasi: {child.durasi_detik ?? '-'}s</span>
                              <Badge variant={child.tingkat === 'pemula' ? 'success' : 'info'} className="text-[9px] h-4 px-1">{child.tingkat}</Badge>
                              {child.skeleton_data && child.skeleton_data.length >= 25 && (
                                <span className="text-emerald-500 font-medium">✓ Skeleton</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="outline" size="icon-sm" onClick={() => openEditChild(child)} title="Ubah">
                            <Pencil size={14} />
                          </Button>
                          <Button variant="destructive" size="icon-sm" onClick={() => deleteChild(child)} title="Hapus">
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </>
          ) : (
            <Card className="p-8 text-center">
              <FolderOpen size={32} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Pilih jenis latihan dari sidebar untuk melihat & mengelola gerakan.</p>
            </Card>
          )}
        </div>
      </div>

      {/* Duration modal */}
      {showDurationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowDurationModal(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-500">
                <Timer size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Atur Durasi Rekam</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tentukan berapa detik kamera akan otomatis merekam skeleton gerakan Anda.
                </p>
              </div>
            </div>
            <div className="mb-5">
              <Label className="mb-1.5 block">Durasi (detik)</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={3}
                  max={120}
                  value={recordingDuration}
                  onChange={e => setRecordingDuration(Math.max(3, Number(e.target.value)))}
                  className="text-2xl font-bold text-center"
                />
                <span className="text-sm text-slate-500 font-medium">detik</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Selama {recordingDuration} detik, skeleton akan ditangkap otomatis & dirata-rata.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="default" size="lg" className="flex-1" onClick={beginRecording}>
                <Camera size={16} /> Mulai Rekam
              </Button>
              <Button variant="outline" size="lg" onClick={() => setShowDurationModal(false)}>
                <X size={16} /> Batal
              </Button>
            </div>
          </div>
        </div>
      )}
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