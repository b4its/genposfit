import React, { useState } from 'react';
import {
  Shield, Cpu, Play,
  Sparkles, ChevronRight, HeartPulse, RefreshCw,
  Dumbbell, Users, Trophy, Coins, ArrowRight, Camera
} from 'lucide-react';
import { type PageTab } from '../components/Navbar';
import { SkeletonOverlay } from '../components/SkeletonOverlay';
import { Button, Card, Pill, PillIndicator, PillContent } from '@/components/ui';
import { cn } from '@/lib/utils';

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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pt-10 sm:pt-16 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Heading & CTAs */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">
            {/* Tag / Category Badge with Kibo UI Pill */}
            <Pill variant="info" size="md" className="mb-6 font-semibold shadow-xs">
              <Sparkles size={14} className="text-blue-600 dark:text-blue-400" />
              <PillContent>SISTEM MONITORING BIOMEKANIKA & KESEHATAN POSTUR</PillContent>
            </Pill>

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

            {/* CTA Buttons with Kibo UI Button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <Button
                variant="default"
                size="lg"
                onClick={() => setActiveTab('monitor')}
                className="whitespace-nowrap shadow-md shadow-blue-500/20"
              >
                <Play size={16} className="fill-current" />
                <span>Mulai Live Monitor</span>
                <ChevronRight size={16} />
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={() => setActiveTab('register')}
                className="whitespace-nowrap hover:border-emerald-500/50"
              >
                <Shield size={16} className="text-emerald-500" />
                <span>Kalibrasi Baseline</span>
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={() => setActiveTab('exercises')}
                className="whitespace-nowrap text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
              >
                <HeartPulse size={16} />
                <span>Latihan Terapi</span>
              </Button>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-3 gap-4 sm:gap-8 pt-8 mt-8 border-t border-slate-200 dark:border-slate-800 w-full">
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono text-blue-600 dark:text-blue-400">30 FPS</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Biometrik Real-time</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">0.1°</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Presisi Sub-derajat</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900 dark:text-white">100%</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Privasi Edge Lokal</div>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Biomechanical Simulator */}
          <div className="lg:col-span-5">
            <Card
              className={cn(
                "p-5 relative overflow-hidden transition-all duration-300",
                status === 'bagus'
                  ? 'border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                  : status === 'ringan'
                  ? 'border-amber-500/40 shadow-lg shadow-amber-500/10'
                  : 'border-rose-500/40 shadow-lg shadow-rose-500/10'
              )}
            >
              {/* Header Bar */}
              <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white">Simulasi Biomekanika Interaktif</span>
                </div>
                <Pill
                  variant={status === 'bagus' ? 'success' : status === 'ringan' ? 'warning' : 'destructive'}
                  size="sm"
                >
                  <PillIndicator variant={status === 'bagus' ? 'success' : status === 'ringan' ? 'warning' : 'destructive'} />
                  <PillContent className="capitalize font-semibold">{status} · {score}%</PillContent>
                </Pill>
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
                  <div className="flex justify-between text-slate-700 dark:text-slate-200 font-medium mb-1.5">
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
                  <div className="flex justify-between text-slate-700 dark:text-slate-200 font-medium mb-1.5">
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
              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Geser slider untuk simulasi deviasi postur</span>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => { setDemoNeck(165); setDemoBack(172); }}
                  className="h-auto p-0 text-blue-600 dark:text-blue-400 hover:text-blue-500 hover:bg-transparent flex items-center gap-1 font-medium text-xs"
                >
                  <RefreshCw size={12} /> Reset Kalibrasi
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Feature Grid: 6 Pillars of Innovation */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-14 border-t border-slate-200 dark:border-slate-800">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <Pill variant="info" size="sm" className="mb-3 font-semibold">
            <Sparkles size={13} />
            <PillContent>EKOSISTEM KESEHATAN TERPADU</PillContent>
          </Pill>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3 text-slate-900 dark:text-white">
            Pilar Keunggulan Biomekanika & AI
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base leading-relaxed">
            Teknologi computer vision berstandar medis, gamifikasi battle interaktif, dan insentif Web3 yang dirancang untuk produktivitas sehat jangka panjang.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card hoverEffect className="p-6 flex flex-col justify-between border-slate-200/80 dark:border-slate-800">
            <div>
              <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4 shadow-xs">
                <Cpu size={22} />
              </div>
              <h3 className="text-base font-bold mb-2 text-slate-900 dark:text-white">33-Point MediaPipe Extraction</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Ekstraksi kinematik lengkap secara real-time via WebAssembly & akselerasi GPU. Melacak sudut servikal, thoraks, dan simetri bahu tanpa latensi server.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('monitor')}
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Mulai Monitoring <ArrowRight size={13} />
            </button>
          </Card>

          <Card hoverEffect className="p-6 flex flex-col justify-between border-slate-200/80 dark:border-slate-800">
            <div>
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4 shadow-xs">
                <Shield size={22} />
              </div>
              <h3 className="text-base font-bold mb-2 text-slate-900 dark:text-white">Kalibrasi Baseline Personal</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Menyesuaikan standar deviasi berdasarkan anatomi unik dan kenyamanan setiap pengguna, bukan memaksakan standar kaku satu ukuran untuk semua.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('register')}
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Kalibrasi Sekarang <ArrowRight size={13} />
            </button>
          </Card>

          <Card hoverEffect className="p-6 flex flex-col justify-between border-slate-200/80 dark:border-slate-800">
            <div>
              <div className="w-11 h-11 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-4 shadow-xs">
                <Dumbbell size={22} />
              </div>
              <h3 className="text-base font-bold mb-2 text-slate-900 dark:text-white">Multi-Step Pose Sequencing</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Siklus latihan multi-fase dengan ghost skeleton panduan pelatih. Repetisi diverifikasi otomatis dan dilengkapi reaksi ekspresi maskot skor.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('exercises')}
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
            >
              Buka Latihan Terapi <ArrowRight size={13} />
            </button>
          </Card>

          <Card hoverEffect className="p-6 flex flex-col justify-between border-slate-200/80 dark:border-slate-800">
            <div>
              <div className="w-11 h-11 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400 mb-4 shadow-xs">
                <HeartPulse size={22} />
              </div>
              <h3 className="text-base font-bold mb-2 text-slate-900 dark:text-white">Bank 32 Variasi Gerakan</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Katalog komprehensif templat terapi biomekanika ergonomis untuk servikal, torakal, lumbar, dan ekstremitas dengan fitur batch-add admin.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('exercises')}
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
            >
              Lihat Katalog Gerakan <ArrowRight size={13} />
            </button>
          </Card>

          <Card hoverEffect className="p-6 flex flex-col justify-between border-slate-200/80 dark:border-slate-800">
            <div>
              <div className="w-11 h-11 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-4 shadow-xs">
                <Users size={22} />
              </div>
              <h3 className="text-base font-bold mb-2 text-slate-900 dark:text-white">Multiplayer Battle Room</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Tanding postur real-time 1v1 berbasis kode room dengan skeleton rigging interaktif dan seleksi persona maskot ceria (Green, Blue, Red, Black).
              </p>
            </div>
            <button
              onClick={() => setActiveTab('multiplayer')}
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
            >
              Masuk Multiplayer <ArrowRight size={13} />
            </button>
          </Card>

          <Card hoverEffect className="p-6 flex flex-col justify-between border-slate-200/80 dark:border-slate-800">
            <div>
              <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4 shadow-xs">
                <Coins size={22} />
              </div>
              <h3 className="text-base font-bold mb-2 text-slate-900 dark:text-white">Web3 GPC Rewards (Sepolia)</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Token ERC-1155 on-chain untuk peserta berprestasi. Dilengkapi fallback Dompet Komunitas Bersama tanpa kewajiban memasang ekstensi MetaMask.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('misi')}
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
            >
              Klaim & Lihat Klasemen <ArrowRight size={13} />
            </button>
          </Card>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pt-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-8 sm:p-12 text-white shadow-xl shadow-blue-500/15">
          <div className="relative z-10 max-w-2xl">
            <h3 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-4 leading-tight">
              Siap Menjaga Postur Ergonomis Setiap Hari?
            </h3>
            <p className="text-blue-100 text-sm sm:text-base mb-8 leading-relaxed">
              Mulai pemantauan real-time langsung melalui browser Anda tanpa perlu memasang aplikasi tambahan. Privasi 100% aman di perangkat lokal.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                size="lg"
                onClick={() => setActiveTab('monitor')}
                className="bg-white text-blue-900 hover:bg-blue-50 font-bold text-sm shadow-md"
              >
                <Camera size={16} /> Buka Live Monitor
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => setActiveTab('multiplayer')}
                className="border-white/40 text-white hover:bg-white/10 font-semibold text-sm"
              >
                <Users size={16} /> Mode Multiplayer
              </Button>
            </div>
          </div>
          {/* Subtle decorative background circles */}
          <div className="absolute -right-16 -bottom-16 w-80 h-80 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute right-32 top-0 w-60 h-60 rounded-full bg-emerald-400/15 blur-xl pointer-events-none" />
        </div>
      </section>
    </div>
  );
};

