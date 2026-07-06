/**
 * pushService — Web Push (W3C PushManager) sender + subscription store.
 *
 * Sprint 12a. Backend infrastructure only — wiring into notifyService.js is
 * Sprint 12c.
 *
 * Configuration:
 *   VAPID_PUBLIC_KEY   — base64url, generated once via `npx web-push generate-vapid-keys`
 *   VAPID_PRIVATE_KEY  — same generator
 *   VAPID_SUBJECT      — mailto:annie@anniescarrental.com OR an https URL
 *
 * If any of the three env vars are missing, push is disabled (subscribe + send
 * become no-ops with a console warning). This lets the feature flag rollout via
 * env vars alone — no code deploy needed to turn it off if it misbehaves.
 *
 * Failure handling:
 *   - 404/410 from a push gateway → subscription is dead → DELETE the row.
 *   - 5xx / network → increment failed_count, retry on next send.
 *   - failed_count >= 3 → delete (stale subscription, likely browser cleanup).
 */

import webpush from 'web-push';
import { supabase } from '../db/supabase.js';
import brand from '../config/brand.js';

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT;

const ENABLED = Boolean(VAPID_PUBLIC && VAPID_PRIVATE && VAPID_SUBJECT);

if (ENABLED) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
} else if (process.env.NODE_ENV !== 'test') {
  console.warn('[pushService] VAPID env vars missing — push notifications disabled. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT to enable.');
}

export function isPushEnabled() {
  return ENABLED;
}

export function getVapidPublicKey() {
  return VAPID_PUBLIC || null;
}

/**
 * Upsert a subscription for a customer. Dedupes on (customer_id, endpoint).
 * The subscription object comes straight from `pushManager.subscribe()` →
 * `subscription.toJSON()` on the client.
 *
 * @returns {Promise<{id: string, created: boolean}>}
 */
export async function saveSubscription(customerId, subscription, userAgent = null) {
  if (!ENABLED) {
    throw Object.assign(new Error('Push notifications not configured'), { status: 503 });
  }
  if (!customerId) throw new Error('customerId required');
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    throw Object.assign(new Error('invalid subscription object'), { status: 400 });
  }

  const row = {
    customer_id: customerId,
    endpoint:    subscription.endpoint,
    keys_p256dh: subscription.keys.p256dh,
    keys_auth:   subscription.keys.auth,
    user_agent:  userAgent || null,
    failed_count: 0,
  };

  // Upsert — re-subscribing on the same browser updates the row instead of
  // creating a duplicate (we hit the (customer_id, endpoint) unique index).
  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert(row, { onConflict: 'customer_id,endpoint' })
    .select('id, created_at')
    .single();

  if (error) {
    throw Object.assign(new Error(`saveSubscription failed: ${error.message}`), { status: 500 });
  }
  return { id: data.id, created: true };
}

/**
 * Delete a subscription. Caller can pass either { customerId, endpoint } to
 * remove one device, or { customerId } alone to nuke all subscriptions for
 * a customer (e.g., on portal "Disable notifications").
 */
export async function deleteSubscription({ customerId, endpoint }) {
  if (!customerId) throw new Error('customerId required');
  let q = supabase.from('push_subscriptions').delete().eq('customer_id', customerId);
  if (endpoint) q = q.eq('endpoint', endpoint);
  const { error, count } = await q;
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return { deleted: count ?? null };
}

/**
 * Fetch all valid subscriptions for a customer.
 */
export async function listSubscriptions(customerId) {
  if (!customerId) return [];
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, keys_p256dh, keys_auth')
    .eq('customer_id', customerId);
  if (error) {
    console.error('[pushService] listSubscriptions failed:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Send a push notification to every subscription belonging to a customer.
 *
 * @param {string} customerId
 * @param {object} payload — { title, body, url?, icon?, badge?, data? }
 * @returns {Promise<{sent: number, failed: number, deleted: number}>}
 */
export async function sendToCustomer(customerId, payload) {
  if (!ENABLED) {
    return { sent: 0, failed: 0, deleted: 0, skipped: 'push disabled' };
  }
  const subs = await listSubscriptions(customerId);
  if (subs.length === 0) return { sent: 0, failed: 0, deleted: 0 };

  const serialized = JSON.stringify({
    title: payload.title || brand.name,
    body:  payload.body  || '',
    url:   payload.url   || '/portal',
    icon:  payload.icon  || '/web-app-manifest-192x192.png',
    badge: payload.badge || '/favicon-96x96.png',
    data:  payload.data  || {},
  });

  let sent = 0, failed = 0, deleted = 0;

  await Promise.all(subs.map(async (sub) => {
    const subscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
    };
    try {
      await webpush.sendNotification(subscription, serialized, { TTL: 60 * 60 * 24 });
      sent++;
      // Mark this sub as successfully used.
      await supabase.from('push_subscriptions')
        .update({ last_used_at: new Date().toISOString(), failed_count: 0 })
        .eq('id', sub.id);
    } catch (err) {
      // 404 = endpoint not found, 410 = gone → subscription is dead.
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        deleted++;
        return;
      }
      // Other failures → increment counter, prune at 3.
      failed++;
      const { data: existing } = await supabase.from('push_subscriptions')
        .select('failed_count').eq('id', sub.id).single();
      const nextCount = (existing?.failed_count || 0) + 1;
      if (nextCount >= 3) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        deleted++;
      } else {
        await supabase.from('push_subscriptions')
          .update({ failed_count: nextCount }).eq('id', sub.id);
      }
      console.error(`[pushService] send failed for sub ${sub.id} (status ${err.statusCode}): ${err.message}`);
    }
  }));

  return { sent, failed, deleted };
}

/* ═══════════════════════════════════════════════════════════════════════════
   ADMIN PUSH — Sprint 18
   Mirror of the customer-side API above, but reads/writes admin_push_subscriptions
   (migration 024) and gates by admin_user_id (admin_profiles.id). Used by:
     • POST /api/v1/push/admin/subscribe (dashboard PWA opt-in)
     • POST /api/v1/push/admin/test      (admin verifies push works)
     • notifyService.sendBookingNotification → optional admin fan-out for
       admin-relevant stages (booking_submitted, damage_notification, late_*).
   ═══════════════════════════════════════════════════════════════════════ */

export async function saveAdminSubscription(adminUserId, subscription, userAgent = null) {
  if (!ENABLED) {
    throw Object.assign(new Error('Push notifications not configured'), { status: 503 });
  }
  if (!adminUserId) throw new Error('adminUserId required');
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    throw Object.assign(new Error('invalid subscription object'), { status: 400 });
  }

  const row = {
    admin_user_id: adminUserId,
    endpoint:      subscription.endpoint,
    keys_p256dh:   subscription.keys.p256dh,
    keys_auth:     subscription.keys.auth,
    user_agent:    userAgent || null,
    failed_count:  0,
  };

  const { data, error } = await supabase
    .from('admin_push_subscriptions')
    .upsert(row, { onConflict: 'admin_user_id,endpoint' })
    .select('id, created_at')
    .single();

  if (error) {
    throw Object.assign(new Error(`saveAdminSubscription failed: ${error.message}`), { status: 500 });
  }
  return { id: data.id, created: true };
}

export async function deleteAdminSubscription({ adminUserId, endpoint }) {
  if (!adminUserId) throw new Error('adminUserId required');
  let q = supabase.from('admin_push_subscriptions').delete().eq('admin_user_id', adminUserId);
  if (endpoint) q = q.eq('endpoint', endpoint);
  const { error, count } = await q;
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return { deleted: count ?? null };
}

export async function listAdminSubscriptions(adminUserId) {
  if (!adminUserId) return [];
  const { data, error } = await supabase
    .from('admin_push_subscriptions')
    .select('id, endpoint, keys_p256dh, keys_auth')
    .eq('admin_user_id', adminUserId);
  if (error) {
    console.error('[pushService] listAdminSubscriptions failed:', error.message);
    return [];
  }
  return data || [];
}

/** Fetch ALL admin subscriptions (every admin who's opted in). For broadcast
 *  events like "new booking submitted" where any active admin/staff should
 *  receive a push. */
async function listAllAdminSubscriptions() {
  const { data, error } = await supabase
    .from('admin_push_subscriptions')
    .select('id, endpoint, keys_p256dh, keys_auth');
  if (error) {
    console.error('[pushService] listAllAdminSubscriptions failed:', error.message);
    return [];
  }
  return data || [];
}

/** Send a push to one specific admin's devices. Used by the Test Push button
 *  so an admin can verify their own subscription works. */
export async function sendToAdmin(adminUserId, payload) {
  if (!ENABLED) {
    return { sent: 0, failed: 0, deleted: 0, skipped: 'push disabled' };
  }
  const subs = await listAdminSubscriptions(adminUserId);
  return dispatchToAdminSubs(subs, payload);
}

/** Send a push to every admin who's opted in. Used by notifyService for
 *  admin-relevant events (new booking, damage, late return). */
export async function sendToAllAdmins(payload) {
  if (!ENABLED) {
    return { sent: 0, failed: 0, deleted: 0, skipped: 'push disabled' };
  }
  const subs = await listAllAdminSubscriptions();
  return dispatchToAdminSubs(subs, payload);
}

/** Shared send loop — same failure handling as sendToCustomer (404/410
 *  deletes the row, 5xx increments a counter and prunes at 3). Extracted so
 *  the two admin entry points share one code path. */
async function dispatchToAdminSubs(subs, payload) {
  if (subs.length === 0) return { sent: 0, failed: 0, deleted: 0 };

  const serialized = JSON.stringify({
    title: payload.title || brand.name,
    body:  payload.body  || '',
    url:   payload.url   || '/',
    icon:  payload.icon  || '/web-app-manifest-192x192.png',
    badge: payload.badge || '/favicon-96x96.png',
    data:  payload.data  || {},
  });

  let sent = 0, failed = 0, deleted = 0;

  await Promise.all(subs.map(async (sub) => {
    const subscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
    };
    try {
      await webpush.sendNotification(subscription, serialized, { TTL: 60 * 60 * 24 });
      sent++;
      await supabase.from('admin_push_subscriptions')
        .update({ last_used_at: new Date().toISOString(), failed_count: 0 })
        .eq('id', sub.id);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabase.from('admin_push_subscriptions').delete().eq('id', sub.id);
        deleted++;
        return;
      }
      failed++;
      const { data: existing } = await supabase.from('admin_push_subscriptions')
        .select('failed_count').eq('id', sub.id).single();
      const nextCount = (existing?.failed_count || 0) + 1;
      if (nextCount >= 3) {
        await supabase.from('admin_push_subscriptions').delete().eq('id', sub.id);
        deleted++;
      } else {
        await supabase.from('admin_push_subscriptions')
          .update({ failed_count: nextCount }).eq('id', sub.id);
      }
      console.error(`[pushService] admin send failed for sub ${sub.id} (status ${err.statusCode}): ${err.message}`);
    }
  }));

  return { sent, failed, deleted };
}
