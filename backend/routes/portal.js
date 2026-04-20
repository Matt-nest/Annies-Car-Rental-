import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { supabase } from '../db/supabase.js';
import { verifyPortalAccess, requirePortalAuth } from '../services/portalAuthService.js';
import { transitionBooking, getBookingDetail } from '../services/bookingService.js';

const router = Router();

// Rate limit portal verification: 5 attempts per 15 minutes per IP
const portalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many verification attempts. Please try again later.' },
});

/**
 * POST /portal/verify — Authenticate customer for portal access
 * Body: { bookingCode, email }
 */
router.post('/verify', portalRateLimit, async (req, res) => {
  try {
    const { bookingCode, email } = req.body;

    if (!bookingCode || !email) {
      return res.status(400).json({ error: 'bookingCode and email are required' });
    }

    const result = await verifyPortalAccess(bookingCode, email);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * GET /portal/booking — Get the customer's booking details
 * Requires portal JWT in Authorization header
 */
router.get('/booking', requirePortalAuth, async (req, res) => {
  try {
    const booking = await getBookingDetail(req.portal.bookingId);

    // Strip sensitive fields
    const { internal_notes, ...safe } = booking;

    // Include deposit info
    const { data: deposit } = await supabase
      .from('booking_deposits')
      .select('amount, status, refund_amount')
      .eq('booking_id', req.portal.bookingId)
      .maybeSingle();

    // Include add-ons
    const { data: addons } = await supabase
      .from('booking_addons')
      .select('*')
      .eq('booking_id', req.portal.bookingId);

    // Include check-in records
    const { data: checkinRecords } = await supabase
      .from('checkin_records')
      .select('*')
      .eq('booking_id', req.portal.bookingId)
      .order('created_at', { ascending: true });

    // Include invoice (if completed)
    const { data: invoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('booking_id', req.portal.bookingId)
      .maybeSingle();

    // Compute total_price for frontend (subtotal + delivery + tax)
    const total_price = (safe.subtotal || 0) + (safe.delivery_fee || 0) + (safe.tax_amount || 0);

    // Alias 'vehicles' → 'vehicle' for frontend consistency
    const vehicle = safe.vehicles || null;

    res.json({
      ...safe,
      total_price,
      vehicle,
      deposit: deposit || null,
      addons: addons || [],
      checkinRecords: checkinRecords || [],
      invoice: invoice || null,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * GET /portal/lockbox — Get lockbox code (only when ready_for_pickup or active)
 * Requires portal JWT
 */
router.get('/lockbox', requirePortalAuth, async (req, res) => {
  try {
    const booking = await getBookingDetail(req.portal.bookingId);

    if (!['ready_for_pickup', 'active'].includes(booking.status)) {
      return res.status(403).json({ error: 'Lockbox code is not yet available' });
    }

    const lockboxCode = booking.vehicles?.lockbox_code || '2580';
    res.json({ lockbox_code: lockboxCode });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /portal/checkin — Customer self-service check-in
 * Body: {
 *   odometer: number (required),
 *   fuelLevel: string (required — 'full'|'three_quarter'|'half'|'quarter'|'empty'),
 *   photoSlots: { front, driver_side, passenger_side, rear, dashboard?, damage?: string[] } (required 4),
 *   conditionNotes?: string,
 *   conditionConfirmed: boolean (required)
 * }
 * Transitions: ready_for_pickup → active
 */
router.post('/checkin', requirePortalAuth, async (req, res) => {
  try {
    const { odometer, fuelLevel, photoSlots, conditionNotes, conditionConfirmed } = req.body;
    const bookingId = req.portal.bookingId;

    // ── Validation ─────────────────────────────────────────────────
    if (!conditionConfirmed) {
      return res.status(400).json({ error: 'You must confirm the vehicle condition' });
    }

    const VALID_FUEL = ['full', 'three_quarter', 'half', 'quarter', 'empty'];
    if (!fuelLevel || !VALID_FUEL.includes(fuelLevel)) {
      return res.status(400).json({ error: `Fuel level is required. Must be one of: ${VALID_FUEL.join(', ')}` });
    }

    if (!odometer || typeof odometer !== 'number' || odometer < 0) {
      return res.status(400).json({ error: 'Odometer reading is required and must be a positive number' });
    }

    // Require 4 named photo slots
    const REQUIRED_SLOTS = ['front', 'driver_side', 'passenger_side', 'rear'];
    if (!photoSlots || typeof photoSlots !== 'object') {
      return res.status(400).json({ error: 'Photo slots are required (front, driver_side, passenger_side, rear)' });
    }
    const missingSlots = REQUIRED_SLOTS.filter(s => !photoSlots[s]);
    if (missingSlots.length > 0) {
      return res.status(400).json({ error: `Missing required photos: ${missingSlots.join(', ')}` });
    }

    // ── Security: Verify uploaded photo URLs belong to this booking's folder ──
    // @security-auditor — booking-ID-matches-JWT check
    const expectedFolder = `booking-${bookingId}`;
    const allSlotUrls = Object.values(photoSlots).flat().filter(Boolean);
    for (const url of allSlotUrls) {
      if (typeof url === 'string' && !url.includes(expectedFolder)) {
        return res.status(403).json({
          error: 'One or more photo URLs do not belong to this booking. Upload photos through the portal.',
        });
      }
    }

    // Flatten all slot URLs into a flat array for backward-compat photo_urls column
    const flatPhotoUrls = [];
    for (const slot of [...REQUIRED_SLOTS, 'dashboard']) {
      if (photoSlots[slot]) flatPhotoUrls.push(photoSlots[slot]);
    }
    // Damage slot can be an array
    if (Array.isArray(photoSlots.damage)) {
      flatPhotoUrls.push(...photoSlots.damage);
    } else if (photoSlots.damage) {
      flatPhotoUrls.push(photoSlots.damage);
    }

    // ── Save customer check-in record ──────────────────────────────
    await supabase.from('checkin_records').insert({
      booking_id: bookingId,
      record_type: 'customer_checkin',
      odometer,
      fuel_level: fuelLevel,
      condition_notes: conditionNotes || null,
      photo_urls: flatPhotoUrls,
      photo_slots: photoSlots,
      created_by: 'customer',
    });

    // ── Transition to active ───────────────────────────────────────
    const result = await transitionBooking(bookingId, 'active', {
      changedBy: 'customer',
      reason: 'Customer completed self-service check-in',
      extraFields: {
        actual_pickup_at: new Date().toISOString(),
        checkin_odometer: odometer,
      },
    });

    // Update vehicle status to rented
    const booking = await getBookingDetail(bookingId);
    if (booking.vehicle_id) {
      await supabase
        .from('vehicles')
        .update({ status: 'rented' })
        .eq('id', booking.vehicle_id);
    }

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /portal/checkout — Customer self-service check-out
 * Body: { odometer, fuelLevel, photoUrls, parkingPhotoUrl, keyReturned }
 * Transitions: active → returned
 */
router.post('/checkout', requirePortalAuth, async (req, res) => {
  try {
    const { odometer, fuelLevel, photoUrls, parkingPhotoUrl, keyReturned } = req.body;

    if (!keyReturned) {
      return res.status(400).json({ error: 'Please confirm the key has been returned' });
    }

    // Save customer check-out record
    const allPhotos = [...(photoUrls || [])];
    if (parkingPhotoUrl) allPhotos.push(parkingPhotoUrl);

    await supabase.from('checkin_records').insert({
      booking_id: req.portal.bookingId,
      record_type: 'customer_checkout',
      odometer,
      fuel_level: fuelLevel,
      photo_urls: allPhotos,
      created_by: 'customer',
    });

    // Transition to returned (pending inspection)
    const result = await transitionBooking(req.portal.bookingId, 'returned', {
      changedBy: 'customer',
      reason: 'Customer completed self-service check-out',
      extraFields: {
        actual_return_at: new Date().toISOString(),
        checkout_odometer: odometer,
      },
    });

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /portal/dispute — Customer submits a dispute against an invoice
 * Body: { reason, photoUrls }
 */
router.post('/dispute', requirePortalAuth, async (req, res) => {
  try {
    const { reason, photoUrls } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Dispute reason is required' });
    }

    // Find the invoice for this booking
    const { data: invoice } = await supabase
      .from('invoices')
      .select('id')
      .eq('booking_id', req.portal.bookingId)
      .maybeSingle();

    if (!invoice) {
      return res.status(404).json({ error: 'No invoice found for this booking' });
    }

    const { data, error } = await supabase
      .from('customer_disputes')
      .insert({
        invoice_id: invoice.id,
        booking_id: req.portal.bookingId,
        reason: reason.trim(),
        photo_urls: photoUrls || [],
        status: 'open',
      })
      .select()
      .single();

    if (error) throw error;

    // Update invoice status
    await supabase
      .from('invoices')
      .update({ status: 'disputed' })
      .eq('id', invoice.id);

    res.status(201).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
