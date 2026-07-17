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

const C = {
  ink:   '#1a1a1a',
  label: '#000000',
  peach: '#FBE2D5',
  line:  '#000000',
  grey:  '#666666',
  rule:  '#111111',
  diagram: '#9aa0a6',
};

const PAGE_W = 612;
const LEFT = 40;
const RIGHT = 572;

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

/** Light salmon fillable-field background. */
function peach(doc, x, y, w, h = 15) {
  doc.save();
  doc.rect(x, y, w, h).fill(C.peach);
  doc.restore();
}

/** Write a value inside a (peach) field box, vertically centered, single line. */
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

/** Label + peach box on one line (box vertically aligned to label row at `y`). */
function field(doc, label, value, labelX, y, boxX, boxW, { h = 15, labelSize = 9, valSize = 9, bold = false } = {}) {
  lbl(doc, label, labelX, y + (h - labelSize) / 2 - 0.5, { size: labelSize });
  peach(doc, boxX, y, boxW, h);
  val(doc, value, boxX, y, boxW, h, { size: valSize, bold });
}

/** Small empty checkbox; mark X if checked. */
function checkbox(doc, x, y, checked = false, size = 8) {
  doc.save();
  doc.lineWidth(0.8).rect(x, y, size, size).stroke(C.line);
  if (checked) {
    doc.lineWidth(1).moveTo(x + 1, y + 1).lineTo(x + size - 1, y + size - 1)
       .moveTo(x + size - 1, y + 1).lineTo(x + 1, y + size - 1).stroke(C.line);
  }
  doc.restore();
}

function header(doc) {
  try {
    // fit within a fixed box so any logo aspect (landscape "Annie's" or
    // near-square "JD Coastal") sits cleanly in the top-left without overlap.
    doc.image(LOGO_PATH, 44, 26, { fit: [150, 54], valign: 'center' });
  } catch { /* logo optional */ }
  doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(20)
     .text('Car Rental Agreement', 200, 42, { width: 372, align: 'center' });
  doc.save().lineWidth(2).moveTo(LEFT, 84).lineTo(RIGHT, 84).stroke(C.rule).restore();
}

function footer(doc) {
  doc.save().lineWidth(2).moveTo(LEFT, 744).lineTo(RIGHT, 744).stroke(C.rule).restore();
  doc.fillColor(C.grey).font('Helvetica').fontSize(9)
     .text(brand.name, 0, 752, { width: PAGE_W, align: 'center' });
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

function pageOne(doc, agreement, booking, customer, vehicle) {
  header(doc);

  const customerName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
  // Prefer the agreement-captured address/DL/DOB; fall back to the customer record.
  const addr  = agreement.address_line1 || '';
  const city  = agreement.city || customer.city || '';
  const state = agreement.state || customer.state || '';
  const zip   = agreement.zip || customer.zip || '';
  const dlNum = agreement.driver_license_number || customer.driver_license_number || '';
  const dlSt  = agreement.driver_license_state || customer.driver_license_state || '';
  const dlExp = fmtDate(agreement.driver_license_expiry || customer.driver_license_expiry);
  const dob   = fmtDate(agreement.date_of_birth || customer.date_of_birth);
  const deposit = booking.deposit_amount ?? vehicle.deposit_amount;

  // ── Top boxed block: check-out / due-back / odometer ──
  doc.save().lineWidth(1).rect(LEFT, 92, RIGHT - LEFT, 82).stroke(C.line).restore();

  lbl(doc, 'Vehicle Check Out:', 52, 103);
  peach(doc, 168, 100, 86); val(doc, fmtDate(booking.pickup_date), 168, 100, 86);
  lbl(doc, '@', 262, 102);
  peach(doc, 278, 100, 80); val(doc, fmtTime(booking.pickup_time), 278, 100, 80);
  lbl(doc, 'AM / PM', 366, 103);

  lbl(doc, 'Vehicle Is Due Back:', 52, 128);
  peach(doc, 168, 125, 86); val(doc, fmtDate(booking.return_date), 168, 125, 86);
  lbl(doc, '@', 262, 127);
  peach(doc, 278, 125, 80); val(doc, fmtTime(booking.return_time), 278, 125, 80);
  lbl(doc, 'AM / PM', 366, 128);

  lbl(doc, 'Odometer Reading:', 52, 153);
  lbl(doc, '@ Check Out', 150, 153);
  peach(doc, 220, 150, 108); val(doc, booking.pickup_mileage ?? '', 220, 150, 108);
  lbl(doc, '@ Check In', 338, 153);
  peach(doc, 405, 150, 158); val(doc, booking.return_mileage ?? '', 405, 150, 158);

  // ── Renter details ──
  field(doc, 'Car Renter:', customerName, LEFT, 192, 140, RIGHT - 140);
  field(doc, 'Home Address:', addr, LEFT, 220, 140, RIGHT - 140);

  // City / State / Zip / Country
  let y = 248;
  field(doc, 'City:', city, LEFT, y, 78, 185);
  field(doc, 'State:', state, 273, y, 305, 45);
  field(doc, 'Zip:', zip, 360, y, 385, 65);
  field(doc, 'Country:', 'USA', 460, y, 505, RIGHT - 505);

  // Driver's License / State / Expiration
  y = 276;
  field(doc, "Driver's License Number:", dlNum, LEFT, y, 178, 170);
  field(doc, 'State:', dlSt, 356, y, 388, 42);
  field(doc, 'Expiration:', dlExp, 440, y, 500, RIGHT - 500);

  field(doc, 'Date of Birth:', dob, LEFT, 304, 120, 160);

  // Insurance
  y = 332;
  field(doc, 'Auto Insurance Company:', agreement.insurance_company || '', LEFT, y, 195, 170);
  field(doc, 'Policy Number:', agreement.insurance_policy_number || '', 375, y, 460, RIGHT - 460);

  // Credit card (not stored — PCI; left blank for manual completion)
  y = 360;
  lbl(doc, 'Credit Card:', LEFT, y + 3);
  lbl(doc, 'Visa', 140, y + 3);
  lbl(doc, 'Master Card', 200, y + 3);
  lbl(doc, 'American Express', 300, y + 3);
  lbl(doc, 'Other:', 420, y + 3);
  peach(doc, 458, y, RIGHT - 458);

  y = 388;
  field(doc, 'Credit Card Number:', '', LEFT, y, 170, 165);
  field(doc, 'Name on the Card:', '', 350, y, 460, RIGHT - 460);

  y = 416;
  field(doc, 'Expiration Date:', '', LEFT, y, 150, 110);
  field(doc, 'Security Code:', '', 300, y, 390, 80);

  field(doc, 'Billing Address:', '', LEFT, 444, 150, RIGHT - 150);

  y = 472;
  field(doc, 'City:', '', LEFT, y, 78, 185);
  field(doc, 'State:', '', 273, y, 305, 45);
  field(doc, 'Zip:', '', 360, y, 385, 65);
  field(doc, 'Country:', '', 460, y, 505, RIGHT - 505);

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
  peach(doc, 440, 608, 130); val(doc, money(deposit), 440, 608, 130);

  footer(doc);
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

  // ── Additional driver (not stored — left blank for manual completion) ──
  field(doc, 'Additional Driver:', '', LEFT, 100, 160, RIGHT - 160);
  field(doc, 'Home Address:', '', LEFT, 128, 160, RIGHT - 160);

  let y = 156;
  field(doc, 'City:', '', LEFT, y, 78, 185);
  field(doc, 'State:', '', 273, y, 305, 45);
  field(doc, 'Zip:', '', 360, y, 385, 65);
  field(doc, 'Country:', '', 460, y, 505, RIGHT - 505);

  y = 184;
  field(doc, "Driver's License Number:", '', LEFT, y, 178, 170);
  field(doc, 'State:', '', 356, y, 388, 42);
  field(doc, 'Expiration:', '', 440, y, 500, RIGHT - 500);

  field(doc, 'Date of Birth:', '', LEFT, 212, 120, 160);

  // ── Car Rental Rate box ──
  doc.save().lineWidth(1).rect(LEFT, 248, RIGHT - LEFT, 122).stroke(C.line).restore();
  lbl(doc, 'Car Rental Rate', 52, 256, { bold: true, size: 11 });

  y = 280;
  lbl(doc, 'Daily Rate $', 52, y + 3);
  peach(doc, 128, y, 80); val(doc, money(booking.daily_rate), 128, y, 80);
  lbl(doc, 'Weekly Rate $', 240, y + 3);
  peach(doc, 325, y, 80); val(doc, money(vehicle.weekly_rate), 325, y, 80);
  lbl(doc, 'Monthly Rate $', 430, y + 3);
  peach(doc, 518, y, 47); val(doc, money(vehicle.monthly_rate), 518, y, 47);

  lbl(doc, 'Time & Mileage Charges', 52, 308, { bold: true });

  y = 328;
  lbl(doc, 'Rental Days', 52, y + 3);
  peach(doc, 128, y, 72); val(doc, booking.rental_days ?? '', 128, y, 72);
  lbl(doc, 'Miles Allowed', 240, y + 3);
  peach(doc, 325, y, 110);
  val(doc, vehicle.mileage_limit_per_day != null ? `${vehicle.mileage_limit_per_day} / day` : '', 325, y, 110);

  y = 350;
  lbl(doc, 'Subtotal $', 48, y + 3);
  peach(doc, 105, y, 62); val(doc, money(booking.subtotal), 105, y, 62);
  lbl(doc, 'Tax $', 178, y + 3);
  peach(doc, 208, y, 60); val(doc, money(booking.tax_amount), 208, y, 60);
  lbl(doc, 'Delivery Fee $', 278, y + 3);
  peach(doc, 350, y, 58); val(doc, money(booking.delivery_fee), 350, y, 58);
  lbl(doc, 'Total Charge $', 418, y + 3, { bold: true });
  peach(doc, 500, y, RIGHT - 500); val(doc, money(booking.total_cost), 500, y, RIGHT - 500, 15, { bold: true });

  // ── Vehicle details ──
  y = 388;
  field(doc, 'Car Year:', vehicle.year ?? '', LEFT, y, 100, 170);
  field(doc, 'Car Type:', vehicle.category || '', 290, y, 350, RIGHT - 350);
  y = 416;
  field(doc, 'Car Make:', vehicle.make || '', LEFT, y, 100, 170);
  field(doc, 'Model:', vehicle.model || '', 290, y, 350, RIGHT - 350);
  field(doc, 'VIN:', vehicle.vin || '', LEFT, 444, 80, 300);
  field(doc, 'License Tag Number:', vehicle.license_plate || '', LEFT, 472, 170, 200);

  // ── Gas tank reading ──
  y = 502;
  const fuel = fuelKey(booking.pickup_fuel_level);
  lbl(doc, 'Gas Tank Reading:', LEFT, y + 1);
  const gasOpts = [['Full', 160], ['3/4', 240], ['1/2', 320], ['1/4', 400]];
  for (const [label, gx] of gasOpts) {
    checkbox(doc, gx, y, fuel === label);
    lbl(doc, label, gx + 12, y + 1);
  }

  // ── Renter accepts (coverage selections — not stored; left blank) ──
  y = 530;
  lbl(doc, 'Renter Accepts:', LEFT, y + 1);
  const cov = [['CDW', 160], ['PAI', 250], ['SLP', 340], ['RAP', 430]];
  for (const [label, cx] of cov) {
    checkbox(doc, cx, y, false);
    lbl(doc, label, cx + 12, y + 1);
  }

  // ── Fuel + keys clauses with initials ──
  doc.fillColor(C.ink).font('Helvetica').fontSize(8.5);
  doc.text(
    'The individual mentioned above in this Car Rental Contract hereby agrees to fill the fuel tank at the above ' +
    'indicated level upon returning the car. Failure to fill the tank at the prescribed level will result in an ' +
    'additional penalty charge of $20.00 per quarter tank of gasoline.',
    LEFT, 560, { width: RIGHT - LEFT, align: 'justify' }
  );
  let yy = doc.y + 6;
  field(doc, 'Initial:', '', LEFT, yy, 90, 90);

  yy += 30;
  doc.fillColor(C.ink).font('Helvetica').fontSize(8.5);
  doc.text("It is the Car Renter's responsibility for all lost car keys and / or a lockout situation.",
    LEFT, yy, { width: RIGHT - LEFT });
  yy = doc.y + 6;
  field(doc, 'Initial:', '', LEFT, yy, 90, 90);

  footer(doc);
}

function pageThree(doc, agreement, booking, customer, vehicle) {
  header(doc);

  const P1 =
    'Only the person(s) that are listed on this Car Rental Agreement and above the age of twenty-one may drive ' +
    'this vehicle. The above mentioned Car Renter is hereby responsible for all collision damage to the vehicle ' +
    'regardless if someone else is at fault or the cause is not known. The Car Renter is fully responsible for the ' +
    'cost of any repair up to the value of the vehicle. The Car Renter’s Insurance may cover all or only part ' +
    'of the financial liability for the rented vehicle.';
  const P2 =
    'Car Renter should check with their insurance company regarding their coverage and what they are and are not ' +
    'liable for. If there is no breach of this contract the Car Renter and any authorized driver is provided ' +
    'liability insurance and is limited to the minimum financial responsibility as required by state law. Liability ' +
    'Insurance will only be in excess over any and all additional collectible insurance. The above mentioned Car ' +
    'Renter hereby waives all uninsured and under insured motorists, no fault and any other optional additional ' +
    'coverage. If such additional coverage cannot be waived or excluded then the Car Renter agrees that such ' +
    'coverage will be limited to only the minimum state requirements.';
  const P3 =
    'The Car Renter is hereby bound by the terms and conditions of this Car Rental Agreement. The vehicle must be ' +
    'returned to the same location in which it was picked up for rental and on or before the above indicated due ' +
    'back date and time. There will be additional fees due if the vehicle is not returned as specified above. ' +
    'Where it is permitted by law the Car Renter hereby authorizes us to process their credit card information in ' +
    `their name for all Car Rental charges, including the full vehicle value of any vehicle that is not returned to ${brand.name}, ` +
    'all fines, towing, any court costs, penalties, and or administrative fees that we may incur for parking, ' +
    'traffic and or other violations that may be incurred by the Car Renter during the Car Rental term period as ' +
    'stated above and to apply any payments made to the charges in whatever order that the Car Rental Company ' +
    'sees as necessary.';

  doc.fillColor(C.ink).font('Helvetica').fontSize(9);
  doc.text(P1, LEFT, 104, { width: RIGHT - LEFT, align: 'justify' });
  doc.text(P2, LEFT, doc.y + 8, { width: RIGHT - LEFT, align: 'justify' });
  doc.text(P3, LEFT, doc.y + 8, { width: RIGHT - LEFT, align: 'justify' });

  let y = doc.y + 14;
  checkbox(doc, LEFT, y, false);
  lbl(doc, 'By checking the box, the Car Renter agrees to the Terms and Conditions stated in the General Policies Form',
    LEFT + 14, y + 1);

  y += 24;
  lbl(doc, 'By signing below Car Renter is also signing their Car Rental credit card voucher.', LEFT, y);

  // ── Signature blocks ──
  const sigW = 300, dateX = 410, dateW = 160;

  // Customer
  y = 548;
  signatureRow(doc, 'Car Renter', LEFT, y, sigW, dateX, dateW,
    agreement.customer_signature_data, agreement.customer_signed_at);

  // Additional renter (blank)
  y = 626;
  signatureRow(doc, 'Additional Car Renter', LEFT, y, sigW, dateX, dateW, null, null);

  // Company acceptance
  y = 690;
  lbl(doc, `Accepted By ${brand.name}:`, LEFT, y, { bold: true });
  signatureRow(doc, 'Authorized Representative', LEFT, y + 8, sigW, dateX, dateW,
    agreement.owner_signature_data, agreement.owner_signed_at, { lineY: y + 40 });

  footer(doc);
}

function signatureRow(doc, label, x, y, sigW, dateX, dateW, sigData, signedAt, { lineY } = {}) {
  const boxH = 34;
  peach(doc, x, y, sigW, boxH);
  peach(doc, dateX, y, dateW, boxH);

  const sigBuf = getSignatureBuffer(sigData);
  if (sigBuf) {
    try { doc.image(sigBuf, x + 8, y + 2, { height: boxH - 6 }); } catch { /* ignore */ }
  }
  if (signedAt) {
    val(doc, fmtStamp(signedAt), dateX, y, dateW, boxH, { size: 9 });
  }

  const ly = lineY ?? (y + boxH + 4);
  doc.save().lineWidth(0.8);
  doc.moveTo(x, ly).lineTo(x + sigW, ly).stroke(C.line);
  doc.moveTo(dateX, ly).lineTo(dateX + dateW, ly).stroke(C.line);
  doc.restore();
  lbl(doc, label, x, ly + 4);
  lbl(doc, 'Date', dateX, ly + 4);
}

/* ──────────────────────────── entry point ──────────────────────────── */

/**
 * Generates the 3-page rental agreement PDF and pipes it to the given writable
 * stream (HTTP response or file stream). Signature unchanged for the route.
 */
export function addRentalAgreementPdfPages(doc, agreement, booking) {
  const customer = booking.customers || {};
  const vehicle = booking.vehicles || {};

  doc.font('Helvetica');
  try { doc.initForm(); } catch { /* already initialized or not needed */ }

  pageOne(doc, agreement, booking, customer, vehicle);
  doc.addPage();
  pageTwo(doc, agreement, booking, customer, vehicle);
  doc.addPage();
  pageThree(doc, agreement, booking, customer, vehicle);
}

export async function generateRentalAgreementPdf(agreement, booking, res) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'LETTER', margins: { top: 0, bottom: 0, left: 0, right: 0 } });

      doc.pipe(res);
      addRentalAgreementPdfPages(doc, agreement, booking);

      doc.end();

      res.on('finish', resolve);
      res.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}
