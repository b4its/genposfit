import React, { useCallback, useEffect, useState } from 'react';
import { Coins, FlaskConical, History, Loader2, Send, Wallet } from 'lucide-react';
import { Badge, Button, Card } from '../components/ui';

const apiUrl = () => import.meta.env?.VITE_API_URL || 'http://localhost:8042';

interface Penerima {
  rank: number;
  user_id: number;
  nama: string;
  username: string;
  poin_musim: number;
  jumlah_gpc: number;
  wallet_address: string | null;
  siap: boolean;
  riwayat_status?: string | null;
  riwayat_tx?: string | null;
}

interface Preview {
  periode: string;
  schedule_gpc: Record<string, number>;
  onchain_aktif: boolean;
  contract_address: string | null;
  penerima: Penerima[];
  tanpa_wallet: number[];
}

interface HasilDistribusi {
  periode: string;
  dikirim: { user_id: number; tx: string; jumlah: string }[];
  lewat_sudah: { user_id: number; tx: string; jumlah: string }[];
  gagal: { user_id: number; error: string }[];
  tanpa_wallet: { user_id: number; nama: string; rank: number }[];
  simulasi: Penerima[];
}

const token = () => localStorage.getItem('genposfit_token');

const GpcRewardsPanel: React.FC = () => {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [hasil, setHasil] = useState<HasilDistribusi | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const muat = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${apiUrl()}/api/admin/rewards/preview`, {
        headers: { Authorization: `Bearer ${token() ?? ''}` },
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.detail || `HTTP ${res.status}`);
      }
      setPreview(await res.json());
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { muat(); }, [muat]);

  const kirim = async (kering: boolean) => {
    setSending(true);
    setErr(null);
    setHasil(null);
    try {
      const res = await fetch(`${apiUrl()}/api/admin/rewards/distribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token() ?? ''}` },
        body: JSON.stringify({ kering }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
      setHasil(data);
      await muat();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Coins size={16} className="text-yellow-500" />
            Distribusi Reward GPC Bulanan
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Token ERC-1155 (GenPosFitCoin) dikirim on-chain ke pemuncak klasemen musim{' '}
            <span className="font-mono">{preview?.periode ?? '…'}</span> via Sepolia testnet.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={preview?.onchain_aktif ? 'success' : 'outline'}>
            {preview?.onchain_aktif ? 'On-chain aktif' : 'Mode aman (nonaktif)'}
          </Badge>
          <Button size="sm" variant="outline" onClick={() => kirim(true)} disabled={sending}>
            <FlaskConical size={13} /> Kering
          </Button>
          <Button size="sm" onClick={() => kirim(false)} disabled={sending || !preview?.onchain_aktif}>
            {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Distribute Monthly Rewards
          </Button>
        </div>
      </div>

      {preview && !preview.onchain_aktif && (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Tombol nyata dinonaktifkan. Set GPC_REWARDS_ENABLED=1 + konfigurasi Sepolia pada
          backend untuk mengaktifkan mint otomatis. Pratinjau & distribusi 'Kering' tetap bisa.
        </div>
      )}

      {err && (
        <div className="mb-3 rounded-lg border border-rose-300 bg-rose-50 p-2.5 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">{err}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={22} className="animate-spin text-blue-500" /></div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400 dark:border-slate-700">
              <th className="py-2">#</th>
              <th className="py-2">Juara</th>
              <th className="py-2 text-right">Poin Musim</th>
              <th className="py-2 text-right">Reward</th>
              <th className="py-2">Wallet</th>
            </tr>
          </thead>
          <tbody>
            {(preview?.penerima ?? []).map((p) => (
              <tr key={p.user_id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 font-mono text-slate-500">{p.rank}</td>
                <td className="py-2">
                  <span className="font-medium text-slate-900 dark:text-white">{p.nama}</span>{' '}
                  <span className="text-xs text-slate-400">@{p.username}</span>
                </td>
                <td className="py-2 text-right font-mono">{p.poin_musim}</td>
                <td className="py-2 text-right font-mono text-yellow-600 dark:text-yellow-400">{p.jumlah_gpc} GPC</td>
                <td className="py-2">
                  {p.riwayat_status === 'sukses' ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-600">
                      <History size={12} />{p.riwayat_tx ? `${p.riwayat_tx.slice(0, 10)}…` : 'sukses'}
                    </span>
                  ) : p.siap ? (
                    <span className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                      <Wallet size={12} /> {p.wallet_address?.slice(0, 8)}…{p.wallet_address?.slice(-4)}
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600 dark:text-amber-400">belum connect — dilewati</span>
                  )}
                </td>
              </tr>
            ))}
            {(preview?.penerima ?? []).length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-xs text-slate-400">Belum ada penerima yang memenuhi syarat pada musim ini.</td></tr>
            )}
          </tbody>
        </table>
      )}

      {hasil && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Dikirim: {hasil.dikirim?.length ?? hasil.simulasi?.length ?? 0}</div>
          <div className="rounded-lg bg-slate-50 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300">Lewat: {hasil.lewat_sudah?.length ?? 0}</div>
          <div className="rounded-lg bg-rose-50 p-2 text-rose-700 dark:bg-rose-950 dark:text-rose-300">Gagal: {hasil.gagal?.length ?? 0}</div>
          <div className="rounded-lg bg-amber-50 p-2 text-amber-700 dark:bg-amber-950 dark:text-amber-300">Tanpa wallet: {hasil.tanpa_wallet?.length ?? 0}</div>
        </div>
      )}
      {preview?.contract_address && (
        <div className="mt-3 text-[11px] text-slate-400">
          Kontrak: <span className="font-mono">{preview.contract_address}</span>
        </div>
      )}
    </Card>
  );
};

export default GpcRewardsPanel;
