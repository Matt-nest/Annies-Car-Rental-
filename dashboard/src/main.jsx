import React from 'react';
import ReactDOM from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import App from './App';
import './styles/globals.css';
import { initSentry } from './lib/sentry';

// Start Sentry before rendering (no-ops if VITE_SENTRY_DSN is not set)
initSentry();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* `reducedMotion="user"` makes EVERY Framer Motion animation in the app
        honor the OS "Reduce Motion" accessibility toggle automatically —
        transform/layout animations collapse to instant, opacity fades are
        preserved. Keeps the JS motion layer in agreement with the CSS
        `@media (prefers-reduced-motion)` block in globals.css. */}
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </React.StrictMode>
);
