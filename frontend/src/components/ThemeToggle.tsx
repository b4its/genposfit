import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui';

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
    <Button
      variant="outline"
      size="icon-sm"
      type="button"
      onClick={() => setIsDark(!isDark)}
      aria-label="Toggle Dark / Light Theme"
      className={className}
    >
      {isDark ? (
        <Sun size={16} className="text-amber-400 hover:rotate-45 transition-transform duration-200" />
      ) : (
        <Moon size={16} className="text-blue-600 hover:-rotate-12 transition-transform duration-200" />
      )}
    </Button>
  );
};

