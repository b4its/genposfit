import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, RotateCcw, Award, HeartPulse, Camera, CameraOff, Target
} from 'lucide-react';
import { Button, Card, Badge, Progress, Pill, PillContent } from '../components/ui';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { SkeletonOverlay, type Landmark } from '../components/SkeletonOverlay';
import { usePoseDetector } from '../hooks/usePoseDetector';
import { useCamera } from '../hooks/useCamera';

interface ExerciseItem {
  exercise_id: number;
  type_id?: number;
  type?: string;
  nama: string;
  deskripsi: string;
  target_otot: string;
  sudut_target: Record<string, number> | null;
  skeleton_data: Landmark[] | null;
  sudut_leher: number | null;
  sudut_punggung: number | null;
  durasi_detik: number;
  reps: number;
  tingkat: string;
  is_battle: boolean;
}

const DEFAULT_EXERCISES: ExerciseItem[] = [];

const apiUrl = () => import.meta.env?.VITE_API_URL || 'http://localhost:8042';

export const Exercises: React.FC = () => {
  const { user, token } = useAuth();
  const currentUserId = user?.user_id || 1;
  const [exercises, setExercises] = useState<ExerciseItem[]>(DEFAULT_EXERCISES);
  const [activeExercise, setActiveExercise] = useState<ExerciseItem | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentRep, setCurrentRep] = useState<number>(0);
  const [holdTimer, setHoldTimer] = useState<number>(5);
  const [sessionCompleted, setSessionCompleted] = useState<boolean>(false);
  const [poseScores, setPoseScores] = useState<number[]>([]);
  const [lastScore, setLastScore] = useState<number | null>(null);

  // Camera for pose matching
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { started: camStarted, stream: camStream, start: startCam, stop: stopCam } = useCamera();
  const { landmarks: realLandmarks } = usePoseDetector(videoRef, camStarted);
  const [camActive, setCamActive] = useState(false);
  const [playerLandmarks, setPlayerLandmarks] = useState<Landmark[] | null>(null);
  const playerLandmarksRef = useRef(playerLandmarks);
  useEffect(() => { playerLandmarksRef.current = playerLandmarks; }, [playerLandmarks]);
  const activeExerciseRef = useRef(activeExercise);
  useEffect(() => { activeExerciseRef.current = activeExercise; }, [activeExercise]);

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
    if (camStarted && realLandmarks && realLandmarks.length >= 25) {
      setPlayerLandmarks(realLandmarks);
    }
  }, [camStarted, realLandmarks]);

  // Fetch from backend exercises endpoint (hierarchical: types → children)
  useEffect(() => {
    fetch(`${apiUrl()}/api/exercises/types`)
      .then(res => res.json())
      .then((types: any[]) => {
        const all: ExerciseItem[] = [];
        types.forEach((t: any) => {
          (t.children || []).forEach((c: any) => all.push({ ...c, type: t.nama, type_id: t.type_id }));
        });
        if (all.length > 0) {
          setExercises(all);
          setActiveExercise(all[0]);
        } else {
          fetch(`${apiUrl()}/api/exercises`)
            .then(res => res.json())
            .then(data => {
              if (Array.isArray(data) && data.length > 0) {
                setExercises(data);
                setActiveExercise(data[0]);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  const RESERVE_SCORES = 0; // placeholder unused
  const poseScoresRef = useRef(poseScores);
  useEffect(() => { poseScoresRef.current = poseScores; }, [poseScores]);

  const saveCompletedSession = async (exerciseId: number, totalReps: number) => {
    const scores = poseScoresRef.current;
    const avgSkor = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 94.5;
    try {
      await fetch(`${apiUrl()}/api/exercises/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ user_id: currentUserId, exercise_id: exerciseId, total_reps: totalReps, avg_skor: avgSkor }),
      });
    } catch { /* offline fallback */ }
  };

  const scorePose = async (): Promise<number> => {
    const lm = playerLandmarksRef.current;
    const ex = activeExerciseRef.current;
    if (!ex || !lm) return 0;
    try {
      const res = await fetch(`${apiUrl()}/api/exercises/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landmarks: lm, exercise_id: ex.exercise_id }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.score || 0;
      }
    } catch { /* offline */ }
    return 0;
  };

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

    setCurrentRep(r => {
      const nextR = r + 1;
      if (ex && nextR >= (ex.reps || 10)) {
        setTimeout(() => {
          setIsRunning(false);
          setSessionCompleted(true);
          saveCompletedSession(ex.exercise_id, nextR);
        }, 0);
        return nextR;
      }
      return nextR;
    });
    setHoldTimer(ex.durasi_detik || 5);

    scorePose().then(s => {
      setLastScore(s);
      setPoseScores(prev => [...prev, s]);
    }).catch(() => {});
  }, [holdTimer, isRunning, activeExercise]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectExercise = (ex: ExerciseItem) => {
    setActiveExercise(ex);
    setIsRunning(false);
    setCurrentRep(0);
    setHoldTimer(ex.durasi_detik || 5);
    setSessionCompleted(false);
    setPoseScores([]);
    setLastScore(null);
  };

  const toggleRun = () => {
    if (sessionCompleted) {
      setCurrentRep(0);
      setSessionCompleted(false);
      setPoseScores([]);
      setLastScore(null);
      setHoldTimer(activeExercise?.durasi_detik || 5);
    }
    setIsRunning(!isRunning);
  };

  const resetRoutine = () => {
    setIsRunning(false);
    setCurrentRep(0);
    setSessionCompleted(false);
    setPoseScores([]);
    setLastScore(null);
    setHoldTimer(activeExercise?.durasi_detik || 5);
  };

  const hasSkeleton = activeExercise && activeExercise.skeleton_data && activeExercise.skeleton_data.length >= 25;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-10">
      <div className="max-w-4xl mx-auto mb-8 text-left">
        <Pill variant="success" size="md" className="mb-2">
          <HeartPulse size={14} />
          <PillContent>PROGRAM TERAPI & PEREGANGAN POSTUR</PillContent>
        </Pill>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Latihan Terapi & Koreksi Postur
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Gerakan terapeutik — cocokkan pose Anda dengan skeleton referensi dari pelatih.
        </p>
      </div>

      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Menu */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1">
            Pilihan Gerakan Terapi
          </h3>
          {exercises.map(ex => {
            const isSelected = activeExercise?.exercise_id === ex.exercise_id;
            return (
              <Card key={ex.exercise_id} hoverEffect onClick={() => handleSelectExercise(ex)} className={cn("p-4 cursor-pointer", isSelected && "border-emerald-500 bg-emerald-500/10")}>
                <div className="flex items-center justify-between mb-1">
                  <span className={cn("text-sm font-bold", isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white')}>{ex.nama}</span>
                  <div className="flex gap-1">
                    {ex.type && <Badge variant="info" className="text-[9px] h-4 px-1">{ex.type}</Badge>}
                    {ex.is_battle && <Badge variant="warning">Battle</Badge>}
                    <Badge variant={ex.tingkat === 'pemula' ? 'success' : 'info'}>{ex.tingkat}</Badge>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">{ex.deskripsi}</p>
              </Card>
            );
          })}
        </div>

        {/* Right Column: Runner */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {activeExercise && (
            <Card className="p-6 relative overflow-hidden">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">{activeExercise.nama}</h2>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400">{activeExercise.target_otot}</span>
                </div>
                <Badge variant="success">{activeExercise.tingkat}</Badge>
              </div>

              {/* Camera toggle */}
              <div className="flex items-center gap-2 mb-4">
                <Button variant={camActive ? "success" : "outline"} size="sm" onClick={camActive ? stopCam : startCam} className="text-xs">
                  {camActive ? <CameraOff size={14} /> : <Camera size={14} />} {camActive ? 'Kamera ON' : 'Aktifkan Kamera'}
                </Button>
                <span className="text-[11px] text-slate-400">Pose Anda akan dicocokkan dengan referensi.</span>
              </div>

              {/* Skeleton viewport */}
              <div className="relative w-full h-72 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden mb-4">
                <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${camActive ? 'block' : 'hidden'}`} />
                {/* Ghost: target skeleton (reference) */}
                {hasSkeleton && (
                  <SkeletonOverlay landmarks={activeExercise.skeleton_data} width={640} height={400} status="bagus" orientasi="frontal" showAngles={false} color="#8b5cf6" className="opacity-40" />
                )}
                {/* Player's skeleton */}
                <SkeletonOverlay landmarks={playerLandmarks} width={640} height={400} status={lastScore && lastScore >= 85 ? 'bagus' : lastScore && lastScore >= 60 ? 'ringan' : 'buruk'} orientasi="frontal" showAngles={false} />

                {/* Score HUD */}
                {lastScore != null && (
                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold font-mono backdrop-blur-sm z-20" style={{ backgroundColor: lastScore >= 85 ? '#10b98133' : lastScore >= 60 ? '#f59e0b33' : '#ef444433', border: `1px solid ${lastScore >= 85 ? '#10b981' : lastScore >= 60 ? '#f59e0b' : '#ef4444'}`, color: '#fff' }}>
                    <Target size={12} className="inline mr-1" />{lastScore}%
                  </div>
                )}
              </div>

              {/* Score history */}
              {poseScores.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {poseScores.map((s, i) => (
                    <span key={i} className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${s >= 85 ? 'bg-emerald-500/20 text-emerald-400' : s >= 60 ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'}`}>
                      #{i + 1}: {s}%
                    </span>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-center my-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Repetisi</div>
                  <div className="text-4xl font-extrabold font-mono text-blue-600 dark:text-blue-400">{currentRep} <span className="text-lg text-slate-500 font-normal">/ {activeExercise.reps}</span></div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Tahan Posisi</div>
                  <div className="text-4xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">{holdTimer}s</div>
                </div>
              </div>

              <Progress value={(currentRep / (activeExercise.reps || 10)) * 100} variant="gradient" className="h-2.5 mb-6" />

              <div className="flex items-center gap-4">
                <Button type="button" variant={isRunning ? "secondary" : "success"} size="lg" onClick={toggleRun} className={cn("flex-1 font-bold text-xs", isRunning && "bg-amber-600 hover:bg-amber-700 text-white")}>
                  {isRunning ? <Pause size={16} /> : <Play size={16} className="fill-current" />}
                  <span>{isRunning ? 'Pause' : sessionCompleted ? 'Ulangi' : 'Mulai Latihan'}</span>
                </Button>
                <Button type="button" variant="outline" size="lg" onClick={resetRoutine} className="px-4" title="Reset"><RotateCcw size={15} /></Button>
              </div>

              {sessionCompleted && (
                <div className="mt-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Award size={24} className="text-emerald-500 shrink-0" />
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-sm">Sesi Selesai!</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {activeExercise.reps} repetisi · Skor rata-rata:{' '}
                        {poseScores.length > 0 ? Math.round(poseScores.reduce((a, b) => a + b, 0) / poseScores.length) : '-'}%
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};