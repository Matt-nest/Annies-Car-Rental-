import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Lazy, resilient Supabase client.
//
// This module used to throw at IMPORT time when SUPABASE_URL /
// SUPABASE_SERVICE_KEY were missing. On Vercel that turns a *misconfigured*
// project (e.g. the static customer site accidentally built/run as this
// serverless function) into a cold-start crash — FUNCTION_INVOCATION_FAILED on
// EVERY route, taking the whole site down (this exact thing happened once).
//
// Instead we defer client creation to first use. A genuinely missing env var
// then surfaces as a normal *handled* 500 on the one route that touches the DB
// (caught by asyncHandler), never a site-wide cold-start outage.
let _client = null;

function getClient() {
  if (_client) return _client;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment');
  }
  // Service role client — full access, used for all server-side operations
  _client = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
  return _client;
}

// Proxy keeps every existing `supabase.from(...)` / `supabase.auth` / etc. call
// site unchanged — the real client is built on first property access.
export const supabase = new Proxy({}, {
  get(_target, prop) {
    const client = getClient();
    const value = client[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
