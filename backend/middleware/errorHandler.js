import { captureException } from '../services/sentry.js';

export function errorHandler(err, req, res, next) {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`, err);

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  // Report server errors (5xx) to Sentry
  if (status >= 500) {
    captureException(err, { method: req.method, path: req.path });
  }

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

// Wrap async route handlers to forward errors to express error handler
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
