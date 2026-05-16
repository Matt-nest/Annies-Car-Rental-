import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { SpeedInsights } from '@vercel/speed-insights/react';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {/* Real-user Core Web Vitals (LCP/INP/CLS) — Vercel Speed Insights.
        Production-only via Vercel injection; no-op in dev. */}
    <SpeedInsights />
  </StrictMode>,
);
