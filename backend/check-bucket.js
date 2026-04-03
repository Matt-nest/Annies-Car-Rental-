import 'dotenv/config';
import { supabase } from './db/supabase.js';

// Check if id-photos bucket exists
const { data: bucket, error } = await supabase.storage.getBucket('id-photos');
console.log('Bucket:', bucket ? 'EXISTS' : 'MISSING');
console.log('Error:', error?.message || 'none');

// Try to create it if missing
if (!bucket) {
  const { data: created, error: createErr } = await supabase.storage.createBucket('id-photos', { public: false });
  console.log('Created:', created ? 'YES' : 'FAILED', createErr?.message || '');
}

// Test upload
const testBuffer = Buffer.from('test');
const { data: uploadData, error: uploadErr } = await supabase.storage
  .from('id-photos')
  .upload('test/check.txt', testBuffer, { contentType: 'text/plain', upsert: true });
console.log('Upload test:', uploadErr ? 'FAILED: ' + uploadErr.message : 'OK');

// Clean up
if (uploadData) {
  await supabase.storage.from('id-photos').remove(['test/check.txt']);
}

// Also check the API route is mounted
const fetch2 = (await import('node-fetch')).default;
const res = await fetch2('https://backend-fawn-phi-13.vercel.app/api/v1/uploads/id-photo', { method: 'POST' });
console.log('API /uploads/id-photo status:', res.status);
const body = await res.text();
console.log('API response:', body.slice(0, 200));
