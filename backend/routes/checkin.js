import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabase } from '../db/supabase.js';
import { transitionBooking, getBookingDetail } from '../services/bookingService.js';
import { performInspection } from '../services/inspectionService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

const READY_OR_LATER_STATUSES = new Set(['ready_for_pickup', 'active', 'returned', 'completed']);
const CHECKIN_MARK_READY_STATUSES = new Set(['confirmed', ...READY_OR_LATER_STATUSES]);
const CHECKOUT_RECORDABLE_STATUSES = new Set(['active', 'returned', 'completed']);

function requestError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

async function ensureCheckRecord(bookingId, recordType, values) {
  const record = {
    odometer: values.odometer,
    fuel_level: values.fuelLevel,
    condition_notes: values.conditionNotes,
    photo_urls: values.photoUrls || [],
    created_by: values.createdBy,
  };

  const { data: existing, error: lookupError } = await supabase
    .from('checkin_records')
    .select('id')
    .eq('booking_id', bookingId)
    .eq('record_type', recordType)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existing?.id) {
    const { error } = await supabase
      .from('checkin_records')
      .update(record)
      .eq('id', existing.id);
    if (error) throw error;
    return { id: existing.id, updated: true };
  }

  const { data, error } = await supabase
    .from('checkin_records')
    .insert({
      booking_id: bookingId,
      record_type: recordType,
      ...record,
    })
    .select('id')
    .single();
  if (error) throw error;
  return { id: data?.id, updated: false };
}

async function updateBookingConditionFields(bookingId, updates) {
  if (Object.keys(updates).length === 0) return;
  const { error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', bookingId);
  if (error) throw error;
}

/**
 * POST /bookings/:id/checkin — Admin records vehicle check-in AND marks ready (ATOMIC)
 * Body: { odometer, fuelLevel, conditionNotes, photoUrls, markReady? }
 *
 * When markReady is true (default), this saves the check-in record AND
 * transitions the booking to ready_for_pickup in one operation.
 * This replaces the old two-step save + PATCH /ready flow.
 */
router.post('/bookings/:id/checkin', requireAuth, asyncHandler(async (req, res) => {
  const { odometer, fuelLevel, conditionNotes, photoUrls, markReady = true } = req.body;
  const booking = await getBookingDetail(req.params.id);

  if (markReady && !CHECKIN_MARK_READY_STATUSES.has(booking.status)) {
    throw requestError(`Cannot mark ready while booking is '${booking.status}'. Confirm the agreement and payment first.`);
  }

  // 1. Save or refresh the admin prep record. Re-clicks should update the
  // latest prep row rather than creating duplicate handoff records.
  await ensureCheckRecord(req.params.id, 'admin_prep', {
    odometer,
    fuelLevel,
    conditionNotes,
    photoUrls,
    createdBy: req.user?.email || 'admin',
  });

  // 2. Update booking fields
  const bookingUpdates = {};
  if (odometer) {
    bookingUpdates.checkin_odometer = odometer;
    bookingUpdates.pickup_mileage = odometer;
  }
  if (fuelLevel) {
    bookingUpdates.pickup_fuel_level = fuelLevel;
  }
  await updateBookingConditionFields(req.params.id, bookingUpdates);

  // 3. Atomically transition to ready_for_pickup (if requested)
  let transitionResult = null;
  let idempotent = false;
  if (markReady) {
    if (READY_OR_LATER_STATUSES.has(booking.status)) {
      idempotent = true;
      transitionResult = await getBookingDetail(req.params.id);
    } else {
      transitionResult = await transitionBooking(req.params.id, 'ready_for_pickup', {
        changedBy: req.user?.email || 'admin',
        reason: 'Vehicle prepared and marked ready for pickup',
      });
    }
  }

  res.json({
    success: true,
    markedReady: markReady ? true : false,
    idempotent,
    booking: transitionResult || undefined,
  });
}));

/**
 * POST /bookings/:id/checkout — Admin records vehicle check-out / return condition
 * Body: { odometer, fuelLevel, conditionNotes, photoUrls }
 */
router.post('/bookings/:id/checkout', requireAuth, asyncHandler(async (req, res) => {
  const { odometer, fuelLevel, conditionNotes, photoUrls } = req.body;
  const booking = await getBookingDetail(req.params.id);

  if (!CHECKOUT_RECORDABLE_STATUSES.has(booking.status)) {
    throw requestError(`Cannot record checkout while booking is '${booking.status}'. Start the trip before checkout.`);
  }

  if (booking.status === 'completed') {
    return res.json({
      success: true,
      idempotent: true,
      booking,
    });
  }

  // Save or refresh the check-out inspection record.
  await ensureCheckRecord(req.params.id, 'admin_inspection', {
    odometer,
    fuelLevel,
    conditionNotes,
    photoUrls,
    createdBy: req.user?.email || 'admin',
  });

  // Update booking with checkout odometer
  const bookingUpdates = {};
  if (odometer) {
    bookingUpdates.checkout_odometer = odometer;
    bookingUpdates.return_mileage = odometer;
  }
  if (fuelLevel) {
    bookingUpdates.return_fuel_level = fuelLevel;
  }
  await updateBookingConditionFields(req.params.id, bookingUpdates);

  res.json({ success: true, booking: await getBookingDetail(req.params.id) });
}));

/**
 * POST /bookings/:id/inspection — Run post-return inspection + auto-calculate incidentals
 * Body: { checkoutOdometer, fuelLevel, conditionNotes, photoUrls, incidentals? }
 */
router.post('/bookings/:id/inspection', requireAuth, asyncHandler(async (req, res) => {
  const {
    checkoutOdometer,
    fuelLevel,
    conditionNotes,
    photoUrls,
    incidentals,
  } = req.body || {};

  const settlement = await performInspection(req.params.id, {
    checkoutOdometer,
    fuelLevel,
    conditionNotes,
    photoUrls,
    incidentals: incidentals || [],
    inspectedBy: req.user?.email || 'admin',
  });

  res.json(settlement);
}));

/**
 * PATCH /bookings/:id/ready — Backward-compat alias
 * Kept so existing portal/frontend code doesn't break.
 * Prefer using POST /bookings/:id/checkin with markReady=true.
 */
router.patch('/bookings/:id/ready', requireAuth, asyncHandler(async (req, res) => {
  const result = await transitionBooking(req.params.id, 'ready_for_pickup', {
    changedBy: req.user?.email || 'admin',
    reason: 'Vehicle prepared and marked ready for pickup',
  });
  res.json(result);
}));

/**
 * GET /bookings/:id/lockbox — Get lockbox code for a booking
 * Only returns code when status is ready_for_pickup or active
 */
router.get('/bookings/:id/lockbox', requireAuth, asyncHandler(async (req, res) => {
  const booking = await getBookingDetail(req.params.id);

  if (!['ready_for_pickup', 'active'].includes(booking.status)) {
    return res.status(403).json({ error: 'Lockbox code not available for this booking status' });
  }

  const lockboxCode = booking.vehicles?.lockbox_code;
  if (!lockboxCode) {
    return res.status(503).json({ error: 'Lockbox code not configured for this vehicle. Set it in the fleet manager.' });
  }
  res.json({ lockbox_code: lockboxCode });
}));

/**
 * GET /bookings/:id/checkin-records — Get all check-in/check-out records for a booking
 */
router.get('/bookings/:id/checkin-records', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('checkin_records')
    .select('*')
    .eq('booking_id', req.params.id)
    .order('created_at', { ascending: true });

  if (error) throw error;

  // Resolve storage paths in photo_urls and photo_slots to signed URLs.
  // New records store paths (e.g. "booking-123/uuid.jpg"); old ones have full URLs.
  const records = data || [];
  for (const record of records) {
    if (Array.isArray(record.photo_urls)) {
      record.photo_urls = await Promise.all(
        record.photo_urls.map(async (pathOrUrl) => {
          if (pathOrUrl && typeof pathOrUrl === 'string' && !pathOrUrl.startsWith('http')) {
            try {
              const { data: signedData } = await supabase.storage
                .from('checkin-photos')
                .createSignedUrl(pathOrUrl, 60 * 60 * 2); // 2 hours
              return signedData?.signedUrl || pathOrUrl;
            } catch { return pathOrUrl; }
          }
          return pathOrUrl;
        })
      );
    }
    if (record.photo_slots && typeof record.photo_slots === 'object') {
      for (const [key, value] of Object.entries(record.photo_slots)) {
        if (typeof value === 'string' && !value.startsWith('http')) {
          try {
            const { data: signedData } = await supabase.storage
              .from('checkin-photos')
              .createSignedUrl(value, 60 * 60 * 2);
            record.photo_slots[key] = signedData?.signedUrl || value;
          } catch { /* keep raw path */ }
        } else if (Array.isArray(value)) {
          record.photo_slots[key] = await Promise.all(
            value.map(async (v) => {
              if (typeof v === 'string' && !v.startsWith('http')) {
                try {
                  const { data: signedData } = await supabase.storage
                    .from('checkin-photos')
                    .createSignedUrl(v, 60 * 60 * 2);
                  return signedData?.signedUrl || v;
                } catch { return v; }
              }
              return v;
            })
          );
        }
      }
    }
  }

  res.json(records);
}));

export default router;
