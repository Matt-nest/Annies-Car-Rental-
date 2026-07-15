import { Router } from 'express';
import { randomBytes, randomUUID } from 'crypto';
import { supabase } from '../db/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import brand from '../config/brand.js';

const router = Router();
const SETTINGS_KEY = 'marketing_workspace';

const DEFAULT_WORKSPACE = {
  campaigns: [],
  links: [],
  referrals: [],
  updatedAt: null,
};

function nowIso() {
  return new Date().toISOString();
}

function cloneDefault() {
  return JSON.parse(JSON.stringify(DEFAULT_WORKSPACE));
}

function shortCode(prefix = 'annie') {
  return `${prefix}-${randomBytes(3).toString('hex')}`;
}

function slugify(value, fallback = 'campaign') {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || fallback;
}

function coerceWorkspace(value) {
  const workspace = {
    ...cloneDefault(),
    ...(value && typeof value === 'object' ? value : {}),
  };
  workspace.campaigns = Array.isArray(workspace.campaigns) ? workspace.campaigns : [];
  workspace.links = Array.isArray(workspace.links) ? workspace.links : [];
  workspace.referrals = Array.isArray(workspace.referrals) ? workspace.referrals : [];
  return workspace;
}

function isMissingSettingsTable(error) {
  return error?.code === '42P01' || /relation .*settings.* does not exist/i.test(error?.message || '');
}

async function loadWorkspace() {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .maybeSingle();

  if (error) {
    if (isMissingSettingsTable(error)) {
      return { workspace: cloneDefault(), persistent: false };
    }
    throw error;
  }

  return { workspace: coerceWorkspace(data?.value), persistent: true };
}

async function saveWorkspace(workspace, actorId) {
  const value = coerceWorkspace({ ...workspace, updatedAt: nowIso() });
  const { error } = await supabase.from('settings').upsert({
    key: SETTINGS_KEY,
    value,
    updated_by: actorId || null,
    updated_at: nowIso(),
  }, { onConflict: 'key' });
  if (error) throw error;
  return value;
}

function validateUrl(value) {
  try {
    const url = new URL(value || brand.siteUrl);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('bad protocol');
    return url;
  } catch {
    const err = new Error('destination_url must be a valid http(s) URL');
    err.status = 400;
    throw err;
  }
}

function buildUtmUrl({ destinationUrl, source, medium, campaign, content, term }) {
  const url = validateUrl(destinationUrl);
  const params = [
    ['utm_source', source],
    ['utm_medium', medium],
    ['utm_campaign', campaign],
    ['utm_content', content],
    ['utm_term', term],
  ];
  for (const [key, value] of params) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

function trackingUrl(code) {
  return `${brand.dashboardUrl}/api/v1/marketing/track/${encodeURIComponent(code)}`;
}

function summarize(workspace) {
  const campaigns = workspace.campaigns || [];
  const links = workspace.links || [];
  const referrals = workspace.referrals || [];
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const plannedCampaigns = campaigns.filter(c => c.status === 'planned').length;
  const totalClicks = links.reduce((sum, link) => sum + Number(link.clicks || 0), 0);
  const totalBookings = links.reduce((sum, link) => sum + Number(link.bookings || 0), 0);
  const referralRevenue = referrals.reduce((sum, ref) => sum + Number(ref.revenue || 0), 0);
  return {
    campaigns: campaigns.length,
    activeCampaigns,
    plannedCampaigns,
    links: links.length,
    totalClicks,
    totalBookings,
    referrals: referrals.length,
    referralRevenue: Number(referralRevenue.toFixed(2)),
  };
}

function publicWorkspace(workspace, persistent = true) {
  return {
    ...workspace,
    persistent,
    summary: summarize(workspace),
  };
}

/**
 * Public tracking redirect used by QR codes and campaign links.
 */
router.get('/track/:code', asyncHandler(async (req, res) => {
  const { workspace, persistent } = await loadWorkspace();
  const code = req.params.code;
  const link = workspace.links.find(item => item.shortCode === code);
  if (!link) return res.redirect(302, brand.siteUrl);

  const destination = link.utmUrl || link.destinationUrl || brand.siteUrl;
  if (persistent) {
    link.clicks = Number(link.clicks || 0) + 1;
    link.lastClickedAt = nowIso();
    await saveWorkspace(workspace, null).catch(err => {
      console.warn('[Marketing] Could not persist click count:', err.message);
    });
  }
  res.redirect(302, destination);
}));

router.use(requireAuth, requireRole('owner', 'admin'));

router.get('/workspace', asyncHandler(async (_req, res) => {
  const { workspace, persistent } = await loadWorkspace();
  res.json(publicWorkspace(workspace, persistent));
}));

router.get('/summary', asyncHandler(async (_req, res) => {
  const { workspace, persistent } = await loadWorkspace();
  res.json({ ...summarize(workspace), persistent });
}));

router.post('/campaigns', asyncHandler(async (req, res) => {
  const { workspace } = await loadWorkspace();
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Campaign name is required' });

  const createdAt = nowIso();
  const campaign = {
    id: randomUUID(),
    name,
    audience: String(req.body?.audience || 'Local renters').trim(),
    channel: String(req.body?.channel || 'print').trim(),
    offer: String(req.body?.offer || '').trim(),
    status: ['planned', 'active', 'paused', 'complete'].includes(req.body?.status) ? req.body.status : 'planned',
    goal: String(req.body?.goal || '').trim(),
    startDate: req.body?.startDate || null,
    endDate: req.body?.endDate || null,
    budget: Number(req.body?.budget || 0),
    notes: String(req.body?.notes || '').trim(),
    createdAt,
    updatedAt: createdAt,
  };
  workspace.campaigns.unshift(campaign);
  const saved = await saveWorkspace(workspace, req.user?.id);
  res.status(201).json({ campaign, workspace: publicWorkspace(saved) });
}));

router.patch('/campaigns/:id', asyncHandler(async (req, res) => {
  const { workspace } = await loadWorkspace();
  const campaign = workspace.campaigns.find(item => item.id === req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  for (const key of ['name', 'audience', 'channel', 'offer', 'goal', 'startDate', 'endDate', 'notes']) {
    if (req.body?.[key] !== undefined) campaign[key] = String(req.body[key] || '').trim();
  }
  if (req.body?.budget !== undefined) campaign.budget = Number(req.body.budget || 0);
  if (req.body?.status && ['planned', 'active', 'paused', 'complete'].includes(req.body.status)) {
    campaign.status = req.body.status;
  }
  campaign.updatedAt = nowIso();
  const saved = await saveWorkspace(workspace, req.user?.id);
  res.json({ campaign, workspace: publicWorkspace(saved) });
}));

router.post('/links', asyncHandler(async (req, res) => {
  const { workspace } = await loadWorkspace();
  const destinationUrl = validateUrl(req.body?.destinationUrl || brand.siteUrl).toString();
  const campaign = workspace.campaigns.find(item => item.id === req.body?.campaignId) || null;
  const campaignName = campaign?.name || req.body?.campaignName || 'Direct booking';
  const code = shortCode(slugify(campaignName, 'annie').slice(0, 10));
  const utm = {
    source: slugify(req.body?.utmSource || req.body?.assetKey || 'marketing'),
    medium: slugify(req.body?.utmMedium || req.body?.channel || 'print'),
    campaign: slugify(req.body?.utmCampaign || campaignName),
    content: slugify(req.body?.utmContent || req.body?.assetKey || req.body?.name || 'asset'),
    term: slugify(req.body?.utmTerm || '', ''),
  };
  const createdAt = nowIso();
  const link = {
    id: randomUUID(),
    campaignId: campaign?.id || null,
    campaignName,
    name: String(req.body?.name || campaignName).trim(),
    assetKey: String(req.body?.assetKey || '').trim(),
    destinationUrl,
    utm,
    utmUrl: buildUtmUrl({ destinationUrl, ...utm }),
    shortCode: code,
    trackingUrl: trackingUrl(code),
    clicks: 0,
    leads: 0,
    bookings: 0,
    revenue: 0,
    createdAt,
    updatedAt: createdAt,
  };
  workspace.links.unshift(link);
  const saved = await saveWorkspace(workspace, req.user?.id);
  res.status(201).json({ link, workspace: publicWorkspace(saved) });
}));

router.patch('/links/:id', asyncHandler(async (req, res) => {
  const { workspace } = await loadWorkspace();
  const link = workspace.links.find(item => item.id === req.params.id);
  if (!link) return res.status(404).json({ error: 'Campaign link not found' });

  for (const key of ['name', 'assetKey', 'campaignName']) {
    if (req.body?.[key] !== undefined) link[key] = String(req.body[key] || '').trim();
  }
  for (const key of ['clicks', 'leads', 'bookings', 'revenue']) {
    if (req.body?.[key] !== undefined) link[key] = Number(req.body[key] || 0);
  }
  if (req.body?.destinationUrl) link.destinationUrl = validateUrl(req.body.destinationUrl).toString();
  if (req.body?.utm) link.utm = { ...(link.utm || {}), ...req.body.utm };
  link.utmUrl = buildUtmUrl({ destinationUrl: link.destinationUrl, ...(link.utm || {}) });
  link.updatedAt = nowIso();
  const saved = await saveWorkspace(workspace, req.user?.id);
  res.json({ link, workspace: publicWorkspace(saved) });
}));

router.post('/referrals', asyncHandler(async (req, res) => {
  const { workspace } = await loadWorkspace();
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Referrer name is required' });

  const code = slugify(req.body?.code || `${name}-${randomBytes(2).toString('hex')}`, 'ref').toUpperCase();
  const existing = workspace.referrals.some(ref => ref.code === code);
  if (existing) return res.status(409).json({ error: 'Referral code already exists' });

  const createdAt = nowIso();
  const referral = {
    id: randomUUID(),
    name,
    type: String(req.body?.type || 'customer').trim(),
    code,
    offer: String(req.body?.offer || '$25 off next rental').trim(),
    reward: String(req.body?.reward || '$25 credit after completed rental').trim(),
    status: ['active', 'paused', 'complete'].includes(req.body?.status) ? req.body.status : 'active',
    bookings: Number(req.body?.bookings || 0),
    revenue: Number(req.body?.revenue || 0),
    notes: String(req.body?.notes || '').trim(),
    createdAt,
    updatedAt: createdAt,
  };
  workspace.referrals.unshift(referral);
  const saved = await saveWorkspace(workspace, req.user?.id);
  res.status(201).json({ referral, workspace: publicWorkspace(saved) });
}));

router.patch('/referrals/:id', asyncHandler(async (req, res) => {
  const { workspace } = await loadWorkspace();
  const referral = workspace.referrals.find(item => item.id === req.params.id);
  if (!referral) return res.status(404).json({ error: 'Referral not found' });

  for (const key of ['name', 'type', 'offer', 'reward', 'notes']) {
    if (req.body?.[key] !== undefined) referral[key] = String(req.body[key] || '').trim();
  }
  for (const key of ['bookings', 'revenue']) {
    if (req.body?.[key] !== undefined) referral[key] = Number(req.body[key] || 0);
  }
  if (req.body?.status && ['active', 'paused', 'complete'].includes(req.body.status)) referral.status = req.body.status;
  referral.updatedAt = nowIso();
  const saved = await saveWorkspace(workspace, req.user?.id);
  res.json({ referral, workspace: publicWorkspace(saved) });
}));

export default router;
