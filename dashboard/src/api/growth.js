import { supabase } from '../auth/supabaseClient';

const BASE = import.meta.env.VITE_API_URL || '/api/v1';

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function request(path) {
  const res = await fetch(`${BASE}/growth${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeader()),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(data.error || 'Growth request failed'), { status: res.status, data });
  }
  return data;
}

export const growthApi = {
  getSummary: () => request('/summary'),
};
