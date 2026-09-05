import React from 'react';
import {
  Camera, CameraOff, AlertTriangle, RefreshCw, Shield,
} from 'lucide-react';

interface CameraPermissionProps {
  permission: 'idle' | 'prompt' | 'granted' | 'denied';
  error: string | null;
  onRequestCamera: () => void;
}

export function CameraPermission({ permission, error, onRequestCamera }: CameraPermissionProps) {
  if (permission === 'granted') return null;

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm rounded-lg border border-slate-800">
      <div className="flex flex-col items-center max-w-xs text-center px-6">
        {permission === 'denied' ? (
          <>
            <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mb-4 border border-red-500/30">
              <CameraOff size={28} className="text-red-400" />
            </div>
            <h3 className="text-sm font-bold font-mono text-red-400 mb-2">
              KAMERA TIDAK DIAKSES
            </h3>
            <p className="text-xs font-mono text-slate-400 leading-relaxed mb-4">
              {error || 'Izin kamera ditolak oleh browser.'}
            </p>
            <div className="text-[11px] font-mono text-slate-500 leading-relaxed mb-4 bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-left w-full">
              <p className="text-slate-400 font-semibold mb-1">Cara mengaktifkan:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Pastikan halaman diakses via <strong className="text-emerald-400">HTTPS</strong> atau
                  <code className="text-emerald-400">localhost</code> (kamera diblokir di HTTP/IP, bukan
                  masalah server &mdash; ini aturan secure-context browser).
                  Jika pakai IP host: <code className="text-blue-300">make certs</code> lalu buka
                  <code className="text-blue-300"> https://&lt;ip&gt;:3042</code></li>
                <li>Klik ikon 🔒 atau ℹ️ di address bar browser → Kamera → <strong className="text-emerald-400">Izinkan</strong></li>
                <li>Muat ulang halaman</li>
              </ol>
            </div>
            <button
              onClick={onRequestCamera}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-2"
            >
              <RefreshCw size={14} />
              Coba Lagi
            </button>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-full bg-blue-500/20 flex items-center justify-center mb-4 border border-blue-500/30">
              <Camera size={28} className="text-blue-400" />
            </div>
            <h3 className="text-sm font-bold font-mono text-blue-400 mb-2">
              AKSES KAMERA DIPERLUKAN
            </h3>
            <p className="text-xs font-mono text-slate-400 leading-relaxed mb-2">
              Aplikasi ini membutuhkan akses kamera untuk memantau postur tubuh secara real-time.
            </p>
            {error && (
              <p className="text-xs font-mono text-amber-400 mb-2 flex items-center gap-1.5 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
                <AlertTriangle size={12} />
                {error}
              </p>
            )}
            <button
              onClick={onRequestCamera}
              className="mt-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-600/30"
            >
              <Shield size={14} />
              Aktifkan Kamera
            </button>
            <p className="mt-3 text-[10px] font-mono text-slate-500">
              Browser akan menampilkan dialog izin secara otomatis.
            </p>
          </>
        )}
      </div>
    </div>
  );
}