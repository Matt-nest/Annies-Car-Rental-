/**
 * AccountAuthContext — session state for the customer-account portal.
 *
 * Holds the persisted account JWT, the logged-in customer, and the
 * must-change-password flag. Auto-restores the session on mount (validates the
 * stored token against GET /account/me) and exposes login/logout/refresh.
 */
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import {
  tokenStore,
  isTokenExpired,
  login as apiLogin,
  getMe,
  setPassword as apiSetPassword,
  type PortalCustomer,
} from './portalClient';

interface AccountAuthValue {
  token: string | null;
  customer: PortalCustomer | null;
  username: string | null;
  mustChangePassword: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setPassword: (newPassword: string) => Promise<void>;
  refresh: () => Promise<void>;
  setCustomer: (c: PortalCustomer) => void;
}

const AccountAuthContext = createContext<AccountAuthValue | null>(null);

export function AccountAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [customer, setCustomer] = useState<PortalCustomer | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loading, setLoading] = useState(true);

  // Restore a persisted session on first mount.
  useEffect(() => {
    const stored = tokenStore.get();
    if (!stored || isTokenExpired(stored)) {
      tokenStore.clear();
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const me = await getMe(stored);
        setToken(stored);
        setCustomer(me.customer);
        setUsername(me.username);
      } catch {
        tokenStore.clear();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (u: string, p: string) => {
    const res = await apiLogin(u, p);
    tokenStore.set(res.token);
    setToken(res.token);
    setCustomer(res.customer);
    setUsername(u);
    setMustChangePassword(res.mustChangePassword);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setToken(null);
    setCustomer(null);
    setUsername(null);
    setMustChangePassword(false);
  }, []);

  const setPassword = useCallback(async (newPassword: string) => {
    if (!token) throw new Error('Not signed in');
    await apiSetPassword(token, newPassword);
    setMustChangePassword(false);
  }, [token]);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const me = await getMe(token);
      setCustomer(me.customer);
      setUsername(me.username);
    } catch { /* keep stale data on transient failure */ }
  }, [token]);

  const value: AccountAuthValue = {
    token,
    customer,
    username,
    mustChangePassword,
    loading,
    login,
    logout,
    setPassword,
    refresh,
    setCustomer,
  };

  return <AccountAuthContext.Provider value={value}>{children}</AccountAuthContext.Provider>;
}

export function useAccountAuth(): AccountAuthValue {
  const ctx = useContext(AccountAuthContext);
  if (!ctx) throw new Error('useAccountAuth must be used within AccountAuthProvider');
  return ctx;
}
