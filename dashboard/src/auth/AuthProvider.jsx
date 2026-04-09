import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(null);

  useEffect(() => {
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
    try {
      const p = await api.getMyProfile();
      setProfile(p);
    } catch {
      setProfile(null);
    }
  }

  const signIn = async (email, password) => {
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (!result.error) {
      // Profile will be fetched by the onAuthStateChange listener
    }
    return result;
  };

  const signOut = () => {
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
