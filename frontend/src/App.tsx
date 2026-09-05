import { useState, useEffect } from 'react';
import { Navbar, type PageTab } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';
import { RegisterPose } from './pages/RegisterPose';
import { Monitor } from './pages/Monitor';
import { Dashboard } from './pages/Dashboard';
import { Exercises } from './pages/Exercises';
import { Database, Terminal } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<PageTab>('landing');
  const [apiOnline, setApiOnline] = useState<boolean>(true);

  // Check backend health on mount
  useEffect(() => {
    const apiUrl = import.meta.env?.VITE_API_URL || 'http://localhost:8000';
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
    <div className="min-h-screen flex flex-col justify-between selection:bg-blue-500 selection:text-white transition-colors duration-200"
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

      {/* Minimal Developer Tools Footer */}
      <footer
        className="border-t py-6 text-xs font-mono transition-colors"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-bold text-blue-500">GenPosFit</span>
            <span className="text-slate-400 dark:text-slate-500">|</span>
            <span className="text-slate-500 dark:text-slate-400">
              Genryphem Posture and Fit · Biomechanical Health Engine
            </span>
          </div>

          {/* Quick links to dev environment */}
          <div className="flex items-center gap-4 text-slate-400">
            <a
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noreferrer"
              className="hover:text-blue-400 flex items-center gap-1 transition-colors"
            >
              <Terminal size={12} />
              <span>Swagger API (:8000)</span>
            </a>

            <a
              href="http://localhost:8080"
              target="_blank"
              rel="noreferrer"
              className="hover:text-emerald-400 flex items-center gap-1 transition-colors"
            >
              <Database size={12} />
              <span>PhpMyAdmin (:8080)</span>
            </a>

            <div className="hidden md:flex items-center gap-1 text-[10px] text-slate-500 bg-slate-800/40 px-2 py-0.5 rounded border border-slate-700/50">
              <span>Shortcuts:</span>
              <kbd className="px-1 bg-slate-700 rounded text-slate-300">[M]</kbd> Monitor
              <kbd className="px-1 bg-slate-700 rounded text-slate-300">[C]</kbd> Calibrate
              <kbd className="px-1 bg-slate-700 rounded text-slate-300">[D]</kbd> Stats
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
