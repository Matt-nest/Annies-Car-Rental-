import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/* ────────────────────────────────────────────────────────
   Brand Constants — Aaron's Garage LLC, DBA Annie's & Co
   ──────────────────────────────────────────────────────── */
const BRAND = {
  accent: '#F5A623',
  accentDark: '#D4941E',
  dark: '#1C1917',
  medium: '#57534E',
  light: '#A8A29E',
  border: '#E7E5E4',
  bgLight: '#FAFAF9',
  white: '#FFFFFF',
  green: '#16A34A',
  red: '#DC2626',

  companyName: "Annie's & Co",
  tagline: 'Your Trusted Vehicle Rental',
  legalName: "Aaron's Garage LLC",
  dba: "DBA Annie's & Co",
  address: '586 NW Mercantile Pl',
  cityStateZip: 'Port Saint Lucie, FL 34986',
  phone: '(772) 207-1655',
  email: 'info@anniescarrental.com',
  website: 'anniescarrental.com',
  ein: '99-0908048',
};

/* ────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────── */
function fmt(amount) {
  return `$${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDatetime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function generateInvoiceNumber(booking) {
  const date = new Date();
  const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  // Extract the short code suffix from booking_code (e.g. 'WCD9' from 'BK-20260511-WCD9')
  const parts = (booking.booking_code || '').split('-');
  const shortCode = parts[parts.length - 1] || booking.booking_code;
  return `INV-${shortCode}-${mmdd}`;
}

/**
 * Load logo from backend/assets — reliable path that works in dev and production.
 */
function loadLogo() {
  const candidates = [
    join(__dirname, '..', 'assets', 'logo.png'),
    join(__dirname, '..', '..', 'public', 'logo.png'),
    join(__dirname, '..', '..', 'dist', 'logo.png'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      try { return readFileSync(p); } catch { /* skip */ }
    }
  }
  return null;
}

/* ────────────────────────────────────────────────────────
   Main PDF Generator
   ──────────────────────────────────────────────────────── */

/**
 * Generate a professional invoice PDF and pipe it to a writable stream.
 *
 * @param {Object} params
 * @param {Object} params.booking - Full booking row (joined with customers, vehicles, payments, rental_agreements)
 * @param {string} params.invoiceNumber - The invoice number to display
 * @param {WritableStream} params.stream - Where to pipe the PDF (usually Express `res`)
 * @returns {Promise<void>}
 */
export async function generateInvoicePdf({ booking, invoiceNumber, stream }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 40, bottom: 40, left: 50, right: 50 },
        bufferPages: true,
        autoFirstPage: true,
      });

      // Prevent auto-pagination — invoice must be a single page
      doc.on('pageAdded', () => {
        // Remove any auto-added pages by ending immediately after the first
      });

      doc.pipe(stream);

      const customer = booking.customers || {};
      const vehicle = booking.vehicles || {};
      const agreement = Array.isArray(booking.rental_agreements)
        ? booking.rental_agreements[0]
        : booking.rental_agreements || {};
      const payments = Array.isArray(booking.payments) ? booking.payments : [];
      const pageWidth = 612;
      const contentWidth = pageWidth - 100;
      const L = 50;       // left margin
      const R = pageWidth - 50; // right edge
      const issueDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const vehicleName = `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`.trim() || 'Vehicle';

      /* ═══════════════════════════════════════════════════════
         TOP ACCENT BAR
         ═══════════════════════════════════════════════════════ */
      doc.rect(0, 0, pageWidth, 5).fill(BRAND.accent);

      /* ═══════════════════════════════════════════════════════
         HEADER — Logo + Business Info (left) | Invoice Meta (right)
         ═══════════════════════════════════════════════════════ */
      let y = 22;

      // ── Logo ──
      const logoBuf = loadLogo();
      if (logoBuf) {
        try {
          doc.image(logoBuf, L, y, { height: 80 });
        } catch { /* skip gracefully */ }
      }

      // ── Business info under logo (no need to repeat name — it's in the logo) ──
      const bizY = logoBuf ? y + 88 : y;

      // Business address block
      doc.fontSize(7.5).font('Helvetica').fillColor(BRAND.medium);
      doc.text(BRAND.address, L, bizY);
      doc.text(BRAND.cityStateZip, L, bizY + 10);
      doc.text(`Phone: ${BRAND.phone}`, L, bizY + 20);
      doc.text(`Web: ${BRAND.website}`, L, bizY + 30);

      // Legal identity
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(BRAND.medium);
      doc.text(`${BRAND.legalName}`, L, bizY + 44);
      doc.fontSize(7.5).font('Helvetica').fillColor(BRAND.medium);
      doc.text(BRAND.dba, L, bizY + 54);
      doc.text(`EIN: ${BRAND.ein}`, L, bizY + 64);

      // ── Invoice title (right) ──
      doc.fontSize(22).font('Helvetica-Bold').fillColor(BRAND.dark)
        .text('INVOICE', R - 180, y, { width: 180, align: 'right' });

      // Meta table (right side, properly spaced)
      const metaStartY = y + 32;
      const metaLabelX = R - 180;
      const metaValueX = R - 90;

      const metaRows = [
        ['Invoice No:', invoiceNumber],
        ['Issue Date:', issueDate],
        ['Reference:', booking.booking_code || '—'],
      ];

      metaRows.forEach((row, i) => {
        const rowY = metaStartY + i * 16;
        doc.fontSize(8).font('Helvetica').fillColor(BRAND.medium)
          .text(row[0], metaLabelX, rowY, { width: 80, align: 'right' });
        doc.fontSize(8).font('Helvetica-Bold').fillColor(BRAND.dark)
          .text(row[1], metaValueX, rowY, { width: 90, align: 'right' });
      });

      /* ═══════════════════════════════════════════════════════
         SEPARATOR
         ═══════════════════════════════════════════════════════ */
      y = bizY + 78;
      doc.moveTo(L, y).lineTo(R, y).strokeColor(BRAND.border).lineWidth(1).stroke();
      y += 14;

      /* ═══════════════════════════════════════════════════════
         BILL TO (left) | VEHICLE INFO (right)
         ═══════════════════════════════════════════════════════ */
      const sectionStartY = y;

      // ── Bill To ──
      doc.fontSize(7).font('Helvetica-Bold').fillColor(BRAND.accent)
        .text('BILL TO', L, y);
      y += 12;

      const customerName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Customer';
      doc.fontSize(10).font('Helvetica-Bold').fillColor(BRAND.dark)
        .text(customerName, L, y);
      y += 14;

      doc.fontSize(8).font('Helvetica').fillColor(BRAND.medium);
      if (customer.email) { doc.text(customer.email, L, y); y += 11; }
      if (customer.phone) { doc.text(customer.phone, L, y); y += 11; }

      const addr = agreement.address_line1 || customer.address_line1;
      const city = agreement.city || customer.city;
      const state = agreement.state || customer.state;
      const zip = agreement.zip || customer.zip;
      if (addr) {
        doc.text(addr, L, y); y += 11;
        const csz = `${city || ''}${city && state ? ', ' : ''}${state || ''} ${zip || ''}`.trim();
        if (csz) { doc.text(csz, L, y); y += 11; }
      }

      // ── Vehicle Info (right column) ──
      const rightColX = 330;
      let ry = sectionStartY;

      doc.fontSize(7).font('Helvetica-Bold').fillColor(BRAND.accent)
        .text('VEHICLE', rightColX, ry);
      ry += 12;

      doc.fontSize(10).font('Helvetica-Bold').fillColor(BRAND.dark)
        .text(vehicleName, rightColX, ry);
      ry += 14;

      doc.fontSize(8).font('Helvetica').fillColor(BRAND.medium);
      if (vehicle.vin) { doc.text(`VIN: ${vehicle.vin}`, rightColX, ry); ry += 11; }
      doc.text(`Pickup: ${fmtDate(booking.pickup_date)}${booking.pickup_time ? ` at ${booking.pickup_time}` : ''}`, rightColX, ry); ry += 11;
      doc.text(`Return: ${fmtDate(booking.return_date)}${booking.return_time ? ` at ${booking.return_time}` : ''}`, rightColX, ry); ry += 11;
      doc.text(`Rental Days: ${booking.rental_days || '—'}`, rightColX, ry); ry += 11;
      if (booking.pickup_location) {
        doc.text(`Location: ${booking.pickup_location}`, rightColX, ry); ry += 11;
      }

      y = Math.max(y, ry) + 14;

      /* ═══════════════════════════════════════════════════════
         SUMMARY BAR (yellow accent)
         ═══════════════════════════════════════════════════════ */
      const barH = 30;
      doc.rect(L, y, contentWidth, barH).fill(BRAND.accent);

      // Evenly spaced columns within the bar
      const barCols = [
        { label: 'Invoice No.', value: invoiceNumber, x: L + 8, w: 130 },
        { label: 'Issue Date', value: issueDate, x: L + 148, w: 100 },
        { label: 'Booking Code', value: booking.booking_code || '—', x: L + 290, w: 120 },
        { label: 'Total Due', value: fmt(booking.total_cost), x: R - 108, w: 100 },
      ];
      barCols.forEach(col => {
        doc.fontSize(6).font('Helvetica').fillColor('rgba(255,255,255,0.7)')
          .text(col.label, col.x, y + 5, { width: col.w });
        doc.fontSize(9).font('Helvetica-Bold').fillColor(BRAND.white)
          .text(col.value, col.x, y + 15, { width: col.w });
      });

      y += barH + 14;

      /* ═══════════════════════════════════════════════════════
         LINE ITEMS TABLE
         ═══════════════════════════════════════════════════════ */
      const colDesc = L;
      const colQty = L + 290;
      const colUnit = L + 360;
      const colAmt = R;

      // Table header
      doc.fontSize(8).font('Helvetica-Bold').fillColor(BRAND.dark);
      doc.text('Description', colDesc, y);
      doc.text('Qty', colQty, y, { width: 50, align: 'center' });
      doc.text('Unit Price', colUnit, y, { width: 70, align: 'right' });
      doc.text('Amount', colAmt - 70, y, { width: 70, align: 'right' });

      y += 4;
      doc.moveTo(L, y + 10).lineTo(R, y + 10).strokeColor(BRAND.dark).lineWidth(0.5).stroke();
      y += 16;

      // ── Build line items ──
      const lineItems = [];

      // Base rental
      if (booking.rate_type && booking.rate_type.startsWith('weekly')) {
        const fullWeeks = Math.floor((booking.rental_days || 0) / 7);
        const remainderDays = (booking.rental_days || 0) % 7;
        const weeklyRate = booking.weekly_discount_applied
          ? Number(booking.daily_rate) * 7 * (1 - (booking.weekly_discount_applied / 100))
          : Number(booking.daily_rate) * 7;

        if (fullWeeks > 0) {
          lineItems.push({ desc: `Weekly Rental — ${vehicleName}`, qty: fullWeeks, unit: weeklyRate, amount: fullWeeks * weeklyRate });
        }
        if (remainderDays > 0) {
          lineItems.push({ desc: `Daily Rental (remainder) — ${vehicleName}`, qty: remainderDays, unit: Number(booking.daily_rate), amount: remainderDays * Number(booking.daily_rate) });
        }
      } else if (booking.rate_type && booking.rate_type.startsWith('monthly')) {
        const months = Math.floor((booking.rental_days || 0) / 30);
        const remainderDays = (booking.rental_days || 0) % 30;
        if (months > 0) {
          lineItems.push({ desc: `Monthly Rental — ${vehicleName}`, qty: months, unit: Number(booking.monthly_rate || booking.daily_rate * 30), amount: months * Number(booking.monthly_rate || booking.daily_rate * 30) });
        }
        if (remainderDays > 0) {
          lineItems.push({ desc: `Daily Rental (remainder) — ${vehicleName}`, qty: remainderDays, unit: Number(booking.daily_rate), amount: remainderDays * Number(booking.daily_rate) });
        }
      } else {
        lineItems.push({ desc: `Daily Rental — ${vehicleName}`, qty: booking.rental_days || 1, unit: Number(booking.daily_rate), amount: Number(booking.subtotal || 0) });
      }

      // Delivery fee
      if (Number(booking.delivery_fee) > 0) {
        lineItems.push({ desc: `Delivery Fee${booking.delivery_address ? ` — ${booking.delivery_address}` : ''}`, qty: 1, unit: Number(booking.delivery_fee), amount: Number(booking.delivery_fee) });
      }

      // Unlimited Miles add-on
      if (Number(booking.mileage_addon_fee) > 0) {
        lineItems.push({ desc: 'Unlimited Miles Add-on', qty: 1, unit: Number(booking.mileage_addon_fee), amount: Number(booking.mileage_addon_fee) });
      }

      // Unlimited Tolls add-on
      if (Number(booking.toll_addon_fee) > 0) {
        lineItems.push({ desc: 'Unlimited Tolls Add-on', qty: 1, unit: Number(booking.toll_addon_fee), amount: Number(booking.toll_addon_fee) });
      }

      // Insurance (Bonzah) — check total_charged first, fall back to premium + markup
      const insuranceCents = Number(booking.bonzah_total_charged_cents || 0)
        || (Number(booking.bonzah_premium_cents || 0) + Number(booking.bonzah_markup_cents || 0));
      if (insuranceCents > 0 && booking.insurance_provider === 'bonzah') {
        const tierLabel = booking.bonzah_tier_id
          ? booking.bonzah_tier_id.charAt(0).toUpperCase() + booking.bonzah_tier_id.slice(1)
          : 'Protection';
        lineItems.push({ desc: `Insurance — ${tierLabel} Coverage`, qty: 1, unit: insuranceCents / 100, amount: insuranceCents / 100 });
      }

      // Young driver fee
      if (Number(booking.young_driver_fee) > 0) {
        lineItems.push({ desc: 'Young Driver Surcharge', qty: 1, unit: Number(booking.young_driver_fee), amount: Number(booking.young_driver_fee) });
      }

      // Extra charges (late return, damage, etc.)
      if (Number(booking.extra_charges) > 0) {
        lineItems.push({ desc: booking.extra_charges_note || 'Additional Charges', qty: 1, unit: Number(booking.extra_charges), amount: Number(booking.extra_charges) });
      }

      // ── Render line items ──
      lineItems.forEach(item => {
        doc.fontSize(9).font('Helvetica').fillColor(BRAND.dark);
        doc.text(item.desc, colDesc, y, { width: 280 });
        doc.text(String(item.qty), colQty, y, { width: 50, align: 'center' });
        doc.text(fmt(item.unit), colUnit, y, { width: 70, align: 'right' });
        doc.text(fmt(item.amount), colAmt - 70, y, { width: 70, align: 'right' });
        y += 18;
        doc.moveTo(L, y - 4).lineTo(R, y - 4).strokeColor(BRAND.border).lineWidth(0.3).stroke();
      });

      // Discount line (negative)
      if (Number(booking.discount_amount) > 0) {
        doc.fontSize(9).font('Helvetica').fillColor(BRAND.green);
        doc.text(`Discount${booking.discount_code ? ` (${booking.discount_code})` : ''}`, colDesc, y);
        doc.text(`-${fmt(booking.discount_amount)}`, colAmt - 70, y, { width: 70, align: 'right' });
        y += 18;
        doc.moveTo(L, y - 4).lineTo(R, y - 4).strokeColor(BRAND.border).lineWidth(0.3).stroke();
      }

      y += 10;

      /* ═══════════════════════════════════════════════════════
         TOTALS SECTION (right-aligned)
         ═══════════════════════════════════════════════════════ */
      const totLabelX = R - 200;
      const totValueX = R - 70;
      const totW = 70;

      // Subtotal (sum of all line items before tax)
      const calcSubtotal = lineItems.reduce((s, item) => s + item.amount, 0) - Number(booking.discount_amount || 0);

      doc.fontSize(9).font('Helvetica').fillColor(BRAND.medium);
      doc.text('Subtotal:', totLabelX, y, { width: 120, align: 'right' });
      doc.font('Helvetica-Bold').fillColor(BRAND.dark);
      doc.text(fmt(calcSubtotal), totValueX, y, { width: totW, align: 'right' });
      y += 16;

      // Tax
      const taxAmount = Number(booking.tax_amount || 0);
      const taxRate = calcSubtotal > 0 ? Math.round((taxAmount / calcSubtotal) * 100) : 7;
      doc.fontSize(9).font('Helvetica').fillColor(BRAND.medium);
      doc.text(`Tax (${taxRate}%):`, totLabelX, y, { width: 120, align: 'right' });
      doc.font('Helvetica-Bold').fillColor(BRAND.dark);
      doc.text(fmt(taxAmount), totValueX, y, { width: totW, align: 'right' });
      y += 16;

      // Total line
      doc.moveTo(totLabelX, y).lineTo(R, y).strokeColor(BRAND.dark).lineWidth(1).stroke();
      y += 8;

      doc.fontSize(12).font('Helvetica-Bold').fillColor(BRAND.dark);
      doc.text('Total:', totLabelX, y, { width: 120, align: 'right' });
      doc.text(fmt(booking.total_cost), totValueX, y, { width: totW, align: 'right' });
      y += 22;

      // Security Deposit
      if (Number(booking.deposit_amount) > 0) {
        doc.fontSize(9).font('Helvetica').fillColor(BRAND.medium);
        doc.text(`Security Deposit (${booking.deposit_status || 'held'}):`, totLabelX - 20, y, { width: 140, align: 'right' });
        doc.font('Helvetica-Bold').fillColor(BRAND.dark);
        doc.text(fmt(booking.deposit_amount), totValueX, y, { width: totW, align: 'right' });
        y += 18;
      }

      /* ═══════════════════════════════════════════════════════
         PAYMENTS RECEIVED
         ═══════════════════════════════════════════════════════ */
      const paidPayments = payments.filter(p => p.payment_type !== 'refund' && p.payment_type !== 'deposit');
      const depositPayments = payments.filter(p => p.payment_type === 'deposit');
      const refunds = payments.filter(p => p.payment_type === 'refund');

      if (paidPayments.length > 0 || depositPayments.length > 0 || refunds.length > 0) {
        y += 6;
        doc.moveTo(L, y).lineTo(R, y).strokeColor(BRAND.border).lineWidth(0.5).stroke();
        y += 12;

        doc.fontSize(7).font('Helvetica-Bold').fillColor(BRAND.accent)
          .text('PAYMENTS RECEIVED', L, y);
        y += 14;

        for (const p of paidPayments) {
          const pDate = fmtDatetime(p.created_at);
          const label = (p.method || 'Payment').charAt(0).toUpperCase() + (p.method || 'payment').slice(1);
          doc.fontSize(8).font('Helvetica').fillColor(BRAND.medium);
          doc.text(`${label} — ${pDate}`, L, y, { width: 340 });
          doc.font('Helvetica-Bold').fillColor(BRAND.green);
          doc.text(fmt(p.amount), totValueX, y, { width: totW, align: 'right' });
          y += 14;
        }

        if (depositPayments.length > 0) {
          for (const p of depositPayments) {
            const pDate = fmtDatetime(p.created_at);
            doc.fontSize(8).font('Helvetica').fillColor(BRAND.medium);
            doc.text(`Security Deposit — ${pDate}`, L, y, { width: 340 });
            doc.font('Helvetica-Bold').fillColor(BRAND.medium);
            doc.text(fmt(p.amount), totValueX, y, { width: totW, align: 'right' });
            y += 14;
          }
        }

        for (const r of refunds) {
          const rDate = fmtDatetime(r.created_at);
          doc.fontSize(8).font('Helvetica').fillColor(BRAND.medium);
          doc.text(`Refund — ${rDate}`, L, y, { width: 340 });
          doc.font('Helvetica-Bold').fillColor(BRAND.red);
          doc.text(`-${fmt(r.amount)}`, totValueX, y, { width: totW, align: 'right' });
          y += 14;
        }

        // Balance calculation
        const totalPaid = paidPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
        const totalRefunded = refunds.reduce((s, r) => s + Number(r.amount || 0), 0);
        const netPaid = totalPaid - totalRefunded;
        const balance = Number(booking.total_cost || 0) - netPaid;

        y += 4;
        doc.moveTo(totLabelX, y).lineTo(R, y).strokeColor(BRAND.border).lineWidth(0.5).stroke();
        y += 8;

        if (balance > 0) {
          doc.fontSize(10).font('Helvetica-Bold').fillColor(BRAND.red);
          doc.text('Balance Due:', totLabelX, y, { width: 120, align: 'right' });
          doc.text(fmt(balance), totValueX, y, { width: totW, align: 'right' });
        } else if (balance < 0) {
          doc.fontSize(10).font('Helvetica-Bold').fillColor(BRAND.green);
          doc.text('Overpayment:', totLabelX, y, { width: 120, align: 'right' });
          doc.text(fmt(Math.abs(balance)), totValueX, y, { width: totW, align: 'right' });
        } else {
          doc.fontSize(10).font('Helvetica-Bold').fillColor(BRAND.green);
          doc.text('Paid in Full', totLabelX, y, { width: 120, align: 'right' });
          doc.text(fmt(0), totValueX, y, { width: totW, align: 'right' });
        }
        y += 20;
      }

      /* ═══════════════════════════════════════════════════════
         FOOTER — placed after content, minimum at page bottom
         ═══════════════════════════════════════════════════════ */
      // Place footer at bottom of page 1 (692 = 792 - 100 margin), or right after content
      const footerY = Math.max(y + 20, 692);

      doc.moveTo(L, footerY).lineTo(R, footerY).strokeColor(BRAND.border).lineWidth(0.5).stroke();

      // Contact row
      doc.fontSize(7).font('Helvetica').fillColor(BRAND.light);
      doc.text(BRAND.phone, L, footerY + 8);
      doc.text(BRAND.website, L + (contentWidth / 2) - 40, footerY + 8, { width: 80, align: 'center' });
      doc.text(BRAND.email, R - 130, footerY + 8, { width: 130, align: 'right' });

      // Legal identity + internal label on one line
      doc.fontSize(6.5).font('Helvetica').fillColor(BRAND.light);
      doc.text(`${BRAND.legalName} · ${BRAND.dba} · ${BRAND.address} · ${BRAND.cityStateZip} · EIN: ${BRAND.ein}`, L, footerY + 20, { width: contentWidth - 180 });
      doc.text('Internal Use Only', R - 80, footerY + 20, { width: 80, align: 'right' });

      /* ═══════════════════════════════════════════════════════
         FINALIZE
         ═══════════════════════════════════════════════════════ */
      doc.end();

      stream.on('finish', () => resolve());
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

export { generateInvoiceNumber };
