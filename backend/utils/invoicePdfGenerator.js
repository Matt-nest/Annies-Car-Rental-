import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/* ────────────────────────────────────────────────────────
   Brand Constants
   ──────────────────────────────────────────────────────── */
const BRAND = {
  accent: '#F5A623',        // Yellow accent bar
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
  legalName: 'Aaron\'s Garage LLC',
  dba: "DBA Annie's & Co",
  address: '586 NW Mercantile Pl',
  cityStateZip: 'Port Saint Lucie, FL 34986',
  phone: '(772) 985-6667',
  website: 'anniescarrental.com',
  ein: '99-0908048',
};

/* ────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────── */
function fmt(amount) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function generateInvoiceNumber(booking) {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return `INV-${ymd}-${booking.booking_code}`;
}

/**
 * Try to load the logo from the public directory (runs at build time on the server).
 * Falls back gracefully if not found.
 */
function loadLogo() {
  // Try multiple possible paths relative to the backend root
  const candidates = [
    join(__dirname, '..', '..', 'public', 'logo.png'),
    join(__dirname, '..', '..', 'dist', 'logo.png'),
    join(__dirname, '..', 'public', 'logo.png'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      try { return readFileSync(p); } catch { /* skip */ }
    }
  }
  return null;
}

/* ────────────────────────────────────────────────────────
   Main Generator
   ──────────────────────────────────────────────────────── */

/**
 * Generate a professional invoice PDF and pipe it to a writable stream (usually res).
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
        margins: { top: 40, bottom: 60, left: 50, right: 50 },
        bufferPages: true,
      });

      doc.pipe(stream);

      const customer = booking.customers || {};
      const vehicle = booking.vehicles || {};
      const agreement = Array.isArray(booking.rental_agreements)
        ? booking.rental_agreements[0]
        : booking.rental_agreements || {};
      const payments = Array.isArray(booking.payments) ? booking.payments : [];
      const pageWidth = 612;
      const contentWidth = pageWidth - 100; // 50px margins each side
      const leftMargin = 50;
      const rightEdge = pageWidth - 50;

      /* ═══════════════════════════════════════════════════════
         ACCENT BAR
         ═══════════════════════════════════════════════════════ */
      doc.rect(0, 0, pageWidth, 6).fill(BRAND.accent);

      /* ═══════════════════════════════════════════════════════
         HEADER — Logo + Company Info (left) | Invoice Meta (right)
         ═══════════════════════════════════════════════════════ */
      let y = 24;

      // Try to embed logo
      const logoBuf = loadLogo();
      if (logoBuf) {
        try {
          doc.image(logoBuf, leftMargin, y, { height: 40 });
        } catch { /* logo failed — skip gracefully */ }
      }

      // Company name (below or beside logo)
      const companyNameY = logoBuf ? y + 46 : y;
      doc.fontSize(16).font('Helvetica-Bold').fillColor(BRAND.dark)
        .text(BRAND.companyName, leftMargin, companyNameY);
      doc.fontSize(8).font('Helvetica').fillColor(BRAND.light)
        .text('Your Trusted Vehicle Rental', leftMargin, companyNameY + 18);

      // Invoice title + meta (right side)
      doc.fontSize(22).font('Helvetica-Bold').fillColor(BRAND.dark)
        .text('INVOICE', rightEdge - 200, y, { width: 200, align: 'right' });

      const issueDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const metaY = y + 30;
      const metaLabelX = rightEdge - 200;
      const metaValueX = rightEdge - 90;

      doc.fontSize(9).font('Helvetica').fillColor(BRAND.medium);
      doc.text('Invoice No:', metaLabelX, metaY, { width: 110, align: 'right' });
      doc.text('Issue Date:', metaLabelX, metaY + 14, { width: 110, align: 'right' });
      doc.text('Reference:', metaLabelX, metaY + 28, { width: 110, align: 'right' });

      doc.font('Helvetica-Bold').fillColor(BRAND.dark);
      doc.text(invoiceNumber, metaValueX, metaY, { width: 90, align: 'right' });
      doc.text(issueDate, metaValueX, metaY + 14, { width: 90, align: 'right' });
      doc.text(booking.booking_code || '—', metaValueX, metaY + 28, { width: 90, align: 'right' });

      /* ═══════════════════════════════════════════════════════
         SEPARATOR
         ═══════════════════════════════════════════════════════ */
      y = companyNameY + 42;
      doc.moveTo(leftMargin, y).lineTo(rightEdge, y).strokeColor(BRAND.border).lineWidth(1).stroke();
      y += 16;

      /* ═══════════════════════════════════════════════════════
         BILL TO (left) | VEHICLE INFO (right)
         ═══════════════════════════════════════════════════════ */
      // Bill To
      doc.fontSize(8).font('Helvetica-Bold').fillColor(BRAND.accent)
        .text('BILL TO', leftMargin, y);
      y += 14;

      const customerName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Customer';
      doc.fontSize(10).font('Helvetica-Bold').fillColor(BRAND.dark)
        .text(customerName, leftMargin, y);
      y += 14;

      doc.fontSize(9).font('Helvetica').fillColor(BRAND.medium);
      if (customer.email) { doc.text(customer.email, leftMargin, y); y += 12; }
      if (customer.phone) { doc.text(customer.phone, leftMargin, y); y += 12; }

      // Address from agreement or customer
      const addr = agreement.address_line1 || customer.address_line1;
      const city = agreement.city || customer.city;
      const state = agreement.state || customer.state;
      const zip = agreement.zip || customer.zip;
      if (addr) {
        doc.text(addr, leftMargin, y); y += 12;
        if (city || state || zip) {
          doc.text(`${city || ''}${city && state ? ', ' : ''}${state || ''} ${zip || ''}`.trim(), leftMargin, y);
          y += 12;
        }
      }

      // Vehicle Info (right column, same vertical start)
      const rightColX = 340;
      let ry = y - (addr ? 62 : 38);

      doc.fontSize(8).font('Helvetica-Bold').fillColor(BRAND.accent)
        .text('VEHICLE', rightColX, ry);
      ry += 14;

      const vehicleName = `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`.trim() || 'Vehicle';
      doc.fontSize(10).font('Helvetica-Bold').fillColor(BRAND.dark)
        .text(vehicleName, rightColX, ry);
      ry += 14;

      doc.fontSize(9).font('Helvetica').fillColor(BRAND.medium);
      if (vehicle.vin) { doc.text(`VIN: ${vehicle.vin}`, rightColX, ry); ry += 12; }
      doc.text(`Pickup: ${fmtDate(booking.pickup_date)} ${booking.pickup_time || ''}`.trim(), rightColX, ry); ry += 12;
      doc.text(`Return: ${fmtDate(booking.return_date)} ${booking.return_time || ''}`.trim(), rightColX, ry); ry += 12;
      doc.text(`Rental Days: ${booking.rental_days || '—'}`, rightColX, ry); ry += 12;
      if (booking.pickup_location) {
        doc.text(`Location: ${booking.pickup_location}`, rightColX, ry); ry += 12;
      }

      y = Math.max(y, ry) + 12;

      /* ═══════════════════════════════════════════════════════
         SUMMARY BAR (yellow accent background)
         ═══════════════════════════════════════════════════════ */
      const barH = 32;
      doc.rect(leftMargin, y, contentWidth, barH).fill(BRAND.accent);

      doc.fontSize(9).font('Helvetica-Bold').fillColor(BRAND.white);
      const barCols = [
        { label: 'Invoice No.', value: invoiceNumber, x: leftMargin + 10 },
        { label: 'Issue Date', value: issueDate, x: leftMargin + 170 },
        { label: 'Booking Code', value: booking.booking_code || '—', x: leftMargin + 310 },
        { label: 'Total Due', value: fmt(booking.total_cost), x: rightEdge - 100 },
      ];
      barCols.forEach(col => {
        doc.fontSize(7).font('Helvetica').fillColor('#FFFFFF99')
          .text(col.label, col.x, y + 5);
        doc.fontSize(10).font('Helvetica-Bold').fillColor(BRAND.white)
          .text(col.value, col.x, y + 16);
      });

      y += barH + 16;

      /* ═══════════════════════════════════════════════════════
         LINE ITEMS TABLE
         ═══════════════════════════════════════════════════════ */
      // Table header
      const colDesc = leftMargin;
      const colQty = leftMargin + 280;
      const colUnit = leftMargin + 350;
      const colAmt = rightEdge - 10;

      doc.fontSize(8).font('Helvetica-Bold').fillColor(BRAND.medium);
      doc.text('Description', colDesc, y);
      doc.text('Qty', colQty, y, { width: 50, align: 'center' });
      doc.text('Unit Price', colUnit, y, { width: 70, align: 'right' });
      doc.text('Amount', colAmt - 60, y, { width: 70, align: 'right' });

      y += 4;
      doc.moveTo(leftMargin, y + 10).lineTo(rightEdge, y + 10).strokeColor(BRAND.dark).lineWidth(0.5).stroke();
      y += 16;

      // Build line items from booking data
      const lineItems = [];

      // Base rental
      if (booking.rate_type && booking.rate_type.startsWith('weekly')) {
        const fullWeeks = Math.floor((booking.rental_days || 0) / 7);
        const remainderDays = (booking.rental_days || 0) % 7;
        const weeklyRate = booking.weekly_discount_applied
          ? Number(booking.daily_rate) * 7 * (1 - (booking.weekly_discount_applied / 100))
          : Number(booking.daily_rate) * 7;

        if (fullWeeks > 0) {
          lineItems.push({
            desc: `Weekly Rental — ${vehicleName}`,
            qty: fullWeeks,
            unit: weeklyRate,
            amount: fullWeeks * weeklyRate,
          });
        }
        if (remainderDays > 0) {
          lineItems.push({
            desc: `Daily Rental (remainder) — ${vehicleName}`,
            qty: remainderDays,
            unit: Number(booking.daily_rate),
            amount: remainderDays * Number(booking.daily_rate),
          });
        }
      } else {
        lineItems.push({
          desc: `Daily Rental — ${vehicleName}`,
          qty: booking.rental_days || 1,
          unit: Number(booking.daily_rate),
          amount: Number(booking.subtotal || 0),
        });
      }

      // Delivery fee
      if (Number(booking.delivery_fee) > 0) {
        lineItems.push({
          desc: `Delivery Fee${booking.delivery_address ? ` (${booking.delivery_address})` : ''}`,
          qty: 1,
          unit: Number(booking.delivery_fee),
          amount: Number(booking.delivery_fee),
        });
      }

      // Unlimited Miles add-on
      if (Number(booking.mileage_addon_fee) > 0) {
        lineItems.push({
          desc: 'Unlimited Miles Add-on',
          qty: 1,
          unit: Number(booking.mileage_addon_fee),
          amount: Number(booking.mileage_addon_fee),
        });
      }

      // Unlimited Tolls add-on
      if (Number(booking.toll_addon_fee) > 0) {
        lineItems.push({
          desc: 'Unlimited Tolls Add-on',
          qty: 1,
          unit: Number(booking.toll_addon_fee),
          amount: Number(booking.toll_addon_fee),
        });
      }

      // Bonzah insurance premium (charged to customer)
      if (booking.bonzah_total_charged_cents && Number(booking.bonzah_total_charged_cents) > 0) {
        const tierLabel = booking.bonzah_tier_id
          ? booking.bonzah_tier_id.charAt(0).toUpperCase() + booking.bonzah_tier_id.slice(1)
          : 'Protection';
        lineItems.push({
          desc: `Insurance — ${tierLabel} Coverage`,
          qty: 1,
          unit: Number(booking.bonzah_total_charged_cents) / 100,
          amount: Number(booking.bonzah_total_charged_cents) / 100,
        });
      }

      // Render line items
      lineItems.forEach(item => {
        doc.fontSize(9).font('Helvetica').fillColor(BRAND.dark);
        doc.text(item.desc, colDesc, y, { width: 270 });
        doc.text(String(item.qty), colQty, y, { width: 50, align: 'center' });
        doc.text(fmt(item.unit), colUnit, y, { width: 70, align: 'right' });
        doc.text(fmt(item.amount), colAmt - 60, y, { width: 70, align: 'right' });

        y += 18;
        doc.moveTo(leftMargin, y - 4).lineTo(rightEdge, y - 4).strokeColor(BRAND.border).lineWidth(0.3).stroke();
      });

      // Discount line (negative)
      if (Number(booking.discount_amount) > 0) {
        doc.fontSize(9).font('Helvetica').fillColor(BRAND.green);
        doc.text('Discount', colDesc, y);
        doc.text('', colQty, y, { width: 50, align: 'center' });
        doc.text('', colUnit, y, { width: 70, align: 'right' });
        doc.text(`-${fmt(booking.discount_amount)}`, colAmt - 60, y, { width: 70, align: 'right' });
        y += 18;
        doc.moveTo(leftMargin, y - 4).lineTo(rightEdge, y - 4).strokeColor(BRAND.border).lineWidth(0.3).stroke();
      }

      y += 8;

      /* ═══════════════════════════════════════════════════════
         TOTALS SECTION (right-aligned)
         ═══════════════════════════════════════════════════════ */
      const totalsX = rightEdge - 200;
      const totalsValueX = rightEdge - 10;
      const totalsWidth = 120;

      // Subtotal
      doc.fontSize(9).font('Helvetica').fillColor(BRAND.medium);
      doc.text('Subtotal:', totalsX, y, { width: 80, align: 'right' });
      doc.font('Helvetica-Bold').fillColor(BRAND.dark);
      doc.text(fmt(booking.subtotal), totalsValueX - totalsWidth, y, { width: totalsWidth, align: 'right' });
      y += 16;

      // Tax
      doc.fontSize(9).font('Helvetica').fillColor(BRAND.medium);
      doc.text('Tax (7%):', totalsX, y, { width: 80, align: 'right' });
      doc.font('Helvetica-Bold').fillColor(BRAND.dark);
      doc.text(fmt(booking.tax_amount), totalsValueX - totalsWidth, y, { width: totalsWidth, align: 'right' });
      y += 16;

      // Delivery fee (if taxed separately — already in subtotal line items, so skip if already in line items)
      // Total
      doc.moveTo(totalsX, y).lineTo(rightEdge, y).strokeColor(BRAND.dark).lineWidth(1).stroke();
      y += 8;

      doc.fontSize(12).font('Helvetica-Bold').fillColor(BRAND.dark);
      doc.text('Total:', totalsX, y, { width: 80, align: 'right' });
      doc.text(fmt(booking.total_cost), totalsValueX - totalsWidth, y, { width: totalsWidth, align: 'right' });
      y += 24;

      // Deposit
      if (Number(booking.deposit_amount) > 0) {
        doc.fontSize(9).font('Helvetica').fillColor(BRAND.medium);
        doc.text(`Security Deposit (${booking.deposit_status || 'held'}):`, totalsX - 40, y, { width: 120, align: 'right' });
        doc.font('Helvetica-Bold').fillColor(BRAND.dark);
        doc.text(fmt(booking.deposit_amount), totalsValueX - totalsWidth, y, { width: totalsWidth, align: 'right' });
        y += 16;
      }

      /* ═══════════════════════════════════════════════════════
         PAYMENTS RECEIVED
         ═══════════════════════════════════════════════════════ */
      const paidPayments = payments.filter(p => p.payment_type !== 'refund');
      const refunds = payments.filter(p => p.payment_type === 'refund');

      if (paidPayments.length > 0 || refunds.length > 0) {
        y += 8;
        doc.moveTo(leftMargin, y).lineTo(rightEdge, y).strokeColor(BRAND.border).lineWidth(0.5).stroke();
        y += 12;

        doc.fontSize(8).font('Helvetica-Bold').fillColor(BRAND.accent)
          .text('PAYMENTS RECEIVED', leftMargin, y);
        y += 14;

        for (const p of paidPayments) {
          const pDate = p.created_at ? new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
          doc.fontSize(9).font('Helvetica').fillColor(BRAND.medium);
          doc.text(`${p.method || 'Payment'} — ${pDate}${p.reference_id ? ` (${p.reference_id})` : ''}`, leftMargin, y, { width: 350 });
          doc.font('Helvetica-Bold').fillColor(BRAND.green);
          doc.text(fmt(p.amount), totalsValueX - totalsWidth, y, { width: totalsWidth, align: 'right' });
          y += 14;
        }

        for (const r of refunds) {
          const rDate = r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
          doc.fontSize(9).font('Helvetica').fillColor(BRAND.medium);
          doc.text(`Refund — ${rDate}${r.reference_id ? ` (${r.reference_id})` : ''}`, leftMargin, y, { width: 350 });
          doc.font('Helvetica-Bold').fillColor(BRAND.red);
          doc.text(`-${fmt(r.amount)}`, totalsValueX - totalsWidth, y, { width: totalsWidth, align: 'right' });
          y += 14;
        }

        // Balance
        const totalPaid = paidPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
        const totalRefunded = refunds.reduce((s, r) => s + Number(r.amount || 0), 0);
        const netPaid = totalPaid - totalRefunded;
        const balance = Number(booking.total_cost || 0) - netPaid;

        y += 4;
        doc.moveTo(totalsX, y).lineTo(rightEdge, y).strokeColor(BRAND.border).lineWidth(0.5).stroke();
        y += 8;

        doc.fontSize(10).font('Helvetica-Bold').fillColor(balance > 0 ? BRAND.red : BRAND.green);
        doc.text(balance > 0 ? 'Balance Due:' : 'Overpayment:', totalsX - 40, y, { width: 120, align: 'right' });
        doc.text(fmt(Math.abs(balance)), totalsValueX - totalsWidth, y, { width: totalsWidth, align: 'right' });
        y += 20;
      }

      /* ═══════════════════════════════════════════════════════
         FOOTER
         ═══════════════════════════════════════════════════════ */
      const footerY = 720;

      // Separator line
      doc.moveTo(leftMargin, footerY).lineTo(rightEdge, footerY).strokeColor(BRAND.border).lineWidth(0.5).stroke();

      // Contact info footer
      doc.fontSize(8).font('Helvetica').fillColor(BRAND.light);
      doc.text(`${BRAND.phone}`, leftMargin, footerY + 10);
      doc.text(BRAND.website, leftMargin + (contentWidth / 2) - 40, footerY + 10, { width: 80, align: 'center' });

      // Legal business name
      doc.fontSize(7).font('Helvetica').fillColor(BRAND.light);
      doc.text(`${BRAND.legalName} · ${BRAND.dba}`, leftMargin, footerY + 24);
      doc.text(
        `${BRAND.address} · ${BRAND.cityStateZip}`,
        leftMargin, footerY + 34
      );
      doc.text(`EIN: ${BRAND.ein}`, leftMargin, footerY + 44);

      // "Internal Use Only" watermark text
      doc.fontSize(7).font('Helvetica').fillColor(BRAND.light);
      doc.text('Internal Use Only — Not a customer-facing document', rightEdge - 200, footerY + 44, { width: 200, align: 'right' });

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
