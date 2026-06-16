/**
 * bookingApi — sibling to api/client.js for the New Booking modal's ID-scan and
 * photo-upload calls. Kept separate so the 25-consumer api/client.js stays
 * untouched (per CLAUDE.md hard rule). Mirrors client.js's auth pattern: bearer
 * token from the current Supabase session, multipart body (no JSON content-type).
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

  /**
   * Admin-generate a rental agreement/contract in person (no customer link).
   * body: { address/license/dob/insurance fields, customer_signature_data?,
   *         owner_signature_data?, signature_mode: 'digital'|'wet', license_photo_paths? }
   * Returns { success, agreementId, signature_mode, document }.
   */
  adminGenerateAgreement: async (bookingId, body) => jsonPost(`/agreements/${bookingId}/admin-generate`, body),

  /** List the documents (contracts + invoices) archived for a customer. */
  getCustomerDocuments: async (customerId) => jsonGet(`/customers/${customerId}/documents`),

  /** List the documents archived for a single booking. */
  getBookingDocuments: async (bookingId) => jsonGet(`/bookings/${bookingId}/documents`),

  /** Resolve a short-lived signed download URL for one archived document. */
  downloadDocument: async (documentId) => jsonGet(`/documents/${documentId}/download`),
};

async function jsonGet(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { ...(await authHeader()) } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error || 'Request failed'), { status: res.status });
  }
  return res.json();
}

async function jsonPost(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error || 'Request failed'), { status: res.status });
  }
  return res.json();
}
