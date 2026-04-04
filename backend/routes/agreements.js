import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { generateRentalAgreementPdf } from '../utils/pdfGenerator.js';
import { transitionBooking } from '../services/bookingService.js';

const router = Router();

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
      weeklyRate: vehicle.weekly_rate ? Number(vehicle.weekly_rate) : null,
      milesPerDay: vehicle.mileage_limit_per_day || 150,
      rentalDays: booking.rental_days,
      subtotal: Number(booking.subtotal),
      deliveryFee: Number(booking.delivery_fee || 0),
      discountAmount: Number(booking.discount_amount || 0),
      taxAmount: Number(booking.tax_amount || 0),
      totalCost: Number(booking.total_cost),
    },
    // Pre-fill from customer record if they have previous data
    customerDefaults: {
      address_line1: customer.address_line1 || '',
      city: customer.city || '',
      state: customer.state || '',
      zip: customer.zip || '',
      date_of_birth: customer.date_of_birth || '',
      driver_license_number: customer.driver_license_number || '',
      driver_license_state: customer.driver_license_state || '',
      driver_license_expiry: customer.driver_license_expiry || '',
    },
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

  res.json({ success: true, agreementId: agreement.id });
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
