import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

/** GET / — list notifications (most recent first) */
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  res.json(data);
}));

/** GET /unread-count — just the count of unread notifications */
router.get('/unread-count', requireAuth, asyncHandler(async (req, res) => {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false);

  if (error) throw error;
  res.json({ count: count || 0 });
}));

/** PATCH /read-all — mark all notifications as read */
router.patch('/read-all', requireAuth, asyncHandler(async (req, res) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('is_read', false);

  if (error) throw error;
  res.json({ success: true });
}));

/** PATCH /:id/read — mark a single notification as read */
router.patch('/:id/read', requireAuth, asyncHandler(async (req, res) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', req.params.id);

  if (error) throw error;
  res.json({ success: true });
}));

/** DELETE /:id — delete a notification */
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', req.params.id);

  if (error) throw error;
  res.json({ success: true });
}));

export default router;
