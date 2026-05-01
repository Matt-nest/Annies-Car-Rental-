import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { supabase } from '../db/supabase.js';
import {
  healthCheck,
  getPolicyStatus,
  cancelPolicy,
  getPolicyPdf,
  getSetting,
  BonzahError,
} from '../services/bonzahService.js';

const router = express.Router();

// All endpoints under /api/v1/admin/bonzah require an authenticated admin/owner
router.use(requireAuth, requireRole('owner', 'admin'));

/**
 * GET /admin/bonzah/health
 *
 * Authenticates against Bonzah and pulls the master states list. Used by the
 * Settings page "Test Connection" button. Returns 200 even on Bonzah failure
 * so the UI can surface the underlying error message.
 */
router.get('/health', asyncHandler(async (_req, res) => {
  const result = await healthCheck();
  res.json(result);
}));

/**
 * GET /admin/bonzah/settings
 *
 * Returns the full runtime config row set as { key: value } so the Settings
 * page can render its form without doing 5 round-trips.
 */
router.get('/settings', asyncHandler(async (_req, res) => {
  const keys = [
    'bonzah_enabled',
    'bonzah_markup_percent',
    'bonzah_tiers',
    'bonzah_excluded_states',
    'bonzah_pai_excluded_states',
  ];
  const out = {};
  for (const k of keys) {
    out[k] = await getSetting(k, null);
  }
  res.json(out);
}));

/**
 * PUT /admin/bonzah/settings
 *
 * Body: object of { key: value } pairs to upsert. Only the 5 known keys are
 * accepted; anything else is ignored (so an attacker can't write arbitrary
 * settings rows through this endpoint).
 *
 * Stamps `updated_by` with the current admin's auth_id so we have a paper
 * trail for who flipped the kill switch and when.
 */
const ALLOWED_SETTING_KEYS = new Set([
  'bonzah_enabled',
  'bonzah_markup_percent',
  'bonzah_tiers',
  'bonzah_excluded_states',
  'bonzah_pai_excluded_states',
]);

router.put('/settings', asyncHandler(async (req, res) => {
  const updates = req.body || {};
  const updatedBy = req.user?.id || null;

  const rows = [];
  for (const [key, value] of Object.entries(updates)) {
    if (!ALLOWED_SETTING_KEYS.has(key)) continue;
    rows.push({ key, value, updated_by: updatedBy, updated_at: new Date().toISOString() });
  }

  if (!rows.length) return res.status(400).json({ error: 'No valid settings keys provided' });

  const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
  if (error) return res.status(500).json({ error: error.message });

  res.json({ success: true, updated: rows.map(r => r.key) });
}));

/**
 * GET /admin/bonzah/policies
 *
 * Returns all bookings where insurance_provider='bonzah' (any status), joined
 * with customer + vehicle minimal fields for the Insurance page list view.
 * Filter optional: ?status=<insurance_status>. Limit 200 newest by pickup_date.
 */
router.get('/policies', asyncHandler(async (req, res) => {
  const { status } = req.query;
  let q = supabase
    .from('bookings')
    .select('id, booking_code, status, pickup_date, return_date, insurance_provider, insurance_status, bonzah_tier_id, bonzah_policy_id, bonzah_policy_no, bonzah_premium_cents, bonzah_markup_cents, bonzah_total_charged_cents, bonzah_last_synced_at, created_at, customers(first_name, last_name, email), vehicles(year, make, model)')
    .eq('insurance_provider', 'bonzah')
    .order('pickup_date', { ascending: false })
    .limit(200);
  if (status) q = q.eq('insurance_status', status);

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ policies: data || [] });
}));

/**
 * GET /admin/bonzah/stats
 *
 * Aggregate counts by insurance_status + Annie's markup revenue this month.
 * Backs the Insurance page header tiles.
 */
router.get('/stats', asyncHandler(async (_req, res) => {
  const { data: rows, error } = await supabase
    .from('bookings')
    .select('insurance_status, bonzah_markup_cents, created_at')
    .eq('insurance_provider', 'bonzah');
  if (error) return res.status(500).json({ error: error.message });

  const counts = {};
  for (const r of rows || []) {
    const s = r.insurance_status || 'unknown';
    counts[s] = (counts[s] || 0) + 1;
  }

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const monthStartIso = monthStart.toISOString();

  let markupThisMonth = 0;
  let markupAllTime = 0;
  for (const r of rows || []) {
    const m = Number(r.bonzah_markup_cents || 0);
    markupAllTime += m;
    if (r.created_at && r.created_at >= monthStartIso) markupThisMonth += m;
  }

  res.json({
    counts,
    total: (rows || []).length,
    markup_this_month_cents: markupThisMonth,
    markup_all_time_cents: markupAllTime,
  });
}));

/**
 * GET /admin/bonzah/events
 *
 * Returns the most recent N rows from `bonzah_events`. Backs the "Recent activity"
 * table on the Settings page + booking-detail debugging.
 *
 * Query params:
 *   limit — default 50, max 200
 *   booking_id — filter to one booking
 *   errors_only — '1' to return only rows with error_text not null
 */
router.get('/events', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  let q = supabase
    .from('bonzah_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (req.query.booking_id) q = q.eq('booking_id', req.query.booking_id);
  if (req.query.errors_only === '1') q = q.not('error_text', 'is', null);

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });

  // Redact sensitive request fields before returning to the dashboard.
  // Auth events store password redacted at write time, but defense in depth.
  const sanitized = (data || []).map(r => {
    const safe = { ...r };
    if (safe.request_json && typeof safe.request_json === 'object') {
      const clone = { ...safe.request_json };
      if ('pwd' in clone) clone.pwd = '***REDACTED***';
      if ('password' in clone) clone.password = '***REDACTED***';
      safe.request_json = clone;
    }
    return safe;
  });
  res.json({ events: sanitized });
}));

/**
 * POST /admin/bookings/:id/insurance/refresh
 *
 * Pull live policy details from Bonzah and persist a snapshot. Powers the
 * "Refresh from Bonzah" button on the booking detail page. Returns the full
 * policy data alongside the updated booking timestamps.
 */
router.post('/booking/:id/refresh', asyncHandler(async (req, res) => {
  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select('id, booking_code, bonzah_policy_id, bonzah_policy_no, insurance_status')
    .eq('id', req.params.id)
    .single();
  if (bErr || !booking) return res.status(404).json({ error: 'Booking not found' });
  if (!booking.bonzah_policy_id) return res.status(400).json({ error: 'No Bonzah policy on this booking' });

  let live;
  try {
    live = await getPolicyStatus(booking.bonzah_policy_id, booking.id);
  } catch (e) {
    if (e instanceof BonzahError) {
      return res.status(502).json({ error: e.bonzahTxt || e.message, bonzah_status: e.bonzahStatus });
    }
    throw e;
  }
  const data = live?.data || {};

  const updates = { bonzah_last_synced_at: new Date().toISOString() };
  if (data.policy_no && data.policy_no !== booking.bonzah_policy_no) {
    updates.bonzah_policy_no = data.policy_no;
  }
  if (data.coverage_information) updates.bonzah_coverage_json = data.coverage_information;

  const { error: updErr } = await supabase.from('bookings').update(updates).eq('id', booking.id);
  if (updErr) return res.status(500).json({ error: `Failed to persist policy refresh: ${updErr.message}` });

  res.json({ ok: true, policy: data, updates });
}));

/**
 * POST /admin/bookings/:id/insurance/cancel
 *
 * Files a cancel endorsement with Bonzah for a single booking. Used by the
 * "Cancel Policy" button on the booking detail page. This does NOT cancel
 * the booking itself — only the insurance side. (Booking cancel via the
 * normal flow already calls cancelBonzahPolicy from bookingService.)
 */
router.post('/booking/:id/cancel', asyncHandler(async (req, res) => {
  const { remarks } = req.body || {};

  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select('id, booking_code, bonzah_policy_id, insurance_status')
    .eq('id', req.params.id)
    .single();
  if (bErr || !booking) return res.status(404).json({ error: 'Booking not found' });
  if (!booking.bonzah_policy_id) return res.status(400).json({ error: 'No Bonzah policy to cancel' });
  if (booking.insurance_status === 'cancelled') {
    return res.status(409).json({ error: 'Policy is already cancelled' });
  }

  try {
    const result = await cancelPolicy(booking.bonzah_policy_id, remarks || `Manual cancel by admin`, booking.id);
    await supabase.from('bookings').update({
      insurance_status: 'cancelled',
      bonzah_last_synced_at: new Date().toISOString(),
    }).eq('id', booking.id);
    res.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof BonzahError) {
      return res.status(502).json({ error: e.bonzahTxt || e.message, bonzah_status: e.bonzahStatus });
    }
    throw e;
  }
}));

/**
 * GET /admin/bonzah/booking/:id/pdf/:coverage
 *
 * Streams a policy PDF for a single coverage (cdw|rcli|sli|pai) from Bonzah.
 * We proxy because Bonzah requires the in-auth-token header, which the browser
 * can't supply directly. Re-fetches the policy each time to avoid persisting
 * pdf_ids on the booking row.
 */
router.get('/booking/:id/pdf/:coverage', asyncHandler(async (req, res) => {
  const { id, coverage } = req.params;
  if (!['cdw', 'rcli', 'sli', 'pai'].includes(coverage)) {
    return res.status(400).json({ error: 'Invalid coverage. Expected: cdw, rcli, sli, or pai' });
  }

  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select('id, booking_code, bonzah_policy_id')
    .eq('id', id)
    .single();
  if (bErr || !booking) return res.status(404).json({ error: 'Booking not found' });
  if (!booking.bonzah_policy_id) return res.status(400).json({ error: 'No Bonzah policy on this booking' });

  let pdf;
  try {
    pdf = await getPolicyPdf(booking.bonzah_policy_id, coverage, booking.id);
  } catch (e) {
    if (e instanceof BonzahError) {
      return res.status(502).json({ error: e.bonzahTxt || e.message, bonzah_status: e.bonzahStatus });
    }
    throw e;
  }

  res.setHeader('Content-Type', pdf.contentType);
  res.setHeader('Content-Disposition', `inline; filename="${pdf.filename}"`);
  res.setHeader('Content-Length', pdf.buffer.length);
  res.end(pdf.buffer);
}));

export default router;
