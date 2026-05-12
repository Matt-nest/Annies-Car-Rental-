/**
 * Business settings — singleton-row admin config introduced in migration 018.
 *
 * Currently holds SMS quiet-hours config (start/end/tz/policy). Future settings
 * (business hours, tax rate, cleaning fee defaults, etc.) belong on the same
 * row so all admin-tunable config lives in one place.
 *
 * Read = any authenticated user. Write = owner/admin only.
 */

import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// Whitelist of editable fields. Anything not in this set is silently dropped
// from the PUT body so callers can't sneak in `id`, `updated_at`, etc.
const EDITABLE_FIELDS = [
  'quiet_hours_enabled',
  'quiet_hours_start',
  'quiet_hours_end',
  'quiet_hours_timezone',
  'quiet_hours_policy',
];

/** GET /settings/business — returns the singleton row. */
router.get('/business', requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('business_settings')
    .select('*')
    .eq('id', 1)
    .single();

  if (error) {
    // PGRST116 = no rows. Migration 018 seeds id=1, so this only triggers on
    // fresh dev DBs that haven't run the migration yet.
    if (error.code === 'PGRST116') return res.status(404).json({ error: 'business_settings not initialized — run migration 018' });
    throw error;
  }

  res.json(data);
}));

/** PUT /settings/business — update editable fields. Admin/owner only. */
router.put('/business', requireAuth, requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const updates = {};
  for (const key of EDITABLE_FIELDS) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No editable fields provided' });
  }

  // Validate quiet_hours_policy explicitly — DB has a CHECK constraint but a
  // clear 400 beats a 500 from Supabase.
  if (updates.quiet_hours_policy && !['skip', 'defer'].includes(updates.quiet_hours_policy)) {
    return res.status(400).json({ error: 'quiet_hours_policy must be "skip" or "defer"' });
  }

  // Validate TIME format (HH:MM or HH:MM:SS) for the two time fields. Same idea:
  // give the admin a useful error instead of a Postgres parse complaint.
  for (const tk of ['quiet_hours_start', 'quiet_hours_end']) {
    if (updates[tk] && !/^\d{2}:\d{2}(:\d{2})?$/.test(updates[tk])) {
      return res.status(400).json({ error: `${tk} must be HH:MM (24-hour)` });
    }
  }

  updates.updated_at = new Date().toISOString();
  updates.updated_by = req.user?.id || null;

  const { data, error } = await supabase
    .from('business_settings')
    .update(updates)
    .eq('id', 1)
    .select()
    .single();

  if (error) throw error;
  res.json(data);
}));

export default router;
