import React, { useState, useEffect, useRef } from 'react';
import {
  Users, Plus, LogIn, KeyRound, DoorOpen, Check, X,
  Wifi, Monitor, Smartphone, Globe, Server, Camera, Swords, Star, Target as TargetIcon,
  AlertOctagon, Play, Pause, RotateCcw, Dumbbell, Timer, CheckCircle2, Sparkles, Trophy, Activity, User, Flame
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getApiUrl, getWsUrl } from '../lib/api';
import { SkeletonOverlay, type Landmark } from '../components/SkeletonOverlay';
import { usePoseDetector } from '../hooks/usePoseDetector';
import { Button, Card, Input, Pill, PillIndicator, PillContent, Badge, Select, Progress } from '@/components/ui';
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
  const [battlePoin, setBattlePoin] = useState<Record<string, number>>({});
  const [battlePesan, setBattlePesan] = useState<string | null>(null);
  const battleIdRef = useRef<string>('');
  const hasilBattleTerkirim = useRef(false);
  const [myBattleScore, setMyBattleScore] = useState<number>(0);
  const [challengeIds, setChallengeIds] = useState<number[]>([]);

  // Therapy Exercise Session (Solo & Multiplayer)
  const [isExercising, setIsExercising] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentRep, setCurrentRep] = useState(0);
  const [holdTimer, setHoldTimer] = useState(5);
  const [exerciseCompleted, setExerciseCompleted] = useState(false);
  const [poseScores, setPoseScores] = useState<number[]>([]);
  const [currentAccuracy, setCurrentAccuracy] = useState<number>(0);
  const [currentStatus, setCurrentStatus] = useState<'bagus' | 'ringan' | 'buruk' | null>(null);
  const [currentFeedback, setCurrentFeedback] = useState<string | null>(null);
  const [playerProgress, setPlayerProgress] = useState<Record<string, { rep: number; score: number }>>({});
  const activeExerciseRef = useRef<any>(null);
  useEffect(() => { activeExerciseRef.current = selectedBattleMove; }, [selectedBattleMove]);

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

  // Scoring loop: periodically evaluate my pose vs selected therapy / battle move
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
        const score = Math.round(data.score || 0);
        setMyBattleScore(score);
        setCurrentAccuracy(score);
        setCurrentStatus(data.status || (score >= 80 ? 'bagus' : score >= 60 ? 'ringan' : 'buruk'));
        setCurrentFeedback(data.message || (score >= 80 ? 'Postur sangat baik! Pertahankan posisi.' : 'Sesuaikan postur dengan target skeleton.'));
        if (isExercising) {
          setPoseScores(prev => [...prev, score]);
        }

        if (wsRef.current?.readyState === WebSocket.OPEN && score >= 60) {
          // +1 poin setiap kecocokan terhadap gerakan aktif
          const pts = score >= 85 ? 1 : 0;
          wsRef.current.send(JSON.stringify({
            type: 'battle_score',
            score,
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
    const freq = isExercising ? 1200 : 2000;
    const interval = setInterval(scoreMyMove, freq);
    return () => clearInterval(interval);
  }, [mode, selectedBattleMove, localLandmarks, isExercising]);

  // Countdown before exercise begins
  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => (prev !== null ? prev - 1 : null));
      }, 1000);
      return () => clearTimeout(timer);
    }
    // countdown reached 0: Start exercise!
    setCountdown(null);
    setIsExercising(true);
    if (!camStarted) {
      startCamera();
    }
  }, [countdown, camStarted]);

  // Hold timer countdown per repetition
  useEffect(() => {
    if (!isExercising || !selectedBattleMove) return;
    const interval = setInterval(() => {
      setHoldTimer(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isExercising, selectedBattleMove]);

  // Save completed session to backend
  const saveCompletedExerciseSession = async (exerciseId: number, totalReps: number, avgSkor: number) => {
    try {
      const tok = localStorage.getItem('genposfit_token');
      await fetch(`${API_URL()}/api/exercises/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
        },
        body: JSON.stringify({
          user_id: user?.user_id || 1,
          exercise_id: exerciseId,
          total_reps: totalReps,
          avg_skor: avgSkor,
        }),
      });
    } catch { /* ignore */ }
  };

  // Repetition progression & completion check
  useEffect(() => {
    if (!isExercising || holdTimer > 0) return;
    const ex = activeExerciseRef.current || selectedBattleMove;
    if (!ex) return;

    const targetReps = ex.reps || 10;
    setCurrentRep(prevRep => {
      const nextRep = prevRep + 1;
      // Broadcast rep progress to room
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'exercise_rep',
          guest_key: guestKey,
          rep: nextRep,
          total_reps: targetReps,
          score: currentAccuracy,
        }));
      }

      if (nextRep >= targetReps) {
        setTimeout(() => {
          setIsExercising(false);
          setExerciseCompleted(true);
          const scores = poseScores;
          const avg = scores.length
            ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
            : Math.max(80, currentAccuracy || 85);
          saveCompletedExerciseSession(ex.exercise_id, nextRep, avg);
        }, 0);
        return nextRep;
      }
      return nextRep;
    });

    setHoldTimer(ex.durasi_detik || 5);
  }, [holdTimer, isExercising]);

  const handleStartExercise = () => {
    let targetMove = selectedBattleMove;
    if (!targetMove && battleExercises.length > 0) {
      targetMove = challengeIds.length > 0
        ? battleExercises.find(m => m.exercise_id === challengeIds[0]) || battleExercises[0]
        : battleExercises[0];
      setSelectedBattleMove(targetMove);
    }
    if (!targetMove) return;

    if (!camStarted) {
      startCamera();
    }

    setExerciseCompleted(false);
    setCurrentRep(0);
    setHoldTimer(targetMove.durasi_detik || 5);
    setPoseScores([]);
    setCurrentAccuracy(0);
    setCurrentStatus(null);
    setCurrentFeedback(null);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'exercise_start',
        exercise_id: targetMove.exercise_id,
        exercise_name: targetMove.nama,
        reps: targetMove.reps || 10,
        durasi_detik: targetMove.durasi_detik || 5,
      }));
    }

    setCountdown(3);
  };

  const handleStopExercise = () => {
    setIsExercising(false);
    setCountdown(null);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'exercise_stop',
        exercise_id: selectedBattleMove?.exercise_id,
      }));
    }
  };

  const handleResetExercise = () => {
    handleStartExercise();
  };


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
        } else if (msg.type === 'battle_result' && msg.hasil) {
          const h = msg.hasil;
          const map: Record<string, number> = {};
          (h.hasil || []).forEach((x: any) => { map[x.guest_key] = x.poin; });
          setBattlePoin(map);
          setBattlePesan(
            h.status === 'recorded'
              ? `Hadiah dibagikan — pemenang +${h.pemenang?.poin ?? 0} poin!`
              : h.message || 'Hasil battle dicatat.'
          );
        } else if (msg.type === 'battle_result_error') {
          setBattlePesan(`Pencatatan battle ditolak: ${msg.detail}`);
        } else if (msg.type === 'exercise_start') {
          const move = battleExercises.find((m: any) => m.exercise_id === msg.exercise_id);
          if (move) {
            setSelectedBattleMove(move);
            setHoldTimer(msg.durasi_detik || move.durasi_detik || 5);
          }
          setCurrentRep(0);
          setExerciseCompleted(false);
          setCountdown(3);
        } else if (msg.type === 'exercise_stop') {
          setIsExercising(false);
          setCountdown(null);
        } else if (msg.type === 'exercise_rep') {
          const key = msg.guest_key || '';
          if (key && key !== currentKey()) {
            setPlayerProgress(prev => ({
              ...prev,
              [key]: { rep: msg.rep || 0, score: msg.score || 0 }
            }));
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

  // Laporkan hasil battle sekali ke server (WS battle_finished + fallback REST)
  useEffect(() => {
    if (!winnerKey || mode !== 'room' || hasilBattleTerkirim.current) return;
    const rc = roomRef.current;
    if (!rc?.room_code) return;
    hasilBattleTerkirim.current = true;
    const battleId = battleIdRef.current || `${rc.room_code}-${Date.now()}`;
    battleIdRef.current = battleId;
    const total: Record<string, number> = { ...battleScores };
    const kunciSaya = currentKey();
    if (kunciSaya) total[kunciSaya] = battlePoints[kunciSaya] ?? 0;
    const hasil = Object.entries(total).map(([k, pts]) => ({
      guest_key: k, skor: pts, is_pemenang: k === winnerKey,
    }));
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'battle_finished', guest_key: guestKey, battle_id: battleId, hasil }));
    } else {
      fetch(`${API_URL()}/api/multiplayer/rooms/${rc.room_code}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ battle_id: battleId, hasil }),
      })
        .then((r) => r.json())
        .then((d) => {
          const map: Record<string, number> = {};
          (d?.hasil || []).forEach((x: any) => { map[x.guest_key] = x.poin; });
          setBattlePoin(map);
          setBattlePesan(d?.message || 'Hadiah battle dicatat.');
        })
        .catch(() => { hasilBattleTerkirim.current = false; });
    }
  }, [winnerKey, mode, battleScores, battlePoints, guestKey]);

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
    setBattlePoin({});
    setBattlePesan(null);
    hasilBattleTerkirim.current = false;
    battleIdRef.current = '';
    setMyBattleScore(0);
    setChallengeIds([]);
    setIsExercising(false);
    setCountdown(null);
    setCurrentRep(0);
    setExerciseCompleted(false);
    setPoseScores([]);
    setCurrentAccuracy(0);
    setCurrentStatus(null);
    setCurrentFeedback(null);
    setPlayerProgress({});
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

        {/* Latihan Terapi & Battle Panel (Solo & Multiplayer) */}
        <Card className="p-5 mb-6 border-blue-500/30 dark:border-blue-500/20 shadow-md">
          {/* Header & Mode info */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 via-emerald-500/20 to-teal-500/20 border border-blue-500/30 flex items-center justify-center text-blue-500">
                <Dumbbell size={20} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Latihan Terapi Room
                  </h2>
                  {participants.length <= 1 ? (
                    <Pill variant="info" size="sm">
                      <User size={12} />
                      <PillContent>Mode Solo (1 Pemain)</PillContent>
                    </Pill>
                  ) : (
                    <Pill variant="success" size="sm">
                      <Users size={12} />
                      <PillContent>Mode Multiplayer ({participants.length} Pemain)</PillContent>
                    </Pill>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Lakukan terapi koreksi postur biomekanika secara mandiri (solo) atau sinkron bersama pemain lain.
                </p>
              </div>
            </div>

            {/* Action Buttons: Mulai / Hentikan */}
            <div className="flex items-center gap-2">
              {!isExercising && countdown === null ? (
                <Button
                  variant="success"
                  size="default"
                  onClick={handleStartExercise}
                  className="font-bold text-xs sm:text-sm shadow-md flex items-center gap-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white cursor-pointer px-4 py-2.5 transition-all hover:scale-[1.02]"
                >
                  <Play size={16} fill="currentColor" />
                  {participants.length <= 1
                    ? 'Mulai Latihan Terapi (Solo)'
                    : isHost()
                    ? 'Mulai Latihan Bersama (Host)'
                    : 'Mulai Latihan Bersama'}
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="destructive" size="sm" onClick={handleStopExercise} className="text-xs flex items-center gap-1.5 font-bold">
                    <Pause size={14} /> Hentikan
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleResetExercise} className="text-xs flex items-center gap-1">
                    <RotateCcw size={14} /> Reset
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Countdown Overlay / Banner */}
          {countdown !== null && (
            <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-300 flex items-center justify-between gap-4 mb-5 animate-pulse">
              <div className="flex items-center gap-3">
                <Timer size={24} className="text-amber-500 animate-spin" />
                <div>
                  <div className="font-bold text-sm sm:text-base">Bersiap untuk Latihan Terapi!</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Posisikan tubuh Anda di depan kamera. Latihan akan segera dimulai.</div>
                </div>
              </div>
              <div className="text-3xl sm:text-4xl font-black font-mono text-amber-500 px-4 py-1 bg-amber-500/20 rounded-xl">
                {countdown}
              </div>
            </div>
          )}

          {/* In-Session Active Exercise Card */}
          {isExercising && (
            <div className="p-5 rounded-2xl bg-slate-900/95 border border-blue-500/40 text-white mb-6 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold">
                    <Activity size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-white">{selectedBattleMove?.nama || "Latihan Terapi"}</h3>
                      <Badge variant="info" className="text-[10px]">{selectedBattleMove?.type || "Terapi"}</Badge>
                      <Badge variant="success" className="text-[10px] animate-pulse">SESI AKTIF</Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">Target Otot: {selectedBattleMove?.target_otot || "Postur Leher & Punggung"}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Accuracy Meter */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700">
                    <Sparkles size={14} className={currentAccuracy >= 80 ? "text-emerald-400" : "text-amber-400"} />
                    <span className="text-xs font-mono font-bold">
                      Akurasi: <span className={currentAccuracy >= 80 ? "text-emerald-400" : currentAccuracy >= 60 ? "text-amber-400" : "text-rose-400"}>{currentAccuracy}%</span>
                    </span>
                  </div>
                  {/* Reps Counter */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700">
                    <Dumbbell size={14} className="text-blue-400" />
                    <span className="text-xs font-mono font-bold text-blue-300">
                      Rep: {currentRep} / {selectedBattleMove?.reps || 10}
                    </span>
                  </div>
                  {/* Hold Timer */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/20 border border-purple-500/40">
                    <Timer size={14} className="text-purple-400" />
                    <span className="text-xs font-mono font-bold text-purple-300">
                      Tahan: {holdTimer}s
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-[11px] text-slate-400 mb-1.5">
                  <span>Progres Repetisi Latihan</span>
                  <span className="font-mono font-bold">{Math.round((currentRep / (selectedBattleMove?.reps || 10)) * 100)}% ({currentRep}/{selectedBattleMove?.reps || 10})</span>
                </div>
                <Progress value={(currentRep / (selectedBattleMove?.reps || 10)) * 100} className="h-2.5 bg-slate-800" />
              </div>

              {/* Visual Guidance & Target Skeleton Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                <div className="md:col-span-4 flex flex-col items-center justify-center">
                  <div className="text-[11px] text-slate-400 mb-1 flex items-center gap-1 font-semibold">
                    <TargetIcon size={12} className="text-cyan-400" /> Skeleton Target Biomekanika:
                  </div>
                  <div className="w-36 h-36 bg-slate-950 rounded-lg flex items-center justify-center overflow-hidden border border-slate-800">
                    <SkeletonOverlay
                      landmarks={selectedBattleMove?.skeleton_data || null}
                      width={144}
                      height={144}
                      status="bagus"
                      orientasi="frontal"
                      color="#38bdf8"
                    />
                  </div>
                </div>
                <div className="md:col-span-8 flex flex-col gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={currentStatus === 'bagus' ? "success" : currentStatus === 'ringan' ? "warning" : "destructive"}>
                      {currentStatus === 'bagus' ? 'Posisi Tepat' : currentStatus === 'ringan' ? 'Perlu Koreksi' : 'Sesuaikan Pose'}
                    </Badge>
                    <span className="text-xs text-slate-200 font-medium">
                      {currentFeedback || "Tahan postur tubuh Anda mengikuti skeleton target di samping."}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {selectedBattleMove?.deskripsi || "Jaga agar leher dan tulang belakang tetap lurus dan rileks."}
                  </p>
                  <div className="flex flex-wrap gap-2 text-[10px] text-slate-300 pt-1">
                    {selectedBattleMove?.sudut_target?.sudut_leher && (
                      <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700">Sudut Leher: {selectedBattleMove.sudut_target.sudut_leher}°</span>
                    )}
                    {selectedBattleMove?.sudut_target?.sudut_punggung && (
                      <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700">Sudut Punggung: {selectedBattleMove.sudut_target.sudut_punggung}°</span>
                    )}
                    <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700">Durasi: {selectedBattleMove?.durasi_detik || 5}s per rep</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Exercise Completion Card */}
          {exerciseCompleted && (
            <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-blue-500/15 border border-emerald-500/30 text-center mb-6 shadow-sm">
              <Trophy size={40} className="text-amber-400 mx-auto mb-2 animate-bounce" />
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                Sesi Latihan Terapi Selesai!
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-md mx-auto">
                Luar biasa! Anda telah menyelesaikan {currentRep} repetisi latihan <strong>{selectedBattleMove?.nama}</strong>.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2.5 mt-3">
                <Badge variant="success" className="px-3 py-1 text-xs font-semibold">
                  Akurasi Rata-rata: {poseScores.length ? Math.round(poseScores.reduce((a, b) => a + b, 0) / poseScores.length) : 90}%
                </Badge>
                <Badge variant="info" className="px-3 py-1 text-xs">
                  {participants.length <= 1 ? "Sesi Solo Dicatat di Riwayat" : "Progres Multiplayer Sinkron"}
                </Badge>
              </div>
              <div className="mt-4 flex items-center justify-center gap-2">
                <Button variant="success" size="sm" onClick={handleResetExercise} className="text-xs flex items-center gap-1.5 font-bold">
                  <RotateCcw size={14} /> Latihan Ulang
                </Button>
              </div>
            </div>
          )}

          {/* Pilihan Gerakan Terapi */}
          {battleExercises.length > 0 ? (
            <div className="mb-5">
              <div className="flex items-center justify-between gap-2 mb-2">
                <label className="text-xs text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5">
                  <TargetIcon size={14} className="text-blue-500" />
                  {isHost()
                    ? 'Pilih Gerakan Latihan Terapi (Host dapat menantang gerakan ke seluruh pemain):'
                    : 'Pilihan Gerakan Latihan Terapi:'}
                </label>
                {selectedBattleMove && (
                  <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                    Aktif: {selectedBattleMove.nama}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {(['selected', 'unselected'] as const).map(group => (
                  battleExercises
                    .filter(m => group === 'selected' ? challengeIds.includes(m.exercise_id) : !challengeIds.includes(m.exercise_id))
                    .map((m: any) => {
                      const checked = challengeIds.includes(m.exercise_id);
                      const isCurrent = selectedBattleMove?.exercise_id === m.exercise_id;
                      const amHost = isHost();
                      return (
                        <Button
                          key={m.exercise_id}
                          type="button"
                          variant={isCurrent ? "secondary" : checked ? "outline" : "ghost"}
                          size="sm"
                          onClick={() => {
                            setSelectedBattleMove(m);
                            if (amHost) toggleChallenge(m.exercise_id);
                          }}
                          className={cn(
                            "text-xs border transition-all cursor-pointer",
                            isCurrent && "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/30 border-blue-400",
                            checked && !isCurrent && "border-amber-400/80 bg-amber-50/50 dark:bg-amber-900/10"
                          )}
                        >
                          <TargetIcon size={13} className={isCurrent ? "text-blue-500" : "text-slate-400"} />
                          <span className="font-semibold">{m.nama}</span>
                          {checked && <Check size={12} className="text-amber-500" />}
                          {m.type && (
                            <Badge variant="info" className="text-[9px] h-4 px-1">{m.type}</Badge>
                          )}
                        </Button>
                      );
                    })
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 mb-3">
              Belum ada gerakan latihan dengan data skeleton. Gerakan default akan dimuat secara otomatis.
            </p>
          )}

          {/* Battle scoreboard */}
          {Object.keys(battlePoints).length > 0 && (
            <div className="space-y-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <span className="flex items-center gap-1.5"><Swords size={13} /> Papan Skor Latihan &amp; Battle</span>
                <span>Target: {room?.max_score || maxScore} Poin</span>
              </div>
              {Object.entries(battlePoints).map(([key, pts]) => {
                const p = players[key] ?? { display_name: 'Pemain', warna: '#8b5cf6' };
                const isWinner = winnerKey === key;
                return (
                  <div key={key} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800" style={isWinner ? { borderColor: '#f59e0b', backgroundColor: '#f59e0b12' } : undefined}>
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.warna }} />
                      {p.display_name} {isWinner && <Badge variant="warning">PEMENANG!</Badge>}
                    </div>
                    <div className="flex items-center gap-1">
                      {battlePoin[key] != null && battlePoin[key] > 0 && (
                        <Badge variant="success" className="text-[9px] h-4 px-1">+{battlePoin[key]}</Badge>
                      )}
                      <div className="font-mono font-bold text-purple-600 dark:text-purple-400">{pts} <span className="text-[10px] text-slate-400 font-normal">/ {room?.max_score || maxScore}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {winnerKey && (
            <div className="mt-3 p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2">
              <Star size={14} className="mt-0.5 shrink-0" />
              <div>
                <span><strong>Battle selesai!</strong> {players[winnerKey]?.display_name || (myPlayerKey === winnerKey ? displayName : 'Pemain')} mencapai batas poin dan memenangkan battle!</span>
                {battlePesan && <div className="mt-1 text-emerald-600 dark:text-emerald-400">{battlePesan}</div>}
                {!user && <div className="mt-1 opacity-80">Login agar poinmu masuk ke ledger &amp; peringkat bulanan.</div>}
              </div>
            </div>
          )}
        </Card>

        {/* Players grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {participants.map((p, idx) => {
            const pKey = p.guest_key || (p.user_id ? `u:${p.user_id}` : '') || `anon-${idx}`;
            const isSelf = pKey === currentKey();
            const liveProg = isSelf ? { rep: currentRep, score: currentAccuracy } : playerProgress[pKey];

            return (
              <Card key={pKey} className="p-2 relative overflow-hidden bg-slate-950 border-slate-800">
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

                  {/* Top Live Status tag when exercising */}
                  {isExercising && liveProg && (
                    <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                      <span className={cn(
                        "text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow-sm border",
                        isSelf
                          ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/40"
                          : "bg-blue-950/80 text-cyan-300 border-cyan-500/40"
                      )}>
                        Rep {liveProg.rep}/{selectedBattleMove?.reps || 10} · {liveProg.score}%
                      </span>
                    </div>
                  )}

                  {/* Bottom Name tag */}
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between px-2 py-1 rounded-lg" style={{ backgroundColor: `${p.warna}22`, border: `1px solid ${p.warna}55` }}>
                    <span className="text-xs font-bold text-white truncate">{p.display_name}</span>
                    <span className="flex gap-1">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.warna }} />
                      {p.is_host && <Badge variant="info" className="text-[9px] h-4 px-1.5">HOST</Badge>}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
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