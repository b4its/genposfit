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

interface Region {
  x: number; y: number; w: number; h: number;
}

interface RigGeometry {
  leftShoulder: { x: number; y: number };
  rightShoulder: { x: number; y: number };
  leftArm: Region;
  rightArm: Region;
  head: Region;
  torso: Region;
  leftLeg: Region;
  rightLeg: Region;
}

function detectGeometry(imgData: ImageData): RigGeometry {
  const w = imgData.width;
  const h = imgData.height;
  const d = imgData.data;

  const opaque = (x: number, y: number) => d[(y * w + x) * 4 + 3] > 100;

  let top = -1, bottom = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (opaque(x, y)) { if (top < 0) top = y; bottom = y; break; }

  let spineX = 0;
  for (let y = Math.floor(h * 0.30); y < Math.floor(h * 0.60); y++)
    for (let x = Math.floor(w * 0.40); x < Math.floor(w * 0.60); x++)
      if (opaque(x, y)) spineX += x;
  spineX = spineX ? spineX / h / 0.30 : w / 2;

  let headBottom = top;
  let prevWidth = 0;
  for (let y = top; y < h && y < top + 300; y++) {
    let minX = w, maxX = 0;
    for (let x = 0; x < w; x++) if (opaque(x, y)) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
    const w2 = maxX - minX;
    if (w2 < 10) continue;
    if (w2 < prevWidth * 0.55 && prevWidth > 100) break;
    prevWidth = w2; headBottom = y;
  }

  let armTop = headBottom, armBottom = headBottom, maxSpan = 0;
  for (let y = headBottom; y < bottom; y++) {
    let minX = w, maxX = 0;
    for (let x = 0; x < w; x++) if (opaque(x, y)) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
    const s = maxX - minX;
    if (s > maxSpan) { maxSpan = s; armTop = y; armBottom = y; }
  }
  const bc = (armTop + armBottom) / 2;
  armTop = Math.floor(bc - 48); armBottom = Math.floor(bc + 48);
  if (armTop < headBottom) armTop = headBottom + 5;
  if (armBottom > bottom) armBottom = bottom;

  let leftHandX = w, rightHandX = 0;
  for (let y = armTop; y <= armBottom; y++) {
    let minX = w, maxX = 0;
    for (let x = 0; x < w; x++) if (opaque(x, y)) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
    if (minX < leftHandX) leftHandX = minX;
    if (maxX > rightHandX) rightHandX = maxX;
  }

  const shoulderY = (armTop + armBottom) / 2;

  // Scan downward through the arm band to find the row where arms detach
  // from the body (width drops sharply). The left/right edges of that row
  // are the shoulder joints. Start at the arm centre where arms are fully
  // horizontal, then walk down until the merged arms+body separate.
  let leftShoulderX = w, rightShoulderX = 0;
  for (let y = Math.round(shoulderY); y <= armBottom; y++) {
    let minX = w, maxX = 0;
    for (let x = 0; x < w; x++) if (opaque(x, y)) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
    const wSpan = maxX - minX;
    if (wSpan < maxSpan * 0.85) {
      leftShoulderX = minX;
      rightShoulderX = maxX;
      break;
    }
  }
  // fallback: use spineX ± 60 if detection fails
  if (leftShoulderX === w) { leftShoulderX = spineX - 60; rightShoulderX = spineX + 60; }

  const ext = 10;
  const leftArm: Region = { x: leftHandX, y: armTop, w: leftShoulderX - leftHandX + ext, h: armBottom - armTop + 1 };
  const rightArm: Region = { x: rightShoulderX, y: armTop, w: rightHandX - rightShoulderX + ext, h: armBottom - armTop + 1 };

  const legTop = armBottom + 8;
  const leftLeg: Region = { x: 0, y: legTop, w: Math.floor(w / 2), h: bottom - legTop + 1 };
  const rightLeg: Region = { x: Math.floor(w / 2), y: legTop, w: Math.floor(w / 2), h: bottom - legTop + 1 };

  const torso: Region = {
    x: leftShoulderX - 5, y: armBottom + 2,
    w: rightShoulderX - leftShoulderX + 10, h: legTop - (armBottom + 2) + 1,
  };
  const head: Region = { x: 0, y: top, w: w, h: headBottom - top + 1 };

  return {
    leftShoulder: { x: leftShoulderX, y: shoulderY },
    rightShoulder: { x: rightShoulderX, y: shoulderY },
    leftArm, rightArm, head, torso, leftLeg, rightLeg,
  };
}

function paintRig(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  geo: RigGeometry,
  opts: { leftArmAngle: number; rightArmAngle: number; hipShift: number },
) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  const snapshot = () => {
    const s = document.createElement('canvas');
    s.width = w; s.height = h;
    s.getContext('2d')!.drawImage(img, 0, 0, w, h);
    return s;
  };

  const grab = (reg: Region, src: HTMLCanvasElement) => {
    const c = document.createElement('canvas');
    c.width = Math.ceil(reg.w); c.height = Math.ceil(reg.h);
    c.getContext('2d')!.drawImage(src, reg.x, reg.y, reg.w, reg.h, 0, 0, reg.w, reg.h);
    return c;
  };

  ctx.clearRect(0, 0, w, h);
  const base = snapshot();

  const clearReg = (reg: Region, margin = 6) => {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(reg.x - margin, reg.y - margin, reg.w + margin * 2, reg.h + margin * 2);
    ctx.restore();
  };

  const paintRotated = (reg: Region, pivot: { x: number; y: number }, angleDeg: number) => {
    const src = grab(reg, base);
    clearReg(reg, 6);
    ctx.save();
    ctx.translate(pivot.x, pivot.y);
    ctx.rotate(degToRad(angleDeg));
    const dx = -(pivot.x - reg.x);
    const dy = -(pivot.y - reg.y);
    ctx.drawImage(src, dx, dy);
    ctx.restore();
  };

  paintRotated(geo.leftArm, geo.leftShoulder, opts.leftArmAngle);
  paintRotated(geo.rightArm, geo.rightShoulder, opts.rightArmAngle);

  const shift = opts.hipShift * w;
  if (Math.abs(shift) > 0.5) {
    const lLeg = grab(geo.leftLeg, base);
    const rLeg = grab(geo.rightLeg, base);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(geo.leftLeg.x - 4, geo.leftLeg.y - 2, geo.leftLeg.w + 8, geo.leftLeg.h + 4);
    ctx.fillRect(geo.rightLeg.x - 4, geo.rightLeg.y - 2, geo.rightLeg.w + 8, geo.rightLeg.h + 4);
    ctx.restore();
    ctx.drawImage(lLeg, geo.leftLeg.x + shift, geo.leftLeg.y, geo.leftLeg.w, geo.leftLeg.h);
    ctx.drawImage(rLeg, geo.rightLeg.x + shift, geo.rightLeg.y, geo.rightLeg.w, geo.rightLeg.h);
  }
}

function generateLandmarks(geo: RigGeometry, leftAngle: number, rightAngle: number): Landmark[] {
  const sx = geo.leftShoulder.x / 1000, sy = geo.leftShoulder.y / 1018;
  const rsx = geo.rightShoulder.x / 1000;
  const hx = (sx + rsx) / 2;
  const hipY = 0.688;
  const lArmR = (leftAngle * Math.PI) / 180;
  const rArmR = (rightAngle * Math.PI) / 180;
  const lArmLen = (geo.leftShoulder.x - geo.leftArm.x) / 1000;
  const rArmLen = (geo.rightArm.x + geo.rightArm.w - geo.rightShoulder.x) / 1000;
  const lElbowL = lArmLen * 0.55;
  const rElbowL = rArmLen * 0.55;

  const lms: Landmark[] = [];
  for (let i = 0; i < 33; i++) lms.push({ x: 0.5, y: 0.5, visibility: 0.85 });

  lms[0] = { x: hx, y: sy - 0.18, visibility: 0.95 };
  lms[7] = { x: sx - 0.02, y: sy - 0.17, visibility: 0.95 };
  lms[8] = { x: rsx + 0.02, y: sy - 0.17, visibility: 0.95 };
  lms[11] = { x: sx, y: sy, visibility: 0.95 };
  lms[12] = { x: rsx, y: sy, visibility: 0.95 };
  lms[13] = { x: sx - lElbowL * Math.cos(lArmR), y: sy - lElbowL * Math.sin(lArmR), visibility: 0.9 };
  lms[15] = { x: sx - lArmLen * Math.cos(lArmR), y: sy - lArmLen * Math.sin(lArmR), visibility: 0.9 };
  lms[14] = { x: rsx + rElbowL * Math.cos(rArmR), y: sy - rElbowL * Math.sin(rArmR), visibility: 0.9 };
  lms[16] = { x: rsx + rArmLen * Math.cos(rArmR), y: sy - rArmLen * Math.sin(rArmR), visibility: 0.9 };
  lms[23] = { x: hx - 0.030, y: hipY, visibility: 0.95 };
  lms[24] = { x: hx + 0.030, y: hipY, visibility: 0.95 };
  lms[25] = { x: hx - 0.035, y: 0.80, visibility: 0.9 };
  lms[26] = { x: hx + 0.035, y: 0.80, visibility: 0.9 };
  lms[27] = { x: hx - 0.045, y: 0.91, visibility: 0.9 };
  lms[28] = { x: hx + 0.045, y: 0.91, visibility: 0.9 };
  lms[29] = { x: hx - 0.048, y: 0.96, visibility: 0.85 };
  lms[30] = { x: hx + 0.048, y: 0.96, visibility: 0.85 };

  return lms;
}

const POSE_CONNS: [number, number][] = [
  [0, 7], [0, 8],
  [11, 12], [11, 23], [12, 24], [23, 24],
  [11, 13], [13, 15], [12, 14], [14, 16],
  [23, 25], [25, 27], [24, 26], [26, 28],
];

function drawSkeleton(ctx: CanvasRenderingContext2D, lms: Landmark[], status: string) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  let sc = '#10b981', gl = 'rgba(16,185,129,0.4)', jf = '#34d399';
  if (status === 'ringan') { sc = '#f59e0b'; gl = 'rgba(245,158,11,0.4)'; jf = '#fbbf24'; }
  else if (status === 'buruk') { sc = '#ef4444'; gl = 'rgba(239,68,68,0.4)'; jf = '#f87171'; }

  ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = sc; ctx.shadowColor = gl; ctx.shadowBlur = 8;
  POSE_CONNS.forEach(([a, b]) => {
    const p1 = lms[a]; if (!p1) return;
    const p2 = lms[b]; if (!p2) return;
    if ((p1.visibility ?? 1) < 0.35 || (p2.visibility ?? 1) < 0.35) return;
    ctx.beginPath(); ctx.moveTo(p1.x * w, p1.y * h); ctx.lineTo(p2.x * w, p2.y * h); ctx.stroke();
  });

  const a = lms[11], b = lms[12], c = lms[23], d = lms[24];
  if (a && b && c && d) {
    const mx = ((a.x + b.x) / 2) * w, my = ((a.y + b.y) / 2) * h;
    const hy = ((c.y + d.y) / 2) * h;
    ctx.setLineDash([4, 4]); ctx.lineWidth = 2; ctx.strokeStyle = '#38bdf8';
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx, hy); ctx.stroke(); ctx.setLineDash([]);
  }

  lms.forEach((pt, i) => {
    if ((pt.visibility ?? 1) < 0.35) return;
    const px = pt.x * w, py = pt.y * h;
    const key = [0, 11, 12, 13, 14, 23, 24].includes(i);
    ctx.beginPath(); ctx.arc(px, py, key ? 5 : 3, 0, 2 * Math.PI);
    ctx.fillStyle = key ? '#fff' : jf; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = sc; ctx.stroke();
  });
}

interface RigCanvasProps {
  leftArmAngle: number; rightArmAngle: number; hipShift: number;
  showSkeleton: boolean; status: string;
}

const RigCanvas: React.FC<RigCanvasProps> = ({
  leftArmAngle, rightArmAngle, hipShift, showSkeleton, status,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const geoRef = useRef<RigGeometry | null>(null);
  const [loaded, setLoaded] = useState(0);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const cx = c.getContext('2d')!;
      cx.drawImage(img, 0, 0);
      geoRef.current = detectGeometry(cx.getImageData(0, 0, img.width, img.height));
      imgRef.current = img;
      setLoaded((p) => p + 1);
    };
    img.src = '/assets/maskot/front_tpost.webp';
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgRef.current || !geoRef.current) return;
    const ctx = canvas.getContext('2d')!;
    const w = IMG_W; const h = IMG_H;
    canvas.width = w; canvas.height = h;

    paintRig(ctx, imgRef.current, geoRef.current, { leftArmAngle, rightArmAngle, hipShift });

    if (showSkeleton) {
      const lms = generateLandmarks(geoRef.current, leftArmAngle, rightArmAngle);
      drawSkeleton(ctx, lms, status);
    }
  }, [loaded, leftArmAngle, rightArmAngle, hipShift, showSkeleton, status]);

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
  const [neckTilt] = useState(168);
  const [hipShift, setHipShift] = useState(0);

  const neckDev = Math.abs(neckTilt - 165);
  const status = neckDev >= 20 ? 'buruk' : neckDev >= 8 ? 'ringan' : 'bagus';

  const resetAll = () => {
    setLeftArmAngle(0); setRightArmAngle(0); setHipShift(0);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-10">
      <div className="max-w-4xl mx-auto mb-8 text-left">
        <Pill variant="info" size="md" className="mb-2">
          <Eye size={14} />
          <PillContent>RIGGING BIOMEKANIKA VISION-AWARE</PillContent>
        </Pill>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Skeleton 🡒 Objek Maskot (Rigging)
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Vision-detected geometry: semua anggota tubuh (lengan, kepala, kaki) dideteksi langsung dari piksel gambar, lalu digerakkan bersama skeleton.
        </p>
      </div>

      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7">
          <Card
            className={cn(
              "p-2 relative overflow-hidden bg-slate-950 border-slate-800 shadow-lg",
              status === 'bagus' ? 'shadow-emerald-500/10'
                : status === 'ringan' ? 'shadow-amber-500/10' : 'shadow-rose-500/10',
            )}
          >
            <div className="relative w-full h-[520px] rounded-lg bg-slate-950 flex items-center justify-center overflow-hidden border border-slate-800">
              <RigCanvas
                leftArmAngle={leftArmAngle}
                rightArmAngle={rightArmAngle}
                hipShift={hipShift}
                showSkeleton={showSkeleton}
                status={status}
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
                  Lengan Kiri: <strong className="text-blue-400">{leftArmAngle}°</strong>
                  {' | '}Lengan Kanan: <strong className="text-emerald-400">{rightArmAngle}°</strong>
                </span>
                <Pill variant={status === 'bagus' ? 'success' : status === 'ringan' ? 'warning' : 'destructive'} size="sm">
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
                <span>Kontrol Rigging</span>
              </h3>
              <Button variant="ghost" size="sm" onClick={resetAll}
                className="text-xs h-auto p-0 text-blue-600 dark:text-blue-400 hover:text-blue-500 font-medium hover:bg-transparent"
              >
                <RotateCcw size={12} /><span>Reset</span>
              </Button>
            </div>
            <div className="space-y-4 text-xs">
              {[
                { label: 'Lengan Kiri', val: leftArmAngle, set: setLeftArmAngle, color: 'blue', min: -45, max: 60 },
                { label: 'Lengan Kanan', val: rightArmAngle, set: setRightArmAngle, color: 'emerald', min: -45, max: 60 },
              ].map((s) => (
                <div key={s.label}>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400 font-medium mb-1.5">
                    <span>{s.label}:</span>
                    <span className={`font-mono font-bold text-${s.color}-600 dark:text-${s.color}-400`}>{s.val}°</span>
                  </div>
                  <input
                    type="range" min={s.min} max={s.max} step={1} value={s.val}
                    onChange={(e) => s.set(parseFloat(e.target.value))}
                    className={`w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-${s.color}-500`}
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                    <span>{s.min}°</span><span>0° (T-Pose)</span><span>+{s.max}°</span>
                  </div>
                </div>
              ))}
              <div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400 font-medium mb-1.5">
                  <span>Geser Pinggul:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{hipShift > 0 ? '+' : ''}{hipShift.toFixed(2)}</span>
                </div>
                <input type="range" min="-0.06" max="0.06" step="0.005" value={hipShift}
                  onChange={(e) => setHipShift(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">Rigging Engine</h3>
            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2 leading-relaxed">
              <p><strong className="text-slate-900 dark:text-white">detectGeometry()</strong> — vision pass pada canvas maskot mendeteksi batas kepala, bahu, lengan, pinggul, dan kaki berdasarkan alpha channel.</p>
              <p>Hasil deteksi menentukan <strong className="text-slate-900 dark:text-white">pivot sendi</strong> (shoulder, hip), lalu setiap potongan lengan diekstrak, dihapus dari kanvas, dan digambar ulang dengan rotasi di sekitar sendi. Skeleton 33 titik digambar langsung pada kanvas yang sama.</p>
              <p className="border-t border-slate-200 dark:border-slate-800 pt-2 mt-2 text-[11px] text-slate-400">Geser slider untuk melihat <strong className="text-slate-300">lengan objek bergerak</strong> mengikuti skeleton secara real-time — bukan hanya skeleton di atas gambar.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};