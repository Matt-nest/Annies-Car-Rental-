/**
 * Sentry-compatible error tracking module for the backend.
 *
 * When SENTRY_DSN is set, this module initialises Sentry and exports
 * helper functions for capturing errors and Express middleware.
 * When SENTRY_DSN is NOT set, it exports safe no-ops so the rest of
 * the codebase can call captureException / requestHandler / errorHandler
 * without caring whether Sentry is configured.
 *
 * Install:  npm i @sentry/node  (added to package.json)
 */

const SENTRY_DSN = process.env.SENTRY_DSN || '';
let Sentry = null;

if (SENTRY_DSN) {
  try {
    Sentry = await import('@sentry/node');
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: process.env.NODE_ENV || 'production',
      tracesSampleRate: 0.2,  // 20% of transactions
      // Scrub sensitive headers
      beforeSendTransaction(event) {
        if (event.request?.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
        }
        return event;
      },
    });
    console.log('[Sentry] Initialised for backend');
  } catch (e) {
    console.warn('[Sentry] Failed to initialise — running without error tracking:', e.message);
    Sentry = null;
  }
}

/**
 * Capture an error and send it to Sentry (no-op if Sentry is not configured).
 */
export function captureException(err, context = {}) {
  if (Sentry) {
    Sentry.captureException(err, { extra: context });
  }
}

/**
 * Express middleware — adds Sentry request context.
 * Safe no-op if Sentry is not configured.
 */
export function sentryRequestHandler() {
  if (Sentry?.Handlers?.requestHandler) {
    return Sentry.Handlers.requestHandler();
  }
  return (_req, _res, next) => next();
}

/**
 * Express error handler — reports unhandled errors to Sentry.
 * Mount BEFORE your own errorHandler middleware.
 */
export function sentryErrorHandler() {
  if (Sentry?.Handlers?.errorHandler) {
    return Sentry.Handlers.errorHandler();
  }
  return (_err, _req, _res, next) => next(_err);
}

export default { captureException, sentryRequestHandler, sentryErrorHandler };
