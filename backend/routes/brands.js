import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import brand from '../config/brand.js';

const router = Router();

/* ────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────── */

/** Convert a brand name to a URL-safe slug. */
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** All columns we allow from the client. */
const ALLOWED_FIELDS = [
  'name', 'legal_entity', 'dba', 'domain',
  'phone', 'email', 'owner_email',
  'city', 'state', 'zip', 'address', 'timezone',
  'color_accent', 'color_accent_dark', 'logo_url',
  'meta_description',
  'stripe_prefix', 'review_link', 'chat_widget_id',
  'tax_rate', 'deposit_cents', 'is_active',
];

function pick(body) {
  const row = {};
  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined) row[key] = body[key];
  }
  return row;
}

/* ────────────────────────────────────────────────────────
   GET /brands — list all brands
   ──────────────────────────────────────────────────────── */
router.get('/', requireAuth, requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  res.json(data);
}));

/* ────────────────────────────────────────────────────────
   GET /brands/:id — single brand
   ──────────────────────────────────────────────────────── */
router.get('/:id', requireAuth, requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Brand not found' });
  res.json(data);
}));

/* ────────────────────────────────────────────────────────
   POST /brands — create new brand
   ──────────────────────────────────────────────────────── */
router.post('/', requireAuth, requireRole('owner'), asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Brand name is required' });
  }

  const row = pick(req.body);
  row.slug = slugify(name);

  const { data, error } = await supabase
    .from('brands')
    .insert(row)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A brand with that name/slug already exists' });
    }
    throw Object.assign(new Error(error.message), { status: 500 });
  }

  res.status(201).json(data);
}));

/* ────────────────────────────────────────────────────────
   PUT /brands/:id — update brand
   ──────────────────────────────────────────────────────── */
router.put('/:id', requireAuth, requireRole('owner'), asyncHandler(async (req, res) => {
  const updates = pick(req.body);

  // Re-slug if name changed
  if (updates.name) {
    updates.slug = slugify(updates.name);
  }

  const { data, error } = await supabase
    .from('brands')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A brand with that name/slug already exists' });
    }
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  if (!data) return res.status(404).json({ error: 'Brand not found' });

  res.json(data);
}));

/* ────────────────────────────────────────────────────────
   DELETE /brands/:id — soft-delete (set is_active = false)
   ──────────────────────────────────────────────────────── */
router.delete('/:id', requireAuth, requireRole('owner'), asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('brands')
    .update({ is_active: false })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  if (!data) return res.status(404).json({ error: 'Brand not found' });

  res.json({ message: 'Brand deactivated', brand: data });
}));

/* ────────────────────────────────────────────────────────
   GET /brands/:id/env — export .env file for deployment
   ──────────────────────────────────────────────────────── */
router.get('/:id/env', requireAuth, requireRole('owner'), asyncHandler(async (req, res) => {
  const { data: b, error } = await supabase
    .from('brands')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !b) return res.status(404).json({ error: 'Brand not found' });

  const lines = [
    `# ═══════════════════════════════════════════════════════`,
    `# ${b.name} — Auto-generated .env`,
    `# Generated: ${new Date().toISOString()}`,
    `# ═══════════════════════════════════════════════════════`,
    ``,
    `# ── Frontend (Vite) ─────────────────────────────────────`,
    `VITE_BRAND_NAME=${b.name}`,
    `VITE_BRAND_LEGAL_NAME=${b.legal_entity || ''}`,
    `VITE_BRAND_DOMAIN=${b.domain || ''}`,
    `VITE_BRAND_PHONE=${b.phone || ''}`,
    `VITE_BRAND_EMAIL=${b.email || ''}`,
    `VITE_BRAND_CITY=${b.city || ''}`,
    `VITE_BRAND_STATE=${b.state || ''}`,
    `VITE_BRAND_ADDRESS=${b.address || ''}`,
    `VITE_BRAND_ZIP=${b.zip || ''}`,
    `VITE_BRAND_META_DESCRIPTION=${b.meta_description || ''}`,
    `VITE_BRAND_COLOR_ACCENT=${b.color_accent || '#D4AF37'}`,
    `VITE_BRAND_COLOR_ACCENT_DARK=${b.color_accent_dark || '#B8941E'}`,
    `VITE_BRAND_REVIEW_LINK=${b.review_link || ''}`,
    `VITE_CHAT_WIDGET_ID=${b.chat_widget_id || ''}`,
    ``,
    `# ── Backend ─────────────────────────────────────────────`,
    `BRAND_NAME=${b.name}`,
    `BRAND_LEGAL_NAME=${b.legal_entity || ''}`,
    `BRAND_DBA=${b.dba || ''}`,
    `BRAND_DOMAIN=${b.domain || ''}`,
    `BRAND_PHONE=${b.phone || ''}`,
    `BRAND_EMAIL=${b.email || ''}`,
    `OWNER_EMAIL=${b.owner_email || ''}`,
    `EMAIL_FROM=${b.name} <noreply@${b.domain || 'example.com'}>`,
    `BRAND_CITY=${b.city || ''}`,
    `BRAND_STATE=${b.state || ''}`,
    `BRAND_ZIP=${b.zip || ''}`,
    `BRAND_ADDRESS=${b.address || ''}`,
    `BRAND_COLOR_PRIMARY=${b.color_accent || '#D4AF37'}`,
    `BRAND_STRIPE_PREFIX=${b.stripe_prefix || b.name}`,
    `BRAND_REVIEW_LINK=${b.review_link || ''}`,
    `TAX_RATE=${b.tax_rate ?? 0.07}`,
    `DEFAULT_DEPOSIT_CENTS=${b.deposit_cents ?? 15000}`,
    `CRON_TIMEZONE=${b.timezone || 'America/New_York'}`,
    `SITE_URL=https://${b.domain || 'example.com'}`,
    `DASHBOARD_URL=https://admin.${b.domain || 'example.com'}`,
    ``,
    `# ── Credentials (fill in manually) ──────────────────────`,
    `VITE_STRIPE_PUBLISHABLE_KEY=`,
    `STRIPE_SECRET_KEY=`,
    `STRIPE_WEBHOOK_SECRET=`,
    `VITE_RECAPTCHA_SITE_KEY=`,
    `RECAPTCHA_SECRET_KEY=`,
    `SUPABASE_URL=`,
    `SUPABASE_ANON_KEY=`,
    `SUPABASE_SERVICE_KEY=`,
    `RESEND_API_KEY=`,
    `TWILIO_ACCOUNT_SID=`,
    `TWILIO_AUTH_TOKEN=`,
    `TWILIO_PHONE_NUMBER=`,
    `PORTAL_JWT_SECRET=`,
    ``,
  ];

  const filename = `${b.slug || 'brand'}.env`;
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(lines.join('\n'));
}));

export default router;
