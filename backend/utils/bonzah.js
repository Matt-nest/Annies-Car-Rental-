/**
 * Bonzah API HTTP client.
 *
 * Auth model: Bonzah issues a 15-minute token from POST /api/v1/auth.
 * We re-auth on every transaction (no token caching) — simpler than tracking
 * expiry across serverless invocations, and 1 extra round-trip is negligible
 * vs. risk of mid-flow expiry.
 *
 * Every call writes one row to bonzah_events for audit + debugging.
 *
 * Errors: throws BonzahError on transport failure OR on data.status !== 0.
 * Response shape from Bonzah: { status: 0|nonzero, txt: 'msg', data: {...} }
 */

import { supabase } from '../db/supabase.js';

export class BonzahError extends Error {
  constructor(message, { httpStatus, bonzahStatus, bonzahTxt, eventType } = {}) {
    super(message);
    this.name = 'BonzahError';
    this.httpStatus = httpStatus;
    this.bonzahStatus = bonzahStatus;
    this.bonzahTxt = bonzahTxt;
    this.eventType = eventType;
  }
}

const BASE_URL = process.env.BONZAH_API_BASE_URL || 'https://bonzah.sb.insillion.com';
const BONZAH_EMAIL = process.env.BONZAH_EMAIL;
const BONZAH_PASSWORD = process.env.BONZAH_PASSWORD;

const FETCH_TIMEOUT_MS = 15_000;

/**
 * Authenticate against Bonzah and return a fresh token.
 * Internal — public callers use bonzahCall() which auths automatically.
 */
async function authenticate() {
  if (!BONZAH_EMAIL || !BONZAH_PASSWORD) {
    throw new BonzahError('Missing BONZAH_EMAIL or BONZAH_PASSWORD env vars', { eventType: 'auth' });
  }

  const start = Date.now();
  let httpStatus = 0;
  let body = null;
  let errorText = null;

  try {
    const res = await fetchWithTimeout(`${BASE_URL}/api/v1/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: BONZAH_EMAIL, pwd: BONZAH_PASSWORD }),
    });
    httpStatus = res.status;
    body = await res.json().catch(() => null);

    // Bonzah nests the token inside `data`: { status: 0, txt, data: { token, ... } }
    const token = body?.data?.token;
    if (!res.ok || !body || body.status !== 0 || !token) {
      errorText = body?.txt || (body && body.status === 0 ? 'No token in response (data.token missing)' : `HTTP ${res.status}`);
      throw new BonzahError(`Bonzah auth failed: ${errorText}`, {
        httpStatus,
        bonzahStatus: body?.status,
        bonzahTxt: body?.txt,
        eventType: 'auth',
      });
    }

    return token;
  } finally {
    // Audit log — redact password in stored request
    await logEvent({
      booking_id: null,
      event_type: 'auth',
      request_json: { email: BONZAH_EMAIL, pwd: '***REDACTED***' },
      response_json: body ? { status: body.status, txt: body.txt, token: body?.data?.token ? '***PRESENT***' : null } : null,
      status_code: httpStatus,
      duration_ms: Date.now() - start,
      error_text: errorText,
    });
  }
}

/**
 * Make an authenticated Bonzah API call.
 *
 * @param {Object} opts
 * @param {string} opts.method   'GET' | 'POST' | 'DEL'
 * @param {string} opts.path      e.g., '/api/v1/Bonzah/quote'
 * @param {Object} [opts.body]    JSON payload (POST only)
 * @param {Object} [opts.query]   query params (appended to URL)
 * @param {string} opts.eventType audit log event_type ('quote'|'bind'|'policy_get'|'cancel'|'extend'|'epayment'|'health'|'poll')
 * @param {string} [opts.bookingId] booking UUID for audit-log linkage
 * @param {Object} [opts.redactRequest] keys in body to redact from audit log
 * @returns {Promise<Object>} parsed Bonzah response body { status, txt, data }
 */
export async function bonzahCall({ method, path, body, query, eventType, bookingId, redactRequest = [] }) {
  const token = await authenticate();

  let url = `${BASE_URL}${path}`;
  if (query && Object.keys(query).length) {
    const qs = new URLSearchParams(query).toString();
    url += `?${qs}`;
  }

  const start = Date.now();
  let httpStatus = 0;
  let parsed = null;
  let errorText = null;

  try {
    const init = {
      method: method === 'DEL' ? 'DELETE' : method,
      headers: {
        'Content-Type': 'application/json',
        'in-auth-token': token,
      },
    };
    if (body && method !== 'GET') init.body = JSON.stringify(body);

    const res = await fetchWithRetry(url, init);
    httpStatus = res.status;
    parsed = await res.json().catch(() => null);

    if (!res.ok) {
      errorText = parsed?.txt || `HTTP ${res.status}`;
      throw new BonzahError(`Bonzah ${eventType} HTTP ${res.status}: ${errorText}`, {
        httpStatus,
        bonzahStatus: parsed?.status,
        bonzahTxt: parsed?.txt,
        eventType,
      });
    }

    if (parsed && parsed.status !== 0) {
      errorText = parsed.txt || 'Unknown Bonzah error';
      throw new BonzahError(`Bonzah ${eventType} failed: ${errorText}`, {
        httpStatus,
        bonzahStatus: parsed.status,
        bonzahTxt: parsed.txt,
        eventType,
      });
    }

    return parsed;
  } catch (err) {
    if (!errorText) errorText = err?.message || 'fetch failed';
    throw err instanceof BonzahError ? err : new BonzahError(`Bonzah ${eventType} transport error: ${errorText}`, {
      httpStatus,
      eventType,
    });
  } finally {
    await logEvent({
      booking_id: bookingId || null,
      event_type: eventType,
      request_json: redactBody(body, redactRequest),
      response_json: parsed,
      status_code: httpStatus,
      duration_ms: Date.now() - start,
      error_text: errorText,
    });
  }
}

/**
 * Fetch a binary asset (PDF) from Bonzah.
 *
 * Bonzah returns the file body raw — no JSON envelope. We can't reuse bonzahCall()
 * because it always parses as JSON. Re-auths on every call same as the JSON path.
 * Logs to bonzah_events with the response_json field set to a small descriptor
 * (size, content-type) — we don't store the binary itself.
 *
 * @param {Object} opts
 * @param {string} opts.policyId
 * @param {number|string} opts.dataId — one of cdw_pdf_id / rcli_pdf_id / sli_pdf_id / pai_pdf_id
 * @param {string} [opts.bookingId]
 * @returns {Promise<{ buffer: Buffer, contentType: string, sizeBytes: number }>}
 */
export async function bonzahCallBinary({ policyId, dataId, bookingId }) {
  if (!policyId) throw new BonzahError('policyId required for PDF fetch', { eventType: 'pdf' });
  if (!dataId) throw new BonzahError('dataId required for PDF fetch', { eventType: 'pdf' });

  const token = await authenticate();
  const url = `${BASE_URL}/api/v1/policy/data/${encodeURIComponent(policyId)}?data_id=${encodeURIComponent(dataId)}&download=1`;

  const start = Date.now();
  let httpStatus = 0;
  let errorText = null;
  let sizeBytes = 0;
  let contentType = '';
  let buffer = null;

  try {
    const res = await fetchWithTimeout(url, {
      method: 'GET',
      headers: { 'in-auth-token': token },
    });
    httpStatus = res.status;
    contentType = res.headers.get('content-type') || '';

    if (!res.ok) {
      // Bonzah usually returns JSON with status/txt on errors even on the binary endpoint
      const errBody = await res.text().catch(() => '');
      errorText = `HTTP ${res.status}: ${errBody.slice(0, 200)}`;
      throw new BonzahError(`Bonzah PDF fetch failed: ${errorText}`, { httpStatus, eventType: 'pdf' });
    }

    const arrayBuf = await res.arrayBuffer();
    buffer = Buffer.from(arrayBuf);
    sizeBytes = buffer.length;

    return { buffer, contentType, sizeBytes };
  } catch (err) {
    if (!errorText) errorText = err?.message || 'fetch failed';
    throw err instanceof BonzahError ? err : new BonzahError(`Bonzah PDF transport error: ${errorText}`, {
      httpStatus,
      eventType: 'pdf',
    });
  } finally {
    await logEvent({
      booking_id: bookingId || null,
      event_type: 'pdf',
      request_json: { policy_id: policyId, data_id: dataId },
      response_json: buffer ? { content_type: contentType, size_bytes: sizeBytes } : null,
      status_code: httpStatus,
      duration_ms: Date.now() - start,
      error_text: errorText,
    });
  }
}

/**
 * Insert one row into bonzah_events. Never throws — audit failures don't block calls.
 */
async function logEvent(row) {
  try {
    await supabase.from('bonzah_events').insert(row);
  } catch (e) {
    // Don't surface — logging failure shouldn't break the API call
    console.error('[bonzah] audit log insert failed:', e?.message || e);
  }
}

function redactBody(body, keys) {
  if (!body || !keys?.length) return body || null;
  const clone = { ...body };
  for (const k of keys) {
    if (k in clone) clone[k] = '***REDACTED***';
  }
  return clone;
}

async function fetchWithTimeout(url, init, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

/**
 * One retry on 5xx. Bonzah doesn't document idempotency keys — only retry GETs
 * and the read-only quote-calc operations. POSTs that bind/charge are NOT retried
 * by this helper; service layer decides per-operation.
 */
async function fetchWithRetry(url, init) {
  const res = await fetchWithTimeout(url, init);
  if (res.status >= 500 && res.status < 600 && (init.method === 'GET' || init.method === 'DELETE')) {
    return fetchWithTimeout(url, init);
  }
  return res;
}
