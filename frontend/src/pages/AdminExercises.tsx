import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  ShieldCheck, Plus, Pencil, Trash2, Save, X, AlertTriangle, RefreshCw,
  Camera, CameraOff, CheckCircle2, Target, FolderOpen,
  Timer, Square, Sparkles, Layers, Search, Filter, Check, Eye, ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Input, Label, Textarea, Select, Badge, Pill, PillContent, Button } from '@/components/ui';
import { SkeletonOverlay, type Landmark } from '../components/SkeletonOverlay';
import { usePoseDetector } from '../hooks/usePoseDetector';
import { cn } from '@/lib/utils';
import { getApiUrl } from '../lib/api';

export interface SudutTargetMeta {
  sudut_leher?: number;
  sudut_punggung?: number;
  toleransi_derajat?: number;
  ambang_akurasi?: number;
  orientasi_kamera?: string;
  posisi_tubuh?: string;
  variasi_gerakan?: string;
  peralatan?: string;
  petunjuk_koreksi?: string;
}

export interface ChildExercise {
  exercise_id: number;
  type_id: number;
  nama: string;
  deskripsi: string | null;
  target_otot: string | null;
  sudut_target: SudutTargetMeta | Record<string, any> | null;
  skeleton_data: Landmark[] | null;
  sudut_leher: number | null;
  sudut_punggung: number | null;
  durasi_detik: number | null;
  reps: number;
  tingkat: string;
  is_battle: boolean;
}

export interface ExercisePreset {
  preset_id: string;
  nama: string;
  variasi: string;
  kategori_rekomendasi: string;
  kategori_key: string;
  posisi_tubuh: string;
  orientasi_kamera: string;
  peralatan: string;
  target_otot: string;
  tingkat: string;
  durasi_detik: number;
  reps: number;
  is_battle: boolean;
  sudut_leher: number;
  sudut_punggung: number;
  toleransi_derajat: number;
  ambang_akurasi: number;
  petunjuk_koreksi: string;
  deskripsi: string;
  pose_key: string;
  skeleton_data?: Landmark[];
  sudut_target?: SudutTargetMeta;
}

interface ExerciseType {
  type_id: number;
  nama: string;
  deskripsi: string | null;
  children: ChildExercise[];
}

const apiUrl = getApiUrl;

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

  // Extended pose recording & movement variation items
  const [childVariasi, setChildVariasi] = useState('Standar');
  const [childPosisi, setChildPosisi] = useState('berdiri');
  const [childOrientasi, setChildOrientasi] = useState('frontal');
  const [childPeralatan, setChildPeralatan] = useState('Tanpa Alat');
  const [childSudutLeher, setChildSudutLeher] = useState('168');
  const [childSudutPunggung, setChildSudutPunggung] = useState('175');
  const [childToleransi, setChildToleransi] = useState('15');
  const [childAmbangAkurasi, setChildAmbangAkurasi] = useState('75');
  const [childPetunjukKoreksi, setChildPetunjukKoreksi] = useState('');

  // Presets & multi-variation state
  const [presets, setPresets] = useState<ExercisePreset[]>([]);
  const [loadingPresets, setLoadingPresets] = useState(false);
  const [showPresetsModal, setShowPresetsModal] = useState(false);
  const [presetSearch, setPresetSearch] = useState('');
  const [presetCatFilter, setPresetCatFilter] = useState('semua');
  const [presetPosFilter, setPresetPosFilter] = useState('semua');
  const [selectedPresetIds, setSelectedPresetIds] = useState<string[]>([]);
  const [batchAdding, setBatchAdding] = useState(false);
  const [batchModeActive, setBatchModeActive] = useState(false);

  // Camera & skeleton recording
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [camActive, setCamActive] = useState(false);
  const [previewLandmarks, setPreviewLandmarks] = useState<Landmark[]>(() => generateIdleLandmarks());

  // usePoseDetector menangani kamera sekaligus deteksi skeleton (single-source camera).
  // Dipicu via `active`; nilai fresh disimpan di ref agar interval capture menggunakannya.
  const { landmarks: realLandmarks, errorMsg: poseError } = usePoseDetector(videoRef, camActive);
  const [camError, setCamError] = useState<string | null>(null);
  const realLandmarksRef = useRef<Landmark[] | null>(null);
  realLandmarksRef.current = (realLandmarks && realLandmarks.length >= 25) ? realLandmarks : realLandmarksRef.current;

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
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [camActive]);

  // Propagate mediapipe startup errors to the visible camError banner.
  useEffect(() => {
    if (poseError) setCamError(poseError);
  }, [poseError]);

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

  const fetchPresets = useCallback(async () => {
    setLoadingPresets(true);
    try {
      const res = await fetch(`${apiUrl()}/api/admin/exercise-presets`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setPresets(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingPresets(false);
    }
  }, [token]);

  useEffect(() => {
    if (isAdmin && token) {
      fetchTypes();
      fetchPresets();
    }
  }, [isAdmin, token, fetchTypes, fetchPresets]);

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
    setCamError(null);
    setCamActive(true);
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
      const lms = realLandmarksRef.current;
      if (lms && lms.length >= 25) {
        setCapturedFrames(prev => [...prev, lms.map(p => ({ ...p }))]);
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
    setCamActive(false);
    setRecording(false);
    setRecordingCountdown(0);
    if (captureTimerRef.current) { clearInterval(captureTimerRef.current); captureTimerRef.current = null; }
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
  };

  const captureSinglePose = () => {
    const lms = realLandmarksRef.current;
    if (camActive && lms && lms.length >= 25) {
      setChildSkeleton(lms.map(p => ({ ...p })));
    }
  };

  const clearSkeleton = () => setChildSkeleton(null);

  const resetChildForm = () => {
    setShowChildForm(false);
    setEditingChildId(null);
    setChildNama('');
    setChildVariasi('Standar');
    setChildDeskripsi('');
    setChildTarget('');
    setChildPosisi('berdiri');
    setChildOrientasi('frontal');
    setChildPeralatan('Tanpa Alat');
    setChildSudutLeher('168');
    setChildSudutPunggung('175');
    setChildToleransi('15');
    setChildAmbangAkurasi('75');
    setChildPetunjukKoreksi('');
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

    const st = child.sudut_target as SudutTargetMeta | null;
    setChildVariasi(st?.variasi_gerakan || 'Standar');
    setChildPosisi(st?.posisi_tubuh || 'berdiri');
    setChildOrientasi(st?.orientasi_kamera || 'frontal');
    setChildPeralatan(st?.peralatan || 'Tanpa Alat');
    setChildSudutLeher(String(st?.sudut_leher ?? child.sudut_leher ?? 168));
    setChildSudutPunggung(String(st?.sudut_punggung ?? child.sudut_punggung ?? 175));
    setChildToleransi(String(st?.toleransi_derajat ?? 15));
    setChildAmbangAkurasi(String(st?.ambang_akurasi ?? 75));
    setChildPetunjukKoreksi(st?.petunjuk_koreksi || '');
  };

  // Preset Application to Form
  const applyPresetToForm = (preset: ExercisePreset) => {
    setShowChildForm(true);
    setChildNama(preset.nama);
    setChildVariasi(preset.variasi || 'Standar');
    setChildDeskripsi(preset.deskripsi || '');
    setChildTarget(preset.target_otot || '');
    setChildPosisi(preset.posisi_tubuh || 'berdiri');
    setChildOrientasi(preset.orientasi_kamera || 'frontal');
    setChildPeralatan(preset.peralatan || 'Tanpa Alat');
    setChildSudutLeher(String(preset.sudut_leher ?? 168));
    setChildSudutPunggung(String(preset.sudut_punggung ?? 175));
    setChildToleransi(String(preset.toleransi_derajat ?? 15));
    setChildAmbangAkurasi(String(preset.ambang_akurasi ?? 75));
    setChildPetunjukKoreksi(preset.petunjuk_koreksi || '');
    setChildReps(String(preset.reps || 10));
    setChildTingkat(preset.tingkat || 'pemula');
    setChildDurasi(String(preset.durasi_detik || 5));
    setChildIsBattle(!!preset.is_battle);
    if (preset.skeleton_data && preset.skeleton_data.length >= 25) {
      setChildSkeleton(preset.skeleton_data);
    }
    setShowPresetsModal(false);
  };

  // Quick 1-Click Add Preset directly to Current Type
  const handleQuickAddSinglePreset = async (preset: ExercisePreset) => {
    if (!selectedType) {
      setError('Pilih jenis latihan terlebih dahulu.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        type_id: selectedType.type_id,
        nama: preset.nama,
        deskripsi: preset.deskripsi,
        target_otot: preset.target_otot,
        tingkat: preset.tingkat,
        durasi_detik: preset.durasi_detik,
        reps: preset.reps,
        is_battle: preset.is_battle,
        skeleton_data: preset.skeleton_data,
        sudut_target: preset.sudut_target || {
          sudut_leher: preset.sudut_leher,
          sudut_punggung: preset.sudut_punggung,
          toleransi_derajat: preset.toleransi_derajat,
          ambang_akurasi: preset.ambang_akurasi,
          orientasi_kamera: preset.orientasi_kamera,
          posisi_tubuh: preset.posisi_tubuh,
          variasi_gerakan: preset.variasi,
          peralatan: preset.peralatan,
          petunjuk_koreksi: preset.petunjuk_koreksi,
        },
      };
      const res = await fetch(`${apiUrl()}/api/admin/exercise-types/${selectedType.type_id}/exercises`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await fetchTypes();
        setShowPresetsModal(false);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d?.detail || 'Gagal menambahkan gerakan.');
      }
    } catch {
      setError('Tidak dapat terhubung ke server.');
    } finally {
      setSaving(false);
    }
  };

  // Batch Add Multiple Selected Presets
  const handleBatchAddPresets = async () => {
    if (!selectedType || selectedPresetIds.length === 0) return;
    setBatchAdding(true);
    setError(null);
    try {
      const selectedItems = presets.filter(p => selectedPresetIds.includes(p.preset_id));
      const payload = selectedItems.map(p => ({
        nama: p.nama,
        deskripsi: p.deskripsi,
        target_otot: p.target_otot,
        tingkat: p.tingkat,
        durasi_detik: p.durasi_detik,
        reps: p.reps,
        is_battle: p.is_battle,
        skeleton_data: p.skeleton_data,
        sudut_target: p.sudut_target || {
          sudut_leher: p.sudut_leher,
          sudut_punggung: p.sudut_punggung,
          toleransi_derajat: p.toleransi_derajat,
          ambang_akurasi: p.ambang_akurasi,
          orientasi_kamera: p.orientasi_kamera,
          posisi_tubuh: p.posisi_tubuh,
          variasi_gerakan: p.variasi,
          peralatan: p.peralatan,
          petunjuk_koreksi: p.petunjuk_koreksi,
        },
      }));

      const res = await fetch(`${apiUrl()}/api/admin/exercise-types/${selectedType.type_id}/batch-exercises`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await fetchTypes();
        setShowPresetsModal(false);
        setSelectedPresetIds([]);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d?.detail || 'Gagal menambahkan variasi gerakan secara batch.');
      }
    } catch {
      setError('Tidak dapat terhubung ke server.');
    } finally {
      setBatchAdding(false);
    }
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
      sudut_target: {
        sudut_leher: Number(childSudutLeher || 168),
        sudut_punggung: Number(childSudutPunggung || 175),
        toleransi_derajat: Number(childToleransi || 15),
        ambang_akurasi: Number(childAmbangAkurasi || 75),
        orientasi_kamera: childOrientasi,
        posisi_tubuh: childPosisi,
        variasi_gerakan: childVariasi || 'Standar',
        peralatan: childPeralatan,
        petunjuk_koreksi: childPetunjukKoreksi || 'Pertahankan postur tegak ergonomis.',
      },
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <FolderOpen size={16} className="text-purple-500" />
                      {selectedType.nama}
                    </h2>
                    {selectedType.deskripsi && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{selectedType.deskripsi}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => openAddChild(selectedType)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Plus size={14} /> Tambah Gerakan
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        setShowPresetsModal(true);
                        setBatchModeActive(false);
                        setSelectedPresetIds([]);
                      }}
                      className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                    >
                      <Sparkles size={14} /> Bank Variasi Gerakan ({presets.length || 32})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowPresetsModal(true);
                        setBatchModeActive(true);
                        setSelectedPresetIds([]);
                      }}
                      className="border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                    >
                      <Layers size={14} /> Tambah Banyak Sekaligus
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Child form */}
              {showChildForm && (
                <Card className="p-5 border-emerald-500/30">
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      {editingChildId ? <Pencil size={15} className="text-blue-500" /> : <Plus size={15} className="text-emerald-500" />}
                      <span>{editingChildId ? 'Ubah Gerakan & Postur Skeleton' : 'Tambah Gerakan Baru (Multi-Variasi & Pose)'}</span>
                      <Badge variant="info" className="text-[10px]">Skor: +1 per kecocokan</Badge>
                    </h3>
                    <Button variant="ghost" size="icon-sm" onClick={resetChildForm} title="Tutup">
                      <X size={16} />
                    </Button>
                  </div>

                  {/* QUICK VARIATION SELECTOR BANNER */}
                  <div className="mb-5 p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-purple-600 dark:text-purple-400 shrink-0" />
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white text-xs">Pilih Cepat dari Bank Variasi Gerakan (32 Pilihan)</span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Pilih templat gerakan untuk otomatis mengisi biomekanika sudut, otot target, dan skeleton referensi.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <select
                        className="text-xs bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 dark:text-slate-200 max-w-xs truncate"
                        defaultValue=""
                        onChange={e => {
                          const found = presets.find(p => p.preset_id === e.target.value);
                          if (found) applyPresetToForm(found);
                        }}
                      >
                        <option value="" disabled>-- Pilih Templat Variasi --</option>
                        {presets.map(p => (
                          <option key={p.preset_id} value={p.preset_id}>
                            [{p.kategori_rekomendasi}] {p.nama} ({p.variasi})
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowPresetsModal(true)}
                        className="text-xs shrink-0 bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200"
                      >
                        Katalog Lengkap
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4 text-xs">
                    {/* Camera recording & pose settings */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <Camera size={15} className="text-purple-500" />
                          <Label className="p-0 font-bold text-slate-900 dark:text-white">Rekam Gerakan Pose dari Kamera Pelatih</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 cursor-pointer bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20">
                            <input type="checkbox" checked={childIsBattle} onChange={e => setChildIsBattle(e.target.checked)} className="accent-purple-500" />
                            <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-300">Bisa Battle Multiplayer</span>
                          </label>
                        </div>
                      </div>

                      {/* Pose metadata quick pills */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Orientasi Kamera Target</span>
                          <div className="flex gap-1">
                            {[
                              { id: 'frontal', label: 'Tampak Depan' },
                              { id: 'sagital_kanan', label: 'Samping Kanan' },
                              { id: 'sagital_kiri', label: 'Samping Kiri' },
                              { id: 'oblique', label: 'Serong 45°' },
                            ].map(ori => (
                              <button
                                key={ori.id}
                                type="button"
                                onClick={() => setChildOrientasi(ori.id)}
                                className={cn(
                                  'flex-1 text-[10px] py-1 px-1.5 rounded text-center transition-colors font-medium',
                                  childOrientasi === ori.id
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                                )}
                              >
                                {ori.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Posisi / Sikap Tubuh</span>
                          <div className="flex gap-1">
                            {[
                              { id: 'berdiri', label: 'Berdiri' },
                              { id: 'duduk', label: 'Duduk' },
                              { id: 'dinding', label: 'Dinding' },
                              { id: 'matras', label: 'Matras' },
                              { id: 'tengkurap', label: 'Tengkurap' },
                            ].map(pos => (
                              <button
                                key={pos.id}
                                type="button"
                                onClick={() => setChildPosisi(pos.id)}
                                className={cn(
                                  'flex-1 text-[10px] py-1 px-1 rounded text-center transition-colors font-medium',
                                  childPosisi === pos.id
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                                )}
                              >
                                {pos.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Camera + skeleton viewport */}
                      <div className="relative w-full h-52 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden mb-3">
                        <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${camActive ? 'block' : 'hidden'}`} />
                        <SkeletonOverlay
                          landmarks={childSkeleton || previewLandmarks}
                          width={480} height={208}
                          orientasi={childOrientasi as any}
                          showAngles={true}
                          color={childSkeleton ? '#10b981' : '#8b5cf6'}
                          className="absolute inset-0"
                        />
                        {!camActive && !childSkeleton && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center text-slate-400">
                            <Camera size={24} className="text-slate-500 mb-1" />
                            <p className="text-xs font-semibold text-slate-300">Nyalakan kamera & lakukan pose gerakan.</p>
                            <p className="text-[11px] text-slate-500">Skeleton 33 titik MediaPipe akan terekam otomatis sebagai target pose.</p>
                          </div>
                        )}
                        {/* Recording overlay */}
                        {recording && (
                          <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1 rounded-xl bg-rose-600/90 text-white text-xs font-bold z-20 shadow-md animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                            Merekam: {recordingCountdown}s
                          </div>
                        )}
                        {childSkeleton && !recording && (
                          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-xl bg-emerald-600/90 text-white text-[11px] font-bold z-20 flex items-center gap-1.5 shadow-md">
                            <CheckCircle2 size={13} /> Skeleton Tersimpan ({childSkeleton.length} Titik)
                          </div>
                        )}
                      </div>

                      {/* Camera controls & Duration presets */}
                      <div className="flex flex-wrap items-center gap-2">
                        {!camActive ? (
                          <Button variant="default" size="sm" className="flex-1 font-semibold" onClick={startDurationModal}>
                            <Camera size={14} /> Nyalakan Kamera Pelatih
                          </Button>
                        ) : recording ? (
                          <Button variant="destructive" size="sm" className="flex-1 font-semibold" onClick={stopRecording}>
                            <Square size={14} /> Hentikan Rekam ({recordingCountdown}s)
                          </Button>
                        ) : (
                          <>
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-300 dark:border-slate-700">
                              <span className="text-[10px] font-bold text-slate-500 px-1.5">Durasi:</span>
                              {[3, 5, 10, 15].map(d => (
                                <button
                                  key={d}
                                  type="button"
                                  onClick={() => setRecordingDuration(d)}
                                  className={cn(
                                    'px-2 py-0.5 rounded text-[10px] font-bold transition-colors',
                                    recordingDuration === d
                                      ? 'bg-purple-600 text-white'
                                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                  )}
                                >
                                  {d}s
                                </button>
                              ))}
                            </div>

                            <Button variant="outline" size="sm" className="flex-1 font-semibold" onClick={beginRecording}>
                              <Timer size={14} /> Rekam Multi-Frame ({recordingDuration}s)
                            </Button>
                            <Button variant="success" size="sm" className="flex-1 font-semibold" onClick={captureSinglePose} disabled={!realLandmarks || realLandmarks.length < 25}>
                              <Target size={14} /> Tangkap Snapshot Instan
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="sm" onClick={stopCamIfActive} title="Matikan kamera">
                          <CameraOff size={14} />
                        </Button>
                        {childSkeleton && (
                          <Button variant="ghost" size="sm" onClick={clearSkeleton} title="Hapus skeleton" className="text-rose-500 hover:text-rose-600">
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>

                      {childSkeleton && !recording && (
                        <div className="mt-2.5 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 size={13} className="text-emerald-500" />
                            Skeleton target aktif ({childSkeleton.length} landmark). Sudut target terkalkulasi: Leher ~{childSudutLeher}°, Punggung ~{childSudutPunggung}°.
                          </span>
                          <span className="text-[10px] font-bold bg-emerald-500/20 px-2 py-0.5 rounded">Toleransi: ±{childToleransi}°</span>
                        </div>
                      )}
                      {camError && (
                        <div className="mt-2.5 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] flex items-center gap-1.5">
                          <AlertTriangle size={13} /> {camError}
                        </div>
                      )}
                    </div>

                    {/* EXTENDED FORM FIELDS */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div>
                        <Label className="mb-1 block font-semibold">Nama Gerakan Terapi *</Label>
                        <Input type="text" value={childNama} onChange={e => setChildNama(e.target.value)} placeholder="Contoh: Chin Tuck Alignment" />
                      </div>

                      <div>
                        <Label className="mb-1 block font-semibold">Variasi / Modifikasi Gerakan</Label>
                        <Input type="text" value={childVariasi} onChange={e => setChildVariasi(e.target.value)} placeholder="Contoh: Duduk di Kursi Kantor" />
                      </div>

                      <div>
                        <Label className="mb-1 block font-semibold">Peralatan yang Digunakan</Label>
                        <Select value={childPeralatan} onChange={e => setChildPeralatan(e.target.value)}>
                          <option value="Tanpa Alat">Tanpa Alat (Bodyweight)</option>
                          <option value="Kursi Kerja">Kursi Kerja</option>
                          <option value="Dinding">Dinding Rata</option>
                          <option value="Matras">Matras Olahraga</option>
                          <option value="Meja Kerja">Meja Kerja</option>
                          <option value="Handuk/Strap">Handuk / Strap Peregang</option>
                        </Select>
                      </div>

                      <div>
                        <Label className="mb-1 block font-semibold">Target Otot Utama</Label>
                        <Input type="text" value={childTarget} onChange={e => setChildTarget(e.target.value)} placeholder="Deep cervical flexors, Rhomboids" />
                      </div>

                      <div>
                        <Label className="mb-1 block font-semibold">Target Sudut Leher (°)</Label>
                        <Input type="number" min={90} max={180} value={childSudutLeher} onChange={e => setChildSudutLeher(e.target.value)} placeholder="168" />
                      </div>

                      <div>
                        <Label className="mb-1 block font-semibold">Target Sudut Punggung (°)</Label>
                        <Input type="number" min={90} max={180} value={childSudutPunggung} onChange={e => setChildSudutPunggung(e.target.value)} placeholder="175" />
                      </div>

                      <div>
                        <Label className="mb-1 block font-semibold">Toleransi Sudut Deviasi</Label>
                        <Select value={childToleransi} onChange={e => setChildToleransi(e.target.value)}>
                          <option value="8">±8° (Sangat Ketat / Presisi Tinggi)</option>
                          <option value="12">±12° (Ketat Ergonomis)</option>
                          <option value="15">±15° (Standar Terapi Normal)</option>
                          <option value="20">±20° (Fleksibel / Pemula)</option>
                        </Select>
                      </div>

                      <div>
                        <Label className="mb-1 block font-semibold">Ambang Akurasi Pose Minimum</Label>
                        <Select value={childAmbangAkurasi} onChange={e => setChildAmbangAkurasi(e.target.value)}>
                          <option value="65">65% (Fleksibel)</option>
                          <option value="75">75% (Standar Akurat)</option>
                          <option value="80">80% (Presisi Tinggi)</option>
                          <option value="85">85% (Sangat Ketat)</option>
                        </Select>
                      </div>

                      <div>
                        <Label className="mb-1 block font-semibold">Tingkat Kesulitan</Label>
                        <Select value={childTingkat} onChange={e => setChildTingkat(e.target.value)}>
                          <option value="pemula">Pemula</option>
                          <option value="menengah">Menengah</option>
                          <option value="lanjut">Lanjut</option>
                        </Select>
                      </div>

                      <div>
                        <Label className="mb-1 block font-semibold">Durasi Tahan / Rep (Detik)</Label>
                        <Input type="number" min={1} max={120} value={childDurasi} onChange={e => setChildDurasi(e.target.value)} placeholder="5" />
                      </div>

                      <div>
                        <Label className="mb-1 block font-semibold">Target Jumlah Repetisi</Label>
                        <Input type="number" min={1} max={100} value={childReps} onChange={e => setChildReps(e.target.value)} placeholder="10" />
                      </div>

                      <div className="sm:col-span-2 lg:col-span-3">
                        <Label className="mb-1 block font-semibold">Petunjuk Koreksi Real-time AI (Audio / Visual Cue)</Label>
                        <Input
                          type="text"
                          value={childPetunjukKoreksi}
                          onChange={e => setChildPetunjukKoreksi(e.target.value)}
                          placeholder="Pesan koreksi real-time saat peserta salah postur, contoh: Tarik dagu lurus ke belakang, bahu jangan terangkat."
                        />
                      </div>

                      <div className="sm:col-span-2 lg:col-span-3">
                        <Label className="mb-1 block font-semibold">Instruksi & Deskripsi Gerakan</Label>
                        <Textarea
                          value={childDeskripsi}
                          onChange={e => setChildDeskripsi(e.target.value)}
                          placeholder="Petunjuk langkah demi langkah, teknik bernapas, dan posisi awal anggota..."
                          rows={2}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <Button variant="default" size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold" onClick={saveChild} disabled={saving}>
                        <Save size={14} /> {saving ? 'Menyimpan...' : editingChildId ? 'Simpan Perubahan Gerakan' : 'Terbitkan Gerakan Terapi'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={resetChildForm}><X size={14} /> Batal</Button>
                    </div>
                  </div>
                </Card>
              )}

              {/* Children list */}
              <Card className="p-0 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      Daftar Gerakan ({selectedType.children?.length || 0})
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Gerakan aktif pada kategori ini. Dilengkapi pencocokan skeleton dan target biomekanika.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPresetsModal(true)}
                    className="text-xs text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-700"
                  >
                    <Sparkles size={12} /> + Variasi Preset
                  </Button>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(!selectedType.children || selectedType.children.length === 0) ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      Belum ada gerakan. Klik "Tambah Gerakan" atau pilih dari "Bank Variasi Gerakan".
                    </div>
                  ) : (
                    selectedType.children.map(child => {
                      const st = child.sudut_target as SudutTargetMeta | null;
                      return (
                        <div key={child.exercise_id} className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                              <Target size={15} className="text-purple-500" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900 dark:text-white flex flex-wrap items-center gap-1.5">
                                <span>{child.nama}</span>
                                {st?.variasi_gerakan && st.variasi_gerakan !== 'Standar' && (
                                  <Badge variant="info" className="text-[9px] h-4 px-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-300">
                                    {st.variasi_gerakan}
                                  </Badge>
                                )}
                                {st?.posisi_tubuh && (
                                  <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 capitalize">
                                    {st.posisi_tubuh} · {st.orientasi_kamera || 'frontal'}
                                  </span>
                                )}
                                {child.is_battle && <Badge variant="warning" className="text-[9px] h-4 px-1">Battle</Badge>}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                                {child.target_otot && <span>Otot: {child.target_otot}</span>}
                                <span>Reps: {child.reps} ({child.durasi_detik ?? 5}s/rep)</span>
                                <span className="text-slate-600 dark:text-slate-300 font-mono">
                                  Leher: {child.sudut_leher ? `${Math.round(child.sudut_leher)}°` : '-'} | Punggung: {child.sudut_punggung ? `${Math.round(child.sudut_punggung)}°` : '-'}
                                  {st?.toleransi_derajat ? ` (±${st.toleransi_derajat}°)` : ''}
                                </span>
                                <Badge variant={child.tingkat === 'pemula' ? 'success' : 'info'} className="text-[9px] h-4 px-1">{child.tingkat}</Badge>
                                {child.skeleton_data && child.skeleton_data.length >= 25 && (
                                  <span className="text-emerald-500 font-medium">✓ Skeleton Ref</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <Button variant="outline" size="icon-sm" onClick={() => openEditChild(child)} title="Ubah Gerakan & Rekam Ulang">
                              <Pencil size={14} />
                            </Button>
                            <Button variant="destructive" size="icon-sm" onClick={() => deleteChild(child)} title="Hapus Gerakan">
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                      );
                    })
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

      {/* ==================================================================== */}
      {/* MODAL: BANK VARIASI GERAKAN TERAPI (KATALOG LENGKAP 32 VARIASI)     */}
      {/* ==================================================================== */}
      {showPresetsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto animate-fadeIn"
          onClick={() => setShowPresetsModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-5xl my-6 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-purple-500/10 via-blue-500/5 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20">
                  <Sparkles size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">Bank Variasi Gerakan Terapi Ilmiah</h2>
                    <Badge variant="info" className="text-[10px]">{presets.length} Pilihan Variasi</Badge>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Pilih variasi gerakan spesifik untuk mengisi kategori <strong className="text-purple-600 dark:text-purple-400">{selectedType?.nama || 'Terapi'}</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant={batchModeActive ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBatchModeActive(!batchModeActive)}
                  className={batchModeActive ? 'bg-purple-600 text-white' : 'text-xs'}
                >
                  <Layers size={14} />
                  <span>{batchModeActive ? 'Mode Pilih Banyak Aktif' : 'Pilih Banyak (Batch)'}</span>
                </Button>
                <button
                  onClick={() => setShowPresetsModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 space-y-2.5">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={presetSearch}
                    onChange={e => setPresetSearch(e.target.value)}
                    placeholder="Cari variasi gerakan, otot target, atau posisi (contoh: Chin Tuck, Wall Angel, Rotasi)..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white"
                  />
                </div>
                {batchModeActive && selectedPresetIds.length > 0 && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleBatchAddPresets}
                    disabled={batchAdding}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shrink-0"
                  >
                    <Check size={14} /> {batchAdding ? 'Menambahkan...' : `Tambahkan ${selectedPresetIds.length} Variasi Terpilih`}
                  </Button>
                )}
              </div>

              {/* Category pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1">Fokus:</span>
                {[
                  { id: 'semua', label: 'Semua (32)' },
                  { id: 'leher', label: 'Leher (8)' },
                  { id: 'bahu', label: 'Bahu & Dada (8)' },
                  { id: 'punggung', label: 'Punggung & Spina (8)' },
                  { id: 'pinggul', label: 'Pinggul & Kaki (4)' },
                  { id: 'kantor', label: 'Ergonomi Meja (4)' },
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setPresetCatFilter(cat.id)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all',
                      presetCatFilter === cat.id
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-purple-50 dark:hover:bg-purple-950/30'
                    )}
                  >
                    {cat.label}
                  </button>
                ))}

                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 ml-3 mr-1">Posisi:</span>
                {[
                  { id: 'semua', label: 'Semua' },
                  { id: 'duduk', label: 'Duduk' },
                  { id: 'berdiri', label: 'Berdiri' },
                  { id: 'dinding', label: 'Dinding' },
                  { id: 'matras', label: 'Matras' },
                ].map(pos => (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => setPresetPosFilter(pos.id)}
                    className={cn(
                      'px-2 py-0.5 rounded text-[10px] font-medium transition-all',
                      presetPosFilter === pos.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200/70 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-300'
                    )}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Presets Cards Grid */}
            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {presets
                .filter(p => {
                  const matchCat = presetCatFilter === 'semua' || p.kategori_key === presetCatFilter;
                  const matchPos = presetPosFilter === 'semua' || p.posisi_tubuh?.toLowerCase().includes(presetPosFilter);
                  const q = presetSearch.toLowerCase();
                  const matchSearch = !q || p.nama.toLowerCase().includes(q) || p.variasi.toLowerCase().includes(q) || p.target_otot.toLowerCase().includes(q) || p.deskripsi.toLowerCase().includes(q);
                  return matchCat && matchPos && matchSearch;
                })
                .map(preset => {
                  const isSelected = selectedPresetIds.includes(preset.preset_id);
                  return (
                    <div
                      key={preset.preset_id}
                      className={cn(
                        'relative rounded-2xl border p-4 transition-all flex flex-col justify-between group',
                        isSelected
                          ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/40 ring-2 ring-purple-500/20'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 hover:border-purple-300 dark:hover:border-purple-700/60 shadow-xs'
                      )}
                    >
                      {/* Top Badges & Selection Checkbox */}
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <Badge variant="info" className="text-[10px] h-4.5 px-2 bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20">
                            {preset.kategori_rekomendasi}
                          </Badge>
                          {batchModeActive ? (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={e => {
                                if (e.target.checked) {
                                  setSelectedPresetIds(prev => [...prev, preset.preset_id]);
                                } else {
                                  setSelectedPresetIds(prev => prev.filter(id => id !== preset.preset_id));
                                }
                              }}
                              className="w-4 h-4 accent-purple-600 rounded cursor-pointer mt-0.5"
                            />
                          ) : (
                            <Badge variant={preset.tingkat === 'pemula' ? 'success' : 'info'} className="text-[9px] h-4 px-1.5 uppercase font-bold">
                              {preset.tingkat}
                            </Badge>
                          )}
                        </div>

                        <h4 className="font-bold text-slate-900 dark:text-white text-xs leading-snug group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                          {preset.nama}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-1 mb-2">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            Variasi: {preset.variasi}
                          </span>
                          <span className="text-[10px] text-slate-400 capitalize">
                            {preset.posisi_tubuh} · {preset.orientasi_kamera}
                          </span>
                        </div>

                        {/* Mini Skeleton Preview & Angle Stats */}
                        <div className="my-2.5 p-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                          <div className="w-24 h-20 relative bg-black/60 rounded-lg overflow-hidden shrink-0">
                            <SkeletonOverlay
                              landmarks={preset.skeleton_data || generateIdleLandmarks()}
                              width={96}
                              height={80}
                              orientasi={preset.orientasi_kamera as any}
                              showAngles={false}
                              color="#a855f7"
                              className="absolute inset-0"
                            />
                          </div>
                          <div className="text-[10px] text-slate-300 space-y-1 flex-1 min-w-0">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Target Leher:</span>
                              <span className="font-bold text-purple-400">{preset.sudut_leher}°</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Target Punggung:</span>
                              <span className="font-bold text-indigo-400">{preset.sudut_punggung}°</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Toleransi:</span>
                              <span className="text-emerald-400">±{preset.toleransi_derajat}°</span>
                            </div>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
                          {preset.deskripsi}
                        </p>
                        <div className="text-[10px] text-slate-400 mb-3 truncate">
                          <strong className="text-slate-500 dark:text-slate-300">Otot:</strong> {preset.target_otot}
                        </div>
                      </div>

                      {/* Action buttons on each card */}
                      <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => applyPresetToForm(preset)}
                          className="flex-1 text-[11px] py-1 h-7 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                          title="Muat variasi ini ke form untuk ditinjau atau diedit"
                        >
                          <Pencil size={12} /> Gunakan di Form
                        </Button>
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          onClick={() => handleQuickAddSinglePreset(preset)}
                          disabled={saving}
                          className="flex-1 text-[11px] py-1 h-7 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                          title="Langsung tambahkan variasi gerakan ini ke jenis latihan terpilih"
                        >
                          <Plus size={12} /> Tambah Cepat
                        </Button>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Modal Footer with Batch Actions */}
            <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                {batchModeActive ? (
                  <span>Terpilih: <strong>{selectedPresetIds.length}</strong> variasi gerakan</span>
                ) : (
                  <span>Menampilkan <strong>{presets.length}</strong> variasi preset gerakan terapi postur</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {batchModeActive && selectedPresetIds.length > 0 && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleBatchAddPresets}
                    disabled={batchAdding}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
                  >
                    <Check size={14} /> {batchAdding ? 'Menyimpan...' : `Tambahkan ${selectedPresetIds.length} Variasi ke ${selectedType?.nama}`}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setShowPresetsModal(false)}>
                  Tutup
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

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