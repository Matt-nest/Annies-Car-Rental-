import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { generateRentalAgreementPdf } from '../utils/pdfGenerator.js';
import { transitionBooking } from '../services/bookingService.js';
import { ensureBookingPricingSynced } from '../services/bookingPricingSyncService.js';
import { sendCounterSignNotification } from '../services/emailService.js';
import { createNotification } from '../services/notificationService.js';
import { sendTeamAlertAsync, TEAM_ALERT_EVENTS } from '../services/teamAlertService.js';

const router = Router();

async function hasCompletedRentalPayment(bookingId) {
  const { data } = await supabase
    .from('payments')
    .select('id')
    .eq('booking_id', bookingId)
    .eq('payment_type', 'rental')
    .in('status', ['completed', 'paid', 'succeeded'])
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

// ══════════════════════════════════════════════════════════════════════════════
// GET /agreements/pending-counter-sign   (MUST be BEFORE /:bookingCode wildcard)
// Admin — lists agreements where customer signed but owner hasn't counter-signed
// ══════════════════════════════════════════════════════════════════════════════
router.get('/pending-counter-sign', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('rental_agreements')
    .select(`
      id, booking_id, customer_signed_at, owner_signed_at,
      bookings!inner (
        booking_code, pickup_date, return_date, status,
        customers ( first_name, last_name, email, phone ),
        vehicles ( year, make, model, vehicle_code )
      )
    `)
    .not('customer_signed_at', 'is', null)
    .is('owner_signed_at', null)
    .order('customer_signed_at', { ascending: false });

  if (error) throw error;

  const formatted = (data || []).map(ag => ({
    id: ag.id,
    booking_id: ag.booking_id,
    booking_code: ag.bookings?.booking_code,
    customer_signed_at: ag.customer_signed_at,
    pickup_date: ag.bookings?.pickup_date,
    return_date: ag.bookings?.return_date,
    booking_status: ag.bookings?.status,
    customer: ag.bookings?.customers,
    vehicle: ag.bookings?.vehicles,
  }));

  res.json(formatted);
}));

// ══════════════════════════════════════════════════════════════════════════════
// GET /agreements/:bookingCode
// Public — fetches agreement data for a booking (auto-filled fields + status)
// ══════════════════════════════════════════════════════════════════════════════
router.get('/:bookingCode', asyncHandler(async (req, res) => {
  let { data: booking, error } = await supabase
    .from('bookings')
    .select(`
      *,
      customers (*),
      vehicles (*)
    `)
    .eq('booking_code', req.params.bookingCode)
    .single();

  if (error || !booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  booking = await ensureBookingPricingSynced(booking);

  // Check if already signed
  const { data: existing } = await supabase
    .from('rental_agreements')
    .select(`
      id, customer_signed_at, owner_signed_at,
      address_line1, city, state, zip, date_of_birth,
      driver_license_number, driver_license_state, driver_license_expiry,
      insurance_company, insurance_policy_number, insurance_expiry,
      insurance_agent_name, insurance_agent_phone, insurance_vehicle_description,
      license_photo_paths, license_scan_metadata
    `)
    .eq('booking_id', booking.id)
    .maybeSingle();

  const customer = booking.customers || {};
  const vehicle = booking.vehicles || {};

  // Admin-entered pre-fill (from POST /bookings/admin-create). Overlays the
  // customer record for these defaults and drives which steps the customer link
  // can skip. Null/absent for customer-originated bookings → behaves as before.
  const prefill = booking.admin_prefill || null;
  const prefillAddr = prefill?.address || {};
  const prefillLic = prefill?.license || {};

  res.json({
    alreadySigned: !!existing?.customer_signed_at,
    ownerCounterSigned: !!existing?.owner_signed_at,
    bookingId: booking.id,
    savedAgreement: existing?.customer_signed_at ? {
      address_line1: existing.address_line1 || '',
      city: existing.city || '',
      state: existing.state || '',
      zip: existing.zip || '',
      date_of_birth: existing.date_of_birth || '',
      driver_license_number: existing.driver_license_number || '',
      driver_license_state: existing.driver_license_state || '',
      driver_license_expiry: existing.driver_license_expiry || '',
      insurance_company: existing.insurance_company || '',
      insurance_policy_number: existing.insurance_policy_number || '',
      insurance_expiry: existing.insurance_expiry || '',
      insurance_agent_name: existing.insurance_agent_name || '',
      insurance_agent_phone: existing.insurance_agent_phone || '',
      insurance_vehicle_description: existing.insurance_vehicle_description || '',
      license_photo_paths: Array.isArray(existing.license_photo_paths) ? existing.license_photo_paths : [],
      license_scan_metadata: existing.license_scan_metadata || null,
    } : null,
    autoFilled: {
      customerName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
      phone: customer.phone || '',
      email: customer.email || '',
      dateOut: booking.pickup_date,
      dateDueIn: booking.return_date,
      pickupTime: booking.pickup_time,
      returnTime: booking.return_time,
      pickupLocation: booking.pickup_location || '',
      deliveryType: booking.delivery_type || 'pickup',
      deliveryAddress: booking.delivery_address || '',
      // Resolve the image from the VIN (mirrors the catalog in routes/vehicles.js)
      // so a vehicle added data-only — no thumbnail_url set — still shows its photo.
      vehicleImage: vehicle.vin ? `/fleet/${vehicle.vin}/hero.png` : (vehicle.thumbnail_url || ''),
      vehicle: vehicle.year && vehicle.make ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : '',
      vin: vehicle.vin || '',
      licensePlate: vehicle.license_plate || '',
      vehicleState: vehicle.state || 'FL',
      color: vehicle.color || '',
      dailyRate: Number(booking.daily_rate),
      weeklyDiscountPercent: vehicle.weekly_discount_percent ?? 15,
      weeklyRate: vehicle.daily_rate && vehicle.weekly_discount_percent != null
        ? parseFloat(((Number(vehicle.daily_rate) * 7) * (1 - (vehicle.weekly_discount_percent / 100))).toFixed(2))
        : null,
      rateType: booking.rate_type || 'daily',
      mileageAllowance: booking.mileage_allowance || null,
      lineItems: booking.line_items || null,
      milesPerDay: vehicle.mileage_limit_per_day || 150,
      rentalDays: booking.rental_days,
      subtotal: Number(booking.subtotal),
      deliveryFee: Number(booking.delivery_fee || 0),
      discountAmount: Number(booking.discount_amount || 0),
      mileageAddonFee: Number(booking.mileage_addon_fee || 0),
      tollAddonFee: Number(booking.toll_addon_fee || 0),
      taxAmount: Number(booking.tax_amount || 0),
      totalCost: Number(booking.total_cost),
      depositAmount: Number(booking.deposit_amount || 0),
      hasUnlimitedMiles: !!booking.unlimited_miles || booking.mileage_allowance === 'unlimited',
      hasUnlimitedTolls: !!booking.unlimited_tolls,
    },
    // Pre-fill from admin pre-fill first (booking-scoped, authoritative for this
    // booking), then fall back to the customer record's stored data.
    customerDefaults: {
      address_line1: prefillAddr.line1 || customer.address_line1 || '',
      city: prefillAddr.city || customer.city || '',
      state: prefillAddr.state || customer.state || '',
      zip: prefillAddr.zip || customer.zip || '',
      date_of_birth: prefill?.dob || customer.date_of_birth || '',
      driver_license_number: prefillLic.number || customer.driver_license_number || '',
      driver_license_state: prefillLic.state || customer.driver_license_state || '',
      driver_license_expiry: prefillLic.expiry || customer.driver_license_expiry || '',
    },
    // Steps the admin already completed — the customer wizard skips these.
    // Empty array when there's no admin pre-fill (normal customer booking).
    prefilledSteps: Array.isArray(prefill?.steps) ? prefill.steps : [],
    // Admin-captured signature (in-person bookings) and ID photo paths, if any.
    prefilledSignature: prefill?.signature || null,
    prefilledLicensePhotos: Array.isArray(prefill?.license_photo_paths) ? prefill.license_photo_paths : null,
  });
}));

// ══════════════════════════════════════════════════════════════════════════════
// POST /agreements/:bookingCode/sign
// Public — customer submits their signed rental agreement
// ══════════════════════════════════════════════════════════════════════════════
router.post('/:bookingCode/sign', asyncHandler(async (req, res) => {
  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select('id, customer_id, status')
    .eq('booking_code', req.params.bookingCode)
    .single();

  if (bErr || !booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  // Check if already signed
  const { data: existing } = await supabase
    .from('rental_agreements')
    .select('id')
    .eq('booking_id', booking.id)
    .maybeSingle();

  if (existing) {
    return res.json({ success: true, alreadySigned: true });
  }

  const {
    address_line1, city, state, zip,
    date_of_birth,
    driver_license_number, driver_license_state, driver_license_expiry,
    insurance_company, insurance_policy_number, insurance_expiry,
    insurance_agent_name, insurance_agent_phone, insurance_vehicle_description,
    signature_data, signature_type,
    license_photo_paths,
    license_scan_metadata,
  } = req.body;

  // Validate required fields
  if (!signature_data) {
    return res.status(400).json({ error: 'Signature is required' });
  }
  if (!driver_license_number || !driver_license_state || !driver_license_expiry) {
    return res.status(400).json({ error: 'Driver\'s license information is required' });
  }
  if (!address_line1 || !city || !state || !zip) {
    return res.status(400).json({ error: 'Address is required' });
  }
  if (!date_of_birth) {
    return res.status(400).json({ error: 'Date of birth is required' });
  }

  // Get signer IP
  const signerIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || '';

  // Insert the rental agreement
  const { data: agreement, error: aErr } = await supabase
    .from('rental_agreements')
    .insert({
      booking_id: booking.id,
      address_line1, city, state, zip,
      date_of_birth,
      driver_license_number, driver_license_state, driver_license_expiry,
      insurance_company: insurance_company || null,
      insurance_policy_number: insurance_policy_number || null,
      insurance_expiry: insurance_expiry || null,
      insurance_agent_name: insurance_agent_name || null,
      insurance_agent_phone: insurance_agent_phone || null,
      insurance_vehicle_description: insurance_vehicle_description || null,
      customer_signature_data: signature_data,
      customer_signature_type: signature_type || 'drawn',
      customer_signed_at: new Date().toISOString(),
      customer_ip: signerIp,
      license_photo_paths: Array.isArray(license_photo_paths) && license_photo_paths.length
        ? license_photo_paths
        : null,
      license_scan_metadata: license_scan_metadata && typeof license_scan_metadata === 'object'
        ? license_scan_metadata
        : null,
    })
    .select()
    .single();

  if (aErr) throw aErr;

  // Also update the customer record with address and DL info
  const customerUpdate = {
    address_line1, city, state, zip,
    date_of_birth,
    driver_license_number, driver_license_state, driver_license_expiry,
  };

  await supabase
    .from('customers')
    .update(customerUpdate)
    .eq('id', booking.customer_id);

  // If rental payment is already recorded, transition to confirmed. A security
  // deposit by itself is not rental payment.
  if (booking.status === 'approved' && await hasCompletedRentalPayment(booking.id)) {
    await transitionBooking(booking.id, 'confirmed', {
      changedBy: 'system',
      reason: 'Agreement signed and payment already completed'
    }).catch(e => console.error('[Auto-Confirm Error]', e));
  }

  // Notify the owner that counter-signature is needed
  const { data: customer } = await supabase
    .from('customers')
    .select('first_name, last_name, email, phone')
    .eq('id', booking.customer_id)
    .single();

  const { data: fullBooking } = await supabase
    .from('bookings')
    .select('*, vehicles(year, make, model)')
    .eq('id', booking.id)
    .single();

  const vehicleLabel = fullBooking?.vehicles
    ? `${fullBooking.vehicles.year} ${fullBooking.vehicles.make} ${fullBooking.vehicles.model}` : null;

  // Email notification to owner (fire-and-forget)
  sendCounterSignNotification({
    booking: fullBooking || booking,
    customer: customer || { first_name: 'Customer', last_name: '' },
    vehicle: vehicleLabel,
  }).catch(e => console.error('[Email] Counter-sign notification failed:', e));

  // Dashboard notification
  createNotification(
    'agreement_pending',
    `Agreement signed — counter-sign needed`,
    `${customer?.first_name || 'Customer'} ${customer?.last_name || ''} signed for ${fullBooking?.booking_code || ''}`,
    `/bookings/${booking.id}`,
    { booking_id: booking.id }
  ).catch(() => {});

  sendTeamAlertAsync(TEAM_ALERT_EVENTS.AGREEMENT_PENDING, {
    booking: { ...fullBooking, customers: customer },
  });

  res.json({ success: true, agreementId: agreement.id });
}));

// ══════════════════════════════════════════════════════════════════════════════
// POST /agreements/:bookingId/counter-sign
// Admin — owner counter-signs the agreement
// ══════════════════════════════════════════════════════════════════════════════
router.post('/:bookingId/counter-sign', requireAuth, asyncHandler(async (req, res) => {
  const { signature_data, signature_type } = req.body;

  if (!signature_data) {
    return res.status(400).json({ error: 'Signature is required' });
  }

  const { data, error } = await supabase
    .from('rental_agreements')
    .update({
      owner_signature_data: signature_data,
      owner_signature_type: signature_type || 'drawn',
      owner_signed_at: new Date().toISOString(),
      owner_signed_by: req.user?.email || 'admin',
    })
    .eq('booking_id', req.params.bookingId)
    .select()
    .single();

  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Agreement not found' });

  // Create notification for counter-sign
  const { createNotification } = await import('../services/notificationService.js');

  // Get booking info for notification
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, booking_code, status, vehicle_id, customers(first_name, last_name)')
    .eq('id', req.params.bookingId)
    .single();

  if (booking) {
    const cName = `${booking.customers?.first_name || ''} ${booking.customers?.last_name || ''}`.trim();
    createNotification(
      'agreement_pending',
      `Agreement fully executed: ${booking.booking_code}`,
      cName ? `${cName}'s rental agreement has been counter-signed` : undefined,
      `/bookings/${booking.id}`,
      { booking_id: booking.id }
    ).catch(() => {});

    // Transition booking to confirmed only if payment is complete. Agreement
    // counter-signing alone must not advance an unpaid booking.
    // NOTE: Do NOT auto-transition to 'active' — active should only happen when the owner manually records the pickup
    if (booking.status === 'approved' && await hasCompletedRentalPayment(booking.id)) {
      try {
        await transitionBooking(booking.id, 'confirmed', {
          changedBy: req.user?.email || 'admin',
          reason: 'Rental agreement counter-signed — booking confirmed, awaiting pickup',
        });
      } catch (e) {
        console.error('[Counter-Sign] Auto-confirm failed:', e.message);
      }
    }
  }

  res.json({ success: true });
}));

// ══════════════════════════════════════════════════════════════════════════════
// GET /agreements/:bookingId/detail
// Admin — get full agreement data for dashboard
// ══════════════════════════════════════════════════════════════════════════════
router.get('/:bookingId/detail', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('rental_agreements')
    .select('*')
    .eq('booking_id', req.params.bookingId)
    .maybeSingle();

  if (error) throw error;
  res.json(data || { signed: false });
}));

// ══════════════════════════════════════════════════════════════════════════════
// GET /agreements/:bookingId/pdf
// Admin — downloads the signed PDF agreement
// ══════════════════════════════════════════════════════════════════════════════
router.get('/:bookingId/pdf', requireAuth, asyncHandler(async (req, res) => {
  // Fetch agreement
  const { data: agreement, error: aErr } = await supabase
    .from('rental_agreements')
    .select('*')
    .eq('booking_id', req.params.bookingId)
    .single();

  if (aErr || !agreement) {
    return res.status(404).json({ error: 'Agreement not found or not signed' });
  }

  // Fetch booking details
  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select(`
      *,
      customers (*),
      vehicles (*)
    `)
    .eq('id', req.params.bookingId)
    .single();

  if (bErr || !booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  // Set response headers for PDF download
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Rental_Agreement_${booking.booking_code}.pdf"`);

  // Generate and send PDF
  await generateRentalAgreementPdf(agreement, booking, res);
}));

export default router;
