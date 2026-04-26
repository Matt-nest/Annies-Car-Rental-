import { getStripe } from '../utils/stripe.js';
import { supabase } from '../db/supabase.js';
import { transitionBooking, getBookingDetail } from './bookingService.js';
import { createNotification } from './notificationService.js';
import { sendBookingNotification, buildBookingPayload } from './notifyService.js';
import { calcInsuranceCost } from './pricingService.js';

const stripe = getStripe();

/**
 * Create a PaymentIntent for a booking.
 * Charges total_cost + insurance_cost + security deposit in a single PaymentIntent.
 * The deposit portion is tracked separately in booking_deposits.
 * Accepts optional insurance_selection and expected_total_cents for server-side validation.
 * Returns { clientSecret, amount, currency, booking } for the frontend.
 */
export async function createPaymentIntent(bookingCode, { insurance_selection, expected_total_cents } = {}) {
  // Look up the booking
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*, customers(first_name, last_name, email, phone), vehicles(year, make, model, vehicle_code)')
    .eq('booking_code', bookingCode)
    .single();

  if (error || !booking) {
    throw Object.assign(new Error('Booking not found'), { status: 404 });
  }

  // Don't allow payment for declined/cancelled bookings
  if (['declined', 'cancelled'].includes(booking.status)) {
    throw Object.assign(new Error('This booking has been ' + booking.status), { status: 400 });
  }

  // Check if there's already a PaymentIntent in Stripe for this booking.
  // Use list() instead of search() — search requires special account activation
  // and is unreliable on new/test accounts.
  const allIntents = await stripe.paymentIntents.list({ limit: 100 });
  const existingIntents = {
    data: allIntents.data.filter(pi => pi.metadata?.booking_id === booking.id),
  };

  const activeIntent = existingIntents.data.find(
    pi => !['canceled', 'succeeded'].includes(pi.status)
  );

  if (activeIntent) {
    return {
      clientSecret: activeIntent.client_secret,
      amount: activeIntent.amount,
      currency: activeIntent.currency,
      booking: await formatBookingSummary(booking),
    };
  }

  // Check if payment already completed
  const succeededIntent = existingIntents.data.find(pi => pi.status === 'succeeded');
  if (succeededIntent) {
    return {
      clientSecret: null,
      alreadyPaid: true,
      amount: succeededIntent.amount,
      currency: succeededIntent.currency,
      booking: await formatBookingSummary(booking),
    };
  }

  // Calculate amount in cents — rental + insurance + security deposit
  const rentalCents = Math.round(Number(booking.total_cost) * 100);
  if (rentalCents <= 0) {
    throw Object.assign(new Error('Invalid booking total'), { status: 400 });
  }

  // Calculate insurance cost from booking data or passed selection
  const insSource = insurance_selection?.source || booking.insurance_provider || null;
  const insTier = insurance_selection?.tier || booking.insurance_policy_number || null;
  const insuranceDollars = calcInsuranceCost(insSource, insTier, booking.rental_days);
  const insuranceCents = Math.round(insuranceDollars * 100);

  // Look up vehicle-specific deposit (defaults to $150 / 15000 cents)
  let depositCents = 15000;
  if (booking.vehicle_id) {
    const { data: vd } = await supabase
      .from('vehicle_deposits')
      .select('amount')
      .eq('vehicle_id', booking.vehicle_id)
      .maybeSingle();
    if (vd) depositCents = vd.amount;
  }

  const totalChargeCents = rentalCents + insuranceCents + depositCents;

  // Server-side amount validation: reject if frontend total disagrees by more than 1 cent
  if (expected_total_cents != null && Math.abs(totalChargeCents - expected_total_cents) > 1) {
    throw Object.assign(
      new Error(`Amount mismatch: server calculated $${(totalChargeCents / 100).toFixed(2)} but frontend expected $${(expected_total_cents / 100).toFixed(2)}. Please refresh and try again.`),
      { status: 400 }
    );
  }

  // Create the PaymentIntent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalChargeCents,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    metadata: {
      booking_id: booking.id,
      booking_code: booking.booking_code,
      customer_name: `${booking.customers?.first_name} ${booking.customers?.last_name}`,
      vehicle: `${booking.vehicles?.year} ${booking.vehicles?.make} ${booking.vehicles?.model}`,
      rental_cents: String(rentalCents),
      insurance_cents: String(insuranceCents),
      insurance_source: insSource || 'none',
      insurance_tier: insTier || 'none',
      deposit_cents: String(depositCents),
    },
    receipt_email: booking.customers?.email || undefined,
    description: `Annie's Car Rental — ${booking.booking_code} — ${booking.vehicles?.year} ${booking.vehicles?.make} ${booking.vehicles?.model} (incl. $${(depositCents / 100).toFixed(0)} refundable deposit${insuranceCents > 0 ? ` + $${(insuranceCents / 100).toFixed(0)} insurance` : ''})`,
  });

  return {
    clientSecret: paymentIntent.client_secret,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    booking: await formatBookingSummary(booking),
  };
}

/**
 * Handle Stripe webhook events
 */
export async function handleWebhookEvent(event) {
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object;
      const bookingId = pi.metadata.booking_id;
      if (!bookingId) break;

      // Split the payment into rental + deposit using metadata
      const depositCents = Number(pi.metadata.deposit_cents) || 0;
      const rentalCents = Number(pi.metadata.rental_cents) || pi.amount;
      const rentalDollars = rentalCents / 100;
      const depositDollars = depositCents / 100;

      // Record the rental payment
      await supabase.from('payments').insert({
        booking_id: bookingId,
        amount: rentalDollars,
        payment_type: 'rental',
        method: 'stripe',
        reference_id: pi.id,
        status: 'completed',
        paid_at: new Date().toISOString(),
        notes: `Stripe payment — ${pi.payment_method_types?.join(', ') || 'card'}`,
      });

      // Record the deposit payment (separate row for accounting)
      if (depositCents > 0) {
        await supabase.from('payments').insert({
          booking_id: bookingId,
          amount: depositDollars,
          payment_type: 'deposit',
          method: 'stripe',
          reference_id: pi.id,
          status: 'completed',
          paid_at: new Date().toISOString(),
          notes: `Security deposit — refundable`,
        });
      }

      // Update booking deposit status
      await supabase
        .from('bookings')
        .update({
          deposit_status: 'paid',
          deposit_amount: depositDollars,
        })
        .eq('id', bookingId);

      // Create booking_deposits record for settlement tracking
      if (depositCents > 0) {
        await supabase.from('booking_deposits').upsert({
          booking_id: bookingId,
          amount: depositCents,
          stripe_charge_id: pi.id,
          status: 'held',
        }, { onConflict: 'booking_id' }).catch(() => {});
      }

      console.log(`[Stripe] Payment succeeded for booking ${pi.metadata.booking_code}: $${rentalDollars} rental + $${depositDollars} deposit = $${pi.amount / 100} total`);

      // Send itemized receipt to customer
      const paidBooking = await getBookingDetail(bookingId).catch(() => null);
      if (paidBooking) {
        const payload = buildBookingPayload(paidBooking);
        payload.amount = rentalDollars.toFixed(2);
        payload.deposit_amount = depositDollars.toFixed(2);
        payload.total_charged = (pi.amount / 100).toFixed(2);
        payload.payment_method = pi.payment_method_types?.join(', ') || 'Card';
        payload.payment_date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        payload.payment_time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        // Vehicle & dates for itemized receipt
        payload.vehicle_name = paidBooking.vehicles ? `${paidBooking.vehicles.year} ${paidBooking.vehicles.make} ${paidBooking.vehicles.model}` : 'Vehicle';
        payload.pickup_date_formatted = paidBooking.pickup_date ? new Date(paidBooking.pickup_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '';
        payload.return_date_formatted = paidBooking.return_date ? new Date(paidBooking.return_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '';
        payload.rental_days = paidBooking.pickup_date && paidBooking.return_date ? Math.ceil((new Date(paidBooking.return_date) - new Date(paidBooking.pickup_date)) / (1000 * 60 * 60 * 24)) : '';
        payload.total_miles = payload.rental_days ? (Number(payload.rental_days) * 200).toLocaleString() : '—';
        payload.tax_amount = paidBooking.tax_amount ? parseFloat(paidBooking.tax_amount).toFixed(2) : '0.00';
        sendBookingNotification('payment_confirmed', payload);
      }

      // Dashboard notification
      createNotification(
        'payment_received',
        `Payment received: $${(pi.amount / 100).toFixed(2)}`,
        `Booking ${pi.metadata.booking_code} — ${pi.metadata.customer_name || ''}`,
        `/bookings/${bookingId}`,
        { booking_id: bookingId, amount: pi.amount / 100 }
      ).catch(() => {});

      // Check for auto-confirm
      const booking = await getBookingDetail(bookingId).catch(() => null);
      if (booking && booking.status === 'approved') {
        const { data: agreement } = await supabase
          .from('rental_agreements')
          .select('id')
          .eq('booking_id', bookingId)
          .maybeSingle();
        
        if (agreement) {
          await transitionBooking(bookingId, 'confirmed', {
            changedBy: 'system',
            reason: 'Payment completed and agreement already signed'
          }).catch(e => console.error('[Auto-Confirm Error]', e));
        }
      }

      break;
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object;
      console.log(`[Stripe] Payment failed for booking ${pi.metadata?.booking_code}: ${pi.last_payment_error?.message}`);
      break;
    }

    case 'payment_intent.canceled': {
      const pi = event.data.object;
      const bookingId = pi.metadata?.booking_id;
      console.log(`[Stripe] PaymentIntent canceled for booking ${pi.metadata?.booking_code}`);
      if (bookingId) {
        // Mark deposit as none so the booking doesn't sit in limbo
        await supabase
          .from('bookings')
          .update({ deposit_status: 'none' })
          .eq('id', bookingId)
          .eq('deposit_status', 'pending');
      }
      break;
    }

    default:
      // Unexpected event type
      break;
  }
}

/**
 * Confirm a payment after the frontend reports success.
 * Retrieves the PaymentIntent from Stripe, verifies it succeeded,
 * and records the payment + updates the booking.
 * This handles the case where webhooks can't reach the server (e.g. localhost).
 */
export async function confirmPayment(paymentIntentId) {
  // Retrieve the PaymentIntent from Stripe to verify it actually succeeded
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (pi.status !== 'succeeded') {
    throw Object.assign(
      new Error(`Payment has not succeeded (status: ${pi.status})`),
      { status: 400 }
    );
  }

  const bookingId = pi.metadata?.booking_id;
  if (!bookingId) {
    throw Object.assign(new Error('No booking linked to this payment'), { status: 400 });
  }

  // Check if we already recorded this payment (idempotent)
  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('reference_id', pi.id)
    .maybeSingle();

  if (existing) {
    return { success: true, alreadyRecorded: true };
  }

  // Split into rental + deposit using metadata (same logic as webhook)
  const depositCents = Number(pi.metadata.deposit_cents) || 0;
  const rentalCents = Number(pi.metadata.rental_cents) || pi.amount;
  const rentalDollars = rentalCents / 100;
  const depositDollars = depositCents / 100;

  // Record the rental payment
  await supabase.from('payments').insert({
    booking_id: bookingId,
    amount: rentalDollars,
    payment_type: 'rental',
    method: 'stripe',
    reference_id: pi.id,
    status: 'completed',
    paid_at: new Date().toISOString(),
    notes: `Stripe payment — ${pi.payment_method_types?.join(', ') || 'card'}`,
  });

  // Record the deposit payment
  if (depositCents > 0) {
    await supabase.from('payments').insert({
      booking_id: bookingId,
      amount: depositDollars,
      payment_type: 'deposit',
      method: 'stripe',
      reference_id: pi.id,
      status: 'completed',
      paid_at: new Date().toISOString(),
      notes: `Security deposit — refundable`,
    });
  }

  // Update booking deposit status
  await supabase
    .from('bookings')
    .update({
      deposit_status: 'paid',
      deposit_amount: depositDollars,
    })
    .eq('id', bookingId);

  // Create booking_deposits record for settlement tracking
  if (depositCents > 0) {
    await supabase.from('booking_deposits').upsert({
      booking_id: bookingId,
      amount: depositCents,
      stripe_charge_id: pi.id,
      status: 'held',
    }, { onConflict: 'booking_id' }).catch(() => {});
  }

  console.log(`[Stripe] Payment confirmed for booking ${pi.metadata.booking_code}: $${pi.amount / 100}`);

  // Dashboard notification
  createNotification(
    'payment_received',
    `Payment received: $${(pi.amount / 100).toFixed(2)}`,
    `Booking ${pi.metadata.booking_code} — ${pi.metadata.customer_name || ''}`,
    `/bookings/${bookingId}`,
    { booking_id: bookingId, amount: pi.amount / 100 }
  ).catch(() => {});

  // Check for auto-confirm
  const booking = await getBookingDetail(bookingId).catch(() => null);
  if (booking && booking.status === 'approved') {
    const { data: agreement } = await supabase
      .from('rental_agreements')
      .select('id')
      .eq('booking_id', bookingId)
      .maybeSingle();
    
    if (agreement) {
      await transitionBooking(bookingId, 'confirmed', {
        changedBy: 'system',
        reason: 'Payment completed and agreement already signed'
      }).catch(e => console.error('[Auto-Confirm Error]', e));
    }
  }

  return { success: true };
}

/**
 * Format a booking into a summary for the frontend checkout page
 */
async function formatBookingSummary(booking) {
  // Fetch the deposit amount for this vehicle
  let depositAmount = 150; // default $150
  if (booking.vehicle_id) {
    const { data: vd } = await supabase
      .from('vehicle_deposits')
      .select('amount')
      .eq('vehicle_id', booking.vehicle_id)
      .maybeSingle();
    if (vd) depositAmount = vd.amount / 100;
  }

  // Calculate insurance cost from stored booking data
  const insuranceSource = booking.insurance_provider || null;
  const insuranceTier = (insuranceSource === 'annies') ? booking.insurance_policy_number : null;
  const insuranceCost = calcInsuranceCost(insuranceSource, insuranceTier, booking.rental_days);

  return {
    bookingCode: booking.booking_code,
    status: booking.status,
    customerName: `${booking.customers?.first_name} ${booking.customers?.last_name}`,
    customerEmail: booking.customers?.email || '',
    vehicle: booking.vehicles
      ? `${booking.vehicles.year} ${booking.vehicles.make} ${booking.vehicles.model}`
      : null,
    pickupDate: booking.pickup_date,
    returnDate: booking.return_date,
    rentalDays: booking.rental_days,
    dailyRate: Number(booking.daily_rate),
    subtotal: Number(booking.subtotal),
    deliveryFee: Number(booking.delivery_fee || 0),
    discountAmount: Number(booking.discount_amount || 0),
    mileageAddonFee: Number(booking.mileage_addon_fee || 0),
    tollAddonFee: Number(booking.toll_addon_fee || 0),
    taxAmount: Number(booking.tax_amount || 0),
    totalCost: Number(booking.total_cost),
    // Weekly pricing fields
    rateType: booking.rate_type || 'daily',
    lineItems: booking.line_items || null,
    mileageAllowance: booking.mileage_allowance || null,
    insuranceSource,
    insuranceTier,
    insuranceCost,
    depositAmount,
    depositIncludedInCharge: true,
    totalChargedWithDeposit: Number(booking.total_cost) + insuranceCost + depositAmount,
    hasDelivery: !!booking.delivery_requested,
    hasUnlimitedMiles: !!booking.unlimited_miles,
    hasUnlimitedTolls: !!booking.unlimited_tolls,
  };
}
