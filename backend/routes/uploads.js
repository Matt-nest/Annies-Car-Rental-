import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { supabase } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePortalAuth } from '../services/portalAuthService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// ── Multer config ────────────────────────────────────────────────────────────
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(Object.assign(new Error('Only JPEG, PNG, WebP, and HEIC images are accepted'), { status: 400 }));
  },
});

// ── Helper: ensure a Supabase Storage bucket exists ──────────────────────────
async function ensureBucket(bucketId, isPublic) {
  const { data } = await supabase.storage.getBucket(bucketId);
  if (!data) {
    await supabase.storage.createBucket(bucketId, { public: isPublic });
    console.log(`[Storage] Created bucket: ${bucketId} (public=${isPublic})`);
  }
}

// ── Helper: upload a file to Supabase Storage ────────────────────────────────
async function uploadToStorage(bucket, file, folder = '') {
  await ensureBucket(bucket, bucket === 'vehicle-images');

  const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
  const filename = `${folder ? folder + '/' : ''}${crypto.randomUUID()}${ext}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filename, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) throw Object.assign(new Error('Upload failed: ' + error.message), { status: 500 });

  // For public buckets, return the permanent public URL
  if (bucket === 'vehicle-images') {
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return urlData.publicUrl;
  }

  // For private buckets, return both the permanent storage path and a temporary signed URL
  const { data: signedData, error: signedError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(data.path, 60 * 60 * 24 * 7); // 7 days

  if (signedError) throw signedError;
  return { url: signedData.signedUrl, path: data.path, bucket };
}

// ══════════════════════════════════════════════════════════════════════════════
// POST /uploads/id-photo
// Public (authenticated by API key via booking flow)
// Uploads a customer's photo ID to the private 'id-photos' bucket
// ══════════════════════════════════════════════════════════════════════════════
router.post('/id-photo', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Field name must be "file".' });
  }

  const result = await uploadToStorage('id-photos', req.file, 'ids');
  // Return both url (signed, temporary) and path (permanent, for DB storage)
  res.json({ url: result.url, path: result.path, bucket: result.bucket });
}));

// ══════════════════════════════════════════════════════════════════════════════
// POST /uploads/scan-id
// Public (booking flow) — fallback license OCR via Azure Document Intelligence.
// Used only when the in-browser barcode scan fails. Returns parsed fields; never
// throws to the client (returns { ok: false } so the UI falls back to manual).
// ══════════════════════════════════════════════════════════════════════════════
router.post('/scan-id', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Field name must be "file".' });
  }

  const scan_id = crypto.randomUUID();
  let photo_path = null;
  let photo_url = null;

  // Always persist the scan image so the dashboard can display the captured ID photo.
  try {
    const stored = await uploadToStorage('id-photos', req.file, 'ids/scans');
    photo_path = stored.path;
    photo_url = stored.url;
  } catch (err) {
    console.warn('[scan-id] Photo storage failed:', err.message);
  }

  const { scanIdDocument, AZURE_ID_SCAN_ENABLED } = await import('../services/idScanService.js');
  if (!AZURE_ID_SCAN_ENABLED) {
    return res.json({
      ok: false,
      reason: 'not_configured',
      scan_id,
      photo_path,
      photo_url,
    });
  }

  try {
    const fields = await scanIdDocument(req.file.buffer);
    if (!fields || (!fields.licenseNumber && !fields.lastName)) {
      return res.json({
        ok: false,
        reason: 'no_id_found',
        scan_id,
        photo_path,
        photo_url,
      });
    }
    res.json({ ok: true, scan_id, photo_path, photo_url, fields });
  } catch (err) {
    console.warn('[scan-id] Azure OCR failed:', err.message);
    res.json({
      ok: false,
      reason: 'error',
      scan_id,
      photo_path,
      photo_url,
    });
  }
}));

// ══════════════════════════════════════════════════════════════════════════════
// POST /uploads/vehicle-image
// Admin only (JWT auth)
// Uploads a vehicle photo to the public 'vehicle-images' bucket
// ══════════════════════════════════════════════════════════════════════════════
router.post('/vehicle-image', requireAuth, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Field name must be "file".' });
  }

  const url = await uploadToStorage('vehicle-images', req.file, 'thumbnails');
  res.json({ url });
}));

// ══════════════════════════════════════════════════════════════════════════════
// GET /uploads/signed-url?bucket=id-photos&path=ids/abc.jpg
// Admin only — generates a fresh signed URL for a private storage path
// ══════════════════════════════════════════════════════════════════════════════
router.get('/signed-url', requireAuth, asyncHandler(async (req, res) => {
  const { bucket, path: storagePath } = req.query;
  if (!bucket || !storagePath) {
    return res.status(400).json({ error: 'bucket and path query params required' });
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, 60 * 60 * 2); // 2 hours

  if (error) throw Object.assign(new Error('Failed to sign URL'), { status: 500 });
  res.json({ url: data.signedUrl });
}));

// ══════════════════════════════════════════════════════════════════════════════
// POST /uploads/checkin-photos
// Portal auth (customer JWT) — Multi-file upload for check-in/check-out photos
// Stores in private 'checkin-photos' bucket, organized by booking ID
// ══════════════════════════════════════════════════════════════════════════════


router.post(
  '/checkin-photos',
  requirePortalAuth,
  upload.array('photos', 10), // up to 10 photos
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded. Field name must be "photos".' });
    }

    const bookingId = req.portal.bookingId;
    const folder = `booking-${bookingId}`;
    const results = [];

    for (const file of req.files) {
      const result = await uploadToStorage('checkin-photos', file, folder);
      results.push(result);
    }

    res.json({ photos: results });
  })
);

export default router;
