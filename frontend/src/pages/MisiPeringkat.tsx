import React, { useCallback, useEffect, useState } from 'react';
import {
  Award, CheckCircle2, Clock, Coins, Crown, Loader2, Medal, Target,
  Trophy, Wallet, XCircle,
} from 'lucide-react';
import { Badge, Button, Card, Progress } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { alamatPendek, hasWallet, sambungkanAkun, tandaTanganPesan } from '../lib/wallet';

const apiUrl = () => import.meta.env?.VITE_API_URL || 'http://localhost:8042';

interface Misi {
  quest_id: number;
  kode: string;
  judul: string;
  deskripsi?: string | null;
  kategori: 'harian' | 'mingguan';
  metrik: string;
  target: number;
  reward_poin: number;
  progres: number;
  persen: number;
  status: 'aktif' | 'selesai' | 'diklaim';
  periode: string;
  diklaim_pada?: string | null;
}

interface MisiResponse {
  user_id: number;
  poin_total: number;
  musim: string;
  misi: Misi[];
}

interface EntriPeringkat {
  rank: number;
  user_id: number;
  username: string;
  nama: string;
  poin_musim: number;
  role: string;
}

interface ResponPeringkat {
  musim: string;
  musim_berjalan: boolean;
  sisa_waktu_detik: number;
  sisa_waktu_hari: number;
  top: EntriPeringkat[];
  saya: EntriPeringkat | null;
  jumlah_peserta: number;
}

interface Profil {
  poin?: number;
  wallet_address?: string | null;
}

type Tab = 'misi' | 'peringkat';

export const MisiPeringkat: React.FC = () => {
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>('misi');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [misiData, setMisiData] = useState<MisiResponse | null>(null);
  const [lb, setLb] = useState<ResponPeringkat | null>(null);
  const [profil, setProfil] = useState<Profil | null>(null);

  const [mengklaim, setMengklaim] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  const muatSemua = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mRes, pRes, meRes] = await Promise.all([
        fetch(`${apiUrl()}/api/quests`, { headers: headers() }),
        fetch(`${apiUrl()}/api/leaderboard/monthly?limit=25`, { headers: headers() }),
        fetch(`${apiUrl()}/api/auth/me`, { headers: headers() }),
      ]);
      if (mRes.ok) setMisiData(await mRes.json());
      if (pRes.ok) setLb(await pRes.json());
      if (meRes.ok) {
        const me = await meRes.json();
        setProfil({ poin: me.poin ?? 0, wallet_address: me.wallet_address ?? null });
      }
      const gagal = [mRes, pRes].filter((r) => r.status === 401);
      if (gagal.length) setError('Sesi berakhir — silakan login ulang.');
    } catch (e) {
      setError('Gagal mengambil data dari server.');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => { muatSemua(); }, [muatSemua]);

  const klaim = async (id: number) => {
    setMengklaim(id);
    try {
      const res = await fetch(`${apiUrl()}/api/quests/${id}/claim`, {
        method: 'POST', headers: headers(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || 'Klaim gagal.');
      setToast(`Hadiah +${data.reward_poin} poin diterima!`);
      setTimeout(() => setToast(null), 4000);
      await muatSemua();
    } catch (e: any) {
      setToast(e.message || 'Klaim gagal');
      setTimeout(() => setToast(null), 4000);
    } finally {
      setMengklaim(null);
    }
  };

  const hubungkanWallet = async () => {
    if (!hasWallet()) {
      setToast('MetaMask tidak terdeteksi. Install extension MetaMask terlebih dahulu.');
      setTimeout(() => setToast(null), 5000);
      return;
    }
    setWalletLoading(true);
    try {
      const address = await sambungkanAkun();
      if (!address) throw new Error('Akses akun ditolak.');
      const chRes = await fetch(`${apiUrl()}/api/wallet/challenge`, { headers: headers() });
      const ch = await chRes.json();
      if (!chRes.ok) throw new Error(ch?.detail || 'Gagal meminta tantangan.');
      const signature = await tandaTanganPesan(address, ch.pesan);
      const vRes = await fetch(`${apiUrl()}/api/wallet/verify`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ address, signature }),
      });
      const v = await vRes.json();
      if (!vRes.ok) throw new Error(v?.detail || 'Verifikasi signature gagal.');
      setToast('Wallet terhubung! Reward GPC dapat dikirim ke alamat ini.');
      await muatSemua();
    } catch (e: any) {
      setToast(e.message || 'Koneksi wallet gagal.');
    } finally {
      setWalletLoading(false);
      setTimeout(() => setToast(null), 5000);
    }
  };

  const lepasWallet = async () => {
    setWalletLoading(true);
    try {
      await fetch(`${apiUrl()}/api/wallet/me`, { method: 'DELETE', headers: headers() });
      await muatSemua();
    } finally {
      setWalletLoading(false);
    }
  };

  const harian = misiData?.misi.filter((m) => m.kategori === 'harian') ?? [];
  const mingguan = misiData?.misi.filter((m) => m.kategori === 'mingguan') ?? [];

  const fmtSisa = (detik: number) => {
    const h = Math.floor(detik / 3600 / 24);
    const jam = Math.floor((detik % 86400) / 3600);
    return h > 0 ? `${h} hari ${jam} jam` : `${jam} jam`;
  };

  const ikonMedali = (rank: number) =>
    rank === 1 ? <Crown size={14} className="text-yellow-500" />
      : rank === 2 ? <Medal size={14} className="text-slate-400" />
        : rank === 3 ? <Award size={14} className="text-amber-600" />
          : <span className="text-[10px] font-mono text-slate-400 w-3.5 text-center">{rank}</span>;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <Target size={22} className="text-blue-500" />
            Misi & Peringkat Musiman
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Kumpulkan poin dari latihan nyata, klaim hadiah harian/mingguan, dan kejar puncak klasemen bulan{' '}
            <span className="font-mono">{misiData?.musim ?? ''}</span>.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="info" className="gap-1 px-2.5 py-1 text-xs">
            <Coins size={13} className="text-yellow-500" />
            {misiData?.poin_total ?? profil?.poin ?? 0} poin
          </Badge>
          {lb && (
            <Badge variant="outline" className="flex gap-1 px-2.5 py-1 font-mono text-xs">
              <Clock size={13} />
              {fmtSisa(lb.sisa_waktu_detik)} tersisa
            </Badge>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Wallet card */}
      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950">
              {profil?.wallet_address
                ? <CheckCircle2 size={20} className="text-emerald-600" />
                : <Wallet size={20} className="text-slate-500" />}
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                {profil?.wallet_address
                  ? `Wallet terhubung: ${alamatPendek(profil.wallet_address)}`
                  : 'Wallet GPC belum terhubung'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {profil?.wallet_address
                  ? 'Juara bulanan akan menerima token GPC on-chain (Sepolia) di alamat ini.'
                  : 'Hubungkan MetaMask untuk menerima reward token bila masuk Top-3 bulan ini.'}
              </div>
            </div>
          </div>
          {profil?.wallet_address ? (
            <Button variant="outline" size="sm" onClick={lepasWallet} disabled={walletLoading}>
              <XCircle size={14} /> Lepas
            </Button>
          ) : (
            <Button size="sm" onClick={hubungkanWallet} disabled={walletLoading}>
              {walletLoading ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />}
              Connect Wallet
            </Button>
          )}
        </div>
      </Card>

      {/* Tabs */}
      <div className="mb-5 flex gap-2">
        {(['misi', 'peringkat'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
              tab === t
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {t === 'misi' ? 'Daftar Misi' : 'Peringkat Bulanan'}
          </button>
        ))}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-white dark:text-slate-900">
          {toast}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={28} className="animate-spin text-blue-500" />
        </div>
      ) : tab === 'misi' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Harian</h2>
            <div className="space-y-3">
              {harian.length === 0 && <p className="text-sm text-slate-400">Belum ada misi harian.</p>}
              {harian.map((m) => <MisiItem key={m.kode} m={m} onKlaim={klaim} mengklaim={mengklaim} ikonMedali={ikonMedali} />)}
            </div>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Mingguan</h2>
            <div className="space-y-3">
              {mingguan.length === 0 && <p className="text-sm text-slate-400">Belum ada misi mingguan.</p>}
              {mingguan.map((m) => <MisiItem key={m.kode} m={m} onKlaim={klaim} mengklaim={mengklaim} ikonMedali={ikonMedali} />)}
            </div>
          </div>
        </div>
      ) : (
        <Card className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Trophy size={16} className="text-yellow-500" />
              Top {lb?.top?.length ?? 0} dari {lb?.jumlah_peserta ?? 0} pengguna
            </h2>
            <Badge variant={lb?.musim_berjalan ? 'success' : 'outline'}>
              Musim {lb?.musim}
            </Badge>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400 dark:border-slate-700">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">Pengguna</th>
                <th className="py-2 pr-2 text-right">Poin Musim</th>
                <th className="py-2 text-right">Role</th>
              </tr>
            </thead>
            <tbody>
              {(lb?.top ?? []).map((e) => (
                <tr
                  key={e.user_id}
                  className={`border-b border-slate-100 dark:border-slate-800 ${
                    lb?.saya?.user_id === e.user_id ? 'bg-blue-50 dark:bg-blue-950/40' : ''
                  }`}
                >
                  <td className="py-2 pr-2">{ikonMedali(e.rank)}</td>
                  <td className="py-2 pr-2">
                    <div className="font-medium text-slate-900 dark:text-white">{e.nama}</div>
                    <div className="text-xs text-slate-400">@{e.username}</div>
                  </td>
                  <td className="py-2 pr-2 text-right font-mono text-emerald-600 dark:text-emerald-400">{e.poin_musim}</td>
                  <td className="py-2 text-right text-xs text-slate-400">{e.role}</td>
                </tr>
              ))}
              {(lb?.top ?? []).length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-sm text-slate-400">Belum ada poin musim ini — mulai dari tab Misi!</td></tr>
              )}
            </tbody>
          </table>
          {lb?.saya && (
            <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
              <span className="font-semibold text-slate-900 dark:text-white">Posisi kamu</span>
              <span className="font-mono text-blue-600 dark:text-blue-400">
                #{lb.saya.rank} · {lb.saya.poin_musim} poin
              </span>
            </div>
          )}
          {!profil?.wallet_address && lb?.saya && lb.saya.rank <= 3 && (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
              Kamu di 3 besar! Hubungkan wallet (tombol di atas) sebelum musim berakhir agar reward GPC bisa dikirim.
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

const MisiItem: React.FC<{
  m: Misi;
  onKlaim: (id: number) => void;
  mengklaim: number | null;
  ikonMedali: (r: number) => React.ReactNode;
}> = ({ m, onKlaim, mengklaim }) => {
  const siap = m.status === 'selesai';
  const done = m.status === 'diklaim';
  return (
    <Card className={`p-4 ${siap ? 'border-emerald-300 dark:border-emerald-800' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-white">{m.judul}</div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{m.deskripsi}</div>
        </div>
        <Badge variant={done ? 'outline' : siap ? 'success' : 'default'}>
          {done ? 'Diklaim' : siap ? 'Selesai' : `${m.progres}/${m.target}`}
        </Badge>
      </div>
      <div className="mt-3">
        <Progress value={m.persen} className="h-2" />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs font-medium text-yellow-600 dark:text-yellow-400">
          <Coins size={13} /> +{m.reward_poin} poin
        </span>
        <Button size="sm" variant={siap ? 'default' : 'outline'} disabled={!siap || mengklaim === m.quest_id} onClick={() => onKlaim(m.quest_id)}>
          {mengklaim === m.quest_id ? <Loader2 size={13} className="animate-spin" /> : null}
          {done ? 'Sudah diklaim' : siap ? 'Klaim Hadiah' : 'Kejar target'}
        </Button>
      </div>
    </Card>
  );
};

export default MisiPeringkat;
