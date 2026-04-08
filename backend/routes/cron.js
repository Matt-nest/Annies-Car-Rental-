import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { sendNotification, buildBookingPayload } from '../services/outboundService.js';

const router = Router();

// ═══════════════════════════════════════════════════════════════
// Security: Only Vercel Cron or requests with CRON_SECRET can trigger
// ═══════════════════════════════════════════════════════════════
function verifyCron(req, res, next) {
  const isVercelCron = req.headers['user-agent'] === 'vercel-cron/1.0';
  const hasSecret = req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}`;

  if (!isVercelCron && !hasSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.use(verifyCron);

// ─── Helpers ──────────────────────────────────────────────────

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Daily Job: Reminders + Overdue ───────────────────────────

/**
 * GET /cron/daily
 * Runs every day at 9am ET (1pm UTC)
 * - Pickup reminders (pickup_date = tomorrow)
 * - Return reminders (return_date = tomorrow, status = active)
 * - Overdue flags (return_date < today, status = active)
 */
router.get('/daily', async (req, res) => {
  const results = { pickupReminders: 0, returnReminders: 0, overdueFlags: 0, autoDeclined: 0, approvalReminders: 0 };

  try {
    // 1. Pickup reminders
    const { data: pickups } = await supabase
      .from('bookings')
      .select('*, customers(*), vehicles(*)')
      .eq('pickup_date', tomorrow())
      .in('status', ['approved', 'confirmed']);

    for (const b of pickups || []) {
      sendNotification('booking.pickup_reminder', buildBookingPayload(b));
      results.pickupReminders++;
    }

    // 2. Return reminders
    const { data: returns } = await supabase
      .from('bookings')
      .select('*, customers(*), vehicles(*)')
      .eq('return_date', tomorrow())
      .eq('status', 'active');

    for (const b of returns || []) {
      sendNotification('booking.return_reminder', buildBookingPayload(b));
      results.returnReminders++;
    }

    // 3. Overdue returns
    const { data: overdue } = await supabase
      .from('bookings')
      .select('*, customers(*), vehicles(*)')
      .lt('return_date', today())
      .eq('status', 'active');

    for (const b of overdue || []) {
      sendNotification('booking.overdue', buildBookingPayload(b));
      results.overdueFlags++;
    }

    // 4. Auto-expire unapproved bookings (48h+ → decline, 24-48h → remind)
    const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: toDecline } = await supabase
      .from('bookings')
      .select('*, customers(*), vehicles(*)')
      .eq('status', 'pending_approval')
      .lt('created_at', cutoff48h);

    for (const b of toDecline || []) {
      await supabase.from('bookings').update({
        status: 'declined',
        decline_reason: 'No response — booking expired after 48 hours',
        owner_declined_at: new Date().toISOString(),
      }).eq('id', b.id);

      await supabase.from('booking_status_log').insert({
        booking_id: b.id,
        from_status: 'pending_approval',
        to_status: 'declined',
        changed_by: 'system',
        reason: 'Auto-expired after 48 hours with no owner response',
      });

      sendNotification('booking.declined', buildBookingPayload({ ...b, status: 'declined' }));
      results.autoDeclined++;
    }

    const { data: toRemind } = await supabase
      .from('bookings')
      .select('*, customers(*), vehicles(*)')
      .eq('status', 'pending_approval')
      .lt('created_at', cutoff24h)
      .gte('created_at', cutoff48h);

    for (const b of toRemind || []) {
      sendNotification('booking.approval_reminder', buildBookingPayload(b));
      results.approvalReminders++;
    }

    console.log('[CRON/daily]', results);
    res.json({ ok: true, ...results });
  } catch (err) {
    console.error('[CRON/daily] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
