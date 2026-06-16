import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { generateRentalAgreementPdf } from '../utils/pdfGenerator.js';
import { transitionBooking } from '../services/bookingService.js';
import { sendCounterSignNotification } from '../services/emailService.js';
import { createNotification } from '../services/notificationService.js';
import { archiveContract } from '../services/documentService.js';

const router = Router();

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
  const { data: booking, error } = await supabase
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

  // Check if already signed
  const { data: existing } = await supabase
    .from('rental_agreements')
    .select('id, customer_signed_at, owner_signed_at')
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
    autoFilled: {
      customerName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
      phone: customer.phone || '',
      email: customer.email || '',
      dateOut: booking.pickup_date,
      dateDueIn: booking.return_date,
      pickupTime: booking.pickup_time,
      returnTime: booking.return_time,
      pickupLocation: booking.pickup_location || '',
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
      taxAmount: Number(booking.tax_amount || 0),
      totalCost: Number(booking.total_cost),
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
    .select('id, customer_id, deposit_status, status')
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

  // If deposit is already paid, transition to confirmed
  if (booking.deposit_status === 'paid' && booking.status === 'approved') {
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

  res.json({ success: true, agreementId: agreement.id });
}));

// ══════════════════════════════════════════════════════════════════════════════
// POST /agreements/:bookingId/admin-generate
// Admin — generate a rental agreement/contract IN PERSON (no customer link).
//
// Upserts the rental_agreements row from admin-captured data and archives the
// contract PDF to the customer's document folder. Two signature modes:
//   - 'digital': the customer signed on the admin's device now (customer_signature_data
//                supplied) and the admin counter-signs (owner_signature_data) → a
//                fully-executed digital contract.
//   - 'wet':     no digital customer signature — generate the contract to print and
//                wet-sign on paper. The row + archived PDF render blank signature lines.
// ══════════════════════════════════════════════════════════════════════════════
router.post('/:bookingId/admin-generate', requireAuth, asyncHandler(async (req, res) => {
  const {
    address_line1, city, state, zip,
    date_of_birth,
    driver_license_number, driver_license_state, driver_license_expiry,
    insurance_company, insurance_policy_number, insurance_expiry,
    insurance_agent_name, insurance_agent_phone, insurance_vehicle_description,
    customer_signature_data, customer_signature_type,
    owner_signature_data, owner_signature_type,
    signature_mode = customer_signature_data ? 'digital' : 'wet',
    license_photo_paths,
  } = req.body;

  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select('id, customer_id, booking_code')
    .eq('id', req.params.bookingId)
    .single();
  if (bErr || !booking) return res.status(404).json({ error: 'Booking not found' });

  const nowIso = new Date().toISOString();
  const adminEmail = req.user?.email || 'admin';

  // Common fields for both insert + update.
  const fields = {
    address_line1: address_line1 || null,
    city: city || null,
    state: state || null,
    zip: zip || null,
    date_of_birth: date_of_birth || null,
    driver_license_number: driver_license_number || null,
    driver_license_state: driver_license_state || null,
    driver_license_expiry: driver_license_expiry || null,
    insurance_company: insurance_company || null,
    insurance_policy_number: insurance_policy_number || null,
    insurance_expiry: insurance_expiry || null,
    insurance_agent_name: insurance_agent_name || null,
    insurance_agent_phone: insurance_agent_phone || null,
    insurance_vehicle_description: insurance_vehicle_description || null,
    customer_signature_data: customer_signature_data || null,
    customer_signature_type: customer_signature_data ? (customer_signature_type || 'drawn') : null,
    customer_signed_at: customer_signature_data ? nowIso : null,
    owner_signature_data: owner_signature_data || null,
    owner_signature_type: owner_signature_data ? (owner_signature_type || 'drawn') : null,
    owner_signed_at: owner_signature_data ? nowIso : null,
    owner_signed_by: owner_signature_data ? adminEmail : null,
    agreement_source: 'admin_in_person',
    signature_mode,
    created_by: adminEmail,
    license_photo_paths: Array.isArray(license_photo_paths) && license_photo_paths.length ? license_photo_paths : null,
  };

  // Upsert by booking_id (rental_agreements.booking_id is UNIQUE).
  const { data: existing } = await supabase
    .from('rental_agreements')
    .select('id')
    .eq('booking_id', booking.id)
    .maybeSingle();

  let agreement;
  if (existing) {
    const { data, error } = await supabase
      .from('rental_agreements')
      .update(fields)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    agreement = data;
  } else {
    const { data, error } = await supabase
      .from('rental_agreements')
      .insert({ booking_id: booking.id, ...fields })
      .select()
      .single();
    if (error) throw error;
    agreement = data;
  }

  // Mirror captured personal details onto the customer record (same as /sign).
  if (booking.customer_id) {
    const customerUpdate = {};
    if (address_line1) customerUpdate.address_line1 = address_line1;
    if (city) customerUpdate.city = city;
    if (state) customerUpdate.state = state;
    if (zip) customerUpdate.zip = zip;
    if (date_of_birth) customerUpdate.date_of_birth = date_of_birth;
    if (driver_license_number) customerUpdate.driver_license_number = driver_license_number;
    if (driver_license_state) customerUpdate.driver_license_state = driver_license_state;
    if (driver_license_expiry) customerUpdate.driver_license_expiry = driver_license_expiry;
    if (Object.keys(customerUpdate).length) {
      await supabase.from('customers').update(customerUpdate).eq('id', booking.customer_id);
    }
  }

  // Archive the generated contract PDF to the customer's document folder.
  let document = null;
  try {
    document = await archiveContract({
      bookingId: booking.id,
      generatedBy: adminEmail,
      metadata: { signature_mode, source: 'admin_in_person', fully_executed: !!(customer_signature_data && owner_signature_data) },
    });
  } catch (e) {
    console.error('[admin-generate] archive failed:', e.message);
  }

  res.json({ success: true, agreementId: agreement.id, signature_mode, document });
}));

// ══════════════════════════════════════════════════════════════════════════════
// POST /agreements/:bookingId/counter-sign
// Admin — Annie counter-signs the agreement
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

  // Archive the now fully-executed contract to the customer's document folder.
  archiveContract({
    bookingId: req.params.bookingId,
    generatedBy: req.user?.email || 'admin',
    metadata: { fully_executed: true, event: 'counter_sign' },
  }).catch(e => console.error('[counter-sign] archive failed:', e.message));

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

    // Transition booking to confirmed if it's approved (agreement + payment both done, waiting for pickup day)
    // NOTE: Do NOT auto-transition to 'active' — active should only happen when the owner manually records the pickup
    if (booking.status === 'approved') {
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
  // Fetch agreement (may not exist yet — admin can print an unsigned contract to
  // wet-sign in person, which renders blank signature lines).
  const { data: agreement } = await supabase
    .from('rental_agreements')
    .select('*')
    .eq('booking_id', req.params.bookingId)
    .maybeSingle();

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

  // Generate and send PDF (agreement may be null → blank signature lines).
  await generateRentalAgreementPdf(agreement || {}, booking, res);
}));

export default router;
