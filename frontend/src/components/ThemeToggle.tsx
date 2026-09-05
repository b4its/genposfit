import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('genposfit_theme');
      if (saved) return saved === 'dark';
      return document.documentElement.classList.contains('dark') ||
        window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('genposfit_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('genposfit_theme', 'light');
    }
  }, [isDark]);

  return (
    <button
      type="button"
      onClick={() => setIsDark(!isDark)}
      aria-label="Toggle Dark / Light Theme"
      className={`relative inline-flex items-center justify-center p-2 rounded-lg border transition-all duration-200 cursor-pointer ${
        isDark
          ? 'bg-slate-800/80 border-slate-700 text-amber-400 hover:bg-slate-700 hover:text-amber-300'
          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-blue-600'
      } ${className}`}
      style={{
        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : '#ffffff',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        color: isDark ? '#fbbf24' : '#2563eb',
      }}
    >
      {isDark ? (
        <Sun size={18} className="transition-transform duration-300 rotate-0 hover:rotate-45" />
      ) : (
        <Moon size={18} className="transition-transform duration-300 rotate-0 hover:-rotate-12" />
      )}
    </button>
  );
};
