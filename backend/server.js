import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { errorHandler } from './middleware/errorHandler.js';
import vehicleRoutes from './routes/vehicles.js';
import bookingRoutes from './routes/bookings.js';
import customerRoutes from './routes/customers.js';
import paymentRoutes from './routes/payments.js';
import damageRoutes from './routes/damageReports.js';
import stripeRoutes from './routes/stripe.js';
import uploadRoutes from './routes/uploads.js';
import agreementRoutes from './routes/agreements.js';
import statsRoutes from './routes/stats.js';
import searchRoutes from './routes/search.js';
import notificationRoutes from './routes/notifications.js';
import messagingRoutes from './routes/messaging.js';
import cronRoutes from './routes/cron.js';
import { startCronJobs } from './services/cronJobs.js';

const app = express();
const PORT = process.env.API_PORT || 3001;

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());

const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
// Skip JSON parsing for Stripe webhook (needs raw body for signature verification)
app.use((req, res, next) => {
  if (req.path === '/api/v1/stripe/webhook') return next();
  express.json({ limit: '2mb' })(req, res, next);
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/v1/vehicles',   vehicleRoutes);
app.use('/api/v1/bookings',   bookingRoutes);
app.use('/api/v1/customers',  customerRoutes);
app.use('/api/v1/stats',      statsRoutes);
app.use('/api/v1/search',     searchRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/messaging', messagingRoutes);

// Payment routes share /bookings/:id prefix and standalone /payments/:id
app.use('/api/v1', paymentRoutes);

// Damage + blocked-dates share /bookings/:id prefix and standalone routes
app.use('/api/v1', damageRoutes);
app.delete('/api/v1/blocked-dates/:id', damageRoutes);

// Stripe — webhook raw body handler + routes
app.use('/api/v1/stripe/webhook', express.raw({ type: 'application/json' }));
app.use('/api/v1/stripe', stripeRoutes);

// File uploads (ID photos + vehicle images)
app.use('/api/v1/uploads', uploadRoutes);

// Rental agreements (e-sign)
app.use('/api/v1/agreements', agreementRoutes);
app.use('/api/v1/cron', cronRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: `${req.method} ${req.path} not found` }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[API] Running on port ${PORT}`);
  startCronJobs();
});

export default app;
