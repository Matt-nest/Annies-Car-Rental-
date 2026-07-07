import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { RECAPTCHA_SITE_KEY } from './config';
import App from './App.tsx';
import { registerSW } from './pwa/registerSW';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register service worker only in supported production contexts.
registerSW();

// reCAPTCHA v3 — only load when configured (avoids broken ?render= empty script)
if (RECAPTCHA_SITE_KEY) {
  const rc = document.createElement('script');
  rc.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
  rc.async = true;
  document.head.appendChild(rc);
}
