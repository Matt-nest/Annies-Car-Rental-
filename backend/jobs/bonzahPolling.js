/**
 * Bonzah polling job — runs every 15 minutes via Vercel Cron.
 *
 * Bonzah does NOT provide webhooks. We poll to keep our local insurance_status
 * in sync with their authoritative state for two scenarios:
 *
 *   1. Cancellation approvals: we submitted a cancel endorsement (status pending)
 *      and the underwriter has now approved or denied it.
 *   2. External status changes: a Bonzah operator manually edited a policy
 *      in their console (rare but possible).
 *
 * Scope: bookings where bonzah_policy_id IS NOT NULL AND insurance_status NOT IN
 * the terminal set, AND trip_end_date >= now() - 7 days (so we don't pound the
 * API for ancient policies that nobody cares about).
 */

import { supabase } from '../db/supabase.js';
import {
  getPolicyStatus,
  getCompletedEndorsements,
  getSetting,
} from '../services/bonzahService.js';

// Statuses we don't bother re-polling. Anything else is fair game.
const TERMINAL_STATUSES = new Set(['cancelled', 'expired', 'bind_failed']);

// Trip-end cutoff: how far back to keep polling after the rental ended.
const POLL_WINDOW_DAYS = 7;

/**
 * Process one booking — pull live policy status from Bonzah, reconcile.
 * Returns a small object describing what happened (used by the cron handler
 * to assemble a summary for the response).
 */
async function reconcileOne(booking) {
  const result = { booking_code: booking.booking_code, action: 'noop' };

  try {
    // 1. Pull live policy
    const policyRes = await getPolicyStatus(booking.bonzah_policy_id, booking.id);
    const data = policyRes?.data || {};

    // Update last-synced timestamp regardless of whether anything changed —
    // the dashboard uses this to surface stale policies.
    const updatePayload = { bonzah_last_synced_at: new Date().toISOString() };

    // Re-snapshot the coverage info (premiums, limits, deductibles can move
    // if there's been an endorsement). Keep the policy_no fresh too.
    if (data.policy_no && data.policy_no !== booking.bonzah_policy_no) {
      updatePayload.bonzah_policy_no = data.policy_no;
      updatePayload.insurance_policy_number = data.policy_no;
    }
    if (data.coverage_information) {
      updatePayload.bonzah_coverage_json = data.coverage_information;
    }

    // 2. Look at completed endorsements — detects cancellation/extension settlements
    let recentCompletion = null;
    try {
      const endRes = await getCompletedEndorsements(booking.bonzah_policy_id, booking.id);
      const list = Array.isArray(endRes?.data) ? endRes.data : [];
      // Pick the most recent completed endorsement (highest c_ts)
      recentCompletion = list.reduce((latest, e) => {
        if (!latest) return e;
        return (e.c_ts || '') > (latest.c_ts || '') ? e : latest;
      }, null);
    } catch (e) {
      // Non-fatal — continue with policy-level reconciliation
      console.warn(`[Bonzah/poll] endorsement_completed failed for ${booking.booking_code}: ${e.message}`);
    }

    // 3. Decide new insurance_status
    //
    // Bonzah's `data.policy_status` (when present) is authoritative. Otherwise:
    //   - If the most recent completed endorsement is a cancellation → 'cancelled'
    //   - If trip ended > 0 days ago → 'expired'
    //   - Otherwise leave as 'active' (or whatever we had)
    const livePolicyStatus = (data.policy_status || data.status || '').toString().toLowerCase();
    let nextStatus = booking.insurance_status;

    if (livePolicyStatus.includes('cancel')) {
      nextStatus = 'cancelled';
    } else if (livePolicyStatus.includes('expire')) {
      nextStatus = 'expired';
    } else if (recentCompletion && /cancel/i.test(recentCompletion.endorsement_type || recentCompletion.endo_type || '')) {
      nextStatus = 'cancelled';
    } else if (booking.trip_ended_days_ago > 0 && booking.insurance_status === 'active') {
      // Trip is over, no cancel — mark expired so we stop polling next round
      nextStatus = 'expired';
    } else if (booking.insurance_status === 'pending' && data.policy_no) {
      // We thought it was pending but Bonzah issued a policy_no → it's active
      nextStatus = 'active';
    }

    if (nextStatus !== booking.insurance_status) {
      updatePayload.insurance_status = nextStatus;
      result.action = `status: ${booking.insurance_status} → ${nextStatus}`;
    } else {
      result.action = 'synced';
    }

    await supabase.from('bookings').update(updatePayload).eq('id', booking.id);
  } catch (err) {
    result.action = `error: ${err?.message || err}`;
    // Don't update last_synced_at on error — the dashboard "stale" indicator is meaningful
  }

  return result;
}

/**
 * Run the polling pass. Returns { polled, changed, errors, results }.
 * Called by GET /api/v1/cron/bonzah-poll.
 */
export async function runBonzahPolling() {
  // Respect the kill switch — when Bonzah is disabled we don't poll either.
  const enabled = await getSetting('bonzah_enabled', false);
  if (!enabled) {
    return { skipped: true, reason: 'bonzah_enabled=false' };
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - POLL_WINDOW_DAYS);
  const cutoffStr = cutoffDate.toISOString().slice(0, 10);

  const { data: candidates, error } = await supabase
    .from('bookings')
    .select('id, booking_code, bonzah_policy_id, bonzah_policy_no, insurance_status, return_date')
    .not('bonzah_policy_id', 'is', null)
    .gte('return_date', cutoffStr);

  if (error) {
    return { ok: false, error: error.message };
  }

  // Filter out terminal states + decorate with trip_ended_days_ago for status-decision logic
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const polled = (candidates || []).filter(b => !TERMINAL_STATUSES.has(b.insurance_status));
  for (const b of polled) {
    const ret = new Date(`${b.return_date}T12:00:00Z`);
    b.trip_ended_days_ago = Math.floor((today - ret) / (1000 * 60 * 60 * 24));
  }

  const results = [];
  let changed = 0;
  let errors = 0;
  for (const b of polled) {
    const r = await reconcileOne(b);
    results.push(r);
    if (r.action.startsWith('status:')) changed++;
    if (r.action.startsWith('error:')) errors++;
  }

  return {
    ok: true,
    polled: polled.length,
    skipped_terminal: (candidates || []).length - polled.length,
    changed,
    errors,
    results,
    ran_at: new Date().toISOString(),
  };
}
