import React, { useState } from 'react';
import { UserPlus, LogIn, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Input, toast } from '../components/ui';
import LogoSvg from '@/assets/logo.svg';

type AuthMode = 'login' | 'register';

interface AuthPageProps {
  onSuccess?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onSuccess }) => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [pekerjaan, setPekerjaan] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      const msg = 'Username dan password wajib diisi.';
      setError(msg);
      toast({ title: 'Validasi Gagal', description: msg, variant: 'destructive' });
      return;
    }
    if (mode === 'register' && !nama.trim()) {
      const msg = 'Nama lengkap wajib diisi.';
      setError(msg);
      toast({ title: 'Validasi Gagal', description: msg, variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(username.trim(), password);
        toast({ title: 'Login Berhasil', description: `Selamat datang kembali, ${username}!`, variant: 'success' });
      } else {
        await register({ username: username.trim(), password, nama: nama.trim(), email: email.trim() || undefined, pekerjaan: pekerjaan.trim() || undefined });
        toast({ title: 'Pendaftaran Berhasil', description: 'Akun Anda berhasil dibuat. Selamat datang di GenPosFit!', variant: 'success' });
      }
      onSuccess?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan. Silakan coba lagi.';
      setError(message);
      toast({ title: 'Gagal', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(prev => (prev === 'login' ? 'register' : 'login'));
    setError(null);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 via-emerald-500 to-teal-400 p-[2px] mx-auto mb-4 shadow-lg shadow-blue-500/25">
            <div className="w-full h-full rounded-[14px] bg-white dark:bg-slate-900 flex items-center justify-center">
              <img src={LogoSvg} alt="GenPosFit Logo" className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            GenPosFit
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {mode === 'login' ? 'Masuk ke akun Anda' : 'Buat akun baru'}
          </p>
        </div>

        <Card className="p-6 sm:p-8">
          {/* Mode Tabs */}
          <div className="flex mb-6 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${mode === 'login' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              <LogIn size={14} className="inline mr-1.5" />
              Masuk
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(null); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${mode === 'register' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              <UserPlus size={14} className="inline mr-1.5" />
              Daftar
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-400">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Nama Lengkap</label>
                <Input
                  type="text"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Misal: Alex Chandra"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Username</label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email (Opsional)</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Pekerjaan (Opsional)</label>
                  <Input
                    type="text"
                    value={pekerjaan}
                    onChange={(e) => setPekerjaan(e.target.value)}
                    placeholder="Software Engineer"
                  />
                </div>
              </>
            )}

            <Button
              type="submit"
              variant="default"
              size="lg"
              disabled={loading}
              className="w-full mt-2 font-bold"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {mode === 'login' ? 'Memproses...' : 'Mendaftarkan...'}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {mode === 'login' ? <LogIn size={16} /> : <UserPlus size={16} />}
                  {mode === 'login' ? 'Masuk' : 'Daftar Akun'}
                </span>
              )}
            </Button>
          </form>

          <div className="mt-5 text-center text-xs text-slate-500 dark:text-slate-400">
            {mode === 'login' ? (
              <span>
                Belum punya akun?{' '}
                <button type="button" onClick={switchMode} className="font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                  Daftar di sini
                </button>
              </span>
            ) : (
              <span>
                Sudah punya akun?{' '}
                <button type="button" onClick={switchMode} className="font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                  Masuk di sini
                </button>
              </span>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};