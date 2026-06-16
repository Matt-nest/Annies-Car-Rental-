import { PassThrough } from 'stream';
import { supabase } from '../db/supabase.js';
import { generateRentalAgreementPdf } from '../utils/pdfGenerator.js';
import { generateInvoicePdf, generateInvoiceNumber } from '../utils/invoicePdfGenerator.js';

/**
 * documentService — the per-customer / per-booking document archive.
 *
 * Every generated contract + settlement invoice PDF is persisted to the private
 * `documents` storage bucket and recorded in the `documents` table, so each
 * customer has a folder of every contract and invoice ever generated (an
 * immutable legal record — rows are insert-only).
 *
 * The PDF generators (pdfGenerator, invoicePdfGenerator) pipe to any writable
 * stream, so we capture them to a Buffer via PassThrough — no generator changes.
 */

const BUCKET = 'documents';

async function ensureBucket() {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (!data) {
    await supabase.storage.createBucket(BUCKET, {
      public: false,
      allowedMimeTypes: ['application/pdf'],
      fileSizeLimit: 20 * 1024 * 1024,
    });
    console.log(`[Storage] Created bucket: ${BUCKET} (private)`);
  }
}

/** Run a stream-piping PDF generator and collect the result into a Buffer. */
async function renderToBuffer(pipeFn) {
  const stream = new PassThrough();
  const chunks = [];
  stream.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
  await pipeFn(stream);
  return done;
}

export async function renderContractBuffer(agreement, booking) {
  return renderToBuffer((stream) => generateRentalAgreementPdf(agreement || {}, booking, stream));
}

export async function renderInvoiceBuffer({ booking, invoiceNumber }) {
  return renderToBuffer((stream) => generateInvoicePdf({ booking, invoiceNumber, stream }));
}

/** Upload a PDF buffer to the documents bucket and insert a documents row. */
async function archive({ buffer, type, booking, fileName, generatedBy = 'system', metadata = {} }) {
  await ensureBucket();
  const safeCode = (booking.booking_code || booking.id || 'doc').toString().replace(/[^A-Za-z0-9_-]/g, '');
  const path = `${type}/${safeCode}/${Date.now()}-${fileName}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: 'application/pdf', upsert: false });
  if (upErr) throw Object.assign(new Error(`Document upload failed: ${upErr.message}`), { status: 500 });

  const { data, error } = await supabase
    .from('documents')
    .insert({
      booking_id: booking.id,
      customer_id: booking.customer_id || booking.customers?.id || null,
      type,
      booking_code: booking.booking_code || null,
      file_path: path,
      file_name: fileName,
      generated_by: generatedBy,
      metadata,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Archive a rental agreement/contract PDF for a booking. Renders from the current
 * rental_agreements row (if any) + booking. Each call is a deliberate version.
 */
export async function archiveContract({ bookingId, generatedBy = 'system', metadata = {} }) {
  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select('*, customers (*), vehicles (*)')
    .eq('id', bookingId)
    .single();
  if (bErr || !booking) throw Object.assign(new Error('Booking not found'), { status: 404 });

  const { data: agreement } = await supabase
    .from('rental_agreements')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle();

  const buffer = await renderContractBuffer(agreement, booking);
  const fileName = `Rental_Agreement_${booking.booking_code}.pdf`;
  return archive({ buffer, type: 'contract', booking, fileName, generatedBy, metadata });
}

/**
 * Archive a settlement invoice PDF for a booking. Idempotent per invoice_number —
 * re-downloading an existing invoice does not pile up duplicate versions.
 */
export async function archiveInvoice({ bookingId, booking: bookingArg, invoiceNumber, generatedBy = 'system' }) {
  let booking = bookingArg;
  if (!booking) {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, customers (*), vehicles (*), payments (*)')
      .eq('id', bookingId)
      .single();
    if (error || !data) throw Object.assign(new Error('Booking not found'), { status: 404 });
    booking = data;
  }
  const number = invoiceNumber || generateInvoiceNumber(booking);

  // Skip if we already archived this exact invoice number.
  const { data: existing } = await supabase
    .from('documents')
    .select('id')
    .eq('booking_id', booking.id)
    .eq('type', 'invoice')
    .contains('metadata', { invoice_number: number })
    .maybeSingle();
  if (existing) return existing;

  const buffer = await renderInvoiceBuffer({ booking, invoiceNumber: number });
  const fileName = `Invoice_${booking.booking_code}.pdf`;
  return archive({ buffer, type: 'invoice', booking, fileName, generatedBy, metadata: { invoice_number: number } });
}

/** List archived documents, optionally filtered by booking or customer. */
export async function listDocuments({ bookingId, customerId } = {}) {
  let query = supabase
    .from('documents')
    .select('id, booking_id, customer_id, type, booking_code, file_name, generated_by, metadata, created_at')
    .order('created_at', { ascending: false });
  if (bookingId) query = query.eq('booking_id', bookingId);
  if (customerId) query = query.eq('customer_id', customerId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/** Fetch a signed download URL for one archived document. */
export async function getDocumentDownloadUrl(documentId) {
  const { data: doc, error } = await supabase
    .from('documents')
    .select('file_path, file_name')
    .eq('id', documentId)
    .single();
  if (error || !doc) throw Object.assign(new Error('Document not found'), { status: 404 });

  const { data: signed, error: sErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(doc.file_path, 60 * 5, { download: doc.file_name });
  if (sErr) throw sErr;
  return { url: signed.signedUrl, file_name: doc.file_name };
}
