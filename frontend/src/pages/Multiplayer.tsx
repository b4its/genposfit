import React, { useState, useEffect, useRef } from 'react';
import {
  Users, Plus, LogIn, KeyRound, DoorOpen, Check, X,
  Wifi, Monitor, Smartphone, Globe, Server, Camera, Swords, Star, Target as TargetIcon,
  AlertOctagon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getApiUrl, getWsUrl } from '../lib/api';
import { SkeletonOverlay, type Landmark } from '../components/SkeletonOverlay';
import { usePoseDetector } from '../hooks/usePoseDetector';
import { Button, Card, Input, Pill, PillIndicator, PillContent, Badge, Select } from '@/components/ui';
import { cn } from '@/lib/utils';
import { Crown } from 'lucide-react';

interface RemotePlayer {
  guest_key?: string | null;
  user_id?: number | null;
  display_name: string;
  warna: string;
  is_host?: boolean;
  landmarks: Landmark[] | null;
}

const API_URL = getApiUrl;

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

// Identitas sesi unik & stabil per browser (disimpan di localStorage).
// Ini menjamin setiap pemain memiliki key unik walau berbagi IP/User-Agent,
// sehingga skeleton antar pemain tidak pernah bentrok/ter-double.
function getClientId(): string {
  const LS_KEY = 'genposfit_client_id';
  let id = localStorage.getItem(LS_KEY) || '';
  if (!id) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      id = crypto.randomUUID();
    } else {
      id = 'c' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    }
    try { localStorage.setItem(LS_KEY, id); } catch { /* storage unavailable */ }
  }
  return id;
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
  const [maxScore, setMaxScore] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // room state
  const [room, setRoom] = useState<any>(null);
  const [guestKey, setGuestKey] = useState<string>('');
  const [players, setPlayers] = useState<Record<string, RemotePlayer>>({});
  const [myPlayerKey, setMyPlayerKey] = useState<string>('');

  const wsRef = useRef<WebSocket | null>(null);
  const colorPoolRef = useRef<string[]>([]);
  const roomRef = useRef<any>(null);
  const clientIdRef = useRef<string>(getClientId());
  useEffect(() => { roomRef.current = room; }, [room]);

  // local camera + pose
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [camStarted, setCamStarted] = useState(false);
  const [localLandmarks, setLocalLandmarks] = useState<Landmark[] | null>(null);
  const { landmarks: poseLandmarks } = usePoseDetector(videoRef, camStarted);

  // Battle state
  const [battleExercises, setBattleExercises] = useState<any[]>([]);
  const [selectedBattleMove, setSelectedBattleMove] = useState<any | null>(null);
  const [battleScores, setBattleScores] = useState<Record<string, number>>({});
  const [battlePoints, setBattlePoints] = useState<Record<string, number>>({});
  const [winnerKey, setWinnerKey] = useState<string | null>(null);
  const [myBattleScore, setMyBattleScore] = useState<number>(0);
  const [challengeIds, setChallengeIds] = useState<number[]>([]);

  const browserInfo = getBrowserInfo();
  const osInfo = getOsInfo();

  // location / header-like session info (client proxy of request headers)
  const sessionMeta = {
    browser: browserInfo,
    os: osInfo,
    language: navigator.language?.split('-')[0] || 'en',
    screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
  };

const loadBattleMoves = async () => {
    try {
      const res = await fetch(`${API_URL()}/api/exercises/types`);
      if (res.ok) {
        const types = await res.json();
        const all: any[] = [];
        types.forEach((t: any) => {
          (t.children || []).forEach((c: any) => all.push({ ...c, type: t.nama, type_id: t.type_id }));
        });
        if (all.length === 0) {
          const res2 = await fetch(`${API_URL()}/api/exercises`);
          if (res2.ok) {
            const flat = await res2.json();
            all.push(...flat);
          }
        }
        const filtered = all
          .filter((e: any) => e.skeleton_data && e.skeleton_data.length >= 25)
          .sort((a: any, b: any) => (b.is_battle ? 1 : 0) - (a.is_battle ? 1 : 0));
        setBattleExercises(filtered);
        return filtered;
      } else {
        const res2 = await fetch(`${API_URL()}/api/exercises`);
        if (res2.ok) {
          const flat = await res2.json();
          const filtered = flat
            .filter((e: any) => e.skeleton_data && e.skeleton_data.length >= 25)
            .sort((a: any, b: any) => (b.is_battle ? 1 : 0) - (a.is_battle ? 1 : 0));
          setBattleExercises(filtered);
          return filtered;
        }
      }
    } catch { /* ignore */ }
    return [];
  };

  // Setelah battle exercises loaded, terapkan challenge dari room
  useEffect(() => {
    if (battleExercises.length > 0 && room?.challenge_exercise_ids?.length > 0) {
      applyChallengeIds(room.challenge_exercise_ids);
    }
  }, [battleExercises.length, room?.challenge_exercise_ids?.length]);

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

  useEffect(() => {
    fetchColors();
    loadBattleMoves();
  }, []);

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

  const [camError, setCamError] = useState<string | null>(null);

  const startCamera = async () => {
    if (camStarted) {
      // Matikan kamera
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream)?.getTracks();
        tracks?.forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
      setCamStarted(false);
      setLocalLandmarks(null);
      return;
    }
    if (!window.isSecureContext) {
      setCamError('Akses kamera membutuhkan HTTPS — akses aplikasi lewat https:// atau localhost.');
      return;
    }
    setCamError(null);
    setCamStarted(true);
  };

  // Synkronkan landmark MediaPipe nyata ke localLandmarks (untuk broadcast & battle)
  useEffect(() => {
    if (camStarted && poseLandmarks && poseLandmarks.length >= 25) {
      setLocalLandmarks(poseLandmarks);
    }
  }, [camStarted, poseLandmarks]);

  // Fallback idle skeleton loop (when camera off, still show own skeleton)
  useEffect(() => {
    if (mode !== 'room') return;
    if (camStarted) return; // real landmarks take over
    const interval = setInterval(() => {
      setLocalLandmarks(generateIdleLandmarks(Date.now()));
    }, 120);
    return () => clearInterval(interval);
  }, [mode, camStarted]);

  // Scoring loop for battle: periodically evaluate my pose vs selected battle move
  const scoreMyMove = async () => {
    if (!selectedBattleMove || !localLandmarks || localLandmarks.length < 25) return;
    try {
      const res = await fetch(`${API_URL()}/api/exercises/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landmarks: localLandmarks, exercise_id: selectedBattleMove.exercise_id }),
      });
      if (res.ok) {
        const data = await res.json();
        setMyBattleScore(data.score || 0);
        if (wsRef.current?.readyState === WebSocket.OPEN && data.score >= 60) {
          // +1 poin setiap kecocokan terhadap gerakan aktif yang sedang ditantangkan
          const pts = data.score >= 85 ? 1 : 0;
          wsRef.current.send(JSON.stringify({
            type: 'battle_score',
            score: data.score,
            points: pts,
            move_name: selectedBattleMove.nama,
          }));
          // Broadcast excl sender → catat poin sendiri secara lokal di papan skor
          if (pts > 0) {
            const me = currentKey();
            if (me) {
              setBattlePoints(prev => {
                const next: Record<string, number> = { ...prev, [me]: (prev[me] || 0) + pts };
                const limit = roomRef.current?.max_score || maxScore;
                if (next[me] >= limit) setWinnerKey(me);
                return next;
              });
            }
          }
        }
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (mode !== 'room' || !selectedBattleMove) return;
    const interval = setInterval(scoreMyMove, 2000);
    return () => clearInterval(interval);
  }, [mode, selectedBattleMove, localLandmarks]);

  // Sinkronkan challenge (daftar gerakan) yang dipilih host
  const applyChallengeIds = (ids: number[] | undefined | null) => {
    if (!ids || !Array.isArray(ids)) return;
    setChallengeIds(ids);
    // Set move aktif = gerakan pertama yang dipilih host
    const first = battleExercises.find(m => m.exercise_id === ids[0]);
    if (first) setSelectedBattleMove(first);
  };

  // Host memilih/membatalkan tantangan → simpan ke backend & broadcast
  const persistChallenges = async (ids: number[]) => {
    if (!roomRef.current?.room_code) return;
    try {
      const res = await fetch(`${API_URL()}/api/multiplayer/rooms/${roomRef.current.room_code}/challenges`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_exercise_ids: ids, guest_key: guestKey }),
      });
      if (res.ok) {
        const data = await res.json();
        setRoom(data);
      }
    } catch { /* ignore */ }
  };

  const currentKey = () => (guestKey || (user ? `u:${user.user_id}` : ''));
  const playerKey = (p: any) => (p?.guest_key || (p?.user_id ? `u:${p.user_id}` : '') || '');
  const isHost = () => {
    const myKey = currentKey();
    if (!room?.players) return false;
    return room.players.some((p: any) => {
      const pKey = playerKey(p);
      return pKey === myKey && p.is_host;
    });
  };

  const toggleChallenge = (exerciseId: number) => {
    setChallengeIds(prev => {
      const next = prev.includes(exerciseId) ? prev.filter(id => id !== exerciseId) : [...prev, exerciseId];
      // Hanya host yang boleh mengatur; kirim via WS lalu simpan via REST
      if (isHost()) {
        setTimeout(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'challenge_update', challenge_exercise_ids: next }));
          }
          persistChallenges(next);
        }, 0);
      }
      return next;
    });
  };

  const connectWS = (code: string, key?: string, name?: string, color?: string) => {
    const socket = new WebSocket(`${getWsUrl()}/api/multiplayer/ws/${code}`);
    wsRef.current = socket;
    // Gunakan nilai fresh (dari parameter) agar tidak stale saat join/create baru.
    const activeKey = key || guestKey;
    const activeName = name || displayName;
    const activeColor = color || selectedColor;
    socket.onopen = () => {
      socket.send(JSON.stringify({
        guest_key: activeKey,
        user_id: user?.user_id || null,
        display_name: activeName,
        warna: activeColor,
      }));
    };
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
        } else if (msg.type === 'battle_score') {
          const key = msg.guest_key || (msg.user_id ? `u:${msg.user_id}` : '');
          if (key && key !== currentKey()) {
            setBattleScores(prev => ({ ...prev, [key]: msg.score }));
            setBattlePoints(prev => {
              const next: Record<string, number> = { ...prev, [key]: (prev[key] || 0) + (msg.points || 0) };
              const limit = roomRef.current?.max_score || maxScore;
              const champ = Object.keys(next).find(k => next[k] >= limit);
              if (champ) setWinnerKey(champ);
              return next;
            });
          }
        } else if (msg.type === 'challenge_update') {
          // Hanya host yang boleh mengirim; semua (termasuk host) terapkan
          applyChallengeIds(msg.challenge_exercise_ids);
          if (wsRef.current?.readyState === WebSocket.OPEN && msg.guest_key !== guestKey) {
            // Non-host: minta snapshot room terbaru
            fetch(`${API_URL()}/api/multiplayer/rooms/${roomRef.current?.room_code}`).then(r => r.json()).then(d => { if (d) setRoom(d); }).catch(() => {});
          }
        } else if (msg.type === 'room_update') {
          if (msg.room) {
            setRoom(msg.room);
            applyChallengeIds(msg.room.challenge_exercise_ids);
            // Rebuild daftar pemain otoritatif dari server agar tidak ada
            // player "hantu" (yang sudah keluar) atau duplikasi key.
            setPlayers((prev) => {
              const next: Record<string, RemotePlayer> = {};
              (msg.room.players || []).forEach((p: any) => {
                const key = playerKey(p);
                if (!key) return;
                next[key] = { ...(prev[key] || {}), guest_key: p.guest_key, user_id: p.user_id, display_name: p.display_name, warna: p.warna, is_host: p.is_host, landmarks: prev[key]?.landmarks ?? null };
              });
              return next;
            });
          }
        }
      } catch { /* ignore */ }
    };
    socket.onclose = () => { wsRef.current = null; };
    socket.onerror = () => { /* ignore */ };
  };

  const leaveRoom = () => {
    // Bersihkan data sesi dari DB agar pemain tidak "hantu" di room
    try {
      const rc = roomRef.current;
      if (rc?.room_code && guestKey) {
        fetch(`${API_URL()}/api/multiplayer/leave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room_code: rc.room_code, guest_key: guestKey, client_id: clientIdRef.current }),
        }).catch(() => {});
      }
    } catch {}
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.close();
    wsRef.current = null;
    setRoom(null);
    setPlayers({});
    setMyPlayerKey('');
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream)?.getTracks();
      tracks?.forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setCamStarted(false);
    setMode('lobby');
    setError(null);
    setSelectedBattleMove(null);
    setBattleScores({});
    setBattlePoints({});
    setWinnerKey(null);
    setMyBattleScore(0);
    setChallengeIds([]);
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
        body: JSON.stringify({ nama: roomName, password, display_name: displayName, warna: selectedColor, user_id: user?.user_id || null, max_score: maxScore, client_id: clientIdRef.current }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.detail || 'Gagal membuat room.'); return; }
      setGuestKey(data.guest_key);
      setMyPlayerKey(data.guest_key);
      setRoom(data);
      setMode('room');
      setChallengeIds(data.challenge_exercise_ids || []);
      connectWS(data.room_code, data.guest_key, displayName, selectedColor);
      loadBattleMoves();
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
        body: JSON.stringify({ room_code: roomCode, password, display_name: displayName, warna: selectedColor, user_id: user?.user_id || null, client_id: clientIdRef.current }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.detail || 'Gagal masuk room.'); return; }
      setGuestKey(data.guest_key);
      setMyPlayerKey(data.guest_key);
      setRoom(data);
      setMode('room');
      setChallengeIds(data.challenge_exercise_ids || []);
      connectWS(data.room_code, data.guest_key, displayName, selectedColor);
      // Seed existing players from room response (key konsisten: guest_key dulu)
      const seed: Record<string, RemotePlayer> = {};
      data.players?.forEach((p: any) => {
        const key = playerKey(p);
        if (key) seed[key] = { ...p, landmarks: null };
      });
      setPlayers(seed);
      loadBattleMoves();
    } catch { setError('Tidak dapat terhubung ke server.'); } finally { setLoading(false); }
  };

  // ---------- RENDER ----------
  if (mode === 'room' && room) {
    const participants: RemotePlayer[] = [];
    // Self — status host diambil dari state room yang otoritatif (bukan selalu true)
    const myKey = currentKey();
    const selfIsHost = (room.players || []).some((p: any) => playerKey(p) === myKey && p.is_host);
    participants.push({ display_name: `${displayName} (Anda)`, warna: selectedColor, is_host: selfIsHost, landmarks: localLandmarks });
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
            <span className="flex items-center gap-1.5"><Globe size={13} className="text-slate-400" /> {sessionMeta.screen}</span>
          </div>
        </Card>

        {/* Camera toggle */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <Button variant={camStarted ? "success" : "outline"} size="sm" onClick={startCamera} className="text-xs">
            <Camera size={14} /> {camStarted ? 'Webcam Aktif' : 'Aktifkan Kamera (Kirim Skeleton)'}
          </Button>
          <span className="text-[11px] text-slate-400">Skeleton Anda muncul real-time untuk pemain lain.</span>
          {camError && (
            <span className="w-full text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1">
              <AlertOctagon size={12} /> {camError}
            </span>
          )}
        </div>

        {/* Sumber frame tersembunyi utk MediaPipe Camera saat webcam aktif
            (detektor butuh elemen <video>; tanpa ini landmark tidak mengalir). */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute h-px w-px opacity-0 pointer-events-none"
          aria-hidden
        />

        {/* Battle Panel */}
        <Card className="p-5 mb-6 border-purple-500/30">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-500">
                <Swords size={16} />
              </span>
              <div>
                <div className="text-sm font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                  Mode Battle
                  <Star size={14} />
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Target menang: {room?.max_score || maxScore} poin · Pemain dengan poin tertinggi memenangkan battle
                </div>
              </div>
            </div>
            {/* Her score */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs">
              <Star size={13} className="text-purple-400" />
              <span className="font-mono font-bold text-purple-600 dark:text-purple-400">Skor saya: {myBattleScore}</span>
            </div>
          </div>

          {/* Battle move selector */}
          {battleExercises.length > 0 ? (
            <div className="mb-4">
              <label className="block text-xs text-slate-600 dark:text-slate-300 font-medium mb-1.5">
                {isHost()
                  ? 'Pilih Gerakan Battle (klik untuk pilih, support multi-select)'
                  : 'Gerakan Battle yang Ditantangkan Host'}
              </label>
              {/* Show selected challenge IDs first, then unselected */}
              <div className="flex flex-wrap gap-2">
                {(['selected', 'unselected'] as const).map(group => (
                  battleExercises
                    .filter(m => group === 'selected' ? challengeIds.includes(m.exercise_id) : !challengeIds.includes(m.exercise_id))
                    .map((m: any) => {
                      const checked = challengeIds.includes(m.exercise_id);
                      const amHost = isHost();
                      return (
                        <Button
                          key={m.exercise_id}
                          type="button"
                          variant={checked ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => {
                            if (!amHost) { setSelectedBattleMove(m); return; }
                            toggleChallenge(m.exercise_id);
                          }}
                          className={cn(
                            "text-xs",
                            challengeIds.length > 0 && challengeIds[0] === m.exercise_id && "ring-2 ring-amber-400"
                          )}
                        >
                          <TargetIcon size={13} className="text-purple-500" />
                          {m.nama}
                          {checked && <Check size={12} className="text-emerald-400" />}
                          {m.type && (
                            <Badge variant="info" className="text-[9px] h-4 px-1">{m.type}</Badge>
                          )}
                        </Button>
                      );
                    })
                ))}
              </div>
              {challengeIds.length > 0 && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5">
                  <Star size={10} className="inline mr-0.5" />
                  {challengeIds.length} gerakan ditantangkan · lakukan gerakan berlabel ⭐ untuk mencocokkan pose
                </p>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 mb-3">
              Belum ada gerakan battle. Admin harus menambah gerakan dengan skeleton-data melalui halaman Kelola Latihan.
            </p>
          )}

          {/* Battle leaderboard */}
          {Object.keys(battlePoints).length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Papan Skor Battle</div>
              {Object.entries(battlePoints).map(([key, pts]) => {
                const p = players[key] ?? { display_name: 'Pemain', warna: '#8b5cf6' };
                const isWinner = winnerKey === key;
                return (
                  <div key={key} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800" style={isWinner ? { borderColor: '#f59e0b', backgroundColor: '#f59e0b12' } : undefined}>
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.warna }} />
                      {p.display_name} {isWinner && <Badge variant="warning">PEMENANG!</Badge>}
                    </div>
                    <div className="font-mono font-bold text-purple-600 dark:text-purple-400">{pts} <span className="text-[10px] text-slate-400 font-normal">/ {room?.max_score || maxScore}</span></div>
                  </div>
                );
              })}
            </div>
          )}

          {winnerKey && (
            <div className="mt-3 p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
              <Star size={14} />
              <span><strong>Battle selesai!</strong> {players[winnerKey]?.display_name || 'Pemain'} mencapai batas poin dan memenangkan battle!</span>
            </div>
          )}
        </Card>

        {/* Players grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {participants.map((p, idx) => (
            <Card key={p.guest_key || `u:${p.user_id}` || `anon-${idx}`} className="p-2 relative overflow-hidden bg-slate-950 border-slate-800">
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

            {/* Battle max points (set by room creator / host) */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
                <Swords size={13} className="text-purple-500" />
                Max Skor Battle (jumlah poin menang)
              </label>
              <Input type="number" min={1} max={999} value={String(maxScore)} onChange={(e) => setMaxScore(Math.max(1, Number(e.target.value) || 1))} />
            </div>

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