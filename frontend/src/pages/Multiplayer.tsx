import React, { useState, useEffect, useRef } from 'react';
import {
  Users, Plus, LogIn, KeyRound, DoorOpen, Check, X,
  Wifi, Monitor, Smartphone, Globe, Server, Camera
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SkeletonOverlay, type Landmark } from '../components/SkeletonOverlay';
import { Button, Card, Input, Pill, PillIndicator, PillContent, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';

interface RemotePlayer {
  guest_key?: string | null;
  user_id?: number | null;
  display_name: string;
  warna: string;
  is_host?: boolean;
  landmarks: Landmark[] | null;
}

const API_URL = () => import.meta.env?.VITE_API_URL || 'http://localhost:8042';

// Fallback / demo skeleton so lobby is alive even before camera data arrives
function generateIdleLandmarks(time: number): Landmark[] {
  const lms: Landmark[] = [];
  for (let i = 0; i < 33; i++) lms.push({ x: 0.5, y: 0.5, z: 0, visibility: 0.8 });
  const bob = Math.sin(time / 600) * 0.008;
  const shoulderY = 0.42 + bob;
  lms[0] = { x: 0.5, y: 0.3, z: 0, visibility: 0.95 };
  lms[7] = { x: 0.44, y: 0.33, z: 0, visibility: 0.95 };
  lms[8] = { x: 0.56, y: 0.33, z: 0, visibility: 0.95 };
  lms[11] = { x: 0.45, y: shoulderY, visibility: 0.95 };
  lms[12] = { x: 0.55, y: shoulderY, visibility: 0.95 };
  lms[13] = { x: 0.4, y: shoulderY + 0.16, visibility: 0.9 };
  lms[14] = { x: 0.6, y: shoulderY + 0.16, visibility: 0.9 };
  lms[15] = { x: 0.36, y: shoulderY + 0.32, visibility: 0.9 };
  lms[16] = { x: 0.64, y: shoulderY + 0.32, visibility: 0.9 };
  lms[23] = { x: 0.46, y: 0.75, visibility: 0.95 };
  lms[24] = { x: 0.54, y: 0.75, visibility: 0.95 };
  lms[25] = { x: 0.46, y: 0.86, visibility: 0.9 };
  lms[26] = { x: 0.54, y: 0.86, visibility: 0.9 };
  lms[27] = { x: 0.46, y: 0.96, visibility: 0.9 };
  lms[28] = { x: 0.54, y: 0.96, visibility: 0.9 };
  return lms;
}

function getBrowserInfo(): string {
  const ua = navigator.userAgent;
  const browsers = [
    ['Edg/', 'Edge'], ['Chrome/', 'Chrome'], ['Firefox/', 'Firefox'],
    ['Safari/', 'Safari'], ['OPR/', 'Opera'], ['MSIE', 'IE'],
  ];
  for (const [token, name] of browsers) {
    if (ua.includes(token)) {
      const m = ua.match(new RegExp(`${token.replace('/', '\\/')}([\\d.]+)`));

      if (m) return `${name} ${m[1]}`;
      return name;
    }
  }
  return 'Browser';
}

function getOsInfo(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  return 'OS';
}

export const Multiplayer: React.FC = () => {
  const { user } = useAuth();

  const [mode, setMode] = useState<'lobby' | 'room'>('lobby');
  const [tab, setTab] = useState<'create' | 'join'>('create');

  // create/join form state
  const [roomName, setRoomName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedColor, setSelectedColor] = useState('#22c55e');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // room state
  const [room, setRoom] = useState<any>(null);
  const [guestKey, setGuestKey] = useState<string>('');
  const [players, setPlayers] = useState<Record<string, RemotePlayer>>({});
  const [myPlayerKey, setMyPlayerKey] = useState<string>('');

  const wsRef = useRef<WebSocket | null>(null);
  const colorPoolRef = useRef<string[]>([]);

  // local camera + pose
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [camStarted, setCamStarted] = useState(false);
  const [localLandmarks, setLocalLandmarks] = useState<Landmark[] | null>(null);

  const browserInfo = getBrowserInfo();
  const osInfo = getOsInfo();

  // location / header-like session info (client proxy of request headers)
  const sessionMeta = {
    browser: browserInfo,
    os: osInfo,
    language: navigator.language?.split('-')[0] || 'en',
    screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
  };

  const fetchColors = async () => {
    try {
      const res = await fetch(`${API_URL()}/api/multiplayer/colors`);
      if (res.ok) {
        const data = await res.json();
        colorPoolRef.current = data.colors;
        setSelectedColor(data.colors[0]);
      }
    } catch { /* offline */ }
  };

  useEffect(() => { fetchColors(); }, []);

  useEffect(() => {
    if (user) {
      setDisplayName(user.nama);
    } else {
      setDisplayName('Player_' + Math.floor(1000 + Math.random() * 9000));
    }
  }, [user]);

  // Register local skeleton broadcast via WebSocket timer
  useEffect(() => {
    if (mode !== 'room' || !camStarted || !localLandmarks) return;
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN && localLandmarks && localLandmarks.length >= 25) {
        wsRef.current.send(JSON.stringify({
          landmarks: localLandmarks,
          tipe_pose: 'duduk_tegak',
        }));
      }
    }, 80);
    return () => clearInterval(interval);
  }, [mode, camStarted, localLandmarks]);

  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamStarted(true);
    } catch {
      setCamStarted(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCamStarted(false);
  };

  // Fallback idle skeleton loop (when camera off, still show own skeleton)
  useEffect(() => {
    if (mode !== 'room') return;
    if (camStarted) return; // real landmarks take over
    const interval = setInterval(() => {
      setLocalLandmarks(generateIdleLandmarks(Date.now()));
    }, 120);
    return () => clearInterval(interval);
  }, [mode, camStarted]);

  // Stop camera & close WS on unmount to release hardware
  useEffect(() => {
    return () => {
      stopCamera();
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.close();
    };
  }, []);

  const currentKey = () => (guestKey || (user ? `u:${user.user_id}` : ''));

  const connectWS = (code: string) => {
    const apiUrl = API_URL();
    const wsBase = apiUrl.replace(/^http/, 'ws');
    const socket = new WebSocket(`${wsBase}/api/multiplayer/ws/${code}`);
    wsRef.current = socket;
    socket.onopen = () => {
      socket.send(JSON.stringify({
        guest_key: guestKey,
        user_id: user?.user_id || null,
        display_name: displayName,
        warna: selectedColor,
      }));
    };
    // Unify identity key: guests keyed by bare guest_key, logged-in users keyed by "u:<id>".
    // Both sides of WS messages and the room-player seed must use this same scheme.
    socket.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'skeleton') {
          const key = msg.guest_key || (msg.user_id ? `u:${msg.user_id}` : '');
          if (key) {
            setPlayers((prev) => ({ ...prev, [key]: { guest_key: msg.guest_key, user_id: msg.user_id, display_name: msg.display_name, warna: msg.warna, landmarks: msg.landmarks } }));
          }
        } else if (msg.type === 'presence') {
          const key = msg.guest_key || (msg.user_id ? `u:${msg.user_id}` : '');
          if (key) {
            setPlayers((prev) => ({ ...prev, [key]: { guest_key: msg.guest_key, user_id: msg.user_id, display_name: msg.display_name, warna: msg.warna, landmarks: null } }));
          }
        } else if (msg.type === 'leave') {
          const key = msg.guest_key || (msg.user_id ? `u:${msg.user_id}` : '');
          setPlayers((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        }
      } catch { /* ignore */ }
    };
    socket.onclose = () => { wsRef.current = null; };
    socket.onerror = () => { /* ignore */ };
  };

  const leaveRoom = () => {
    stopCamera();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.close();
    wsRef.current = null;
    setRoom(null);
    setPlayers({});
    setMyPlayerKey('');
    setCamStarted(false);
    setMode('lobby');
    setError(null);
  };

  const handleCreate = async () => {
    setError(null);
    if (!roomName.trim()) { setError('Nama room wajib diisi.'); return; }
    if (password.length < 4) { setError('Password minimal 4 karakter.'); return; }
    if (password !== confirmPassword) { setError('Konfirmasi password tidak cocok.'); return; }
    if (!displayName.trim()) { setError('Nama tampilan wajib diisi.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL()}/api/multiplayer/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama: roomName, password, display_name: displayName, warna: selectedColor, user_id: user?.user_id || null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.detail || 'Gagal membuat room.'); return; }
      setGuestKey(data.guest_key);
      setMyPlayerKey(data.guest_key);
      setRoom(data);
      setMode('room');
      connectWS(data.room_code);
    } catch { setError('Tidak dapat terhubung ke server.'); } finally { setLoading(false); }
  };

  const handleJoin = async () => {
    setError(null);
    if (!roomCode.trim()) { setError('Kode room wajib diisi.'); return; }
    if (!password) { setError('Password wajib diisi.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL()}/api/multiplayer/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_code: roomCode, password, display_name: displayName, warna: selectedColor, user_id: user?.user_id || null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.detail || 'Gagal masuk room.'); return; }
      setGuestKey(data.guest_key);
      setMyPlayerKey(data.guest_key);
      setRoom(data);
      setMode('room');
      connectWS(data.room_code);
      // Seed existing players from room response
      const seed: Record<string, RemotePlayer> = {};
      data.players?.forEach((p: any) => {
        const key = p.user_id ? `u:${p.user_id}` : (p.guest_key || '');
        seed[key] = { ...p, landmarks: null };
      });
      setPlayers(seed);
    } catch { setError('Tidak dapat terhubung ke server.'); } finally { setLoading(false); }
  };

  // ---------- RENDER ----------
  if (mode === 'room' && room) {
    const participants: RemotePlayer[] = [];
    // add self
    participants.push({ display_name: `${displayName} (Anda)`, warna: selectedColor, is_host: true, landmarks: localLandmarks });
    // add remote players
    Object.entries(players).forEach(([key, p]) => {
      if (key === currentKey()) return;
      participants.push({ ...p });
    });

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-8">
        {/* Room header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Pill variant="success" size="md">
                <PillIndicator variant="success" pulse />
                <PillContent>ROOM AKTIF</PillContent>
              </Pill>
              <Badge variant="info" className="font-mono">#{room.room_code}</Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {room.nama}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {participants.length} pemain terhubung · Bagikan kode room untuk mengundang teman
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700/60">
              <Wifi size={14} className="text-emerald-500" />
              <span className="hidden sm:inline font-mono">{room.room_code}</span>
              <button
                onClick={() => navigator.clipboard?.writeText(room.room_code)}
                className="text-blue-500 hover:underline font-semibold cursor-pointer"
              >Salin</button>
            </div>
            <Button variant="destructive" size="sm" onClick={leaveRoom} className="text-xs">
              <X size={14} /> Keluar
            </Button>
          </div>
        </div>

        {/* Session log banner (guest identification) */}
        <Card className="p-4 mb-6 bg-slate-50 dark:bg-slate-900/40">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <Globe size={14} className="text-blue-500" />
            <span className="font-semibold text-slate-900 dark:text-white">Sesi Anda:</span>
            <span className="flex items-center gap-1.5"><Monitor size={13} className="text-slate-400" /> {browserInfo}</span>
            <span className="flex items-center gap-1.5"><Smartphone size={13} className="text-slate-400" /> {osInfo}</span>
            <span className="flex items-center gap-1.5"><Globe size={13} className="text-slate-400" /> {sessionMeta.language.toUpperCase()}</span>
            <span className="flex items-center gap-1.5"><Monitor size={13} className="text-slate-400" /> {sessionMeta.screen}</span>
          </div>
        </Card>

        {/* Camera toggle */}
        <div className="flex items-center gap-2 mb-6">
          <Button variant={camStarted ? "success" : "outline"} size="sm" onClick={startCamera} className="text-xs">
            <Camera size={14} /> {camStarted ? 'Webcam Aktif' : 'Aktifkan Kamera (Kirim Skeleton)'}
          </Button>
          <span className="text-[11px] text-slate-400">Skeleton Anda muncul real-time untuk pemain lain.</span>
        </div>

        {/* Players grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {participants.map((p, idx) => (
            <Card key={idx} className="p-2 relative overflow-hidden bg-slate-950 border-slate-800">
              <div className="relative w-full h-64 rounded-lg bg-slate-950 flex items-center justify-center overflow-hidden border border-slate-800">
                <SkeletonOverlay
                  landmarks={p.landmarks}
                  width={280}
                  height={256}
                  status="bagus"
                  orientasi="frontal"
                  showAngles={false}
                  color={p.warna}
                />
                {/* Name tag */}
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between px-2 py-1 rounded-lg" style={{ backgroundColor: `${p.warna}22`, border: `1px solid ${p.warna}55` }}>
                  <span className="text-xs font-bold text-white truncate">{p.display_name}</span>
                  <span className="flex gap-1">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.warna }} />
                    {p.is_host && <Badge variant="info" className="text-[9px] h-4 px-1.5">HOST</Badge>}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ---------- LOBBY / create-join ----------
  const isColorTaken = (c: string) => room?.players?.some((p: any) => p.warna === c);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-10">
      {/* Header */}
      <div className="text-center mb-10">
        <Pill variant="info" size="md" className="mb-3">
          <Users size={14} />
          <PillContent>MULTIPLAYER POSE ROOM</PillContent>
        </Pill>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Room Kelompok Postur
        </h1>
        <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-2 max-w-xl mx-auto">
          Buat atau bergabung dengan room untuk bertemu pemain lain secara real-time.
          Setiap pemain memiliki skeleton & warna persona unik.
        </p>
      </div>

      {/* Session identification card (guest / logged-in) */}
      <Card className="p-5 mb-8">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white mb-3">
          <Server size={16} className="text-blue-500" />
          <span>Identitas Sesi</span>
        </div>
        {user ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-semibold text-slate-900 dark:text-white">Masuk sebagai {user.nama}</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5"><Globe size={13} className="text-blue-500" /> IP: {myPlayerKey ? 'tersimpan' : 'dari header'}</span>
            <span className="flex items-center gap-1.5"><Monitor size={13} className="text-slate-400" /> {browserInfo}</span>
            <span className="flex items-center gap-1.5"><Smartphone size={13} className="text-slate-400" /> {osInfo} · {sessionMeta.language.toUpperCase()}</span>
            <Pill variant="warning" size="sm">
              <PillIndicator variant="warning" />
              <PillContent>Mode Tamu — dilacak via IP + browser</PillContent>
            </Pill>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Create room */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
              <Plus size={16} />
            </span>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Buat Room</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Jadilah host dan undang pemain lain.</p>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1.5">Nama Room</label>
              <Input type="text" value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="Misal: Sesu Dada Tim" />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1.5">Password</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 4 karakter" />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1.5">Konfirmasi Password</label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Ulangi password" />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1.5">Nama Tampilan</label>
              <Input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Nama yang dilihat pemain lain" />
            </div>

            <ColorPickerColor
              value={selectedColor}
              onChange={setSelectedColor}
              taken={room?.players?.map((p: any) => p.warna) || []}
            />

            <Button variant="default" size="lg" className="w-full mt-2" disabled={loading} onClick={handleCreate}>
              <Plus size={16} /> {loading ? 'Membuat...' : 'Buat Room'}
            </Button>
          </div>
        </Card>

        {/* Join room */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <LogIn size={16} />
            </span>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Gabung Room</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Masukkan kode & password dari host.</p>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1.5">Kode Room</label>
              <Input type="text" value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} placeholder="Contoh: A1B2C3" />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1.5">Password</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password room" />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1.5">Nama Tampilan</label>
              <Input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Nama yang dilihat pemain lain" />
            </div>

            <ColorPickerColor
              value={selectedColor}
              onChange={setSelectedColor}
              taken={room?.players?.map((p: any) => p.warna) || []}
            />

            <Button variant="success" size="lg" className="w-full mt-2" disabled={loading} onClick={handleJoin}>
              <DoorOpen size={16} /> {loading ? 'Masuk...' : 'Gabung Room'}
            </Button>
          </div>
        </Card>
      </div>

      {error && (
        <div className="mt-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-sm text-rose-700 dark:text-rose-400">
          <KeyRound size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setError(null)}><X size={14} /></Button>
        </div>
      )}
    </div>
  );
};

function ColorPickerColor({ value, onChange, taken }: { value: string; onChange: (c: string) => void; taken: string[] }) {
  const colors = ['#22c55e', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
  return (
    <div>
      <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1.5">Warna Persona (unik per room)</label>
      <div className="flex flex-wrap gap-2">
        {colors.map((c) => {
          const isTaken = taken.includes(c);
          const active = value === c;
          return (
            <button
              key={c}
              type="button"
              disabled={isTaken && !active}
              onClick={() => onChange(c)}
              title={isTaken ? 'Warna sudah dipakai pemain lain' : 'Pilih warna ini'}
              className={cn(
                'w-10 h-10 rounded-xl border-2 transition-all cursor-pointer relative',
                active ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'hover:scale-105',
                isTaken && !active && 'opacity-30 cursor-not-allowed'
              )}
              style={{ backgroundColor: c, borderColor: active ? c : 'transparent' }}
            >
              {active && <Check size={16} className="absolute inset-0 m-auto text-white drop-shadow" />}
              {isTaken && !active && <X size={16} className="absolute inset-0 m-auto text-white drop-shadow" />}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-400 mt-1.5">Warna yang dicoret sudah dipakai pemain lain dan tidak dapat digunakan.</p>
    </div>
  );
}