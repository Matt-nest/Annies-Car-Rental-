/**
 * Seed Turo reviews into the Supabase `reviews` table.
 * 
 * The reviews table has foreign keys to customers and vehicles,
 * but the Turo reviews have no matching rows. So we:
 *   1. First, make the FK columns nullable (if not already)
 *   2. Insert all 280 reviews with source='turo', reviewer_name, and rating
 *   3. vehicle_id and customer_id will be NULL for these imported reviews
 * 
 * Usage: node backend/scripts/seedReviews.mjs
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read Supabase config from env or use the backend's .env
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Set these in your environment or .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Parse the review data from the TypeScript file
function parseReviews() {
  const reviewsPath = path.resolve(__dirname, '../../src/data/reviews.ts');
  const content = fs.readFileSync(reviewsPath, 'utf-8');
  
  // Extract the array content between the first [ and last ]
  const match = content.match(/export const REVIEWS[^=]*=\s*(\[[\s\S]*\]);?\s*$/m);
  if (!match) {
    // Try a simpler approach: extract individual objects
    const reviews = [];
    const objectRegex = /\{\s*"id":\s*"([^"]+)",\s*"vehicleId":\s*"([^"]+)",\s*"reviewerName":\s*"([^"]+)",\s*"rating":\s*(\d+),\s*"comment":\s*"((?:[^"\\]|\\.)*)"/g;
    let m;
    while ((m = objectRegex.exec(content)) !== null) {
      reviews.push({
        id: m[1],
        vehicleId: m[2],
        reviewerName: m[3],
        rating: parseInt(m[4]),
        comment: m[5].replace(/\\"/g, '"').replace(/\\n/g, '\n'),
      });
    }
    return reviews;
  }
  
  // Try JSON parse (the file uses JSON-compatible syntax)
  try {
    return JSON.parse(match[1]);
  } catch {
    // Fallback regex approach
    const reviews = [];
    const objectRegex = /\{\s*"id":\s*"([^"]+)",\s*"vehicleId":\s*"([^"]+)",\s*"reviewerName":\s*"([^"]+)",\s*"rating":\s*(\d+),\s*"comment":\s*"((?:[^"\\]|\\.)*)"/g;
    let m;
    while ((m = objectRegex.exec(content)) !== null) {
      reviews.push({
        id: m[1],
        vehicleId: m[2],
        reviewerName: m[3],
        rating: parseInt(m[4]),
        comment: m[5].replace(/\\"/g, '"').replace(/\\n/g, '\n'),
      });
    }
    return reviews;
  }
}

async function main() {
  console.log('🔄 Seeding Turo reviews into Supabase...');
  
  // Step 1: Make FKs nullable if they aren't
  // We use the Supabase SQL endpoint to alter the columns
  console.log('📦 Ensuring review table columns are nullable...');
  const { error: alterError } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE reviews ALTER COLUMN customer_id DROP NOT NULL;
      ALTER TABLE reviews ALTER COLUMN vehicle_id DROP NOT NULL;
      ALTER TABLE reviews ADD COLUMN IF NOT EXISTS reviewer_name VARCHAR(100);
    `
  }).catch(() => ({ error: { message: 'RPC not available' } }));
  
  if (alterError) {
    console.warn('⚠️  Could not alter table via RPC. Will attempt direct inserts.');
    console.warn('   If inserts fail, run this SQL in your Supabase SQL Editor:');
    console.warn('   ALTER TABLE reviews ALTER COLUMN customer_id DROP NOT NULL;');
    console.warn('   ALTER TABLE reviews ALTER COLUMN vehicle_id DROP NOT NULL;');
    console.warn('   ALTER TABLE reviews ADD COLUMN IF NOT EXISTS reviewer_name VARCHAR(100);');
  }
  
  // Step 2: Parse reviews from the TypeScript file
  const reviews = parseReviews();
  console.log(`📄 Found ${reviews.length} reviews to import`);
  
  if (reviews.length === 0) {
    console.error('❌ No reviews parsed from file');
    process.exit(1);
  }
  
  // Step 3: Check for existing Turo reviews
  const { count: existingCount } = await supabase
    .from('reviews')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'turo');
  
  if (existingCount > 0) {
    console.log(`ℹ️  ${existingCount} Turo reviews already exist. Skipping seed.`);
    console.log('   To re-seed, first delete: DELETE FROM reviews WHERE source = \'turo\'');
    return;
  }
  
  // Step 4: Insert in batches of 50
  const BATCH_SIZE = 50;
  let inserted = 0;
  
  for (let i = 0; i < reviews.length; i += BATCH_SIZE) {
    const batch = reviews.slice(i, i + BATCH_SIZE).map(r => ({
      rating: r.rating,
      review_text: r.comment,
      source: 'turo',
      reviewer_name: r.reviewerName,
      is_public: true,
    }));
    
    const { data, error } = await supabase
      .from('reviews')
      .insert(batch)
      .select('id');
    
    if (error) {
      console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error.message);
      if (error.message.includes('not-null')) {
        console.error('   → The customer_id/vehicle_id columns still require NOT NULL.');
        console.error('   → Run this SQL in Supabase SQL Editor:');
        console.error('     ALTER TABLE reviews ALTER COLUMN customer_id DROP NOT NULL;');
        console.error('     ALTER TABLE reviews ALTER COLUMN vehicle_id DROP NOT NULL;');
        console.error('     ALTER TABLE reviews ADD COLUMN IF NOT EXISTS reviewer_name VARCHAR(100);');
        process.exit(1);
      }
      continue;
    }
    
    inserted += (data?.length || 0);
    console.log(`  ✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${data?.length || 0} reviews inserted`);
  }
  
  console.log(`\n🎉 Done! ${inserted} / ${reviews.length} reviews seeded into Supabase.`);
  
  // Step 5: Verify average rating
  const { data: allReviews } = await supabase.from('reviews').select('rating');
  if (allReviews?.length) {
    const avg = (allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length).toFixed(2);
    console.log(`⭐ Average rating: ${avg} (from ${allReviews.length} reviews)`);
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
