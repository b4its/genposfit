import React, { useCallback, useEffect, useState } from 'react';
import {
  Coins,
  FlaskConical,
  History,
  Loader2,
  Send,
  Wallet,
  Users,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sparkles,
  Award,
} from 'lucide-react';
import { Badge, Button, Card } from '../components/ui';
import { getApiUrl } from '../lib/api';

const apiUrl = getApiUrl;
const DEFAULT_COMMUNITY_WALLET = '0x6EdcA860c066FCdA6c434095d5901810DCE12b48';

interface Penerima {
  rank: number;
  user_id: number;
  nama: string;
  username: string;
  role?: string;
  poin_musim: number;
  jumlah_gpc: number;
  wallet_address: string | null;
  is_default_wallet?: boolean;
  siap: boolean;
  riwayat_status?: string | null;
  riwayat_tx?: string | null;
  total_gpc_historis?: number;
}

interface UserRingkasan {
  user_id: number;
  username?: string;
  nama?: string;
  role?: string;
  rank: number;
  jumlah_gpc: number;
  total_gpc_historis?: number;
}

interface DompetRingkasan {
  wallet_address: string;
  is_default_wallet: boolean;
  total_gpc_periode: number;
  jumlah_user: number;
  user_ids: number[];
  users: UserRingkasan[];
  total_gpc_historis: number;
  total_gpc_akumulasi: number;
}

interface Preview {
  periode: string;
  schedule_gpc: Record<string, number>;
  onchain_aktif: boolean;
  contract_address: string | null;
  default_reward_wallet: string;
  hanya_role_user: boolean;
  use_default_wallet: boolean;
  total_gpc_siap: number;
  total_penerima: number;
  total_penerima_siap: number;
  dompet_ringkasan: DompetRingkasan[];
  penerima: Penerima[];
  tanpa_wallet: number[];
}

interface HasilDistribusi {
  periode: string;
  hanya_role_user?: boolean;
  use_default_wallet?: boolean;
  default_wallet?: string;
  total_gpc_siap?: number;
  total_gpc_dikirim?: number;
  total_penerima?: number;
  dompet_ringkasan?: DompetRingkasan[];
  dikirim: {
    user_id: number;
    tx: string;
    jumlah: string;
    wallet_address?: string;
    is_default_wallet?: boolean;
  }[];
  lewat_sudah: { user_id: number; tx: string; jumlah: string; wallet_address?: string }[];
  gagal: { user_id: number; error: string; wallet_address?: string }[];
  tanpa_wallet: { user_id: number; nama: string; rank: number }[];
  simulasi: Penerima[];
}

const token = () => localStorage.getItem('genposfit_token');

const GpcRewardsPanel: React.FC = () => {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendingShortcut, setSendingShortcut] = useState(false);
  const [hasil, setHasil] = useState<HasilDistribusi | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Filter & Options
  const [hanyaRoleUser, setHanyaRoleUser] = useState(true);
  const [useDefaultWallet, setUseDefaultWallet] = useState(true);
  const [tipePeriode, setTipePeriode] = useState<'bulanan' | 'mingguan'>('bulanan');
  const [showGrouping, setShowGrouping] = useState(false);

  const muat = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const params = new URLSearchParams({
        hanya_role_user: String(hanyaRoleUser),
        use_default_wallet: String(useDefaultWallet),
        tipe: tipePeriode,
      });
      const res = await fetch(`${apiUrl()}/api/admin/rewards/preview?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token() ?? ''}` },
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.detail || `HTTP ${res.status}`);
      }
      setPreview(await res.json());
      setErr(null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Gagal memuat preview reward');
    } finally {
      setLoading(false);
    }
  }, [hanyaRoleUser, useDefaultWallet, tipePeriode]);

  useEffect(() => {
    muat();
  }, [muat]);

  // Shortcut admin: Eksekusi langsung role pengguna + fallback wallet
  const kirimShortcut = async (kering: boolean) => {
    setSendingShortcut(true);
    setErr(null);
    try {
      const res = await fetch(`${apiUrl()}/api/admin/rewards/distribute-shortcut`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token() ?? ''}` },
        body: JSON.stringify({
          kering,
          periode: preview?.periode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
      setHasil(data);
      await muat(true);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Gagal mengeksekusi reward');
    } finally {
      setSendingShortcut(false);
    }
  };

  // Kirim manual dengan parameter kustom
  const kirimCustom = async (kering: boolean) => {
    setSending(true);
    setErr(null);
    try {
      const res = await fetch(`${apiUrl()}/api/admin/rewards/distribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token() ?? ''}` },
        body: JSON.stringify({
          kering,
          periode: preview?.periode,
          hanya_role_user: hanyaRoleUser,
          use_default_wallet: useDefaultWallet,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
      setHasil(data);
      await muat(true);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Gagal mendistribusikan reward');
    } finally {
      setSending(false);
    }
  };

  const isBusy = sending || sendingShortcut;
  const targetDefaultWallet = preview?.default_reward_wallet || DEFAULT_COMMUNITY_WALLET;
  const userFallbackCount = preview?.penerima.filter((p) => p.is_default_wallet).length ?? 0;

  return (
    <Card className="p-5">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              <Coins size={18} className="text-yellow-500" />
              Distribusi Reward GPC (Sepolia Web3)
            </h3>
            <Badge variant={preview?.onchain_aktif ? 'success' : 'outline'}>
              {preview?.onchain_aktif ? 'On-Chain Aktif' : 'Mode Simulasi (Off)'}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Token ERC-1155 (GenPosFitCoin) ditotalkan & dikirimkan ke pemenang musim{' '}
            <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
              {preview?.periode ?? '…'}
            </span>{' '}
            berdasarkan akumulasi perolehan poin ledger.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => { muat(true); }} disabled={loading || isBusy} title="Muat ulang data">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </Button>
        </div>
      </div>

      {/* Warning jika On-chain mati */}
      {preview && !preview.onchain_aktif && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Mode on-chain mati (GPC_REWARDS_ENABLED=0). Anda dapat melakukan simulasi kering. Untuk eksekusi live ke Sepolia,
          aktifkan GPC_REWARDS_ENABLED=1 di environment backend.
        </div>
      )}

      {err && (
        <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 p-2.5 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
          {err}
        </div>
      )}

      {/* Kontrol & Filter Interaktif */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            {/* Periode Tipe */}
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Periode:</span>
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs dark:border-slate-700 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setTipePeriode('bulanan')}
                  className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                    tipePeriode === 'bulanan'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Bulanan
                </button>
                <button
                  type="button"
                  onClick={() => setTipePeriode('mingguan')}
                  className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                    tipePeriode === 'mingguan'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Mingguan (Weekly)
                </button>
              </div>
            </div>

            {/* Checkbox Khusus Role Pengguna */}
            <label className="flex cursor-pointer select-none items-center gap-2 text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={hanyaRoleUser}
                onChange={(e) => setHanyaRoleUser(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="flex items-center gap-1 font-medium">
                <ShieldCheck size={14} className="text-emerald-500" />
                Khusus Role Pengguna (Abaikan Admin)
              </span>
            </label>

            {/* Checkbox Gunakan Dompet Komunitas */}
            <label className="flex cursor-pointer select-none items-center gap-2 text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={useDefaultWallet}
                onChange={(e) => setUseDefaultWallet(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="flex items-center gap-1 font-medium">
                <Wallet size={14} className="text-yellow-500" />
                Fallback Dompet Komunitas
              </span>
            </label>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Musim: <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{preview?.periode}</span>
          </div>
        </div>

        {/* Informasi Dompet Fallback Komunitas */}
        {useDefaultWallet && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-2.5 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-700 dark:text-slate-200">Dompet Komunitas Tujuan:</span>
              <span className="rounded bg-yellow-100/70 px-2 py-0.5 font-mono text-[11px] font-semibold text-yellow-900 dark:bg-yellow-950/60 dark:text-yellow-300">
                {targetDefaultWallet}
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              {userFallbackCount > 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  {userFallbackCount} user tanpa MetaMask dialihkan ke dompet bersama ini.
                </span>
              ) : (
                'Semua penerima memiliki dompet pribadi.'
              )}
            </div>
          </div>
        )}
      </div>

      {/* Ringkasan Statistik Utama (Stat Cards) */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="text-[11px] font-medium text-slate-400 uppercase">Total Reward Siap</div>
          <div className="mt-1 flex items-baseline gap-1 text-lg font-bold text-yellow-600 dark:text-yellow-400">
            {preview ? preview.total_gpc_siap.toLocaleString() : '0'}{' '}
            <span className="text-xs font-normal text-slate-400">GPC</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="text-[11px] font-medium text-slate-400 uppercase">Penerima Memenuhi Syarat</div>
          <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
            {preview ? `${preview.total_penerima_siap} / ${preview.total_penerima}` : '0'}{' '}
            <span className="text-xs font-normal text-slate-400">user</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="text-[11px] font-medium text-slate-400 uppercase">Dompet Tujuan Unik</div>
          <div className="mt-1 text-lg font-bold text-blue-600 dark:text-blue-400">
            {preview?.dompet_ringkasan?.length ?? 0}{' '}
            <span className="text-xs font-normal text-slate-400">dompet</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="text-[11px] font-medium text-slate-400 uppercase">Status Dompet</div>
          <div className="mt-1 text-xs font-semibold">
            {userFallbackCount > 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400">Fallback Aktif ({userFallbackCount} user)</span>
            ) : (
              <span className="text-slate-600 dark:text-slate-300">Mandiri / Tersedia</span>
            )}
          </div>
        </div>
      </div>

      {/* SHORTCUT KHUSUS ADMIN - PENGIRIMAN ROLE PENGGUNA */}
      <div className="mb-4 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 p-3.5 dark:border-blue-900/60 dark:from-blue-950/30 dark:to-indigo-950/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-blue-600 p-2 text-white shadow-xs">
              <Sparkles size={16} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Shortcut Admin: Distribusi Pengguna (Non-Admin)
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Mengirim token reward secara otomatis ke semua pemenang role <b>pengguna</b> menggunakan dompet komunitas fallback{' '}
                <span className="font-mono text-[11px]">0x6Edc…2b48</span> jika belum connect MetaMask.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => kirimShortcut(true)}
              disabled={isBusy}
              title="Simulasikan distribusi pengguna tanpa kirim on-chain"
            >
              {sendingShortcut ? <Loader2 size={13} className="animate-spin" /> : <FlaskConical size={13} />}
              Simulasi Pengguna
            </Button>
            <Button
              size="sm"
              onClick={() => kirimShortcut(false)}
              disabled={isBusy || !preview?.onchain_aktif || (preview?.total_penerima_siap ?? 0) === 0}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {sendingShortcut ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Kirim Reward Pengguna (Sepolia)
            </Button>
          </div>
        </div>
      </div>

      {/* Collapsible: Rincian Agregasi per Dompet Tujuan */}
      {(preview?.dompet_ringkasan?.length ?? 0) > 0 && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setShowGrouping(!showGrouping)}
            className="flex w-full items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            <span className="flex items-center gap-1.5">
              <Users size={14} className="text-indigo-500" />
              Agregasi Reward per Alamat Dompet ({preview?.dompet_ringkasan?.length} Dompet)
            </span>
            <span className="flex items-center gap-1 text-slate-400 hover:text-slate-600">
              {showGrouping ? 'Sembunyikan' : 'Tampilkan Rincian'}
              {showGrouping ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          </button>

          {showGrouping && (
            <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              {preview?.dompet_ringkasan.map((g, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg border p-3 text-xs transition-all ${
                    g.is_default_wallet
                      ? 'border-yellow-200 bg-yellow-50/40 dark:border-yellow-900/40 dark:bg-yellow-950/20'
                      : 'border-slate-200 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-800/20'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-slate-900 dark:text-white">
                        {g.wallet_address}
                      </span>
                      {g.is_default_wallet ? (
                        <Badge variant="warning">Dompet Bersama Komunitas</Badge>
                      ) : (
                        <Badge variant="outline">Dompet Pribadi</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500">
                        Total Periode:{' '}
                        <strong className="font-mono text-yellow-600 dark:text-yellow-400">
                          {g.total_gpc_periode} GPC
                        </strong>
                      </span>
                      {g.total_gpc_historis > 0 && (
                        <span className="text-slate-400">
                          (Akumulasi Sukses: {g.total_gpc_akumulasi} GPC)
                        </span>
                      )}
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                        {g.jumlah_user} Pengguna
                      </span>
                    </div>
                  </div>

                  {/* List of user names mapped to this wallet */}
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-200/50 pt-2 dark:border-slate-700/50">
                    {g.users.map((u) => (
                      <span
                        key={u.user_id}
                        className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[11px] shadow-2xs dark:bg-slate-800"
                      >
                        <Award size={10} className="text-amber-500" />
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          #{u.rank} {u.nama}
                        </span>
                        <span className="text-slate-400 font-mono text-[10px]">({u.jumlah_gpc} GPC)</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabel Penerima Reward */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400 dark:border-slate-700">
                <th className="py-2.5">#</th>
                <th className="py-2.5">Pengguna & Role</th>
                <th className="py-2.5 text-right">Poin Musim</th>
                <th className="py-2.5 text-right">Reward GPC</th>
                <th className="py-2.5">Alamat Dompet Tujuan</th>
                <th className="py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {(preview?.penerima ?? []).map((p) => (
                <tr
                  key={p.user_id}
                  className="border-b border-slate-100 transition-colors hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-900/50"
                >
                  <td className="py-2.5 font-mono text-xs font-bold text-slate-500">#{p.rank}</td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-900 dark:text-white">{p.nama}</span>
                      <span className="text-xs text-slate-400">@{p.username}</span>
                      <span
                        className={`rounded px-1.5 py-0.2 text-[10px] font-semibold uppercase ${
                          p.role === 'admin'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {p.role ?? 'user'}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 text-right font-mono font-medium text-slate-700 dark:text-slate-300">
                    {p.poin_musim}
                  </td>
                  <td className="py-2.5 text-right font-mono font-bold text-yellow-600 dark:text-yellow-400">
                    {p.jumlah_gpc} GPC
                  </td>
                  <td className="py-2.5">
                    {p.wallet_address ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                          {p.wallet_address.slice(0, 6)}…{p.wallet_address.slice(-4)}
                        </span>
                        {p.is_default_wallet ? (
                          <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">
                            Dompet Bersama
                          </span>
                        ) : (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            Pribadi
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        Belum connect — dilewati
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-center">
                    {p.riwayat_status === 'sukses' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                        <History size={12} />
                        {p.riwayat_tx ? (
                          <a
                            href={`https://sepolia.etherscan.io/tx/${p.riwayat_tx}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-emerald-700"
                            title={p.riwayat_tx}
                          >
                            {p.riwayat_tx.slice(0, 8)}…
                          </a>
                        ) : (
                          'Terkirim'
                        )}
                      </span>
                    ) : p.siap ? (
                      <Badge variant="success">Siap</Badge>
                    ) : (
                      <Badge variant="outline">Lewati</Badge>
                    )}
                  </td>
                </tr>
              ))}
              {(preview?.penerima ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                    Belum ada penerima yang memenuhi syarat pada musim ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tombol Standar / Kontrol Lengkap (Custom Actions) */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800">
        <div>
          {preview?.contract_address && (
            <span>
              Kontrak Sepolia: <span className="font-mono">{preview.contract_address}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => kirimCustom(true)} disabled={isBusy}>
            <FlaskConical size={13} /> Simulasi Kustom
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => kirimCustom(false)}
            disabled={isBusy || !preview?.onchain_aktif}
            className="border-slate-300"
          >
            {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Distribusi Lengkap Sesuai Filter
          </Button>
        </div>
      </div>

      {/* Hasil Eksekusi Distribusi */}
      {hasil && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="mb-2 font-semibold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
            <Coins size={14} className="text-yellow-500" />
            Hasil Eksekusi Distribusi Musim {hasil.periode}:
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              Dikirim/Simulasi: {hasil.dikirim?.length ?? hasil.simulasi?.length ?? 0}
            </div>
            <div className="rounded-lg bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Sudah Pernah (Lewat): {hasil.lewat_sudah?.length ?? 0}
            </div>
            <div className="rounded-lg bg-rose-50 p-2 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
              Gagal: {hasil.gagal?.length ?? 0}
            </div>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              Tanpa Wallet: {hasil.tanpa_wallet?.length ?? 0}
            </div>
          </div>

          {hasil.dikirim && hasil.dikirim.length > 0 && (
            <div className="mt-2.5 space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
              {hasil.dikirim.map((d, i) => (
                <div key={i} className="flex items-center justify-between font-mono">
                  <span>User #{d.user_id}: {d.jumlah} GPC ({d.wallet_address?.slice(0, 10)}…)</span>
                  {d.tx && (
                    <a
                      href={`https://sepolia.etherscan.io/tx/${d.tx}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline dark:text-blue-400"
                    >
                      Tx: {d.tx.slice(0, 12)}…
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

export default GpcRewardsPanel;

