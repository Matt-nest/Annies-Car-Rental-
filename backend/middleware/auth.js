import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import { supabase } from '../db/supabase.js';

// Shared client for JWT verification (uses anon key intentionally — verifies against public key)
const authClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ────────────────────────────────────────────────────────
// requireAuth — verify JWT + attach profile (with role)
// ────────────────────────────────────────────────────────
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

  // Attach profile with role (if exists)
  const { data: profile } = await supabase
    .from('admin_profiles')
    .select('*')
    .eq('auth_id', user.id)
    .eq('is_active', true)
    .single();

  req.user = user;
  req.user.profile = profile || null;
  req.user.role = profile?.role || 'viewer'; // default to least privilege
  next();
}

// ────────────────────────────────────────────────────────
// requireRole — restrict to specific roles
// Usage: requireRole('owner') or requireRole('owner', 'admin')
// ────────────────────────────────────────────────────────
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user?.role || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: req.user?.role || 'none',
      });
    }
    next();
  };
}
