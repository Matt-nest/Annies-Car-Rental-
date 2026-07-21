import PDFDocument from 'pdfkit';
import brand from '../config/brand.js';
import { addRentalAgreementPdfPages } from './pdfGenerator.js';

const COLORS = {
  ink: '#1C1917',
  muted: '#78716C',
  border: '#E7E5E4',
  panel: '#FAFAF9',
  accent: brand.colors?.accent || '#2563EB',
  good: '#15803D',
  danger: '#B91C1C',
};

function money(cents) {
  return `$${(Number(cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function date(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return String(value);
  }
}

function label(value) {
  return String(value || '-').replace(/_/g, ' ');
}

function addSectionTitle(doc, title, y) {
  doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.accent).text(title.toUpperCase(), 50, y);
  doc.moveTo(50, y + 17).lineTo(562, y + 17).strokeColor(COLORS.border).lineWidth(1).stroke();
  return y + 28;
}

function addRow(doc, left, right, x, y, width = 240) {
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text(left, x, y, { width: width / 2 });
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.ink).text(right ?? '-', x + width / 2, y, { width: width / 2, align: 'right' });
  return y + 15;
}

function ensureSpace(doc, y, required = 80) {
  if (y + required < 742) return y;
  doc.addPage();
  return 50;
}

async function loadImage(url) {
  if (!url || !/^https?:/i.test(url)) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

async function addPhotoGrid(doc, title, photos, x, y) {
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.ink).text(title, x, y);
  y += 14;
  const shown = (photos || []).slice(0, 8);
  if (!shown.length) {
    doc.roundedRect(x, y, 240, 58, 6).strokeColor(COLORS.border).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text('No photos recorded', x + 10, y + 22, { width: 220, align: 'center' });
    return y + 70;
  }

  for (let i = 0; i < shown.length; i += 1) {
    const px = x + (i % 2) * 122;
    const py = y + Math.floor(i / 2) * 92;
    doc.roundedRect(px, py, 112, 72, 6).strokeColor(COLORS.border).stroke();
    const image = await loadImage(shown[i].url);
    if (image) {
      try {
        doc.image(image, px + 4, py + 4, { fit: [104, 52], align: 'center', valign: 'center' });
      } catch {
        doc.font('Helvetica').fontSize(7).fillColor(COLORS.muted).text('Photo preview unavailable', px + 8, py + 26, { width: 96, align: 'center' });
      }
    } else {
      doc.font('Helvetica').fontSize(7).fillColor(COLORS.muted).text('Photo preview unavailable', px + 8, py + 26, { width: 96, align: 'center' });
    }
    doc.font('Helvetica').fontSize(6.5).fillColor(COLORS.muted).text(label(shown[i].slot || shown[i].record_type), px + 5, py + 58, { width: 102, align: 'center' });
  }
  return y + (Math.ceil(shown.length / 2) * 92) + 4;
}

function tableHeader(doc, columns, y) {
  columns.forEach((column) => {
    doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.muted).text(column.label, column.x, y, { width: column.width, align: column.align || 'left' });
  });
  return y + 13;
}

function tableRow(doc, columns, row, y) {
  columns.forEach((column) => {
    doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.ink).text(row[column.key] ?? '-', column.x, y, { width: column.width, align: column.align || 'left' });
  });
  return y + 14;
}

export async function generateFinalRentalPacketPdf({ packet, stream }) {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 40, bottom: 40, left: 50, right: 50 },
  });

  const finished = new Promise((resolve, reject) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    doc.on('end', done);
    stream.on('finish', done);
    stream.on('error', reject);
  });

  doc.pipe(stream);

  const customerName = [packet.customer?.first_name, packet.customer?.last_name].filter(Boolean).join(' ') || 'Customer';
  const bookingCode = packet.booking?.booking_code || packet.booking?.id || 'booking';
  const settlement = packet.settlement || {};
  const totals = settlement.totals || {};

  doc.rect(0, 0, 612, 6).fill(COLORS.accent);
  doc.font('Helvetica-Bold').fontSize(20).fillColor(COLORS.ink).text('Final Rental Packet', 50, 34);
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text(`${brand.name} | ${brand.phone} | ${brand.email}`, 50, 61);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.ink).text(bookingCode, 412, 38, { width: 150, align: 'right' });
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text(`Generated ${date(packet.generated_at)}`, 412, 55, { width: 150, align: 'right' });

  let y = 92;
  doc.roundedRect(50, y, 512, 112, 8).fillAndStroke(COLORS.panel, COLORS.border);
  let leftY = y + 18;
  leftY = addRow(doc, 'Customer', customerName, 68, leftY, 220);
  leftY = addRow(doc, 'Email', packet.customer?.email || '-', 68, leftY, 220);
  leftY = addRow(doc, 'Phone', packet.customer?.phone || '-', 68, leftY, 220);
  let rightY = y + 18;
  rightY = addRow(doc, 'Vehicle', packet.vehicle?.label || '-', 314, rightY, 220);
  rightY = addRow(doc, 'Pickup', `${date(packet.booking?.pickup_date)} ${packet.booking?.pickup_time || ''}`.trim(), 314, rightY, 220);
  rightY = addRow(doc, 'Return', `${date(packet.booking?.return_date)} ${packet.booking?.return_time || ''}`.trim(), 314, rightY, 220);
  rightY = addRow(doc, 'Status', label(packet.booking?.status), 314, rightY, 220);

  y = addSectionTitle(doc, 'Pickup vs Return Evidence', 232);
  y = addRow(doc, 'Pickup odometer', packet.pickup?.odometer ?? '-', 50, y, 220);
  y = addRow(doc, 'Return odometer', packet.return?.odometer ?? '-', 50, y, 220);
  y = addRow(doc, 'Miles driven', settlement.mileage?.miles_driven ?? '-', 50, y, 220);
  let fuelY = y - 45;
  fuelY = addRow(doc, 'Pickup fuel', label(packet.pickup?.fuel_level), 314, fuelY, 220);
  fuelY = addRow(doc, 'Return fuel', label(packet.return?.fuel_level), 314, fuelY, 220);
  fuelY = addRow(doc, 'Pickup photos', String(packet.pickup?.photos?.length || 0), 314, fuelY, 220);
  fuelY = addRow(doc, 'Return photos', String(packet.return?.photos?.length || 0), 314, fuelY, 220);

  y = Math.max(y + 10, fuelY + 10);
  const photoY = ensureSpace(doc, y, 420);
  await addPhotoGrid(doc, 'Pickup Photos', packet.pickup?.photos, 50, photoY);
  y = await addPhotoGrid(doc, 'Return Photos', packet.return?.photos, 322, photoY);

  y = ensureSpace(doc, y + 10, 220);
  y = addSectionTitle(doc, 'Final Settlement Summary', y);
  y = addRow(doc, 'Security deposit', money(settlement.deposit?.amount_cents), 50, y, 240);
  y = addRow(doc, 'Deposit status', label(settlement.deposit?.status), 50, y, 240);
  y = addRow(doc, 'Deposit applied', money(settlement.deposit?.applied_amount_cents), 50, y, 240);
  let totalsY = y - 45;
  totalsY = addRow(doc, 'Incidentals', money(totals.incidental_total_cents), 314, totalsY, 220);
  totalsY = addRow(doc, 'Tolls', money(totals.toll_total_cents), 314, totalsY, 220);
  totalsY = addRow(doc, 'Refunds issued', money(totals.refund_total_cents), 314, totalsY, 220);
  totalsY = addRow(doc, 'Declines', String(totals.failed_payment_count || 0), 314, totalsY, 220);
  totalsY = addRow(doc, 'Balance due', money(totals.balance_due_cents), 314, totalsY, 220);
  totalsY = addRow(doc, 'Refund due', money(totals.refund_due_cents), 314, totalsY, 220);
  y = Math.max(y, totalsY) + 8;

  const incidentals = settlement.incidentals || [];
  if (incidentals.length) {
    y = ensureSpace(doc, y, 120);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.ink).text('Charges', 50, y);
    y = tableHeader(doc, [
      { key: 'type', label: 'Type', x: 50, width: 120 },
      { key: 'description', label: 'Description', x: 170, width: 260 },
      { key: 'amount', label: 'Amount', x: 470, width: 92, align: 'right' },
    ], y + 17);
    incidentals.forEach((row) => {
      y = ensureSpace(doc, y, 30);
      y = tableRow(doc, [
        { key: 'type', x: 50, width: 120 },
        { key: 'description', x: 170, width: 260 },
        { key: 'amount', x: 470, width: 92, align: 'right' },
      ], { type: label(row.type), description: row.description || '-', amount: money(row.amount_cents) }, y);
    });
    y += 8;
  }

  const payments = [
    ...(settlement.payments?.completed || []).map((row) => ({ ...row, kind: 'Payment' })),
    ...(settlement.payments?.refunds || []).map((row) => ({ ...row, kind: 'Refund' })),
    ...(settlement.payments?.declines || []).map((row) => ({ ...row, kind: 'Decline' })),
  ];
  if (payments.length) {
    y = ensureSpace(doc, y, 120);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.ink).text('Payments, Declines, Refunds', 50, y);
    y = tableHeader(doc, [
      { key: 'kind', label: 'Kind', x: 50, width: 80 },
      { key: 'method', label: 'Method', x: 130, width: 90 },
      { key: 'status', label: 'Status', x: 220, width: 90 },
      { key: 'detail', label: 'Issuer detail', x: 310, width: 160 },
      { key: 'amount', label: 'Amount', x: 488, width: 74, align: 'right' },
    ], y + 17);
    payments.forEach((row) => {
      y = ensureSpace(doc, y, 30);
      y = tableRow(doc, [
        { key: 'kind', x: 50, width: 80 },
        { key: 'method', x: 130, width: 90 },
        { key: 'status', x: 220, width: 90 },
        { key: 'detail', x: 310, width: 160 },
        { key: 'amount', x: 488, width: 74, align: 'right' },
      ], {
        kind: row.kind,
        method: label(row.method),
        status: label(row.status),
        detail: row.failure_message || row.failure_code || row.reference_id || '-',
        amount: money(Math.abs(row.amount_cents)),
      }, y);
    });
  }

  const agreementSource = packet.agreement?.source;
  if (agreementSource?.agreement && agreementSource?.booking) {
    doc.addPage({ size: 'LETTER', margins: { top: 40, bottom: 40, left: 50, right: 50 } });
    doc.rect(0, 0, 612, 6).fill(COLORS.accent);
    doc.font('Helvetica-Bold').fontSize(20).fillColor(COLORS.ink).text('Signed Rental Agreement Appendix', 50, 80);
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted)
      .text('The following pages are the signed rental agreement attached to this final rental packet.', 50, 112, { width: 460 });
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted)
      .text(`Customer signed: ${date(packet.agreement?.customer_signed_at)}`, 50, 152)
      .text(`Owner signed: ${date(packet.agreement?.owner_signed_at)}`, 50, 170);
    doc.addPage({ size: 'LETTER', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    addRentalAgreementPdfPages(doc, agreementSource.agreement, agreementSource.booking);
  }

  doc.end();
  return finished;
}
