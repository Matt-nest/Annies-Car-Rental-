import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { supabase } from '../db/supabase.js';
import {
  loginAccount,
  setAccountPassword,
  getAccountCustomer,
  requireAccountAuth,
} from '../services/customerAccountService.js';
import { getBookingDetail } from '../services/bookingService.js';

const router = Router();

// Brute-force guard on login: 10 attempts / 15 min / IP.
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again later.' },
});

// Avatar upload — in-memory, image-only, 5 MB cap.
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (AVATAR_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(Object.assign(new Error('Only JPEG, PNG, WebP, or HEIC images are accepted'), { status: 400 }));
  },
});

async function ensureBucket(bucketId, isPublic) {
  const { data } = await supabase.storage.getBucket(bucketId);
  if (!data) await supabase.storage.createBucket(bucketId, { public: isPublic });
}

/**
 * POST /account/login — customer portal login.
 * Body: { username, password }
 * Returns: { token, mustChangePassword, customer }
 */
router.post('/login', loginRateLimit, async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const result = await loginAccount(username, password);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /account/set-password — set a new password (first-login reset or change).
 * Requires account JWT. Body: { newPassword }
 */
router.post('/set-password', requireAccountAuth, async (req, res) => {
  try {
    const { newPassword } = req.body || {};
    const result = await setAccountPassword(req.account.accountId, newPassword);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * GET /account/me — the logged-in customer's profile + account flags.
 */
router.get('/me', requireAccountAuth, async (req, res) => {
  try {
    const customer = await getAccountCustomer(req.account.customerId);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json({ username: req.account.username, customer });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * PUT /account/profile — update the customer's own personal details.
 * Whitelisted fields only; the account can never change another customer.
 */
const PROFILE_FIELDS = [
  'avatar_url',
  'address_line1',
  'address_line2',
  'city',
  'state',
  'zip',
  'phone',
];

router.put('/profile', requireAccountAuth, async (req, res) => {
  try {
    const update = {};
    for (const field of PROFILE_FIELDS) {
      if (req.body && Object.prototype.hasOwnProperty.call(req.body, field)) {
        update[field] = req.body[field];
      }
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'No updatable fields provided' });
    }

    const { error } = await supabase
      .from('customers')
      .update(update)
      .eq('id', req.account.customerId);
    if (error) throw error;

    const customer = await getAccountCustomer(req.account.customerId);
    res.json({ success: true, customer });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /account/avatar — upload a profile photo (multipart, field "file").
 * Stored in the public `avatars` bucket under the customer's own folder, then
 * saved to customers.avatar_url. Returns { avatar_url, customer }.
 */
router.post('/avatar', requireAccountAuth, avatarUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded. Field name must be "file".' });

    await ensureBucket('avatars', true);
    const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const filename = `${req.account.customerId}/${crypto.randomUUID()}${ext}`;

    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(filename, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (error) throw Object.assign(new Error('Upload failed: ' + error.message), { status: 500 });

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(data.path);
    const avatar_url = urlData.publicUrl;

    const { error: updErr } = await supabase
      .from('customers')
      .update({ avatar_url })
      .eq('id', req.account.customerId);
    if (updErr) throw updErr;

    const customer = await getAccountCustomer(req.account.customerId);
    res.json({ avatar_url, customer });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ── Wallet (cards on file) ───────────────────────────────────────────────────
/** GET /account/payments-config — Web Payments SDK bootstrap for tokenizing. */
router.get('/payments-config', requireAccountAuth, (_req, res) => {
  res.json({
    provider: process.env.PAYMENT_PROVIDER || 'stripe',
    applicationId: process.env.SQUARE_APPLICATION_ID || '',
    locationId: process.env.SQUARE_LOCATION_ID || '',
    environment: String(process.env.SQUARE_ENVIRONMENT || 'sandbox').toLowerCase(),
  });
});

/** GET /account/cards — list the customer's saved cards. */
router.get('/cards', requireAccountAuth, async (req, res) => {
  try {
    const { listCards } = await import('../services/squarePortalCardsService.js');
    res.json(await listCards(req.account.customerId));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** POST /account/cards — save a card from a Web Payments SDK token. Body: { sourceId }. */
router.post('/cards', requireAccountAuth, async (req, res) => {
  try {
    const { addCard } = await import('../services/squarePortalCardsService.js');
    const card = await addCard(req.account.customerId, req.body?.sourceId);
    res.status(201).json(card);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** DELETE /account/cards/:cardId — remove (disable) a saved card. */
router.delete('/cards/:cardId', requireAccountAuth, async (req, res) => {
  try {
    const { removeCard } = await import('../services/squarePortalCardsService.js');
    res.json(await removeCard(req.account.customerId, req.params.cardId));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** GET /account/plan — the customer's active recurring rental + upcoming charges. */
router.get('/plan', requireAccountAuth, async (req, res) => {
  try {
    const { getRecurringForPortal } = await import('../services/recurringRentalService.js');
    res.json(await getRecurringForPortal(req.account.customerId));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ── Trips ────────────────────────────────────────────────────────────────────
// Booking summary columns safe to return to the customer (no internal_notes).
const TRIP_LIST_COLUMNS =
  'id, booking_code, status, rental_type, pickup_date, return_date, pickup_time, return_time, ' +
  'pickup_location, delivery_type, total_cost, deposit_amount, deposit_status, ' +
  'vehicles(year, make, model, vehicle_code, thumbnail_url)';

/**
 * GET /account/trips — all of the signed-in customer's bookings (summary).
 * The portal categorizes active / upcoming / past client-side.
 */
router.get('/trips', requireAccountAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(TRIP_LIST_COLUMNS)
      .eq('customer_id', req.account.customerId)
      .order('pickup_date', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** GET /account/trips/:id/balance — server-authoritative outstanding balance. */
router.get('/trips/:id/balance', requireAccountAuth, async (req, res) => {
  try {
    const { getTripBalance } = await import('../services/squarePortalCardsService.js');
    res.json(await getTripBalance(req.account.customerId, req.params.id));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /account/trips/:id/pay — pay the trip's invoice balance.
 * Body: { savedCardId } or { sourceId }. Amount is recomputed server-side.
 */
router.post('/trips/:id/pay', requireAccountAuth, async (req, res) => {
  try {
    const { chargeTripBalance } = await import('../services/squarePortalCardsService.js');
    const result = await chargeTripBalance(req.account.customerId, req.params.id, {
      savedCardId: req.body?.savedCardId,
      sourceId: req.body?.sourceId,
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * GET /account/trips/:id — one booking's detail, gated by ownership.
 * Mirrors the legacy /portal/booking response shape (total_price, vehicle,
 * deposit, invoice) plus the lockbox code once the rental is active.
 */
router.get('/trips/:id', requireAccountAuth, async (req, res) => {
  try {
    const booking = await getBookingDetail(req.params.id);
    if (!booking || booking.customer_id !== req.account.customerId) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const { internal_notes, ...safe } = booking;

    const { data: deposit } = await supabase
      .from('booking_deposits')
      .select('amount, status, refund_amount')
      .eq('booking_id', booking.id)
      .maybeSingle();

    const { data: invoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('booking_id', booking.id)
      .maybeSingle();

    const total_price = (safe.subtotal || 0) + (safe.delivery_fee || 0) + (safe.tax_amount || 0);
    const vehicle = safe.vehicles || null;

    // Lockbox is only revealed once the customer is checked in (status active),
    // mirroring the gate in /portal/lockbox.
    const lockbox_code = safe.status === 'active' ? (vehicle?.lockbox_code || null) : null;

    res.json({
      ...safe,
      total_price,
      vehicle,
      deposit: deposit || null,
      invoice: invoice || null,
      lockbox_code,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
