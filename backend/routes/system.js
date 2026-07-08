import express from 'express';
import { supabase } from '../db/supabase.js';
import { getStripe } from '../utils/stripe.js';
import { squareRequest } from '../utils/square.js';
import { PAYMENT_PROVIDER, isStripeProvider, isSquareProvider } from '../config/paymentProvider.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { purgeTestCustomers } from '../services/testDataPurgeService.js';

const router = express.Router();

/**
 * GET /system/health — deep health check.
 *
 * Verifies downstream dependencies and reports which integrations
 * are configured (without exposing actual secrets).
 */
router.get('/health', async (req, res) => {
  const checks = {};
  const start = Date.now();

  // 1. Supabase connectivity
  try {
    const { data, error } = await supabase.from('vehicles').select('id').limit(1);
    checks.database = error ? { status: 'error', error: error.message } : { status: 'ok' };
  } catch (err) {
    checks.database = { status: 'error', error: err.message };
  }

  // 2. Integration presence (configured vs not — no secret values exposed)
  checks.integrations = {
    payment_provider: PAYMENT_PROVIDER,
    square:       !!process.env.SQUARE_ACCESS_TOKEN && !!process.env.SQUARE_LOCATION_ID,
    square_webhook: !!process.env.SQUARE_WEBHOOK_SIGNATURE_KEY,
    stripe:       !!process.env.STRIPE_SECRET_KEY,
    stripe_webhook: !!process.env.STRIPE_WEBHOOK_SECRET,
    supabase:     !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_KEY,
    resend:       !!process.env.RESEND_API_KEY,
    resend_webhook: !!process.env.RESEND_WEBHOOK_SECRET,
    twilio:       !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN,
    bonzah:       !!process.env.BONZAH_API_BASE_URL && !!process.env.BONZAH_EMAIL,
    bouncie:      !!process.env.BOUNCIE_CLIENT_ID,
    crisp:        !!process.env.CRISP_WEBHOOK_SECRET,
    cron:         !!process.env.CRON_SECRET,
    portal_auth:  !!process.env.PORTAL_JWT_SECRET,
  };

  // 3. Payment API reachability
  if (isStripeProvider() && checks.integrations.stripe) {
    try {
      const stripe = getStripe();
      await stripe.balance.retrieve();
      checks.payment_processor = { provider: 'stripe', status: 'ok' };
    } catch (err) {
      checks.payment_processor = { provider: 'stripe', status: 'error', error: err.message };
    }
  } else if (isSquareProvider() && checks.integrations.square) {
    try {
      await squareRequest('/v2/locations');
      checks.payment_processor = { provider: 'square', status: 'ok' };
    } catch (err) {
      checks.payment_processor = { provider: 'square', status: 'error', error: err.message };
    }
  } else {
    checks.payment_processor = { provider: PAYMENT_PROVIDER, status: 'not_configured' };
  }

  // Overall status
  const hasError = checks.database?.status === 'error' || checks.payment_processor?.status === 'error';

  const statusCode = hasError ? 503 : 200;
  res.status(statusCode).json({
    status: hasError ? 'degraded' : 'operational',
    timestamp: new Date().toISOString(),
    latency_ms: Date.now() - start,
    environment: process.env.NODE_ENV || 'development',
    checks,
  });
});

/**
 * POST /system/purge-test-data — owner-only cleanup of test customers/bookings.
 * Runs against whatever Supabase project the API is connected to; service layer
 * refuses unless project ref is Annie's (yrerxvuyeglrypeufjpy).
 */
router.post('/purge-test-data', requireAuth, requireRole('owner'), asyncHandler(async (req, res) => {
  const result = await purgeTestCustomers();
  res.json({ success: true, ...result });
}));

export default router;
