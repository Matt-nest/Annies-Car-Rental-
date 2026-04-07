import { getStripe } from '../utils/stripe.js';
import { supabase } from '../db/supabase.js';
import { transitionBooking, getBookingDetail } from './bookingService.js';
import { createNotification } from './notificationService.js';

const stripe = getStripe();

/**
 * Create a PaymentIntent for a booking.
 * Looks up the booking by booking_code, calculates amount from total_cost.
 * Returns { clientSecret, amount, currency, booking } for the frontend.
 */
export async function createPaymentIntent(bookingCode) {
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
      booking: formatBookingSummary(booking),
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
      booking: formatBookingSummary(booking),
    };
  }

  // Calculate amount in cents
  const amountInCents = Math.round(Number(booking.total_cost) * 100);
  if (amountInCents <= 0) {
    throw Object.assign(new Error('Invalid booking total'), { status: 400 });
  }

  // Create the PaymentIntent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    metadata: {
      booking_id: booking.id,
      booking_code: booking.booking_code,
      customer_name: `${booking.customers?.first_name} ${booking.customers?.last_name}`,
      vehicle: `${booking.vehicles?.year} ${booking.vehicles?.make} ${booking.vehicles?.model}`,
    },
    receipt_email: booking.customers?.email || undefined,
    description: `Annie's Car Rental — ${booking.booking_code} — ${booking.vehicles?.year} ${booking.vehicles?.make} ${booking.vehicles?.model}`,
  });

  return {
    clientSecret: paymentIntent.client_secret,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    booking: formatBookingSummary(booking),
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

      // Record the payment
      await supabase.from('payments').insert({
        booking_id: bookingId,
        amount: pi.amount / 100,
        payment_type: 'rental',
        method: 'stripe',
        reference_id: pi.id,
        notes: `Stripe payment — ${pi.payment_method_types?.join(', ') || 'card'}`,
      });

      // Update booking deposit status
      await supabase
        .from('bookings')
        .update({
          deposit_status: 'paid',
          deposit_amount: pi.amount / 100,
        })
        .eq('id', bookingId);

      console.log(`[Stripe] Payment succeeded for booking ${pi.metadata.booking_code}: $${pi.amount / 100}`);

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

  // Record the payment
  await supabase.from('payments').insert({
    booking_id: bookingId,
    amount: pi.amount / 100,
    payment_type: 'rental',
    method: 'stripe',
    reference_id: pi.id,
    notes: `Stripe payment — ${pi.payment_method_types?.join(', ') || 'card'}`,
  });

  // Update booking deposit status
  await supabase
    .from('bookings')
    .update({
      deposit_status: 'paid',
      deposit_amount: pi.amount / 100,
    })
    .eq('id', bookingId);

  console.log(`[Stripe] Payment confirmed for booking ${pi.metadata.booking_code}: $${pi.amount / 100}`);

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
function formatBookingSummary(booking) {
  return {
    bookingCode: booking.booking_code,
    status: booking.status,
    customerName: `${booking.customers?.first_name} ${booking.customers?.last_name}`,
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
    taxAmount: Number(booking.tax_amount || 0),
    totalCost: Number(booking.total_cost),
  };
}
