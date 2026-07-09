import { supabase } from '../db/supabase.js';
import { generateBookingCode } from '../utils/generateBookingCode.js';
import { checkAvailability } from './availabilityService.js';
import { computeRentalPricing, DELIVERY_FEES, resolveMultiplier, calcRentalDays } from './pricingService.js';
import { resolveCustomerLoyalty, LOYALTY_TIERS } from './loyaltyService.js';
import { sendBookingNotification, buildBookingPayload } from './notifyService.js';
import { sendBookingConfirmation } from './emailService.js';
import { createNotification } from './notificationService.js';
import { sendTeamAlertAsync, TEAM_ALERT_EVENTS } from './teamAlertService.js';
import { cancelPolicy as cancelBonzahPolicy } from './bonzahService.js';
import { getVehicleDepositAmount } from './depositService.js';

// Valid one-way status transitions
const TRANSITIONS = {
  pending_approval: ['approved', 'declined', 'cancelled'],
  approved: ['confirmed', 'active', 'cancelled', 'no_show'],
  confirmed: ['ready_for_pickup', 'active', 'cancelled', 'no_show'],
  ready_for_pickup: ['active', 'cancelled', 'no_show'],
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
      rental_agreements (*),
      booking_addons (*)
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
    created_by_admin = false,
    admin_weekly_discount_percent,
    admin_total_cost_override,
    admin_deposit_amount,
    rental_type = 'standard',
    portal_notes,
    skip_availability_check = false,
  } = payload;

  const validRatePref = ['daily', 'weekly', 'monthly'].includes(rate_preference) ? rate_preference : null;
  const adminWeeklyDiscountPct = created_by_admin && admin_weekly_discount_percent !== undefined
    ? Math.min(50, Math.max(0, Number(admin_weekly_discount_percent)))
    : null;
  const adminTotalCostOverride = created_by_admin && admin_total_cost_override !== undefined && admin_total_cost_override !== ''
    ? Number(admin_total_cost_override)
    : null;
  if (adminWeeklyDiscountPct != null && !Number.isFinite(adminWeeklyDiscountPct)) {
    const err = new Error('Invalid weekly discount override');
    err.status = 400;
    throw err;
  }
  if (adminTotalCostOverride != null && (!Number.isFinite(adminTotalCostOverride) || adminTotalCostOverride <= 0)) {
    const err = new Error('Exact price override must be greater than $0');
    err.status = 400;
    throw err;
  }
  const adminDepositAmount = created_by_admin && admin_deposit_amount !== undefined && admin_deposit_amount !== ''
    ? Number(admin_deposit_amount)
    : null;
  if (adminDepositAmount != null && (!Number.isFinite(adminDepositAmount) || adminDepositAmount < 0)) {
    const err = new Error('Deposit amount must be zero or greater');
    err.status = 400;
    throw err;
  }

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

  // 2. Availability check (admin long-term onboarding may skip — renter already has vehicle)
  if (!(created_by_admin && skip_availability_check)) {
    const { available, conflicts } = await checkAvailability(vehicle.id, pickup_date, return_date);
    if (!available) {
      const err = new Error('Vehicle is not available for the requested dates');
      err.status = 409;
      err.conflicts = conflicts;
      throw err;
    }
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
    weeklyDiscountPercentOverride: adminWeeklyDiscountPct,
    totalCostOverride: adminTotalCostOverride,
    totalCostOverrideLabel: 'Admin exact price override',
  });

  const expectedDays = calcRentalDays(pickup_date, return_date);
  if (pricing.rental_days !== expectedDays) {
    const err = new Error(`Pricing day count (${pricing.rental_days}) does not match selected dates (${expectedDays} days)`);
    err.status = 500;
    throw err;
  }

  const depositCents = adminDepositAmount != null
    ? Math.round(adminDepositAmount * 100)
    : await getVehicleDepositAmount(vehicle.id);
  const depositDollars = depositCents / 100;

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
      delivery_type,
      delivery_address: deliveryRequested ? delivery_address : null,
      has_delivery: deliveryRequested,
      has_unlimited_miles: pricing.mileage_allowance === 'unlimited' || !!unlimited_miles,
      has_unlimited_tolls: !!unlimited_tolls,
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
      unlimited_miles: pricing.mileage_allowance === 'unlimited' || !!unlimited_miles,
      unlimited_tolls: !!unlimited_tolls,
      deposit_amount: depositDollars,
      insurance_provider,
      insurance_status: insurance_status || 'pending',
      bonzah_policy_id,
      // Admin-created bookings (walk-ins / phone) skip the approval gate — the
      // admin is vetting the renter in person — so they're born 'approved' and
      // can go straight to payment. Public/website submissions require explicit
      // admin approval before the payment step unlocks.
      status: created_by_admin ? 'approved' : 'pending_approval',
      ...(created_by_admin ? { owner_approved_at: new Date().toISOString() } : {}),
      created_by_admin: !!created_by_admin,
      rental_type: rental_type === 'long_term' ? 'long_term' : 'standard',
      portal_notes: portal_notes || null,
      special_requests: [
        delivery_type && delivery_type !== 'pickup' ? `Delivery type: ${delivery_type}` : '',
        validRatePref ? `Rate preference: ${validRatePref}` : '',
        adminWeeklyDiscountPct != null ? `Admin weekly discount: ${adminWeeklyDiscountPct}%` : '',
        adminTotalCostOverride != null ? `Admin exact rental total: $${adminTotalCostOverride.toFixed(2)}` : '',
        adminDepositAmount != null ? `Admin deposit: $${adminDepositAmount.toFixed(2)}` : '',
        special_requests || '',
      ].filter(Boolean).join(' | ') || null,
      source,
    })
    .select()
    .single();

  if (bErr) throw bErr;

  // 6b. Normalized add-on rows for dashboard reporting
  const addonRows = [];
  if (Number(pricing.mileage_addon_fee) > 0) {
    addonRows.push({
      booking_id: booking.id,
      addon_type: 'unlimited_miles',
      amount: Math.round(Number(pricing.mileage_addon_fee) * 100),
    });
  }
  if (Number(pricing.toll_addon_fee) > 0) {
    addonRows.push({
      booking_id: booking.id,
      addon_type: 'unlimited_tolls',
      amount: Math.round(Number(pricing.toll_addon_fee) * 100),
    });
  }
  if (deliveryRequested && Number(pricing.delivery_fee) > 0) {
    addonRows.push({
      booking_id: booking.id,
      addon_type: 'delivery',
      amount: Math.round(Number(pricing.delivery_fee) * 100),
    });
  }
  if (addonRows.length) {
    await supabase.from('booking_addons').insert(addonRows);
  }

  // 7. Status log
  await supabase.from('booking_status_log').insert({
    booking_id: booking.id,
    from_status: null,
    to_status: created_by_admin ? 'approved' : 'pending_approval',
    changed_by: 'system',
    reason: created_by_admin ? 'Admin-created booking — auto-approved on creation' : 'Booking submitted via website',
  });

  // 8. Send booking notification
  // Awaited so the email→SMS→push fan-out completes inside the request
  // lifecycle — an un-awaited call gets frozen when the Vercel lambda returns,
  // which delayed/dropped the admin "new booking" push. Never throws.
  const fullBooking = { ...booking, customers: customer, vehicles: vehicle };
  await sendBookingNotification('booking_submitted', buildBookingPayload(fullBooking));

  // 9. Confirmation email to customer (fire-and-forget)
  // ⚠ IMPLICIT CONTRACT (Phase 1 audit F-3):
  // notifyService.sendBookingNotification skips email dispatch when
  // stage === 'booking_submitted' on the assumption that this call is firing
  // the branded confirmation. Removing or renaming this call leaves customers
  // with NO email after submission. Guarded by tests/booking-submitted-contract.test.js.
  sendBookingConfirmation({
    customer,
    booking,
    vehicle: vehicle.year && vehicle.make ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : null,
  }).catch(err => console.error('[Email] Confirmation email failed:', err));

  // 10. Dashboard notification + team SMS (website submissions awaiting approval)
  createNotification(
    'new_booking',
    `New booking: ${booking_code}`,
    `${customer.first_name} ${customer.last_name} — ${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    `/bookings/${booking.id}`,
    { booking_id: booking.id, booking_code }
  ).catch(() => { });

  if (!created_by_admin) {
    sendTeamAlertAsync(TEAM_ALERT_EVENTS.NEW_BOOKING, fullBooking);
  }

  // 11. Approval gate: every public/website submission now requires an explicit
  // admin approve/deny before the payment step unlocks (the customer receives a
  // continue-link once approved). Trusted-customer auto-approve (migration 019)
  // was intentionally removed — no bookings bypass the gate except admin-created
  // ones, which are born 'approved' above.

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

  // Invariant: a terminal off-the-road booking must never have a future return_date,
  // or it ghost-blocks the vehicle calendar. Clamp return_date to today and backfill
  // actual_return_at on the way to any terminal status.
  let autoClampNote = null;
  const TERMINAL_OFF_ROAD = ['returned', 'completed', 'cancelled', 'declined', 'no_show'];
  if (TERMINAL_OFF_ROAD.includes(newStatus)) {
    const todayStr = new Date().toISOString().slice(0, 10);
    if (!booking.actual_return_at && !statusFields.actual_return_at) {
      statusFields.actual_return_at = new Date().toISOString();
    }
    const currentReturnDate = statusFields.return_date || booking.return_date;
    if (currentReturnDate && currentReturnDate > todayStr) {
      statusFields.return_date = todayStr;
      autoClampNote = `auto-clamped return_date ${currentReturnDate} → ${todayStr} on transition to ${newStatus}`;
    }
  }

  // Cancellation: if a Bonzah policy is bound, file a cancel endorsement with
  // Bonzah BEFORE we flip the local row to 'cancelled'. This way if Bonzah
  // errors, we don't end up with an orphaned active policy and a cancelled
  // booking. Customer gets no refund — Bonzah credits Annie's broker balance
  // (admin reconciles offline).
  if (newStatus === 'cancelled' && booking.bonzah_policy_id && booking.insurance_status === 'active') {
    try {
      const cancelRes = await cancelBonzahPolicy(
        booking.bonzah_policy_id,
        `Booking ${booking.booking_code} cancelled — ${reason || 'no reason provided'}`,
        bookingId
      );
      statusFields.insurance_status = 'cancelled';
      statusFields.bonzah_last_synced_at = new Date().toISOString();
      console.log(`[Bonzah] Cancel endorsement filed for ${booking.booking_code}: endorsement_id=${cancelRes.endorsement_id}`);
    } catch (err) {
      // Log + alert admin, but do NOT block the booking cancellation. The
      // polling job + dashboard manual-cancel button can recover.
      console.error(`[Bonzah] Cancel failed for ${booking.booking_code} (booking will still cancel locally):`, err?.message || err);
      createNotification(
        'bonzah_cancel_failed',
        `Bonzah cancel failed: ${booking.booking_code}`,
        `Booking is cancelled locally but Bonzah policy ${booking.bonzah_policy_no || booking.bonzah_policy_id} was NOT cancelled. Manual reconciliation required.`,
        `/bookings/${bookingId}`,
        { booking_id: bookingId, error: err?.message }
      ).catch(() => {});
    }
  }

  const { error: updateErr } = await supabase
    .from('bookings')
    .update(statusFields)
    .eq('id', bookingId);

  if (updateErr) throw updateErr;

  const loggedReason = autoClampNote
    ? (reason ? `${reason} (${autoClampNote})` : autoClampNote)
    : reason;

  await supabase.from('booking_status_log').insert({
    booking_id: bookingId,
    from_status: booking.status,
    to_status: newStatus,
    changed_by: changedBy,
    reason: loggedReason,
  });

  // Send notification for status change (fire-and-forget)
  const stageMap = {
    approved: 'booking_approved',
    declined: 'booking_declined',
    cancelled: 'booking_cancelled',
    ready_for_pickup: 'ready_for_pickup',
    returned: 'return_confirmed',
    // rental_completed (review request) fires via cron the day after return —
    // not here — so customers get one thoughtful follow-up, not two.
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

    // Awaited so the approval/decline push lands within this request instead of
    // being frozen with the serverless lambda after the response returns.
    await sendBookingNotification(stageMap[newStatus], buildBookingPayload(updated, { handoffRecord }));
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

  if (newStatus === 'returned') {
    const updated = await getBookingDetail(bookingId);
    sendTeamAlertAsync(TEAM_ALERT_EVENTS.VEHICLE_RETURNED, updated);
  }

  return { success: true, booking_code: booking.booking_code, new_status: newStatus };
}

/**
 * Apply a checkout override — admin force-unlocks the CheckOutTab when the
 * renter never self-checked-out via the customer portal.
 *
 * Persists the override on the booking, stamps actual_return_at if missing,
 * and writes a synthetic customer_checkout record so downstream code that
 * gates on `checkin_records.record_type='customer_checkout'` keeps working.
 *
 * Booking status is intentionally NOT changed here — the admin still drives
 * the checkout flow forward (CheckOutTab → recordCheckOut → eventually
 * transitionBooking('returned')).
 */
export async function applyCheckoutOverride(bookingId, { reason, note, adminUserId }) {
  const VALID_REASONS = [
    'vehicle_returned_system_not_updated',
    'renter_unreachable_or_abandoned',
    'manual_reconciliation_after_incident',
    'other',
  ];
  if (!VALID_REASONS.includes(reason)) {
    const err = new Error(`Invalid checkout override reason: ${reason}`);
    err.status = 400;
    throw err;
  }
  if (reason === 'other' && !note?.trim()) {
    const err = new Error('A note is required when override reason is "other"');
    err.status = 400;
    throw err;
  }

  const booking = await getBookingDetail(bookingId);
  if (!['active', 'returned'].includes(booking.status)) {
    const err = new Error(`Cannot override checkout for booking in status '${booking.status}'`);
    err.status = 400;
    throw err;
  }

  const nowIso = new Date().toISOString();
  const updates = {
    checkout_override_reason: reason,
    checkout_override_note: note?.trim() || null,
    checkout_override_by: adminUserId || 'admin',
    checkout_override_at: nowIso,
  };
  if (!booking.actual_return_at) updates.actual_return_at = nowIso;

  const { error: updateErr } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', bookingId);
  if (updateErr) throw updateErr;

  // Synthesize a customer_checkout record so the CheckOutTab gate passes.
  await supabase.from('checkin_records').insert({
    booking_id: bookingId,
    record_type: 'customer_checkout',
    odometer: booking.return_mileage || null,
    fuel_level: booking.return_fuel_level || null,
    condition_notes: `[admin override: ${reason}]${note ? ` ${note}` : ''}`,
    photo_urls: [],
    created_by: adminUserId || 'admin',
  });

  await supabase.from('booking_status_log').insert({
    booking_id: bookingId,
    from_status: booking.status,
    to_status: booking.status,
    changed_by: adminUserId || 'admin',
    reason: `Checkout override applied (reason=${reason}${note ? `; note=${note}` : ''})`,
  });

  return { success: true };
}
