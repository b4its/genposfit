import React, { useState, useEffect, useRef } from 'react';
import {
  Camera, CameraOff, CheckCircle2, AlertTriangle, Play,
  RefreshCw, Save, ShieldCheck, ArrowRight, UserCheck, ChevronRight
} from 'lucide-react';
import { SkeletonOverlay } from '../components/SkeletonOverlay';
import { CameraPermission } from '../components/CameraPermission';
import { useCamera } from '../hooks/useCamera';
import { usePoseDetector } from '../hooks/usePoseDetector';

export const RegisterPose = ({ onFinishCalibration }) => {
  const [nama, setNama] = useState('Alex Chandra');
  const [email, setEmail] = useState('developer@genposfit.local');
  const [pekerjaan, setPekerjaan] = useState('Software Engineer');
  const [orientasi, setOrientasi] = useState('lateral_kiri');
  const [tipePose, setTipePose] = useState('duduk_tegak');

  // Camera state
  const { permission: camPermission, error: camError, started: camStarted, stream: camStream, start: startCamera, stop: stopCamera } = useCamera();
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [recordedFrames, setRecordedFrames] = useState(0);
  const [collectedBaselines, setCollectedBaselines] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Live telemetry
  const [currentLandmarks, setCurrentLandmarks] = useState(null);
  const [liveNeck, setLiveNeck] = useState(165.0);
  const [liveBack, setLiveBack] = useState(170.0);
  const [liveShoulder, setLiveShoulder] = useState(0.015);

  const videoRef = useRef(null);
  const frameBufferRef = useRef([]);
  const animFrameIdRef = useRef(null);

  // MediaPipe pose detection — real per-user landmarks for the skeleton.
  const { landmarks: realLandmarks } = usePoseDetector(videoRef, camStarted);

  // Sync real landmarks from MediaPipe when camera is live.
  const realLandmarksRef = useRef(realLandmarks);
  realLandmarksRef.current = realLandmarks;
  useEffect(() => {
    if (isCameraActive && realLandmarks && realLandmarks.length >= 25) {
      setCurrentLandmarks(realLandmarks);
    }
  }, [isCameraActive, realLandmarks]);

  // Sync camera started state
  useEffect(() => {
    setIsCameraActive(camStarted);
  }, [camStarted]);

  // Attach stream to <video>
  useEffect(() => {
    if (videoRef.current && camStream) {
      videoRef.current.srcObject = camStream;
      videoRef.current.play();
    }
  }, [camStream]);

  // Start Camera
  const handleStartCamera = async () => {
    await startCamera();
  };

  // Stop Camera
  const handleStopCamera = () => {
    stopCamera();
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
    }
    setIsCameraActive(false);
  };

  // Simulated landmarks loop if camera is off
  useEffect(() => {
    if (isCameraActive) return;

    const interval = setInterval(() => {
      // Natural slight breathing movement
      const t = Date.now() / 800;
      const neckAngle = 165.0 + Math.sin(t) * 1.5;
      const backAngle = 171.0 + Math.cos(t) * 1.2;
      const shoulderLevel = 0.012 + Math.abs(Math.sin(t * 0.5)) * 0.005;

      setLiveNeck(Math.round(neckAngle * 10) / 10);
      setLiveBack(Math.round(backAngle * 10) / 10);
      setLiveShoulder(Math.round(shoulderLevel * 1000) / 1000);

      // Generate synthetic 33-point landmarks
      const lms = [];
      for (let i = 0; i < 33; i++) {
        lms.push({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 });
      }
      const shoulderX = 0.5;
      const shoulderY = 0.42;
      const neckRad = ((180 - neckAngle) * Math.PI) / 180;
      const earX = shoulderX - Math.sin(neckRad) * 0.16;
      const earY = shoulderY - Math.cos(neckRad) * 0.16;

      lms[0] = { x: earX - 0.04, y: earY + 0.02, visibility: 0.95 }; // nose
      lms[7] = { x: earX, y: earY, visibility: 0.95 }; // L ear
      lms[8] = { x: earX + 0.05, y: earY, visibility: 0.95 }; // R ear
      lms[11] = { x: shoulderX - 0.06, y: shoulderY, visibility: 0.95 };
      lms[12] = { x: shoulderX + 0.06, y: shoulderY + shoulderLevel, visibility: 0.95 };
      lms[23] = { x: shoulderX - 0.04, y: shoulderY + 0.32, visibility: 0.95 };
      lms[24] = { x: shoulderX + 0.04, y: shoulderY + 0.32, visibility: 0.95 };
      lms[25] = { x: shoulderX - 0.04, y: shoulderY + 0.52, visibility: 0.9 };
      lms[26] = { x: shoulderX + 0.04, y: shoulderY + 0.52, visibility: 0.9 };

      setCurrentLandmarks(lms);

      // If in recording mode, record frame
      if (isRecording) {
        frameBufferRef.current.push({
          neck: neckAngle,
          back: backAngle,
          shoulder: shoulderLevel
        });
        setRecordedFrames(prev => {
          const next = prev + 1;
          if (next >= 90) {
            finishRecording();
          }
          return next;
        });
      }
    }, 40);

    return () => clearInterval(interval);
  }, [isCameraActive, isRecording]);

  // Start Calibration Procedure
  const handleStartCalibration = () => {
    setIsRecording(false);
    frameBufferRef.current = [];
    setRecordedFrames(0);
    setCountdown(3);

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev === 1) {
          clearInterval(timer);
          setIsRecording(true);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Finish Recording 90 frames
  const finishRecording = () => {
    setIsRecording(false);
    const frames = frameBufferRef.current;
    if (frames.length === 0) return;

    // Calculate averages & std deviations
    const avgNeck = frames.reduce((acc, f) => acc + f.neck, 0) / frames.length;
    const avgBack = frames.reduce((acc, f) => acc + f.back, 0) / frames.length;
    const avgShoulder = frames.reduce((acc, f) => acc + f.shoulder, 0) / frames.length;

    const stdNeck = Math.sqrt(
      frames.reduce((acc, f) => acc + Math.pow(f.neck - avgNeck, 2), 0) / frames.length
    );
    const stdBack = Math.sqrt(
      frames.reduce((acc, f) => acc + Math.pow(f.back - avgBack, 2), 0) / frames.length
    );

    const newBaseline = {
      orientasi,
      tipe_pose: tipePose,
      sudut_leher: Math.round(avgNeck * 100) / 100,
      sudut_punggung: Math.round(avgBack * 100) / 100,
      level_bahu: Math.round(avgShoulder * 10000) / 10000,
      std_leher: Math.max(1.0, Math.round(stdNeck * 1000) / 1000),
      std_punggung: Math.max(1.0, Math.round(stdBack * 1000) / 1000),
      n_frame: frames.length,
    };

    setCollectedBaselines(prev => {
      // Replace if already calibrated this orientation + pose
      const filtered = prev.filter(
        b => !(b.orientasi === orientasi && b.tipe_pose === tipePose)
      );
      return [...filtered, newBaseline];
    });
  };

  // Submit all collected baselines to backend
  const handleSubmitToBackend = async () => {
    if (collectedBaselines.length === 0) {
      alert('Silakan lakukan kalibrasi minimal 1 pose terlebih dahulu.');
      return;
    }

    setIsSubmitting(true);
    const apiUrl = import.meta.env?.VITE_API_URL || 'http://localhost:8042';

    try {
      const payload = {
        nama,
        email,
        pekerjaan,
        data: collectedBaselines,
      };

      const res = await fetch(`${apiUrl}/api/registration/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Gagal menyimpan profil`);
      }

      const data = await res.json();
      setSubmitSuccess(true);
      if (onFinishCalibration) {
        setTimeout(() => onFinishCalibration(data), 1500);
      }
    } catch (err) {
      console.error('Error submitting baselines:', err);
      alert('Gagal menyimpan profil ke server. Periksa koneksi backend dan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-container py-10">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8 text-left">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono mb-3 border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
          <ShieldCheck size={14} />
          <span>STEP 1: PERSONAL POSTURE CALIBRATION</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">
          Registrasi & Kalibrasi Baseline Postur
        </h1>
        <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 leading-relaxed">
          Setiap individu memiliki struktur anatomi dan ergonomi yang unik. Rekam pose postur ideal Anda
          (posisi duduk/berdiri tegak) selama 3 detik untuk membangun model referensi personal di MySQL.
        </p>
      </div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form Setup */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* User Profile Card */}
          <div className="dev-card p-5">
            <h3 className="text-sm font-bold font-mono text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <UserCheck size={16} className="text-blue-500" />
              <span>Profil Pengguna</span>
            </h3>

            <div className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-slate-400 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-blue-500 focus:outline-none"
                  placeholder="Misal: Alex Chandra"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Email (Opsional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-blue-500 focus:outline-none"
                  placeholder="alex@example.com"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Pekerjaan</label>
                <input
                  type="text"
                  value={pekerjaan}
                  onChange={(e) => setPekerjaan(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-blue-500 focus:outline-none"
                  placeholder="Software Engineer / Designer"
                />
              </div>
            </div>
          </div>

          {/* Calibration Config */}
          <div className="dev-card p-5">
            <h3 className="text-sm font-bold font-mono text-slate-400 uppercase tracking-wider mb-4">
              Pilih Orientasi & Tipe Pose
            </h3>

            <div className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-slate-400 mb-1">Sudut Kamera (Orientasi):</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'frontal', label: 'Frontal' },
                    { id: 'lateral_kiri', label: 'Samping Kiri' },
                    { id: 'lateral_kanan', label: 'Samping Kanan' },
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setOrientasi(item.id)}
                      className={`py-2 px-2 rounded-lg border text-center cursor-pointer transition-all ${
                        orientasi === item.id
                          ? 'bg-blue-600/20 border-blue-500 text-blue-400 font-bold'
                          : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Tipe Pose Target:</label>
                <select
                  value={tipePose}
                  onChange={(e) => setTipePose(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="duduk_tegak">Duduk Tegak (Ideal Ergonomis)</option>
                  <option value="duduk_rileks">Duduk Rileks (Posisi Kerja Alami)</option>
                  <option value="berdiri_tegak">Berdiri Tegak (Standing Desk)</option>
                  <option value="berdiri_rileks">Berdiri Rileks</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Video / Canvas & Calibration Trigger */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="dev-card p-5 relative overflow-hidden">
            {/* Top status header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isCameraActive ? 'bg-emerald-500 animate-ping' : 'bg-blue-500'}`}></span>
                <span className="text-xs font-mono text-slate-300">
                  {isCameraActive ? 'LIVE WEBCAM STREAM' : 'SIMULATOR BIOMEKANIKA READY'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {!isCameraActive ? (
                  <button
                    onClick={handleStartCamera}
                    className="text-xs font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Camera size={13} /> Aktifkan Kamera
                  </button>
                ) : (
                  <button
                    onClick={handleStopCamera}
                    className="text-xs font-mono text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
                  >
                    <CameraOff size={13} /> Matikan Kamera
                  </button>
                )}
              </div>
            </div>

            {/* Video + Overlay Viewport */}
            <div className="relative w-full h-72 sm:h-80 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden">
              {/* Actual Video Element */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isCameraActive ? 'block' : 'hidden'}`}
              />

              {/* Skeleton Overlay */}
              <SkeletonOverlay
                landmarks={currentLandmarks}
                width={640}
                height={480}
                status="bagus"
                sudutLeher={liveNeck}
                sudutPunggung={liveBack}
                levelBahu={liveShoulder}
                orientasi={orientasi}
                showAngles={true}
              />

              {/* Camera Permission Overlay */}
              {!isCameraActive && (
                <CameraPermission
                  permission={camPermission}
                  error={camError}
                  onRequestCamera={handleStartCamera}
                />
              )}

              {/* Countdown Overlay */}
              {countdown !== null && (
                <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                  <div className="text-6xl font-extrabold font-mono text-emerald-400 animate-bounce">
                    {countdown}
                  </div>
                  <div className="text-xs font-mono text-slate-300 mt-2">
                    Bersiap... pertahankan pose ergonomis Anda!
                  </div>
                </div>
              )}

              {/* Recording Progress Bar */}
              {isRecording && (
                <div className="absolute top-3 left-4 right-4 z-20">
                  <div className="flex justify-between text-xs font-mono text-emerald-400 mb-1">
                    <span>MEREKAM 90 FRAME ({recordedFrames}/90)</span>
                    <span>{Math.round((recordedFrames / 90) * 100)}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-75"
                      style={{ width: `${(recordedFrames / 90) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Bottom Real-time Telemetry HUD */}
              <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs font-mono z-10">
                <div>
                  Leher: <span className="text-emerald-400 font-bold">{liveNeck}°</span>
                </div>
                <div>
                  Punggung: <span className="text-blue-400 font-bold">{liveBack}°</span>
                </div>
                <div>
                  Bahu: <span className="text-slate-300 font-bold">{liveShoulder}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                disabled={isRecording || countdown !== null}
                onClick={handleStartCalibration}
                className="btn-green flex-1 cursor-pointer"
              >
                <Play size={16} className="fill-current" />
                <span>
                  {isRecording ? 'Sedang Merekam...' : `Mulai Kalibrasi (${orientasi} · ${tipePose})`}
                </span>
              </button>
            </div>
          </div>

          {/* Calibrated Items Summary Table */}
          {collectedBaselines.length > 0 && (
            <div className="dev-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold font-mono text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>{collectedBaselines.length} Pose Siap Disimpan</span>
                </h4>
                <button
                  onClick={handleSubmitToBackend}
                  disabled={isSubmitting}
                  className="btn-primary py-1.5 px-4 text-xs font-mono cursor-pointer"
                >
                  <Save size={14} />
                  <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Profil ke MySQL'}</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2">Orientasi</th>
                      <th className="py-2">Tipe Pose</th>
                      <th className="py-2">Rata2 Leher</th>
                      <th className="py-2">Rata2 Punggung</th>
                      <th className="py-2">Std Leher</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collectedBaselines.map((b, idx) => (
                      <tr key={idx} className="border-b border-slate-800/50">
                        <td className="py-2 font-bold text-blue-400">{b.orientasi}</td>
                        <td className="py-2 text-slate-300">{b.tipe_pose}</td>
                        <td className="py-2 text-emerald-400">{b.sudut_leher}°</td>
                        <td className="py-2 text-blue-300">{b.sudut_punggung}°</td>
                        <td className="py-2 text-slate-400">±{b.std_leher}°</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {submitSuccess && (
                <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    <span>Profil kalibrasi personal berhasil disimpan ke database MySQL!</span>
                  </div>
                  {onFinishCalibration && (
                    <button
                      onClick={() => onFinishCalibration()}
                      className="inline-flex items-center gap-1 font-bold text-white underline cursor-pointer"
                    >
                      Buka Live Monitor <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
