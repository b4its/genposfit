import { createContext, useState, ReactNode } from 'react';
import { getApiUrl } from '../lib/api';

export interface AuthUser {
  user_id: number;
  username: string;
  nama: string;
  role: string;
  email?: string | null;
  pekerjaan?: string | null;
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

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = 'genposfit_token';
const USER_KEY = 'genposfit_user';

const apiUrl = getApiUrl;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window === 'undefined') return null;
    const storedUser = localStorage.getItem(USER_KEY);
    if (storedUser) {
      try {
        return JSON.parse(storedUser);
      } catch {
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(TOKEN_KEY);
      }
    }
    return null;
  });
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  });
  const [loading] = useState<boolean>(false);

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
      role: data.role || 'user',
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
      role: data.role || 'user',
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

export { useAuth } from './useAuth';