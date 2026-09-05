import React, { useState } from 'react';
import {
  Shield, Cpu, Play,
  Sparkles, ChevronRight, Copy, Check, HeartPulse, RefreshCw
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
  const [copied, setCopied] = useState<boolean>(false);
  const [activeCodeTab, setActiveCodeTab] = useState<'ws' | 'curl' | 'python'>('ws');

  // Compute live demo score
  const neckDev = Math.abs(demoNeck - 165);
  const backDev = Math.abs(demoBack - 170);
  const rawScore = Math.max(0, 100 - (neckDev * 3.5 + backDev * 2.2));
  const score = Math.round(rawScore);
  const status = score >= 85 ? 'bagus' : score >= 60 ? 'ringan' : 'buruk';

  const previewLandmarks = generateSimulatedLandmarks(demoNeck, demoBack);

  const codeSnippets = {
    ws: `// Connect to GenPosFit live ergonomics WebSocket
const socket = new WebSocket('ws://localhost:8042/api/monitoring/ws/1');

socket.onopen = () => {
  console.log('[GenPosFit] Stream ready @ 30 FPS');
};

socket.onmessage = (event) => {
  const telemetry = JSON.parse(event.data);
  // telemetry: { sudut_leher: 164.2, skor_deviasi: 94.5, status: 'bagus' }
  updateHUD(telemetry);
};`,
    curl: `# Evaluasi snapshot 33 landmark via HTTP endpoint
curl -X POST http://localhost:8042/api/monitoring/evaluate \\
  -H "Content-Type: application/json" \\
  -d '{
    "user_id": 1,
    "landmarks": [{"x": 0.49, "y": 0.22, "visibility": 0.98}, ...],
    "tipe_pose": "duduk_tegak",
    "simpan_ke_db": true
  }'`,
    python: `import websockets, json, asyncio

async def stream_posture():
    uri = "ws://localhost:8042/api/monitoring/ws/1"
    async with websockets.connect(uri) as ws:
        while True:
            # Kirim koordinat 33 landmarks dari kamera/model
            await ws.send(json.dumps({"landmarks": current_landmarks}))
            response = await ws.recv()
            print("Ergonomic Status:", json.loads(response)["status"])

asyncio.run(stream_posture())`,
  };

  const copyCode = () => {
    navigator.clipboard.writeText(codeSnippets[activeCodeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full bg-dev-grid pb-20">
      {/* Top Banner Notice */}
      <div className="border-b py-2 text-center text-xs font-mono"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}>
        <span className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Docker Compose environment ready: FastAPI (8042) · React (3042) · MySQL (3348) · PhpMyAdmin (8122)
        </span>
      </div>

      {/* Hero Section */}
      <section className="app-container pt-12 sm:pt-20 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Heading & CTAs */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">
            {/* Tag / Category Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono mb-6 border"
              style={{
                backgroundColor: 'rgba(37, 99, 235, 0.08)',
                borderColor: 'rgba(37, 99, 235, 0.3)',
                color: 'var(--accent-blue)',
              }}>
              <Sparkles size={13} className="text-blue-500" />
              <span>BIOMECHANICAL ERGONOMICS & HEALTHCARE ENGINE</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.15] mb-6 max-w-xl">
              Empower healthier spines with{' '}
              <span className="bg-gradient-to-r from-blue-500 via-emerald-400 to-teal-500 bg-clip-text text-transparent">
                developer-grade
              </span>{' '}
              posture intelligence.
            </h1>

            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed mb-8 max-w-2xl">
              <strong>GenPosFit</strong> computes real-time cervical and thoracic spine angles directly in your browser.
              100% video privacy with edge landmark extraction, personalized baseline calibration, and automated
              physical therapy routines for desk workers and developers.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                onClick={() => setActiveTab('monitor')}
                className="btn-primary whitespace-nowrap"
              >
                <Play size={16} className="fill-current" />
                <span>Launch Live Monitor</span>
                <ChevronRight size={16} />
              </button>

              <button
                onClick={() => setActiveTab('register')}
                className="btn-outline whitespace-nowrap"
              >
                <Shield size={16} className="text-emerald-500" />
                <span>Calibrate Personal Baseline</span>
              </button>

              <button
                onClick={() => setActiveTab('exercises')}
                className="btn-outline whitespace-nowrap text-emerald-500 border-emerald-500/30"
              >
                <HeartPulse size={16} />
                <span>Therapy Stretches</span>
              </button>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-3 gap-4 sm:gap-6 pt-10 mt-10 border-t w-full"
              style={{ borderColor: 'var(--border)' }}>
              <div>
                <div className="text-2xl font-bold font-mono text-blue-500">30 FPS</div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">Real-time Biometrics</div>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-emerald-500">0.1° Acc</div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">Sub-degree Precision</div>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-slate-700 dark:text-slate-200">100% Edge</div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">Video Stays Local</div>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Biomechanical Simulator */}
          <div className="lg:col-span-5">
            <div className="dev-card p-4 relative overflow-hidden"
              style={{
                boxShadow: status === 'bagus' ? 'var(--glow-green)' : status === 'ringan' ? '0 0 30px rgba(245, 158, 11, 0.2)' : '0 0 30px rgba(239, 68, 68, 0.25)'
              }}>
              {/* Header Bar */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b"
                style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2">
                  <div className="traffic-dots">
                    <span className="traffic-dot dot-red"></span>
                    <span className="traffic-dot dot-yellow"></span>
                    <span className="traffic-dot dot-green"></span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">interactive-posture-preview.sim</span>
                </div>
                <div className={`status-pill status-pill-${status}`}>
                  <span>{status}</span> · <span>{score}%</span>
                </div>
              </div>

              {/* Canvas Preview Area */}
              <div className="relative w-full h-64 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-center overflow-hidden">
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
                <div className="absolute bottom-2 left-3 text-[11px] font-mono text-slate-400 bg-slate-900/90 px-2 py-1 rounded border border-slate-800">
                  Leher: <span className="text-emerald-400 font-bold">{demoNeck}°</span> | Punggung: <span className="text-blue-400 font-bold">{demoBack}°</span>
                </div>
              </div>

              {/* Interactive Sliders */}
              <div className="mt-4 space-y-3 font-mono text-xs">
                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>Forward Head / Sudut Leher:</span>
                    <span className="text-emerald-400 font-bold">{demoNeck}° (Baseline: 165°)</span>
                  </div>
                  <input
                    type="range"
                    min="135"
                    max="175"
                    step="1"
                    value={demoNeck}
                    onChange={(e) => setDemoNeck(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>Trunk Angle / Sudut Punggung:</span>
                    <span className="text-blue-400 font-bold">{demoBack}° (Baseline: 170°)</span>
                  </div>
                  <input
                    type="range"
                    min="140"
                    max="178"
                    step="1"
                    value={demoBack}
                    onChange={(e) => setDemoBack(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>

              {/* Reset to Ergonomic State */}
              <div className="mt-4 pt-3 border-t flex justify-between items-center"
                style={{ borderColor: 'var(--border)' }}>
                <span className="text-[11px] text-slate-400">Geser slider untuk simulasi deviasi</span>
                <button
                  type="button"
                  onClick={() => { setDemoNeck(165); setDemoBack(172); }}
                  className="text-xs font-mono text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw size={12} /> Reset Kalibrasi
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Developer API & Architecture Section */}
      <section className="app-container py-16 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            Built for seamless developer workflows
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base">
            Integrate biomechanical telemetry into your own services via WebSocket or HTTP API.
            Ready with Docker Compose, hot reload, and automated MySQL migrations.
          </p>
        </div>

        {/* Code Tabs & Snippet Terminal */}
        <div className="max-w-4xl mx-auto">
          <div className="dev-terminal">
            <div className="dev-terminal-header">
              <div className="flex items-center gap-4">
                <div className="traffic-dots">
                  <span className="traffic-dot dot-red"></span>
                  <span className="traffic-dot dot-yellow"></span>
                  <span className="traffic-dot dot-green"></span>
                </div>
                {/* Tabs */}
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => setActiveCodeTab('ws')}
                    className={`px-3 py-1 rounded text-xs font-mono cursor-pointer transition-colors ${
                      activeCodeTab === 'ws' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    WebSocket (/ws/1)
                  </button>
                  <button
                    onClick={() => setActiveCodeTab('curl')}
                    className={`px-3 py-1 rounded text-xs font-mono cursor-pointer transition-colors ${
                      activeCodeTab === 'curl' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    cURL (HTTP POST)
                  </button>
                  <button
                    onClick={() => setActiveCodeTab('python')}
                    className={`px-3 py-1 rounded text-xs font-mono cursor-pointer transition-colors ${
                      activeCodeTab === 'python' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Python SDK
                  </button>
                </div>
              </div>

              {/* Copy Button */}
              <button
                onClick={copyCode}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2 py-1 rounded border border-slate-700/60 cursor-pointer"
              >
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Code Output */}
            <div className="p-4 text-xs font-mono leading-relaxed overflow-x-auto text-slate-300 bg-[#090d16]">
              <pre>
                <code>{codeSnippets[activeCodeTab]}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid: Biomechanics & Healthcare */}
      <section className="app-container py-16 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="dev-card p-6">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 mb-4">
              <Cpu size={20} />
            </div>
            <h3 className="text-lg font-bold mb-2">33-Point MediaPipe Extraction</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Full kinematic extraction running locally via WebAssembly & GPU. Tracks cervical, thoracic, and shoulder symmetry in real-time.
            </p>
          </div>

          <div className="dev-card p-6">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mb-4">
              <Shield size={20} />
            </div>
            <h3 className="text-lg font-bold mb-2">Personalized Baseline Calibration</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Calibrates standard deviation and comfortable anatomical posture for each user instead of forcing rigid one-size-fits-all angles.
            </p>
          </div>

          <div className="dev-card p-6">
            <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-500 mb-4">
              <HeartPulse size={20} />
            </div>
            <h3 className="text-lg font-bold mb-2">Targeted Therapy & Stretches</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Integrated corrective exercises (Chin Tuck, Shoulder Squeeze, Wall Angel) with live repetition counting and muscle activation advice.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
