import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { sendBookingNotification, buildBookingPayload } from '../services/notifyService.js';
import { sendTeamAlertAsync, TEAM_ALERT_EVENTS } from '../services/teamAlertService.js';
import { transitionBooking } from '../services/bookingService.js';

const router = Router();

// ═══════════════════════════════════════════════════════════════
// Security: Only requests with valid CRON_SECRET can trigger
// Vercel Cron auto-sends Authorization: Bearer <CRON_SECRET>
// ═══════════════════════════════════════════════════════════════
function verifyCron(req, res, next) {
  const hasSecret = req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}`;
  if (!hasSecret) {
    return res.status(401).json({ error: 'Unauthorized — valid CRON_SECRET required' });
  }
  next();
}

router.use(verifyCron);

// ─── Helpers ──────────────────────────────────────────────────

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Phase 2: timing externalization (feature-flagged) ───────────
//
// When FEATURE_TIMELINE_TIMING=true, each cron stage reads its anchor +
// offset + status filter from email_templates (migration 020). When off
// (default) OR when the DB row is missing / out-of-bounds, getTimingForStage
// returns the hardcoded default below — which mirrors the original cron
// queries byte-for-byte. Sanity bounds: offset must be within [-7d, +30d],
// matching the DB CHECK constraint in migration 020.
//
// Flip the flag in Vercel → backend env to enable admin-editable timing.
const FEATURE_TIMELINE_TIMING = process.env.FEATURE_TIMELINE_TIMING === 'true';

const STAGE_DEFAULTS = {
  pickup_reminder:        { anchor: 'pickup_date', offset_minutes: -1440, status_filter: ['approved','confirmed','ready_for_pickup'] },
  day_of_pickup:          { anchor: 'pickup_date', offset_minutes: 0,     status_filter: ['approved','confirmed','ready_for_pickup'] },
  mid_rental_checkin:     { anchor: 'pickup_date', offset_minutes: 2880,  status_filter: ['active'] },
  extension_offer:        { anchor: 'return_date', offset_minutes: -1440, status_filter: ['active'] },
  return_reminder:        { anchor: 'return_date', offset_minutes: -1440, status_filter: ['active'] },
  day_of_return:          { anchor: 'return_date', offset_minutes: 0,     status_filter: ['active'] },
  late_return_escalation: { anchor: 'return_date', offset_minutes: 5760,  status_filter: ['active'] },
  rental_completed:       { anchor: 'return_date', offset_minutes: 1440,  status_filter: ['completed'] },
  repeat_customer:        { anchor: 'return_date', offset_minutes: 43200, status_filter: ['completed'] },
};

async function getTimingForStage(stage) {
  const fallback = STAGE_DEFAULTS[stage];
  if (!fallback) return null;                  // Unknown stage — caller decides
  if (!FEATURE_TIMELINE_TIMING) return fallback;

  try {
    const { data, error } = await supabase
      .from('email_templates')
      .select('trigger_anchor, trigger_offset_minutes, trigger_status_filter')
      .eq('stage', stage)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) return fallback;

    const offset = data.trigger_offset_minutes;
    // Sanity gate — same bounds as the DB CHECK constraint.
    if (typeof offset !== 'number' || offset < -10080 || offset > 43200) {
      console.warn(`[CRON] Offset out of bounds for ${stage} (${offset}) — using fallback`);
      return fallback;
    }
    if (!data.trigger_anchor) {
      console.warn(`[CRON] Missing trigger_anchor for ${stage} — using fallback`);
      return fallback;
    }
    if (!Array.isArray(data.trigger_status_filter) || data.trigger_status_filter.length === 0) {
      console.warn(`[CRON] Missing trigger_status_filter for ${stage} — using fallback`);
      return fallback;
    }
    return {
      anchor: data.trigger_anchor,
      offset_minutes: offset,
      status_filter: data.trigger_status_filter,
    };
  } catch (err) {
    console.warn(`[CRON] getTimingForStage(${stage}) threw, using fallback:`, err.message);
    return fallback;
  }
}

// Convert an offset (anchor_time - now, in minutes) to a YYYY-MM-DD target
// date for SQL date-equality matching. Verified equivalent for the cases we
// care about:
//   offset = -1440 → today + 1 = tomorrow()
//   offset = 0     → today()
//   offset = +1440 → today - 1 = daysAgo(1)
//   offset = +43200 → today - 30 = daysAgo(30)
function dateForOffset(offsetMinutes) {
  const daysOffset = -Math.round(offsetMinutes / 1440);
  const target = new Date();
  target.setDate(target.getDate() + daysOffset);
  return target.toISOString().slice(0, 10);
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
  const results = {
    pickupReminders: 0, returnReminders: 0, overdueFlags: 0,
    autoDeclined: 0, paymentReminders: 0,
    midRentalCheckins: 0, extensionOffers: 0,
    reviewRequests: 0, repeatCustomers: 0, lateEscalations: 0,
    autoNoShows: 0,
  };

  try {
    // 1. Pickup reminders
    const pickupCfg = await getTimingForStage('pickup_reminder');
    const { data: pickups } = await supabase
      .from('bookings')
      .select('*, customers(*), vehicles(*)')
      .eq(pickupCfg.anchor, dateForOffset(pickupCfg.offset_minutes))
      .in('status', pickupCfg.status_filter);

    for (const b of pickups || []) {
      // Fetch admin's handoff record to include vehicle condition in the reminder
      const { data: prepRecord } = await supabase
        .from('checkin_records')
        .select('*')
        .eq('booking_id', b.id)
        .eq('record_type', 'admin_prep')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      sendBookingNotification('pickup_reminder', buildBookingPayload(b, { handoffRecord: prepRecord }));
      results.pickupReminders++;
    }

    // 2. Return reminders
    const returnCfg = await getTimingForStage('return_reminder');
    const { data: returns } = await supabase
      .from('bookings')
      .select('*, customers(*), vehicles(*)')
      .eq(returnCfg.anchor, dateForOffset(returnCfg.offset_minutes))
      .in('status', returnCfg.status_filter);

    for (const b of returns || []) {
      sendBookingNotification('return_reminder', buildBookingPayload(b));
      results.returnReminders++;
    }

    // 3. Overdue returns — late_return_warning fires once on the first overdue
    // day only (return_date = yesterday). Daily re-nags are handled by
    // late_return_escalation after 4 days. Idempotency is per calendar day.
    const { data: overdue } = await supabase
      .from('bookings')
      .select('*, customers(*), vehicles(*)')
      .eq('return_date', daysAgo(1))
      .eq('status', 'active');

    for (const b of overdue || []) {
      sendBookingNotification('late_return_warning', buildBookingPayload(b));
      sendTeamAlertAsync(TEAM_ALERT_EVENTS.LATE_RETURN, { booking: b, hoursLate: 1 });
      results.overdueFlags++;
    }

    // 4. Auto-expire APPROVED-but-unpaid bookings — the payment deadline.
    // The 48h clock starts when the booking is approved and the payment link is
    // sent (owner_approved_at), NOT at submission: pending_approval bookings now
    // wait on the admin indefinitely (admin owns clearing stale requests). A
    // paid booking has already moved to 'confirmed', so status='approved' means
    // the payment link was never completed.
    const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: toDecline } = await supabase
      .from('bookings')
      .select('*, customers(*), vehicles(*)')
      .eq('status', 'approved')
      .lt('owner_approved_at', cutoff48h);

    for (const b of toDecline || []) {
      // Safety: never expire a booking that has actually been paid (guards
      // against a webhook that recorded the payment but failed to transition
      // the booking to 'confirmed').
      const { data: paid } = await supabase
        .from('payments')
        .select('id')
        .eq('booking_id', b.id)
        .eq('payment_type', 'rental')
        .eq('status', 'completed')
        .maybeSingle();
      if (paid) continue;

      await supabase.from('bookings').update({
        status: 'declined',
        decline_reason: 'Payment not completed — booking expired 48 hours after approval',
        owner_declined_at: new Date().toISOString(),
      }).eq('id', b.id);

      await supabase.from('booking_status_log').insert({
        booking_id: b.id,
        from_status: 'approved',
        to_status: 'declined',
        changed_by: 'system',
        reason: 'Auto-expired 48 hours after approval with no completed payment',
      });

      sendBookingNotification('booking_declined', buildBookingPayload({ ...b, status: 'declined' }));
      results.autoDeclined++;
    }

    const { data: toRemind } = await supabase
      .from('bookings')
      .select('*, customers(*), vehicles(*)')
      .eq('status', 'approved')
      .lt('owner_approved_at', cutoff24h)
      .gte('owner_approved_at', cutoff48h);

    for (const b of toRemind || []) {
      const { data: paid } = await supabase
        .from('payments')
        .select('id')
        .eq('booking_id', b.id)
        .eq('payment_type', 'rental')
        .eq('status', 'completed')
        .maybeSingle();
      if (paid) continue;

      sendBookingNotification('payment_reminder', buildBookingPayload(b));
      results.paymentReminders++;
    }

    // 5. Mid-rental check-in
    const midCfg = await getTimingForStage('mid_rental_checkin');
    const { data: midRentals } = await supabase
      .from('bookings')
      .select('*, customers(*), vehicles(*)')
      .eq(midCfg.anchor, dateForOffset(midCfg.offset_minutes))
      .in('status', midCfg.status_filter);

    for (const b of midRentals || []) {
      sendBookingNotification('mid_rental_checkin', buildBookingPayload(b));
      results.midRentalCheckins++;
    }

    // 6. Extension offer — fires at timing offset, restricted to rentals ≥ 3 days
    // (avoids 1-2 day annoyance). The rental_days filter stays hardcoded in
    // Phase 2 — it's a business rule, not a timing knob.
    const extCfg = await getTimingForStage('extension_offer');
    const { data: extCandidates } = await supabase
      .from('bookings')
      .select('*, customers(*), vehicles(*)')
      .eq(extCfg.anchor, dateForOffset(extCfg.offset_minutes))
      .in('status', extCfg.status_filter)
      .gte('rental_days', 3);

    for (const b of extCandidates || []) {
      sendBookingNotification('extension_offer', buildBookingPayload(b));
      results.extensionOffers++;
    }

    // 7. Review request (rental_completed) — fires day after return
    const reviewCfg = await getTimingForStage('rental_completed');
    const { data: completedYesterday } = await supabase
      .from('bookings')
      .select('*, customers(*), vehicles(*)')
      .eq(reviewCfg.anchor, dateForOffset(reviewCfg.offset_minutes))
      .in('status', reviewCfg.status_filter);

    for (const b of completedYesterday || []) {
      sendBookingNotification('rental_completed', buildBookingPayload(b));
      results.reviewRequests++;
    }

    // 8. Repeat customer loyalty
    const repeatCfg = await getTimingForStage('repeat_customer');
    const { data: repeatCandidates } = await supabase
      .from('bookings')
      .select('*, customers(*), vehicles(*)')
      .eq(repeatCfg.anchor, dateForOffset(repeatCfg.offset_minutes))
      .in('status', repeatCfg.status_filter);

    for (const b of repeatCandidates || []) {
      sendBookingNotification('repeat_customer', buildBookingPayload(b));
      results.repeatCustomers++;
    }

    // 9. Late return escalation
    const escalateCfg = await getTimingForStage('late_return_escalation');
    const { data: escalated } = await supabase
      .from('bookings')
      .select('*, customers(*), vehicles(*)')
      .eq(escalateCfg.anchor, dateForOffset(escalateCfg.offset_minutes))
      .in('status', escalateCfg.status_filter);

    for (const b of escalated || []) {
      sendBookingNotification('late_return_escalation', buildBookingPayload(b));
      results.lateEscalations++;
    }

    // 10. Auto no-show — customer never picked up the car.
    // Bookings sit at approved/confirmed/ready_for_pickup with actual_pickup_at
    // null and pickup_date >= 1 day in the past. Without this, ghosted customers
    // would silently block the calendar through their booked return_date.
    // transitionBooking applies the layer-1 invariant from migration 010 — sets
    // actual_return_at and clamps return_date — so the calendar frees the moment
    // we no-show.
    const noShowCutoff = daysAgo(1);
    const { data: ghosted } = await supabase
      .from('bookings')
      .select('id, booking_code, status, pickup_date')
      .in('status', ['approved', 'confirmed', 'ready_for_pickup'])
      .is('actual_pickup_at', null)
      .lte('pickup_date', noShowCutoff);

    for (const b of ghosted || []) {
      try {
        await transitionBooking(b.id, 'no_show', {
          changedBy: 'system',
          reason: `Auto no-show — pickup_date ${b.pickup_date} elapsed with no actual_pickup_at recorded`,
        });
        results.autoNoShows++;
      } catch (e) {
        console.error(`[CRON/daily] auto-no-show failed for ${b.booking_code}:`, e.message);
      }
    }

    // Process pending overage charges whose 48h dispute window has closed.
    // No-op when FEATURE_AUTO_OVERAGE_CHARGES is off.
    try {
      const { processDueOverageCharges } = await import('../services/cardOnFileService.js');
      const overage = await processDueOverageCharges();
      results.overageCharges = overage;
    } catch (e) {
      console.error('[CRON/daily] processDueOverageCharges failed:', e.message);
      results.overageCharges = { error: e.message };
    }

    console.log('[CRON/daily]', results);
    res.json({ ok: true, ...results });
  } catch (err) {
    console.error('[CRON/daily] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /cron/morning — runs early in the day (Vercel cron @ 11:00 UTC = 7am EDT).
 * Sends day-of reminders that should land before the customer leaves the house.
 * F-4: wires day_of_pickup + day_of_return per Phase 1 audit decision.
 *
 * Idempotency: relies on notification_log (booking_code, stage, today) — manual
 * cron replays won't re-text the customer.
 */
router.get('/morning', async (req, res) => {
  const results = { dayOfPickups: 0, dayOfReturns: 0 };
  try {
    // 1. Day-of pickup
    const dopCfg = await getTimingForStage('day_of_pickup');
    const { data: pickups } = await supabase
      .from('bookings')
      .select('*, customers(*), vehicles(*)')
      .eq(dopCfg.anchor, dateForOffset(dopCfg.offset_minutes))
      .in('status', dopCfg.status_filter);

    for (const b of pickups || []) {
      sendBookingNotification('day_of_pickup', buildBookingPayload(b));
      results.dayOfPickups++;
    }

    // 2. Day-of return
    const dorCfg = await getTimingForStage('day_of_return');
    const { data: returns } = await supabase
      .from('bookings')
      .select('*, customers(*), vehicles(*)')
      .eq(dorCfg.anchor, dateForOffset(dorCfg.offset_minutes))
      .in('status', dorCfg.status_filter);

    for (const b of returns || []) {
      sendBookingNotification('day_of_return', buildBookingPayload(b));
      results.dayOfReturns++;
    }

    console.log('[CRON/morning]', results);
    res.json({ ok: true, ...results });
  } catch (err) {
    console.error('[CRON/morning] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /cron/process-overage-charges — runs more frequently than the daily cron
 * (e.g. hourly via Vercel Cron) so overage charges fire within the hour after
 * their dispute window closes rather than waiting up to 24h.
 * No-op when FEATURE_AUTO_OVERAGE_CHARGES is off.
 */
router.get('/process-overage-charges', async (req, res) => {
  try {
    const { processDueOverageCharges } = await import('../services/cardOnFileService.js');
    const result = await processDueOverageCharges();
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[CRON/overage] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /cron/bonzah-poll — every 15 min via Vercel Cron.
 * Bonzah has no webhooks; this reconciles insurance_status against /Bonzah/policy
 * and /Bonzah/endorsement_completed. No-op when bonzah_enabled=false.
 */
router.get('/bonzah-poll', async (req, res) => {
  try {
    const { runBonzahPolling } = await import('../jobs/bonzahPolling.js');
    const result = await runBonzahPolling();
    console.log('[CRON/bonzah-poll]', result);
    res.json(result);
  } catch (err) {
    console.error('[CRON/bonzah-poll] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
