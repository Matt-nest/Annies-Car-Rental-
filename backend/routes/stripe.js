import { Router } from 'express';
import { createPaymentIntent, confirmPayment, handleWebhookEvent } from '../services/stripeService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
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
      // Verify signature in production
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // In dev without webhook secret, parse the body directly
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

  // Always respond 200 to Stripe
  res.json({ received: true });
});

export default router;
