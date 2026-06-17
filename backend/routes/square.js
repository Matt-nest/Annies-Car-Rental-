import { Router } from 'express';
import { WebhooksHelper } from 'square';
import { createPayment, triggerReceiptByPaymentId, handleSquareWebhook, getBookingSummary } from '../services/squareService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { getSquare, getSquareLocationId } from '../utils/square.js';

const router = Router();
const square = getSquare();

/**
 * GET /square/config
 * Public — returns the Web Payments SDK bootstrap config so any client (customer
 * checkout, admin over-the-phone form) initializes against the same Square
 * account/location as the backend's access token.
 */
router.get('/config', (_req, res) => {
  res.json({
    applicationId: process.env.SQUARE_APPLICATION_ID || '',
    locationId: getSquareLocationId(),
    environment: String(process.env.SQUARE_ENVIRONMENT || 'sandbox').toLowerCase() === 'production' ? 'production' : 'sandbox',
  });
});

/**
 * GET /square/booking-summary/:code
 * Public (authenticated by knowing the booking code) — the amount + summary the
 * checkout page renders before tokenizing the card.
 */
router.get('/booking-summary/:code', asyncHandler(async (req, res) => {
  const result = await getBookingSummary(req.params.code);
  res.json(result);
}));

/**
 * POST /square/pay
 * Body: { booking_code, source_token, verification_token?, expected_total_cents? }
 * Charges the card token and records the payment. Replaces the Stripe
 * create-intent → confirm two-step.
 */
router.post('/pay', asyncHandler(async (req, res) => {
  const { booking_code, source_token, verification_token, expected_total_cents } = req.body;
  if (!booking_code || !source_token) {
    return res.status(400).json({ error: 'booking_code and source_token are required' });
  }
  const result = await createPayment(booking_code, {
    sourceToken: source_token,
    verificationToken: verification_token,
    expected_total_cents,
  });
  res.json(result);
}));

/**
 * POST /square/send-receipt
 * Frontend-driven, idempotent receipt dispatch (lock lives in bookings.receipt_sent_at).
 * Body: { payment_id }
 */
router.post('/send-receipt', asyncHandler(async (req, res) => {
  const { payment_id } = req.body;
  if (!payment_id) return res.status(400).json({ error: 'payment_id is required' });
  const result = await triggerReceiptByPaymentId(payment_id);
  res.json(result);
}));

/**
 * POST /square/webhook
 * Square posts payment events here. Mounted with express.raw() in server.js so
 * req.body is the raw Buffer needed for HMAC-SHA256 signature verification.
 */
router.post('/webhook', async (req, res) => {
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  const signature = req.headers['x-square-hmacsha256-signature'];
  const notificationUrl =
    process.env.SQUARE_WEBHOOK_NOTIFICATION_URL ||
    `${req.protocol}://${req.get('host')}${req.originalUrl}`;

  if (!signatureKey) {
    console.error('[Square Webhook] SQUARE_WEBHOOK_SIGNATURE_KEY not configured — rejecting webhook');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '');

  let valid = false;
  try {
    valid = await WebhooksHelper.verifySignature({
      requestBody: rawBody,
      signatureHeader: signature,
      signatureKey,
      notificationUrl,
    });
  } catch (err) {
    console.error('[Square Webhook] Signature verification threw:', err.message);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  if (!valid) {
    console.error('[Square Webhook] Signature verification failed');
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  try {
    await handleSquareWebhook(event);
  } catch (err) {
    console.error('[Square Webhook] Error handling event:', err);
  }

  res.json({ received: true });
});

// ── Admin Square Management Endpoints ─────────────────────────────────────────

/** GET /square/account — location info for dashboard display. */
router.get('/account', requireAuth, asyncHandler(async (_req, res) => {
  const locationId = getSquareLocationId();
  try {
    const resp = await square.locations.get({ locationId });
    const loc = resp.location || {};
    res.json({
      id: loc.id || locationId,
      business_profile: { name: loc.name, support_email: loc.businessEmail },
      charges_enabled: loc.status === 'ACTIVE',
      payouts_enabled: loc.status === 'ACTIVE',
      default_currency: loc.currency || 'USD',
      country: loc.country || 'US',
      livemode: String(process.env.SQUARE_ENVIRONMENT || 'sandbox').toLowerCase() === 'production',
    });
  } catch (err) {
    res.json({
      id: locationId || 'self',
      charges_enabled: true,
      payouts_enabled: true,
      livemode: String(process.env.SQUARE_ENVIRONMENT || 'sandbox').toLowerCase() === 'production',
      error: err?.errors?.[0]?.detail || err.message,
    });
  }
}));

/** GET /square/balance — most recent payouts (Square has no live balance endpoint). */
router.get('/balance', requireAuth, asyncHandler(async (_req, res) => {
  try {
    const locationId = getSquareLocationId();
    const pageable = await square.payouts.list({ locationId, limit: 5 });
    const payouts = [];
    for await (const p of pageable) {
      payouts.push({
        amount: Number(p.amountMoney?.amount || 0) / 100,
        currency: p.amountMoney?.currency || 'USD',
        status: p.status,
      });
      if (payouts.length >= 5) break;
    }
    res.json({ available: [], pending: [], payouts });
  } catch (err) {
    res.json({ available: [], pending: [], payouts: [], error: err?.errors?.[0]?.detail || err.message });
  }
}));

/** GET /square/transactions — recent payments + refunds, mapped to the Stripe-page shape. */
router.get('/transactions', requireAuth, asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 25, 100);
  const locationId = getSquareLocationId();

  const transactions = [];
  const refunds = [];
  try {
    const payPage = await square.payments.list({ locationId, sortField: 'CREATED_AT', sortOrder: 'DESC', limit });
    for await (const p of payPage) {
      transactions.push({
        id: p.id,
        type: 'charge',
        amount: Number(p.amountMoney?.amount || 0) / 100,
        currency: p.amountMoney?.currency || 'USD',
        status: (p.status || '').toLowerCase(),
        description: p.note || null,
        customer_email: p.buyerEmailAddress || null,
        payment_method: p.sourceType?.toLowerCase() || 'card',
        card_last4: p.cardDetails?.card?.last4 || null,
        card_brand: p.cardDetails?.card?.cardBrand || null,
        booking_code: p.referenceId || null,
        booking_id: null,
        refunded: Number(p.refundedMoney?.amount || 0) > 0,
        amount_refunded: Number(p.refundedMoney?.amount || 0) / 100,
        created: p.createdAt ? Math.floor(new Date(p.createdAt).getTime() / 1000) : null,
        receipt_url: p.receiptUrl || null,
      });
      if (transactions.length >= limit) break;
    }
  } catch (err) {
    console.warn('[Square] transactions list failed:', err?.errors?.[0]?.detail || err.message);
  }

  try {
    const refPage = await square.refunds.list({ locationId, sortField: 'CREATED_AT', sortOrder: 'DESC', limit: 10 });
    for await (const r of refPage) {
      refunds.push({
        id: r.id,
        type: 'refund',
        amount: Number(r.amountMoney?.amount || 0) / 100,
        currency: r.amountMoney?.currency || 'USD',
        status: (r.status || '').toLowerCase(),
        reason: r.reason || null,
        charge_id: r.paymentId || null,
        created: r.createdAt ? Math.floor(new Date(r.createdAt).getTime() / 1000) : null,
      });
      if (refunds.length >= 10) break;
    }
  } catch (err) {
    console.warn('[Square] refunds list failed:', err?.errors?.[0]?.detail || err.message);
  }

  res.json({ transactions, refunds, has_more: transactions.length >= limit });
}));

export default router;
