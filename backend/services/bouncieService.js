/**
 * Bouncie telematics integration — OAuth, token management, REST client.
 *
 * Auth model: OAuth 2.0 authorization-code flow against auth.bouncie.com.
 * One Bouncie account holds the entire fleet (single connected_credentials row).
 *
 * REST quirk: the `Authorization` header is the access token *verbatim* — no
 * `Bearer ` prefix. The docs call this out and a 401 is the usual symptom of
 * accidentally adding the prefix.
 *
 * Every REST call writes one row to bouncie_events (source='rest') for debugging.
 */

import jwt from 'jsonwebtoken';
import { supabase } from '../db/supabase.js';

const AUTH_BASE = 'https://auth.bouncie.com';
const API_BASE = 'https://api.bouncie.dev/v1';
const FETCH_TIMEOUT_MS = 15000;

// State JWT (signed OAuth state) lives 10 minutes — long enough to log in,
// short enough to limit replay.
const STATE_TTL_SECONDS = 600;

// Refresh slightly before expiry so concurrent callers don't race with a 401.
const REFRESH_LEEWAY_SECONDS = 60;

export class BouncieError extends Error {
  constructor(message, { httpStatus, bouncieStatus, bouncieTxt } = {}) {
    super(message);
    this.name = 'BouncieError';
    this.httpStatus = httpStatus;
    this.bouncieStatus = bouncieStatus;
    this.bouncieTxt = bouncieTxt;
  }
}

// ────────────────────────────────────────────────────────────
// Env var accessors
// ────────────────────────────────────────────────────────────
function clientId() {
  const v = process.env.BOUNCIE_CLIENT_ID;
  if (!v) throw new BouncieError('Missing BOUNCIE_CLIENT_ID env var');
  return v;
}
function clientSecret() {
  const v = process.env.BOUNCIE_CLIENT_SECRET;
  if (!v) throw new BouncieError('Missing BOUNCIE_CLIENT_SECRET env var');
  return v;
}
function redirectUri() {
  const v = process.env.BOUNCIE_REDIRECT_URI;
  if (!v) throw new BouncieError('Missing BOUNCIE_REDIRECT_URI env var');
  return v;
}
function stateSecret() {
  // Reuse PORTAL_JWT_SECRET so we don't add yet another env var. It already
  // exists in production for the customer portal.
  const v = process.env.BOUNCIE_STATE_SECRET || process.env.PORTAL_JWT_SECRET;
  if (!v) throw new BouncieError('Missing BOUNCIE_STATE_SECRET (or PORTAL_JWT_SECRET) env var');
  return v;
}

export function webhookSecret() {
  return process.env.BOUNCIE_WEBHOOK_SECRET || '';
}

// ────────────────────────────────────────────────────────────
// OAuth state — signed JWT carrying admin user_id + nonce
// ────────────────────────────────────────────────────────────
export function signState(adminUserId) {
  return jwt.sign(
    { uid: adminUserId, n: Math.random().toString(36).slice(2, 10) },
    stateSecret(),
    { expiresIn: STATE_TTL_SECONDS }
  );
}

export function verifyState(stateToken) {
  try {
    return jwt.verify(stateToken, stateSecret());
  } catch (e) {
    throw new BouncieError(`Invalid OAuth state: ${e.message}`);
  }
}

export function buildAuthorizeUrl(state) {
  const url = new URL(`${AUTH_BASE}/dialog/authorize`);
  url.searchParams.set('client_id', clientId());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri());
  url.searchParams.set('state', state);
  return url.toString();
}

// ────────────────────────────────────────────────────────────
// Token exchange + refresh
// ────────────────────────────────────────────────────────────
async function tokenRequest(body) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${AUTH_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(t);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new BouncieError(`Bouncie token request failed: ${res.status} ${json.error || json.message || res.statusText}`, { httpStatus: res.status });
  }
  return json;
}

export async function exchangeCodeForTokens(code) {
  return tokenRequest({
    client_id: clientId(),
    client_secret: clientSecret(),
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
  });
}

async function refreshTokens(refreshToken) {
  return tokenRequest({
    client_id: clientId(),
    client_secret: clientSecret(),
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
}

// ────────────────────────────────────────────────────────────
// Credential persistence
// ────────────────────────────────────────────────────────────
export async function saveCredentials({ tokens, adminUserId, bouncieUserEmail }) {
  const expiresAt = new Date(Date.now() + (tokens.expires_in || 0) * 1000).toISOString();

  // Soft-delete any previously active row so the unique partial index allows the new one.
  await supabase
    .from('bouncie_credentials')
    .update({ disconnected_at: new Date().toISOString() })
    .is('disconnected_at', null);

  const { data, error } = await supabase
    .from('bouncie_credentials')
    .insert({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt,
      bouncie_user_email: bouncieUserEmail || null,
      connected_by: adminUserId || null,
    })
    .select()
    .single();
  if (error) throw new BouncieError(`Failed to save credentials: ${error.message}`);
  return data;
}

export async function getActiveCredentials() {
  const { data, error } = await supabase
    .from('bouncie_credentials')
    .select('*')
    .is('disconnected_at', null)
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new BouncieError(`Failed to load credentials: ${error.message}`);
  return data;
}

export async function disconnect() {
  const { error } = await supabase
    .from('bouncie_credentials')
    .update({ disconnected_at: new Date().toISOString() })
    .is('disconnected_at', null);
  if (error) throw new BouncieError(`Failed to disconnect: ${error.message}`);
}

/**
 * Returns a valid access token, refreshing if within the leeway window of expiry.
 * Throws BouncieError if not connected at all.
 */
export async function getAccessToken() {
  const creds = await getActiveCredentials();
  if (!creds) throw new BouncieError('Bouncie is not connected. Connect from Telematics → Settings.');

  const expiresMs = new Date(creds.token_expires_at).getTime();
  const nowMs = Date.now();
  if (expiresMs - nowMs > REFRESH_LEEWAY_SECONDS * 1000) {
    return creds.access_token;
  }

  // Refresh
  const tokens = await refreshTokens(creds.refresh_token);
  const expiresAt = new Date(Date.now() + (tokens.expires_in || 0) * 1000).toISOString();
  const { error } = await supabase
    .from('bouncie_credentials')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', creds.id);
  if (error) throw new BouncieError(`Failed to persist refreshed token: ${error.message}`);
  return tokens.access_token;
}

// ────────────────────────────────────────────────────────────
// REST helper — wraps fetch and logs to bouncie_events
// ────────────────────────────────────────────────────────────
async function logEvent({ event_type, source, payload, request_path, status_code, duration_ms, error_text }) {
  // Fire-and-forget; never block the calling request on audit-log writes
  supabase.from('bouncie_events').insert({
    event_type,
    source,
    payload,
    request_path,
    status_code,
    duration_ms,
    error_text,
    processed_at: new Date().toISOString(),
  }).then(({ error }) => {
    if (error) console.warn('[Bouncie] event log insert failed:', error.message);
  });
}

async function bouncieFetch(path, { method = 'GET', body } = {}) {
  const token = await getAccessToken();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const started = Date.now();
  let res, json, errText;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        // NOTE: Bouncie expects the raw token, NOT "Bearer <token>" — adding
        // Bearer is the most common 401 cause.
        'Authorization': token,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    json = await res.json().catch(() => ({}));
    if (!res.ok) {
      errText = `Bouncie ${method} ${path} returned ${res.status}: ${json?.errors || json?.error || res.statusText}`;
    }
  } catch (e) {
    errText = `Bouncie ${method} ${path} failed: ${e.message}`;
  } finally {
    clearTimeout(t);
  }

  const duration_ms = Date.now() - started;
  logEvent({
    event_type: 'rest_call',
    source: 'rest',
    payload: { method, body: body || null, response: json || null },
    request_path: path,
    status_code: res?.status,
    duration_ms,
    error_text: errText,
  });

  if (errText) throw new BouncieError(errText, { httpStatus: res?.status });
  return json;
}

// ────────────────────────────────────────────────────────────
// REST endpoints
// ────────────────────────────────────────────────────────────
export const bouncieApi = {
  getUser:     () => bouncieFetch('/user'),
  getVehicles: () => bouncieFetch('/vehicles'),

  /** /trips supports filters: starts-after, starts-before, gps-format=polyline|geojson, transaction-id */
  getTrips: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return bouncieFetch(`/trips${qs ? `?${qs}` : ''}`);
  },

  // Geo-zones — three-step create
  createLocation:    (body) => bouncieFetch('/locations', { method: 'POST', body }),
  createSchedule:    (body) => bouncieFetch('/schedules', { method: 'POST', body }),
  createGeozone:     (body) => bouncieFetch('/application-geozones', { method: 'POST', body }),
  deleteGeozone:     (id)   => bouncieFetch(`/application-geozones/${id}`, { method: 'DELETE' }),
  deleteLocation:    (id)   => bouncieFetch(`/locations/${id}`,            { method: 'DELETE' }),
  deleteSchedule:    (id)   => bouncieFetch(`/schedules/${id}`,            { method: 'DELETE' }),
};

// ────────────────────────────────────────────────────────────
// Vehicle sync — pull Bouncie's vehicle list, upsert locally,
// auto-match to annie's vehicles by VIN.
// ────────────────────────────────────────────────────────────
export async function syncVehicles() {
  const list = await bouncieApi.getVehicles();
  // /vehicles returns an array of vehicle objects
  const vehicles = Array.isArray(list) ? list : (list?.vehicles || []);
  if (vehicles.length === 0) return { synced: 0, matched: 0 };

  let matched = 0;
  for (const v of vehicles) {
    const imei = v.imei || v.deviceImei;
    if (!imei) continue;
    const vin = v.vin || null;

    // Try VIN match against fleet
    let annieVehicleId = null;
    if (vin) {
      const { data: match } = await supabase
        .from('vehicles')
        .select('id')
        .ilike('vin', vin)
        .maybeSingle();
      if (match?.id) {
        annieVehicleId = match.id;
        matched += 1;
      }
    }

    const stats = v.stats || {};
    const loc = stats.location || {};

    await supabase.from('bouncie_vehicles').upsert({
      imei,
      vin,
      annie_vehicle_id: annieVehicleId,
      bouncie_year: v.year || null,
      bouncie_make: v.model?.make || v.make || null,
      bouncie_model: v.model?.name || v.model || null,
      bouncie_nickname: v.nickName || v.nickname || null,
      last_lat: loc.lat ?? null,
      last_lng: loc.lon ?? loc.lng ?? null,
      last_heading: loc.heading ?? null,
      last_speed_mph: stats.speed ?? null,
      last_address: loc.address ?? null,
      last_fuel_pct: stats.fuelLevel ?? null,
      last_odometer_miles: stats.odometer ?? null,
      last_engine_running: stats.isRunning ?? null,
      last_battery_status: stats.battery?.status ?? null,
      last_mil_status: stats.mil?.milOn ? 'ON' : null,
      last_dtc_codes: Array.isArray(stats.mil?.codes) ? stats.mil.codes.join(',') : null,
      last_synced_at: new Date().toISOString(),
      raw_json: v,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'imei' });
  }

  return { synced: vehicles.length, matched };
}

// ────────────────────────────────────────────────────────────
// Lookup helper — given an IMEI, find the matching annie vehicle id (if any)
// ────────────────────────────────────────────────────────────
export async function lookupAnnieVehicleByImei(imei) {
  if (!imei) return null;
  const { data } = await supabase
    .from('bouncie_vehicles')
    .select('annie_vehicle_id, vin')
    .eq('imei', imei)
    .maybeSingle();
  return data?.annie_vehicle_id || null;
}
