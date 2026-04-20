/**
 * Template Preview Script
 * Renders all 4 updated templates with test data for visual review.
 * Run: node backend/scripts/preview_templates.js
 * Output: backend/scripts/preview_output/ (4 HTML files)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Template engine (inlined to avoid Supabase dependency) ────────────────

const HTML_SAFE_FIELDS = new Set([
  'handoff_photos', 'vehicle_photo_url', 'vehicle_info_block',
  'confirm_link', 'status_link', 'portal_link', 'review_link', 'invoice_link',
]);

function interpolateTemplate(template, fields, isHtml = false) {
  if (!template) return '';
  // Process conditionals from innermost to outermost
  let result = template;
  var ifPattern = /\{\{#if\s+(\w+)\}\}((?:(?!\{\{#if)[\s\S])*?)\{\{\/if\}\}/g;
  var maxIter = 10;
  while (ifPattern.test(result) && maxIter-- > 0) {
    result = result.replace(ifPattern, function(_match, key, content) {
      var val = fields[key];
      var isTruthy = val !== undefined && val !== null && val !== '' && val !== '[]' && val !== '""';
      return isTruthy ? content : '';
    });
  }
  result = result.replace(/\{\{(\w+)\}\}/g, function(match, key) {
    var val = fields[key] !== undefined && fields[key] !== '' ? String(fields[key]) : match;
    if (isHtml && val !== match && !HTML_SAFE_FIELDS.has(key)) {
      val = val.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    return val;
  });
  return result;
}

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderPhotoGallery(urls) {
  if (!urls || urls.length === 0) return '';
  var cells = urls.map(function(url) {
    return '<td style="padding:4px;"><img src="' + escapeHtml(url) + '" alt="Vehicle photo" style="width:100%;max-width:240px;border-radius:8px;border:1px solid #e7e5e4;" /></td>';
  }).join('');
  return '<table cellpadding="0" cellspacing="0" border="0" style="width:100%;"><tr>' + cells + '</tr></table>';
}

function wrapInBrandedHTML(subject, bodyText) {
  var siteUrl = 'https://anniescarrental.com';
  var logoUrl = siteUrl + '/logo-white.png';
  var bodyHtml = bodyText
    .split('\n\n')
    .map(function(p) {
      var inner = p.split('\n').join('<br/>');
      return '<p style="margin:0 0 16px;line-height:1.6;font-size:15px;color:#44403c;">' + inner + '</p>';
    })
    .join('');

  return '<!DOCTYPE html>\n<html>\n<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>\n' +
    '<body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;color:#1c1917;">\n' +
    '  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;border:1px solid #e7e5e4;overflow:hidden;">\n' +
    '    <div style="height:4px;background:linear-gradient(90deg,#c8a97e 0%,#d4af37 50%,#c8a97e 100%);"></div>\n' +
    '    <div style="background:#1c1917;padding:28px 32px;">\n' +
    '      <div style="margin-bottom:16px;">\n' +
    '        <img src="' + logoUrl + '" alt="Annie\'s Car Rental" width="140" height="auto" style="display:block;max-width:140px;" />\n' +
    '      </div>\n' +
    '      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:600;letter-spacing:-0.01em;">' + escapeHtml(subject) + '</h1>\n' +
    '    </div>\n' +
    '    <div style="padding:32px;">' + bodyHtml + '</div>\n' +
    '    <div style="padding:24px 32px;border-top:1px solid #e7e5e4;background:#fafaf9;text-align:center;">\n' +
    '      <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#78716c;">Annie\'s Car Rental</p>\n' +
    '      <p style="margin:0 0 4px;font-size:12px;color:#a8a29e;">Port St. Lucie, FL · (772) 985-6667</p>\n' +
    '      <p style="margin:0;font-size:11px;color:#d6d3d1;">\n' +
    '        <a href="' + siteUrl + '" style="color:#c8a97e;text-decoration:none;">anniescarrental.com</a>\n' +
    '      </p>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</body>\n</html>';
}

// ── Template bodies (plain strings, no template literals) ─────────────────

var vehicleBlock = [
  '{{#if vehicle_year_make_model}}YOUR VEHICLE',
  '───────────────────────',
  '{{#if vehicle_photo_url}}<img src="{{vehicle_photo_url}}" alt="{{vehicle_year_make_model}}" style="width:100%;max-width:400px;border-radius:12px;margin-bottom:12px;" />',
  '{{/if}}{{vehicle_year_make_model}}{{#if vehicle_color}}',
  'Color: {{vehicle_color}}{{/if}}{{#if vehicle_plate}}',
  'Plate: {{vehicle_plate}}{{/if}}{{#if vehicle_vin}}',
  'VIN:   {{vehicle_vin}}{{/if}}',
  '{{/if}}',
].join('\n');

var handoffBlock = [
  '{{#if handoff_fuel_level}}VEHICLE CONDITION AT HANDOFF',
  '──────────────────────────',
  'Fuel Level:  {{handoff_fuel_level}}',
  '{{#if handoff_odometer}}Odometer:    {{handoff_odometer}} mi{{/if}}',
  '{{#if handoff_photos}}',
  'Inspection Photos:',
  '{{handoff_photos}}{{/if}}',
  '{{/if}}',
].join('\n');

var TEMPLATES = {
  booking_approved: {
    subject: 'Confirmed: Your {{vehicle}} is reserved — {{booking_code}}',
    body: [
      'Hi {{first_name}},',
      '',
      "Your booking has been approved. Here's your confirmation:",
      '',
      'RESERVATION CONFIRMED ✓',
      '───────────────────────',
      'Reference:  {{booking_code}}',
      'Vehicle:    {{vehicle}}',
      'Pickup:     {{pickup_date}} at {{pickup_time}}',
      'Return:     {{return_date}} at {{return_time}}',
      'Duration:   {{rental_days}} days',
      'Total:      ${{total_cost}}',
      '',
      vehicleBlock,
      '',
      'WHAT TO EXPECT',
      "• 24 hours before pickup — You'll receive a text with the exact address, lockbox code, and parking location.",
      '• Day of pickup — A final reminder with directions.',
      "• During your rental — We're a text or call away if you need anything.",
      '',
      "Questions? We're here:",
      '  Matthew: (772) 834-0117',
      '  Robin:   (772) 834-7637',
      '',
      "Annie's Car Rental",
      'Port Saint Lucie, FL',
    ].join('\n'),
  },

  payment_confirmed: {
    subject: 'Payment received — ${{amount}} for booking {{booking_code}}',
    body: [
      'Hi {{first_name}},',
      '',
      "We've received your payment. Here's your receipt:",
      '',
      'PAYMENT RECEIPT',
      '───────────────',
      'Amount:     ${{amount}}',
      'Method:     {{payment_method}}',
      'Date:       {{payment_date}}',
      'Booking:    {{booking_code}}',
      '',
      vehicleBlock,
      '',
      'Questions about billing? Call us at (772) 834-0117.',
      '',
      "Annie's Car Rental",
    ].join('\n'),
  },

  ready_for_pickup: {
    subject: 'Your {{vehicle}} is ready — {{booking_code}}',
    body: [
      'Hi {{first_name}},',
      '',
      'Your vehicle is prepped, cleaned, and ready for you.',
      '',
      'PICKUP DETAILS',
      '──────────────',
      'Vehicle:    {{vehicle}}',
      'Reference:  {{booking_code}}',
      'Pickup:     {{pickup_date}} at {{pickup_time}}',
      '',
      vehicleBlock,
      '',
      handoffBlock,
      '',
      'HOW TO PICK UP YOUR VEHICLE',
      '',
      '1. Go to 586 NW Mercantile Pl, Port Saint Lucie, FL 34986',
      '2. Head to the back of the building',
      '3. Find your vehicle — the key is in the lockbox on the window',
      '4. Enter code {{lockbox_code}} to retrieve the key',
      '5. Remove the lockbox from the window before driving',
      '',
      'SELF-SERVICE CHECK-IN',
      'Once you have the key, complete your check-in through your Rental Portal:',
      '→ {{status_link}}',
      '',
      'Questions? Call or text us at (772) 985-6667.',
      '',
      "Annie's Car Rental",
      'Port Saint Lucie, FL',
    ].join('\n'),
  },

  pickup_reminder: {
    subject: 'Pickup tomorrow: Your {{vehicle}} is ready — {{booking_code}}',
    body: [
      'Hi {{first_name}},',
      '',
      "Your rental starts tomorrow. Here's everything you need:",
      '',
      'PICKUP DETAILS',
      '──────────────',
      'Date:       {{pickup_date}} at {{pickup_time}}',
      'Vehicle:    {{vehicle}}',
      'Reference:  {{booking_code}}',
      '',
      vehicleBlock,
      '',
      handoffBlock,
      '',
      'PICKUP LOCATION',
      '586 NW Mercantile Pl',
      'Port Saint Lucie, FL 34986',
      '→ Park and walk to the back of the building.',
      '',
      'HOW TO GET YOUR KEYS',
      '1. Locate your vehicle in the back lot',
      '2. Find the key lockbox attached to the window',
      '3. Enter code: {{lockbox_code}}',
      '4. Remove the lockbox from the window before driving',
      '',
      'IMPORTANT REMINDERS',
      '• Fuel — Return the vehicle with the same fuel level you receive it with.',
      '• No smoking — Vehicles are smoke-free. A $150 cleaning fee applies.',
      '• No pets — A $150 cleaning fee applies.',
      "• Text us when you arrive so we know you're all set.",
      '',
      'CONTACT',
      '  Matthew: (772) 834-0117',
      '  Robin:   (772) 834-7637',
      '  Aaron:   (772) 985-6667',
      '',
      "Annie's Car Rental",
      'Port Saint Lucie, FL',
    ].join('\n'),
  },
};

// ── Test Data ─────────────────────────────────────────────────────────────

var FULL_DATA = {
  first_name: 'Sarah',
  last_name: 'Johnson',
  booking_code: 'ACR-2026-0421',
  vehicle: '2024 Nissan Altima',
  pickup_date: 'Mon, Apr 21, 2026',
  pickup_time: '10:00 AM',
  return_date: 'Fri, Apr 25, 2026',
  return_time: '10:00 AM',
  rental_days: '4',
  total_cost: '219.96',
  lockbox_code: '2580',
  amount: '219.96',
  payment_method: 'Visa ending in 4242',
  payment_date: 'Sun, Apr 20, 2026',
  status_link: 'https://anniescarrental.com/booking-status?code=ACR-2026-0421',
  vehicle_photo_url: 'https://anniescarrental.com/fleet/1N4BL4DV7PN338432/hero.png',
  vehicle_year_make_model: '2024 Nissan Altima',
  vehicle_color: 'Pearl White',
  vehicle_plate: 'ABC 1234',
  vehicle_vin: '1N4BL4DV7PN338432',
  handoff_fuel_level: 'Full',
  handoff_odometer: '42,350',
  handoff_photos: '',
};

var handoffPhotoUrls = [
  'https://placehold.co/400x300/1c1917/c8a97e?text=Front+View',
  'https://placehold.co/400x300/1c1917/c8a97e?text=Driver+Side',
  'https://placehold.co/400x300/1c1917/c8a97e?text=Rear+View',
];

// ── Render ────────────────────────────────────────────────────────────────

var outDir = path.join(__dirname, 'preview_output');
fs.mkdirSync(outDir, { recursive: true });

for (var [stage, tmpl] of Object.entries(TEMPLATES)) {
  // Full data scenario
  var fields = Object.assign({}, FULL_DATA);
  if (stage === 'ready_for_pickup' || stage === 'pickup_reminder') {
    fields.handoff_photos = renderPhotoGallery(handoffPhotoUrls);
  }

  var subject = interpolateTemplate(tmpl.subject, fields, false);
  var body = interpolateTemplate(tmpl.body, fields, true);
  var html = wrapInBrandedHTML(subject, body);
  var filename = stage + '_full.html';
  fs.writeFileSync(path.join(outDir, filename), html);
  console.log('✓ ' + filename);

  // Sparse data scenario (no photo, no plate, no color, no handoff)
  var sparse = Object.assign({}, fields);
  sparse.vehicle_photo_url = '';
  sparse.vehicle_color = '';
  sparse.vehicle_plate = '';
  sparse.handoff_fuel_level = '';
  sparse.handoff_odometer = '';
  sparse.handoff_photos = '';
  
  var sparseSubject = interpolateTemplate(tmpl.subject, sparse, false);
  var sparseBody = interpolateTemplate(tmpl.body, sparse, true);
  var sparseHtml = wrapInBrandedHTML(sparseSubject, sparseBody);
  var sparseFilename = stage + '_sparse.html';
  fs.writeFileSync(path.join(outDir, sparseFilename), sparseHtml);
  console.log('✓ ' + sparseFilename);
}

console.log('\nAll previews written to: ' + outDir);
console.log('Open any HTML file in a browser to verify rendering.');
