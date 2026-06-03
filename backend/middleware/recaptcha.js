import fetch from 'node-fetch';

/**
 * Middleware to verify Google reCAPTCHA v3 tokens.
 * Replaces the static API key check for public endpoints.
 */
export async function verifyRecaptcha(req, res, next) {
  const token = req.headers['x-recaptcha-token'];
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  if (!secretKey) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[reCAPTCHA] RECAPTCHA_SECRET_KEY not set in production — blocking request');
      return res.status(500).json({ error: 'CAPTCHA configuration error' });
    }
    console.warn('[reCAPTCHA] RECAPTCHA_SECRET_KEY not set — skipping verification (dev mode)');
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
