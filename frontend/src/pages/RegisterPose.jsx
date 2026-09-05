import React, { useState, useEffect, useRef } from 'react';
import {
  Camera, CameraOff, CheckCircle2, AlertTriangle, Play,
  RefreshCw, Save, ShieldCheck, ArrowRight, UserCheck, ChevronRight
} from 'lucide-react';
import { SkeletonOverlay } from '../components/SkeletonOverlay';
import { CameraPermission } from '../components/CameraPermission';
import { useCamera } from '../hooks/useCamera';
import { usePoseDetector } from '../hooks/usePoseDetector';
import { Button, Card, Pill, PillIndicator, PillContent, Input, Select, Progress } from '../components/ui';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

function calculateAnglesFromLandmarks(lms) {
  if (!lms || lms.length < 25) return null;
  const ear = lms[7] || lms[8];
  const shoulder = lms[11] || lms[12];
  const hip = lms[23] || lms[24];
  if (!ear || !shoulder || !hip) return null;
  const neckAngle = 180 - Math.atan2(shoulder.y - ear.y, shoulder.x - ear.x) * (180 / Math.PI);
  const backAngle = 180 - Math.atan2(hip.y - shoulder.y, hip.x - shoulder.x) * (180 / Math.PI);
  const shoulderLevel = Math.abs((lms[11]?.y || 0) - (lms[12]?.y || 0));
  return { neck: Math.max(130, Math.min(180, neckAngle)), back: Math.max(130, Math.min(180, backAngle)), shoulder: shoulderLevel };
}

export const RegisterPose = ({ onFinishCalibration }) => {
  const { user } = useAuth();
  const [nama, setNama] = useState(user?.nama || '');
  const [email, setEmail] = useState(user?.email || '');
  const [pekerjaan, setPekerjaan] = useState(user?.pekerjaan || '');
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

      // If recording with live camera, buffer real landmarks
      if (isRecording) {
        const angles = calculateAnglesFromLandmarks(realLandmarks);
        if (angles) {
          frameBufferRef.current.push(angles);
          setRecordedFrames(prev => prev + 1);
        }
      }
    }
  }, [isCameraActive, realLandmarks, isRecording]);

  // Finish recording when recordedFrames reaches 90
  useEffect(() => {
    if (recordedFrames >= 90) finishRecording();
  }, [recordedFrames]);

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
        setRecordedFrames(prev => prev + 1);
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
    const apiUrl = import.meta.env?.VITE_API_URL || '';

    try {
      const payload = {
        user_id: user?.user_id || undefined,
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-10">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8 text-left">
        <Pill variant="success" size="md" className="mb-3 font-mono">
          <PillIndicator variant="success" pulse={false} />
          <PillContent>STEP 1: PERSONAL POSTURE CALIBRATION</PillContent>
        </Pill>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2 text-slate-900 dark:text-white">
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
          <Card className="p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <UserCheck size={16} className="text-blue-500" />
              <span>Profil Pengguna</span>
            </h3>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1.5">Nama Lengkap</label>
                <Input
                  type="text"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Misal: Alex Chandra"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1.5">Email (Opsional)</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@example.com"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1.5">Pekerjaan</label>
                <Input
                  type="text"
                  value={pekerjaan}
                  onChange={(e) => setPekerjaan(e.target.value)}
                  placeholder="Software Engineer / Designer"
                />
              </div>
            </div>
          </Card>

          {/* Calibration Config */}
          <Card className="p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">
              Pilih Orientasi & Tipe Pose
            </h3>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1.5">Sudut Kamera (Orientasi):</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'frontal', label: 'Frontal' },
                    { id: 'lateral_kiri', label: 'Samping Kiri' },
                    { id: 'lateral_kanan', label: 'Samping Kanan' },
                  ].map(item => (
                    <Button
                      key={item.id}
                      type="button"
                      variant={orientasi === item.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setOrientasi(item.id)}
                      className={cn(
                        "text-xs text-center py-2 px-1 h-auto",
                        orientasi === item.id && "bg-blue-600 text-white font-bold"
                      )}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1.5">Tipe Pose Target:</label>
                <Select
                  value={tipePose}
                  onChange={(e) => setTipePose(e.target.value)}
                >
                  <option value="duduk_tegak">Duduk Tegak (Ideal Ergonomis)</option>
                  <option value="duduk_rileks">Duduk Rileks (Posisi Kerja Alami)</option>
                  <option value="berdiri_tegak">Berdiri Tegak (Standing Desk)</option>
                  <option value="berdiri_rileks">Berdiri Rileks</option>
                </Select>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Live Video / Canvas & Calibration Trigger */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <Card className="p-5 relative overflow-hidden bg-slate-950 border-slate-800 shadow-lg">
            {/* Top status header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <Pill variant={isCameraActive ? "success" : "info"} size="sm">
                <PillIndicator variant={isCameraActive ? "success" : "info"} pulse={isCameraActive} />
                <PillContent>{isCameraActive ? 'LIVE WEBCAM STREAM' : 'SIMULATOR BIOMEKANIKA READY'}</PillContent>
              </Pill>

              <div className="flex items-center gap-2">
                {!isCameraActive ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleStartCamera}
                    className="text-xs font-mono text-emerald-400 hover:text-emerald-300 hover:bg-slate-900 flex items-center gap-1.5 h-auto py-1"
                  >
                    <Camera size={13} /> Aktifkan Kamera
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleStopCamera}
                    className="text-xs font-mono text-rose-400 hover:text-rose-300 hover:bg-slate-900 flex items-center gap-1.5 h-auto py-1"
                  >
                    <CameraOff size={13} /> Matikan Kamera
                  </Button>
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
                  <div className="flex justify-between text-xs font-mono text-emerald-400 mb-1.5">
                    <span>MEREKAM 90 FRAME ({recordedFrames}/90)</span>
                    <span>{Math.round((recordedFrames / 90) * 100)}%</span>
                  </div>
                  <Progress
                    value={(recordedFrames / 90) * 100}
                    variant="success"
                    className="h-2 bg-slate-800"
                  />
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
              <Button
                type="button"
                variant="success"
                size="lg"
                disabled={isRecording || countdown !== null}
                onClick={handleStartCalibration}
                className="flex-1"
              >
                <Play size={16} className="fill-current" />
                <span>
                  {isRecording ? 'Sedang Merekam...' : `Mulai Kalibrasi (${orientasi} · ${tipePose})`}
                </span>
              </Button>
            </div>
          </Card>

          {/* Calibrated Items Summary Table */}
          {collectedBaselines.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>{collectedBaselines.length} Pose Siap Disimpan</span>
                </h4>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSubmitToBackend}
                  disabled={isSubmitting}
                  className="text-xs font-semibold"
                >
                  <Save size={14} />
                  <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Profil Kalibrasi'}</span>
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                      <th className="py-2">Orientasi</th>
                      <th className="py-2">Tipe Pose</th>
                      <th className="py-2">Rata2 Leher</th>
                      <th className="py-2">Rata2 Punggung</th>
                      <th className="py-2">Std Leher</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collectedBaselines.map((b, idx) => (
                      <tr key={idx} className="border-b border-slate-100 dark:border-slate-800/60">
                        <td className="py-2.5 font-bold text-blue-600 dark:text-blue-400">{b.orientasi}</td>
                        <td className="py-2.5 text-slate-900 dark:text-slate-100">{b.tipe_pose}</td>
                        <td className="py-2.5 text-emerald-600 dark:text-emerald-400 font-bold">{b.sudut_leher}°</td>
                        <td className="py-2.5 text-blue-600 dark:text-blue-300 font-bold">{b.sudut_punggung}°</td>
                        <td className="py-2.5 text-slate-500 dark:text-slate-400">±{b.std_leher}°</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {submitSuccess && (
                <div className="mt-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <span>Profil kalibrasi personal berhasil disimpan ke sistem!</span>
                  </div>
                  {onFinishCalibration && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onFinishCalibration()}
                      className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 p-1 h-auto"
                    >
                      Buka Live Monitor <ChevronRight size={14} />
                    </Button>
                  )}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

