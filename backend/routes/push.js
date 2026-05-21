/**
 * Web Push routes — customer portal subscribe / unsubscribe + VAPID public key.
 *
 * Sprint 12a. All write endpoints require a valid portal JWT (the same one
 * issued by /portal/verify) so a customer can only subscribe themselves.
 *
 * GET  /api/v1/push/vapid-key         — public, returns VAPID public key
 * POST /api/v1/push/subscribe         — portal-auth, body: { subscription }
 * POST /api/v1/push/unsubscribe       — portal-auth, body: { endpoint? }
 */

import { Router } from 'express';
import { requirePortalAuth } from '../services/portalAuthService.js';
import { requireAuth } from '../middleware/auth.js';
import {
  isPushEnabled,
  getVapidPublicKey,
  saveSubscription,
  deleteSubscription,
  saveAdminSubscription,
  deleteAdminSubscription,
  sendToAdmin,
} from '../services/pushService.js';

const router = Router();

/**
 * GET /push/vapid-key
 * Public. Returns the VAPID public key the customer site needs to subscribe.
 * Returns { enabled: false } when not configured.
 */
router.get('/vapid-key', (_req, res) => {
  if (!isPushEnabled()) {
    return res.json({ enabled: false, publicKey: null });
  }
  res.json({ enabled: true, publicKey: getVapidPublicKey() });
});

/**
 * POST /push/subscribe
 * Body: { subscription: { endpoint, keys: { p256dh, auth } } }
 * The portal JWT identifies which customer the subscription belongs to.
 */
router.post('/subscribe', requirePortalAuth, async (req, res) => {
  try {
    const { subscription } = req.body || {};
    if (!subscription) {
      return res.status(400).json({ error: 'subscription required' });
    }
    const userAgent = req.headers['user-agent'] || null;
    const result = await saveSubscription(req.portal.customerId, subscription, userAgent);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /push/unsubscribe
 * Body: { endpoint? } — endpoint omitted means "unsubscribe all my devices".
 */
router.post('/unsubscribe', requirePortalAuth, async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    const result = await deleteSubscription({
      customerId: req.portal.customerId,
      endpoint: endpoint || undefined,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   ADMIN PUSH ROUTES — Sprint 18
   Auth: requireAuth (Supabase session token, dashboard login).
   Identity: req.user.profile.id (admin_profiles.id, not the auth_id UUID).
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * POST /push/admin/subscribe
 * Body: { subscription: { endpoint, keys: { p256dh, auth } } }
 * The Supabase session JWT identifies the admin; we record their subscription.
 */
router.post('/admin/subscribe', requireAuth, async (req, res) => {
  try {
    const adminUserId = req.user?.profile?.id;
    if (!adminUserId) {
      return res.status(403).json({ error: 'No admin profile linked to this user' });
    }
    const { subscription } = req.body || {};
    if (!subscription) {
      return res.status(400).json({ error: 'subscription required' });
    }
    const userAgent = req.headers['user-agent'] || null;
    const result = await saveAdminSubscription(adminUserId, subscription, userAgent);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /push/admin/unsubscribe
 * Body: { endpoint? } — endpoint omitted means "remove all my devices".
 */
router.post('/admin/unsubscribe', requireAuth, async (req, res) => {
  try {
    const adminUserId = req.user?.profile?.id;
    if (!adminUserId) {
      return res.status(403).json({ error: 'No admin profile linked to this user' });
    }
    const { endpoint } = req.body || {};
    const result = await deleteAdminSubscription({
      adminUserId,
      endpoint: endpoint || undefined,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /push/admin/test
 * Sends a test push to the calling admin's own subscriptions. Used by the
 * Settings → Notifications "Send Test Push" button so admins can verify the
 * subscription is wired correctly before relying on real events.
 *
 * Returns { ok, sent, failed, deleted } so the UI can surface whether any
 * device actually received the push.
 */
router.post('/admin/test', requireAuth, async (req, res) => {
  try {
    const adminUserId = req.user?.profile?.id;
    if (!adminUserId) {
      return res.status(403).json({ error: 'No admin profile linked to this user' });
    }
    const firstName = req.user?.profile?.first_name || 'Admin';
    const result = await sendToAdmin(adminUserId, {
      title: 'Annie\'s Dashboard',
      body: `Hi ${firstName} — push notifications are working. You'll get pings for new bookings and incidents.`,
      url: '/settings',
      data: { tag: 'admin-test-push', kind: 'test' },
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
