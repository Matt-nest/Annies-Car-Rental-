import jwt from 'jsonwebtoken';
import { supabase } from '../db/supabase.js';

const PORTAL_SECRET = process.env.PORTAL_JWT_SECRET;
const TOKEN_EXPIRY = process.env.PORTAL_JWT_TTL || '12h';
const ADMIN_PREVIEW_TOKEN_EXPIRY = process.env.PORTAL_ADMIN_PREVIEW_JWT_TTL || '15m';

/**
 * Verify customer identity by booking code + email.
 * Returns a short-lived JWT for portal session.
 */
export async function verifyPortalAccess(bookingCode, email) {
  if (!PORTAL_SECRET) {
    throw Object.assign(new Error('Portal authentication not configured'), { status: 500 });
  }

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, booking_code, customer_id, status, customers(id, email, first_name, last_name)')
    .eq('booking_code', bookingCode.toUpperCase().trim())
    .single();

  if (error || !booking) {
    throw Object.assign(new Error('Booking not found'), { status: 404 });
  }

  // Verify email matches
  if (booking.customers?.email?.toLowerCase() !== email.toLowerCase().trim()) {
    throw Object.assign(new Error('Email does not match this booking'), { status: 401 });
  }

  // Don't allow portal access for declined/cancelled bookings
  if (['declined', 'cancelled'].includes(booking.status)) {
    throw Object.assign(new Error('This booking is no longer active'), { status: 403 });
  }

  const token = jwt.sign(
    {
      bookingId: booking.id,
      bookingCode: booking.booking_code,
      customerId: booking.customer_id,
      email: booking.customers.email,
    },
    PORTAL_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );

  return {
    token,
    booking: {
      id: booking.id,
      bookingCode: booking.booking_code,
      status: booking.status,
      customerName: `${booking.customers.first_name} ${booking.customers.last_name}`,
    },
  };
}

/**
 * Issue a fresh portal token from an already-verified session.
 */
export async function refreshPortalToken(decoded) {
  if (!PORTAL_SECRET) {
    throw Object.assign(new Error('Portal authentication not configured'), { status: 500 });
  }
  if (decoded.adminPreview) {
    throw Object.assign(new Error('Admin preview sessions cannot be refreshed'), { status: 403 });
  }

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, booking_code, customer_id, status, customers(email)')
    .eq('id', decoded.bookingId)
    .single();

  if (error || !booking) {
    throw Object.assign(new Error('Booking not found'), { status: 404 });
  }
  if (['declined', 'cancelled'].includes(booking.status)) {
    throw Object.assign(new Error('This booking is no longer active'), { status: 403 });
  }

  const token = jwt.sign(
    {
      bookingId: booking.id,
      bookingCode: booking.booking_code,
      customerId: booking.customer_id,
      email: booking.customers?.email || decoded.email,
    },
    PORTAL_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );

  return { token };
}

function choosePreviewBooking(bookings = []) {
  const priority = [
    'active',
    'ready_for_pickup',
    'confirmed',
    'approved',
    'pending_approval',
    'returned',
    'completed',
  ];
  for (const status of priority) {
    const match = bookings.find((booking) => booking.status === status);
    if (match) return match;
  }
  return bookings[0] || null;
}

/**
 * Issue a short-lived customer-portal JWT for an authenticated admin/owner.
 * This lets operators preview the exact customer portal without knowing the
 * customer's email verification details.
 */
export async function createAdminPortalPreview({ bookingId, customerId, actor }) {
  if (!PORTAL_SECRET) {
    throw Object.assign(new Error('Portal authentication not configured'), { status: 500 });
  }
  if (!bookingId && !customerId) {
    throw Object.assign(new Error('bookingId or customerId is required'), { status: 400 });
  }

  let booking = null;

  if (bookingId) {
    const { data, error } = await supabase
      .from('bookings')
      .select('id, booking_code, customer_id, status, created_at, customers(id, email, first_name, last_name)')
      .eq('id', bookingId)
      .single();
    if (error || !data) {
      throw Object.assign(new Error('Booking not found'), { status: 404 });
    }
    booking = data;
  } else {
    const { data, error } = await supabase
      .from('bookings')
      .select('id, booking_code, customer_id, status, pickup_date, created_at, customers(id, email, first_name, last_name)')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    booking = choosePreviewBooking(data || []);
    if (!booking) {
      throw Object.assign(new Error('No bookings found for this customer'), { status: 404 });
    }
  }

  if (['declined', 'cancelled'].includes(booking.status)) {
    throw Object.assign(new Error('The customer portal is inactive for this booking'), { status: 403 });
  }
  if (!booking.customers?.email) {
    throw Object.assign(new Error('Customer email is required for portal preview'), { status: 400 });
  }

  const token = jwt.sign(
    {
      bookingId: booking.id,
      bookingCode: booking.booking_code,
      customerId: booking.customer_id,
      email: booking.customers.email,
      adminPreview: true,
      actorId: actor?.id || null,
      actorEmail: actor?.email || null,
      actorRole: actor?.role || null,
    },
    PORTAL_SECRET,
    { expiresIn: ADMIN_PREVIEW_TOKEN_EXPIRY }
  );

  return {
    token,
    booking: {
      id: booking.id,
      bookingCode: booking.booking_code,
      status: booking.status,
      customerName: `${booking.customers.first_name || ''} ${booking.customers.last_name || ''}`.trim() || booking.customers.email,
      email: booking.customers.email,
    },
  };
}

/**
 * Verify a portal JWT token.
 * Returns the decoded payload or throws.
 */
export function verifyPortalToken(token) {
  if (!PORTAL_SECRET) {
    throw Object.assign(new Error('Portal authentication not configured'), { status: 500 });
  }

  try {
    return jwt.verify(token, PORTAL_SECRET);
  } catch (err) {
    throw Object.assign(new Error('Invalid or expired portal session'), { status: 401 });
  }
}

/**
 * Express middleware for portal routes.
 * Extracts and verifies the portal JWT from Authorization header.
 */
export function requirePortalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Portal authentication required' });
  }

  try {
    const decoded = verifyPortalToken(authHeader.split(' ')[1]);
    req.portal = decoded;
    next();
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.message });
  }
}
