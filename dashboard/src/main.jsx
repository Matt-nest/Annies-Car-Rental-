import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import { initSentry } from './lib/sentry';

// Start Sentry before rendering (no-ops if VITE_SENTRY_DSN is not set)
initSentry();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
