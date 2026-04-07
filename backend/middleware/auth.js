import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Shared client for JWT verification (uses anon key intentionally — verifies against public key)
const authClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Verify Supabase JWT from Authorization header
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const token = header.slice(7);
  const { data: { user }, error } = await authClient.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = user;
  next();
}
