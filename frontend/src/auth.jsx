import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from './api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api.me().then((r) => setUser(r.user)).catch(() => setToken('')).finally(() => setLoading(false));
  }, []);

  const finish = useCallback((r) => { setToken(r.token); setUser(r.user); return r.user; }, []);
  const value = {
    user, loading,
    login: async (b) => finish(await api.login(b)),
    register: async (b) => finish(await api.register(b)),
    logout: () => { setToken(''); setUser(null); },
    refresh: async () => setUser((await api.me()).user),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
