import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { brand } from './config/brand';
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

// ── Optional chat widget (injected at runtime, not hardcoded in HTML) ──
if (brand.chatWidgetId) {
  const script = document.createElement('script');
  script.src = 'https://widgets.leadconnectorhq.com/loader.js';
  script.setAttribute('data-resources-url', 'https://widgets.leadconnectorhq.com/chat-widget/loader.js');
  script.setAttribute('data-widget-id', brand.chatWidgetId);
  document.body.appendChild(script);
}
