/**
 * bookingApi — sibling to api/client.js for the New Booking modal's ID-scan and
 * photo-upload calls. Kept separate so the existing api/client.js consumers stay
 * untouched. Mirrors client.js's auth pattern: bearer token from the current
 * Supabase session, multipart body (no JSON content-type).
 */
import { supabase } from '../auth/supabaseClient';

const BASE = import.meta.env.VITE_API_URL || '/api/v1';

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

export const bookingApi = {
  /**
   * Server-side OCR (Azure Document Intelligence) on a still photo of an ID.
   * Used as the desktop / camera-less fallback to the in-browser PDF417 scan.
   * Returns { ok, fields? } — fields: { firstName, lastName, licenseNumber,
   * state, dob, expiry, addressLine1, city, zip }. Never throws on a bad scan;
   * resolves { ok:false } so the caller can fall through to manual entry.
   */
  scanId: async (file) => {
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch(`${BASE}/uploads/scan-id`, {
        method: 'POST',
        headers: { ...(await authHeader()) },
        body: form,
      });
      if (!res.ok) return { ok: false, reason: `http_${res.status}` };
      return await res.json();
    } catch {
      return { ok: false, reason: 'network' };
    }
  },

  /**
   * Upload an ID photo to the private id-photos bucket. Returns
   * { url, path, bucket }. `path` is what we persist (signed urls expire).
   */
  uploadIdPhoto: async (file) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE}/uploads/id-photo`, {
      method: 'POST',
      headers: { ...(await authHeader()) },
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw Object.assign(new Error(err.error || 'Upload failed'), { status: res.status });
    }
    return res.json();
  },
};
