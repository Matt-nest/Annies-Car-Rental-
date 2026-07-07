/**
 * Team SMS alerts — concise internal notifications for admin-configured phones.
 *
 * Config lives on business_settings (migration 027):
 *   team_alerts_enabled  — master toggle
 *   team_alert_phones    — JSON array, max 4 E.164 numbers
 *
 * Sends bypass quiet hours via sendSMS({ source: 'manual' }).
 */

import { supabase } from '../db/supabase.js';
import { sendSMS } from './notifyService.js';
import brand from '../config/brand.js';

export const TEAM_ALERT_EVENTS = {
  NEW_BOOKING: 'new_booking',
  PAYMENT_RECEIVED: 'payment_received',
  AGREEMENT_PENDING: 'agreement_pending',
  VEHICLE_RETURNED: 'vehicle_returned',
  LATE_RETURN: 'late_return',
  DAMAGE_REPORT: 'damage_report',
  INSURANCE_REVIEW: 'insurance_review',
};

const MAX_PHONES = 4;
const E164_RE = /^\+1\d{10}$/;

/** Short brand label for SMS — drop trailing "Cars" etc. to save chars. */
function shortBrand() {
  return (brand.name || 'Admin').replace(/\s+(Cars|Car Rental)$/i, '').trim() || brand.name;
}

function fmtMoney(val) {
  if (val == null || val === '') return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(n)) return null;
  return n % 1 === 0 ? `$${n.toFixed(0)}` : `$${n.toFixed(2)}`;
}

function fmtPhoneDisplay(phone) {
  const digits = String(phone || '').replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return phone || '';
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function fmtShortDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
}

function fmtVehicle(booking) {
  const v = booking?.vehicles || booking?.vehicle || {};
  if (v.year && v.make) return `${v.year} ${v.make}${v.model ? ` ${v.model}` : ''}`.trim();
  return null;
}

function fmtAddons(booking) {
  const addons = [];
  if (booking?.unlimited_miles) addons.push('unlimited mi');
  if (booking?.unlimited_tolls) addons.push('tolls');
  if (booking?.mileage_addon_fee) addons.push('mileage pkg');
  if (booking?.toll_addon_fee) addons.push('toll pkg');
  return addons.length ? addons.join(', ') : null;
}

function customerFirst(booking) {
  const c = booking?.customers || booking?.customer || {};
  return c.first_name || 'Guest';
}

function nextStep(suffix) {
  return brand.dashboardUrl ? ` Next: ${suffix} in dashboard.` : ` Next: ${suffix}.`;
}

/**
 * Build the SMS body for a team alert event. Exported for tests.
 *
 * @param {string} event — TEAM_ALERT_EVENTS value
 * @param {object} ctx — { booking, amount, severity, ... }
 */
export function formatTeamAlertMessage(event, ctx = {}) {
  const b = ctx.booking || ctx;
  const code = b.booking_code || ctx.booking_code || '';
  const tag = shortBrand();

  switch (event) {
    case TEAM_ALERT_EVENTS.NEW_BOOKING: {
      const first = customerFirst(b);
      const phone = fmtPhoneDisplay(b.customers?.phone || b.customer?.phone);
      const vehicle = fmtVehicle(b) || 'Vehicle TBD';
      const dates = `${fmtShortDate(b.pickup_date)}–${fmtShortDate(b.return_date)}`;
      const rate = b.daily_rate != null ? `$${Number(b.daily_rate).toFixed(0)}/day` : '';
      const addons = fmtAddons(b);
      const total = fmtMoney(b.total_cost) || '';
      const parts = [
        `${tag}: New booking ${code} — pending approval.`,
        `${first}, ${phone}.`,
        `${vehicle}, ${dates}.`,
        rate,
        addons ? `Add-ons: ${addons}.` : null,
        total ? `Total ${total}.` : null,
      ].filter(Boolean);
      return parts.join(' ') + nextStep('review & approve');
    }

    case TEAM_ALERT_EVENTS.PAYMENT_RECEIVED: {
      const amount = fmtMoney(ctx.amount) || fmtMoney(b.total_cost) || '';
      const first = customerFirst(b);
      return `${tag}: Payment ${amount} received for ${code} (${first}).${nextStep('prep vehicle')}`;
    }

    case TEAM_ALERT_EVENTS.AGREEMENT_PENDING: {
      const first = customerFirst(b);
      return `${tag}: ${first} signed the rental agreement for ${code}.${nextStep('counter-sign')}`;
    }

    case TEAM_ALERT_EVENTS.VEHICLE_RETURNED: {
      const first = customerFirst(b);
      const vehicle = fmtVehicle(b) || 'vehicle';
      return `${tag}: ${code} returned — ${first}'s ${vehicle}.${nextStep('inspect & close out')}`;
    }

    case TEAM_ALERT_EVENTS.LATE_RETURN: {
      const first = customerFirst(b);
      const hours = ctx.hoursLate != null ? `${ctx.hoursLate}hr` : '1hr';
      return `${tag}: ${code} is ${hours} late (${first}).${nextStep('contact renter')}`;
    }

    case TEAM_ALERT_EVENTS.DAMAGE_REPORT: {
      const severity = ctx.severity || 'reported';
      return `${tag}: ${severity} damage on ${code}.${nextStep('review report')}`;
    }

    case TEAM_ALERT_EVENTS.INSURANCE_REVIEW: {
      const first = customerFirst(b);
      return `${tag}: Own insurance submitted for ${code} (${first}).${nextStep('review & approve')}`;
    }

    default:
      return null;
  }
}

/** Normalize and validate team alert phone list (max 4 E.164 US numbers). */
export function normalizeTeamAlertPhones(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const entry of raw) {
    if (out.length >= MAX_PHONES) break;
    const phone = typeof entry === 'string' ? entry : entry?.phone;
    if (!phone || !E164_RE.test(phone)) continue;
    if (!out.includes(phone)) out.push(phone);
  }
  return out;
}

async function loadTeamAlertConfig() {
  try {
    const { data, error } = await supabase
      .from('business_settings')
      .select('team_alerts_enabled, team_alert_phones')
      .eq('id', 1)
      .single();
    if (error || !data) return { enabled: false, phones: [] };
    return {
      enabled: !!data.team_alerts_enabled,
      phones: normalizeTeamAlertPhones(data.team_alert_phones),
    };
  } catch (err) {
    console.warn('[TeamAlert] settings lookup failed:', err.message);
    return { enabled: false, phones: [] };
  }
}

/**
 * Fan out a team SMS alert. Fire-and-forget safe — never throws.
 *
 * @param {string} event — TEAM_ALERT_EVENTS value
 * @param {object} ctx — passed to formatTeamAlertMessage
 */
export async function sendTeamAlert(event, ctx = {}) {
  try {
    const { enabled, phones } = await loadTeamAlertConfig();
    if (!enabled) return { skipped: 'disabled' };
    if (!phones.length) return { skipped: 'no_phones' };

    const body = formatTeamAlertMessage(event, ctx);
    if (!body) return { skipped: 'unknown_event' };

    const results = await Promise.allSettled(
      phones.map((to) => sendSMS({ to, body, source: 'manual' })),
    );

    const sent = results.filter(
      (r) => r.status === 'fulfilled' && r.value?.sid,
    ).length;

    console.log(`[TeamAlert] ${event} → ${sent}/${phones.length} phones (${codeLabel(ctx)})`);
    return { sent, total: phones.length };
  } catch (err) {
    console.error('[TeamAlert] send failed:', err.message);
    return { error: err.message };
  }
}

function codeLabel(ctx) {
  const b = ctx.booking || ctx;
  return b.booking_code || ctx.booking_code || '—';
}

/** Non-blocking wrapper for call sites that already use fire-and-forget patterns. */
export function sendTeamAlertAsync(event, ctx = {}) {
  sendTeamAlert(event, ctx).catch((e) => console.error('[TeamAlert] async failed:', e.message));
}
