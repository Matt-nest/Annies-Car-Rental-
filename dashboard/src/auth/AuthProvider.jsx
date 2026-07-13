import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { api } from '../api/client';

const AuthContext = createContext(null);

const E2E_AUTH_BYPASS = import.meta.env.VITE_E2E_AUTH_BYPASS === 'true';
const E2E_USER = {
  id: 'e2e-admin',
  email: 'e2e-admin@example.com',
  user_metadata: { full_name: 'E2E Admin' },
};
const E2E_PROFILE = {
  id: 'e2e-admin',
  email: 'e2e-admin@example.com',
  first_name: 'E2E',
  last_name: 'Admin',
  role: 'owner',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(E2E_AUTH_BYPASS ? E2E_USER : undefined); // undefined = loading
  const [profile, setProfile] = useState(E2E_AUTH_BYPASS ? E2E_PROFILE : null);

  useEffect(() => {
    if (E2E_AUTH_BYPASS) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile();
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile() {
    if (E2E_AUTH_BYPASS) {
      setProfile(E2E_PROFILE);
      return E2E_PROFILE;
    }

    try {
      const p = await api.getMyProfile();
      setProfile(p);
    } catch {
      setProfile(null);
    }
  }

  const signIn = async (email, password) => {
    if (E2E_AUTH_BYPASS) {
      setUser(E2E_USER);
      setProfile(E2E_PROFILE);
      return { data: { user: E2E_USER, session: { access_token: 'e2e-token' } }, error: null };
    }

    const result = await supabase.auth.signInWithPassword({ email, password });
    if (!result.error) {
      // Profile will be fetched by the onAuthStateChange listener
    }
    return result;
  };

  const signOut = () => {
    if (E2E_AUTH_BYPASS) {
      setUser(E2E_USER);
      setProfile(E2E_PROFILE);
      return Promise.resolve({ error: null });
    }

    setProfile(null);
    return supabase.auth.signOut();
  };

  // Permission check helper
  const hasRole = (...roles) => roles.includes(profile?.role);

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading: user === undefined,
      signIn,
      signOut,
      hasRole,
      refreshProfile: fetchProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
