import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { supabase } from '../db/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import brand from '../config/brand.js';
import { verifyPortalAccess, requirePortalAuth, refreshPortalToken, createAdminPortalPreview } from '../services/portalAuthService.js';
import { transitionBooking, getBookingDetail } from '../services/bookingService.js';
import { getFinalRentalPacket, isFinalRentalPacketAvailable } from '../services/finalRentalPacketService.js';
import { generateFinalRentalPacketPdf } from '../utils/finalRentalPacketPdfGenerator.js';

const router = Router();
const REQUIRED_CONDITION_SLOTS = ['front', 'driver_side', 'passenger_side', 'rear'];
const CONDITION_PHOTO_SLOT_ORDER = [...REQUIRED_CONDITION_SLOTS, 'dashboard', 'interior_front', 'interior_rear', 'damage'];
const MAX_CONDITION_PHOTOS = 8;

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
 * POST /portal/refresh — Issue a fresh portal token from a valid session.
 * Keeps long-lived (long-term rental) sessions alive without re-verifying.
 */
router.post('/refresh', requirePortalAuth, async (req, res) => {
  try {
    const result = await refreshPortalToken(req.portal);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /portal/admin-preview — owner/admin portal preview link.
 * Body: { bookingId? customerId? }
 */
router.post('/admin-preview', requireAuth, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const result = await createAdminPortalPreview({
      bookingId: req.body?.bookingId,
      customerId: req.body?.customerId,
      actor: req.user,
    });
    const params = new URLSearchParams({
      code: result.booking.bookingCode,
      preview_token: result.token,
      admin_preview: '1',
    });
    res.json({
      ...result,
      url: `${brand.siteUrl}/portal?${params.toString()}`,
      expiresIn: process.env.PORTAL_ADMIN_PREVIEW_JWT_TTL || '15m',
    });
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

    // Include check-in records — resolve storage paths to signed URLs
    const { data: checkinRecords } = await supabase
      .from('checkin_records')
      .select('*')
      .eq('booking_id', req.portal.bookingId)
      .order('created_at', { ascending: true });

    // Server-side: resolve storage paths in photo_urls and photo_slots
    // so the portal client can display them without needing signed-url access.
    if (checkinRecords) {
      for (const record of checkinRecords) {
        if (Array.isArray(record.photo_urls)) {
          record.photo_urls = await Promise.all(
            record.photo_urls.map(async (pathOrUrl) => {
              if (pathOrUrl && typeof pathOrUrl === 'string' && !pathOrUrl.startsWith('http')) {
                try {
                  const { data } = await supabase.storage
                    .from('checkin-photos')
                    .createSignedUrl(pathOrUrl, 60 * 60 * 2); // 2 hours
                  return data?.signedUrl || pathOrUrl;
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
                const { data } = await supabase.storage
                  .from('checkin-photos')
                  .createSignedUrl(value, 60 * 60 * 2);
                record.photo_slots[key] = data?.signedUrl || value;
              } catch { /* keep raw path */ }
            } else if (Array.isArray(value)) {
              record.photo_slots[key] = await Promise.all(
                value.map(async (v) => {
                  if (typeof v === 'string' && !v.startsWith('http')) {
                    try {
                      const { data } = await supabase.storage
                        .from('checkin-photos')
                        .createSignedUrl(v, 60 * 60 * 2);
                      return data?.signedUrl || v;
                    } catch { return v; }
                  }
                  return v;
                })
              );
            }
          }
        }
      }
    }

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

    let finalPacket = null;
    if (['returned', 'completed'].includes(String(safe.status || '').toLowerCase())) {
      finalPacket = await getFinalRentalPacket(req.portal.bookingId);
    }

    res.json({
      ...safe,
      total_price,
      vehicle,
      deposit: deposit || null,
      addons: addons || [],
      checkinRecords: checkinRecords || [],
      invoice: invoice || null,
      finalPacket,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/final-packet', requirePortalAuth, async (req, res) => {
  try {
    const packet = await getFinalRentalPacket(req.portal.bookingId);
    if (!isFinalRentalPacketAvailable(packet.booking)) {
      return res.status(409).json({ error: 'Final rental packet is available after return.' });
    }
    res.json(packet);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/final-packet/pdf', requirePortalAuth, async (req, res) => {
  try {
    const packet = await getFinalRentalPacket(req.portal.bookingId, { includeAgreementSource: true });
    if (!isFinalRentalPacketAvailable(packet.booking)) {
      return res.status(409).json({ error: 'Final rental packet is available after return.' });
    }
    const code = packet.booking?.booking_code || packet.booking?.id || 'booking';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Final_Rental_Packet_${code}.pdf"`);
    await generateFinalRentalPacketPdf({ packet, stream: res });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * GET /portal/lockbox — Get lockbox code (only AFTER check-in completes)
 * The lockbox is gated behind check-in: the customer must submit photos,
 * odometer, fuel level, and condition confirmation before getting the code.
 * Requires portal JWT
 */
router.get('/lockbox', requirePortalAuth, async (req, res) => {
  try {
    const booking = await getBookingDetail(req.portal.bookingId);

    // Only reveal lockbox AFTER check-in (status = active)
    // ready_for_pickup means they haven't completed check-in yet
    if (booking.status !== 'active') {
      return res.status(403).json({ error: 'Complete your vehicle check-in to receive the lockbox code' });
    }

    const lockboxCode = booking.vehicles?.lockbox_code;
    if (!lockboxCode) {
      return res.status(503).json({ error: 'Lockbox code not configured for this vehicle. Please contact Annie\'s at (772) 207-1655.' });
    }
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
    if (!photoSlots || typeof photoSlots !== 'object') {
      return res.status(400).json({ error: 'Photo slots are required (front, driver_side, passenger_side, rear)' });
    }
    const missingSlots = REQUIRED_CONDITION_SLOTS.filter(s => !photoSlots[s]);
    if (missingSlots.length > 0) {
      return res.status(400).json({ error: `Missing required photos: ${missingSlots.join(', ')}` });
    }

    // ── Security: Verify uploaded photo paths belong to this booking's folder ──
    // Paths are now storage paths like "booking-123/uuid.jpg" (no http prefix)
    // or legacy signed URLs containing the booking folder in the path.
    // @security-auditor — booking-ID-matches-JWT check
    const expectedFolder = `booking-${bookingId}`;
    const allSlotValues = Object.values(photoSlots).flat().filter(Boolean);
    if (allSlotValues.length > MAX_CONDITION_PHOTOS) {
      return res.status(400).json({ error: `Maximum ${MAX_CONDITION_PHOTOS} vehicle photos allowed` });
    }
    for (const pathOrUrl of allSlotValues) {
      if (typeof pathOrUrl === 'string' && !pathOrUrl.includes(expectedFolder)) {
        return res.status(403).json({
          error: 'One or more photo paths do not belong to this booking. Upload photos through the portal.',
        });
      }
    }

    const flatPhotoUrls = CONDITION_PHOTO_SLOT_ORDER.flatMap((slot) => {
      const value = photoSlots[slot];
      return Array.isArray(value) ? value : (value ? [value] : []);
    }).slice(0, MAX_CONDITION_PHOTOS);

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

    // ── Snapshot Bouncie's cached odometer if we have one ─────────
    // Best-effort; failures here must never block check-in.
    const extraFields = {
      actual_pickup_at: new Date().toISOString(),
      checkin_odometer: odometer,
    };
    try {
      const { data: bookingForVehicle } = await supabase
        .from('bookings')
        .select('vehicle_id')
        .eq('id', bookingId)
        .single();
      if (bookingForVehicle?.vehicle_id) {
        const { data: bv } = await supabase
          .from('bouncie_vehicles')
          .select('last_odometer_miles, last_synced_at')
          .eq('annie_vehicle_id', bookingForVehicle.vehicle_id)
          .maybeSingle();
        if (bv?.last_odometer_miles != null) {
          extraFields.bouncie_pickup_odometer = bv.last_odometer_miles;
          extraFields.bouncie_pickup_at = bv.last_synced_at;
        }
      }
    } catch (e) {
      console.warn('[Bouncie] pickup odometer snapshot failed:', e.message);
    }

    // ── Transition to active ───────────────────────────────────────
    const result = await transitionBooking(bookingId, 'active', {
      changedBy: 'customer',
      reason: 'Customer completed self-service check-in',
      extraFields,
    });

    // Update vehicle status to rented
    const booking = await getBookingDetail(bookingId);
    if (booking.vehicle_id) {
      await supabase
        .from('vehicles')
        .update({ status: 'rented' })
        .eq('id', booking.vehicle_id);
    }

    // Return lockbox code on successful check-in — this is the gate
    const lockboxCode = booking.vehicles?.lockbox_code;
    console.log(`[Portal] Check-in lockbox for booking ${bookingId}: vehicle=${booking.vehicle_id}, lockbox_code=${lockboxCode || 'NOT SET'}`);
    if (!lockboxCode) {
      // Check-in succeeded but lockbox not configured — don't block, but flag it
      return res.json({ success: true, lockbox_code: null, lockbox_error: 'Lockbox code not configured. Call (772) 207-1655.', ...result });
    }

    res.json({ success: true, lockbox_code: lockboxCode, ...result });
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
    const { odometer, fuelLevel, photoSlots, conditionNotes, keyReturned } = req.body;
    const bookingId = req.portal.bookingId;

    // ── Validation — mirrors /portal/checkin ──────────────────────
    if (!keyReturned) {
      return res.status(400).json({ error: 'Please confirm the key has been returned' });
    }

    const VALID_FUEL = ['full', 'three_quarter', 'half', 'quarter', 'empty'];
    if (!fuelLevel || !VALID_FUEL.includes(fuelLevel)) {
      return res.status(400).json({ error: `Fuel level is required. Must be one of: ${VALID_FUEL.join(', ')}` });
    }

    if (!odometer || typeof odometer !== 'number' || odometer < 0) {
      return res.status(400).json({ error: 'Odometer reading is required and must be a positive number' });
    }

    if (!photoSlots || typeof photoSlots !== 'object') {
      return res.status(400).json({ error: 'Photo slots are required (front, driver_side, passenger_side, rear)' });
    }
    const missingSlots = REQUIRED_CONDITION_SLOTS.filter(s => !photoSlots[s]);
    if (missingSlots.length > 0) {
      return res.status(400).json({ error: `Missing required return photos: ${missingSlots.join(', ')}` });
    }

    // ── Security: Verify uploaded photo paths belong to this booking's folder ──
    const expectedFolder = `booking-${bookingId}`;
    const allSlotValues = Object.values(photoSlots).flat().filter(Boolean);
    if (allSlotValues.length > MAX_CONDITION_PHOTOS) {
      return res.status(400).json({ error: `Maximum ${MAX_CONDITION_PHOTOS} return photos allowed` });
    }
    for (const pathOrUrl of allSlotValues) {
      if (typeof pathOrUrl === 'string' && !pathOrUrl.includes(expectedFolder)) {
        return res.status(403).json({
          error: 'One or more photo paths do not belong to this booking. Upload photos through the portal.',
        });
      }
    }

    const flatPhotoUrls = CONDITION_PHOTO_SLOT_ORDER.flatMap((slot) => {
      const value = photoSlots[slot];
      return Array.isArray(value) ? value : (value ? [value] : []);
    }).slice(0, MAX_CONDITION_PHOTOS);

    await supabase.from('checkin_records').insert({
      booking_id: bookingId,
      record_type: 'customer_checkout',
      odometer,
      fuel_level: fuelLevel,
      condition_notes: conditionNotes || null,
      photo_urls: flatPhotoUrls,
      photo_slots: photoSlots,
      created_by: 'customer',
    });

    // Snapshot Bouncie's cached odometer (best-effort; never block)
    const checkoutExtras = {
      actual_return_at: new Date().toISOString(),
      checkout_odometer: odometer,
    };
    try {
      const { data: bookingForVehicle } = await supabase
        .from('bookings')
        .select('vehicle_id')
        .eq('id', req.portal.bookingId)
        .single();
      if (bookingForVehicle?.vehicle_id) {
        const { data: bv } = await supabase
          .from('bouncie_vehicles')
          .select('last_odometer_miles, last_synced_at')
          .eq('annie_vehicle_id', bookingForVehicle.vehicle_id)
          .maybeSingle();
        if (bv?.last_odometer_miles != null) {
          checkoutExtras.bouncie_return_odometer = bv.last_odometer_miles;
          checkoutExtras.bouncie_return_at = bv.last_synced_at;
        }
      }
    } catch (e) {
      console.warn('[Bouncie] return odometer snapshot failed:', e.message);
    }

    // Transition to returned (pending inspection)
    const result = await transitionBooking(req.portal.bookingId, 'returned', {
      changedBy: 'customer',
      reason: 'Customer completed self-service check-out',
      extraFields: checkoutExtras,
    });

    // Reset vehicle status back to available — mirrors admin return flow.
    // Targeted lookup; getBookingDetail does a heavy join we don't need here.
    const { data: bookingRow } = await supabase
      .from('bookings')
      .select('vehicle_id')
      .eq('id', req.portal.bookingId)
      .single();
    if (bookingRow?.vehicle_id) {
      await supabase
        .from('vehicles')
        .update({ status: 'available' })
        .eq('id', bookingRow.vehicle_id);
    }

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

/**
 * GET /portal/pending-charges — List scheduled overage charges for the
 * customer's booking (used by the dispute UI in the customer portal).
 * Returns [] if FEATURE_AUTO_OVERAGE_CHARGES is off.
 */
router.get('/pending-charges', requirePortalAuth, async (req, res) => {
  try {
    const { listCustomerVisibleCharges } = await import('../services/cardOnFileService.js');
    const charges = await listCustomerVisibleCharges(req.portal.bookingId);
    res.json(charges);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /portal/pending-charges/:id/dispute — Customer disputes a scheduled
 * overage charge during the 48h window. Flips status pending → disputed; the
 * cron worker skips disputed charges, leaving them for admin review.
 */
router.post('/pending-charges/:id/dispute', requirePortalAuth, async (req, res) => {
  try {
    const { disputePendingCharge } = await import('../services/cardOnFileService.js');
    // Verify the charge belongs to this customer's booking before mutating.
    const { data: charge } = await supabase
      .from('pending_overage_charges')
      .select('id, booking_id')
      .eq('id', req.params.id)
      .single();
    if (!charge || charge.booking_id !== req.portal.bookingId) {
      return res.status(404).json({ error: 'Charge not found for this booking' });
    }
    const result = await disputePendingCharge(req.params.id, req.body?.message || '');
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/* ── Rental Extensions (Square) ─────────────────────────────────────────── */

/**
 * POST /portal/extension/quote — Price an extension to a new return date.
 * Body: { newReturnDate: 'YYYY-MM-DD' }
 * Returns a quote (no charge, no DB write).
 */
router.post('/extension/quote', requirePortalAuth, async (req, res) => {
  try {
    const { quoteExtension } = await import('../services/extensionService.js');
    const quote = await quoteExtension(req.portal.bookingId, req.body?.newReturnDate);
    const { _booking, ...safe } = quote;
    res.json(safe);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, conflicts: err.conflicts });
  }
});

/**
 * POST /portal/extension/pay-square — Pay and apply a rental extension via Square.
 * Body: { newReturnDate, source_id, expectedTotalCents, idempotency_key }
 */
router.post('/extension/pay-square', requirePortalAuth, async (req, res) => {
  try {
    const { createExtensionSquarePayment } = await import('../services/extensionService.js');
    const result = await createExtensionSquarePayment(
      req.portal.bookingId,
      req.body?.newReturnDate,
      {
        source_id: req.body?.source_id,
        expectedTotalCents: req.body?.expectedTotalCents,
        idempotencyKey: req.body?.idempotency_key,
      }
    );
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, conflicts: err.conflicts });
  }
});

/**
 * GET /portal/extensions — List this booking's extension history.
 */
router.get('/extensions', requirePortalAuth, async (req, res) => {
  try {
    const { listExtensions } = await import('../services/extensionService.js');
    const rows = await listExtensions(req.portal.bookingId);
    res.json(rows);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/* ── Payment Method on File (Square) ───────────────────────────────────── */

/** GET /portal/payment-method — the card currently on file (or null). */
router.get('/payment-method', requirePortalAuth, async (req, res) => {
  try {
    const { getCardOnFile } = await import('../services/cardOnFileService.js');
    const card = await getCardOnFile(req.portal.bookingId);
    res.json({ card });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** POST /portal/payment-method/save — save a Square card token nonce as the card on file. */
router.post('/payment-method/save', requirePortalAuth, async (req, res) => {
  try {
    const { source_id } = req.body || {};
    if (!source_id) return res.status(400).json({ error: 'source_id is required' });
    const { saveCardOnFile } = await import('../services/cardOnFileService.js');
    const card = await saveCardOnFile(req.portal.bookingId, source_id);
    res.json({ card });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/* ── Payment Plan / Installments ────────────────────────────────────────── */

/** GET /portal/payment-plan — the customer's installment schedule (read-only). */
router.get('/payment-plan', requirePortalAuth, async (req, res) => {
  try {
    const { getPlan } = await import('../services/installmentService.js');
    const plan = await getPlan(req.portal.bookingId);
    res.json(plan);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/* ── Balance / Pay Now (Square) ─────────────────────────────────────────── */

/** GET /portal/balance — outstanding rental balance. */
router.get('/balance', requirePortalAuth, async (req, res) => {
  try {
    const { computeBalance } = await import('../services/balanceService.js');
    const balance = await computeBalance(req.portal.bookingId);
    res.json(balance);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** POST /portal/balance/pay-square — pay the outstanding balance via Square. */
router.post('/balance/pay-square', requirePortalAuth, async (req, res) => {
  try {
    const { createSquareBalancePayment } = await import('../services/balanceService.js');
    const result = await createSquareBalancePayment(req.portal.bookingId, {
      source_id: req.body?.source_id,
      expectedCents: req.body?.expectedCents,
      idempotencyKey: req.body?.idempotency_key,
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
