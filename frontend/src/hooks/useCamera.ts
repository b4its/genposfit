import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraPermission = 'idle' | 'prompt' | 'granted' | 'denied';

export interface CameraOptions {
  video?: MediaTrackConstraints;
  audio?: boolean;
}

const DEFAULT_VIDEO: MediaTrackConstraints = { width: 640, height: 480 };

export function useCamera(options: CameraOptions = {}) {
  const { video = DEFAULT_VIDEO, audio = false } = options;

  // 'idle' — kamera belum pernah dicoba
  // 'granted' — izin sudah diberikan
  // 'denied' — izin ditolak user / blocklist browser
  // 'prompt' — user belum memutuskan (browser akan menampilkan dialog izin)
  const [permission, setPermission] = useState<CameraPermission>('idle');
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [started, setStarted] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const permissionRef = useRef<PermissionStatus | null>(null);

  const setActiveStream = useCallback((s: MediaStream | null) => {
    streamRef.current = s;
    setStream(s);
    setStarted(!!s);
  }, []);

  // Baca status izin awal secara pasif (tanpa memicu dialog browser).
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    const applyStatus = (state: PermissionState) => {
      if (cancelled) return;
      if (state === 'granted') {
        setPermission('granted');
      } else if (state === 'denied') {
        setPermission('denied');
      } else if (state === 'prompt') {
        setPermission('prompt');
      }
    };

    const query = async () => {
      if (!navigator.mediaDevices || !('permissions' in navigator)) {
        return;
      }
      try {
        const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
        if (cancelled) return;
        permissionRef.current = status;
        applyStatus(status.state);
        const handleChange = () => applyStatus(status.state);
        status.addEventListener('change', handleChange);
        cleanup = () => {
          cancelled = true;
          status.removeEventListener('change', handleChange);
          permissionRef.current = null;
        };
      } catch {
        // Query tidak didukung → biarkan 'idle'.
      }
    };

    query();

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    if (!window.isSecureContext) {
      setError(
        'Akses kamera membutuhkan koneksi HTTPS. Halaman ini diakses melalui HTTP yang tidak aman — ' +
        'akses melalui https:// atau gunakan localhost.'
      );
      setPermission('denied');
      return false;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Browser tidak mendukung akses kamera (getUserMedia).');
      setPermission('denied');
      return false;
    }

    if (permission === 'denied') {
      setError(
        'Izin kamera ditolak. Aktifkan akses kamera pada pengaturan situs browser, lalu muat ulang halaman.'
      );
      return false;
    }

    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video,
        audio,
      });
      setActiveStream(s);
      setPermission('granted');
      setError(null);
      return true;
    } catch (err) {
      const name = (err as DOMException)?.name || (err as Error)?.name;
      if (name === 'NotAllowedError') {
        setError('Akses kamera ditolak. Izinkan kamera di browser, lalu coba lagi.');
        setPermission('denied');
      } else if (name === 'NotFoundError') {
        setError('Kamera tidak terdeteksi pada perangkat ini.');
        setPermission('denied');
      } else if (
        name === 'NotReadableError' ||
        name === 'TrackStartError'
      ) {
        setError('Kamera sedang dipakai aplikasi lain. Tutup aplikasi itu lalu coba lagi.');
        setPermission('denied');
      } else {
        setError((err as Error).message || 'Gagal mengakses kamera.');
      }
      return false;
    }
  }, [permission, video, audio, setActiveStream]);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      setActiveStream(null);
    }
  }, [setActiveStream]);

  // Hentikan semua track kamera saat komponen dilepas.
  useEffect(() => {
    return () => stop();
  }, [stop]);

  return {
    permission,
    error,
    started,
    stream,
    start,
    stop,
    setPermission,
    setError,
  };
}