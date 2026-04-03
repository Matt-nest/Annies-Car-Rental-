import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { supabase } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
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

  // For private buckets, return a signed URL (valid 7 days)
  const { data: signedData, error: signedError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(data.path, 60 * 60 * 24 * 7); // 7 days

  if (signedError) throw signedError;
  return signedData.signedUrl;
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

  const url = await uploadToStorage('id-photos', req.file, 'ids');
  res.json({ url });
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

export default router;
