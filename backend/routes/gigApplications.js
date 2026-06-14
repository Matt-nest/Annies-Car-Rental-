import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { supabase } from '../db/supabase.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { sendSMS } from '../services/notifyService.js';

/**
 * Gig-driver rental applications (public/drive.html landing page).
 *
 * Isolated from monthlyInquiries on purpose: it reuses the monthly_inquiries
 * table for storage (tagged "[GIG APPLICATION]") but adds its own SMS routing so
 * it never touches the existing notification stages.
 *
 *   POST /api/v1/gig-applications  — store + text applicant a confirmation + text owner a heads-up
 *   GET  /api/v1/gig-applications  — password-gated list for public/applications.html (x-app-pass header)
 *
 * Required env:
 *   GIG_OWNER_SMS    owner number that gets the heads-up text   (default +17729856667)
 *   APP_REVIEW_PASS  password for the applications review page   (no default — GET is closed until set)
 *   TWILIO_* / TWILIO_PHONE_NUMBER  already used by notifyService
 */

const router = Router();

const OWNER_SMS = process.env.GIG_OWNER_SMS || '+17729856667';
const REVIEW_PASS = process.env.APP_REVIEW_PASS || '';
const TAG = '[GIG APPLICATION]';

const applyRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5, // 5 applications per IP per hour
  message: { error: 'Too many applications. Please call us directly at (772) 207-1655.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** POST / — public. Stores the application, texts the applicant a confirmation,
 *  and texts the owner a short heads-up to go review the applications page. */
router.post('/', applyRateLimit, asyncHandler(async (req, res) => {
  const { name, phone, email, message, vehicle } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!phone?.trim()) return res.status(400).json({ error: 'Phone number is required' });
  if (!email?.trim() || !/^[^@]+@[^@]+\.[^@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  const cleanName = name.trim();
  const cleanPhone = phone.trim();
  const firstName = cleanName.split(/\s+/)[0];
  const car = (vehicle || '').trim();

  // Store. Reuses monthly_inquiries; the full human-readable summary lives in `message`,
  // prefixed with TAG so gig applications are filterable from regular monthly inquiries.
  const fullMessage = `${TAG}\n${(message || '').trim()}`;
  const { data, error } = await supabase
    .from('monthly_inquiries')
    .insert({
      name: cleanName,
      phone: cleanPhone,
      email: email.trim().toLowerCase(),
      message: fullMessage,
    })
    .select('id')
    .single();
  if (error) throw error;

  // Texts (source:'manual' bypasses quiet-hours so the owner is notified in real time).
  // Fire-and-forget: a Twilio hiccup must never fail the applicant's submission.
  const applicantBody =
    `Hi ${firstName}, thanks for applying with Annie's Car Rental! We've got your application`
    + `${car ? ` for the ${car}` : ''} and someone will reach out shortly with next steps. `
    + `Questions? Call or text (772) 207-1655.`;
  const ownerBody =
    `New gig rental application: ${cleanName}`
    + `${car ? ` · ${car}` : ''} · ${cleanPhone}. Open the Applications page to review the full details.`;

  Promise.allSettled([
    sendSMS({ to: cleanPhone, body: applicantBody, source: 'manual' }),
    sendSMS({ to: OWNER_SMS, body: ownerBody, source: 'manual' }),
  ]).catch(() => {});

  res.status(201).json({ success: true, id: data.id });
}));

/** GET / — password-gated list for the applications review page.
 *  Auth is a shared password in the x-app-pass header, compared to APP_REVIEW_PASS. */
router.get('/', asyncHandler(async (req, res) => {
  const pass = req.get('x-app-pass') || '';
  if (!REVIEW_PASS || pass !== REVIEW_PASS) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data, error } = await supabase
    .from('monthly_inquiries')
    .select('id, name, phone, email, message, status, created_at')
    .ilike('message', `${TAG}%`)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;

  // Strip the internal TAG line before returning the human-readable summary.
  const apps = (data || []).map((r) => ({
    ...r,
    message: (r.message || '').replace(/^\[GIG APPLICATION\]\n?/, ''),
  }));
  res.json(apps);
}));

/** PATCH /:id — archive or restore a gig application (password-gated).
 *  Body { archived: true|false }. Archived maps to status 'closed' (an allowed
 *  value of the monthly_inquiries status CHECK constraint); restore maps to 'new'. */
router.patch('/:id', asyncHandler(async (req, res) => {
  const pass = req.get('x-app-pass') || '';
  if (!REVIEW_PASS || pass !== REVIEW_PASS) return res.status(401).json({ error: 'Unauthorized' });

  const status = req.body?.archived === true ? 'closed' : 'new';
  const { data, error } = await supabase
    .from('monthly_inquiries')
    .update({ status })
    .eq('id', req.params.id)
    .ilike('message', `${TAG}%`)        // safety: only touch gig applications
    .select('id, status')
    .single();
  if (error) {
    if (error.code === 'PGRST116') return res.status(404).json({ error: 'Application not found' });
    throw error;
  }
  res.json({ success: true, id: data.id, status: data.status });
}));

/** DELETE /:id — permanently delete a gig application (password-gated). */
router.delete('/:id', asyncHandler(async (req, res) => {
  const pass = req.get('x-app-pass') || '';
  if (!REVIEW_PASS || pass !== REVIEW_PASS) return res.status(401).json({ error: 'Unauthorized' });

  const { error } = await supabase
    .from('monthly_inquiries')
    .delete()
    .eq('id', req.params.id)
    .ilike('message', `${TAG}%`);       // safety: only delete gig applications
  if (error) throw error;
  res.json({ success: true });
}));

export default router;
