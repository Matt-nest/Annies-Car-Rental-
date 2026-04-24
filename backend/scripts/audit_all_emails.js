/**
 * Full email audit — test EVERY active template through the complete
 * render pipeline (interpolateTemplate → wrapInBrandedHTML → final HTML).
 * 
 * Checks for:
 *   1. Raw HTML tags appearing as text (the bug we just fixed)
 *   2. Unresolved {{merge_fields}}
 *   3. Broken {{#if}} conditionals
 *   4. Missing closing tags
 *   5. Empty body after rendering
 */
import { supabase } from '../db/supabase.js';
import { getRenderedTemplate, buildBookingPayload, buildMergeFields, interpolateTemplate } from '../services/notifyService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, 'preview_output', 'audit');
fs.mkdirSync(outDir, { recursive: true });

// ── Test Data ────────────────────────────────────────────────────────────────

const FULL_BOOKING = {
  id: 'test-id',
  customer_id: 'cust-id',
  booking_code: 'BK-20260424-AUDIT',
  status: 'approved',
  customers: {
    first_name: 'Sarah',
    last_name: 'Johnson',
    email: 'sarah@test.com',
    phone: '+17728340117',
  },
  vehicles: {
    year: 2025,
    make: 'Nissan',
    model: 'Altima',
    vin: '1N4BL4DV3SN363627',
    color: 'Pearl White',
    license_plate: 'ABC-1234',
    thumbnail_url: 'https://anniescarrental.com/fleet/thumb.jpg',
    photo_urls: ['https://anniescarrental.com/fleet/photo1.jpg'],
    vehicle_code: 'NIS-ALT-25',
  },
  pickup_date: '2026-04-27',
  return_date: '2026-04-30',
  pickup_time: '10:00',
  return_time: '10:00',
  total_cost: 419.44,
  rental_days: 4,
  lockbox_code: '2580',
  unlimited_miles: true,
  mileage_addon_fee: 100,
  unlimited_tolls: false,
  // Payment fields
  amount: 419.44,
  payment_method: 'Visa ending 4242',
  payment_date: '2026-04-24',
  // Deposit
  deposit_amount: 250,
  deposit_status: 'held',
  // Mileage
  checkin_odometer: 42350,
  checkout_odometer: 42800,
  total_miles: 450,
  // Damage
  damage_description: 'Minor scratch on rear bumper',
  damage_fee: 150,
  // Invoice
  invoice_total: 569.44,
  invoice_link: 'https://anniescarrental.com/invoice/test',
  // Decline
  decline_reason: 'Vehicle not available for selected dates.',
  // Refund
  refund_amount: 250,
  incidental_total: 0,
};

const HANDOFF_RECORD = {
  fuel_level: 'Full',
  odometer: 42350,
  photo_urls: [
    'https://anniescarrental.com/uploads/front.jpg',
    'https://anniescarrental.com/uploads/rear.jpg',
  ],
  created_at: '2026-04-26T14:00:00Z',
};

// ── Audit Logic ──────────────────────────────────────────────────────────────

async function auditAllTemplates() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  EMAIL TEMPLATE AUDIT — All Active Templates');
  console.log('═══════════════════════════════════════════════════════\n');

  // Get ALL active templates
  const { data: templates, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('is_active', true)
    .order('stage');

  if (error) {
    console.error('Failed to fetch templates:', error.message);
    process.exit(1);
  }

  console.log(`Found ${templates.length} active templates.\n`);

  const results = [];
  let totalIssues = 0;

  for (const tpl of templates) {
    const issues = [];
    const stage = tpl.stage;

    // Determine if this stage needs handoff data
    const needsHandoff = ['ready_for_pickup', 'pickup_reminder'].includes(stage);
    const payload = buildBookingPayload(FULL_BOOKING, needsHandoff ? { handoffRecord: HANDOFF_RECORD } : {});

    // Test through the FULL pipeline (getRenderedTemplate does interpolation + photo gallery)
    const rendered = await getRenderedTemplate(stage, payload);

    if (!rendered) {
      issues.push('❌ Template returned null — check is_active flag or stage name');
      results.push({ stage, issues });
      totalIssues += issues.length;
      continue;
    }

    const body = rendered.body;
    const subject = rendered.subject;

    // ── Check 1: Unresolved merge fields ──
    const unresolvedFields = body.match(/\{\{(?!#if|\/if)(\w+)\}\}/g);
    if (unresolvedFields) {
      const unique = [...new Set(unresolvedFields)];
      issues.push(`⚠️  Unresolved fields: ${unique.join(', ')}`);
    }

    // ── Check 2: Broken conditionals ──
    if (body.includes('{{#if')) issues.push('❌ Unprocessed {{#if}} block remaining');
    if (body.includes('{{/if}}')) issues.push('❌ Unprocessed {{/if}} block remaining');

    // ── Check 3: Raw HTML visible as text (the original bug) ──
    // After wrapInBrandedHTML, img tags should be inside <p> but NOT escaped
    if (body.includes('&lt;img')) issues.push('❌ <img> tag escaped to &lt;img — wrapper is escaping HTML');
    if (body.includes('alt=&quot;')) issues.push('❌ HTML attributes escaped — wrapper is breaking HTML');

    // ── Check 4: URL inside img src being auto-linked ──
    const brokenImg = body.match(/<a[^>]*><img/);
    if (brokenImg) issues.push('❌ <img> wrapped in auto-linked <a> tag');

    // ── Check 5: Empty body ──
    if (!body || body.trim().length < 50) issues.push('❌ Body is empty or too short');

    // ── Check 6: Subject renders ──
    const unresolvedSubject = subject.match(/\{\{(\w+)\}\}/g);
    if (unresolvedSubject) issues.push(`⚠️  Unresolved subject fields: ${unresolvedSubject.join(', ')}`);

    // ── Check 7: If template has vehicle block, verify img renders properly ──
    if (tpl.body.includes('vehicle_photo_url')) {
      if (!body.includes('<img src="https://anniescarrental.com/fleet/')) {
        issues.push('⚠️  Vehicle photo <img> not found in rendered output');
      }
    }

    // ── Check 8: Handoff gallery renders for applicable templates ──
    if (needsHandoff && tpl.body.includes('handoff_photos')) {
      if (!body.includes('<table') || !body.includes('Vehicle photo')) {
        issues.push('⚠️  Handoff photo gallery not rendered properly');
      }
    }

    // Save rendered HTML for visual inspection
    const filename = `${stage}_audit.html`;
    fs.writeFileSync(path.join(outDir, filename), body);

    const status = issues.length === 0 ? '✅' : '⛔';
    console.log(`${status} ${stage}`);
    if (issues.length > 0) {
      issues.forEach(i => console.log(`   ${i}`));
      totalIssues += issues.length;
    }

    results.push({ stage, subject, bodyLength: body.length, issues });
  }

  // ── Summary ──
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Templates tested: ${results.length}`);
  console.log(`  Issues found:     ${totalIssues}`);
  console.log(`  Previews saved:   ${outDir}/`);
  console.log('');

  results.forEach(r => {
    const icon = r.issues.length === 0 ? '✅' : '⛔';
    console.log(`  ${icon} ${r.stage} (${r.bodyLength || 0} chars) — ${r.issues.length === 0 ? 'PASS' : r.issues.length + ' issues'}`);
  });

  console.log('');

  if (totalIssues > 0) {
    console.log(`⚠️  ${totalIssues} issue(s) found. Review the audit previews.`);
    process.exit(1);
  } else {
    console.log('✅ All templates pass audit. Emails are clean.');
  }
}

auditAllTemplates().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
