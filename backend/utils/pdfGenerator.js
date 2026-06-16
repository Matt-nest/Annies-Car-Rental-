import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import brand from '../config/brand.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Per-deployment header logo: env override → trimmed asset → original logo.
// The trimmed asset should be the brand logo cropped to its content box (transparent bg).
const LOGO_ENV = process.env.BRAND_PDF_LOGO;
const LOGO_TRIMMED = path.join(__dirname, '../assets/logo-pdf.png');
const LOGO_FALLBACK = path.join(__dirname, '../assets/logo.png');
const LOGO_PATH = (LOGO_ENV && fs.existsSync(LOGO_ENV))
  ? LOGO_ENV
  : (fs.existsSync(LOGO_TRIMMED) ? LOGO_TRIMMED : LOGO_FALLBACK);

// Colors are brand-driven so every white-label clone (Annie's gold, JD Coastal
// navy/orange, …) renders the same contract in its own palette.
const C = {
  ink:   '#1a1a1a',
  label: '#000000',
  line:  '#000000',
  grey:  '#666666',
  rule:  '#111111',
  diagram: '#9aa0a6',
  // fillable-field background tint (warm peach for Annie's; clones override)
  field: brand.colors?.pdfFieldFill || '#FBE2D5',
  // top accent bar + section emphasis (brand primary)
  bar:   brand.colors?.primary || '#D4AF37',
};

const PAGE_W = 612;
const LEFT = 40;
const RIGHT = 572;
const TOTAL_PAGES = 4;

/* ──────────────────────────── primitives ──────────────────────────── */

function getSignatureBuffer(base64Image) {
  if (!base64Image) return null;
  const matches = String(base64Image).match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) return null;
  try {
    return Buffer.from(matches[2], 'base64');
  } catch {
    return null;
  }
}

/** Fillable-field background swatch (static value boxes). */
function swatch(doc, x, y, w, h = 15) {
  doc.save();
  doc.rect(x, y, w, h).fill(C.field);
  doc.restore();
}

/** Write a value inside a field box, vertically centered, single line. */
function val(doc, value, x, y, w, h = 15, { size = 9, align = 'left', bold = false } = {}) {
  if (value === null || value === undefined || value === '') return;
  doc.fillColor(C.ink).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size);
  const ty = y + (h - size) / 2 - 1;
  doc.text(String(value), x + 3, ty, { width: w - 6, height: h, align, lineBreak: false, ellipsis: true });
}

/** A printed label. */
function lbl(doc, text, x, y, { size = 9, bold = false, color = C.label } = {}) {
  doc.fillColor(color).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size);
  doc.text(text, x, y, { lineBreak: false });
}

/** Label + static value box on one line (auto-filled from booking data). */
function field(doc, label, value, labelX, y, boxX, boxW, { h = 15, labelSize = 9, valSize = 9, bold = false } = {}) {
  lbl(doc, label, labelX, y + (h - labelSize) / 2 - 0.5, { size: labelSize });
  swatch(doc, boxX, y, boxW, h);
  val(doc, value, boxX, y, boxW, h, { size: valSize, bold });
}

/**
 * Interactive, clickable/editable AcroForm text field. Pre-filled with `value`
 * when known; otherwise blank for manual completion at pickup.
 */
function editField(doc, name, x, y, w, h = 15, { value, size = 9, align = 'left' } = {}) {
  const o = { backgroundColor: C.field, fontSize: size, align };
  if (value !== undefined && value !== null && String(value) !== '') o.value = String(value);
  doc.formText(name, x, y, w, h, o);
}

/** Label + interactive editable field on one line. */
function editRow(doc, label, name, labelX, y, boxX, boxW, { h = 15, labelSize = 9, value } = {}) {
  lbl(doc, label, labelX, y + (h - labelSize) / 2 - 0.5, { size: labelSize });
  editField(doc, name, boxX, y, boxW, h, { value });
}

/** Interactive checkbox (clickable). */
function editCheck(doc, name, x, y, size = 9) {
  doc.formCheckbox(name, x, y, size, size, { backgroundColor: '#ffffff', borderColor: C.line });
}

/** Static checkbox; mark X if checked (used for auto-derived selections). */
function checkbox(doc, x, y, checked = false, size = 8) {
  doc.save();
  doc.lineWidth(0.8).rect(x, y, size, size).stroke(C.line);
  if (checked) {
    doc.lineWidth(1).moveTo(x + 1, y + 1).lineTo(x + size - 1, y + size - 1)
       .moveTo(x + size - 1, y + 1).lineTo(x + 1, y + size - 1).stroke(C.line);
  }
  doc.restore();
}

function entityLine() {
  return [brand.legalEntity, brand.dba, brand.ein ? `EIN: ${brand.ein}` : null]
    .filter(Boolean).join(' · ');
}

function addressLine() {
  const loc = brand.location || {};
  const place = [loc.address, `${loc.city || ''}, ${loc.state || ''} ${loc.zip || ''}`.trim()]
    .filter(Boolean).join(' · ');
  return [place, brand.phone].filter(Boolean).join(' · ');
}

function header(doc) {
  // brand accent bar across the very top of the page
  doc.save().rect(0, 0, PAGE_W, 6).fill(C.bar).restore();

  try {
    // fit within a fixed box so any logo aspect (landscape "Annie's" or a wide
    // "JD Coastal" lockup) sits cleanly in the top-left without overlap.
    doc.image(LOGO_PATH, 44, 22, { fit: [168, 50], valign: 'center' });
  } catch { /* logo optional */ }

  doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(21)
     .text('Car Rental Agreement', 252, 24, { width: 320, align: 'right' });
  doc.fillColor(C.grey).font('Helvetica').fontSize(8)
     .text(entityLine(), 252, 51, { width: 320, align: 'right', lineBreak: false });
  doc.text(addressLine(), 252, 62, { width: 320, align: 'right', lineBreak: false });

  doc.save().lineWidth(2).moveTo(LEFT, 84).lineTo(RIGHT, 84).stroke(C.rule).restore();
}

function footer(doc, pageNum) {
  doc.save().lineWidth(2).moveTo(LEFT, 744).lineTo(RIGHT, 744).stroke(C.rule).restore();
  doc.fillColor(C.grey).font('Helvetica').fontSize(9)
     .text([brand.phone, brand.domain, brand.email].filter(Boolean).join('    '),
       0, 750, { width: PAGE_W, align: 'center' });
  doc.fontSize(7)
     .text(`${entityLine()} · ${addressLine().replace(` · ${brand.phone}`, '')}`,
       LEFT, 765, { width: RIGHT - LEFT - 70, align: 'left', lineBreak: false });
  doc.text(`Page ${pageNum} of ${TOTAL_PAGES}`, RIGHT - 70, 765, { width: 70, align: 'right' });
}

/* ──────────────────────────── formatters ──────────────────────────── */

function fmtDate(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(d);
  return `${m[2]}/${m[3]}/${m[1]}`;
}

function fmtTime(t) {
  if (!t) return '';
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return String(t);
  let h = parseInt(m[1], 10);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${m[2]} ${ap}`;
}

function fmtStamp(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString('en-US', {
      month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function money(n) {
  if (n === null || n === undefined || n === '') return '';
  const v = Number(n);
  return Number.isNaN(v) ? '' : v.toFixed(2);
}

const FUEL_MAP = {
  full: 'Full', f: 'Full',
  three_quarter: '3/4', '3/4': '3/4', threequarter: '3/4',
  half: '1/2', '1/2': '1/2',
  quarter: '1/4', '1/4': '1/4', one_quarter: '1/4',
};
function fuelKey(v) {
  if (!v) return null;
  return FUEL_MAP[String(v).toLowerCase().replace(/\s+/g, '')] || FUEL_MAP[String(v).toLowerCase()] || null;
}

/* ──────────────────────────── pages ──────────────────────────── */

function pageOne(doc, agreement, booking, customer, vehicle, meta) {
  header(doc);

  const customerName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
  const addr  = agreement.address_line1 || '';
  const city  = agreement.city || customer.city || '';
  const state = agreement.state || customer.state || '';
  const zip   = agreement.zip || customer.zip || '';
  const dlNum = agreement.driver_license_number || customer.driver_license_number || '';
  const dlSt  = agreement.driver_license_state || customer.driver_license_state || '';
  const dlExp = fmtDate(agreement.driver_license_expiry || customer.driver_license_expiry);
  const dob   = fmtDate(agreement.date_of_birth || customer.date_of_birth);
  const phone = customer.phone || '';
  const deposit = booking.deposit_amount ?? vehicle.deposit_amount;

  // ── Top boxed block: check-out / due-back / odometer + agreement meta ──
  doc.save().lineWidth(1).rect(LEFT, 92, RIGHT - LEFT, 82).stroke(C.line).restore();

  lbl(doc, 'Vehicle Check Out:', 52, 103);
  swatch(doc, 152, 100, 74); val(doc, fmtDate(booking.pickup_date), 152, 100, 74);
  lbl(doc, '@', 232, 102);
  swatch(doc, 246, 100, 64); val(doc, fmtTime(booking.pickup_time), 246, 100, 64);
  lbl(doc, 'AM / PM', 316, 103);
  lbl(doc, 'Agreement No.', 398, 103);
  swatch(doc, 466, 100, 98); val(doc, meta.agreementNo, 466, 100, 98);

  lbl(doc, 'Vehicle Is Due Back:', 52, 128);
  swatch(doc, 152, 125, 74); val(doc, fmtDate(booking.return_date), 152, 125, 74);
  lbl(doc, '@', 232, 127);
  swatch(doc, 246, 125, 64); val(doc, fmtTime(booking.return_time), 246, 125, 64);
  lbl(doc, 'AM / PM', 316, 128);
  lbl(doc, 'Issue Date', 398, 128);
  swatch(doc, 466, 125, 98); val(doc, meta.issueDate, 466, 125, 98);

  lbl(doc, 'Odometer Reading:', 52, 153);
  lbl(doc, '@ Check Out', 148, 153);
  swatch(doc, 214, 150, 58); val(doc, booking.pickup_mileage ?? '', 214, 150, 58);
  lbl(doc, '@ Check In', 278, 153);
  editField(doc, 'odo_checkin', 342, 150, 50);
  lbl(doc, 'Reference', 398, 153);
  editField(doc, 'reference', 466, 150, 98);

  // ── Renter details ──
  field(doc, 'Car Renter:', customerName, LEFT, 192, 140, RIGHT - 140);
  field(doc, 'Home Address:', addr, LEFT, 220, 140, RIGHT - 140);

  let y = 248;
  field(doc, 'City:', city, LEFT, y, 78, 185);
  field(doc, 'State:', state, 273, y, 305, 45);
  field(doc, 'Zip:', zip, 360, y, 385, 65);
  field(doc, 'Country:', 'USA', 460, y, 505, RIGHT - 505);

  y = 276;
  field(doc, "Driver's License Number:", dlNum, LEFT, y, 178, 170);
  field(doc, 'State:', dlSt, 356, y, 388, 42);
  field(doc, 'Expiration:', dlExp, 440, y, 500, RIGHT - 500);

  y = 304;
  field(doc, 'Date of Birth:', dob, LEFT, y, 120, 160);
  field(doc, 'Phone Number:', phone, 300, y, 380, RIGHT - 380);

  y = 332;
  field(doc, 'Auto Insurance Company:', agreement.insurance_company || '', LEFT, y, 195, 170);
  field(doc, 'Policy Number:', agreement.insurance_policy_number || '', 375, y, 460, RIGHT - 460);

  // ── Credit card (editable — not stored for PCI; filled in person) ──
  y = 360;
  lbl(doc, 'Credit Card:', LEFT, y + 3);
  editCheck(doc, 'cc_visa', 130, y + 1); lbl(doc, 'Visa', 144, y + 3);
  editCheck(doc, 'cc_mc', 192, y + 1);   lbl(doc, 'Master Card', 206, y + 3);
  editCheck(doc, 'cc_amex', 300, y + 1); lbl(doc, 'American Express', 314, y + 3);
  lbl(doc, 'Other:', 430, y + 3); editField(doc, 'cc_other', 466, y, RIGHT - 466);

  y = 388;
  editRow(doc, 'Credit Card Number:', 'cc_number', LEFT, y, 170, 165);
  editRow(doc, 'Name on the Card:', 'cc_name', 350, y, 460, RIGHT - 460);

  y = 416;
  editRow(doc, 'Expiration Date:', 'cc_exp', LEFT, y, 150, 110);
  editRow(doc, 'Security Code:', 'cc_cvc', 300, y, 390, 80);

  editRow(doc, 'Billing Address:', 'cc_billing', LEFT, 444, 150, RIGHT - 150);

  y = 472;
  editRow(doc, 'City:', 'cc_city', LEFT, y, 78, 185);
  editRow(doc, 'State:', 'cc_state', 273, y, 305, 45);
  editRow(doc, 'Zip:', 'cc_zip', 360, y, 385, 65);
  editRow(doc, 'Country:', 'cc_country', 460, y, 505, RIGHT - 505);

  // ── Damage diagram + legend + deposit ──
  drawCarDiagram(doc, 100, 512);

  lbl(doc, 'X - Dent', 250, 520);
  doc.save().lineWidth(0.7).moveTo(330, 516).lineTo(330, 532).stroke(C.grey).restore();
  lbl(doc, 'No Damage', 342, 520);
  lbl(doc, '/ - Scratch', 250, 548);
  lbl(doc, '0 - Missing', 250, 576);

  doc.save().lineWidth(0.7).moveTo(300, 606).lineTo(300, 624).stroke(C.grey).restore();
  lbl(doc, 'Deposit:', 312, 611);
  lbl(doc, 'Amount: $', 378, 611);
  swatch(doc, 440, 608, 130); val(doc, money(deposit), 440, 608, 130);

  footer(doc, 1);
}

function drawCarDiagram(doc, x, y) {
  const w = 70, h = 116;
  doc.save();
  doc.lineWidth(1).strokeColor(C.diagram);
  doc.roundedRect(x, y, w, h, 22).stroke();                 // body
  doc.roundedRect(x + 11, y + 30, w - 22, 30, 6).stroke();  // front cabin / windshield
  doc.roundedRect(x + 11, y + 64, w - 22, 30, 6).stroke();  // rear window
  // wheels
  doc.lineWidth(3).strokeColor(C.diagram);
  doc.moveTo(x - 2, y + 20).lineTo(x - 2, y + 36).stroke();
  doc.moveTo(x + w + 2, y + 20).lineTo(x + w + 2, y + 36).stroke();
  doc.moveTo(x - 2, y + 80).lineTo(x - 2, y + 96).stroke();
  doc.moveTo(x + w + 2, y + 80).lineTo(x + w + 2, y + 96).stroke();
  doc.restore();
}

function pageTwo(doc, agreement, booking, customer, vehicle) {
  header(doc);

  // ── Additional driver (editable — filled in person) ──
  editRow(doc, 'Additional Driver:', 'addl_driver', LEFT, 100, 160, RIGHT - 160);
  editRow(doc, 'Home Address:', 'addl_addr', LEFT, 128, 160, RIGHT - 160);

  let y = 156;
  editRow(doc, 'City:', 'addl_city', LEFT, y, 78, 185);
  editRow(doc, 'State:', 'addl_state', 273, y, 305, 45);
  editRow(doc, 'Zip:', 'addl_zip', 360, y, 385, 65);
  editRow(doc, 'Country:', 'addl_country', 460, y, 505, RIGHT - 505);

  y = 184;
  editRow(doc, "Driver's License Number:", 'addl_dl', LEFT, y, 178, 170);
  editRow(doc, 'State:', 'addl_dl_state', 356, y, 388, 42);
  editRow(doc, 'Expiration:', 'addl_dl_exp', 440, y, 500, RIGHT - 500);

  editRow(doc, 'Date of Birth:', 'addl_dob', LEFT, 212, 120, 160);

  // ── Car Rental Rate box ──
  doc.save().lineWidth(1).rect(LEFT, 248, RIGHT - LEFT, 122).stroke(C.line).restore();
  lbl(doc, 'Car Rental Rate', 52, 256, { bold: true, size: 11 });

  y = 280;
  lbl(doc, 'Daily Rate $', 52, y + 3);
  swatch(doc, 128, y, 80); val(doc, money(booking.daily_rate), 128, y, 80);
  lbl(doc, 'Weekly Rate $', 240, y + 3);
  swatch(doc, 325, y, 80); val(doc, money(vehicle.weekly_rate), 325, y, 80);
  lbl(doc, 'Monthly Rate $', 430, y + 3);
  swatch(doc, 518, y, 47); val(doc, money(vehicle.monthly_rate), 518, y, 47);

  lbl(doc, 'Time & Mileage Charges', 52, 308, { bold: true });

  y = 328;
  lbl(doc, 'Rental Days', 52, y + 3);
  swatch(doc, 120, y, 56); val(doc, booking.rental_days ?? '', 120, y, 56);
  lbl(doc, 'Miles Allowed', 188, y + 3);
  swatch(doc, 260, y, 88);
  val(doc, vehicle.mileage_limit_per_day != null ? `${vehicle.mileage_limit_per_day} / day` : '', 260, y, 88);
  lbl(doc, 'Excess $/mile', 392, y + 3);
  editField(doc, 'excess_per_mile', 462, y, RIGHT - 462,
    15, { value: money(vehicle.excess_mileage_fee) });

  y = 350;
  lbl(doc, 'Subtotal $', 48, y + 3);
  swatch(doc, 105, y, 62); val(doc, money(booking.subtotal), 105, y, 62);
  lbl(doc, 'Tax $', 178, y + 3);
  swatch(doc, 208, y, 60); val(doc, money(booking.tax_amount), 208, y, 60);
  lbl(doc, 'Delivery Fee $', 278, y + 3);
  swatch(doc, 350, y, 58); val(doc, money(booking.delivery_fee), 350, y, 58);
  lbl(doc, 'Total Charge $', 418, y + 3, { bold: true });
  swatch(doc, 500, y, RIGHT - 500); val(doc, money(booking.total_cost), 500, y, RIGHT - 500, 15, { bold: true });

  // ── Vehicle details ──
  y = 388;
  field(doc, 'Car Year:', vehicle.year ?? '', LEFT, y, 100, 170);
  field(doc, 'Car Type:', vehicle.category || '', 290, y, 350, RIGHT - 350);
  y = 416;
  field(doc, 'Car Make:', vehicle.make || '', LEFT, y, 100, 170);
  field(doc, 'Model:', vehicle.model || '', 290, y, 350, RIGHT - 350);
  field(doc, 'VIN:', vehicle.vin || '', LEFT, 444, 80, 300);
  field(doc, 'License Tag Number:', vehicle.license_plate || '', LEFT, 472, 170, 200);

  // ── Gas tank reading (auto-derived from booking) ──
  y = 500;
  const fuel = fuelKey(booking.pickup_fuel_level);
  lbl(doc, 'Gas Tank Reading:', LEFT, y + 1);
  const gasOpts = [['Full', 160], ['3/4', 240], ['1/2', 320], ['1/4', 400]];
  for (const [label, gx] of gasOpts) {
    checkbox(doc, gx, y, fuel === label);
    lbl(doc, label, gx + 12, y + 1);
  }

  // ── Renter accepts (coverage selections — editable) ──
  y = 524;
  lbl(doc, 'Renter Accepts:', LEFT, y + 1);
  const cov = [['CDW', 'accept_cdw', 160], ['PAI', 'accept_pai', 250], ['SLP', 'accept_slp', 340], ['RAP', 'accept_rap', 430]];
  for (const [label, name, cx] of cov) {
    editCheck(doc, name, cx, y - 1);
    lbl(doc, label, cx + 12, y + 1);
  }

  // ── Fuel + keys clauses with initials (editable) ──
  doc.fillColor(C.ink).font('Helvetica').fontSize(8.5);
  doc.text(
    'The individual mentioned above in this Car Rental Contract hereby agrees to fill the fuel tank at the above ' +
    'indicated level upon returning the car. Failure to fill the tank at the prescribed level will result in an ' +
    'additional penalty charge of $20.00 per quarter tank of gasoline.',
    LEFT, 548, { width: RIGHT - LEFT, align: 'justify' }
  );
  let yy = doc.y + 4;
  editRow(doc, 'Initial:', 'fuel_initial', LEFT, yy, 80, 70);

  yy += 26;
  doc.fillColor(C.ink).font('Helvetica').fontSize(8.5);
  doc.text("It is the Car Renter's responsibility for all lost car keys and / or a lockout situation.",
    LEFT, yy, { width: RIGHT - LEFT });
  yy = doc.y + 4;
  editRow(doc, 'Initial:', 'keys_initial', LEFT, yy, 80, 70);

  // ── Liability paragraph P1 (continues onto page 3) ──
  doc.fillColor(C.ink).font('Helvetica').fontSize(9);
  doc.text(
    'Only the person(s) that are listed on this Car Rental Agreement and above the age of twenty-one may drive ' +
    'this vehicle. The above mentioned Car Renter is hereby responsible for all collision damage to the vehicle ' +
    'regardless if someone else is at fault or the cause is not known. The Car Renter is fully responsible for the ' +
    'cost of any repair up to the value of the vehicle. The Car Renter’s Insurance may cover all or only part ' +
    'of the financial liability for the rented vehicle.',
    LEFT, yy + 26, { width: RIGHT - LEFT, align: 'justify' }
  );

  footer(doc, 2);
}

function pageThree(doc, agreement, booking, customer, vehicle) {
  header(doc);

  const W = RIGHT - LEFT;
  let y = 100;
  const para = (text, { size = 9, gap = 8, bold = false } = {}) => {
    doc.fillColor(C.ink).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size);
    doc.text(text, LEFT, y, { width: W, align: 'justify' });
    y = doc.y + gap;
  };

  para(
    'Car Renter should check with their insurance company regarding their coverage and what they are and are not ' +
    'liable for. If there is no breach of this contract the Car Renter and any authorized driver is provided ' +
    'liability insurance and is limited to the minimum financial responsibility as required by state law. Liability ' +
    'Insurance will only be in excess over any and all additional collectible insurance. The above mentioned Car ' +
    'Renter hereby waives all uninsured and under insured motorists, no fault and any other optional additional ' +
    'coverage. If such additional coverage cannot be waived or excluded then the Car Renter agrees that such ' +
    'coverage will be limited to only the minimum state requirements.'
  );

  para(
    'The Car Renter is hereby bound by the terms and conditions of this Car Rental Agreement. The vehicle must be ' +
    'returned to the same location in which it was picked up for rental and on or before the above indicated due ' +
    'back date and time. There will be additional fees due if the vehicle is not returned as specified above. ' +
    'Where it is permitted by law the Car Renter hereby authorizes us to process their credit card information in ' +
    `their name for all Car Rental charges, including the full vehicle value of any vehicle that is not returned to ${brand.name}, ` +
    'all fines, towing, any court costs, penalties, and or administrative fees that we may incur for parking, ' +
    'traffic and or other violations that may be incurred by the Car Renter during the Car Rental term period as ' +
    'stated above and to apply any payments made to the charges in whatever order that the Car Rental Company ' +
    'sees as necessary.'
  );

  // General Policies acknowledgement
  editCheck(doc, 'agree_policies', LEFT, y);
  lbl(doc, 'By checking the box, the Car Renter agrees to the Terms and Conditions stated in the General Policies Form',
    LEFT + 14, y + 1);
  y += 22;

  para(
    `Card on File / Incidental Charges: Car Renter authorizes ${brand.name} to keep the credit card on file and charge it for ` +
    'incidentals and amounts due under this Agreement, including tolls, tickets, fuel, cleaning/smoking fees, ' +
    'late-return fees, damage, towing/recovery costs, administrative fees, and other applicable charges.',
    { size: 8 }
  );

  // ── Violation fees (editable amounts) ──
  const feeRow = (label, name, desc) => {
    lbl(doc, label, LEFT, y + 1);
    lbl(doc, 'Amount:', 230, y + 1);
    editField(doc, name, 280, y - 1, 180, 15);
    y += 17;
    doc.fillColor(C.grey).font('Helvetica').fontSize(7.5).text(desc, LEFT, y, { width: W });
    y = doc.y + 9;
  };
  feeRow('Smoke Violation Fee', 'smoke_fee',
    'A fee will be charged if any evidence of smoking, smoke odor, or related residue is found inside the vehicle upon return.');
  feeRow('Late Return Violation Fee', 'late_fee',
    'A fee will be charged for returning the vehicle after the agreed-upon due date and time stated in this Car Rental Agreement.');
  feeRow('Cleaning / Pet / Excessive Dirt Fee', 'cleaning_fee',
    'A fee may be charged for excessive dirt, stains, pet hair or odor, trash, biohazard, or cleaning beyond normal use.');

  // ── Additional Charges & Required Notices ──
  y += 2;
  lbl(doc, 'Additional Charges & Required Notices', LEFT, y, { bold: true, size: 10 });
  y += 14;
  doc.save().lineWidth(0.7).moveTo(LEFT, y).lineTo(RIGHT, y).stroke(C.grey).restore();
  y += 8;

  // Excess Mileage Fee
  lbl(doc, 'Excess Mileage Fee: $', LEFT, y + 1, { bold: true });
  editField(doc, 'excess_mileage_fee', 150, y - 1, 70, 15, { value: money(vehicle.excess_mileage_fee) });
  lbl(doc, 'per mile for each mile over the Miles Allowed stated in this Agreement.', 226, y + 1);
  y += 22;

  // Toll / Transponder admin fee
  lbl(doc, 'Toll / Transponder / Toll-By-Plate Admin Fee: $', LEFT, y + 1, { bold: true });
  editField(doc, 'toll_fee', 252, y - 1, 60, 15);
  doc.fillColor(C.grey).font('Helvetica').fontSize(7.5).text(
    'per toll, invoice, or transaction, plus actual tolls, toll-by-plate charges, transponder charges, citations, ' +
    'violations, and related fees. These may be charged to the card on file after return.',
    320, y, { width: RIGHT - 320 });
  y = Math.max(y + 22, doc.y + 6);

  // Deposit refund timing
  lbl(doc, 'Deposit Refund Timing: Security deposit will be released/refunded within', LEFT, y + 1);
  editField(doc, 'deposit_refund_within', 358, y - 1, 120, 15);
  y += 22;

  doc.fillColor(C.grey).font('Helvetica').fontSize(7.5);
  doc.text(
    `Accident / Police Report / Incident Notice: Renter must immediately notify ${brand.name} of any accident, damage, theft, ` +
    'citation, impound, towing, or police interaction involving the vehicle. Renter must obtain a police or incident ' +
    `report when available and provide copies to ${brand.name}.`,
    LEFT, y, { width: W });
  y = doc.y + 8;
  doc.text(
    `Extension Approval Rule: Any extension must be requested and approved by ${brand.name} in writing before the due-back ` +
    'date/time. Keeping the vehicle without written approval may result in late charges, recovery/towing, and other ' +
    'applicable charges.',
    LEFT, y, { width: W });
  y = doc.y + 10;

  lbl(doc, 'Primary Insurance Notice - Florida Statute 627.7263:', LEFT, y, { bold: true, size: 9 });
  y += 13;
  doc.fillColor(C.ink).font('Helvetica').fontSize(8.5).text(
    'The valid and collectible liability insurance and personal injury protection insurance of any authorized rental ' +
    'or leasing driver is primary for the limits of liability and personal injury protection coverage required by ' +
    'ss. 324.021(7) and 627.736, Florida Statutes.',
    LEFT, y, { width: W });
  y = doc.y + 10;

  lbl(doc, 'Additional Terms Initials:', LEFT, y + 1, { bold: true });
  editField(doc, 'addl_terms_initials', 160, y - 1, 90, 15);

  footer(doc, 3);
}

function pageFour(doc, agreement, booking, customer, vehicle) {
  header(doc);

  doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(16)
     .text('Acknowledgment & Signatures', LEFT, 104);

  doc.fillColor(C.ink).font('Helvetica').fontSize(9).text(
    `By signing below, the Car Renter, any Additional Car Renter, and ${brand.name} acknowledge and agree to this Car ` +
    'Rental Agreement, including all charges, notices, policies, vehicle return obligations, card-on-file ' +
    'authorization, and the Additional Charges & Required Notices stated above.',
    LEFT, 136, { width: RIGHT - LEFT, align: 'justify' }
  );

  const sigW = 300, dateX = 410, dateW = 160;

  // Car Renter (auto-filled from the customer's captured e-signature)
  lbl(doc, 'Car Renter', LEFT, 210, { bold: true, size: 11 });
  signatureRow(doc, 'Signature', 'Date', LEFT, 226, sigW, dateX, dateW,
    agreement.customer_signature_data, agreement.customer_signed_at);

  // Additional Car Renter (manual — editable date)
  lbl(doc, 'Additional Car Renter', LEFT, 318, { bold: true, size: 11 });
  signatureRow(doc, 'Signature', 'Date', LEFT, 334, sigW, dateX, dateW, null, null,
    { dateFieldName: 'addl_renter_date' });

  // Company acceptance (auto-filled from owner counter-signature)
  lbl(doc, `Accepted By ${brand.name}:`, LEFT, 426, { bold: true, size: 11 });
  signatureRow(doc, 'Authorized Representative', 'Date', LEFT, 442, sigW, dateX, dateW,
    agreement.owner_signature_data, agreement.owner_signed_at);

  footer(doc, 4);
}

function signatureRow(doc, label, dateLabel, x, y, sigW, dateX, dateW, sigData, signedAt, { dateFieldName } = {}) {
  const boxH = 34;
  swatch(doc, x, y, sigW, boxH);

  const sigBuf = getSignatureBuffer(sigData);
  if (sigBuf) {
    try { doc.image(sigBuf, x + 8, y + 2, { height: boxH - 6 }); } catch { /* ignore */ }
  }

  if (signedAt) {
    swatch(doc, dateX, y, dateW, boxH);
    val(doc, fmtStamp(signedAt), dateX, y, dateW, boxH, { size: 9 });
  } else if (dateFieldName) {
    doc.formText(dateFieldName, dateX, y, dateW, boxH, { backgroundColor: C.field, fontSize: 9 });
  } else {
    swatch(doc, dateX, y, dateW, boxH);
  }

  const ly = y + boxH + 4;
  doc.save().lineWidth(0.8);
  doc.moveTo(x, ly).lineTo(x + sigW, ly).stroke(C.line);
  doc.moveTo(dateX, ly).lineTo(dateX + dateW, ly).stroke(C.line);
  doc.restore();
  lbl(doc, label, x, ly + 4);
  lbl(doc, dateLabel, dateX, ly + 4);
}

/* ──────────────────────────── entry point ──────────────────────────── */

/**
 * Generates the 4-page rental agreement PDF and pipes it to the given writable
 * stream (HTTP response or file stream). Booking data is auto-filled; fields
 * that must be completed in person (credit card, additional driver, fees,
 * initials, coverage selections) are interactive/editable AcroForm fields.
 * Signature unchanged for the route: (agreement, booking, res).
 */
export async function generateRentalAgreementPdf(agreement, booking, res) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'LETTER', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
      const customer = booking.customers || {};
      const vehicle = booking.vehicles || {};

      // Interactive form fields require a font + initialized AcroForm.
      doc.font('Helvetica');
      doc.initForm();

      const meta = {
        agreementNo: booking.booking_code || '',
        issueDate: fmtDate((agreement.created_at || agreement.customer_signed_at || new Date().toISOString()).slice(0, 10)),
      };

      doc.pipe(res);

      pageOne(doc, agreement, booking, customer, vehicle, meta);
      doc.addPage();
      pageTwo(doc, agreement, booking, customer, vehicle);
      doc.addPage();
      pageThree(doc, agreement, booking, customer, vehicle);
      doc.addPage();
      pageFour(doc, agreement, booking, customer, vehicle);

      doc.end();

      res.on('finish', resolve);
      res.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}
