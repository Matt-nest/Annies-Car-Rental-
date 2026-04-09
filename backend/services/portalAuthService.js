import jwt from 'jsonwebtoken';
import { supabase } from '../db/supabase.js';

const PORTAL_SECRET = process.env.PORTAL_JWT_SECRET;
const TOKEN_EXPIRY = '4h';

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
