import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface AuthUser {
  user_id: number;
  username: string;
  nama: string;
  email?: string | null;
  pekerjaan?: string | null;
  poin: number;
  saldo: number;
  role: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (payload: {
    username: string;
    password: string;
    nama: string;
    email?: string;
    pekerjaan?: string;
  }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = 'genposfit_token';
const USER_KEY = 'genposfit_user';

const apiUrl = () => import.meta.env?.VITE_API_URL || '';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
    setLoading(false);
  }, []);

  const persist = (nextToken: string, nextUser: AuthUser) => {
    setToken(nextToken);
    setUser(nextUser);
    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
  };

  const login = async (username: string, password: string) => {
    const res = await fetch(`${apiUrl()}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.detail || 'Login gagal. Periksa username atau password.');
    }
    const data = await res.json();
    persist(data.access_token, {
      user_id: data.user_id,
      username: data.username,
      nama: data.nama,
      poin: data.poin ?? 0,
      saldo: data.saldo ?? 0,
      role: data.role ?? 'user',
    });
  };

  const register = async (payload: {
    username: string;
    password: string;
    nama: string;
    email?: string;
    pekerjaan?: string;
  }) => {
    const res = await fetch(`${apiUrl()}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.detail || 'Registrasi gagal. Coba lagi.');
    }
    const data = await res.json();
    persist(data.access_token, {
      user_id: data.user_id,
      username: data.username,
      nama: data.nama,
      poin: data.poin ?? 0,
      saldo: data.saldo ?? 0,
      role: data.role ?? 'user',
    });
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated: !!user, loading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth harus dipakai di dalam <AuthProvider>');
  }
  return ctx;
}