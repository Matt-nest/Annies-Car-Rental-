import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validatePaymentPayload } from '../utils/validators.js';
import { getStripe } from '../utils/stripe.js';
import { refundSquarePayment, getSquareRemainingRefundableDollars } from '../services/squareService.js';
import { safeRecordMoneyAction } from '../services/moneyActionAuditService.js';
import { transitionBooking } from '../services/bookingService.js';
import { getPaymentMethodLabel, normalizeDashboardPaymentMethod } from '../utils/paymentMethods.js';

const router = Router();

const COMPLETED_PAYMENT_STATUSES = new Set(['completed', 'paid', 'succeeded']);

async function maybeConfirmBookingAfterRentalPayment(bookingId, changedBy) {
  const [{ data: booking }, { data: agreement }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, status')
      .eq('id', bookingId)
      .maybeSingle(),
    supabase
      .from('rental_agreements')
      .select('id, customer_signed_at')
      .eq('booking_id', bookingId)
      .not('customer_signed_at', 'is', null)
      .maybeSingle(),
  ]);

  if (booking?.status !== 'approved' || !agreement?.customer_signed_at) return null;

  return transitionBooking(bookingId, 'confirmed', {
    changedBy,
    reason: 'Manual rental payment recorded and agreement already signed',
  });
}

async function getStripeRemainingRefundableDollars(stripe, paymentIntentId) {
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (pi.latest_charge) {
    const charge = await stripe.charges.retrieve(pi.latest_charge);
    return Math.max(0, (charge.amount - charge.amount_refunded) / 100);
  }

  const refunds = await stripe.refunds.list({ payment_intent: paymentIntentId, limit: 100 });
  const refunded = (refunds.data || []).reduce((sum, refund) => sum + refund.amount, 0);
  return Math.max(0, (pi.amount - refunded) / 100);
}

/** GET /payments (global list) */
router.get('/payments', requireAuth, asyncHandler(async (req, res) => {
  let query = supabase
    .from('payments')
    .select(`
      *,
      bookings ( booking_code, customers ( first_name, last_name ) )
    `)
    .order('created_at', { ascending: false });

  const limit = parseInt(req.query.limit) || 100;
  const offset = parseInt(req.query.offset) || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  res.json({ data, total: count, limit, offset });
}));

/** GET /bookings/:bookingId/payments */
router.get('/bookings/:bookingId/payments', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('booking_id', req.params.bookingId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  res.json(data);
}));

/** POST /bookings/:bookingId/payments */
router.post('/bookings/:bookingId/payments', requireAuth, requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const errors = validatePaymentPayload(req.body);
  if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });

  const { payment_type, amount, method, reference_id, notes, paid_at } = req.body;
  const normalizedMethod = normalizeDashboardPaymentMethod(method);
  const methodLabel = getPaymentMethodLabel(normalizedMethod);
  const paymentTypeLabel = String(payment_type || 'payment').replace(/_/g, ' ');

  const { data, error } = await supabase
    .from('payments')
    .insert({
      booking_id: req.params.bookingId,
      payment_type,
      amount,
      method: normalizedMethod,
      reference_id,
      notes: notes || `${paymentTypeLabel} recorded via ${methodLabel}`,
      paid_at: paid_at || new Date().toISOString(),
      status: 'completed',
    })
    .select()
    .single();

  if (error) throw error;

  if (payment_type === 'rental' && COMPLETED_PAYMENT_STATUSES.has(data.status)) {
    await maybeConfirmBookingAfterRentalPayment(
      req.params.bookingId,
      req.user?.email || 'admin'
    ).catch(e => console.error('[Manual Payment] Auto-confirm failed:', e.message));
  }

  await safeRecordMoneyAction({
    req,
    actionKey: 'payment_recorded',
    title: `Payment recorded via ${methodLabel}`,
    detail: notes || `${paymentTypeLabel} payment was recorded via ${methodLabel}.`,
    bookingId: req.params.bookingId,
    paymentId: data.id,
    amountCents: Math.round(Number(amount) * 100),
    metadata: {
      payment_type,
      method: normalizedMethod,
      method_label: methodLabel,
      reference_id: reference_id || null,
    },
  });

  res.status(201).json(data);
}));

/** PATCH /payments/:id */
router.patch('/:id', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('payments')
    .update(req.body)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) throw error;
  res.json(data);
}));

/** POST /payments/:id/refund */
router.post('/payments/:id/refund', requireAuth, requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const { amount, reason } = req.body; // absolute scalar amount to refund

  // 1. Fetch original payment
  const { data: payment, error: pErr } = await supabase
    .from('payments')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (pErr || !payment) {
    return res.status(404).json({ error: 'Original payment not found' });
  }

  if (payment.amount <= 0 || payment.payment_type === 'refund') {
    return res.status(400).json({ error: 'Cannot refund a negative amount or an existing refund.' });
  }

  // Check how much has already been refunded
  const { data: childRefunds, error: crErr } = await supabase
    .from('payments')
    .select('amount')
    .eq('booking_id', payment.booking_id)
    .eq('payment_type', 'refund')
    .ilike('notes', `%Refund for payment ${payment.id}%`);

  const totalRefundedSoFar = (childRefunds || []).reduce((acc, curr) => acc + Math.abs(curr.amount), 0);
  const remaining = payment.amount - totalRefundedSoFar;
  let maxRefundable = remaining;

  const refundTarget = Number(amount) || remaining;

  let fullNotes = `Refund for payment ${payment.id}`;
  if (reason) fullNotes += ` - Reason: ${reason}`;

  let finalStripeRefundId = null;

  // 2. Issue Stripe refund if applicable
  if (payment.method === 'stripe' && payment.reference_id && payment.reference_id.startsWith('pi_')) {
    const stripe = getStripe();
    try {
      const stripeRemaining = await getStripeRemainingRefundableDollars(stripe, payment.reference_id);
      maxRefundable = Math.min(remaining, stripeRemaining);
      if (refundTarget <= 0 || refundTarget > maxRefundable) {
        return res.status(400).json({ error: `Invalid refund amount. Maximum available is $${maxRefundable.toFixed(2)}.` });
      }
      const stripeRefund = await stripe.refunds.create({
        payment_intent: payment.reference_id,
        amount: Math.round(refundTarget * 100), // Stripe expects cents
        reason: reason === 'fraudulent' ? 'fraudulent' : (reason === 'duplicate' ? 'duplicate' : 'requested_by_customer')
      });
      finalStripeRefundId = stripeRefund.id;
      fullNotes += ` (Stripe Request: ${stripeRefund.id}; PI: ${payment.reference_id})`;
    } catch (e) {
      console.error('[Stripe Refund Error]', e);
      return res.status(500).json({ error: `Stripe Refund Failed: ${e.message}` });
    }
  } else if (payment.method === 'square' && payment.reference_id) {
    try {
      const squareRemaining = await getSquareRemainingRefundableDollars(payment.reference_id);
      maxRefundable = Math.min(remaining, squareRemaining);
      if (refundTarget <= 0 || refundTarget > maxRefundable) {
        return res.status(400).json({ error: `Invalid refund amount. Maximum available is $${maxRefundable.toFixed(2)}.` });
      }
      const squareRefund = await refundSquarePayment({
        paymentId: payment.reference_id,
        amountDollars: refundTarget,
        reason,
      });
      finalStripeRefundId = squareRefund?.id;
      fullNotes += ` (Square Refund: ${squareRefund?.id}; Square Payment: ${payment.reference_id})`;
    } catch (e) {
      console.error('[Square Refund Error]', e);
      return res.status(e.status || 500).json({ error: `Square Refund Failed: ${e.message}` });
    }
  } else if (refundTarget <= 0 || refundTarget > maxRefundable) {
    return res.status(400).json({ error: `Invalid refund amount. Maximum available is $${maxRefundable.toFixed(2)}.` });
  }

  // 3. Create negative ledger entry
  const { data: newRefund, error: insertErr } = await supabase
    .from('payments')
    .insert({
      booking_id: payment.booking_id,
      payment_type: 'refund',
      amount: -Math.abs(refundTarget), // store as negative
      method: payment.method,
      reference_id: finalStripeRefundId || `manual_refund_${Date.now()}`,
      notes: fullNotes,
      status: 'completed',
      paid_at: new Date().toISOString()
    })
    .select()
    .single();

  if (insertErr) {
    console.error('[Refund DB Insert Error]', insertErr);
    return res.status(500).json({ error: 'Gateway hit but database ledger failed.' });
  }

  // 4. Keep deposit tracking in sync only when the refunded ledger row is the deposit.
  if (payment.payment_type === 'deposit') {
    const totalRefunded = totalRefundedSoFar + refundTarget;
    const depositStatus = totalRefunded >= payment.amount ? 'refunded' : 'partial_refund';
    await supabase
      .from('booking_deposits')
      .update({
        status: depositStatus,
        refund_amount: Math.round(totalRefunded * 100),
        refunded_at: new Date().toISOString(),
        refunded_by: req.user?.email || 'admin',
      })
      .eq('booking_id', payment.booking_id);

    if (depositStatus === 'refunded') {
      await supabase
        .from('bookings')
        .update({ deposit_status: 'refunded' })
        .eq('id', payment.booking_id);
    }
  }

  await safeRecordMoneyAction({
    req,
    actionKey: 'payment_refund_issued',
    title: `${payment.method === 'square' ? 'Square' : payment.method === 'stripe' ? 'Stripe' : 'Manual'} refund issued`,
    detail: reason ? `Reason: ${reason}` : 'Refund issued from payment ledger.',
    bookingId: payment.booking_id,
    paymentId: newRefund.id,
    amountCents: Math.round(refundTarget * 100),
    metadata: {
      original_payment_id: payment.id,
      original_reference_id: payment.reference_id,
      refund_reference_id: newRefund.reference_id,
      method: payment.method,
      reason: reason || null,
      subject: payment.booking_id,
    },
  });

  res.status(201).json({ success: true, refund: newRefund });
}));

export default router;
