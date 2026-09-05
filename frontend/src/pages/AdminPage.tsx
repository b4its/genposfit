import React, { useState, useEffect } from 'react';
import {
  BarChart3, TrendingUp, Users, Database, Wallet, Trophy,
  Medal, Award, Crown, RefreshCw, Shield, Activity, Dumbbell,
  AlertTriangle, CheckCircle2, Gamepad2
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { Button, Card, Badge, Pill, PillContent } from '../components/ui';

const apiUrl = () => import.meta.env?.VITE_API_URL || 'http://localhost:8042';

const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444'];

export const AdminPage = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, lbRes] = await Promise.all([
        fetch(`${apiUrl()}/api/admin/stats?days=30`),
        fetch(`${apiUrl()}/api/admin/leaderboard?limit=100`),
      ]);
      if (statsRes.ok) {
        const s = await statsRes.json();
        setStats(s);
      }
      if (lbRes.ok) {
        const l = await lbRes.json();
        setLeaderboard(l.users || []);
      }
    } catch (e) {
      console.debug('Admin data fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const kpi = stats?.kpi || {};
  const distribusi = stats?.distribusi || { bagus: 0, ringan: 0, buruk: 0 };
  const distribTotal = distribusi.bagus + distribusi.ringan + distribusi.buruk || 1;
  const pieData = [
    { name: 'Bagus', value: distribusi.bagus },
    { name: 'Ringan', value: distribusi.ringan },
    { name: 'Buruk', value: distribusi.buruk },
  ];
  const exerciseDaily = stats?.exercise_daily || [];
  const postureDaily = stats?.posture_daily || [];

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Crown size={16} className="text-yellow-500" />;
    if (rank === 2) return <Medal size={16} className="text-gray-400" />;
    if (rank === 3) return <Award size={16} className="text-amber-600" />;
    return <span className="text-xs font-mono text-slate-400 w-4 text-center">{rank}</span>;
  };

  const rankBg = (rank: number) => {
    if (rank === 1) return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
    if (rank === 2) return 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700';
    if (rank === 3) return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';
    return 'border-slate-200 dark:border-slate-800';
  };

  if (loading && !stats) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-slate-500">Memuat data sistem...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-10">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <Pill variant="info" size="md" className="mb-2">
            <Shield size={13} />
            <PillContent>ADMIN PANEL</PillContent>
          </Pill>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Dashboard Sistem
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Ringkasan keseluruhan sistem, peringkat pengguna, dan aktivitas platform
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="flex items-center gap-1.5">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>{loading ? 'Memuat...' : 'Refresh'}</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <Card className="p-4 flex flex-col items-center text-center">
          <Users size={20} className="text-blue-500 mb-1" />
          <div className="text-xl font-extrabold text-slate-900 dark:text-white">{kpi.total_users || 0}</div>
          <div className="text-[10px] text-slate-500">Total Pengguna</div>
          <div className="text-[9px] text-emerald-500 font-medium">+{kpi.new_users || 0} baru</div>
        </Card>

        <Card className="p-4 flex flex-col items-center text-center">
          <Wallet size={20} className="text-emerald-500 mb-1" />
          <div className="text-xl font-extrabold text-slate-900 dark:text-white">{(kpi.total_saldo || 0).toLocaleString('id-ID')}</div>
          <div className="text-[10px] text-slate-500">Total Saldo</div>
          <div className="text-[9px] text-slate-400">Rata-rata {(kpi.avg_saldo || 0).toLocaleString('id-ID')}</div>
        </Card>

        <Card className="p-4 flex flex-col items-center text-center">
          <Trophy size={20} className="text-yellow-500 mb-1" />
          <div className="text-xl font-extrabold text-slate-900 dark:text-white">{(kpi.total_poin || 0).toLocaleString()}</div>
          <div className="text-[10px] text-slate-500">Total Poin</div>
          <div className="text-[9px] text-slate-400">Gabungan seluruh user</div>
        </Card>

        <Card className="p-4 flex flex-col items-center text-center">
          <Database size={20} className="text-purple-500 mb-1" />
          <div className="text-xl font-extrabold text-slate-900 dark:text-white">{(kpi.total_logs || 0).toLocaleString()}</div>
          <div className="text-[10px] text-slate-500">Log Postur</div>
          <div className="text-[9px] text-emerald-500">+{(kpi.logs_since || 0)} (30 hari)</div>
        </Card>

        <Card className="p-4 flex flex-col items-center text-center">
          <Dumbbell size={20} className="text-rose-500 mb-1" />
          <div className="text-xl font-extrabold text-slate-900 dark:text-white">{kpi.total_sessions || 0}</div>
          <div className="text-[10px] text-slate-500">Sesi Latihan</div>
          <div className="text-[9px] text-slate-400">Total seluruh waktu</div>
        </Card>

        <Card className="p-4 flex flex-col items-center text-center">
          <Gamepad2 size={20} className="text-teal-500 mb-1" />
          <div className="text-xl font-extrabold text-slate-900 dark:text-white">{kpi.total_rooms || 0}</div>
          <div className="text-[10px] text-slate-500">Ruang MP</div>
          <div className="text-[9px] text-slate-400">Multiplayer aktif</div>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Bar Chart: Latihan Per Hari */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 size={16} className="text-blue-500" />
              <span>Aktivitas Latihan (30 Hari)</span>
            </h3>
          </div>
          <div className="h-56">
            {exerciseDaily.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={exerciseDaily}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v?.slice(5) || ''} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    labelFormatter={(v) => `Tanggal: ${v}`}
                  />
                  <Bar dataKey="count" name="Sesi" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">Belum ada data latihan</div>
            )}
          </div>
        </Card>

        {/* Pie Chart: Distribusi Postur */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity size={16} className="text-emerald-500" />
              <span>Distribusi Postur Global</span>
            </h3>
          </div>
          <div className="flex items-center justify-center h-56">
            {distribTotal > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {pieData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    formatter={(value) => [String(value), 'Jumlah']}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-400">Belum ada data postur</div>
            )}
            <div className="flex flex-col gap-2 text-[11px] ml-2">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Bagus: {distribusi.bagus}</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" />Ringan: {distribusi.ringan}</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" />Buruk: {distribusi.buruk}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Leaderboard Section */}
      <Card className="p-5 mb-8">
        <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Trophy size={16} className="text-yellow-500" />
              <span>Peringkat Pengguna</span>
              <Badge variant="info" className="ml-1">Berdasarkan Poin</Badge>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Saldo wallet aktif (tidak ada saldo tertahan)
            </p>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">{leaderboard.length} pengguna</span>
        </div>

        <div className="space-y-2">
          {leaderboard.length === 0 && (
            <div className="text-center py-8 text-xs text-slate-400">Belum ada data pengguna</div>
          )}
          {leaderboard.map((u) => (
            <div
              key={u.user_id}
              className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${rankBg(u.rank)}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0 w-6 flex justify-center">
                  {rankIcon(u.rank)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {u.nama}
                    {u.role === 'admin' && (
                      <span className="ml-1.5 text-[9px] bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-semibold">ADMIN</span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    @{u.username}{u.pekerjaan ? ` · ${u.pekerjaan}` : ''}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <div className="text-sm font-extrabold font-mono text-slate-900 dark:text-white">{u.poin.toLocaleString()}</div>
                  <div className="text-[10px] text-slate-400 font-medium">Poin</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                    {u.saldo.toLocaleString('id-ID', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">Saldo</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};