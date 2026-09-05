import React from 'react';
import { Activity, ShieldCheck, Camera, BarChart3, Dumbbell, Home } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { Pill, PillIndicator, PillContent, Badge } from '@/components/ui';

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
    { id: 'landing', label: 'Beranda', icon: Home },
    { id: 'monitor', label: 'Live Monitor', icon: Camera, badge: 'Live' },
    { id: 'register', label: 'Kalibrasi', icon: ShieldCheck },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'exercises', label: 'Latihan Terapi', icon: Dumbbell },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/85 backdrop-blur-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div
          onClick={() => setActiveTab('landing')}
          className="flex items-center gap-3 cursor-pointer group shrink-0"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 via-emerald-500 to-teal-400 p-[1.5px] shadow-sm group-hover:shadow-blue-500/25 transition-all">
            <div className="w-full h-full rounded-[10px] bg-card flex items-center justify-center transition-colors">
              <Activity className="w-5 h-5 text-emerald-500 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-foreground">
                Gen<span className="text-blue-600 dark:text-blue-400">Pos</span><span className="text-emerald-600 dark:text-emerald-400">Fit</span>
              </span>
              <Badge variant="info" className="text-[10px] px-1.5 py-0 h-4 font-semibold">
                v1.0
              </Badge>
            </div>
            <span className="text-[11px] text-muted-foreground hidden sm:inline">Posture & Ergonomics Engine</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-muted p-1 rounded-xl border border-border/80 shadow-xs shrink-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as PageTab)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-card/80'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                    isActive ? 'bg-emerald-400 text-slate-950' : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Side: Health / Status + Theme Toggle */}
        <div className="flex items-center gap-3 shrink-0">
          {/* API / AI Engine Status indicator with Kibo UI Pill */}
          <Pill
            variant={apiOnline ? "success" : "destructive"}
            size="md"
            className="hidden sm:inline-flex"
          >
            <PillIndicator variant={apiOnline ? "success" : "destructive"} />
            <PillContent>{apiOnline ? 'AI Engine Online' : 'Offline'}</PillContent>
          </Pill>

          <ThemeToggle />
        </div>
      </div>

      {/* Mobile Nav */}
      <div className="md:hidden flex items-center justify-around border-t border-border bg-card/95 py-2 px-1 text-xs">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as PageTab)}
              className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[11px] font-medium transition-colors ${
                isActive ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-muted-foreground'
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

