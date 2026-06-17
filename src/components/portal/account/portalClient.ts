/**
 * portalClient — customer-account portal API + token storage.
 *
 * Separate from the legacy code+email portal (which keeps a 4h session in
 * component state). Account sessions are long-lived (30d) and persisted in
 * localStorage so the renter stays logged in across visits. The token is the
 * `type:'account'` JWT issued by POST /account/login.
 */
import { API_URL } from '../../../config';

const TOKEN_KEY = 'annie_portal_account_token';

export interface PortalCustomer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  avatar_url: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

export interface LoginResult {
  token: string;
  mustChangePassword: boolean;
  customer: PortalCustomer;
}

// ── Token storage ────────────────────────────────────────────────────────────
export const tokenStore = {
  get(): string | null {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set(token: string) {
    try { localStorage.setItem(TOKEN_KEY, token); } catch { /* private mode */ }
  },
  clear() {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* noop */ }
  },
};

export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 < Date.now() : false;
  } catch {
    return true;
  }
}

// ── Fetch helpers ────────────────────────────────────────────────────────────
async function parseError(res: Response): Promise<Error & { status: number }> {
  const body = await res.json().catch(() => ({ error: res.statusText }));
  return Object.assign(new Error(body.error || 'Request failed'), { status: res.status });
}

/** Authenticated GET against the account API. Throws on non-2xx. */
export async function authGet<T = any>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

/** Authenticated JSON mutation (POST/PUT) against the account API. */
export async function authSend<T = any>(
  path: string,
  token: string,
  body: unknown,
  method: 'POST' | 'PUT' = 'POST',
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

// ── Endpoints ────────────────────────────────────────────────────────────────
export async function login(username: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${API_URL}/account/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export const getMe = (token: string) =>
  authGet<{ username: string; customer: PortalCustomer }>('/account/me', token);

export const setPassword = (token: string, newPassword: string) =>
  authSend<{ success: boolean }>('/account/set-password', token, { newPassword });

export const updateProfile = (token: string, fields: Partial<PortalCustomer>) =>
  authSend<{ success: boolean; customer: PortalCustomer }>('/account/profile', token, fields, 'PUT');

// ── Trips ────────────────────────────────────────────────────────────────────
export interface TripVehicle {
  year?: number;
  make?: string;
  model?: string;
  vehicle_code?: string;
  thumbnail_url?: string | null;
}

export interface TripSummary {
  id: string;
  booking_code: string;
  status: string;
  rental_type?: string;
  pickup_date: string;
  return_date: string;
  pickup_time?: string;
  return_time?: string;
  pickup_location?: string | null;
  delivery_type?: string;
  total_cost?: number;
  deposit_amount?: number;
  deposit_status?: string;
  vehicles?: TripVehicle | null;
}

export interface TripDetail extends TripSummary {
  total_price: number;
  vehicle: TripVehicle | null;
  deposit: { amount: number; status: string; refund_amount: number | null } | null;
  invoice: any | null;
  lockbox_code: string | null;
  subtotal?: number;
  delivery_fee?: number;
  tax_amount?: number;
}

/** Upload a profile photo (multipart). Returns the new public URL + customer. */
export async function uploadAvatar(token: string, file: File): Promise<{ avatar_url: string; customer: PortalCustomer }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/account/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }, // no Content-Type — browser sets multipart boundary
    body: form,
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export const getTrips = (token: string) => authGet<TripSummary[]>('/account/trips', token);

export const getTrip = (token: string, id: string) =>
  authGet<TripDetail>(`/account/trips/${id}`, token);

// ── Wallet (cards on file) ───────────────────────────────────────────────────
export interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  exp_month: number | null;
  exp_year: number | null;
  cardholder_name: string | null;
}

export interface TripBalance {
  has_balance: boolean;
  amount_cents: number;
  invoice_id: string | null;
  status: string | null;
}

export const getTripBalance = (token: string, id: string) =>
  authGet<TripBalance>(`/account/trips/${id}/balance`, token);

export const payTripBalance = (
  token: string,
  id: string,
  source: { savedCardId?: string; sourceId?: string },
) => authSend<{ ok: boolean; payment_id: string; amount_cents: number }>(`/account/trips/${id}/pay`, token, source);

export const getCards = (token: string) => authGet<SavedCard[]>('/account/cards', token);

export const addCard = (token: string, sourceId: string) =>
  authSend<SavedCard>('/account/cards', token, { sourceId });

export async function removeCard(token: string, cardId: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_URL}/account/cards/${cardId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}
