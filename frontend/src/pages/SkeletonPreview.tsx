import React, { useRef, useEffect, useState } from 'react';
import {
  Eye, EyeOff, RotateCcw, Sliders
} from 'lucide-react';
import { type Landmark } from '../components/SkeletonOverlay';
import { Button, Card, Pill, PillIndicator, PillContent } from '../components/ui';
import { cn } from '../lib/utils';

const IMG_W = 1000;
const IMG_H = 1018;

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

const POSE_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10],
  [11, 12], [11, 23], [12, 24], [23, 24],
  [11, 13], [13, 15],
  [12, 14], [14, 16],
  [23, 25], [25, 27], [27, 29], [29, 31],
  [24, 26], [26, 28], [28, 30], [30, 32],
];

function drawSkeleton(ctx: CanvasRenderingContext2D, landmarks: Landmark[], status: string) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  if (!landmarks || landmarks.length < 25) return;

  let strokeColor = '#10b981';
  let glowColor = 'rgba(16, 185, 129, 0.4)';
  let jointFill = '#34d399';

  if (status === 'ringan') {
    strokeColor = '#f59e0b';
    glowColor = 'rgba(245, 158, 11, 0.4)';
    jointFill = '#fbbf24';
  } else if (status === 'buruk') {
    strokeColor = '#ef4444';
    glowColor = 'rgba(239, 68, 68, 0.4)';
    jointFill = '#f87171';
  }

  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = strokeColor;
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 8;

  POSE_CONNECTIONS.forEach(([startIdx, endIdx]) => {
    const p1 = landmarks[startIdx];
    const p2 = landmarks[endIdx];
    if (!p1 || !p2) return;
    const vis1 = p1.visibility ?? 1.0;
    const vis2 = p2.visibility ?? 1.0;
    if (vis1 < 0.35 || vis2 < 0.35) return;
    ctx.beginPath();
    ctx.moveTo(p1.x * w, p1.y * h);
    ctx.lineTo(p2.x * w, p2.y * h);
    ctx.stroke();
  });

  const lSh = landmarks[11];
  const rSh = landmarks[12];
  const lHip = landmarks[23];
  const rHip = landmarks[24];
  if (lSh && rSh && lHip && rHip) {
    const mx = ((lSh.x + rSh.x) / 2) * w;
    const my = ((lSh.y + rSh.y) / 2) * h;
    const hx = ((lHip.x + rHip.x) / 2) * w;
    const hy = ((lHip.y + rHip.y) / 2) * h;
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  landmarks.forEach((pt, idx) => {
    const vis = pt.visibility ?? 1.0;
    if (vis < 0.35) return;
    const px = pt.x * w;
    const py = pt.y * h;
    const isKeyJoint = [0, 7, 8, 11, 12, 13, 14, 23, 24].includes(idx);
    const radius = isKeyJoint ? 5 : 3;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, 2 * Math.PI);
    ctx.fillStyle = isKeyJoint ? '#ffffff' : jointFill;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = strokeColor;
    ctx.stroke();
  });
}

interface RigCanvasProps {
  leftArmAngle: number;
  rightArmAngle: number;
  neckTilt: number;
  hipShift: number;
  showSkeleton: boolean;
}

const RigCanvas: React.FC<RigCanvasProps> = ({
  leftArmAngle, rightArmAngle, neckTilt, hipShift, showSkeleton,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setLoaded(true);
    };
    img.src = '/assets/maskot/front_tpost.webp';
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loaded || !imgRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = IMG_W;
    const h = IMG_H;
    canvas.width = w;
    canvas.height = h;

    ctx.clearRect(0, 0, w, h);

    const neckDev = Math.abs(neckTilt - 165);
    const status = neckDev >= 20 ? 'buruk' : neckDev >= 8 ? 'ringan' : 'bagus';
    const lArmRad = degToRad(leftArmAngle);
    const rArmRad = degToRad(rightArmAngle);
    const cx = (0.5 + hipShift) * w;

    const lShoulderX = cx - 0.052 * w;
    const rShoulderX = cx + 0.052 * w;
    const shoulderY = 0.502 * h;

    ctx.save();
    ctx.drawImage(imgRef.current, 0, 0, w, h);

    ctx.globalCompositeOperation = 'destination-out';

    ctx.clearRect(lShoulderX - 175, shoulderY - 35, 175, 70);
    ctx.clearRect(rShoulderX, shoulderY - 35, 175, 70);

    ctx.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.translate(lShoulderX, shoulderY);
    ctx.rotate(lArmRad);
    ctx.drawImage(
      imgRef.current,
      lShoulderX - 175, shoulderY - 35, 175, 70,
      -175, -35, 175, 70,
    );
    ctx.restore();

    ctx.save();
    ctx.translate(rShoulderX, shoulderY);
    ctx.rotate(rArmRad);
    ctx.drawImage(
      imgRef.current,
      rShoulderX, shoulderY - 35, 175, 70,
      0, -35, 175, 70,
    );
    ctx.restore();

    ctx.restore();

    if (showSkeleton) {
      const landmarks = generateTpostLandmarks(leftArmAngle, rightArmAngle, neckTilt, hipShift);
      drawSkeleton(ctx, landmarks, status);
    }
  }, [leftArmAngle, rightArmAngle, neckTilt, hipShift, showSkeleton, loaded]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <canvas
        ref={canvasRef}
        className="max-w-full max-h-full object-contain"
        style={{ width: 'auto', height: '100%', aspectRatio: `${IMG_W}/${IMG_H}` }}
      />
    </div>
  );
};

export const SkeletonPreview: React.FC = () => {
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [leftArmAngle, setLeftArmAngle] = useState(0);
  const [rightArmAngle, setRightArmAngle] = useState(0);
  const [neckTilt, setNeckTilt] = useState(168);
  const [hipShift, setHipShift] = useState(0);

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
          <PillContent>RIGGING SKELETON PADA MASKOT T-POSE</PillContent>
        </Pill>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Rigging Skeleton Biomekanika
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Skeleton tertempel (rigging) langsung pada objek maskot. Saat skeleton bergerak, gambar maskot ikut bergerak secara real-time.
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
              <RigCanvas
                leftArmAngle={leftArmAngle}
                rightArmAngle={rightArmAngle}
                neckTilt={neckTilt}
                hipShift={hipShift}
                showSkeleton={showSkeleton}
              />

              <div className="absolute top-3 left-3 z-20">
                <Button
                  variant={showSkeleton ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowSkeleton(!showSkeleton)}
                  className="text-xs bg-slate-900/85 hover:bg-slate-800 border-slate-700 backdrop-blur-sm"
                >
                  {showSkeleton ? <EyeOff size={14} /> : <Eye size={14} />}
                  <span>{showSkeleton ? 'Skeleton ON' : 'Skeleton OFF'}</span>
                </Button>
              </div>

              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-900/85 backdrop-blur-sm border border-slate-800 text-xs font-mono z-20">
                <span className="text-slate-400">
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
              Cara Kerja Rigging
            </h3>
            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2 leading-relaxed">
              <p>
                Maskot <strong className="text-slate-900 dark:text-white">front_tpost.webp</strong> digambar di atas kanvas bersama skeleton 33 titik MediaPipe.
              </p>
              <p>
                <strong className="text-slate-900 dark:text-white">Rigging:</strong> area lengan pada gambar diekstrak sebagai bagian terpisah dan diputar di sekitar sendi bahu. 
                Gunakan slider <strong className="text-slate-900 dark:text-white">Tangan Kiri/Tangan Kanan</strong> untuk melihat lengan maskot bergerak mengikuti skeleton.
              </p>
              <p className="text-[11px] text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-2 mt-2">
                Sudut 0° = lengan horizontal (T-Pose). Semakin besar sudut, lengan terangkat ke atas; sudut negatif = lengan turun.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};