import { useCallback, useEffect, useRef, useState } from 'react';

export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

declare global {
  interface Window {
    Pose: {
      new (config: { locateFile: (file: string) => string }): {
        setOptions: (opts: Record<string, unknown>) => void;
        onResults: (cb: (results: { poseLandmarks: PoseLandmark[] | null }) => void) => void;
        send: (input: { image: HTMLVideoElement }) => Promise<void>;
        close: () => void;
      };
    };
    Camera: {
      new (video: HTMLVideoElement, config: {
        onFrame: () => Promise<void>;
        width: number;
        height: number;
      }): { start: () => Promise<void>; stop: () => void };
    };
  }
}

interface PoseDetectorOptions {
  modelComplexity?: 0 | 1 | 2;
  smoothLandmarks?: boolean;
  minDetectionConfidence?: number;
  minTrackingConfidence?: number;
  cameraWidth?: number;
  cameraHeight?: number;
}

const DEFAULT_OPTIONS: Required<PoseDetectorOptions> = {
  modelComplexity: 1,
  smoothLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
  cameraWidth: 640,
  cameraHeight: 480,
};

type PoseDetectorStatus = 'idle' | 'loading' | 'ready' | 'error';

export function usePoseDetector(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  active: boolean,
  options: PoseDetectorOptions = {},
) {
  const [status, setStatus] = useState<PoseDetectorStatus>('idle');
  const [landmarks, setLandmarks] = useState<PoseLandmark[] | null>(null);
  const poseRef = useRef<{ setOptions: (opts: Record<string, unknown>) => void; onResults: (cb: (results: { poseLandmarks: PoseLandmark[] | null }) => void) => void; send: (input: { image: HTMLVideoElement }) => Promise<void>; close: () => void } | null>(null);
  const cameraRef = useRef<{ start: () => Promise<void>; stop: () => void } | null>(null);
  const initializedRef = useRef(false);

  const opts = { ...DEFAULT_OPTIONS, ...options };

  const start = useCallback(async () => {
    if (initializedRef.current) return;
    const video = videoRef.current;
    if (!video || !window.Pose || !window.Camera) {
      setStatus('error');
      return;
    }

    setStatus('loading');

    try {
      const pose = new window.Pose({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
      });

      pose.setOptions({
        modelComplexity: opts.modelComplexity,
        smoothLandmarks: opts.smoothLandmarks,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: opts.minDetectionConfidence,
        minTrackingConfidence: opts.minTrackingConfidence,
      });

      poseRef.current = pose;
      initializedRef.current = true;

      pose.onResults((results) => {
        if (results.poseLandmarks && results.poseLandmarks.length >= 25) {
          setLandmarks(results.poseLandmarks);
        }
      });

      const camera = new window.Camera(video, {
        onFrame: async () => {
          if (poseRef.current && video.readyState >= 2) {
            await poseRef.current.send({ image: video });
          }
        },
        width: opts.cameraWidth ?? DEFAULT_OPTIONS.cameraWidth,
        height: opts.cameraHeight ?? DEFAULT_OPTIONS.cameraHeight,
      });

      cameraRef.current = camera;
      await camera.start();
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [videoRef, opts.modelComplexity, opts.smoothLandmarks,
      opts.minDetectionConfidence, opts.minTrackingConfidence,
      opts.cameraWidth, opts.cameraHeight]);

  const stop = useCallback(() => {
    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }
    if (poseRef.current) {
      poseRef.current.close();
      poseRef.current = null;
    }
    initializedRef.current = false;
    setStatus('idle');
    setLandmarks(null);
  }, []);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (active) {
      queueMicrotask(() => start());
    } else {
      stop();
    }
    return () => stop();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [active, start, stop]);

  return { status, landmarks };
}