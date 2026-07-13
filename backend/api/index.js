// Vercel serverless entry point
// Must import dotenv before anything else, but catch errors if it's not available
try { await import('dotenv/config'); } catch (e) {}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { errorHandler } from '../middleware/errorHandler.js';
import vehicleRoutes from '../routes/vehicles.js';
import bookingRoutes from '../routes/bookings.js';
import customerRoutes from '../routes/customers.js';
import paymentRoutes from '../routes/payments.js';
import damageRoutes from '../routes/damageReports.js';
import uploadRoutes from '../routes/uploads.js';
import agreementRoutes from '../routes/agreements.js';
import statsRoutes from '../routes/stats.js';
import cronRoutes from '../routes/cron.js';
import notificationRoutes from '../routes/notifications.js';
import messagingRoutes from '../routes/messaging.js';
import searchRoutes from '../routes/search.js';
import userRoutes from '../routes/users.js';
import depositRoutes from '../routes/deposits.js';
import addonRoutes from '../routes/addons.js';
import checkinRoutes from '../routes/checkin.js';
import incidentalRoutes from '../routes/incidentals.js';
import invoiceRoutes from '../routes/invoices.js';
import tollRoutes from '../routes/tolls.js';
import disputeRoutes from '../routes/disputes.js';
import portalRoutes from '../routes/portal.js';
import monthlyInquiryRoutes from '../routes/monthlyInquiries.js';
import gigApplicationRoutes from '../routes/gigApplications.js';
import reviewRoutes from '../routes/reviews.js';
import pricingRulesRoutes from '../routes/pricingRules.js';
import loyaltyRoutes from '../routes/loyalty.js';
import bonzahRoutes from '../routes/bonzah.js';
import bouncieRoutes from '../routes/bouncie.js';
import bouncieWebhookRoutes from '../routes/bouncieWebhooks.js';
import settingsRoutes from '../routes/settings.js';
import voiceRoutes from '../routes/voice.js';
import pushRoutes from '../routes/push.js';
import brandRoutes from '../routes/brands.js';
import paymentPlanRoutes from '../routes/paymentPlans.js';
import moneyActionRoutes from '../routes/moneyActions.js';
import { isStripeProvider, isSquareProvider } from '../config/paymentProvider.js';

const stripeRoutes = isStripeProvider() ? (await import('../routes/stripe.js')).default : null;
const squareRoutes = isSquareProvider() ? (await import('../routes/square.js')).default : null;

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());

const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    // In production, be lenient — allow all origins but log
    console.warn(`CORS: unexpected origin ${origin}`);
    callback(null, true);
  },
  credentials: true,
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
// Webhooks that need rawBody for HMAC signature verification — must mount
// before the global json parser so they claim the body first.
// 2C: inbound email (Resend/Svix sig). 2D: Crisp chat (Crisp HMAC sig).
app.use('/api/v1/messaging/webhook/inbound-email', express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
  limit: '10mb',
}));
app.use('/api/v1/messaging/webhook/crisp', express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
  limit: '2mb',
}));
// Skip JSON parsing for provider webhooks that need raw body for signature verification.
// Without this guard the global json parser consumes the body before express.raw()
// (mounted below) can claim it, so gateway signature verification fails in production.
app.use((req, res, next) => {
  if (req.path === '/api/v1/stripe/webhook' || req.path === '/api/v1/square/webhook') return next();
  express.json({ limit: '2mb' })(req, res, next);
});
// Twilio webhooks default to application/x-www-form-urlencoded — required for /messaging/webhook/inbound
app.use((req, res, next) => {
  if (req.path === '/api/v1/stripe/webhook' || req.path === '/api/v1/square/webhook') return next();
  express.urlencoded({ extended: false, limit: '1mb' })(req, res, next);
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.get('/api/v1/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/v1/vehicles',   vehicleRoutes);
app.use('/api/v1/bookings',   bookingRoutes);
app.use('/api/v1/customers',  customerRoutes);
app.use('/api/v1/stats',      statsRoutes);
app.use('/api/v1', paymentRoutes);
app.use('/api/v1', damageRoutes);
app.delete('/api/v1/blocked-dates/:id', damageRoutes);
if (stripeRoutes) {
  app.use('/api/v1/stripe/webhook', express.raw({ type: 'application/json' }));
  app.use('/api/v1/stripe', stripeRoutes);
}
if (squareRoutes) {
  app.use('/api/v1/square/webhook', express.raw({ type: 'application/json' }));
  app.use('/api/v1/square', squareRoutes);
}
app.use('/api/v1/uploads', uploadRoutes);
app.use('/api/v1/agreements', agreementRoutes);
app.use('/api/v1/cron', cronRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/messaging', messagingRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/users', userRoutes);

// ── New Routes (Rental Operations) ────────────────────────────────────────────
app.use('/api/v1', depositRoutes);
app.use('/api/v1', addonRoutes);
app.use('/api/v1', checkinRoutes);
app.use('/api/v1', incidentalRoutes);
app.use('/api/v1', invoiceRoutes);
app.use('/api/v1', tollRoutes);
app.use('/api/v1/disputes', disputeRoutes);
app.use('/api/v1/portal', portalRoutes);
app.use('/api/v1/monthly-inquiries', monthlyInquiryRoutes);
app.use('/api/v1/gig-applications', gigApplicationRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/pricing-rules', pricingRulesRoutes);
app.use('/api/v1/loyalty', loyaltyRoutes);
app.use('/api/v1/admin/bonzah', bonzahRoutes);
app.use('/api/v1/admin/bouncie', bouncieRoutes);
app.use('/api/v1/bouncie', bouncieWebhookRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/voice', voiceRoutes);
app.use('/api/v1/push', pushRoutes);
app.use('/api/v1/brands', brandRoutes);
app.use('/api/v1', paymentPlanRoutes);
app.use('/api/v1', moneyActionRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: `${req.method} ${req.path} not found` }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
