import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { supabase } from '../db/supabase.js';

// Customer portal accounts (admin-provisioned). Auth is intentionally separate
// from admin Supabase Auth — it reuses the existing portal JWT secret/pattern
// (see portalAuthService.js) but issues a distinct `type: 'account'` token so a
// booking-code portal token can never be used on account routes and vice-versa.

const PORTAL_SECRET = process.env.PORTAL_JWT_SECRET;
const ACCOUNT_TOKEN_EXPIRY = '30d'; // long-lived account session (vs 4h booking session)

// ── Password hashing (Node built-in scrypt — no native dep, Vercel-safe) ─────
// Stored format: "scrypt$<saltHex>$<derivedHex>"
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password, stored) {
  try {
    const [scheme, salt, hash] = String(stored).split('$');
    if (scheme !== 'scrypt' || !salt || !hash) return false;
    const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(derived, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ── Username generation: FirstName + Last initial, lowercased + deduped ──────
function baseUsername(firstName, lastName) {
  const f = String(firstName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const l = String(lastName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '').charAt(0);
  return `${f}${l}` || 'user';
}

async function uniqueUsername(base) {
  let candidate = base;
  let n = 1;
  // Append a counter until the username is free (case-insensitive).
  // Bounded loop guards against an unexpected runaway.
  for (let i = 0; i < 1000; i++) {
    const { data } = await supabase
      .from('customer_accounts')
      .select('id')
      .ilike('username', candidate)
      .maybeSingle();
    if (!data) return candidate;
    n += 1;
    candidate = `${base}${n}`;
  }
  // Extremely unlikely fallback — random suffix
  return `${base}${crypto.randomBytes(2).toString('hex')}`;
}

// Default password = the customer's phone digits (last 10 if longer).
function phoneToPassword(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  return digits.length > 10 ? digits.slice(-10) : digits;
}

// ── Provisioning (admin) ─────────────────────────────────────────────────────
/**
 * Create a portal account for an existing customer. Idempotent-ish: if an
 * account already exists it is returned without resetting the password (use
 * resetPassword for that). Returns { username, tempPassword, alreadyExisted }.
 */
export async function provisionAccount(customerId, { createdBy = null } = {}) {
  const { data: customer, error: cErr } = await supabase
    .from('customers')
    .select('id, first_name, last_name, phone')
    .eq('id', customerId)
    .single();
  if (cErr || !customer) {
    throw Object.assign(new Error('Customer not found'), { status: 404 });
  }

  const { data: existing } = await supabase
    .from('customer_accounts')
    .select('id, username')
    .eq('customer_id', customerId)
    .maybeSingle();
  if (existing) {
    return { username: existing.username, tempPassword: null, alreadyExisted: true };
  }

  const tempPassword = phoneToPassword(customer.phone);
  if (!tempPassword) {
    throw Object.assign(
      new Error('Customer has no phone number — add one before provisioning an account'),
      { status: 400 }
    );
  }

  const username = await uniqueUsername(baseUsername(customer.first_name, customer.last_name));

  const { error: insErr } = await supabase.from('customer_accounts').insert({
    customer_id: customerId,
    username,
    password_hash: hashPassword(tempPassword),
    must_change_password: true,
    status: 'active',
    created_by: createdBy,
  });
  if (insErr) throw insErr;

  return { username, tempPassword, alreadyExisted: false };
}

/** Reset an account's password back to the customer's phone (admin handoff). */
export async function resetPassword(customerId) {
  const { data: account } = await supabase
    .from('customer_accounts')
    .select('id, customer_id, customers(phone)')
    .eq('customer_id', customerId)
    .maybeSingle();
  if (!account) {
    throw Object.assign(new Error('No account for this customer'), { status: 404 });
  }
  const tempPassword = phoneToPassword(account.customers?.phone);
  if (!tempPassword) {
    throw Object.assign(new Error('Customer has no phone number'), { status: 400 });
  }
  const { error } = await supabase
    .from('customer_accounts')
    .update({
      password_hash: hashPassword(tempPassword),
      must_change_password: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', account.id);
  if (error) throw error;
  return { tempPassword };
}

/** Account status for the admin UI (no secrets). */
export async function getAccountForCustomer(customerId) {
  const { data } = await supabase
    .from('customer_accounts')
    .select('username, status, must_change_password, last_login_at, created_at')
    .eq('customer_id', customerId)
    .maybeSingle();
  return data || null;
}

// ── Login (customer) ─────────────────────────────────────────────────────────
export async function loginAccount(username, password) {
  if (!PORTAL_SECRET) {
    throw Object.assign(new Error('Portal authentication not configured'), { status: 500 });
  }
  if (!username || !password) {
    throw Object.assign(new Error('Username and password are required'), { status: 400 });
  }

  const { data: account } = await supabase
    .from('customer_accounts')
    .select('id, customer_id, username, password_hash, status, must_change_password')
    .ilike('username', String(username).trim())
    .maybeSingle();

  // Constant-ish failure for both unknown-user and bad-password.
  if (!account || account.status !== 'active' || !verifyPassword(password, account.password_hash)) {
    throw Object.assign(new Error('Incorrect username or password'), { status: 401 });
  }

  await supabase
    .from('customer_accounts')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', account.id);

  const token = jwt.sign(
    { type: 'account', accountId: account.id, customerId: account.customer_id, username: account.username },
    PORTAL_SECRET,
    { expiresIn: ACCOUNT_TOKEN_EXPIRY }
  );

  const customer = await getAccountCustomer(account.customer_id);
  return { token, mustChangePassword: account.must_change_password, customer };
}

/** Set a new password (clears the must_change flag). */
export async function setAccountPassword(accountId, newPassword) {
  const pw = String(newPassword || '');
  if (pw.length < 8) {
    throw Object.assign(new Error('Password must be at least 8 characters'), { status: 400 });
  }
  const { error } = await supabase
    .from('customer_accounts')
    .update({
      password_hash: hashPassword(pw),
      must_change_password: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', accountId);
  if (error) throw error;
  return { success: true };
}

/** Public-safe customer profile for the portal. */
export async function getAccountCustomer(customerId) {
  const { data } = await supabase
    .from('customers')
    .select('id, first_name, last_name, email, phone, avatar_url, address_line1, address_line2, city, state, zip')
    .eq('id', customerId)
    .single();
  return data || null;
}

// ── Token verification + middleware ──────────────────────────────────────────
export function verifyAccountToken(token) {
  if (!PORTAL_SECRET) {
    throw Object.assign(new Error('Portal authentication not configured'), { status: 500 });
  }
  let decoded;
  try {
    decoded = jwt.verify(token, PORTAL_SECRET);
  } catch {
    throw Object.assign(new Error('Invalid or expired session'), { status: 401 });
  }
  if (decoded.type !== 'account') {
    throw Object.assign(new Error('Invalid session type'), { status: 401 });
  }
  return decoded;
}

/** Express middleware — verifies the account JWT, sets req.account. */
export function requireAccountAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Account authentication required' });
  }
  try {
    req.account = verifyAccountToken(authHeader.split(' ')[1]);
    next();
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.message });
  }
}
