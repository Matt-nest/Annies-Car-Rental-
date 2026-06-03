/**
 * Sentry integration for the dashboard (frontend).
 *
 * When VITE_SENTRY_DSN is set, initialises Sentry and captures
 * unhandled errors + promise rejections. When not set, exports no-ops.
 *
 * Install:  npm i @sentry/react  (added to package.json)
 */

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';

let Sentry = null;

export async function initSentry() {
  if (!SENTRY_DSN) return;
  try {
    Sentry = await import('@sentry/react');
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: import.meta.env.MODE || 'production',
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0.5,
    });
    console.log('[Sentry] Initialised for dashboard');
  } catch (e) {
    console.warn('[Sentry] Failed to initialise:', e.message);
    Sentry = null;
  }
}

export function captureException(err, context = {}) {
  if (Sentry) {
    Sentry.captureException(err, { extra: context });
  }
}

export default { initSentry, captureException };
