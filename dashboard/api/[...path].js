// Vercel serverless function — proxies all /api/* requests to Express backend
// This allows the dashboard Vercel project to serve both the SPA and the API
import app from '../../backend/api/index.js';
export default app;
