import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchMeApi, logoutApi } from '@/lib/authApi';
import type { User } from '@/types';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  refreshAuth: () => Promise<User | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAuth = useCallback(async () => {
    try {
      const u = await fetchMeApi();
      setUser(u);
      return u;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    void refreshAuth().finally(() => setLoading(false));
  }, [refreshAuth]);

  const logout = useCallback(async () => {
    await logoutApi();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, refreshAuth, logout }),
    [user, loading, refreshAuth, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
