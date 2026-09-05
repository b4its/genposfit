import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera, CameraOff, Volume2, VolumeX, AlertOctagon, CheckCircle2,
  AlertTriangle, RefreshCw, Sliders, Play, Pause, Activity, Dumbbell, Shield
} from 'lucide-react';
import { SkeletonOverlay } from '../components/SkeletonOverlay';
import { CameraPermission } from '../components/CameraPermission';
import { useCamera } from '../hooks/useCamera';
import { usePoseDetector } from '../hooks/usePoseDetector';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Pill, PillIndicator, PillContent, Progress, Gauge } from '../components/ui';
import { cn } from '../lib/utils';

// Sound synthesizer using Web Audio API for posture warning
function playAlertTone() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {
    console.debug('Audio playback error:', e);
  }
}

export const Monitor = ({ onNavigateToExercises }) => {
  const { user } = useAuth();
  const currentUserId = user?.user_id || 1;
  const [isLive, setIsLive] = useState(true);
  const [audioAlerts, setAudioAlerts] = useState(true);

  const {
    permission: camPermission,
    error: camError,
    started: camStarted,
    stream: camStream,
    start: startCamera,
    stop: stopCamera,
  } = useCamera();

  const [camActive, setCamActive] = useState(false);
  const [simMode, setSimMode] = useState(true); // Simulator active when camera is off

  // Sync camStarted to local state & toggle simMode
  useEffect(() => {
    setCamActive(camStarted);
    setSimMode(!camStarted);
  }, [camStarted]);

  // Telemetry metrics
  const [status, setStatus] = useState('bagus'); // 'bagus', 'ringan', 'buruk'
  const [score, setScore] = useState(94.2);
  const [neckAngle, setNeckAngle] = useState(164.8);
  const [backAngle, setBackAngle] = useState(171.5);
  const [shoulderLevel, setShoulderLevel] = useState(0.012);
  const [feedback, setFeedback] = useState('Postur ergonomis ideal. Pertahankan posisi ini!');
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [badPostureSeconds, setBadPostureSeconds] = useState(0);

  // Manual simulator sliders
  const [simNeck, setSimNeck] = useState(165);
  const [simBack, setSimBack] = useState(171);

  // Landmarks & Canvas
  const [landmarks, setLandmarks] = useState(null);
  const videoRef = useRef(null);
  const wsRef = useRef(null);
  const badPostureStartRef = useRef(null);
  const audioAlertsRef = useRef(audioAlerts);
  audioAlertsRef.current = audioAlerts;

  // MediaPipe pose detection — runs on live camera frames and returns
  // real per-user landmarks, so the skeleton matches the user's anatomy.
  const { landmarks: realLandmarks } = usePoseDetector(videoRef, camStarted);

  // Attach camera stream to <video> when it changes
  useEffect(() => {
    if (videoRef.current && camStream) {
      videoRef.current.srcObject = camStream;
      videoRef.current.play();
    }
  }, [camStream]);

  // Sync real landmarks from MediaPipe to skeleton & send to WebSocket
  const realLandmarksRef = useRef(realLandmarks);
  realLandmarksRef.current = realLandmarks;
  useEffect(() => {
    if (!camStarted || !realLandmarks || realLandmarks.length < 25) return;
    setLandmarks(realLandmarks);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        landmarks: realLandmarks,
        tipe_pose: 'duduk_tegak',
        sesi_id: 'live-monitor-session',
      }));
    }
  }, [camStarted, realLandmarks]);

  // Session clock
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      setSessionSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isLive]);

  // Connect WebSocket to FastAPI backend
  useEffect(() => {
    const apiUrl = import.meta.env?.VITE_API_URL || '';
    const wsBase = apiUrl.replace(/^http/, 'ws');
    const wsUrl = `${wsBase}/api/monitoring/ws/${currentUserId}`;
    let ws;

    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[GenPosFit] WebSocket connected to backend');
      };

      ws.onmessage = (event) => {
        try {
          const res = JSON.parse(event.data);
          if (res.valid) {
            setScore(res.skor_deviasi);
            setStatus(res.status);
            setNeckAngle(res.sudut_leher);
            setBackAngle(res.sudut_punggung);
            setShoulderLevel(res.level_bahu);
            setFeedback(res.feedback);

            if (res.status === 'buruk') {
              if (badPostureStartRef.current === null) {
                badPostureStartRef.current = Date.now();
              }
              const elapsed = Math.floor((Date.now() - badPostureStartRef.current) / 1000);
              setBadPostureSeconds(elapsed);
              if (audioAlertsRef.current && elapsed > 0 && elapsed % 3 === 0) {
                playAlertTone();
              }
            } else {
              badPostureStartRef.current = null;
              setBadPostureSeconds(0);
            }
          }
        } catch (err) {
          console.error('Error parsing WS message:', err);
        }
      };

      ws.onerror = (err) => {
        console.warn('WebSocket fallback to client calculation:', err);
      };
    } catch (err) {
      console.warn('Cannot open WebSocket:', err);
    }

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [currentUserId]);

  // Start / Stop Webcam
  const toggleCamera = async () => {
    if (camActive) {
      stopCamera();
    } else {
      await startCamera();
    }
  };

  // Simulator / Fallback Frame generator
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      // When live camera landmarks are streaming, skip synthetic simulation.
      if (camStarted && realLandmarksRef.current && realLandmarksRef.current.length >= 25) {
        return;
      }
      // If user is controlling sliders in simulator mode
      const t = Date.now() / 900;
      const effectiveNeck = simMode ? simNeck : 165.0 + Math.sin(t) * 2;
      const effectiveBack = simMode ? simBack : 171.0 + Math.cos(t) * 1.5;

      const shoulderX = 0.5;
      const shoulderY = 0.42;
      const neckRad = ((180 - effectiveNeck) * Math.PI) / 180;
      const earX = shoulderX - Math.sin(neckRad) * 0.16;
      const earY = shoulderY - Math.cos(neckRad) * 0.16;

      const lms = [];
      for (let i = 0; i < 33; i++) {
        lms.push({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 });
      }
      lms[0] = { x: earX - 0.04, y: earY + 0.02, visibility: 0.95 };
      lms[7] = { x: earX, y: earY, visibility: 0.95 };
      lms[8] = { x: earX + 0.04, y: earY, visibility: 0.95 };
      lms[11] = { x: shoulderX - 0.06, y: shoulderY, visibility: 0.95 };
      lms[12] = { x: shoulderX + 0.06, y: shoulderY, visibility: 0.95 };
      lms[13] = { x: shoulderX - 0.09, y: shoulderY + 0.15, visibility: 0.9 };
      lms[14] = { x: shoulderX + 0.09, y: shoulderY + 0.15, visibility: 0.9 };
      lms[23] = { x: shoulderX - 0.05, y: shoulderY + 0.32, visibility: 0.95 };
      lms[24] = { x: shoulderX + 0.05, y: shoulderY + 0.32, visibility: 0.95 };
      lms[25] = { x: shoulderX - 0.05, y: shoulderY + 0.52, visibility: 0.9 };
      lms[26] = { x: shoulderX + 0.05, y: shoulderY + 0.52, visibility: 0.9 };

      setLandmarks(lms);

      // Send via WebSocket to FastAPI backend if connected
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          landmarks: lms,
          tipe_pose: 'duduk_tegak',
          sesi_id: 'live-monitor-session',
        }));
      } else {
        // Local evaluation calculation
        const neckDev = Math.abs(effectiveNeck - 165);
        const backDev = Math.abs(effectiveBack - 170);
        const rawScore = Math.max(0, 100 - (neckDev * 3.5 + backDev * 2.2));
        const roundedScore = Math.round(rawScore * 10) / 10;
        const currentStatus = roundedScore >= 85 ? 'bagus' : roundedScore >= 60 ? 'ringan' : 'buruk';

        setScore(roundedScore);
        setStatus(currentStatus);
        setNeckAngle(Math.round(effectiveNeck * 10) / 10);
        setBackAngle(Math.round(effectiveBack * 10) / 10);

        if (currentStatus === 'buruk') {
          if (badPostureStartRef.current === null) {
            badPostureStartRef.current = Date.now();
          }
          const elapsed = Math.floor((Date.now() - badPostureStartRef.current) / 1000);
          setBadPostureSeconds(elapsed);
          if (audioAlertsRef.current && elapsed > 0 && elapsed % 4 === 0) {
            playAlertTone();
          }
          setFeedback('Postur buruk terdeteksi! Tarik dagu dan tegakkan punggung.');
        } else if (currentStatus === 'ringan') {
          setFeedback('Peringatan: Dagu agak condong ke depan.');
          badPostureStartRef.current = null;
          setBadPostureSeconds(0);
        } else {
          setFeedback('Postur ergonomis ideal. Pertahankan posisi ini!');
          badPostureStartRef.current = null;
          setBadPostureSeconds(0);
        }
      }
    }, 60);

    return () => clearInterval(interval);
  }, [isLive, simMode, simNeck, simBack, audioAlerts, camStarted]);

  // Format time HH:MM:SS
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-8">
      {/* Header & Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Live Ergonomics Monitor
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Sesi: #{formatTime(sessionSeconds)} · FPS: ~30 · Deteksi Biomekanika Aktif
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant={audioAlerts ? "default" : "outline"}
            size="sm"
            onClick={() => setAudioAlerts(!audioAlerts)}
            className="flex items-center gap-1.5 text-xs"
          >
            {audioAlerts ? <Volume2 size={15} /> : <VolumeX size={15} />}
            <span className="hidden sm:inline">{audioAlerts ? 'Audio ON' : 'Muted'}</span>
          </Button>

          <Button
            variant={camActive ? "success" : "outline"}
            size="sm"
            onClick={toggleCamera}
            className="flex items-center gap-1.5 text-xs"
          >
            {camActive ? <Camera size={15} /> : <CameraOff size={15} />}
            <span>{camActive ? 'Webcam Aktif' : 'Simulasi Biomekanika'}</span>
          </Button>

          <Button
            variant={isLive ? "success" : "secondary"}
            size="sm"
            onClick={() => setIsLive(!isLive)}
            className={cn("flex items-center gap-1.5 text-xs font-bold", !isLive && "bg-amber-600 hover:bg-amber-700 text-white")}
          >
            {isLive ? <Pause size={14} /> : <Play size={14} />}
            <span>{isLive ? 'Running' : 'Paused'}</span>
          </Button>
        </div>
      </div>

      {/* Main Grid: Video Stream + Ergonomic Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / Center Viewport: Video & Skeleton Overlay */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <Card className="p-2 relative overflow-hidden bg-slate-950 border-slate-800 shadow-lg">
            {/* Viewport Frame */}
            <div className="relative w-full h-[340px] sm:h-[420px] rounded-lg bg-slate-950 flex items-center justify-center overflow-hidden border border-slate-800">
              {/* Actual Video Tag */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${camActive ? 'block' : 'hidden'}`}
              />

              {/* Skeleton Overlay */}
              <SkeletonOverlay
                landmarks={landmarks}
                width={720}
                height={480}
                status={status}
                sudutLeher={neckAngle}
                sudutPunggung={backAngle}
                levelBahu={shoulderLevel}
                orientasi="lateral_kiri"
                showAngles={true}
              />

              {/* Camera Permission Overlay */}
              {!camActive && (
                <CameraPermission
                  permission={camPermission}
                  error={camError}
                  onRequestCamera={startCamera}
                />
              )}

              {/* Bad posture alert banner over canvas */}
              {status === 'buruk' && (
                <div className="absolute top-4 left-4 right-4 bg-rose-600/90 text-white px-4 py-2.5 rounded-xl backdrop-blur-md flex items-center justify-between z-20 border border-rose-400 shadow-lg animate-pulse">
                  <div className="flex items-center gap-2 font-mono text-xs font-bold">
                    <AlertOctagon size={18} />
                    <span>PERINGATAN: POSTUR BURUK TERDETEKSI ({badPostureSeconds}s)</span>
                  </div>
                  {onNavigateToExercises && (
                    <button
                      onClick={onNavigateToExercises}
                      className="text-[11px] font-mono underline bg-white/20 px-2 py-0.5 rounded cursor-pointer hover:bg-white/30"
                    >
                      Mulai Peregangan ➔
                    </button>
                  )}
                </div>
              )}

              {/* Bottom Stream Telemetry Strip */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-900/85 backdrop-blur-sm border border-slate-800 text-xs font-mono z-20">
                <div className="flex items-center gap-4">
                  <span className="text-slate-400">
                    Mode: <strong className="text-white">{camActive ? 'Webcam' : 'Simulasi'}</strong>
                  </span>
                  <span className="text-slate-400">
                    Orientasi: <strong className="text-blue-400">Lateral Kiri</strong>
                  </span>
                </div>
                <Pill
                  variant={status === 'bagus' ? 'success' : status === 'ringan' ? 'warning' : 'destructive'}
                  size="sm"
                >
                  <PillIndicator variant={status === 'bagus' ? 'success' : status === 'ringan' ? 'warning' : 'destructive'} />
                  <PillContent className="capitalize font-semibold">{status}</PillContent>
                </Pill>
              </div>
            </div>
          </Card>

          {/* Simulator manual sliders for testing & presentation */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Sliders size={14} className="text-blue-500" />
                <span>Simulasi Gerakan & Deviasi Biomekanika</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSimNeck(165); setSimBack(171); }}
                className="text-xs h-auto p-0 text-blue-600 dark:text-blue-400 hover:text-blue-500 font-medium hover:bg-transparent"
              >
                Reset Ergonomis
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400 font-medium mb-1.5">
                  <span>Sudut Leher (Forward Head):</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">{simNeck}°</span>
                </div>
                <input
                  type="range"
                  min="130"
                  max="175"
                  value={simNeck}
                  onChange={(e) => {
                    setSimNeck(parseFloat(e.target.value));
                    setSimMode(true);
                  }}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400 font-medium mb-1.5">
                  <span>Sudut Punggung (Trunk Slope):</span>
                  <span className="text-blue-600 dark:text-blue-400 font-bold font-mono">{simBack}°</span>
                </div>
                <input
                  type="range"
                  min="135"
                  max="178"
                  value={simBack}
                  onChange={(e) => {
                    setSimBack(parseFloat(e.target.value));
                    setSimMode(true);
                  }}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Right HUD: Ergonomic Score, Gauges & Action Recommendations */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Main Score Card with Kibo UI Gauge */}
          <Card
            className={cn(
              "p-6 text-center relative overflow-hidden transition-all duration-300",
              status === 'bagus'
                ? 'border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                : status === 'ringan'
                ? 'border-amber-500/40 shadow-lg shadow-amber-500/10'
                : 'border-rose-500/40 shadow-lg shadow-rose-500/10'
            )}
          >
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Skor Kualitas Ergonomi
            </div>

            {/* Kibo UI Circular Gauge */}
            <div className="my-2 flex justify-center">
              <Gauge
                value={score}
                size={144}
                strokeWidth={10}
                status={status}
                label="Skor"
              />
            </div>

            <div className="mt-3">
              <Pill
                variant={status === 'bagus' ? 'success' : status === 'ringan' ? 'warning' : 'destructive'}
                size="md"
              >
                <PillIndicator variant={status === 'bagus' ? 'success' : status === 'ringan' ? 'warning' : 'destructive'} />
                <PillContent className="font-semibold uppercase tracking-wider text-xs">
                  {status === 'bagus' ? 'ERGONOMIS BAGUS' : status === 'ringan' ? 'DEVIASI RINGAN' : 'POSTUR BURUK'}
                </PillContent>
              </Pill>
            </div>

            <p className="text-xs text-slate-800 dark:text-slate-200 mt-4 leading-relaxed bg-slate-100 dark:bg-slate-800/70 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60">
              {feedback}
            </p>
          </Card>

          {/* Joint Breakdown Card with Kibo UI Progress */}
          <Card className="p-5">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">
              Biomechanical Telemetry
            </h3>

            <div className="space-y-4 text-xs font-mono">
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-slate-500 dark:text-slate-400">Sudut Leher (Craniovertebral):</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">{neckAngle}° (Base 165°)</span>
                </div>
                <Progress
                  value={Math.min(100, (neckAngle / 175) * 100)}
                  variant="success"
                  className="h-2"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-slate-500 dark:text-slate-400">Sudut Punggung (Trunk):</span>
                  <span className="text-blue-600 dark:text-blue-400 font-bold">{backAngle}° (Base 170°)</span>
                </div>
                <Progress
                  value={Math.min(100, (backAngle / 180) * 100)}
                  variant="default"
                  className="h-2"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-slate-500 dark:text-slate-400">Kemiringan Bahu (Symmetry):</span>
                  <span className="text-slate-900 dark:text-white font-bold">{(shoulderLevel * 100).toFixed(1)}%</span>
                </div>
                <Progress
                  value={Math.min(100, shoulderLevel * 1000)}
                  variant="gradient"
                  className="h-2"
                />
              </div>
            </div>
          </Card>

          {/* Therapy Suggestion Box */}
          <Card className="p-5 bg-gradient-to-br from-emerald-500/10 via-transparent to-blue-500/5 border-emerald-500/30">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-bold mb-2">
              <Dumbbell size={16} />
              <span>Rekomendasi Terapi Postur</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
              Lakukan latihan <strong>Chin Tuck</strong> selama 5 detik untuk menguatkan fleksor leher dalam dan mengurangi ketegangan servikal.
            </p>
            {onNavigateToExercises && (
              <Button
                variant="success"
                size="sm"
                onClick={onNavigateToExercises}
                className="w-full text-xs font-semibold"
              >
                Buka Menu Latihan Terapi
              </Button>
            )}
          </Card>
        </div>
      </div>
     </div>
  );
};
