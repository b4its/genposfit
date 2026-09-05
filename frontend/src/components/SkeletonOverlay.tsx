import React, { useEffect, useRef } from 'react';

export interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

interface SkeletonOverlayProps {
  landmarks: Landmark[] | null;
  width?: number;
  height?: number;
  status?: 'bagus' | 'ringan' | 'buruk' | string;
  sudutLeher?: number;
  sudutPunggung?: number;
  levelBahu?: number;
  orientasi?: string;
  showAngles?: boolean;
  mirror?: boolean;
  className?: string;
}

// MediaPipe Pose connections
const POSE_CONNECTIONS: [number, number][] = [
  // Face
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10],
  // Shoulders & Torso
  [11, 12], // shoulder to shoulder
  [11, 23], // left shoulder to left hip
  [12, 24], // right shoulder to right hip
  [23, 24], // hip to hip
  // Left Arm
  [11, 13], [13, 15],
  // Right Arm
  [12, 14], [14, 16],
  // Left Leg
  [23, 25], [25, 27], [27, 29], [29, 31],
  // Right Leg
  [24, 26], [26, 28], [28, 30], [30, 32],
];

export const SkeletonOverlay: React.FC<SkeletonOverlayProps> = ({
  landmarks,
  width = 640,
  height = 480,
  status = 'bagus',
  sudutLeher,
  sudutPunggung,
  levelBahu,
  orientasi = 'frontal',
  showAngles = true,
  mirror = false,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    if (!landmarks || landmarks.length < 25) {
      return;
    }

    ctx.save();
    if (mirror) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    // Color definitions based on posture status
    let strokeColor = '#10b981'; // Green
    let glowColor = 'rgba(16, 185, 129, 0.4)';
    let jointFill = '#34d399';

    if (status === 'ringan') {
      strokeColor = '#f59e0b'; // Amber / Yellow
      glowColor = 'rgba(245, 158, 11, 0.4)';
      jointFill = '#fbbf24';
    } else if (status === 'buruk') {
      strokeColor = '#ef4444'; // Red
      glowColor = 'rgba(239, 68, 68, 0.4)';
      jointFill = '#f87171';
    }

    // 1. Draw Bones / Connections
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
      ctx.moveTo(p1.x * width, p1.y * height);
      ctx.lineTo(p2.x * width, p2.y * height);
      ctx.stroke();
    });

    // Draw central spine connection (mid-shoulder to mid-hip)
    const lSh = landmarks[11];
    const rSh = landmarks[12];
    const lHip = landmarks[23];
    const rHip = landmarks[24];

    if (lSh && rSh && lHip && rHip) {
      const midShoulderX = ((lSh.x + rSh.x) / 2) * width;
      const midShoulderY = ((lSh.y + rSh.y) / 2) * height;
      const midHipX = ((lHip.x + rHip.x) / 2) * width;
      const midHipY = ((lHip.y + rHip.y) / 2) * height;

      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(midShoulderX, midShoulderY);
      ctx.lineTo(midHipX, midHipY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 2. Draw Landmark Joints
    landmarks.forEach((pt, idx) => {
      const vis = pt.visibility ?? 1.0;
      if (vis < 0.35) return;

      const px = pt.x * width;
      const py = pt.y * height;

      // Key joints get special styling
      const isKeyJoint = [0, 7, 8, 11, 12, 13, 14, 23, 24].includes(idx);
      const radius = isKeyJoint ? 5 : 3;

      ctx.beginPath();
      ctx.arc(px, py, radius, 0, 2 * Math.PI);
      ctx.fillStyle = isKeyJoint ? '#ffffff' : jointFill;
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
    });

    ctx.restore();

    // 3. Draw On-Canvas Angle Labels (if showAngles enabled)
    if (showAngles) {
      ctx.save();
      const ear = landmarks[orientasi === 'lateral_kanan' ? 8 : 7] || landmarks[0];
      const shoulder = landmarks[orientasi === 'lateral_kanan' ? 12 : 11];

      if (ear && shoulder && sudutLeher !== undefined) {
        let labelX = (shoulder.x * width);
        const labelY = (shoulder.y * height) - 20;
        if (mirror) labelX = width - labelX;

        // Badge pill background
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.2;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;

        const text = `Leher: ${sudutLeher.toFixed(1)}°`;
        ctx.font = '600 12px monospace';
        const textWidth = ctx.measureText(text).width;

        ctx.beginPath();
        ctx.roundRect(labelX - textWidth / 2 - 8, labelY - 14, textWidth + 16, 22, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, labelX, labelY - 3);
      }

      const hip = landmarks[orientasi === 'lateral_kanan' ? 24 : 23];
      if (hip && sudutPunggung !== undefined) {
        const labelY = (hip.y * height) - 10;
        let labelX = (hip.x * width);
        if (mirror) labelX = width - labelX;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.2;

        const text = `Punggung: ${sudutPunggung.toFixed(1)}°`;
        ctx.font = '600 12px monospace';
        const textWidth = ctx.measureText(text).width;

        ctx.beginPath();
        ctx.roundRect(labelX - textWidth / 2 - 8, labelY - 14, textWidth + 16, 22, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, labelX, labelY - 3);
      }

      ctx.restore();
    }
  }, [landmarks, width, height, status, sudutLeher, sudutPunggung, levelBahu, orientasi, showAngles, mirror]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`absolute inset-0 pointer-events-none z-10 w-full h-full object-contain ${className}`}
    />
  );
};
