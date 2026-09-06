import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, Pause, RotateCcw, Award, HeartPulse, Camera, CameraOff, Target,
  AlertTriangle, Plus, Pencil, Trash2, ShieldCheck, Swords, CheckCircle2,
  X, Save, Timer, Search, FolderPlus, RefreshCw, Users,
  Sparkles, Layers, CheckSquare, Info
} from 'lucide-react';
import {
  Button, Card, Badge, Progress, Pill, PillContent,
  Input, Label, Textarea, Select, toast
} from '../components/ui';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../lib/api';
import { SkeletonOverlay, type Landmark } from '../components/SkeletonOverlay';
import { usePoseDetector } from '../hooks/usePoseDetector';
import type { PageTab } from '../components/Navbar';

export interface PoseStep {
  step_id: string;
  urutan: number;
  nama_step: string;
  instruksi?: string;
  durasi_tahan_detik: number;
  landmarks: Landmark[] | null;
  sudut_leher?: number;
  sudut_punggung?: number;
  toleransi_derajat?: number;
  pose_key?: string;
}

export interface SudutTargetMeta {
  orientasi_kamera?: 'frontal' | 'sagital_kanan' | 'sagital_kiri' | 'oblique' | string;
  posisi_tubuh?: 'berdiri' | 'duduk' | 'dinding' | 'matras' | 'tengkurap' | string;
  variasi_gerakan?: string;
  peralatan?: string;
  toleransi_derajat?: number;
  ambang_akurasi?: number;
  petunjuk_koreksi?: string;
  sudut_leher?: number;
  sudut_punggung?: number;
  pose_steps?: PoseStep[];
  [key: string]: unknown;
}

export interface ExercisePreset {
  preset_id: string;
  nama: string;
  variasi: string;
  kategori_rekomendasi: string;
  target_otot: string;
  deskripsi: string;
  tingkat: string;
  posisi_tubuh: string;
  orientasi_kamera: string;
  peralatan: string;
  sudut_leher: number;
  sudut_punggung: number;
  toleransi_derajat: number;
  ambang_akurasi: number;
  petunjuk_koreksi: string;
  durasi_detik: number;
  reps: number;
  is_battle: boolean;
  skeleton_data?: Landmark[];
  sudut_target?: SudutTargetMeta;
  pose_steps?: PoseStep[];
}

export interface ExerciseItem {
  exercise_id: number;
  type_id?: number;
  type?: string;
  nama: string;
  deskripsi: string | null;
  target_otot: string | null;
  sudut_target: SudutTargetMeta | null;
  skeleton_data: Landmark[] | null;
  sudut_leher: number | null;
  sudut_punggung: number | null;
  durasi_detik: number | null;
  reps: number;
  tingkat: string;
  is_battle: boolean;
  pose_steps?: PoseStep[];
}

export interface ExerciseTypeGroup {
  type_id: number;
  nama: string;
  deskripsi: string | null;
  children: ExerciseItem[];
}

interface ExercisesProps {
  setActiveTab?: (tab: PageTab) => void;
}

const apiUrl = getApiUrl;

function generateFallbackSkeleton(): Landmark[] {
  const lms: Landmark[] = [];
  for (let i = 0; i < 33; i++) lms.push({ x: 0.5, y: 0.5, visibility: 0.85 });
  lms[0] = { x: 0.50, y: 0.22, visibility: 0.98 };
  lms[7] = { x: 0.44, y: 0.21, visibility: 0.95 };
  lms[8] = { x: 0.56, y: 0.21, visibility: 0.95 };
  lms[11] = { x: 0.38, y: 0.38, visibility: 0.98 };
  lms[12] = { x: 0.62, y: 0.38, visibility: 0.98 };
  lms[13] = { x: 0.32, y: 0.52, visibility: 0.92 };
  lms[14] = { x: 0.68, y: 0.52, visibility: 0.92 };
  lms[15] = { x: 0.30, y: 0.66, visibility: 0.92 };
  lms[16] = { x: 0.70, y: 0.66, visibility: 0.92 };
  lms[23] = { x: 0.43, y: 0.70, visibility: 0.98 };
  lms[24] = { x: 0.57, y: 0.70, visibility: 0.98 };
  lms[25] = { x: 0.43, y: 0.85, visibility: 0.92 };
  lms[26] = { x: 0.57, y: 0.85, visibility: 0.92 };
  lms[27] = { x: 0.43, y: 0.97, visibility: 0.92 };
  lms[28] = { x: 0.57, y: 0.97, visibility: 0.92 };
  return lms;
}

function averageLandmarks(frames: Landmark[][]): Landmark[] {
  if (!frames.length) return [];
  const count = frames.length;
  const numPoints = frames[0].length;
  const result: Landmark[] = [];
  for (let i = 0; i < numPoints; i++) {
    let sx = 0, sy = 0, sv = 0;
    for (const f of frames) {
      const p = f[i] || { x: 0.5, y: 0.5, visibility: 0.8 };
      sx += p.x;
      sy += p.y;
      sv += p.visibility || 0.8;
    }
    result.push({
      x: Number((sx / count).toFixed(4)),
      y: Number((sy / count).toFixed(4)),
      visibility: Number((sv / count).toFixed(2)),
    });
  }
  return result;
}

export const Exercises: React.FC<ExercisesProps> = ({ setActiveTab }) => {
  const { user, token } = useAuth();
  const isAdmin = user?.role === 'admin';
  const currentUserId = user?.user_id || 1;

  // Data state
  const [types, setTypes] = useState<ExerciseTypeGroup[]>([]);
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [activeExercise, setActiveExercise] = useState<ExerciseItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters & search
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyBattleFilter, setOnlyBattleFilter] = useState<boolean>(false);

  // Participant Exercise Runner State
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentRep, setCurrentRep] = useState<number>(0);
  const [holdTimer, setHoldTimer] = useState<number>(5);
  const [sessionCompleted, setSessionCompleted] = useState<boolean>(false);
  const [poseScores, setPoseScores] = useState<number[]>([]);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [scoreStatus, setScoreStatus] = useState<string | null>(null);
  const [scoreMessage, setScoreMessage] = useState<string | null>(null);
  const [activeRunnerStepIndex, setActiveRunnerStepIndex] = useState<number>(0);
  const [stepSuccessFlash, setStepSuccessFlash] = useState<string | null>(null);

  // Participant Camera
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [camActive, setCamActive] = useState<boolean>(false);
  const [camError, setCamError] = useState<string | null>(null);
  const { landmarks: realLandmarks, errorMsg: runnerPoseError } = usePoseDetector(videoRef, camActive);
  const playerLandmarksRef = useRef<Landmark[] | null>(null);
  const [playerLandmarks, setPlayerLandmarks] = useState<Landmark[] | null>(null);
  useEffect(() => { playerLandmarksRef.current = playerLandmarks; }, [playerLandmarks]);
  const activeExerciseRef = useRef<ExerciseItem | null>(activeExercise);
  useEffect(() => { activeExerciseRef.current = activeExercise; }, [activeExercise]);

  // Admin Modal: Exercise Type Form
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [typeFormName, setTypeFormName] = useState('');
  const [typeFormDesc, setTypeFormDesc] = useState('');
  const [savingType, setSavingType] = useState(false);

  // Admin Modal: Exercise Item Form + Multi-Step Pose Skeleton Recorder
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingExerciseId, setEditingExerciseId] = useState<number | null>(null);
  const [itemFormTypeId, setItemFormTypeId] = useState<number>(1);
  const [itemFormNama, setItemFormNama] = useState('');
  const [itemFormDeskripsi, setItemFormDeskripsi] = useState('');
  const [itemFormTargetOtot, setItemFormTargetOtot] = useState('');
  const [itemFormDurasi, setItemFormDurasi] = useState('5');
  const [itemFormReps, setItemFormReps] = useState('10');
  const [itemFormTingkat, setItemFormTingkat] = useState('pemula');
  const [itemFormIsBattle, setItemFormIsBattle] = useState(true);
  const [itemFormSkeleton, setItemFormSkeleton] = useState<Landmark[] | null>(null);
  const [savingItem, setSavingItem] = useState(false);

  // Multi-step pose skeleton list & active selection for trainer
  const [itemFormPoseSteps, setItemFormPoseSteps] = useState<PoseStep[]>([
    {
      step_id: 'step-1',
      urutan: 1,
      nama_step: 'Fase 1: Posisi Atas (Plank Awal)',
      instruksi: 'Tahan postur tubuh lurus & tegap',
      durasi_tahan_detik: 3,
      landmarks: null,
    },
  ]);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [isPlayingStepPreview, setIsPlayingStepPreview] = useState<boolean>(false);
  const stepPreviewIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Extended pose recording & movement variation items
  const [itemFormVariasi, setItemFormVariasi] = useState('Standar');
  const [itemFormPosisi, setItemFormPosisi] = useState('berdiri');
  const [itemFormOrientasi, setItemFormOrientasi] = useState('frontal');
  const [itemFormPeralatan, setItemFormPeralatan] = useState('Tanpa Alat');
  const [itemFormSudutLeher, setItemFormSudutLeher] = useState('168');
  const [itemFormSudutPunggung, setItemFormSudutPunggung] = useState('175');
  const [itemFormToleransi, setItemFormToleransi] = useState('15');
  const [itemFormAmbangAkurasi, setItemFormAmbangAkurasi] = useState('75');
  const [itemFormPetunjukKoreksi, setItemFormPetunjukKoreksi] = useState('');

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

  // Admin Recorder Camera & Pose Capture
  const adminVideoRef = useRef<HTMLVideoElement | null>(null);
  const [adminCamActive, setAdminCamActive] = useState(false);
  const [adminCamError, setAdminCamError] = useState<string | null>(null);
  const { landmarks: adminLandmarks, errorMsg: adminPoseError } = usePoseDetector(adminVideoRef, adminCamActive);
  const adminLandmarksRef = useRef<Landmark[] | null>(null);
  useEffect(() => {
    if (adminLandmarks && adminLandmarks.length >= 25) {
      adminLandmarksRef.current = adminLandmarks;
    }
  }, [adminLandmarks]);

  // Timed recording state in admin modal
  const [isRecordingTimer, setIsRecordingTimer] = useState(false);
  const [countdownVal, setCountdownVal] = useState(0);
  const [recordingDurationSec, setRecordingDurationSec] = useState(5);
  const adminRecordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const adminCaptureTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const capturedBufferRef = useRef<Landmark[][]>([]);

  const authHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  const fetchPresets = useCallback(async () => {
    if (!token) return;
    setLoadingPresets(true);
    try {
      const res = await fetch(`${apiUrl()}/api/admin/exercise-presets`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setPresets(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingPresets(false);
    }
  }, [token, authHeaders]);

  useEffect(() => {
    if (isAdmin && token) {
      fetchPresets();
    }
  }, [isAdmin, token, fetchPresets]);

  // Load exercises from backend
  const loadExercises = useCallback(async (selectId?: number) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${apiUrl()}/api/exercises/types`);
      if (res.ok) {
        const typeData: ExerciseTypeGroup[] = await res.json();
        setTypes(typeData);

        const flattened: ExerciseItem[] = [];
        typeData.forEach(t => {
          (t.children || []).forEach(c => {
            flattened.push({
              ...c,
              type: t.nama,
              type_id: t.type_id,
            });
          });
        });

        if (flattened.length === 0) {
          // Fallback to flat endpoint
          const resFlat = await fetch(`${apiUrl()}/api/exercises`);
          if (resFlat.ok) {
            const flatData = await resFlat.json();
            if (Array.isArray(flatData)) flattened.push(...flatData);
          }
        }

        setExercises(flattened);

        // Select active exercise
        if (flattened.length > 0) {
          if (selectId) {
            const found = flattened.find(e => e.exercise_id === selectId);
            setActiveExercise(found || flattened[0]);
          } else {
            setActiveExercise(prev => {
              if (!prev) return flattened[0];
              const stillExists = flattened.find(e => e.exercise_id === prev.exercise_id);
              return stillExists || flattened[0];
            });
          }
        } else {
          setActiveExercise(null);
        }
      } else {
        setErrorMsg('Gagal mengambil daftar latihan dari server.');
      }
    } catch {
      setErrorMsg('Tidak dapat terhubung ke server GenPosFit.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExercises();
  }, [loadExercises]);

  // Sync runner mediapipe errors
  useEffect(() => {
    if (runnerPoseError) setCamError(runnerPoseError);
  }, [runnerPoseError]);

  useEffect(() => {
    if (adminPoseError) setAdminCamError(adminPoseError);
  }, [adminPoseError]);

  // Runner camera toggle
  const toggleRunnerCamera = () => {
    if (camActive) {
      setCamActive(false);
      return;
    }
    if (!window.isSecureContext) {
      setCamError('Akses kamera membutuhkan HTTPS — buka via https:// atau localhost.');
      return;
    }
    setCamError(null);
    setCamActive(true);
  };

  useEffect(() => {
    if (videoRef.current && camActive) {
      videoRef.current.play().catch(() => {});
    }
  }, [camActive]);

  useEffect(() => {
    if (adminVideoRef.current && adminCamActive) {
      adminVideoRef.current.play().catch(() => {});
    }
  }, [adminCamActive]);

  // Sync real landmarks for runner
  useEffect(() => {
    if (camActive && realLandmarks && realLandmarks.length >= 25) {
      setPlayerLandmarks(realLandmarks);
    }
  }, [camActive, realLandmarks]);

  // Score comparison against backend skeleton
  const scorePose = async (): Promise<number> => {
    const lm = playerLandmarksRef.current;
    const ex = activeExerciseRef.current;
    if (!ex || !lm || lm.length < 25) return 0;
    try {
      const res = await fetch(`${apiUrl()}/api/exercises/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landmarks: lm, exercise_id: ex.exercise_id }),
      });
      if (res.ok) {
        const data = await res.json();
        setScoreStatus(data.status || null);
        setScoreMessage(data.message || null);
        return data.score || 0;
      }
    } catch { /* offline */ }
    return 0;
  };

  // Save completed exercise session
  const saveCompletedSession = async (exerciseId: number, totalReps: number) => {
    const scores = poseScores;
    const avgSkor = scores.length
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : 92.5;
    try {
      await fetch(`${apiUrl()}/api/exercises/sessions`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          user_id: currentUserId,
          exercise_id: exerciseId,
          total_reps: totalReps,
          avg_skor: avgSkor,
        }),
      });
    } catch { /* offline */ }
  };

  // Runner timer
  useEffect(() => {
    if (!isRunning || !activeExerciseRef.current) return;
    const interval = setInterval(() => {
      setHoldTimer(prev => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, activeExercise]);

  useEffect(() => {
    if (!isRunning || holdTimer > 1) return;
    const ex = activeExerciseRef.current;
    if (!ex) return;

    const steps: PoseStep[] = (ex.sudut_target?.pose_steps || ex.pose_steps || []) as PoseStep[];

    if (steps.length > 1) {
      // Multi-step exercise flow!
      if (activeRunnerStepIndex < steps.length - 1) {
        // Step completed, advance to next step!
        const nextStepIdx = activeRunnerStepIndex + 1;
        setActiveRunnerStepIndex(nextStepIdx);
        setHoldTimer(steps[nextStepIdx].durasi_tahan_detik || 3);
        setStepSuccessFlash(`✓ Langkah ${activeRunnerStepIndex + 1} Berhasil! Lanjut ke ${steps[nextStepIdx].nama_step}`);
        setTimeout(() => setStepSuccessFlash(null), 2000);

        scorePose().then(s => {
          setLastScore(s);
          setPoseScores(prev => [...prev, s]);
        }).catch(() => {});
      } else {
        // All steps completed in sequence! Count +1 Repetisi!
        setActiveRunnerStepIndex(0);
        setHoldTimer(steps[0].durasi_tahan_detik || 3);
        setStepSuccessFlash(`🎉 Repetisi Lengkap! Semua ${steps.length} langkah tuntas (+1 Rep)`);
        setTimeout(() => setStepSuccessFlash(null), 2500);

        setCurrentRep(r => {
          const nextR = r + 1;
          if (nextR >= (ex.reps || 10)) {
            setTimeout(() => {
              setIsRunning(false);
              setSessionCompleted(true);
              saveCompletedSession(ex.exercise_id, nextR);
            }, 0);
          }
          return nextR;
        });

        scorePose().then(s => {
          setLastScore(s);
          setPoseScores(prev => [...prev, s]);
        }).catch(() => {});
      }
    } else {
      // Single-step exercise flow
      setCurrentRep(r => {
        const nextR = r + 1;
        if (nextR >= (ex.reps || 10)) {
          setTimeout(() => {
            setIsRunning(false);
            setSessionCompleted(true);
            saveCompletedSession(ex.exercise_id, nextR);
          }, 0);
        }
        return nextR;
      });

      setHoldTimer(ex.durasi_detik || 5);

      scorePose().then(s => {
        setLastScore(s);
        setPoseScores(prev => [...prev, s]);
      }).catch(() => {});
    }
  }, [holdTimer, isRunning, activeExercise, activeRunnerStepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectExercise = (ex: ExerciseItem) => {
    setActiveExercise(ex);
    setIsRunning(false);
    setCurrentRep(0);
    setActiveRunnerStepIndex(0);
    const steps = (ex.sudut_target?.pose_steps || ex.pose_steps || []);
    const initTimer = steps.length > 0 && steps[0].durasi_tahan_detik
      ? steps[0].durasi_tahan_detik
      : (ex.durasi_detik || 5);
    setHoldTimer(initTimer);
    setSessionCompleted(false);
    setPoseScores([]);
    setLastScore(null);
    setScoreStatus(null);
    setScoreMessage(null);
    setStepSuccessFlash(null);
  };

  const toggleRun = () => {
    if (sessionCompleted) {
      setCurrentRep(0);
      setActiveRunnerStepIndex(0);
      setSessionCompleted(false);
      setPoseScores([]);
      setLastScore(null);
      const steps = (activeExercise?.sudut_target?.pose_steps || activeExercise?.pose_steps || []);
      const initTimer = steps.length > 0 && steps[0].durasi_tahan_detik
        ? steps[0].durasi_tahan_detik
        : (activeExercise?.durasi_detik || 5);
      setHoldTimer(initTimer);
    }
    setIsRunning(!isRunning);
  };

  const resetRoutine = () => {
    setIsRunning(false);
    setCurrentRep(0);
    setActiveRunnerStepIndex(0);
    setSessionCompleted(false);
    setPoseScores([]);
    setLastScore(null);
    setScoreStatus(null);
    setScoreMessage(null);
    setStepSuccessFlash(null);
    const steps = (activeExercise?.sudut_target?.pose_steps || activeExercise?.pose_steps || []);
    const initTimer = steps.length > 0 && steps[0].durasi_tahan_detik
      ? steps[0].durasi_tahan_detik
      : (activeExercise?.durasi_detik || 5);
    setHoldTimer(initTimer);
  };

  // -------------------------------------------------------------
  // ADMIN ACTIONS: CATEGORY & EXERCISE ITEM SKELETON RECORDER
  // -------------------------------------------------------------

  // Seed default exercises
  const handleSeedDefaults = async () => {
    if (!isAdmin) return;
    setErrorMsg(null);
    try {
      const res = await fetch(`${apiUrl()}/api/admin/exercises/seed-defaults`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (res.ok) {
        setSuccessMsg('Paket latihan standar dengan data skeleton referensi berhasil dimuat.');
        await loadExercises();
      } else {
        setErrorMsg('Gagal memuat paket latihan standar.');
      }
    } catch {
      setErrorMsg('Tidak dapat terhubung ke server.');
    }
  };

  // Category Modal
  const openCreateCategoryModal = () => {
    setTypeFormName('');
    setTypeFormDesc('');
    setShowTypeModal(true);
  };

  const handleSaveCategory = async () => {
    if (!typeFormName.trim()) {
      setErrorMsg('Nama kategori latihan wajib diisi.');
      return;
    }
    setSavingType(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${apiUrl()}/api/admin/exercise-types`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          nama: typeFormName.trim(),
          deskripsi: typeFormDesc.trim() || null,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setSuccessMsg(`Kategori "${created.nama}" berhasil dibuat.`);
        setShowTypeModal(false);
        await loadExercises();
        if (created.type_id) setItemFormTypeId(created.type_id);
      } else {
        const d = await res.json().catch(() => ({}));
        setErrorMsg(d?.detail || 'Gagal menyimpan kategori latihan.');
      }
    } catch {
      setErrorMsg('Koneksi ke server bermasalah.');
    } finally {
      setSavingType(false);
    }
  };

  // Exercise Item Modal & Skeleton Recording
  const openCreateExerciseModal = (defaultTypeId?: number) => {
    // Stop runner camera to avoid conflict
    setCamActive(false);

    setEditingExerciseId(null);
    setItemFormNama('');
    setItemFormVariasi('Standar');
    setItemFormDeskripsi('');
    setItemFormTargetOtot('');
    setItemFormPosisi('berdiri');
    setItemFormOrientasi('frontal');
    setItemFormPeralatan('Tanpa Alat');
    setItemFormSudutLeher('168');
    setItemFormSudutPunggung('175');
    setItemFormToleransi('15');
    setItemFormAmbangAkurasi('75');
    setItemFormPetunjukKoreksi('');
    setItemFormDurasi('5');
    setItemFormReps('10');
    setItemFormTingkat('pemula');
    setItemFormIsBattle(true);
    setItemFormSkeleton(null);
    setAdminCamError(null);

    setItemFormPoseSteps([
      {
        step_id: `step-${Date.now()}`,
        urutan: 1,
        nama_step: 'Fase 1: Posisi Atas (Plank Awal)',
        instruksi: 'Tahan postur tubuh lurus & tegap',
        durasi_tahan_detik: 2,
        landmarks: null,
      },
    ]);
    setActiveStepIndex(0);
    if (stepPreviewIntervalRef.current) clearInterval(stepPreviewIntervalRef.current);
    setIsPlayingStepPreview(false);

    const availableTypeId = defaultTypeId || (types[0]?.type_id ?? 1);
    setItemFormTypeId(availableTypeId);

    setShowItemModal(true);
  };

  const openEditExerciseModal = (ex: ExerciseItem) => {
    // Stop runner camera to avoid conflict
    setCamActive(false);

    setEditingExerciseId(ex.exercise_id);
    setItemFormNama(ex.nama);
    setItemFormDeskripsi(ex.deskripsi || '');
    setItemFormTargetOtot(ex.target_otot || '');
    setItemFormDurasi(String(ex.durasi_detik || 5));
    setItemFormReps(String(ex.reps || 10));
    setItemFormTingkat(ex.tingkat || 'pemula');
    setItemFormIsBattle(Boolean(ex.is_battle));
    setItemFormSkeleton(ex.skeleton_data || null);
    setItemFormTypeId(ex.type_id || (types[0]?.type_id ?? 1));

    const st = ex.sudut_target || {};
    setItemFormVariasi(st.variasi_gerakan || 'Standar');
    setItemFormPosisi(st.posisi_tubuh || 'berdiri');
    setItemFormOrientasi(st.orientasi_kamera || 'frontal');
    setItemFormPeralatan(st.peralatan || 'Tanpa Alat');
    setItemFormSudutLeher(String(st.sudut_leher ?? ex.sudut_leher ?? 168));
    setItemFormSudutPunggung(String(st.sudut_punggung ?? ex.sudut_punggung ?? 175));
    setItemFormToleransi(String(st.toleransi_derajat ?? 15));
    setItemFormAmbangAkurasi(String(st.ambang_akurasi ?? 75));
    setItemFormPetunjukKoreksi(st.petunjuk_koreksi || '');

    const existingSteps = st.pose_steps || ex.pose_steps;
    if (existingSteps && Array.isArray(existingSteps) && existingSteps.length > 0) {
      setItemFormPoseSteps(existingSteps.map((s: PoseStep, i: number) => ({
        ...s,
        urutan: i + 1,
        durasi_tahan_detik: Number(s.durasi_tahan_detik) || 2,
      })));
    } else {
      setItemFormPoseSteps([
        {
          step_id: `step-${ex.exercise_id || 'initial'}-1`,
          urutan: 1,
          nama_step: 'Fase 1: Posisi Target Referensi',
          instruksi: st.petunjuk_koreksi || 'Pertahankan postur target',
          durasi_tahan_detik: Number(ex.durasi_detik) || 5,
          landmarks: ex.skeleton_data || null,
        },
      ]);
    }
    setActiveStepIndex(0);
    if (stepPreviewIntervalRef.current) clearInterval(stepPreviewIntervalRef.current);
    setIsPlayingStepPreview(false);

    setAdminCamError(null);
    setShowItemModal(true);
  };

  const applyPresetToItemForm = (preset: ExercisePreset) => {
    setItemFormNama(preset.nama);
    setItemFormVariasi(preset.variasi || 'Standar');
    setItemFormDeskripsi(preset.deskripsi || '');
    setItemFormTargetOtot(preset.target_otot || '');
    setItemFormPosisi(preset.posisi_tubuh || 'berdiri');
    setItemFormOrientasi(preset.orientasi_kamera || 'frontal');
    setItemFormPeralatan(preset.peralatan || 'Tanpa Alat');
    setItemFormSudutLeher(String(preset.sudut_leher ?? 168));
    setItemFormSudutPunggung(String(preset.sudut_punggung ?? 175));
    setItemFormToleransi(String(preset.toleransi_derajat ?? 15));
    setItemFormAmbangAkurasi(String(preset.ambang_akurasi ?? 75));
    setItemFormPetunjukKoreksi(preset.petunjuk_koreksi || '');
    setItemFormReps(String(preset.reps || 10));
    setItemFormTingkat(preset.tingkat || 'pemula');
    setItemFormDurasi(String(preset.durasi_detik || 5));
    setItemFormIsBattle(Boolean(preset.is_battle));

    const presetSteps = preset.pose_steps || preset.sudut_target?.pose_steps;
    if (presetSteps && Array.isArray(presetSteps) && presetSteps.length > 0) {
      setItemFormPoseSteps(presetSteps.map((s, i) => ({
        ...s,
        urutan: i + 1,
        durasi_tahan_detik: Number(s.durasi_tahan_detik) || 2,
      })));
      setItemFormSkeleton(presetSteps[0].landmarks || preset.skeleton_data || null);
    } else {
      setItemFormPoseSteps([
        {
          step_id: `${preset.preset_id}-step-1`,
          urutan: 1,
          nama_step: `Fase 1: ${preset.nama}`,
          instruksi: preset.petunjuk_koreksi || 'Pertahankan postur target',
          durasi_tahan_detik: Number(preset.durasi_detik) || 5,
          landmarks: preset.skeleton_data || null,
        },
      ]);
      if (preset.skeleton_data && preset.skeleton_data.length >= 25) {
        setItemFormSkeleton(preset.skeleton_data);
      }
    }
    setActiveStepIndex(0);
    if (stepPreviewIntervalRef.current) clearInterval(stepPreviewIntervalRef.current);
    setIsPlayingStepPreview(false);

    setShowPresetsModal(false);
    setShowItemModal(true);
  };

  // Step Management Actions for Trainer
  const handleAddPoseStep = () => {
    const nextUrutan = itemFormPoseSteps.length + 1;
    const newStep: PoseStep = {
      step_id: `step-${Date.now()}`,
      urutan: nextUrutan,
      nama_step: nextUrutan === 2
        ? 'Fase 2: Posisi Turun (Dada Rendah / Siku 90°)'
        : nextUrutan === 3
        ? 'Fase 3: Dorong Naik Kembali ke Atas (+1 Rep)'
        : `Fase ${nextUrutan}: Gerakan Lanjutan`,
      instruksi: 'Tahan pose target di depan kamera pelatih',
      durasi_tahan_detik: 2,
      landmarks: null,
    };
    setItemFormPoseSteps(prev => [...prev, newStep]);
    setActiveStepIndex(itemFormPoseSteps.length);
  };

  const handleRemovePoseStep = (idxToRemove: number) => {
    if (itemFormPoseSteps.length <= 1) {
      toast({
        title: 'Aksi Ditolak',
        description: 'Minimal harus ada 1 model skeleton gerakan.',
        variant: 'destructive',
      });
      return;
    }
    const updated = itemFormPoseSteps
      .filter((_, idx) => idx !== idxToRemove)
      .map((s, idx) => ({ ...s, urutan: idx + 1 }));
    setItemFormPoseSteps(updated);
    setActiveStepIndex(prev => Math.min(prev, updated.length - 1));
  };

  const updateActiveStep = (field: keyof PoseStep, value: unknown) => {
    setItemFormPoseSteps(prev => {
      const copy = [...prev];
      if (copy[activeStepIndex]) {
        copy[activeStepIndex] = { ...copy[activeStepIndex], [field]: value };
      }
      return copy;
    });
  };

  const togglePlayStepPreview = () => {
    if (isPlayingStepPreview) {
      if (stepPreviewIntervalRef.current) clearInterval(stepPreviewIntervalRef.current);
      setIsPlayingStepPreview(false);
      return;
    }
    if (itemFormPoseSteps.length <= 1) {
      toast({
        title: 'Perhatian',
        description: 'Tambahkan minimal 2 model skeleton untuk memutar simulasi urutan gerakan.',
        variant: 'warning',
      });
      return;
    }
    setIsPlayingStepPreview(true);
    let curIdx = 0;
    setActiveStepIndex(0);
    stepPreviewIntervalRef.current = setInterval(() => {
      curIdx = (curIdx + 1) % itemFormPoseSteps.length;
      setActiveStepIndex(curIdx);
    }, 1400);
  };

  useEffect(() => {
    return () => {
      if (stepPreviewIntervalRef.current) clearInterval(stepPreviewIntervalRef.current);
    };
  }, []);

  const handleQuickAddPreset = async (preset: ExercisePreset, targetTypeId?: number) => {
    const typeId = targetTypeId || itemFormTypeId || (types[0]?.type_id ?? 1);
    if (!typeId) {
      setErrorMsg('Pilih kategori latihan terlebih dahulu.');
      return;
    }
    try {
      const steps = preset.pose_steps || preset.sudut_target?.pose_steps;
      const payload = {
        nama: `${preset.nama} (${preset.variasi})`,
        deskripsi: preset.deskripsi,
        target_otot: preset.target_otot,
        durasi_detik: preset.durasi_detik,
        reps: preset.reps,
        tingkat: preset.tingkat,
        is_battle: preset.is_battle,
        sudut_leher: preset.sudut_leher,
        sudut_punggung: preset.sudut_punggung,
        skeleton_data: preset.skeleton_data || (steps && steps[0]?.landmarks) || null,
        sudut_target: {
          variasi_gerakan: preset.variasi,
          posisi_tubuh: preset.posisi_tubuh,
          orientasi_kamera: preset.orientasi_kamera,
          peralatan: preset.peralatan,
          sudut_leher: preset.sudut_leher,
          sudut_punggung: preset.sudut_punggung,
          toleransi_derajat: preset.toleransi_derajat,
          ambang_akurasi: preset.ambang_akurasi,
          petunjuk_koreksi: preset.petunjuk_koreksi,
          pose_steps: steps,
        },
      };
      const res = await fetch(`${apiUrl()}/api/admin/exercise-types/${typeId}/exercises`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const saved = await res.json();
        setSuccessMsg(`✓ Variasi "${preset.nama} (${preset.variasi})" berhasil ditambahkan!`);
        setTimeout(() => setSuccessMsg(null), 3500);
        await loadExercises(saved.exercise_id);
      }
    } catch {
      setErrorMsg('Gagal menambahkan variasi gerakan.');
    }
  };

  const handleBatchAddPresets = async (targetTypeId?: number) => {
    const typeId = targetTypeId || itemFormTypeId || (types[0]?.type_id ?? 1);
    if (!typeId) {
      setErrorMsg('Pilih kategori latihan terlebih dahulu.');
      return;
    }
    if (selectedPresetIds.length === 0) {
      toast({
        title: 'Perhatian',
        description: 'Pilih setidaknya satu variasi gerakan.',
        variant: 'warning',
      });
      return;
    }
    const toAdd = presets.filter(p => selectedPresetIds.includes(p.preset_id));
    setBatchAdding(true);
    try {
      const items = toAdd.map(p => {
        const steps = p.pose_steps || p.sudut_target?.pose_steps;
        return {
          nama: `${p.nama} (${p.variasi})`,
          deskripsi: p.deskripsi,
          target_otot: p.target_otot,
          durasi_detik: p.durasi_detik,
          reps: p.reps,
          tingkat: p.tingkat,
          is_battle: p.is_battle,
          sudut_leher: p.sudut_leher,
          sudut_punggung: p.sudut_punggung,
          skeleton_data: p.skeleton_data || (steps && steps[0]?.landmarks) || null,
          sudut_target: {
            variasi_gerakan: p.variasi,
            posisi_tubuh: p.posisi_tubuh,
            orientasi_kamera: p.orientasi_kamera,
            peralatan: p.peralatan,
            sudut_leher: p.sudut_leher,
            sudut_punggung: p.sudut_punggung,
            toleransi_derajat: p.toleransi_derajat,
            ambang_akurasi: p.ambang_akurasi,
            petunjuk_koreksi: p.petunjuk_koreksi,
            pose_steps: steps,
          },
        };
      });

      const res = await fetch(`${apiUrl()}/api/admin/exercise-types/${typeId}/batch-exercises`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ exercises: items }),
      });

      if (res.ok) {
        const result = await res.json();
        setSuccessMsg(`✓ Berhasil menambahkan ${result.added_count} variasi gerakan sekaligus!`);
        setTimeout(() => setSuccessMsg(null), 4000);
        setSelectedPresetIds([]);
        setShowPresetsModal(false);
        await loadExercises();
      } else {
        const d = await res.json().catch(() => ({}));
        setErrorMsg(d?.detail || 'Gagal menambahkan variasi gerakan batch.');
      }
    } catch {
      setErrorMsg('Koneksi ke server bermasalah saat batch add.');
    } finally {
      setBatchAdding(false);
    }
  };

  const closeItemModal = () => {
    stopAdminCam();
    if (stepPreviewIntervalRef.current) clearInterval(stepPreviewIntervalRef.current);
    setIsPlayingStepPreview(false);
    setShowItemModal(false);
    setEditingExerciseId(null);
  };

  const toggleAdminCamera = () => {
    if (adminCamActive) {
      stopAdminCam();
      return;
    }
    if (!window.isSecureContext) {
      setAdminCamError('Akses kamera membutuhkan HTTPS atau akses localhost.');
      return;
    }
    setAdminCamError(null);
    setAdminCamActive(true);
  };

  const stopAdminCam = () => {
    if (adminRecordTimerRef.current) clearInterval(adminRecordTimerRef.current);
    if (adminCaptureTimerRef.current) clearInterval(adminCaptureTimerRef.current);
    setIsRecordingTimer(false);
    setCountdownVal(0);
    setAdminCamActive(false);
  };

  // Instant capture of 33 landmarks into active step
  const captureInstantPose = () => {
    const lms = adminLandmarksRef.current;
    if (lms && lms.length >= 25) {
      const cloned = lms.map(p => ({ ...p }));
      setItemFormPoseSteps(prev => {
        const copy = [...prev];
        if (copy[activeStepIndex]) {
          copy[activeStepIndex] = { ...copy[activeStepIndex], landmarks: cloned };
        }
        return copy;
      });
      if (activeStepIndex === 0 || !itemFormSkeleton) {
        setItemFormSkeleton(cloned);
      }
      setSuccessMsg(`✓ Skeleton untuk Step ${activeStepIndex + 1} (${itemFormPoseSteps[activeStepIndex]?.nama_step || 'Fase'}) berhasil ditangkap!`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setAdminCamError('Pose tubuh belum terdeteksi. Posisikan seluruh tubuh di depan kamera.');
    }
  };

  // Timed capture with countdown for stability into active step
  const startTimedPoseCapture = (duration = 5) => {
    if (!adminCamActive) {
      setAdminCamActive(true);
    }
    setRecordingDurationSec(duration);
    setIsRecordingTimer(true);
    setCountdownVal(3); // 3-second ready countdown
    capturedBufferRef.current = [];

    // Phase 1: 3-second countdown
    let prep = 3;
    const prepTimer = setInterval(() => {
      prep -= 1;
      setCountdownVal(prep);
      if (prep <= 0) {
        clearInterval(prepTimer);
        // Phase 2: capture frames over duration
        runFrameCapture(duration);
      }
    }, 1000);
  };

  const runFrameCapture = (duration: number) => {
    let remain = duration;
    setCountdownVal(remain);

    // Frame capture every 200ms (5fps)
    adminCaptureTimerRef.current = setInterval(() => {
      const lms = adminLandmarksRef.current;
      if (lms && lms.length >= 25) {
        capturedBufferRef.current.push(lms.map(p => ({ ...p })));
      }
    }, 200);

    // Countdown second ticker
    adminRecordTimerRef.current = setInterval(() => {
      remain -= 1;
      setCountdownVal(remain);
      if (remain <= 0) {
        if (adminRecordTimerRef.current) clearInterval(adminRecordTimerRef.current);
        if (adminCaptureTimerRef.current) clearInterval(adminCaptureTimerRef.current);
        setIsRecordingTimer(false);
        setCountdownVal(0);

        // Compute average skeleton
        const frames = capturedBufferRef.current;
        let finalLms: Landmark[] | null = null;
        if (frames.length > 0) {
          finalLms = averageLandmarks(frames);
        } else if (adminLandmarksRef.current && adminLandmarksRef.current.length >= 25) {
          finalLms = adminLandmarksRef.current.map(p => ({ ...p }));
        }

        if (finalLms) {
          setItemFormPoseSteps(prev => {
            const copy = [...prev];
            if (copy[activeStepIndex]) {
              copy[activeStepIndex] = { ...copy[activeStepIndex], landmarks: finalLms };
            }
            return copy;
          });
          if (activeStepIndex === 0 || !itemFormSkeleton) {
            setItemFormSkeleton(finalLms);
          }
          setSuccessMsg(`✓ Pose skeleton stabil Step ${activeStepIndex + 1} (${frames.length} frame dirata-rata) berhasil disimpan!`);
          setTimeout(() => setSuccessMsg(null), 4000);
        } else {
          setAdminCamError('Tidak ada pose yang tertangkap selama perekaman. Coba lagi.');
        }
      }
    }, 1000);
  };

  const clearRecordedSkeleton = () => {
    setItemFormPoseSteps(prev => {
      const copy = [...prev];
      if (copy[activeStepIndex]) {
        copy[activeStepIndex] = { ...copy[activeStepIndex], landmarks: null };
      }
      return copy;
    });
    if (activeStepIndex === 0) {
      setItemFormSkeleton(null);
    }
  };

  // Save exercise item to backend
  const handleSaveExerciseItem = async () => {
    if (!itemFormNama.trim()) {
      setAdminCamError('Nama gerakan terapi wajib diisi.');
      return;
    }
    if (!itemFormTypeId) {
      setAdminCamError('Pilih kategori latihan terlebih dahulu.');
      return;
    }

    setSavingItem(true);
    setAdminCamError(null);

    const validSteps: PoseStep[] = itemFormPoseSteps.map((s, idx) => ({
      ...s,
      urutan: idx + 1,
      durasi_tahan_detik: Math.max(1, Number(s.durasi_tahan_detik) || 2),
      landmarks: s.landmarks || null,
    }));

    const totalDurasi = validSteps.length > 1
      ? validSteps.reduce((sum, s) => sum + (s.durasi_tahan_detik || 0), 0)
      : Math.max(1, Number(itemFormDurasi) || 5);

    const payload: Record<string, unknown> = {
      type_id: itemFormTypeId,
      nama: itemFormNama.trim(),
      deskripsi: itemFormDeskripsi.trim() || null,
      target_otot: itemFormTargetOtot.trim() || null,
      durasi_detik: totalDurasi,
      reps: Math.max(1, Number(itemFormReps) || 10),
      tingkat: itemFormTingkat,
      is_battle: itemFormIsBattle,
      sudut_leher: Number(itemFormSudutLeher) || 168,
      sudut_punggung: Number(itemFormSudutPunggung) || 175,
      sudut_target: {
        orientasi_kamera: itemFormOrientasi,
        posisi_tubuh: itemFormPosisi,
        variasi_gerakan: itemFormVariasi.trim() || undefined,
        peralatan: itemFormPeralatan.trim() || undefined,
        sudut_leher: Number(itemFormSudutLeher) || 168,
        sudut_punggung: Number(itemFormSudutPunggung) || 175,
        toleransi_derajat: Number(itemFormToleransi) || 15,
        ambang_akurasi: Number(itemFormAmbangAkurasi) || 75,
        petunjuk_koreksi: itemFormPetunjukKoreksi.trim() || undefined,
        pose_steps: validSteps,
      },
    };

    if (validSteps[0]?.landmarks && validSteps[0].landmarks.length >= 25) {
      payload.skeleton_data = validSteps[0].landmarks;
    } else if (itemFormSkeleton && itemFormSkeleton.length >= 25) {
      payload.skeleton_data = itemFormSkeleton;
    }

    const isEdit = editingExerciseId != null;
    const url = isEdit
      ? `${apiUrl()}/api/admin/exercises/${editingExerciseId}`
      : `${apiUrl()}/api/admin/exercise-types/${itemFormTypeId}/exercises`;

    try {
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const saved = await res.json();
        setSuccessMsg(`Gerakan "${saved.nama}" (${validSteps.length} model skeleton) berhasil disimpan.`);
        closeItemModal();
        await loadExercises(saved.exercise_id);
      } else {
        const d = await res.json().catch(() => ({}));
        setAdminCamError(d?.detail || 'Gagal menyimpan gerakan latihan.');
      }
    } catch {
      setAdminCamError('Koneksi ke server terputus.');
    } finally {
      setSavingItem(false);
    }
  };

  // Delete exercise
  const handleDeleteExercise = async (ex: ExerciseItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!window.confirm(`Hapus gerakan latihan "${ex.nama}"?`)) return;
    try {
      const res = await fetch(`${apiUrl()}/api/admin/exercises/${ex.exercise_id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (res.ok) {
        setSuccessMsg(`Gerakan "${ex.nama}" berhasil dihapus.`);
        await loadExercises();
      } else {
        setErrorMsg('Gagal menghapus gerakan.');
      }
    } catch {
      setErrorMsg('Koneksi ke server bermasalah.');
    }
  };

  // Filter exercises
  const filteredExercises = exercises.filter(ex => {
    if (selectedTypeFilter !== 'all') {
      const matchId = String(ex.type_id) === selectedTypeFilter;
      const matchName = ex.type?.toLowerCase() === selectedTypeFilter.toLowerCase();
      if (!matchId && !matchName) return false;
    }
    if (onlyBattleFilter && !ex.is_battle) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = ex.nama.toLowerCase().includes(q);
      const matchOtot = ex.target_otot?.toLowerCase().includes(q);
      const matchType = ex.type?.toLowerCase().includes(q);
      if (!matchName && !matchOtot && !matchType) return false;
    }
    return true;
  });

  const hasSkeleton = Boolean(
    activeExercise?.skeleton_data && activeExercise.skeleton_data.length >= 25
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-8">
      {/* Toast Notifications */}
      {successMsg && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            <X size={14} />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Pill variant="success" size="md">
              <HeartPulse size={14} />
              <PillContent>PROGRAM TERAPI & PEREGANGAN POSTUR</PillContent>
            </Pill>
            {isAdmin && (
              <Badge variant="info" className="flex items-center gap-1 font-semibold px-2 py-0.5">
                <ShieldCheck size={12} /> Mode Admin
              </Badge>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Latihan Terapi & Koreksi Postur
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Gerakan terapeutik bio-mekanika — cocokkan pose Anda secara langsung dengan skeleton referensi pelatih untuk latihan harian atau adu skor di room multiplayer.
          </p>
        </div>

        {/* Admin Quick Action Buttons */}
        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPresetsModal(true)}
              className="text-xs font-semibold text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/40"
            >
              <Sparkles size={14} className="text-purple-500" />
              <span>Bank Variasi Gerakan ({presets.length || 32})</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={openCreateCategoryModal}
              className="text-xs font-semibold"
            >
              <FolderPlus size={14} className="text-blue-500" />
              <span>+ Kategori Terapi</span>
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => openCreateExerciseModal()}
              className="text-xs font-semibold bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white shadow-sm"
            >
              <Camera size={14} />
              <span>+ Rekam Gerakan Pose</span>
            </Button>
          </div>
        )}
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
        {/* Category tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedTypeFilter('all')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer",
              selectedTypeFilter === 'all'
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            )}
          >
            Semua ({exercises.length})
          </button>
          {types.map(t => (
            <button
              key={t.type_id}
              onClick={() => setSelectedTypeFilter(String(t.type_id))}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer",
                selectedTypeFilter === String(t.type_id)
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              )}
            >
              {t.nama} ({t.children?.length || 0})
            </button>
          ))}
        </div>

        {/* Search & Battle toggle */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <div className="relative flex-1 sm:w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari gerakan / otot..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <Button
            type="button"
            variant={onlyBattleFilter ? "secondary" : "outline"}
            size="sm"
            onClick={() => setOnlyBattleFilter(!onlyBattleFilter)}
            className="text-xs whitespace-nowrap"
            title="Tampilkan hanya gerakan yang bisa dipakai battle di Multiplayer"
          >
            <Swords size={13} className="text-amber-500" />
            <span>Battle</span>
          </Button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Menu Gerakan */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={14} className="text-blue-500" />
              <span>Daftar Gerakan Terapi</span>
            </h3>
            <span className="text-[11px] text-slate-400">
              {filteredExercises.length} gerakan
            </span>
          </div>

          {/* Empty State */}
          {loading ? (
            <Card className="p-8 text-center text-xs text-slate-400">
              <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-2" />
              Memuat data gerakan terapi...
            </Card>
          ) : filteredExercises.length === 0 ? (
            <Card className="p-6 text-center border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-3 text-blue-600 dark:text-blue-400">
                <HeartPulse size={24} />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                Belum Ada Gerakan Terapi
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-sm mx-auto leading-relaxed">
                {isAdmin
                  ? 'Anda dapat menambahkan kategori terapi baru, merekam gerakan langsung dari pose kamera menggunakan skeleton, atau memuat paket latihan standar.'
                  : 'Belum ada gerakan latihan yang tersedia. Silakan hubungi pelatih atau administrator Anda.'}
              </p>

              {isAdmin && (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => openCreateExerciseModal()}
                    className="w-full sm:w-auto text-xs font-semibold"
                  >
                    <Camera size={14} /> + Rekam Gerakan Pose
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSeedDefaults}
                    className="w-full sm:w-auto text-xs"
                  >
                    <RefreshCw size={13} /> Muat Latihan Standar
                  </Button>
                </div>
              )}
            </Card>
          ) : (
            <div className="space-y-2.5 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
              {filteredExercises.map(ex => {
                const isSelected = activeExercise?.exercise_id === ex.exercise_id;
                const hasSkel = ex.skeleton_data && ex.skeleton_data.length >= 25;

                return (
                  <Card
                    key={ex.exercise_id}
                    hoverEffect
                    onClick={() => handleSelectExercise(ex)}
                    className={cn(
                      "p-4 cursor-pointer relative group transition-all",
                      isSelected
                        ? "border-emerald-500/80 bg-emerald-500/10 shadow-sm"
                        : "hover:border-slate-300 dark:hover:border-slate-700"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <span className={cn(
                            "text-sm font-bold truncate",
                            isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
                          )}>
                            {ex.nama}
                          </span>
                          {ex.sudut_target?.variasi_gerakan && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded border border-purple-200 dark:border-purple-800/60">
                              {ex.sudut_target.variasi_gerakan}
                            </span>
                          )}
                        </div>
                        {ex.target_otot && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                            Target: {ex.target_otot}
                          </span>
                        )}
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-1 flex-wrap justify-end shrink-0">
                        {ex.type && (
                          <Badge variant="info" className="text-[9px] h-4 px-1.5 font-medium">
                            {ex.type}
                          </Badge>
                        )}
                        {ex.sudut_target?.posisi_tubuh && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded capitalize">
                            {ex.sudut_target.posisi_tubuh}
                          </span>
                        )}
                        {ex.is_battle && (
                          <Badge variant="warning" className="text-[9px] h-4 px-1.5 font-bold flex items-center gap-0.5">
                            <Swords size={9} /> Battle
                          </Badge>
                        )}
                        {hasSkel && (
                          <Badge variant="success" className="text-[9px] h-4 px-1 font-medium">
                            ✓ Skeleton
                          </Badge>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                      {ex.deskripsi || 'Latihan peregangan postur terarah.'}
                    </p>

                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{ex.reps} repetisi · {ex.durasi_detik ?? 5}s tahan</span>
                      <span className="capitalize">{ex.tingkat}</span>
                    </div>

                    {/* Admin Action Buttons on Hover */}
                    {isAdmin && (
                      <div className="absolute top-2 right-2 hidden group-hover:flex items-center gap-1 bg-white/95 dark:bg-slate-900/95 p-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs z-10">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openEditExerciseModal(ex); }}
                          className="p-1 text-slate-500 hover:text-blue-500 rounded cursor-pointer"
                          title="Ubah gerakan & rekam pose"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteExercise(ex, e)}
                          className="p-1 text-slate-500 hover:text-rose-500 rounded cursor-pointer"
                          title="Hapus gerakan"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Active Exercise Runner */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {activeExercise ? (
            <Card className="p-6 relative overflow-hidden shadow-sm">
              {/* Exercise Details Header */}
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 mb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      {activeExercise.nama}
                    </h2>
                    {activeExercise.type && (
                      <Badge variant="info" className="text-[10px]">{activeExercise.type}</Badge>
                    )}
                    {activeExercise.is_battle && (
                      <Badge variant="warning" className="text-[10px] flex items-center gap-1">
                        <Swords size={11} /> Siap Battle Multiplayer
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    Fokus Otot: {activeExercise.target_otot || 'Postur & Tulang Belakang'}
                  </p>
                  {activeExercise.deskripsi && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {activeExercise.deskripsi}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={activeExercise.tingkat === 'pemula' ? 'success' : 'info'} className="capitalize">
                    {activeExercise.tingkat}
                  </Badge>
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditExerciseModal(activeExercise)}
                      className="text-xs h-7 px-2"
                      title="Ubah & rekam ulang skeleton"
                    >
                      <Pencil size={12} /> Edit Pose
                    </Button>
                  )}
                </div>
              </div>

              {/* Multiplayer Battle Announcement Banner */}
              {activeExercise.is_battle && (
                <div className="mb-4 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-purple-700 dark:text-purple-300">
                    <Swords size={16} className="text-purple-500 shrink-0" />
                    <span>Gerakan ini aktif di mode <strong>Multiplayer Battle</strong>. Cocokkan pose dengan lawan untuk adu skor!</span>
                  </div>
                  {setActiveTab && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab('multiplayer')}
                      className="text-[11px] h-7 whitespace-nowrap bg-purple-600/10 border-purple-500/30 text-purple-600 dark:text-purple-300 hover:bg-purple-600 hover:text-white"
                    >
                      <Users size={12} /> Buka Room Battle
                    </Button>
                  )}
                </div>
              )}

              {/* Camera & Pose Matching Controls */}
              {(() => {
                const runnerSteps: PoseStep[] = ((activeExercise.sudut_target as any)?.pose_steps || activeExercise.pose_steps || []) as PoseStep[];
                const isMultiStep = runnerSteps.length > 1;
                const currentRunnerStep = isMultiStep ? runnerSteps[activeRunnerStepIndex] : null;
                const targetLandmarks = currentRunnerStep?.landmarks || activeExercise.skeleton_data || null;
                const hasTargetSkeleton = Boolean(targetLandmarks && targetLandmarks.length >= 25);

                return (
                  <>
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <Button
                        variant={camActive ? "success" : "outline"}
                        size="sm"
                        onClick={toggleRunnerCamera}
                        className="text-xs font-semibold"
                      >
                        {camActive ? <CameraOff size={14} /> : <Camera size={14} />}
                        <span>{camActive ? 'Kamera Aktif (ON)' : 'Nyalakan Kamera'}</span>
                      </Button>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {hasTargetSkeleton
                          ? isMultiStep
                            ? `Fase ${activeRunnerStepIndex + 1}/${runnerSteps.length}: Ikuti skeleton ungu untuk ${currentRunnerStep?.nama_step || 'gerakan'}.`
                            : 'Skeleton ungu adalah panduan referensi pelatih. Cocokkan pose Anda!'
                          : 'Gerakan ini belum memiliki skeleton referensi tersimpan.'}
                      </span>
                      {camError && (
                        <span className="w-full text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1">
                          <AlertTriangle size={12} /> {camError}
                        </span>
                      )}
                    </div>

                    {/* Multi-Step Stepper Cycle Guide */}
                    {isMultiStep && (
                      <div className="mb-4 p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <Sparkles size={14} className="text-purple-600 dark:text-purple-400 shrink-0" />
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              Siklus Gerakan Multi-Step ({runnerSteps.length} Model Skeleton)
                            </span>
                          </div>
                          <Badge variant="info" className="text-[10px] font-bold bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30">
                            Fase {activeRunnerStepIndex + 1} dari {runnerSteps.length}
                          </Badge>
                        </div>

                        {/* Stepper pills */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {runnerSteps.map((s, idx) => {
                            const isStepActive = idx === activeRunnerStepIndex;
                            const isStepDone = idx < activeRunnerStepIndex;
                            return (
                              <div
                                key={s.step_id || idx}
                                className={cn(
                                  "p-2.5 rounded-lg border transition-all text-xs flex flex-col justify-between",
                                  isStepActive
                                    ? "bg-purple-600 text-white font-bold shadow-md ring-2 ring-purple-400 scale-[1.02]"
                                    : isStepDone
                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-medium"
                                    : "bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400"
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] uppercase tracking-wider">
                                    {isStepDone ? `✓ Step ${idx + 1}` : `Langkah ${idx + 1}`}
                                  </span>
                                  <span className={cn("text-[10px] font-mono px-1 py-0.2 rounded", isStepActive ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800")}>
                                    {s.durasi_tahan_detik}s
                                  </span>
                                </div>
                                <div className="text-[11px] font-semibold mt-1 truncate">
                                  {s.nama_step}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Current step active guide */}
                        {currentRunnerStep && (
                          <div className="mt-2.5 pt-2 border-t border-purple-200 dark:border-purple-800/80 flex items-center justify-between text-[11px] text-purple-800 dark:text-purple-300">
                            <span className="flex items-center gap-1.5 font-medium">
                              <Info size={13} className="shrink-0" />
                              <span>{currentRunnerStep.instruksi || 'Pertahankan postur target sesuai skeleton.'}</span>
                            </span>
                            <span className="text-[10px] opacity-80 font-mono">
                              {activeRunnerStepIndex === runnerSteps.length - 1 ? '✦ Langkah Terakhir: Repetisi +1' : '✦ Lanjut langkah berikutnya'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Step success feedback flash */}
                    {stepSuccessFlash && (
                      <div className="mb-3 p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-bounce">
                        <CheckCircle2 size={15} className="shrink-0 text-emerald-500" />
                        <span>{stepSuccessFlash}</span>
                      </div>
                    )}

                    {/* Skeleton Viewport */}
                    <div className="relative w-full h-80 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden mb-4 shadow-inner">
                      {/* Live Video Feed */}
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover ${camActive ? 'block' : 'hidden'}`}
                      />

                      {/* Camera Inactive Guide */}
                      {!camActive && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-slate-400 z-10">
                          <Camera size={36} className="text-slate-600 mb-2" />
                          <p className="text-sm font-semibold text-slate-300">Kamera Belum Aktif</p>
                          <p className="text-xs text-slate-500 max-w-xs mt-1">
                            Klik "Nyalakan Kamera" untuk melihat deteksi skeleton Anda dan mencocokkan dengan pose referensi pelatih.
                          </p>
                        </div>
                      )}

                      {/* Ghost Skeleton: Target reference recorded by admin/trainer */}
                      {hasTargetSkeleton && (
                        <SkeletonOverlay
                          landmarks={targetLandmarks}
                          width={640}
                          height={440}
                          status="bagus"
                          orientasi={(activeExercise.sudut_target?.orientasi_kamera as any) || 'frontal'}
                          showAngles={false}
                          color="#8b5cf6"
                          className="opacity-40"
                        />
                      )}

                      {/* Player's Live Skeleton */}
                      <SkeletonOverlay
                        landmarks={playerLandmarks}
                        width={640}
                        height={440}
                        status={lastScore && lastScore >= 80 ? 'bagus' : lastScore && lastScore >= 60 ? 'ringan' : 'buruk'}
                        orientasi={(activeExercise.sudut_target?.orientasi_kamera as any) || 'frontal'}
                        showAngles={false}
                      />

                      {/* Real-time Matching Score HUD */}
                      {lastScore != null && (
                        <div
                          className="absolute top-3 right-3 px-3 py-1.5 rounded-xl text-xs font-bold font-mono backdrop-blur-md z-20 flex items-center gap-1.5 shadow-lg"
                          style={{
                            backgroundColor: lastScore >= 80 ? 'rgba(16, 185, 129, 0.25)' : lastScore >= 60 ? 'rgba(245, 158, 11, 0.25)' : 'rgba(239, 68, 68, 0.25)',
                            border: `1px solid ${lastScore >= 80 ? '#10b981' : lastScore >= 60 ? '#f59e0b' : '#ef4444'}`,
                            color: '#fff',
                          }}
                        >
                          <Target size={13} className="text-white" />
                          <span>Kecocokan: {lastScore}%</span>
                        </div>
                      )}

                      {/* Ghost Legend */}
                      {hasTargetSkeleton && (
                        <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-700 text-[10px] text-slate-300 backdrop-blur-xs flex items-center gap-2 z-20">
                          <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" />
                          <span>
                            {isMultiStep
                              ? `Skeleton Fase ${activeRunnerStepIndex + 1}: ${currentRunnerStep?.nama_step || 'Pose'}`
                              : 'Skeleton Referensi Pelatih'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Feedback status message */}
                    {scoreMessage && (
                      <div className="mb-4 text-xs text-center font-medium text-slate-600 dark:text-slate-300">
                        {scoreMessage}
                      </div>
                    )}

                    {/* Score History Pills */}
                    {poseScores.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 mb-4">
                        <span className="text-[11px] text-slate-400 font-medium mr-1">Skor Repetisi:</span>
                        {poseScores.slice(-8).map((s, i) => (
                          <span
                            key={i}
                            className={cn(
                              "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded",
                              s >= 80
                                ? "bg-emerald-500/20 text-emerald-400"
                                : s >= 60
                                ? "bg-amber-500/20 text-amber-400"
                                : "bg-rose-500/20 text-rose-400"
                            )}
                          >
                            #{i + 1}: {s}%
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Metrics: Reps & Hold Time */}
                    <div className="grid grid-cols-2 gap-4 text-center my-4">
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                          Repetisi Latihan
                        </div>
                        <div className="text-3xl sm:text-4xl font-extrabold font-mono text-blue-600 dark:text-blue-400">
                          {currentRep}{' '}
                          <span className="text-lg text-slate-500 font-normal">
                            / {activeExercise.reps || 10}
                          </span>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-center gap-1">
                          <span>{isMultiStep ? `Tahan Fase ${activeRunnerStepIndex + 1}` : 'Tahan Posisi'}</span>
                        </div>
                        <div className="text-3xl sm:text-4xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                          {holdTimer}s
                        </div>
                        {isMultiStep && currentRunnerStep && (
                          <span className="text-[10px] text-slate-400 truncate block mt-0.5">
                            {currentRunnerStep.nama_step}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <Progress
                      value={(currentRep / (activeExercise.reps || 10)) * 100}
                      variant="gradient"
                      className="h-2.5 mb-6"
                    />
                  </>
                );
              })()}

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant={isRunning ? "secondary" : "success"}
                  size="lg"
                  onClick={toggleRun}
                  className={cn(
                    "flex-1 font-bold text-xs tracking-wider",
                    isRunning && "bg-amber-600 hover:bg-amber-700 text-white"
                  )}
                >
                  {isRunning ? <Pause size={16} /> : <Play size={16} className="fill-current" />}
                  <span>{isRunning ? 'Jeda Latihan' : sessionCompleted ? 'Ulangi Sesi' : 'Mulai Latihan'}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={resetRoutine}
                  className="px-4"
                  title="Reset repetisi"
                >
                  <RotateCcw size={15} />
                </Button>
              </div>

              {/* Completed Award Banner */}
              {sessionCompleted && (
                <div className="mt-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <Award size={28} className="text-emerald-500 shrink-0" />
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-sm">
                        Sesi Latihan Selesai!
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {activeExercise.reps} repetisi tuntas · Skor rata-rata kecocokan:{' '}
                        {poseScores.length > 0
                          ? Math.round(poseScores.reduce((a, b) => a + b, 0) / poseScores.length)
                          : 94}%
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ) : (
            <Card className="p-12 text-center border-dashed border-slate-300 dark:border-slate-800">
              <HeartPulse size={36} className="mx-auto text-slate-400 mb-3" />
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Pilih Gerakan Terapi</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                Pilih gerakan dari daftar sebelah kiri untuk memulai sesi latihan terapi postur.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* MODAL: TAMBAH KATEGORI TERAPI (ExerciseType)                     */}
      {/* ----------------------------------------------------------------- */}
      {showTypeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn"
          onClick={() => setShowTypeModal(false)}
        >
          <Card
            className="w-full max-w-md p-6 bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FolderPlus size={18} className="text-blue-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Tambah Kategori Terapi
                </h3>
              </div>
              <button
                onClick={() => setShowTypeModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <Label className="mb-1.5 block">Nama Kategori / Program *</Label>
                <Input
                  type="text"
                  placeholder="Contoh: Koreksi Skoliosis & Toraks"
                  value={typeFormName}
                  onChange={e => setTypeFormName(e.target.value)}
                />
              </div>

              <div>
                <Label className="mb-1.5 block">Deskripsi Singkat</Label>
                <Textarea
                  placeholder="Penjelasan tujuan program terapi ini..."
                  value={typeFormDesc}
                  onChange={e => setTypeFormDesc(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSaveCategory}
                  disabled={savingType}
                  className="flex-1"
                >
                  <Save size={14} />
                  <span>{savingType ? 'Menyimpan...' : 'Simpan Kategori'}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTypeModal(false)}
                >
                  Batal
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* MODAL: TAMBAH / UBAH GERAKAN LATIHAN & REKAM POSE SKELETON        */}
      {/* ----------------------------------------------------------------- */}
      {showItemModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto animate-fadeIn"
          onClick={closeItemModal}
        >
          <Card
            className="w-full max-w-2xl my-8 p-6 bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 mb-5 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Camera size={18} className="text-emerald-500" />
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingExerciseId ? 'Ubah Gerakan & Skeleton Latihan' : 'Tambah Gerakan Terapi (Rekam Skeleton)'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Lakukan pose di depan kamera untuk menyimpan skeleton referensi yang akan dicocokkan oleh anggota lain.
                  </p>
                </div>
              </div>
              <button
                onClick={closeItemModal}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            {adminCamError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{adminCamError}</span>
              </div>
            )}

            {/* QUICK VARIATION SELECTOR BANNER */}
            <div className="mb-4 p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-purple-600 dark:text-purple-400 shrink-0" />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white text-xs">Pilih Cepat dari Bank Variasi Gerakan ({presets.length || 32} Pilihan)</span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Pilih templat gerakan untuk otomatis mengisi sudut, variasi biomekanika, dan skeleton referensi.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  className="text-xs bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 dark:text-slate-200 max-w-xs truncate"
                  defaultValue=""
                  onChange={e => {
                    const found = presets.find(p => p.preset_id === e.target.value);
                    if (found) applyPresetToItemForm(found);
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
                  className="text-xs shrink-0 bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200 font-semibold"
                >
                  Katalog Bank
                </Button>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              {/* SECTION: MULTI-STEP SKELETON POSE RECORDER FOR TRAINER */}
              <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/40 dark:bg-purple-950/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                    <Target size={15} className="text-purple-600 dark:text-purple-400" />
                    <span>Model Skeleton Gerakan Pose Pelatih (Bisa Tambah / Kurangi Step)</span>
                  </div>

                  {/* Battle Multiplayer Checkbox */}
                  <label className="flex items-center gap-1.5 cursor-pointer bg-purple-500/10 dark:bg-purple-500/20 px-2.5 py-1 rounded-lg border border-purple-500/30">
                    <input
                      type="checkbox"
                      checked={itemFormIsBattle}
                      onChange={e => setItemFormIsBattle(e.target.checked)}
                      className="accent-purple-600"
                    />
                    <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1">
                      <Swords size={11} /> Bisa Battle Multiplayer
                    </span>
                  </label>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                  Contoh pada latihan push up: <strong>Step 1 (Posisi Atas/Plank)</strong> → <strong>Step 2 (Turun Dada Rendah)</strong> → <strong>Step 3 (Dorong Naik Kembali)</strong> baru repetisi dihitung <strong>+1</strong>. Anda dapat menambah atau mengurangi model skeleton di bawah ini dan merekam masing-masing pose dari kamera.
                </p>

                {/* STEP SELECTOR TABS & ADD STEP BUTTON */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Daftar Urutan Step Pose ({itemFormPoseSteps.length} Model Skeleton)
                    </span>
                    <div className="flex items-center gap-1.5">
                      {itemFormPoseSteps.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={togglePlayStepPreview}
                          className="text-[10px] h-6 px-2 text-purple-600 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50"
                          title="Putar simulasi pergantian urutan pose skeleton"
                        >
                          <Play size={11} className={cn("mr-1", isPlayingStepPreview && "animate-spin text-purple-500")} />
                          {isPlayingStepPreview ? 'Stop Simulasi' : 'Putar Urutan Step'}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={handleAddPoseStep}
                        className="text-[10px] h-6 px-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                        title="Tambahkan langkah/fase pose skeleton baru"
                      >
                        <Plus size={12} className="mr-0.5" /> Tambah Step Skeleton
                      </Button>
                    </div>
                  </div>

                  {/* Step Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {itemFormPoseSteps.map((step, idx) => {
                      const isSelected = idx === activeStepIndex;
                      const hasLms = Boolean(step.landmarks && step.landmarks.length >= 25);
                      return (
                        <button
                          key={step.step_id || idx}
                          type="button"
                          onClick={() => {
                            if (isPlayingStepPreview) {
                              if (stepPreviewIntervalRef.current) clearInterval(stepPreviewIntervalRef.current);
                              setIsPlayingStepPreview(false);
                            }
                            setActiveStepIndex(idx);
                          }}
                          className={cn(
                            "px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border flex items-center gap-1.5 cursor-pointer",
                            isSelected
                              ? "bg-purple-600 text-white border-purple-600 shadow-xs ring-2 ring-purple-300 dark:ring-purple-700"
                              : hasLms
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                          )}
                        >
                          <span className={cn(
                            "w-4 h-4 rounded-full flex items-center justify-center text-[10px]",
                            isSelected ? "bg-white text-purple-700 font-bold" : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          )}>
                            {idx + 1}
                          </span>
                          <span className="truncate max-w-[130px]">{step.nama_step}</span>
                          <span className={cn("text-[10px] font-mono", isSelected ? "opacity-90" : "opacity-60")}>
                            {step.durasi_tahan_detik}s
                          </span>
                          {hasLms && <CheckCircle2 size={12} className={isSelected ? "text-white" : "text-emerald-500"} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ACTIVE STEP EDITING FIELDS */}
                {itemFormPoseSteps[activeStepIndex] && (
                  <div className="p-3 mb-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                        <Pencil size={12} className="text-purple-500" />
                        Pengaturan Step {activeStepIndex + 1} dari {itemFormPoseSteps.length}
                      </span>
                      {itemFormPoseSteps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePoseStep(activeStepIndex)}
                          className="text-[11px] text-rose-500 hover:text-rose-600 flex items-center gap-1 font-semibold cursor-pointer"
                          title="Hapus step ini dari urutan gerakan"
                        >
                          <Trash2 size={12} /> Hapus Step Ini
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-6">
                        <Label className="text-[10px] mb-0.5 block">Nama Step / Fase Gerakan *</Label>
                        <Input
                          type="text"
                          value={itemFormPoseSteps[activeStepIndex].nama_step}
                          onChange={e => updateActiveStep('nama_step', e.target.value)}
                          placeholder="Misal: Fase 1: Posisi Atas (Plank)"
                          className="text-xs h-7"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <Label className="text-[10px] mb-0.5 block">Tahan (detik) *</Label>
                        <Input
                          type="number"
                          min={1}
                          max={60}
                          value={itemFormPoseSteps[activeStepIndex].durasi_tahan_detik}
                          onChange={e => updateActiveStep('durasi_tahan_detik', Math.max(1, Number(e.target.value) || 1))}
                          className="text-xs h-7 font-mono"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <Label className="text-[10px] mb-0.5 block">Status Skeleton</Label>
                        <div className="h-7 px-2 rounded-md bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center gap-1 text-[10px] font-semibold text-slate-700 dark:text-slate-300 truncate">
                          {itemFormPoseSteps[activeStepIndex].landmarks && itemFormPoseSteps[activeStepIndex].landmarks!.length >= 25 ? (
                            <>
                              <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
                              <span className="text-emerald-600 dark:text-emerald-400">Tersimpan</span>
                            </>
                          ) : (
                            <span className="text-amber-500">Belum Direkam</span>
                          )}
                        </div>
                      </div>
                      <div className="sm:col-span-12">
                        <Label className="text-[10px] mb-0.5 block">Instruksi Posisi Tubuh Pelatih untuk Step Ini</Label>
                        <Input
                          type="text"
                          value={itemFormPoseSteps[activeStepIndex].instruksi || ''}
                          onChange={e => updateActiveStep('instruksi', e.target.value)}
                          placeholder="Misal: Tahan tubuh lurus horizontal, kedua tangan lurus di bawah bahu"
                          className="text-xs h-7"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Camera & Body Posture Quick Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
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
                          onClick={() => setItemFormOrientasi(ori.id)}
                          className={cn(
                            'flex-1 text-[10px] py-1 px-1 rounded text-center transition-colors font-medium',
                            itemFormOrientasi === ori.id
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                          )}
                        >
                          {ori.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
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
                          onClick={() => setItemFormPosisi(pos.id)}
                          className={cn(
                            'flex-1 text-[10px] py-1 px-1 rounded text-center transition-colors font-medium',
                            itemFormPosisi === pos.id
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

                {/* Video / Skeleton Viewport in Modal */}
                {(() => {
                  const activeStep = itemFormPoseSteps[activeStepIndex];
                  const activeLandmarks = activeStep?.landmarks || null;
                  const hasActiveSkeleton = Boolean(activeLandmarks && activeLandmarks.length >= 25);

                  return (
                    <div className="relative w-full h-64 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden mb-3 flex items-center justify-center">
                      <video
                        ref={adminVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover ${adminCamActive ? 'block' : 'hidden'}`}
                      />

                      {/* Live or Captured Skeleton Overlay for Active Step */}
                      <SkeletonOverlay
                        landmarks={activeLandmarks || adminLandmarks || generateFallbackSkeleton()}
                        width={560}
                        height={360}
                        orientasi={itemFormOrientasi as any}
                        showAngles={true}
                        color={hasActiveSkeleton ? '#10b981' : '#8b5cf6'}
                        className="absolute inset-0"
                      />

                      {!adminCamActive && !hasActiveSkeleton && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 text-slate-400">
                          <Camera size={28} className="text-slate-600 mb-1" />
                          <p className="text-xs font-semibold text-slate-300">Nyalakan Kamera untuk Merekam Step {activeStepIndex + 1}</p>
                          <p className="text-[11px] text-slate-500 max-w-xs mt-0.5">
                            Lakukan pose "{activeStep?.nama_step || 'Target'}" di depan kamera, lalu tangkap atau rekam.
                          </p>
                        </div>
                      )}

                      {/* Active Step Recording Header HUD */}
                      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-xs text-white text-[11px] font-semibold flex items-center gap-1.5 z-20 border border-white/10">
                        <span className="w-2 h-2 rounded-full bg-purple-400" />
                        <span>Merekam: <strong>Step {activeStepIndex + 1}</strong> ({activeStep?.nama_step})</span>
                      </div>

                      {/* Simulation Playing Badge */}
                      {isPlayingStepPreview && (
                        <div className="absolute top-11 left-3 px-2.5 py-1 rounded-lg bg-blue-600/90 backdrop-blur-xs text-white text-[10px] font-bold flex items-center gap-1.5 z-20 animate-pulse">
                          <Play size={10} className="fill-current" />
                          <span>Simulasi Berjalan (Fase {activeStepIndex + 1}/{itemFormPoseSteps.length})</span>
                        </div>
                      )}

                      {/* Recording countdown badge */}
                      {isRecordingTimer && (
                        <div className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-rose-600/90 text-white font-mono text-xs font-bold flex items-center gap-2 shadow-lg animate-pulse z-20">
                          <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                          <span>{countdownVal > 0 ? `Merekam... ${countdownVal}s` : 'Selesai!'}</span>
                        </div>
                      )}

                      {/* Captured indicator badge */}
                      {hasActiveSkeleton && !isRecordingTimer && (
                        <div className="absolute top-3 right-3 px-3 py-1 rounded-xl bg-emerald-600/90 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg z-20">
                          <CheckCircle2 size={13} />
                          <span>Skeleton Step {activeStepIndex + 1} Tersimpan ({activeLandmarks!.length} Titik)</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Recorder Control Buttons & Duration Presets */}
                <div className="flex flex-wrap items-center gap-2">
                  {!adminCamActive ? (
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={toggleAdminCamera}
                      className="flex-1 text-xs font-semibold"
                    >
                      <Camera size={14} /> Nyalakan Kamera Pelatih
                    </Button>
                  ) : (
                    <>
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-300 dark:border-slate-700">
                        <span className="text-[10px] font-bold text-slate-500 px-1.5">Durasi:</span>
                        {[3, 5, 10, 15].map(d => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setRecordingDurationSec(d)}
                            className={cn(
                              'px-2 py-0.5 rounded text-[10px] font-bold transition-colors',
                              recordingDurationSec === d
                                ? 'bg-purple-600 text-white'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                            )}
                          >
                            {d}s
                          </button>
                        ))}
                      </div>

                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => startTimedPoseCapture(recordingDurationSec)}
                        disabled={isRecordingTimer}
                        className="flex-1 text-xs font-semibold"
                        title={`Rekam pose multi-frame untuk Step ${activeStepIndex + 1} selama ${recordingDurationSec} detik`}
                      >
                        <Timer size={14} /> Rekam Step {activeStepIndex + 1} ({recordingDurationSec}s)
                      </Button>

                      <Button
                        type="button"
                        variant="success"
                        size="sm"
                        onClick={captureInstantPose}
                        disabled={isRecordingTimer || !adminLandmarks || adminLandmarks.length < 25}
                        className="flex-1 text-xs font-semibold"
                        title={`Ambil pose kamera saat ini sebagai skeleton Step ${activeStepIndex + 1}`}
                      >
                        <Target size={14} /> Tangkap Step {activeStepIndex + 1}
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={stopAdminCam}
                        className="text-xs"
                        title="Matikan kamera"
                      >
                        <CameraOff size={14} />
                      </Button>
                    </>
                  )}

                  {itemFormPoseSteps[activeStepIndex]?.landmarks && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearRecordedSkeleton}
                      className="text-xs text-rose-500 hover:text-rose-600"
                    >
                      <Trash2 size={14} /> Hapus Pose Step {activeStepIndex + 1}
                    </Button>
                  )}
                </div>

                {itemFormPoseSteps[activeStepIndex]?.landmarks && !isRecordingTimer && (
                  <div className="mt-2.5 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                      Skeleton Step {activeStepIndex + 1} aktif ({itemFormPoseSteps[activeStepIndex].landmarks!.length} titik). Target: {itemFormPoseSteps[activeStepIndex].nama_step}.
                    </span>
                    <span className="text-[10px] font-bold bg-emerald-500/20 px-2 py-0.5 rounded">Tahan: {itemFormPoseSteps[activeStepIndex].durasi_tahan_detik}s</span>
                  </div>
                )}
              </div>

              {/* EXTENDED FORM FIELDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <Label className="mb-1 block font-semibold">Kategori Terapi *</Label>
                  <Select
                    value={String(itemFormTypeId)}
                    onChange={e => setItemFormTypeId(Number(e.target.value))}
                  >
                    {types.map(t => (
                      <option key={t.type_id} value={t.type_id}>
                        {t.nama}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label className="mb-1 block font-semibold">Nama Gerakan Terapi *</Label>
                  <Input
                    type="text"
                    placeholder="Contoh: Chin Tuck Alignment"
                    value={itemFormNama}
                    onChange={e => setItemFormNama(e.target.value)}
                  />
                </div>

                <div>
                  <Label className="mb-1 block font-semibold">Variasi / Modifikasi Gerakan</Label>
                  <Input
                    type="text"
                    placeholder="Contoh: Duduk di Kursi Kantor"
                    value={itemFormVariasi}
                    onChange={e => setItemFormVariasi(e.target.value)}
                  />
                </div>

                <div>
                  <Label className="mb-1 block font-semibold">Peralatan yang Digunakan</Label>
                  <Select value={itemFormPeralatan} onChange={e => setItemFormPeralatan(e.target.value)}>
                    <option value="Tanpa Alat">Tanpa Alat (Bodyweight)</option>
                    <option value="Kursi Kerja">Kursi Kerja</option>
                    <option value="Dinding">Dinding Rata</option>
                    <option value="Matras">Matras Olahraga</option>
                    <option value="Meja Kerja">Meja Kerja</option>
                    <option value="Handuk/Strap">Handuk / Strap</option>
                  </Select>
                </div>

                <div>
                  <Label className="mb-1 block font-semibold">Target Otot Utama</Label>
                  <Input
                    type="text"
                    placeholder="Contoh: Deep cervical flexors, Rhomboid"
                    value={itemFormTargetOtot}
                    onChange={e => setItemFormTargetOtot(e.target.value)}
                  />
                </div>

                <div>
                  <Label className="mb-1 block font-semibold">Target Sudut Leher (°)</Label>
                  <Input
                    type="number"
                    min={90}
                    max={180}
                    value={itemFormSudutLeher}
                    onChange={e => setItemFormSudutLeher(e.target.value)}
                    placeholder="168"
                  />
                </div>

                <div>
                  <Label className="mb-1 block font-semibold">Target Sudut Punggung (°)</Label>
                  <Input
                    type="number"
                    min={90}
                    max={180}
                    value={itemFormSudutPunggung}
                    onChange={e => setItemFormSudutPunggung(e.target.value)}
                    placeholder="175"
                  />
                </div>

                <div>
                  <Label className="mb-1 block font-semibold">Toleransi Sudut Deviasi</Label>
                  <Select value={itemFormToleransi} onChange={e => setItemFormToleransi(e.target.value)}>
                    <option value="8">±8° (Sangat Ketat / Presisi Tinggi)</option>
                    <option value="12">±12° (Ketat Ergonomis)</option>
                    <option value="15">±15° (Standar Terapi Normal)</option>
                    <option value="20">±20° (Fleksibel / Pemula)</option>
                  </Select>
                </div>

                <div>
                  <Label className="mb-1 block font-semibold">Ambang Akurasi Minimum AI</Label>
                  <Select value={itemFormAmbangAkurasi} onChange={e => setItemFormAmbangAkurasi(e.target.value)}>
                    <option value="60">60% (Toleransi Luas)</option>
                    <option value="70">70% (Menengah)</option>
                    <option value="75">75% (Rekomendasi Terapi)</option>
                    <option value="80">80% (Standar Presisi)</option>
                    <option value="85">85% (Ketat / Ahli)</option>
                  </Select>
                </div>

                <div>
                  <Label className="mb-1 block font-semibold">Tingkat Kesulitan</Label>
                  <Select
                    value={itemFormTingkat}
                    onChange={e => setItemFormTingkat(e.target.value)}
                  >
                    <option value="pemula">Pemula</option>
                    <option value="menengah">Menengah</option>
                    <option value="lanjut">Lanjut</option>
                  </Select>
                </div>

                <div>
                  <Label className="mb-1 block font-semibold">Durasi Tahan per Rep (Detik)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    value={itemFormDurasi}
                    onChange={e => setItemFormDurasi(e.target.value)}
                  />
                </div>

                <div>
                  <Label className="mb-1 block font-semibold">Target Jumlah Repetisi</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={itemFormReps}
                    onChange={e => setItemFormReps(e.target.value)}
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-3">
                  <Label className="mb-1 block font-semibold">Petunjuk Koreksi Real-Time AI (Cues)</Label>
                  <Input
                    type="text"
                    placeholder="Contoh: Tarik dagu ke belakang secara horizontal, sejajarkan telinga dengan bahu"
                    value={itemFormPetunjukKoreksi}
                    onChange={e => setItemFormPetunjukKoreksi(e.target.value)}
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-3">
                  <Label className="mb-1 block font-semibold">Instruksi & Deskripsi Gerakan</Label>
                  <Textarea
                    placeholder="Tuliskan petunjuk posisi tubuh, arah gerakan, dan teknik bernapas untuk peserta..."
                    value={itemFormDeskripsi}
                    onChange={e => setItemFormDeskripsi(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSaveExerciseItem}
                  disabled={savingItem}
                  className="flex-1 font-semibold text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Save size={14} />
                  <span>{savingItem ? 'Menyimpan...' : editingExerciseId ? 'Simpan Perubahan' : 'Terbitkan Gerakan Terapi'}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={closeItemModal}
                >
                  Batal
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* MODAL: BANK VARIASI GERAKAN TERAPI (32 PILIHAN PRESET)            */}
      {/* ----------------------------------------------------------------- */}
      {showPresetsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto animate-fadeIn" onClick={() => setShowPresetsModal(false)}>
          <Card className="w-full max-w-4xl my-8 p-6 bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-purple-500" />
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Bank Variasi Gerakan Terapi ({presets.length} Pilihan)</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Pilih dari katalog gerakan terapi ergonomis & biomekanik. Tambah satuan atau pilih banyak sekaligus.</p>
                </div>
              </div>
              <button onClick={() => setShowPresetsModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {/* Filter Bar & Batch Toggle */}
            <div className="space-y-2 mb-4">
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <div className="relative flex-1 w-full">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Cari gerakan, variasi, atau otot..."
                    value={presetSearch}
                    onChange={e => setPresetSearch(e.target.value)}
                    className="pl-8 text-xs h-8"
                  />
                </div>
                <Select value={presetCatFilter} onChange={e => setPresetCatFilter(e.target.value)} className="text-xs h-8 sm:w-48">
                  <option value="semua">Semua Kategori</option>
                  <option value="leher">Leher & Servikal</option>
                  <option value="bahu">Bahu & Torakal</option>
                  <option value="punggung">Punggung & Tulang Belakang</option>
                  <option value="panggul">Panggul & Tungkai</option>
                </Select>
                <Select value={presetPosFilter} onChange={e => setPresetPosFilter(e.target.value)} className="text-xs h-8 sm:w-36">
                  <option value="semua">Semua Posisi</option>
                  <option value="berdiri">Berdiri</option>
                  <option value="duduk">Duduk</option>
                  <option value="dinding">Dinding</option>
                  <option value="matras">Matras</option>
                  <option value="tengkurap">Tengkurap</option>
                </Select>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={batchModeActive ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setBatchModeActive(!batchModeActive);
                      if (batchModeActive) setSelectedPresetIds([]);
                    }}
                    className="text-xs h-7 gap-1"
                  >
                    <CheckSquare size={13} />
                    <span>{batchModeActive ? 'Matikan Mode Centang' : 'Mode Centang (Tambah Banyak Sekaligus)'}</span>
                  </Button>
                  {batchModeActive && (
                    <span className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold">
                      {selectedPresetIds.length} variasi terpilih
                    </span>
                  )}
                </div>

                {batchModeActive && selectedPresetIds.length > 0 && (
                  <Button
                    type="button"
                    variant="success"
                    size="sm"
                    onClick={() => handleBatchAddPresets()}
                    disabled={batchAdding}
                    className="text-xs h-7 font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Plus size={13} />
                    <span>{batchAdding ? 'Menambahkan...' : `Tambah ${selectedPresetIds.length} Variasi ke Kategori`}</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Presets Grid */}
            {loadingPresets ? (
              <div className="py-12 text-center text-xs text-slate-400">Memuat katalog preset variasi gerakan...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[58vh] overflow-y-auto pr-1">
                {presets
                  .filter(p => {
                    if (presetCatFilter !== 'semua' && !p.kategori_rekomendasi.toLowerCase().includes(presetCatFilter)) return false;
                    if (presetPosFilter !== 'semua' && p.posisi_tubuh !== presetPosFilter) return false;
                    if (presetSearch) {
                      const q = presetSearch.toLowerCase();
                      return (
                        p.nama.toLowerCase().includes(q) ||
                        p.variasi.toLowerCase().includes(q) ||
                        p.target_otot.toLowerCase().includes(q) ||
                        p.deskripsi.toLowerCase().includes(q)
                      );
                    }
                    return true;
                  })
                  .map(preset => {
                    const isSelected = selectedPresetIds.includes(preset.preset_id);
                    return (
                      <div
                        key={preset.preset_id}
                        className={cn(
                          'p-3.5 rounded-xl border transition-all text-xs flex flex-col justify-between',
                          isSelected
                            ? 'border-purple-500 bg-purple-50/70 dark:bg-purple-950/40 ring-1 ring-purple-500'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-700'
                        )}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2">
                              {batchModeActive && (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={e => {
                                    if (e.target.checked) setSelectedPresetIds(prev => [...prev, preset.preset_id]);
                                    else setSelectedPresetIds(prev => prev.filter(id => id !== preset.preset_id));
                                  }}
                                  className="accent-purple-600 rounded cursor-pointer"
                                />
                              )}
                              <div>
                                <h4 className="font-bold text-slate-900 dark:text-white leading-tight">{preset.nama}</h4>
                                <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">{preset.variasi}</span>
                              </div>
                            </div>
                            <Badge variant="secondary" className="text-[9px] uppercase tracking-wider shrink-0 bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 border-purple-300 dark:border-purple-700">
                              {preset.kategori_rekomendasi}
                            </Badge>
                          </div>

                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mb-2 leading-relaxed">
                            {preset.deskripsi}
                          </p>

                          {/* Quick biomechanic pills */}
                          <div className="flex flex-wrap gap-1 mb-2.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 capitalize">
                              {preset.posisi_tubuh}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 capitalize">
                              {preset.orientasi_kamera.replace('_', ' ')}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                              Leher {preset.sudut_leher}° · Punggung {preset.sudut_punggung}°
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                              ±{preset.toleransi_derajat}° tol
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={() => applyPresetToItemForm(preset)}
                            className="flex-1 text-[11px] h-7 bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                          >
                            <Sparkles size={12} /> Gunakan di Form
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuickAddPreset(preset)}
                            className="text-[11px] h-7 px-2 border-emerald-500/40 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                            title="Tambah langsung ke kategori aktif"
                          >
                            <Plus size={12} /> Tambah Cepat
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};