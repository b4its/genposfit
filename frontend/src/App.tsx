import { useState, useEffect } from 'react';
import { Navbar, type PageTab } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';
import { RegisterPose } from './pages/RegisterPose';
import { Monitor } from './pages/Monitor';
import { Dashboard } from './pages/Dashboard';
import { Exercises } from './pages/Exercises';
import { ShieldCheck } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<PageTab>('landing');
  const [apiOnline, setApiOnline] = useState<boolean>(true);

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
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === 'm' || e.key === 'M') setActiveTab('monitor');
      if (e.key === 'c' || e.key === 'C') setActiveTab('register');
      if (e.key === 'd' || e.key === 'D') setActiveTab('dashboard');
      if (e.key === 'e' || e.key === 'E') setActiveTab('exercises');
      if (e.key === 'h' || e.key === 'H') setActiveTab('landing');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen flex flex-col selection:bg-blue-500 selection:text-white transition-colors duration-200"
      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-main)' }}>
      {/* Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        apiOnline={apiOnline}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {activeTab === 'landing' && <LandingPage setActiveTab={setActiveTab} />}
        {activeTab === 'register' && <RegisterPose onFinishCalibration={() => setActiveTab('monitor')} />}
        {activeTab === 'monitor' && <Monitor onNavigateToExercises={() => setActiveTab('exercises')} />}
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'exercises' && <Exercises />}
      </main>

      {/* Product Footer */}
      <footer
        className="mt-auto border-t py-6 text-xs transition-colors"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
      >
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
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
