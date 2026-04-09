import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const router = Router();

// Admin client for user management (service role)
const adminClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ────────────────────────────────────────────────────────
// GET /users/me — current user's profile
// ────────────────────────────────────────────────────────
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const { data: profile, error } = await supabase
    .from('admin_profiles')
    .select('*')
    .eq('auth_id', req.user.id)
    .single();

  if (error || !profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  res.json(profile);
}));

// ────────────────────────────────────────────────────────
// PATCH /users/me — update own profile
// ────────────────────────────────────────────────────────
router.patch('/me', requireAuth, asyncHandler(async (req, res) => {
  const allowedFields = ['first_name', 'last_name', 'phone', 'avatar_url'];
  const updates = {};

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('admin_profiles')
    .update(updates)
    .eq('auth_id', req.user.id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
}));

// ────────────────────────────────────────────────────────
// POST /users/me/password — change own password
// ────────────────────────────────────────────────────────
router.post('/me/password', requireAuth, asyncHandler(async (req, res) => {
  const { new_password } = req.body;

  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const { error } = await adminClient.auth.admin.updateUserById(req.user.id, {
    password: new_password,
  });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true, message: 'Password updated' });
}));

// ────────────────────────────────────────────────────────
// GET /users — list all admin profiles (owner/admin only)
// ────────────────────────────────────────────────────────
router.get('/', requireAuth, requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('admin_profiles')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
}));

// ────────────────────────────────────────────────────────
// POST /users/invite — invite a new user (owner only)
// ────────────────────────────────────────────────────────
router.post('/invite', requireAuth, requireRole('owner'), asyncHandler(async (req, res) => {
  const { email, first_name, last_name, phone, role, password } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const validRoles = ['admin', 'staff', 'viewer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: `Role must be one of: ${validRoles.join(', ')}` });
  }

  // Create auth user
  const tempPassword = password || Math.random().toString(36).slice(-10) + 'A1!';
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { first_name, last_name },
  });

  if (authError) {
    return res.status(400).json({ error: authError.message });
  }

  // Create profile
  const { data: profile, error: profileError } = await supabase
    .from('admin_profiles')
    .insert({
      auth_id: authData.user.id,
      email,
      first_name: first_name || null,
      last_name: last_name || null,
      phone: phone || null,
      role,
      invited_by: req.user.profile?.id || null,
    })
    .select()
    .single();

  if (profileError) {
    // Rollback: delete auth user if profile creation fails
    await adminClient.auth.admin.deleteUser(authData.user.id);
    return res.status(500).json({ error: profileError.message });
  }

  console.log(`[Users] ${req.user.email} invited ${email} as ${role}`);

  res.status(201).json({
    profile,
    temp_password: tempPassword,
    message: `User ${email} created. Share the temporary password with them.`,
  });
}));

// ────────────────────────────────────────────────────────
// PATCH /users/:id/role — change a user's role (owner only)
// ────────────────────────────────────────────────────────
router.patch('/:id/role', requireAuth, requireRole('owner'), asyncHandler(async (req, res) => {
  const { role } = req.body;
  const validRoles = ['owner', 'admin', 'staff', 'viewer'];

  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: `Role must be one of: ${validRoles.join(', ')}` });
  }

  // Prevent demoting yourself
  if (req.params.id === req.user.profile?.id) {
    return res.status(400).json({ error: 'Cannot change your own role' });
  }

  const { data, error } = await supabase
    .from('admin_profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  console.log(`[Users] ${req.user.email} changed ${data.email} role to ${role}`);
  res.json(data);
}));

// ────────────────────────────────────────────────────────
// DELETE /users/:id — deactivate a user (owner only)
// ────────────────────────────────────────────────────────
router.delete('/:id', requireAuth, requireRole('owner'), asyncHandler(async (req, res) => {
  // Prevent deactivating yourself
  if (req.params.id === req.user.profile?.id) {
    return res.status(400).json({ error: 'Cannot deactivate yourself' });
  }

  const { data, error } = await supabase
    .from('admin_profiles')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  console.log(`[Users] ${req.user.email} deactivated ${data.email}`);
  res.json({ success: true, message: `${data.email} deactivated` });
}));

// ────────────────────────────────────────────────────────
// POST /users/:id/reactivate — reactivate a user (owner only)
// ────────────────────────────────────────────────────────
router.post('/:id/reactivate', requireAuth, requireRole('owner'), asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('admin_profiles')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  console.log(`[Users] ${req.user.email} reactivated ${data.email}`);
  res.json(data);
}));

export default router;
