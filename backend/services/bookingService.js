import { supabase } from '../db/supabase.js';
import { generateBookingCode } from '../utils/generateBookingCode.js';
import { checkAvailability } from './availabilityService.js';
import { computeRentalPricing, DELIVERY_FEES, resolveMultiplier } from './pricingService.js';
import { resolveCustomerLoyalty, LOYALTY_TIERS } from './loyaltyService.js';
import { sendBookingNotification, buildBookingPayload } from './notifyService.js';
import { sendBookingConfirmation } from './emailService.js';
import { createNotification } from './notificationService.js';

// Valid one-way status transitions
const TRANSITIONS = {
  pending_approval: ['approved', 'declined', 'cancelled'],
  approved: ['confirmed', 'active', 'cancelled'],
  confirmed: ['ready_for_pickup', 'active', 'cancelled'],
  ready_for_pickup: ['active', 'cancelled'],
  active: ['returned', 'cancelled'],
  returned: ['completed'],
  completed: [],
  declined: [],
  cancelled: [],
  no_show: [],
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
      booking_status_log (*),
      rental_agreements (*)
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
    unlimited_miles, unlimited_tolls,
    rate_preference,
  } = payload;

  const validRatePref = ['daily', 'weekly', 'monthly'].includes(rate_preference) ? rate_preference : null;

  const deliveryFeeAmount = DELIVERY_FEES[delivery_type] ?? 0;
  const deliveryRequested = deliveryFeeAmount > 0;
  const pickup_location = deliveryRequested
    ? (delivery_address || 'Delivery address TBD')
    : 'Port St. Lucie';

  // 1. Look up vehicle — try vehicle_code first, then id, then slug match
  let vehicle = null;
  let vErr = null;

  // Try exact vehicle_code match (VIN)
  const { data: v1, error: e1 } = await supabase
    .from('vehicles')
    .select('*')
    .eq('vehicle_code', vehicle_code)
    .maybeSingle();
  
  if (v1) {
    vehicle = v1;
  } else {
    // Try UUID match (in case frontend sends the DB id)
    const { data: v2 } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', vehicle_code)
      .maybeSingle();
    
    if (v2) {
      vehicle = v2;
    } else {
      // Try slug match: 'v-altima' → match against make/model
      const slugModel = vehicle_code.replace(/^v-/, '').replace(/-/g, ' ').toLowerCase();
      const { data: allVehicles } = await supabase
        .from('vehicles')
        .select('*')
        .neq('status', 'retired');
      
      if (allVehicles) {
        vehicle = allVehicles.find(v => {
          const model = (v.model || '').toLowerCase();
          const make = (v.make || '').toLowerCase();
          return model === slugModel || make === slugModel
            || `${make} ${model}`.includes(slugModel)
            || slugModel.includes(model);
        });
      }
    }
  }

  if (!vehicle) {
    const err = new Error(`Vehicle not found for code: ${vehicle_code}`);
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

  // 3. Find or create customer (don't overwrite existing customer data)
  let customer;
  const { data: existingCustomer } = await supabase
    .from('customers')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (existingCustomer) {
    customer = existingCustomer;
    // Only update id_photo_url if newly provided
    if (id_photo_url && id_photo_url !== existingCustomer.id_photo_url) {
      await supabase.from('customers').update({ id_photo_url }).eq('id', customer.id);
    }
  } else {
    const customerData = { first_name, last_name, email, phone };
    if (id_photo_url) customerData.id_photo_url = id_photo_url;
    const { data: newCustomer, error: cErr } = await supabase
      .from('customers')
      .insert(customerData)
      .select()
      .single();
    if (cErr) throw cErr;
    customer = newCustomer;
  }

  // 4. Pricing
  const mileageAddonFee = unlimited_miles ? 100 : 0;   // $100 flat (zeroed by computeRentalPricing for weekly bookings)
  const tollAddonFee = unlimited_tolls ? 20 : 0;        // $20 flat
  const [{ multiplier: priceMultiplier, name: seasonalRuleName }, { discountPct: loyaltyDiscountPct, tier: loyaltyTier }] = await Promise.all([
    resolveMultiplier(supabase, pickup_date, return_date, vehicle.id),
    resolveCustomerLoyalty(supabase, customer.id),
  ]);
  const loyaltyTierLabel = loyaltyTier ? (LOYALTY_TIERS.find(t => t.key === loyaltyTier)?.label || null) : null;
  const pricing = computeRentalPricing({
    vehicle,
    pickupDate: pickup_date,
    returnDate: return_date,
    deliveryFeeAmount,
    mileageAddonFee,
    tollAddonFee,
    priceMultiplier,
    seasonalRuleName,
    loyaltyDiscountPct,
    loyaltyTierLabel,
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
  if (attempts >= 5) {
    const err = new Error('Unable to generate a unique booking code. Please try again.');
    err.status = 500;
    throw err;
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
      daily_rate:              pricing.daily_rate,
      rental_days:             pricing.rental_days,
      rate_type:               pricing.rate_type,
      weekly_discount_applied: pricing.weekly_discount_applied,
      subtotal:                pricing.subtotal,
      discount_amount:         pricing.discount_amount,
      delivery_fee:            pricing.delivery_fee,
      mileage_addon_fee:       pricing.mileage_addon_fee,
      toll_addon_fee:          pricing.toll_addon_fee,
      tax_amount:              pricing.tax_amount,
      total_cost:              pricing.total_cost,
      mileage_allowance:       pricing.mileage_allowance,
      line_items:              pricing.line_items,
      unlimited_miles: !!unlimited_miles,
      unlimited_tolls: !!unlimited_tolls,
      deposit_amount: vehicle.deposit_amount || 0,
      insurance_provider,
      insurance_status: insurance_status || 'pending',
      bonzah_policy_id,
      status: 'pending_approval',
      special_requests: [
        delivery_type && delivery_type !== 'pickup' ? `Delivery type: ${delivery_type}` : '',
        validRatePref ? `Rate preference: ${validRatePref}` : '',
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

  // 8. Send booking notification (fire-and-forget)
  const fullBooking = { ...booking, customers: customer, vehicles: vehicle };
  sendBookingNotification('booking_submitted', buildBookingPayload(fullBooking));

  // 9. Confirmation email to customer (fire-and-forget)
  sendBookingConfirmation({
    customer,
    booking,
    vehicle: vehicle.year && vehicle.make ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : null,
  }).catch(err => console.error('[Email] Confirmation email failed:', err));

  // 10. Dashboard notification
  createNotification(
    'new_booking',
    `New booking: ${booking_code}`,
    `${customer.first_name} ${customer.last_name} — ${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    `/bookings/${booking.id}`,
    { booking_id: booking.id, booking_code }
  ).catch(() => { });

  return booking;
}

/** Transition a booking status with logging and notification hooks */
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
  if (newStatus === 'active') statusFields.actual_pickup_at = extraFields.actual_pickup_at || new Date().toISOString();
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

  // Send notification for status change (fire-and-forget)
  const stageMap = {
    approved: 'booking_approved',
    declined: 'booking_declined',
    cancelled: 'booking_cancelled',
    ready_for_pickup: 'ready_for_pickup',
    returned: 'return_confirmed',
    completed: 'rental_completed',
  };

  if (stageMap[newStatus]) {
    const updated = await getBookingDetail(bookingId);

    // For ready_for_pickup: include admin's handoff record (fuel, odometer, photos)
    let handoffRecord = null;
    if (newStatus === 'ready_for_pickup') {
      const { data: prepRecord } = await supabase
        .from('checkin_records')
        .select('*')
        .eq('booking_id', bookingId)
        .eq('record_type', 'admin_prep')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      handoffRecord = prepRecord;
    }

    sendBookingNotification(stageMap[newStatus], buildBookingPayload(updated, { handoffRecord }));
  }

  // Dashboard notification for status changes
  const statusLabels = { approved: 'approved', declined: 'declined', cancelled: 'cancelled', ready_for_pickup: 'marked ready for pickup', active: 'picked up', returned: 'returned', completed: 'completed' };
  if (statusLabels[newStatus]) {
    const label = statusLabels[newStatus];
    const cName = `${booking.customers?.first_name || ''} ${booking.customers?.last_name || ''}`.trim();
    createNotification(
      'status_change',
      `Booking ${booking.booking_code} ${label}`,
      cName ? `${cName}'s booking has been ${label}` : undefined,
      `/bookings/${bookingId}`,
      { booking_id: bookingId, new_status: newStatus }
    ).catch(() => { });
  }

  return { success: true, booking_code: booking.booking_code, new_status: newStatus };
}
