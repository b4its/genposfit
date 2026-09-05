import { useState, useEffect } from 'react';
import { Navbar, type PageTab } from './components/Navbar';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { LandingPage } from './pages/LandingPage';
import { RegisterPose } from './pages/RegisterPose';
import { Monitor } from './pages/Monitor';
import { Dashboard } from './pages/Dashboard';
import { Exercises } from './pages/Exercises';
import { SkeletonPreview } from './pages/SkeletonPreview';
import { Multiplayer } from './pages/Multiplayer';
import { AdminPage } from './pages/AdminPage';
import { AdminExercises } from './pages/AdminExercises';
import { ShieldCheck } from 'lucide-react';
import { MisiPeringkat } from './pages/MisiPeringkat';

function AppContent() {
  const { isAuthenticated, user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<PageTab>('landing');
  const [apiOnline, setApiOnline] = useState<boolean>(true);
  const [showAuth, setShowAuth] = useState(true);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      setShowAuth(true);
    } else if (!loading && isAuthenticated) {
      setShowAuth(false);
    }
  }, [loading, isAuthenticated]);

  const handleAuthSuccess = () => {
    setShowAuth(false);
  };

  // Check backend health on mount
  useEffect(() => {
    const apiUrl = import.meta.env?.VITE_API_URL || 'http://localhost:8042';
    const checkHealth = () => {
      fetch(`${apiUrl}/api/health`)
        .then(res => res.json())
        .then(data => {
          setApiOnline(data?.status === 'healthy' || data?.status === 'degraded');
        })
        .catch(() => {
          setApiOnline(false);
        });
    };

    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcuts navigation (Developer Tools feature)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === 'm' || e.key === 'M') setActiveTab('monitor');
      if (e.key === 'c' || e.key === 'C') setActiveTab('register');
      if (e.key === 'd' || e.key === 'D') setActiveTab('dashboard');
      if (e.key === 'e' || e.key === 'E') setActiveTab('exercises');
      if (e.key === 'h' || e.key === 'H') setActiveTab('landing');
      if (e.key === 's' || e.key === 'S') setActiveTab('skeleton');
      if (e.key === 'p' || e.key === 'P') setActiveTab('multiplayer');
      if (e.key === 'q' || e.key === 'Q') setActiveTab('misi');
      if (user?.role === 'admin' && (e.key === 'a' || e.key === 'A')) setActiveTab('admin');
      if (user?.role === 'admin' && (e.key === 'x' || e.key === 'X')) setActiveTab('admin-exercises');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Memuat...</p>
        </div>
      </div>
    );
  }

  if (showAuth) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <AuthPage onSuccess={handleAuthSuccess} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-blue-500 selection:text-white transition-colors duration-200">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        apiOnline={apiOnline}
      />

      <main className="flex-1">
        {activeTab === 'landing' && <LandingPage setActiveTab={setActiveTab} />}
        {activeTab === 'register' && <RegisterPose onFinishCalibration={() => setActiveTab('monitor')} />}
        {activeTab === 'monitor' && <Monitor onNavigateToExercises={() => setActiveTab('exercises')} />}
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'exercises' && <Exercises />}
        {activeTab === 'skeleton' && <SkeletonPreview />}
        {activeTab === 'multiplayer' && <Multiplayer />}
        {activeTab === 'misi' && <MisiPeringkat />}
        {activeTab === 'admin' && <AdminPage />}
        {activeTab === 'admin-exercises' && <AdminExercises />}
      </main>

      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 py-6 text-xs transition-colors backdrop-blur-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-bold text-blue-600 dark:text-blue-400">GenPosFit</span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-slate-600 dark:text-slate-400">
              Biomechanical Posture & Ergonomics Health Engine
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <ShieldCheck size={14} />
              <span>100% On-device Privacy</span>
            </div>

            <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700/60">
              <span className="font-medium">Pintasan:</span>
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded text-slate-700 dark:text-slate-200 font-mono shadow-xs">H</kbd> Beranda
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded text-slate-700 dark:text-slate-200 font-mono shadow-xs">M</kbd> Monitor
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded text-slate-700 dark:text-slate-200 font-mono shadow-xs">C</kbd> Kalibrasi
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded text-slate-700 dark:text-slate-200 font-mono shadow-xs">D</kbd> Dashboard
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded text-slate-700 dark:text-slate-200 font-mono shadow-xs">E</kbd> Terapi
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded text-slate-700 dark:text-slate-200 font-mono shadow-xs">S</kbd> Skeleton
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded text-slate-700 dark:text-slate-200 font-mono shadow-xs">P</kbd> Multiplayer
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;