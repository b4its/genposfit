import React, { useRef, useEffect, useState } from 'react';
import {
  Eye, EyeOff, RotateCcw, RefreshCw, Sliders
} from 'lucide-react';
import { SkeletonOverlay, type Landmark } from '../components/SkeletonOverlay';
import { Button, Card, Pill, PillIndicator, PillContent } from '../components/ui';
import { cn } from '../lib/utils';

function generateTpostLandmarks(
  armAngle: number,
  neckTilt: number,
  hipShift: number,
): Landmark[] {
  const lms: Landmark[] = [];
  for (let i = 0; i < 33; i++) {
    lms.push({ x: 0.5, y: 0.5, z: 0, visibility: 0.85 });
  }

  const armRad = (armAngle * Math.PI) / 180;
  const neckRad = ((180 - neckTilt) * Math.PI) / 180;

  const cx = 0.5 + hipShift;
  const shoulderY = 0.30;
  const earX = cx - Math.sin(neckRad) * 0.06;
  const earY = shoulderY - Math.cos(neckRad) * 0.06;

  lms[0] = { x: earX - 0.03, y: earY + 0.02, visibility: 0.95 };
  lms[1] = { x: cx - 0.02, y: earY - 0.01, visibility: 0.9 };
  lms[2] = { x: cx - 0.015, y: earY, visibility: 0.9 };
  lms[3] = { x: cx - 0.025, y: earY - 0.005, visibility: 0.9 };
  lms[4] = { x: cx + 0.02, y: earY - 0.01, visibility: 0.9 };
  lms[5] = { x: cx + 0.015, y: earY, visibility: 0.9 };
  lms[6] = { x: cx + 0.025, y: earY - 0.005, visibility: 0.9 };
  lms[7] = { x: earX, y: earY, visibility: 0.95 };
  lms[8] = { x: earX + 0.06, y: earY, visibility: 0.95 };
  lms[9] = { x: cx - 0.015, y: earY + 0.03, visibility: 0.9 };
  lms[10] = { x: cx + 0.015, y: earY + 0.03, visibility: 0.9 };

  const armSpan = 0.22;
  const elbowX = armSpan * Math.cos(armRad);
  const elbowY = armSpan * Math.sin(armRad);

  lms[11] = { x: cx - 0.07, y: shoulderY, visibility: 0.95 };
  lms[12] = { x: cx + 0.07, y: shoulderY, visibility: 0.95 };
  lms[13] = { x: cx - 0.07 - elbowX, y: shoulderY + elbowY * 0.3, visibility: 0.9 };
  lms[14] = { x: cx + 0.07 + elbowX, y: shoulderY + elbowY * 0.3, visibility: 0.9 };
  lms[15] = { x: cx - 0.07 - elbowX * 1.7, y: shoulderY + elbowY * 0.6, visibility: 0.9 };
  lms[16] = { x: cx + 0.07 + elbowX * 1.7, y: shoulderY + elbowY * 0.6, visibility: 0.9 };

  const hipY = 0.52;
  lms[23] = { x: cx - 0.05, y: hipY, visibility: 0.95 };
  lms[24] = { x: cx + 0.05, y: hipY, visibility: 0.95 };

  lms[25] = { x: cx - 0.04, y: hipY + 0.22, visibility: 0.9 };
  lms[26] = { x: cx + 0.04, y: hipY + 0.22, visibility: 0.9 };
  lms[27] = { x: cx - 0.03, y: hipY + 0.40, visibility: 0.9 };
  lms[28] = { x: cx + 0.03, y: hipY + 0.40, visibility: 0.9 };
  lms[29] = { x: cx - 0.04, y: hipY + 0.44, visibility: 0.85 };
  lms[30] = { x: cx + 0.04, y: hipY + 0.44, visibility: 0.85 };
  lms[31] = { x: cx - 0.03, y: hipY + 0.42, visibility: 0.8 };
  lms[32] = { x: cx + 0.03, y: hipY + 0.42, visibility: 0.8 };

  return lms;
}

export const SkeletonPreview: React.FC = () => {
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [mirror, setMirror] = useState(false);
  const [armAngle, setArmAngle] = useState(15);
  const [neckTilt, setNeckTilt] = useState(168);
  const [hipShift, setHipShift] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const landmarks = generateTpostLandmarks(armAngle, neckTilt, hipShift);

  const neckDev = Math.abs(neckTilt - 165);
  const status = neckDev >= 20 ? 'buruk' : neckDev >= 8 ? 'ringan' : 'bagus';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-10">
      <div className="max-w-4xl mx-auto mb-8 text-left">
        <Pill variant="info" size="md" className="mb-2">
          <Eye size={14} />
          <PillContent>OVERLAY SKELETON PADA MASKOT T-POSE</PillContent>
        </Pill>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Preview Skeleton Biomekanika
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Visualisasi landmark MediaPipe Pose 33 titik yang dioverlay pada maskot GenPosFit.
        </p>
      </div>

      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7">
          <Card
            className={cn(
              "p-2 relative overflow-hidden bg-slate-950 border-slate-800 shadow-lg",
              status === 'bagus'
                ? 'shadow-emerald-500/10'
                : status === 'ringan'
                ? 'shadow-amber-500/10'
                : 'shadow-rose-500/10'
            )}
          >
            <div
              ref={containerRef}
              className="relative w-full h-[500px] rounded-lg bg-slate-950 flex items-center justify-center overflow-hidden border border-slate-800"
            >
              <img
                src="/assets/maskot/front_tpost.webp"
                alt="Maskot T-Pose"
                className="w-full h-full object-contain select-none pointer-events-none"
                draggable={false}
              />

              {showSkeleton && (
                <SkeletonOverlay
                  landmarks={landmarks}
                  width={containerRef.current?.clientWidth || 640}
                  height={containerRef.current?.clientHeight || 500}
                  status={status}
                  sudutLeher={neckTilt}
                  orientasi="frontal"
                  showAngles
                  mirror={mirror}
                />
              )}

              <div className="absolute top-3 left-3 flex items-center gap-2 z-20">
                <Button
                  variant={showSkeleton ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowSkeleton(!showSkeleton)}
                  className="text-xs bg-slate-900/85 hover:bg-slate-800 border-slate-700 backdrop-blur-sm"
                >
                  {showSkeleton ? <EyeOff size={14} /> : <Eye size={14} />}
                  <span>{showSkeleton ? 'Skeleton ON' : 'Skeleton OFF'}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMirror(!mirror)}
                  className="text-xs bg-slate-900/85 hover:bg-slate-800 border-slate-700 backdrop-blur-sm"
                >
                  <RefreshCw size={14} />
                  <span>{mirror ? 'Mirror ON' : 'Mirror OFF'}</span>
                </Button>
              </div>

              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-900/85 backdrop-blur-sm border border-slate-800 text-xs font-mono z-20">
                <span className="text-slate-400">
                  Titik: <strong className="text-white">33 MediaPipe Landmarks</strong>
                </span>
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
        </div>

        <div className="lg:col-span-5 flex flex-col gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sliders size={14} className="text-blue-500" />
                <span>Kontrol Pose</span>
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setArmAngle(15); setNeckTilt(168); setHipShift(0); }}
                className="text-xs h-auto p-0 text-blue-600 dark:text-blue-400 hover:text-blue-500 font-medium hover:bg-transparent"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </Button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400 font-medium mb-1.5">
                  <span>Arm Angle (T-Pose):</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{armAngle}°</span>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="60"
                  step="1"
                  value={armAngle}
                  onChange={(e) => setArmAngle(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
              <div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400 font-medium mb-1.5">
                  <span>Neck Tilt (Forward Head):</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{neckTilt}°</span>
                </div>
                <input
                  type="range"
                  min="140"
                  max="175"
                  step="1"
                  value={neckTilt}
                  onChange={(e) => setNeckTilt(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
              <div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400 font-medium mb-1.5">
                  <span>Hip Shift (Lateral):</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{hipShift > 0 ? '+' : ''}{hipShift.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="-0.06"
                  max="0.06"
                  step="0.005"
                  value={hipShift}
                  onChange={(e) => setHipShift(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">
              Informasi
            </h3>
            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2 leading-relaxed">
              <p>
                Halaman ini menampilkan <strong className="text-slate-900 dark:text-white">33 MediaPipe Pose Landmarks</strong> yang dioverlay pada maskot GenPosFit dalam pose T-Pose frontal.
              </p>
              <p>
                Setiap <strong className="text-slate-900 dark:text-white">titik joint</strong> merepresentasikan persendian tubuh: bahu, siku, pergelangan tangan, pinggul, lutut, dan pergelangan kaki.
              </p>
              <p>
                <strong className="text-slate-900 dark:text-white">Garis biru putus-putus</strong> menunjukkan sumbu tulang belakang dari bahu ke pinggul.
              </p>
              <p>
                Gunakan kontrol di samping untuk menyesuaikan sudut lengan, kemiringan leher, dan pergeseran pinggul.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};