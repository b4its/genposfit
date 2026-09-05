import React from 'react';
import { Activity, ShieldCheck, Camera, BarChart3, Dumbbell, Terminal } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

export type PageTab = 'landing' | 'monitor' | 'register' | 'dashboard' | 'exercises';

interface NavbarProps {
  activeTab: PageTab;
  setActiveTab: (tab: PageTab) => void;
  apiOnline?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  apiOnline = true,
}) => {
  const navItems = [
    { id: 'landing', label: 'Overview', icon: Terminal },
    { id: 'monitor', label: 'Live Monitor', icon: Camera, badge: 'Live' },
    { id: 'register', label: 'Calibration', icon: ShieldCheck },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'exercises', label: 'Therapy Fit', icon: Dumbbell },
  ];

  return (
    <header
      className="sticky top-0 z-50 w-full border-b transition-colors duration-200 backdrop-blur-md"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div
          onClick={() => setActiveTab('landing')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 via-emerald-500 to-teal-400 p-[1.5px] shadow-sm group-hover:shadow-blue-500/20 transition-all">
            <div
              className="w-full h-full rounded-[7px] flex items-center justify-center transition-colors"
              style={{ backgroundColor: 'var(--bg-surface)' }}
            >
              <Activity className="w-5 h-5 text-emerald-500 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight font-mono">
                Gen<span className="text-blue-500">Pos</span><span className="text-emerald-500">Fit</span>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-blue-500/30 text-blue-400 bg-blue-500/10">
                v1.0
              </span>
            </div>
            <span className="text-[11px] text-slate-400 hidden sm:inline">Posture & Ergonomics Engine</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-900/10 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as PageTab)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium font-mono transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800/80'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase tracking-wider ${
                    isActive ? 'bg-emerald-400 text-slate-900' : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Side: Health / Status + Theme Toggle */}
        <div className="flex items-center gap-3">
          {/* API Status indicator */}
          <div
            className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-mono border"
            style={{
              borderColor: apiOnline ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
              backgroundColor: apiOnline ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              color: apiOnline ? '#10b981' : '#ef4444',
            }}
          >
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                apiOnline ? 'bg-emerald-400' : 'bg-red-400'
              }`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                apiOnline ? 'bg-emerald-500' : 'bg-red-500'
              }`} />
            </span>
            <span>{apiOnline ? 'API :8000 OK' : 'OFFLINE'}</span>
          </div>

          <ThemeToggle />
        </div>
      </div>

      {/* Mobile Nav */}
      <div className="md:hidden flex items-center justify-around border-t py-2 px-1 text-xs"
        style={{ borderColor: 'var(--border)' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as PageTab)}
              className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg font-mono text-[11px] ${
                isActive ? 'text-blue-500 font-bold' : 'text-slate-400'
              }`}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
