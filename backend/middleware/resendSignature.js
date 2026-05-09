/**
 * Resend inbound webhook signature verification.
 *
 * Resend signs webhooks via Svix. The signature scheme is:
 *   HMAC-SHA256(secret, `${svix-id}.${svix-timestamp}.${rawBody}`)
 * Header `svix-signature` is one or more space-separated `v1,base64sig` tokens.
 * `secret` is the webhook secret from the Resend dashboard, prefixed
 * `whsec_` — strip the prefix and base64-decode before HMAC.
 *
 * Bypass: if `INBOUND_EMAIL_SECRET` is set AND the request includes
 * `X-Webhook-Secret` matching it, signature check is skipped (admin replay,
 * initial setup before the Svix secret is wired).
 *
 * Dev: if `RESEND_WEBHOOK_SECRET` is not set, the middleware logs and
 * allows the request through. Production must always set the secret.
 *
 * Note: this middleware expects `req.rawBody` (a Buffer) populated by the
 * `express.json({ verify: ... })` mount on the route. JSON-parsed body is
 * also available via `req.body`.
 */

import crypto from 'crypto';

export function verifyResendSignature(req, res, next) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const bypassSecret = process.env.INBOUND_EMAIL_SECRET;

  if (bypassSecret && req.headers['x-webhook-secret'] === bypassSecret) {
    return next();
  }

  if (!secret) {
    console.warn('[ResendSig] RESEND_WEBHOOK_SECRET not set — skipping signature verification');
    return next();
  }

  const svixId = req.headers['svix-id'];
  const svixTimestamp = req.headers['svix-timestamp'];
  const svixSignature = req.headers['svix-signature'];

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.warn('[ResendSig] Missing svix-* headers');
    return res.status(403).json({ error: 'Missing webhook signature headers' });
  }

  // Reject stale timestamps (replay defense — Svix recommends 5 min window)
  const now = Math.floor(Date.now() / 1000);
  const ts = Number(svixTimestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > 5 * 60) {
    console.warn(`[ResendSig] Timestamp out of window: ${svixTimestamp}`);
    return res.status(403).json({ error: 'Stale webhook timestamp' });
  }

  const rawBody = req.rawBody;
  if (!rawBody) {
    console.warn('[ResendSig] Missing rawBody — middleware order issue');
    return res.status(500).json({ error: 'Webhook misconfigured' });
  }

  // Strip whsec_ prefix and base64-decode the secret
  const secretKey = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  let secretBuf;
  try {
    secretBuf = Buffer.from(secretKey, 'base64');
  } catch {
    console.error('[ResendSig] Failed to decode RESEND_WEBHOOK_SECRET');
    return res.status(500).json({ error: 'Webhook misconfigured' });
  }

  const signed = `${svixId}.${svixTimestamp}.${rawBody.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', secretBuf).update(signed).digest('base64');

  // svix-signature can contain multiple space-separated `v1,sig` pairs.
  // Match if any pair's signature matches.
  const presentedSigs = svixSignature.split(' ').map(p => p.split(',')[1]).filter(Boolean);
  const expectedBuf = Buffer.from(expected);
  const ok = presentedSigs.some(sig => {
    const sigBuf = Buffer.from(sig);
    if (sigBuf.length !== expectedBuf.length) return false;
    try {
      return crypto.timingSafeEqual(sigBuf, expectedBuf);
    } catch { return false; }
  });

  if (!ok) {
    console.warn(`[ResendSig] Signature mismatch for ${req.originalUrl}`);
    return res.status(403).json({ error: 'Invalid webhook signature' });
  }

  next();
}
