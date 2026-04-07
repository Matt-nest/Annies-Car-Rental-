import { Router } from 'express';
import { createPaymentIntent, confirmPayment, handleWebhookEvent } from '../services/stripeService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { getStripe } from '../utils/stripe.js';

const router = Router();
const stripe = getStripe();

/**
 * POST /stripe/create-payment-intent
 * Public — authenticated by knowing the booking code (same as the confirm page).
 * Body: { booking_code: "WL43" }
 * Returns: { clientSecret, amount, currency, booking }
 */
router.post('/create-payment-intent', asyncHandler(async (req, res) => {
  const { booking_code } = req.body;
  if (!booking_code) {
    return res.status(400).json({ error: 'booking_code is required' });
  }

  const result = await createPaymentIntent(booking_code);
  res.json(result);
}));

/**
 * POST /stripe/confirm-payment
 * Called by the frontend after payment succeeds.
 * Verifies with Stripe that the payment actually went through,
 * then records it in the database — no webhook needed.
 * Body: { payment_intent_id: "pi_xxx" }
 */
router.post('/confirm-payment', asyncHandler(async (req, res) => {
  const { payment_intent_id } = req.body;
  if (!payment_intent_id) {
    return res.status(400).json({ error: 'payment_intent_id is required' });
  }

  const result = await confirmPayment(payment_intent_id);
  res.json(result);
}));

/**
 * POST /stripe/webhook
 * Stripe sends webhook events here.
 * IMPORTANT: This route must use express.raw() — mounted separately in server.js.
 */
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      console.log('[Stripe Webhook] No STRIPE_WEBHOOK_SECRET set — skipping signature verification (dev mode)');
    }
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook signature verification failed` });
  }

  try {
    await handleWebhookEvent(event);
  } catch (err) {
    console.error('[Stripe Webhook] Error handling event:', err);
  }

  res.json({ received: true });
});

// ── Admin Stripe Management Endpoints ─────────────────────────────────────────

/** GET /stripe/account — Stripe account info for dashboard display */
router.get('/account', requireAuth, asyncHandler(async (req, res) => {
  try {
    const account = await stripe.accounts.retrieve();
    res.json({
      id: account.id,
      business_profile: account.business_profile,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      default_currency: account.default_currency,
      country: account.country,
      created: account.created,
      livemode: !process.env.STRIPE_SECRET_KEY?.startsWith('sk_test'),
    });
  } catch (err) {
    res.json({
      id: 'self',
      charges_enabled: true,
      payouts_enabled: true,
      livemode: !process.env.STRIPE_SECRET_KEY?.startsWith('sk_test'),
      error: err.message,
    });
  }
}));

/** GET /stripe/balance — current Stripe balance */
router.get('/balance', requireAuth, asyncHandler(async (req, res) => {
  const balance = await stripe.balance.retrieve();
  res.json({
    available: balance.available.map(b => ({ amount: b.amount / 100, currency: b.currency })),
    pending: balance.pending.map(b => ({ amount: b.amount / 100, currency: b.currency })),
  });
}));

/** GET /stripe/transactions — recent charges and refunds */
router.get('/transactions', requireAuth, asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 25, 100);
  const startingAfter = req.query.starting_after || undefined;

  const [charges, refunds] = await Promise.all([
    stripe.charges.list({ limit, starting_after: startingAfter }),
    stripe.refunds.list({ limit: 10 }),
  ]);

  const transactions = charges.data.map(c => ({
    id: c.id,
    type: 'charge',
    amount: c.amount / 100,
    currency: c.currency,
    status: c.status,
    description: c.description,
    customer_email: c.receipt_email || c.billing_details?.email,
    payment_method: c.payment_method_details?.type || 'card',
    card_last4: c.payment_method_details?.card?.last4,
    card_brand: c.payment_method_details?.card?.brand,
    booking_code: c.metadata?.booking_code || null,
    booking_id: c.metadata?.booking_id || null,
    refunded: c.refunded,
    amount_refunded: c.amount_refunded / 100,
    created: c.created,
    receipt_url: c.receipt_url,
  }));

  const recentRefunds = refunds.data.map(r => ({
    id: r.id,
    type: 'refund',
    amount: r.amount / 100,
    currency: r.currency,
    status: r.status,
    reason: r.reason,
    charge_id: r.charge,
    created: r.created,
  }));

  res.json({
    transactions,
    refunds: recentRefunds,
    has_more: charges.has_more,
  });
}));

export default router;
