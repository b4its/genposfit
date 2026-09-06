import React, { useState } from "react";
import { ShieldCheck, Camera, BarChart3, Dumbbell, Home, LogOut, User, Eye, Users, Menu, X, Settings, Trophy } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Pill, PillIndicator, PillContent, Badge } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import LogoSvg from "@/assets/logo.svg";

export type PageTab =
  | "landing"
  | "monitor"
  | "register"
  | "dashboard"
  | "exercises"
  | "skeleton"
  | "multiplayer"
  | "misi"
  | "admin"
  | "admin-exercises";

interface NavbarProps {
  activeTab: PageTab;
  setActiveTab: (tab: PageTab) => void;
  apiOnline?: boolean;
}

const NAV_ITEMS: {
  id: PageTab;
  label: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: string;
  adminOnly?: boolean;
}[] = [
  { id: "landing", label: "Beranda", desc: "Overview & simulator biomekanika", icon: Home },
  { id: "monitor", label: "Live Monitor", desc: "Streaming AI deteksi postur kamera", icon: Camera, badge: "Live" },
  { id: "register", label: "Kalibrasi Baseline", desc: "Onboarding profil ergonomis personal", icon: ShieldCheck },
  { id: "dashboard", label: "Dashboard", desc: "Grafik kepatuhan & analitik ergonomis", icon: BarChart3 },
  { id: "exercises", label: "Latihan Terapi", desc: "Runner multi-step & ekspresi maskot", icon: Dumbbell },
  { id: "skeleton", label: "Skeleton 3D", desc: "Visualisasi 33 titik MediaPipe", icon: Eye, badge: "Inspector" },
  { id: "multiplayer", label: "Multiplayer", desc: "Duel 1v1 & persona maskot ceria", icon: Users, badge: "Battle" },
  { id: "misi", label: "Misi & Peringkat", desc: "Quest harian, klasemen & reward GPC", icon: Trophy },
  { id: "admin", label: "Admin Rewards", desc: "Distribusi token GPC Sepolia on-chain", icon: BarChart3, adminOnly: true, badge: "Admin" },
  { id: "admin-exercises", label: "Kelola Latihan", desc: "Bank 32 variasi & rekam pose pelatih", icon: Settings, adminOnly: true, badge: "Admin" },
];

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, apiOnline = true }) => {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";
  const [mobileOpen, setMobileOpen] = useState(false);

  const navigate = (tab: PageTab) => {
    setActiveTab(tab);
    setMobileOpen(false);
  };

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
  const activeItem = NAV_ITEMS.find((item) => item.id === activeTab);

  return (
    <>
      {/* Top Header - Brand + Controls */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <div onClick={() => navigate("landing")} className="flex items-center gap-3 cursor-pointer group shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 via-emerald-500 to-teal-400 p-[1.5px] shadow-sm group-hover:shadow-blue-500/25 transition-all">
              <div className="w-full h-full rounded-[10px] bg-white dark:bg-slate-900 flex items-center justify-center transition-colors">
                <img src={LogoSvg} alt="GenPosFit Logo" className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white">
                  Gen<span className="text-blue-600 dark:text-blue-400">Pos</span>
                  <span className="text-emerald-600 dark:text-emerald-400">Fit</span>
                </span>
                <Badge variant="info" className="text-[10px] px-1.5 py-0 h-4 font-semibold">
                  v1.0
                </Badge>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">Posture & Ergonomics Engine</span>
            </div>
          </div>

          {/* Active Tab Indicator (Desktop / Tablet) */}
          {activeItem && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs font-medium text-slate-700 dark:text-slate-300">
              <activeItem.icon size={13} className="text-blue-500" />
              <span>{activeItem.label}</span>
            </div>
          )}

          {/* Right Side: User Info + Health Status + Theme Toggle + Menu */}
          <div className="flex items-center gap-2 shrink-0">
            {user && (
              <div className="hidden lg:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/60">
                <User size={13} className="text-blue-500" />
                <span className="font-semibold text-slate-900 dark:text-white max-w-[90px] truncate">{user.nama}</span>
              </div>
            )}

            <button
              onClick={logout}
              title="Keluar"
              className="hidden sm:flex p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <LogOut size={16} />
            </button>

            <Pill variant={apiOnline ? "success" : "destructive"} size="md" className="hidden md:inline-flex">
              <PillIndicator variant={apiOnline ? "success" : "destructive"} />
              <PillContent>{apiOnline ? "AI Engine Online" : "Offline"}</PillContent>
            </Pill>

            <ThemeToggle />

            {/* Menu Trigger Button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-all cursor-pointer text-xs font-semibold shadow-xs"
              aria-label="Menu navigasi"
            >
              {mobileOpen ? <X size={16} className="text-rose-500" /> : <Menu size={16} className="text-blue-500" />}
              <span className="hidden sm:inline">{mobileOpen ? "Tutup" : "Menu"}</span>
            </button>
          </div>
        </div>

        {/* Navigation Drawer */}
        {mobileOpen && (
          <nav className="border-t border-slate-200 dark:border-slate-800 bg-white/98 dark:bg-slate-900/98 backdrop-blur-xl px-4 py-5 shadow-2xl transition-all animate-in slide-in-from-top-2 duration-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {/* User row for mobile view */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <User size={15} className="text-blue-500" />
                  <span>Masuk sebagai <strong className="text-slate-900 dark:text-white">{user ? user.nama : "Tamu"}</strong></span>
                  {user?.role && (
                    <Badge variant={isAdmin ? "warning" : "outline"} className="capitalize text-[10px] py-0">
                      {user.role}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Pill variant={apiOnline ? "success" : "destructive"} size="sm">
                    <PillContent>{apiOnline ? "Online" : "Offline"}</PillContent>
                  </Pill>
                  {user && (
                    <button
                      onClick={logout}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 transition-colors cursor-pointer"
                    >
                      <LogOut size={13} />
                      <span>Keluar</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Grid of Navigation Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.id)}
                      className={`group relative flex flex-col p-3.5 rounded-2xl border text-left transition-all duration-150 cursor-pointer ${
                        isActive
                          ? "border-blue-500/60 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20 text-blue-950 dark:text-blue-100 shadow-sm shadow-blue-500/10"
                          : "border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                            isActive
                              ? "bg-blue-600 text-white shadow-xs"
                              : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 group-hover:bg-blue-500 group-hover:text-white"
                          }`}
                        >
                          <Icon size={16} />
                        </div>
                        {item.badge && (
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              isActive
                                ? "bg-blue-600 text-white"
                                : item.badge === "Admin"
                                ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30"
                                : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-sm leading-tight text-slate-900 dark:text-white mb-1">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug line-clamp-2">
                        {item.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>
        )}
      </header>
    </>
  );
};
