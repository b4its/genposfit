import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera, CameraOff, Volume2, VolumeX, AlertOctagon, CheckCircle2,
  AlertTriangle, RefreshCw, Sliders, Play, Pause, Activity, Dumbbell, Shield
} from 'lucide-react';
import { SkeletonOverlay } from '../components/SkeletonOverlay';
import { CameraPermission } from '../components/CameraPermission';
import { useCamera } from '../hooks/useCamera';

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
  const badPostureTimerRef = useRef(0);

  // Attach camera stream to <video> when it changes
  useEffect(() => {
    if (videoRef.current && camStream) {
      videoRef.current.srcObject = camStream;
      videoRef.current.play();
    }
  }, [camStream]);

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
    const wsUrl = `ws://localhost:8042/api/monitoring/ws/1`;
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
              badPostureTimerRef.current += 1;
              setBadPostureSeconds(badPostureTimerRef.current);
              if (audioAlerts && badPostureTimerRef.current % 3 === 0) {
                playAlertTone();
              }
            } else {
              badPostureTimerRef.current = 0;
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
  }, [audioAlerts]);

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
          badPostureTimerRef.current += 1;
          setBadPostureSeconds(badPostureTimerRef.current);
          if (audioAlerts && badPostureTimerRef.current % 4 === 0) {
            playAlertTone();
          }
          setFeedback('Postur buruk terdeteksi! Tarik dagu dan tegakkan punggung.');
        } else if (currentStatus === 'ringan') {
          setFeedback('Peringatan: Dagu agak condong ke depan.');
          badPostureTimerRef.current = 0;
          setBadPostureSeconds(0);
        } else {
          setFeedback('Postur ergonomis ideal. Pertahankan posisi ini!');
          badPostureTimerRef.current = 0;
          setBadPostureSeconds(0);
        }
      }
    }, 60);

    return () => clearInterval(interval);
  }, [isLive, simMode, simNeck, simBack, audioAlerts]);

  // Format time HH:MM:SS
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="app-container py-8">
      {/* Header & Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-mono">
              Live Ergonomics Monitor
            </h1>
          </div>
          <p className="text-xs font-mono text-slate-400">
            Sesi: #{formatTime(sessionSeconds)} · FPS: ~30 · WebSocket: :8042
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAudioAlerts(!audioAlerts)}
            className={`p-2 rounded-lg border text-xs font-mono cursor-pointer flex items-center gap-1.5 ${
              audioAlerts
                ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}
          >
            {audioAlerts ? <Volume2 size={16} /> : <VolumeX size={16} />}
            <span className="hidden sm:inline">{audioAlerts ? 'Audio ON' : 'Muted'}</span>
          </button>

          <button
            onClick={toggleCamera}
            className={`px-3 py-2 rounded-lg border text-xs font-mono cursor-pointer flex items-center gap-2 ${
camActive
                ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                : 'bg-slate-900 border-slate-700 text-slate-300'
            }`}
          >
            {camActive ? <Camera size={16} /> : <CameraOff size={16} />}
            <span>{camActive ? 'Webcam Aktif' : 'Simulasi Biomekanika'}</span>
          </button>

          <button
            onClick={() => setIsLive(!isLive)}
            className={`px-3 py-2 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer ${
              isLive
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'bg-amber-600 text-white'
            }`}
          >
            {isLive ? <Pause size={14} /> : <Play size={14} />}
            <span>{isLive ? 'Running' : 'Paused'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Video Stream + Ergonomic Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / Center Viewport: Video & Skeleton Overlay */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="dev-card p-2 relative overflow-hidden bg-slate-950">
            {/* Viewport Frame */}
            <div className="relative w-full h-[420px] rounded-lg bg-slate-950 flex items-center justify-center overflow-hidden border border-slate-800">
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
                <div className="absolute top-4 left-4 right-4 bg-red-600/90 text-white px-4 py-2.5 rounded-lg backdrop-blur-md flex items-center justify-between z-20 border border-red-400 animate-pulse">
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
                <div className={`status-pill status-pill-${status}`}>
                  <span>{status}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Simulator manual sliders for testing & presentation */}
          <div className="dev-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                <Sliders size={14} className="text-blue-400" />
                <span>Simulasi Gerakan & Deviasi Biomekanika</span>
              </span>
              <button
                onClick={() => { setSimNeck(165); setSimBack(171); }}
                className="text-[11px] font-mono text-blue-400 hover:underline cursor-pointer"
              >
                Reset Ergonomis
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Sudut Leher (Forward Head):</span>
                  <span className="text-emerald-400 font-bold">{simNeck}°</span>
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
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Sudut Punggung (Trunk Slope):</span>
                  <span className="text-blue-400 font-bold">{simBack}°</span>
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
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right HUD: Ergonomic Score, Gauges & Action Recommendations */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Main Score Card */}
          <div className="dev-card p-6 text-center relative overflow-hidden"
            style={{
              borderColor: status === 'bagus' ? 'rgba(16, 185, 129, 0.4)' : status === 'ringan' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(239, 68, 68, 0.4)'
            }}>
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
              Skor Kualitas Ergonomi
            </div>

            {/* Circular Gauge */}
            <div className="relative w-36 h-36 mx-auto my-2 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50" cy="50" r="42"
                  strokeWidth="8"
                  stroke="currentColor"
                  className="text-slate-800"
                  fill="transparent"
                />
                <circle
                  cx="50" cy="50" r="42"
                  strokeWidth="8"
                  stroke={status === 'bagus' ? '#10b981' : status === 'ringan' ? '#f59e0b' : '#ef4444'}
                  strokeDasharray={264}
                  strokeDashoffset={264 - (264 * score) / 100}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-300"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold font-mono">{score}</span>
                <span className="text-[10px] font-mono text-slate-400">/ 100</span>
              </div>
            </div>

            <div className="mt-2">
              <div className={`status-pill status-pill-${status}`}>
                {status === 'bagus' ? 'ERGONOMIS BAGUS' : status === 'ringan' ? 'DEVIASI RINGAN' : 'POSTUR BURUK'}
              </div>
            </div>

            <p className="text-xs text-slate-300 mt-3 font-mono leading-relaxed bg-slate-900/50 p-2.5 rounded-lg border border-slate-800">
              {feedback}
            </p>
          </div>

          {/* Joint Breakdown Card */}
          <div className="dev-card p-5">
            <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider mb-4">
              Biomechanical Telemetry
            </h3>

            <div className="space-y-3.5 text-xs font-mono">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Sudut Leher (Craniovertebral):</span>
                  <span className="text-emerald-400 font-bold">{neckAngle}° (Base 165°)</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${Math.min(100, (neckAngle / 175) * 100)}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Sudut Punggung (Trunk):</span>
                  <span className="text-blue-400 font-bold">{backAngle}° (Base 170°)</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500"
                    style={{ width: `${Math.min(100, (backAngle / 180) * 100)}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Kemiringan Bahu (Symmetry):</span>
                  <span className="text-slate-200 font-bold">{(shoulderLevel * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-400"
                    style={{ width: `${Math.min(100, shoulderLevel * 1000)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Therapy Suggestion Box */}
          <div className="dev-card p-5 bg-gradient-to-br from-emerald-950/30 to-blue-950/20 border-emerald-500/20">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono font-bold mb-2">
              <Dumbbell size={16} />
              <span>Rekomendasi Terapi Postur</span>
            </div>
            <p className="text-xs text-slate-300 font-mono leading-relaxed mb-4">
              Lakukan latihan <strong>Chin Tuck</strong> selama 5 detik untuk menguatkan fleksor leher dalam dan mengurangi ketegangan servikal.
            </p>
            {onNavigateToExercises && (
              <button
                onClick={onNavigateToExercises}
                className="w-full btn-green py-2 text-xs font-mono cursor-pointer"
              >
                Buka Menu Latihan Terapi
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
