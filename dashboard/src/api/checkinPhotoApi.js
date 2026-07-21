import { supabase } from '../auth/supabaseClient';

const BASE = import.meta.env.VITE_API_URL || '/api/v1';

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

export async function uploadAdminCheckinPhotos(bookingId, files) {
  const form = new FormData();
  form.append('bookingId', bookingId);
  files.forEach((file) => form.append('photos', file));

  const res = await fetch(`${BASE}/uploads/checkin-photos/admin`, {
    method: 'POST',
    headers: { ...(await authHeader()) },
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error || 'Upload failed'), { status: res.status });
  }

  const data = await res.json();
  return Array.isArray(data.photos) ? data.photos : [];
}
