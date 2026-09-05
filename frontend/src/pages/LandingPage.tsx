import React, { useState } from 'react';
import {
  Shield, Cpu, Play,
  Sparkles, ChevronRight, HeartPulse, RefreshCw
} from 'lucide-react';
import { type PageTab } from '../components/Navbar';
import { SkeletonOverlay } from '../components/SkeletonOverlay';

interface LandingPageProps {
  setActiveTab: (tab: PageTab) => void;
}

// Synthetic preview landmarks for interactive demo in landing page hero
function generateSimulatedLandmarks(neckAngle: number, backAngle: number) {
  // Center coordinates normalized [0, 1]
  const shoulderX = 0.5;
  const shoulderY = 0.42;

  // Neck tilt based on neckAngle (165 deg is vertical)
  const neckRad = ((180 - neckAngle) * Math.PI) / 180;
  const earX = shoulderX - Math.sin(neckRad) * 0.15;
  const earY = shoulderY - Math.cos(neckRad) * 0.15;
  const noseX = earX - 0.05;
  const noseY = earY + 0.02;

  // Back tilt based on backAngle (170 deg is upright)
  const backRad = ((180 - backAngle) * Math.PI) / 180;
  const hipX = shoulderX + Math.sin(backRad) * 0.28;
  const hipY = shoulderY + Math.cos(backRad) * 0.28;
  const kneeX = hipX - 0.02;
  const kneeY = hipY + 0.22;

  const list = [];
  for (let i = 0; i < 33; i++) {
    list.push({ x: 0.5, y: 0.5, z: 0, visibility: 0.8 });
  }

  // Key joints
  list[0] = { x: noseX, y: noseY, z: 0, visibility: 0.95 }; // Nose
  list[7] = { x: earX, y: earY, z: 0, visibility: 0.95 }; // Left ear
  list[8] = { x: earX + 0.04, y: earY, z: 0, visibility: 0.95 }; // Right ear
  list[11] = { x: shoulderX - 0.06, y: shoulderY, z: 0, visibility: 0.95 }; // L shoulder
  list[12] = { x: shoulderX + 0.06, y: shoulderY, z: 0, visibility: 0.95 }; // R shoulder
  list[13] = { x: shoulderX - 0.08, y: shoulderY + 0.15, z: 0, visibility: 0.9 }; // L elbow
  list[14] = { x: shoulderX + 0.08, y: shoulderY + 0.15, z: 0, visibility: 0.9 }; // R elbow
  list[15] = { x: shoulderX - 0.1, y: shoulderY + 0.28, z: 0, visibility: 0.9 }; // L wrist
  list[16] = { x: shoulderX + 0.1, y: shoulderY + 0.28, z: 0, visibility: 0.9 }; // R wrist
  list[23] = { x: hipX - 0.05, y: hipY, z: 0, visibility: 0.95 }; // L hip
  list[24] = { x: hipX + 0.05, y: hipY, z: 0, visibility: 0.95 }; // R hip
  list[25] = { x: kneeX - 0.04, y: kneeY, z: 0, visibility: 0.9 }; // L knee
  list[26] = { x: kneeX + 0.04, y: kneeY, z: 0, visibility: 0.9 }; // R knee
  list[27] = { x: kneeX - 0.04, y: kneeY + 0.18, z: 0, visibility: 0.9 }; // L ankle
  list[28] = { x: kneeX + 0.04, y: kneeY + 0.18, z: 0, visibility: 0.9 }; // R ankle

  return list;
}

export const LandingPage: React.FC<LandingPageProps> = ({ setActiveTab }) => {
  const [demoNeck, setDemoNeck] = useState<number>(165);
  const [demoBack, setDemoBack] = useState<number>(172);

  // Compute live demo score
  const neckDev = Math.abs(demoNeck - 165);
  const backDev = Math.abs(demoBack - 170);
  const rawScore = Math.max(0, 100 - (neckDev * 3.5 + backDev * 2.2));
  const score = Math.round(rawScore);
  const status = score >= 85 ? 'bagus' : score >= 60 ? 'ringan' : 'buruk';

  const previewLandmarks = generateSimulatedLandmarks(demoNeck, demoBack);

  return (
    <div className="w-full pb-16">
      {/* Hero Section */}
      <section className="app-container pt-10 sm:pt-16 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Heading & CTAs */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">
            {/* Tag / Category Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-6 border shadow-xs"
              style={{
                backgroundColor: 'rgba(37, 99, 235, 0.08)',
                borderColor: 'rgba(37, 99, 235, 0.3)',
                color: 'var(--accent-blue)',
              }}>
              <Sparkles size={14} className="text-blue-600 dark:text-blue-400" />
              <span>SISTEM MONITORING BIOMEKANIKA & KESEHATAN POSTUR</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.15] mb-5 max-w-xl text-slate-900 dark:text-white">
              Optimalkan postur sehat dengan{' '}
              <span className="bg-gradient-to-r from-blue-600 via-emerald-500 to-teal-500 bg-clip-text text-transparent">
                analisis biomekanika AI
              </span>
              .
            </h1>

            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed mb-8 max-w-2xl font-normal">
              <strong>GenPosFit</strong> menghitung sudut servikal dan tulang punggung secara real-time langsung di browser Anda.
              100% privasi terlindungi dengan ekstraksi landmark lokal, kalibrasi baseline ergonomis personal, serta latihan terapi korektif otomatis.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <button
                onClick={() => setActiveTab('monitor')}
                className="btn-primary whitespace-nowrap"
              >
                <Play size={16} className="fill-current" />
                <span>Mulai Live Monitor</span>
                <ChevronRight size={16} />
              </button>

              <button
                onClick={() => setActiveTab('register')}
                className="btn-outline whitespace-nowrap hover:border-emerald-500/50"
              >
                <Shield size={16} className="text-emerald-500" />
                <span>Kalibrasi Baseline</span>
              </button>

              <button
                onClick={() => setActiveTab('exercises')}
                className="btn-outline whitespace-nowrap text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
              >
                <HeartPulse size={16} />
                <span>Latihan Terapi</span>
              </button>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-3 gap-4 sm:gap-8 pt-8 mt-8 border-t w-full"
              style={{ borderColor: 'var(--border)' }}>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono text-blue-600 dark:text-blue-400">30 FPS</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Biometrik Real-time</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">0.1°</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Presisi Sub-derajat</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-800 dark:text-slate-200">100%</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Privasi Edge Lokal</div>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Biomechanical Simulator */}
          <div className="lg:col-span-5">
            <div className="app-card p-5 relative overflow-hidden"
              style={{
                boxShadow: status === 'bagus' ? 'var(--glow-green)' : status === 'ringan' ? '0 4px 20px rgba(245, 158, 11, 0.15)' : '0 4px 20px rgba(239, 68, 68, 0.2)'
              }}>
              {/* Header Bar */}
              <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b"
                style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Simulasi Biomekanika Interaktif</span>
                </div>
                <div className={`status-pill status-pill-${status}`}>
                  <span>{status}</span> · <span>{score}%</span>
                </div>
              </div>

              {/* Canvas Preview Area */}
              <div className="relative w-full h-64 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-center overflow-hidden shadow-inner">
                {/* Background Grid inside canvas */}
                <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px]"></div>

                {/* Skeleton Canvas Overlay */}
                <SkeletonOverlay
                  landmarks={previewLandmarks}
                  width={380}
                  height={260}
                  status={status}
                  sudutLeher={demoNeck}
                  sudutPunggung={demoBack}
                  orientasi="lateral_kiri"
                  showAngles={true}
                />

                {/* Corner Status HUD */}
                <div className="absolute bottom-2.5 left-3 text-[11px] font-mono text-slate-300 bg-slate-900/90 px-2.5 py-1 rounded-md border border-slate-800 backdrop-blur-xs">
                  Leher: <span className="text-emerald-400 font-bold">{demoNeck}°</span> | Punggung: <span className="text-blue-400 font-bold">{demoBack}°</span>
                </div>
              </div>

              {/* Interactive Sliders */}
              <div className="mt-4 space-y-3.5 text-xs">
                <div>
                  <div className="flex justify-between text-slate-700 dark:text-slate-300 font-medium mb-1.5">
                    <span>Forward Head / Sudut Leher:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">{demoNeck}° <span className="text-slate-400 font-normal">(Base: 165°)</span></span>
                  </div>
                  <input
                    type="range"
                    min="135"
                    max="175"
                    step="1"
                    value={demoNeck}
                    onChange={(e) => setDemoNeck(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-700 dark:text-slate-300 font-medium mb-1.5">
                    <span>Trunk Angle / Sudut Punggung:</span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold font-mono">{demoBack}° <span className="text-slate-400 font-normal">(Base: 170°)</span></span>
                  </div>
                  <input
                    type="range"
                    min="140"
                    max="178"
                    step="1"
                    value={demoBack}
                    onChange={(e) => setDemoBack(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>

              {/* Reset to Ergonomic State */}
              <div className="mt-4 pt-3 border-t flex justify-between items-center text-xs"
                style={{ borderColor: 'var(--border)' }}>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Geser slider untuk simulasi deviasi postur</span>
                <button
                  type="button"
                  onClick={() => { setDemoNeck(165); setDemoBack(172); }}
                  className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RefreshCw size={12} /> Reset Kalibrasi
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid: Biomechanics & Healthcare */}
      <section className="app-container py-12 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3 text-slate-900 dark:text-white">
            Fitur Unggulan Ergonomi Modern
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base leading-relaxed">
            Teknologi computer vision berstandar medis yang dirancang khusus untuk kenyamanan dan kesehatan tulang belakang pekerja meja.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="app-card p-6">
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4 shadow-xs">
              <Cpu size={22} />
            </div>
            <h3 className="text-base font-bold mb-2 text-slate-900 dark:text-white">33-Point MediaPipe Extraction</h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Ekstraksi kinematik lengkap secara real-time via WebAssembly & akselerasi GPU. Melacak sudut servikal, thoraks, dan simetri bahu tanpa latensi.
            </p>
          </div>

          <div className="app-card p-6">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4 shadow-xs">
              <Shield size={22} />
            </div>
            <h3 className="text-base font-bold mb-2 text-slate-900 dark:text-white">Kalibrasi Baseline Personal</h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Menyesuaikan standar deviasi berdasarkan anatomi unik dan kenyamanan setiap pengguna, bukan memaksakan standar kaku satu ukuran untuk semua.
            </p>
          </div>

          <div className="app-card p-6">
            <div className="w-11 h-11 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400 mb-4 shadow-xs">
              <HeartPulse size={22} />
            </div>
            <h3 className="text-base font-bold mb-2 text-slate-900 dark:text-white">Terapi & Peregangan Terarah</h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Program latihan korektif terintegrasi (Chin Tuck, Shoulder Squeeze, Wall Angel) dengan panduan repetisi dan aktivasi kelompok otot target.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
