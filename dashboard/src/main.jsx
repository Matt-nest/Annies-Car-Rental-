import React from 'react';
import ReactDOM from 'react-dom/client';
import { SpeedInsights } from '@vercel/speed-insights/react';
import App from './App';
import { registerSW } from './pwa/registerSW';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    {/* Real-user Core Web Vitals (LCP/INP/CLS) — Vercel Speed Insights.
        Production-only via Vercel injection; no-op in dev. */}
    <SpeedInsights />
  </React.StrictMode>
);

// Register the production service worker. No-op in dev / tests.
registerSW();
