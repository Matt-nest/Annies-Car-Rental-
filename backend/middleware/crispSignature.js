/**
 * Crisp inbound webhook signature verification.
 *
 * Crisp signs webhooks with HMAC-SHA256 using the webhook secret
 * configured in the Crisp dashboard. Header: `X-Crisp-Signature`.
 *
 * Two signing schemes are observed in the wild — we accept both:
 *   1. HMAC-SHA256(secret, `${X-Crisp-Request-Timestamp}|${rawBody}`)
 *   2. HMAC-SHA256(secret, rawBody)
 * Output is hex-encoded.
 *
 * Bypass: if `CRISP_WEBHOOK_SECRET` is also set as the bypass via
 * `X-Webhook-Secret` header, signature check is skipped (admin replay,
 * initial setup before the signature is wired). Same env var used for
 * both — Crisp's secret is what authorizes you either way.
 *
 * Dev: if `CRISP_WEBHOOK_SECRET` is not set, the middleware logs and
 * allows the request through. Production must always set the secret.
 *
 * Note: this middleware expects `req.rawBody` (a Buffer) populated by the
 * `express.json({ verify: ... })` mount on the route.
 */

import crypto from 'crypto';

export function verifyCrispSignature(req, res, next) {
  const secret = process.env.CRISP_WEBHOOK_SECRET;

  // Bypass — admin replay tooling
  if (secret && req.headers['x-webhook-secret'] === secret) {
    return next();
  }

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[CrispSig] CRISP_WEBHOOK_SECRET not set in production — rejecting webhook');
      return res.status(500).json({ error: 'Webhook not configured' });
    }
    console.warn('[CrispSig] CRISP_WEBHOOK_SECRET not set — skipping signature verification (dev only)');
    return next();
  }

  const signature = req.headers['x-crisp-signature'];
  const timestamp = req.headers['x-crisp-request-timestamp'];

  if (!signature) {
    console.warn('[CrispSig] Missing X-Crisp-Signature header');
    return res.status(403).json({ error: 'Missing webhook signature' });
  }

  // Reject stale timestamps (replay defense — 5 min window)
  if (timestamp) {
    const now = Math.floor(Date.now() / 1000);
    const ts = Number(timestamp);
    if (Number.isFinite(ts) && Math.abs(now - ts) > 5 * 60) {
      console.warn(`[CrispSig] Timestamp out of window: ${timestamp}`);
      return res.status(403).json({ error: 'Stale webhook timestamp' });
    }
  }

  const rawBody = req.rawBody;
  if (!rawBody) {
    console.warn('[CrispSig] Missing rawBody — middleware order issue');
    return res.status(500).json({ error: 'Webhook misconfigured' });
  }

  const bodyStr = rawBody.toString('utf8');

  // Try both signing schemes
  const candidates = timestamp
    ? [`${timestamp}|${bodyStr}`, bodyStr]
    : [bodyStr];

  const sigBuf = Buffer.from(signature);
  const ok = candidates.some(payload => {
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    try {
      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch { return false; }
  });

  if (!ok) {
    console.warn(`[CrispSig] Signature mismatch for ${req.originalUrl}`);
    return res.status(403).json({ error: 'Invalid webhook signature' });
  }

  next();
}
