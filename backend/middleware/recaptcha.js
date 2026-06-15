import fetch from 'node-fetch';

/**
 * Middleware to verify Google reCAPTCHA v3 tokens.
 * Replaces the static API key check for public endpoints.
 */
export async function verifyRecaptcha(req, res, next) {
  const token = req.headers['x-recaptcha-token'];
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  if (!secretKey) {
    // reCAPTCHA is treated as optional hardening, not a hard dependency. When the
    // secret isn't configured we skip verification rather than blocking the request
    // (a missing key previously 500'd every public booking in production). The route
    // still has its own per-IP rate limiter as an abuse backstop. Configure
    // RECAPTCHA_SECRET_KEY (backend) + VITE_RECAPTCHA_SITE_KEY (frontend build) to
    // re-enable enforcement.
    console.warn('[reCAPTCHA] RECAPTCHA_SECRET_KEY not set — skipping verification');
    return next();
  }

  if (!token) {
    return res.status(403).json({ error: 'Missing CAPTCHA token' });
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${secretKey}&response=${token}`
    });

    const data = await response.json();

    if (!data.success || data.score < 0.5) {
      console.warn(`[reCAPTCHA] Failed verification for IP ${req.ip} — score: ${data.score}`);
      return res.status(403).json({ error: 'CAPTCHA verification failed. Please try again.' });
    }

    // Attach score to request in case downstream handlers want it
    req.recaptchaScore = data.score;
    next();
  } catch (error) {
    console.error('[reCAPTCHA] Verification error:', error);
    return res.status(500).json({ error: 'Failed to verify CAPTCHA' });
  }
}
