import React, { useState } from "react";
import { ShieldCheck, Camera, BarChart3, Dumbbell, Home, LogOut, User, Eye, Users, Menu, X, Settings, Trophy } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Pill, PillIndicator, PillContent, Badge } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import LogoSvg from "@/assets/logo.svg";

export type PageTab = "landing" | "monitor" | "register" | "dashboard" | "exercises" | "skeleton" | "multiplayer" | "misi" | "admin" | "admin-exercises";

interface NavbarProps {
  activeTab: PageTab;
  setActiveTab: (tab: PageTab) => void;
  apiOnline?: boolean;
}

const NAV_ITEMS = [
  { id: "landing", label: "Beranda", icon: Home },
  { id: "monitor", label: "Live Monitor", icon: Camera, badge: "Live" },
  { id: "register", label: "Kalibrasi", icon: ShieldCheck },
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "exercises", label: "Latihan Terapi", icon: Dumbbell },
  { id: "skeleton", label: "Skeleton", icon: Eye, badge: "Preview" },
  { id: "multiplayer", label: "Multiplayer", icon: Users, badge: "Room" },
  { id: "misi", label: "Misi & Peringkat", icon: Trophy },
  { id: "admin", label: "Dashboard", icon: BarChart3, adminOnly: true, badge: "Admin" },
  { id: "admin-exercises", label: "Kelola Latihan", icon: Settings, adminOnly: true, badge: "Admin" },
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

  return (
    <>
      {/* Top Header - Brand + Controls only */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md transition-colors duration-200">
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

          {/* Right Side: User Info + Health Status + Theme Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            {user && (
              <div className="hidden lg:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/60">
                <User size={13} className="text-blue-500" />
                <span className="font-semibold text-slate-900 dark:text-white max-w-[80px] truncate">{user.nama}</span>
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

            {/* Hamburger (mobile/tablet) */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Menu navigasi"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Desktop Bottom Navigation Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 lg:pb-3">
          <nav className="hidden lg:flex w-full justify-center">
            <div className="w-full *:flex-1 flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-xs overflow-x-auto">
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.id as PageTab)}
                    className={`flex justify-center items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer ${
                      isActive
                        ? "bg-blue-600 text-white shadow-sm shadow-blue-500/25"
                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700"
                    }`}
                  >
                    <Icon size={14} className={isActive ? "text-white" : "text-slate-500 dark:text-slate-400"} />
                    <span>{item.label}</span>
                    {item.badge && (
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                          isActive ? "bg-emerald-400 text-slate-950" : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>

        {/* Mobile / Tablet Drawer */}
        {mobileOpen && (
          <nav className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-3">
            {/* User row for mobile */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <User size={15} className="text-blue-500" />
                <span className="font-semibold">{user ? user.nama : "Tamu"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Pill variant={apiOnline ? "success" : "destructive"} size="sm">
                  <PillContent>{apiOnline ? "Online" : "Offline"}</PillContent>
                </Pill>
                <button
                  onClick={logout}
                  className="flex items-center gap-1 p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <LogOut size={15} />
                </button>
              </div>
            </div>

            <ul className="grid grid-cols-1 gap-1">
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => navigate(item.id as PageTab)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                        isActive ? "bg-blue-600 text-white" : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <Icon size={16} />
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </header>
    </>
  );
};
