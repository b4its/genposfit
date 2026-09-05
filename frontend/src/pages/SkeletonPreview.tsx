import React, { useState } from 'react';
import {
  Eye, EyeOff, RotateCcw, RefreshCw, Sliders
} from 'lucide-react';
import { SkeletonOverlay, type Landmark } from '../components/SkeletonOverlay';
import { Button, Card, Pill, PillIndicator, PillContent } from '../components/ui';
import { cn } from '../lib/utils';

function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function generateTpostLandmarks(
  leftArmAngle: number,
  rightArmAngle: number,
  neckTilt: number,
  hipShift: number,
): Landmark[] {
  const lms: Landmark[] = [];
  for (let i = 0; i < 33; i++) {
    lms.push({ x: 0.5, y: 0.5, z: 0, visibility: 0.85 });
  }

  const neckRad = degToRad(180 - neckTilt);
  const neckLen = 0.06;
  const cx = 0.5 + hipShift;
  const shoulderY = 0.502;

  const noseX = cx - Math.sin(neckRad) * neckLen - 0.03;
  const noseY = shoulderY - Math.cos(neckRad) * neckLen + 0.02;
  const earX = cx - Math.sin(neckRad) * neckLen;
  const earY = shoulderY - Math.cos(neckRad) * neckLen;

  lms[0] = { x: noseX, y: noseY, visibility: 0.95 };
  lms[1] = { x: cx - 0.015, y: earY - 0.005, visibility: 0.9 };
  lms[2] = { x: cx - 0.012, y: earY, visibility: 0.9 };
  lms[3] = { x: cx - 0.020, y: earY - 0.003, visibility: 0.9 };
  lms[4] = { x: cx + 0.015, y: earY - 0.005, visibility: 0.9 };
  lms[5] = { x: cx + 0.012, y: earY, visibility: 0.9 };
  lms[6] = { x: cx + 0.020, y: earY - 0.003, visibility: 0.9 };
  lms[7] = { x: earX, y: earY, visibility: 0.95 };
  lms[8] = { x: earX + 0.088, y: earY, visibility: 0.95 };
  lms[9] = { x: cx - 0.009, y: earY + 0.012, visibility: 0.9 };
  lms[10] = { x: cx + 0.009, y: earY + 0.012, visibility: 0.9 };

  const lArmRad = degToRad(leftArmAngle);
  const rArmRad = degToRad(rightArmAngle);

  const lElbowLen = 0.088;
  const lWristLen = 0.175;
  const lShoulderX = cx - 0.052;
  const lShoulderY = shoulderY;

  lms[11] = { x: lShoulderX, y: lShoulderY, visibility: 0.95 };
  lms[13] = {
    x: lShoulderX - lElbowLen * Math.cos(lArmRad),
    y: lShoulderY - lElbowLen * Math.sin(lArmRad),
    visibility: 0.9,
  };
  lms[15] = {
    x: lShoulderX - lWristLen * Math.cos(lArmRad),
    y: lShoulderY - lWristLen * Math.sin(lArmRad),
    visibility: 0.9,
  };

  const rElbowLen = 0.067;
  const rWristLen = 0.175;
  const rShoulderX = cx + 0.052;
  const rShoulderY = shoulderY;

  lms[12] = { x: rShoulderX, y: rShoulderY, visibility: 0.95 };
  lms[14] = {
    x: rShoulderX + rElbowLen * Math.cos(rArmRad),
    y: rShoulderY - rElbowLen * Math.sin(rArmRad),
    visibility: 0.9,
  };
  lms[16] = {
    x: rShoulderX + rWristLen * Math.cos(rArmRad),
    y: rShoulderY - rWristLen * Math.sin(rArmRad),
    visibility: 0.9,
  };

  lms[23] = { x: cx - 0.031, y: 0.690, visibility: 0.95 };
  lms[24] = { x: cx + 0.031, y: 0.690, visibility: 0.95 };

  lms[25] = { x: cx - 0.034, y: 0.808, visibility: 0.9 };
  lms[26] = { x: cx + 0.034, y: 0.808, visibility: 0.9 };

  lms[27] = { x: cx - 0.042, y: 0.916, visibility: 0.9 };
  lms[28] = { x: cx + 0.042, y: 0.916, visibility: 0.9 };

  lms[29] = { x: cx - 0.048, y: 0.960, visibility: 0.85 };
  lms[30] = { x: cx + 0.048, y: 0.960, visibility: 0.85 };
  lms[31] = { x: cx - 0.045, y: 0.955, visibility: 0.8 };
  lms[32] = { x: cx + 0.045, y: 0.955, visibility: 0.8 };

  return lms;
}

export const SkeletonPreview: React.FC = () => {
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [mirror, setMirror] = useState(false);
  const [leftArmAngle, setLeftArmAngle] = useState(0);
  const [rightArmAngle, setRightArmAngle] = useState(0);
  const [neckTilt, setNeckTilt] = useState(168);
  const [hipShift, setHipShift] = useState(0);

  const landmarks = generateTpostLandmarks(leftArmAngle, rightArmAngle, neckTilt, hipShift);

  const neckDev = Math.abs(neckTilt - 165);
  const status = neckDev >= 20 ? 'buruk' : neckDev >= 8 ? 'ringan' : 'bagus';

  const resetAll = () => {
    setLeftArmAngle(0);
    setRightArmAngle(0);
    setNeckTilt(168);
    setHipShift(0);
  };

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
          33 landmark MediaPipe Pose dioverlay presisi pada maskot GenPosFit. Setiap sendi skeleton mengikuti pergerakan pengaturan di samping.
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
            <div className="relative w-full h-[520px] rounded-lg bg-slate-950 flex items-center justify-center overflow-hidden border border-slate-800">
              <img
                src="/assets/maskot/front_tpost.webp"
                alt="Maskot T-Pose"
                className="w-full h-full object-contain select-none pointer-events-none"
                draggable={false}
              />

              {showSkeleton && (
                <SkeletonOverlay
                  landmarks={landmarks}
                  width={1000}
                  height={1018}
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
                  Titik: <strong className="text-white">33 MediaPipe</strong>
                  {' | '}
                  Tangan Kiri: <strong className="text-blue-400">{leftArmAngle}°</strong>
                  {' | '}
                  Tangan Kanan: <strong className="text-emerald-400">{rightArmAngle}°</strong>
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
                onClick={resetAll}
                className="text-xs h-auto p-0 text-blue-600 dark:text-blue-400 hover:text-blue-500 font-medium hover:bg-transparent"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </Button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400 font-medium mb-1.5">
                  <span>Tangan Kiri (Angle):</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{leftArmAngle}°</span>
                </div>
                <input
                  type="range"
                  min="-45"
                  max="60"
                  step="1"
                  value={leftArmAngle}
                  onChange={(e) => setLeftArmAngle(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                  <span>-45° (turun)</span>
                  <span>0° (T-Pose)</span>
                  <span>+60° (naik)</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400 font-medium mb-1.5">
                  <span>Tangan Kanan (Angle):</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{rightArmAngle}°</span>
                </div>
                <input
                  type="range"
                  min="-45"
                  max="60"
                  step="1"
                  value={rightArmAngle}
                  onChange={(e) => setRightArmAngle(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                  <span>-45° (turun)</span>
                  <span>0° (T-Pose)</span>
                  <span>+60° (naik)</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400 font-medium mb-1.5">
                  <span>Leher (Forward Head):</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{neckTilt}°</span>
                </div>
                <input
                  type="range"
                  min="140"
                  max="175"
                  step="1"
                  value={neckTilt}
                  onChange={(e) => setNeckTilt(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                  <span>140° (tech neck)</span>
                  <span>168° (normal)</span>
                  <span>175° (tegak)</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400 font-medium mb-1.5">
                  <span>Pergeseran Pinggul:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{hipShift > 0 ? '+' : ''}{hipShift.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="-0.06"
                  max="0.06"
                  step="0.005"
                  value={hipShift}
                  onChange={(e) => setHipShift(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">
              Tentang Halaman Ini
            </h3>
            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2 leading-relaxed">
              <p>
                Skeleton <strong className="text-slate-900 dark:text-white">33 titik MediaPipe Pose</strong> ditumpuk tepat di atas maskot T-Pose GenPosFit. 
                Setiap landmark dipetakan sesuai dimensi asli gambar (1000×1018 px).
              </p>
              <p>
                Gunakan slider <strong className="text-slate-900 dark:text-white">Tangan Kiri/Tangan Kanan</strong> untuk memutar lengan di sekitar sendi bahu.
                Skeleton mengikuti rotasi ini, memperlihatkan perubahan posisi siku dan pergelangan tangan.
              </p>
              <p className="text-[11px] text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-2 mt-2">
                Maskot <strong>front_tpost.webp</strong> — pose T-Pose frontal. Sudut 0° = lengan horizontal (T-Pose sempurna).
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};