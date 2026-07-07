#!/usr/bin/env node
/**
 * Apply redesigned email_templates copy to Supabase.
 *
 * Reads the pre-generated UPSERT SQL for the current brand (from
 * backend/db/seeds/redesign_email_copy.*.sql) and executes it via the
 * Supabase REST SQL API (service role required).
 *
 * Usage (from backend/):
 *   node scripts/apply_email_copy.mjs              # auto-picks SQL from BRAND_NAME
 *   node scripts/apply_email_copy.mjs --file db/seeds/redesign_email_copy.jdcoastal.sql
 *   node scripts/apply_email_copy.mjs --dry-run
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_KEY in backend/.env or env.
 */
import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import brand from '../config/brand.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEEDS = join(__dirname, '../db/seeds');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const fileArg = args.find((a) => a.startsWith('--file='))?.slice(7)
  || (args.includes('--file') ? args[args.indexOf('--file') + 1] : null);

function defaultSqlPath() {
  const slug = (brand.name || '').toLowerCase().includes('jd coastal')
    ? 'redesign_email_copy.jdcoastal.sql'
    : 'redesign_email_copy.annies.sql';
  return join(SEEDS, slug);
}

const sqlPath = fileArg ? join(process.cwd(), fileArg) : defaultSqlPath();

if (!existsSync(sqlPath)) {
  console.error(`SQL file not found: ${sqlPath}`);
  console.error('Generate with: node db/seeds/redesign_email_copy.mjs > db/seeds/redesign_email_copy.<brand>.sql');
  process.exit(1);
}

const sql = readFileSync(sqlPath, 'utf8');
const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;

console.log(`Brand:  ${brand.name}`);
console.log(`SQL:    ${sqlPath}`);
console.log(`Stages: ${(sql.match(/INSERT INTO email_templates/g) || []).length} UPSERTs`);

if (dryRun) {
  console.log('\n--dry-run: SQL not executed.');
  process.exit(0);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('\nMissing SUPABASE_URL or SUPABASE_SERVICE_KEY.');
  console.error('Set them in backend/.env, then re-run.');
  process.exit(1);
}

const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
if (!projectRef) {
  console.error('Could not parse project ref from SUPABASE_URL');
  process.exit(1);
}

console.log(`\nApplying to Supabase project ${projectRef}…`);

const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
}).catch(() => null);

// exec_sql RPC may not exist — fall back to pg meta or instruct manual apply
if (!res || res.status === 404) {
  console.log('\n⚠️  No exec_sql RPC on this project. Apply manually:');
  console.log('   1. Open Supabase → SQL Editor');
  console.log(`   2. Paste contents of ${sqlPath}`);
  console.log('   3. Run');
  process.exit(0);
}

if (!res.ok) {
  const err = await res.text();
  console.error(`\n❌ Apply failed (${res.status}):`, err);
  console.error('\nApply manually via Supabase SQL Editor.');
  process.exit(1);
}

const data = await res.json().catch(() => ({}));
console.log('\n✅ Templates updated.', data?.length ? `${data.length} rows returned.` : '');
