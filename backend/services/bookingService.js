import { supabase } from '../db/supabase.js';
import { generateBookingCode } from '../utils/generateBookingCode.js';
import { checkAvailability } from './availabilityService.js';
import { calcRentalDays, calcPricing, DELIVERY_FEES } from './pricingService.js';
import { fireGHLWebhook, buildBookingPayload } from './ghlWebhook.js';
import { sendBookingConfirmation } from './emailService.js';

// Valid one-way status transitions
const TRANSITIONS = {
  pending_approval: ['approved', 'declined', 'cancelled'],
  approved:         ['confirmed', 'active', 'cancelled'],
  confirmed:        ['active', 'cancelled'],
  active:           ['returned', 'cancelled'],
  returned:         ['completed'],
  completed:        [],
  declined:         [],
  cancelled:        [],
  no_show:          [],
};

export function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

/** Full booking detail joined with customer, vehicle, payments, status log */
export async function getBookingDetail(bookingId) {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      customers (*),
      vehicles (*),
      payments (*),
      booking_status_log (*)
    `)
    .eq('id', bookingId)
    .single();

  if (error) throw error;
  return data;
}

/** Create a new booking from a public submission */
export async function createBooking(payload) {
  const {
    first_name, last_name, email, phone,
    vehicle_code, pickup_date, return_date,
    pickup_time, return_time,
    delivery_type = 'pickup', delivery_address,
    insurance_provider, insurance_status, bonzah_policy_id,
    special_requests, source = 'website',
    id_photo_url,
  } = payload;

  const deliveryFeeAmount = DELIVERY_FEES[delivery_type] ?? 0;
  const deliveryRequested = deliveryFeeAmount > 0;
  const pickup_location = deliveryRequested
    ? (delivery_address || 'Delivery address TBD')
    : 'Port St. Lucie';

  // 1. Look up vehicle
  const { data: vehicle, error: vErr } = await supabase
    .from('vehicles')
    .select('*')
    .eq('vehicle_code', vehicle_code)
    .single();

  if (vErr || !vehicle) {
    const err = new Error('Vehicle not found');
    err.status = 404;
    throw err;
  }

  if (vehicle.status === 'retired') {
    const err = new Error('Vehicle is no longer available');
    err.status = 400;
    throw err;
  }

  // 2. Availability check
  const { available, conflicts } = await checkAvailability(vehicle.id, pickup_date, return_date);
  if (!available) {
    const err = new Error('Vehicle is not available for the requested dates');
    err.status = 409;
    err.conflicts = conflicts;
    throw err;
  }

  // 3. Upsert customer (include ID photo if provided)
  const customerData = { first_name, last_name, email, phone };
  if (id_photo_url) customerData.id_photo_url = id_photo_url;

  const { data: customer, error: cErr } = await supabase
    .from('customers')
    .upsert(customerData, { onConflict: 'email', ignoreDuplicates: false })
    .select()
    .single();

  if (cErr) throw cErr;

  // 4. Pricing
  const rentalDays = calcRentalDays(pickup_date, return_date);
  const pricing = calcPricing({
    dailyRate: vehicle.daily_rate,
    weeklyRate: vehicle.weekly_rate,
    rentalDays,
    deliveryFeeAmount,
  });

  // 5. Generate booking code (retry on collision)
  let booking_code = generateBookingCode();
  let attempts = 0;
  while (attempts < 5) {
    const { data: existing } = await supabase
      .from('bookings')
      .select('id')
      .eq('booking_code', booking_code)
      .maybeSingle();
    if (!existing) break;
    booking_code = generateBookingCode();
    attempts++;
  }

  // 6. Insert booking
  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .insert({
      booking_code,
      customer_id: customer.id,
      vehicle_id: vehicle.id,
      pickup_date,
      return_date,
      pickup_time,
      return_time,
      pickup_location,
      return_location: pickup_location,
      delivery_requested: deliveryRequested,
      delivery_address: deliveryRequested ? delivery_address : null,
      ...pricing,
      deposit_amount: vehicle.deposit_amount || 0,
      insurance_provider,
      insurance_status: insurance_status || 'pending',
      bonzah_policy_id,
      status: 'pending_approval',
      special_requests: [
        delivery_type && delivery_type !== 'pickup' ? `Delivery type: ${delivery_type}` : '',
        special_requests || '',
      ].filter(Boolean).join(' | ') || null,
      source,
    })
    .select()
    .single();

  if (bErr) throw bErr;

  // 7. Status log
  await supabase.from('booking_status_log').insert({
    booking_id: booking.id,
    from_status: null,
    to_status: 'pending_approval',
    changed_by: 'system',
    reason: 'Booking submitted via website',
  });

  // 8. GHL webhooks (fire-and-forget)
  const fullBooking = { ...booking, customers: customer, vehicles: vehicle };
  fireGHLWebhook('booking.created', buildBookingPayload(fullBooking));

  // 9. Confirmation email to customer (fire-and-forget)
  sendBookingConfirmation({
    customer,
    booking,
    vehicle: vehicle.year && vehicle.make ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : null,
  }).catch(err => console.error('[Email] Confirmation email failed:', err));

  return booking;
}

/** Transition a booking status with logging and GHL hooks */
export async function transitionBooking(bookingId, newStatus, { changedBy = 'owner', reason, extraFields = {} } = {}) {
  const booking = await getBookingDetail(bookingId);

  if (!canTransition(booking.status, newStatus)) {
    const err = new Error(`Cannot transition from '${booking.status}' to '${newStatus}'`);
    err.status = 400;
    throw err;
  }

  const statusFields = {
    status: newStatus,
    ...extraFields,
  };

  if (newStatus === 'approved') statusFields.owner_approved_at = new Date().toISOString();
  if (newStatus === 'declined') statusFields.owner_declined_at = new Date().toISOString();
  if (newStatus === 'active')   statusFields.actual_pickup_at = extraFields.actual_pickup_at || new Date().toISOString();
  if (newStatus === 'returned') statusFields.actual_return_at = extraFields.actual_return_at || new Date().toISOString();

  const { error: updateErr } = await supabase
    .from('bookings')
    .update(statusFields)
    .eq('id', bookingId);

  if (updateErr) throw updateErr;

  await supabase.from('booking_status_log').insert({
    booking_id: bookingId,
    from_status: booking.status,
    to_status: newStatus,
    changed_by: changedBy,
    reason,
  });

  // GHL event map
  const ghlEventMap = {
    approved:  'booking.approved',
    declined:  'booking.declined',
    cancelled: 'booking.cancelled',
    completed: 'booking.completed',
  };

  if (ghlEventMap[newStatus]) {
    const updated = await getBookingDetail(bookingId);
    fireGHLWebhook(ghlEventMap[newStatus], buildBookingPayload(updated));
  }

  return { success: true, booking_code: booking.booking_code, new_status: newStatus };
}
