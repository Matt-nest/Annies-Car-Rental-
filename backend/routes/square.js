import crypto from 'crypto';
import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireProvider } from '../config/paymentProvider.js';
import { createSquarePayment, confirmSquarePayment, handleSquareWebhookEvent, getSquareBookingSummary } from '../services/squareService.js';

const router = Router();

function verifySquareSignature(req) {
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  const signature = req.headers['x-square-hmacsha256-signature'];
  if (!signatureKey) {
    console.error('[Square Webhook] SQUARE_WEBHOOK_SIGNATURE_KEY not configured');
    return false;
  }
  if (!signature || !req.body) return false;

  const notificationUrl = process.env.SQUARE_WEBHOOK_URL ||
    `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const body = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body);
  const expected = crypto
    .createHmac('sha256', signatureKey)
    .update(notificationUrl + body)
    .digest('base64');

  const left = Buffer.from(String(signature));
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

router.get('/booking-summary/:code', asyncHandler(async (req, res) => {
  requireProvider('square');
  const result = await getSquareBookingSummary(req.params.code);
  res.json(result);
}));

router.post('/create-payment', asyncHandler(async (req, res) => {
  requireProvider('square');
  const { booking_code, source_id, expected_total_cents, idempotency_key } = req.body;
  if (!booking_code) return res.status(400).json({ error: 'booking_code is required' });
  const result = await createSquarePayment(booking_code, { source_id, expected_total_cents, idempotency_key });
  res.json(result);
}));

router.post('/confirm-payment', asyncHandler(async (req, res) => {
  requireProvider('square');
  const { payment_id } = req.body;
  if (!payment_id) return res.status(400).json({ error: 'payment_id is required' });
  const result = await confirmSquarePayment(payment_id);
  res.json(result);
}));

router.post('/webhook', async (req, res) => {
  requireProvider('square');
  if (!verifySquareSignature(req)) {
    return res.status(403).json({ error: 'Invalid Square webhook signature' });
  }

  let event;
  try {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '{}');
    event = JSON.parse(raw);
  } catch {
    return res.status(400).json({ error: 'Invalid webhook payload' });
  }

  try {
    await handleSquareWebhookEvent(event);
  } catch (err) {
    console.error('[Square Webhook] Error handling event:', err);
  }
  res.json({ received: true });
});

router.get('/status', requireAuth, asyncHandler(async (_req, res) => {
  requireProvider('square');
  res.json({
    provider: 'square',
    configured: Boolean(process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID),
    environment: process.env.SQUARE_ENVIRONMENT || 'production',
    location_id: process.env.SQUARE_LOCATION_ID || null,
  });
}));

export default router;
