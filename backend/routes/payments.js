import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validatePaymentPayload } from '../utils/validators.js';
import { getStripe } from '../utils/stripe.js';

const router = Router();

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
router.post('/bookings/:bookingId/payments', requireAuth, asyncHandler(async (req, res) => {
  const errors = validatePaymentPayload(req.body);
  if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });

  const { payment_type, amount, method, reference_id, notes, paid_at } = req.body;

  const { data, error } = await supabase
    .from('payments')
    .insert({
      booking_id: req.params.bookingId,
      payment_type,
      amount,
      method,
      reference_id,
      notes,
      paid_at: paid_at || new Date().toISOString(),
      status: 'completed',
    })
    .select()
    .single();

  if (error) throw error;
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
router.post('/payments/:id/refund', requireAuth, asyncHandler(async (req, res) => {
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

  const refundTarget = Number(amount) || remaining;
  if (refundTarget <= 0 || refundTarget > remaining) {
    return res.status(400).json({ error: `Invalid refund amount. Maximum available is $${remaining.toFixed(2)}.` });
  }

  let fullNotes = `Refund for payment ${payment.id}`;
  if (reason) fullNotes += ` - Reason: ${reason}`;

  let finalStripeRefundId = null;

  // 2. Issue Stripe refund if applicable
  if (payment.method === 'stripe' && payment.reference_id && payment.reference_id.startsWith('pi_')) {
    const stripe = getStripe();
    try {
      const stripeRefund = await stripe.refunds.create({
        payment_intent: payment.reference_id,
        amount: Math.round(refundTarget * 100), // Stripe expects cents
        reason: reason === 'fraudulent' ? 'fraudulent' : (reason === 'duplicate' ? 'duplicate' : 'requested_by_customer')
      });
      finalStripeRefundId = stripeRefund.id;
      fullNotes += ` (Stripe Request: ${stripeRefund.id})`;
    } catch (e) {
      console.error('[Stripe Refund Error]', e);
      return res.status(500).json({ error: `Stripe Refund Failed: ${e.message}` });
    }
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

  // 4. If full originally deposit, update booking status IF remaining becomes 0
  if (payment.payment_type === 'rental' || payment.payment_type === 'deposit') {
    if (refundTarget === remaining && totalRefundedSoFar + refundTarget === payment.amount) {
      await supabase
        .from('bookings')
        .update({ deposit_status: 'refunded' })
        .eq('id', payment.booking_id);
    }
  }

  res.status(201).json({ success: true, refund: newRefund });
}));

export default router;
