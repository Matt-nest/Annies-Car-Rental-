import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { RECAPTCHA_SITE_KEY } from './config';
import App from './App.tsx';
import { registerSW } from './pwa/registerSW';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {/* Real-user Core Web Vitals (LCP/INP/CLS) — Vercel Speed Insights.
        Production-only via Vercel injection; no-op in dev. */}
    <SpeedInsights />
  </StrictMode>,
);

// Register the production service worker after the app mounts.
// No-op in dev (kills HMR) and in test environments (Playwright sets webdriver).
registerSW();

// ── reCAPTCHA v3 (injected at runtime; needed before the booking form /
//    inquiry modal can call window.grecaptcha.execute). No-op without a key. ──
if (RECAPTCHA_SITE_KEY) {
  const recaptcha = document.createElement('script');
  recaptcha.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
  recaptcha.async = true;
  document.head.appendChild(recaptcha);
}
