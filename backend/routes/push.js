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
import {
  isPushEnabled,
  getVapidPublicKey,
  saveSubscription,
  deleteSubscription,
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

export default router;
