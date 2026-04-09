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
import stripeRoutes from '../routes/stripe.js';
import uploadRoutes from '../routes/uploads.js';
import agreementRoutes from '../routes/agreements.js';
import statsRoutes from '../routes/stats.js';
import cronRoutes from '../routes/cron.js';
import notificationRoutes from '../routes/notifications.js';
import messagingRoutes from '../routes/messaging.js';
import searchRoutes from '../routes/search.js';
import userRoutes from '../routes/users.js';

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
app.use(express.json({ limit: '2mb' }));

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
app.use('/api/v1/stripe/webhook', express.raw({ type: 'application/json' }));
app.use('/api/v1/stripe', stripeRoutes);
app.use('/api/v1/uploads', uploadRoutes);
app.use('/api/v1/agreements', agreementRoutes);
app.use('/api/v1/cron', cronRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/messaging', messagingRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/users', userRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: `${req.method} ${req.path} not found` }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
