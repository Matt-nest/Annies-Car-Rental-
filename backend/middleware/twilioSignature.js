/**
 * Twilio webhook signature verification.
 *
 * Twilio signs every webhook with HMAC-SHA1 of:
 *   <full-url> + concat(sort(keys).map(k => k + value[k]))
 * keyed with the account's auth token, base64-encoded, in `X-Twilio-Signature`.
 *
 * Docs: https://www.twilio.com/docs/usage/webhooks/webhooks-security
 *
 * Bypass: if `INBOUND_WEBHOOK_SECRET` is set AND the request includes
 * `X-Webhook-Secret` matching it, signature check is skipped (admin replay tooling).
 *
 * Dev: if `TWILIO_AUTH_TOKEN` is not configured, the middleware logs and
 * allows the request through. This keeps local dev unblocked. In production
 * the env var should always be set.
 */

import crypto from 'crypto';

export function verifyTwilioSignature(req, res, next) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const bypassSecret = process.env.INBOUND_WEBHOOK_SECRET;

  // Admin replay bypass — explicit shared secret header
  if (bypassSecret && req.headers['x-webhook-secret'] === bypassSecret) {
    return next();
  }

  // No auth token configured — log and allow (local dev)
  if (!authToken) {
    console.warn('[TwilioSig] TWILIO_AUTH_TOKEN not set — skipping signature verification');
    return next();
  }

  const signature = req.headers['x-twilio-signature'];
  if (!signature) {
    console.warn('[TwilioSig] Missing X-Twilio-Signature header');
    return res.status(403).json({ error: 'Missing webhook signature' });
  }

  // Reconstruct the URL Twilio used to call us. Vercel sets x-forwarded-proto;
  // req.get('host') returns the public host even behind the proxy.
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const url = `${proto}://${host}${req.originalUrl}`;

  // Build signature payload: url + sorted-params concatenated (k1+v1+k2+v2+...)
  const params = req.body || {};
  const sortedKeys = Object.keys(params).sort();
  const data = url + sortedKeys.map(k => k + params[k]).join('');

  const expected = crypto
    .createHmac('sha1', authToken)
    .update(Buffer.from(data, 'utf8'))
    .digest('base64');

  // Constant-time compare (length-checked first to avoid throwing on mismatch)
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    console.warn(`[TwilioSig] Signature mismatch for ${url}`);
    return res.status(403).json({ error: 'Invalid webhook signature' });
  }

  next();
}
