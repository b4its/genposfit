import React, { useState, useEffect } from 'react';
import {
  BarChart3, TrendingUp, Clock, AlertTriangle, CheckCircle2,
  Calendar, Download, RefreshCw, FileText, Dumbbell, Shield
} from 'lucide-react';

export const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');
  const [stats, setStats] = useState({
    total_logs: 1240,
    avg_skor: 88.6,
    avg_leher: 164.2,
    avg_punggung: 171.1,
    distribusi: {
      bagus: 890,
      ringan: 260,
      buruk: 90,
    },
    persentase_bagus: 71.8,
    timeline: []
  });

  const [exerciseHistory, setExerciseHistory] = useState([
    { id: 1, nama: 'Chin Tuck', reps: 10, avg_skor: 94.0, time: 'Hari ini, 10:15' },
    { id: 2, nama: 'Shoulder Blade Squeeze', reps: 10, avg_skor: 91.5, time: 'Kemarin, 15:30' },
    { id: 3, nama: 'Seated Back Extension', reps: 6, avg_skor: 89.0, time: '2 hari lalu, 11:00' },
  ]);

  const [activeJsonView, setActiveJsonView] = useState(false);

  // Fetch summary from backend or fallback to rich mock data
  const fetchData = async () => {
    setLoading(true);
    const apiUrl = import.meta.env?.VITE_API_URL || 'http://localhost:8000';

    try {
      const res = await fetch(`${apiUrl}/api/monitoring/summary/1?days=7`);
      if (res.ok) {
        const data = await res.json();
        if (data.total_logs > 0) {
          setStats(data);
        } else {
          generateFallbackTimeline();
        }
      } else {
        generateFallbackTimeline();
      }
    } catch (e) {
      generateFallbackTimeline();
    } finally {
      setLoading(false);
    }
  };

  const generateFallbackTimeline = () => {
    // Generate smooth 24-point timeline for demonstration
    const points = [];
    const now = Date.now();
    for (let i = 24; i >= 0; i--) {
      const timeStr = new Date(now - i * 3600 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const rawScore = 85 + Math.sin(i * 0.4) * 8 - (i % 5 === 0 ? 15 : 0);
      points.push({
        time: timeStr,
        skor: Math.max(50, Math.min(99, Math.round(rawScore * 10) / 10)),
        leher: 165 - (100 - rawScore) * 0.5,
      });
    }
    setStats(prev => ({
      ...prev,
      timeline: points
    }));
  };

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  const exportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(stats, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `genposfit_analytics_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const timelineData = stats.timeline.length > 0 ? stats.timeline : [];

  return (
    <div className="app-container py-10">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono mb-2 border border-blue-500/30 bg-blue-500/10 text-blue-400">
            <BarChart3 size={13} />
            <span>METRICS & POSTURE INTELLIGENCE</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight font-mono">
            Dashboard Progres Postur
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Data telemetri postur pengguna #1 (Alex Chandra) tersimpan di MySQL database
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-white cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw size={15} />
          </button>

          <button
            onClick={exportJSON}
            className="btn-outline py-1.5 px-3 text-xs font-mono cursor-pointer flex items-center gap-1.5"
          >
            <Download size={14} />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {/* Card 1: Ergonomic Health Score */}
        <div className="dev-card p-5">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-mono text-slate-400">Rata-rata Skor Postur</span>
            <span className="status-pill status-pill-bagus">7 HARI</span>
          </div>
          <div className="text-3xl font-extrabold font-mono text-emerald-400 my-1">
            {stats.avg_skor} <span className="text-sm font-normal text-slate-500">/ 100</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
            <TrendingUp size={13} className="text-emerald-400" />
            <span>+3.4% peningkatan vs minggu lalu</span>
          </div>
        </div>

        {/* Card 2: Bagus Compliance */}
        <div className="dev-card p-5">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-mono text-slate-400">Kepatuhan Ergonomis</span>
            <CheckCircle2 size={15} className="text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold font-mono text-blue-400 my-1">
            {stats.persentase_bagus}%
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            {stats.distribusi.bagus} dari {stats.total_logs} interval evaluasi
          </div>
        </div>

        {/* Card 3: Neck Angle Deviation */}
        <div className="dev-card p-5">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-mono text-slate-400">Rata-rata Sudut Leher</span>
            <Shield size={15} className="text-teal-400" />
          </div>
          <div className="text-3xl font-extrabold font-mono text-slate-200 my-1">
            {stats.avg_leher}°
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            Deviasi rata-rata: ±1.8° dari baseline ideal
          </div>
        </div>

        {/* Card 4: Posture Logs Recorded */}
        <div className="dev-card p-5">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-mono text-slate-400">Total Telemetri Tersimpan</span>
            <Clock size={15} className="text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold font-mono text-slate-100 my-1">
            {stats.total_logs.toLocaleString()}
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            Tabel MySQL: <code>posture_logs</code>
          </div>
        </div>
      </div>

      {/* Main Chart Section: Timeline Fluctuation */}
      <div className="dev-card p-6 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b"
          style={{ borderColor: 'var(--border)' }}>
          <div>
            <h3 className="text-sm font-bold font-mono text-slate-200">
              Fluktuasi Skor Ergonomi Sepanjang Sesi
            </h3>
            <span className="text-xs font-mono text-slate-400">
              Evaluasi landmark continuous time-series (Hijau: &gt;=85, Kuning: 60-84, Merah: &lt;60)
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>Bagus (&gt;=85)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span>Ringan (60-84)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
              <span>Buruk (&lt;60)</span>
            </div>
          </div>
        </div>

        {/* SVG Sparkline / Bar Chart */}
        <div className="w-full h-48 relative flex items-end gap-1.5 sm:gap-2 pt-4 px-2">
          {timelineData.map((pt, idx) => {
            const val = pt.skor || 80;
            const barHeight = Math.max(15, (val / 100) * 160);
            const colorClass = val >= 85 ? 'bg-emerald-500 hover:bg-emerald-400' : val >= 60 ? 'bg-amber-500 hover:bg-amber-400' : 'bg-red-500 hover:bg-red-400';

            return (
              <div
                key={idx}
                className="flex-1 flex flex-col items-center group relative cursor-pointer"
              >
                {/* Tooltip */}
                <div className="absolute -top-9 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-slate-900 text-white border border-slate-700 text-[10px] font-mono px-2 py-1 rounded shadow-lg z-30 whitespace-nowrap">
                  {pt.time || `#${idx}`}: <strong>{val}%</strong>
                </div>

                {/* Bar */}
                <div
                  className={`w-full rounded-t transition-all duration-200 ${colorClass}`}
                  style={{ height: `${barHeight}px` }}
                ></div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-2 px-2 border-t pt-2"
          style={{ borderColor: 'var(--border)' }}>
          <span>Awal Sesi</span>
          <span>Pertengahan Kerja</span>
          <span>Sekarang</span>
        </div>
      </div>

      {/* Lower Row: Exercise Sessions History & Raw DevTools Query */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Therapy Sessions */}
        <div className="lg:col-span-6 dev-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold font-mono text-slate-300 flex items-center gap-2">
              <Dumbbell size={16} className="text-emerald-400" />
              <span>Riwayat Sesi Terapi Postur (Mode B)</span>
            </h3>
            <span className="text-xs font-mono text-slate-500">Tabel: exercise_sessions</span>
          </div>

          <div className="space-y-3">
            {exerciseHistory.map(ex => (
              <div
                key={ex.id}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs font-mono"
              >
                <div>
                  <div className="font-bold text-slate-200">{ex.nama}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{ex.time} · {ex.reps} Repetisi</div>
                </div>
                <div className="text-right">
                  <div className="text-emerald-400 font-bold">{ex.avg_skor}%</div>
                  <div className="text-[10px] text-slate-500">Skor Akurasi</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: DevTools SQL Inspector */}
        <div className="lg:col-span-6 dev-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold font-mono text-slate-300 flex items-center gap-2">
              <FileText size={16} className="text-blue-400" />
              <span>DevTools Telemetry Inspector</span>
            </h3>
            <button
              onClick={() => setActiveJsonView(!activeJsonView)}
              className="text-xs font-mono text-blue-400 hover:underline cursor-pointer"
            >
              {activeJsonView ? 'Tampilkan SQL' : 'Tampilkan JSON'}
            </button>
          </div>

          {activeJsonView ? (
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-slate-300 font-mono text-xs overflow-x-auto max-h-56">
              <pre><code>{JSON.stringify(stats, null, 2)}</code></pre>
            </div>
          ) : (
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-slate-300 font-mono text-xs overflow-x-auto">
              <div className="text-emerald-400 mb-1">-- Query Agregat Database MySQL:</div>
              <pre className="text-slate-400 leading-relaxed">
{`SELECT 
    COUNT(*) AS total_logs,
    ROUND(AVG(skor_deviasi), 1) AS avg_skor,
    ROUND(AVG(sudut_leher), 1) AS avg_leher,
    ROUND(AVG(sudut_punggung), 1) AS avg_punggung,
    SUM(status = 'bagus') AS count_bagus
FROM posture_logs 
WHERE user_id = 1 
  AND timestamp >= NOW() - INTERVAL 7 DAY;`}
              </pre>
              <div className="text-[11px] text-slate-500 mt-2">
                PhpMyAdmin GUI tersedia di <code>http://localhost:8080</code>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
