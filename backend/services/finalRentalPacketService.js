import { supabase } from '../db/supabase.js';
import { getBookingDetail } from './bookingService.js';

const FINAL_PACKET_STATUSES = new Set(['returned', 'completed']);
const PICKUP_RECORD_TYPES = new Set(['admin_prep', 'admin_handoff', 'admin_checkin', 'customer_checkin']);
const RETURN_RECORD_TYPES = new Set(['customer_checkout', 'admin_inspection', 'admin_checkout']);

function cents(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function dollarsToCents(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function normalizeStatus(status) {
  return String(status || '').toLowerCase();
}

function paymentCents(payment) {
  return dollarsToCents(payment?.amount);
}

function isCompletedPayment(payment) {
  return normalizeStatus(payment?.status) === 'completed' && normalizeStatus(payment?.payment_type) !== 'refund';
}

function isDeclinedPayment(payment) {
  return ['failed', 'declined', 'canceled', 'cancelled'].includes(normalizeStatus(payment?.status));
}

function isRefund(payment) {
  return normalizeStatus(payment?.payment_type) === 'refund' || Number(payment?.amount || 0) < 0;
}

function publicPayment(payment) {
  return {
    id: payment.id,
    payment_type: payment.payment_type,
    method: payment.method,
    status: payment.status,
    amount_cents: paymentCents(payment),
    reference_id: payment.reference_id || null,
    notes: payment.notes || null,
    paid_at: payment.paid_at || payment.created_at || null,
    failure_code: payment.failure_code || payment.decline_code || null,
    failure_message: payment.failure_message || payment.last_error || null,
  };
}

function publicIncidental(row) {
  return {
    id: row.id,
    type: row.type,
    description: row.description,
    amount_cents: cents(row.amount),
    waived: Boolean(row.waived),
    status: row.status || null,
    created_at: row.created_at || null,
  };
}

function publicToll(row) {
  return {
    id: row.id,
    plate: row.plate || null,
    toll_date: row.toll_date || row.date || null,
    location: row.location || null,
    description: row.description || null,
    amount_cents: cents(row.amount),
    status: row.status || null,
  };
}

async function signCheckinPhoto(pathOrUrl) {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return pathOrUrl;
  if (/^(https?:|data:)/i.test(pathOrUrl)) return pathOrUrl;
  try {
    const { data } = await supabase.storage
      .from('checkin-photos')
      .createSignedUrl(pathOrUrl, 60 * 60 * 2);
    return data?.signedUrl || pathOrUrl;
  } catch {
    return pathOrUrl;
  }
}

function extractPhotoEntries(record) {
  const entries = [];
  if (Array.isArray(record.photo_urls)) {
    record.photo_urls.forEach((url, index) => {
      if (url) entries.push({ slot: `Photo ${index + 1}`, url });
    });
  }
  if (record.photo_slots && typeof record.photo_slots === 'object') {
    Object.entries(record.photo_slots).forEach(([slot, value]) => {
      if (Array.isArray(value)) {
        value.forEach((url, index) => {
          if (url) entries.push({ slot: `${slot} ${index + 1}`, url });
        });
      } else if (value) {
        entries.push({ slot, url: value });
      }
    });
  }
  return entries;
}

async function signRecordPhotos(record) {
  const signed = { ...record };
  if (Array.isArray(signed.photo_urls)) {
    signed.photo_urls = await Promise.all(signed.photo_urls.map(signCheckinPhoto));
  }
  if (signed.photo_slots && typeof signed.photo_slots === 'object') {
    const slots = {};
    for (const [key, value] of Object.entries(signed.photo_slots)) {
      slots[key] = Array.isArray(value)
        ? await Promise.all(value.map(signCheckinPhoto))
        : await signCheckinPhoto(value);
    }
    signed.photo_slots = slots;
  }
  return signed;
}

function publicRecord(record) {
  return {
    id: record.id,
    record_type: record.record_type,
    odometer: record.odometer ?? null,
    fuel_level: record.fuel_level || null,
    condition_notes: record.condition_notes || null,
    created_by: record.created_by || null,
    created_at: record.created_at || null,
    photos: extractPhotoEntries(record),
  };
}

function latestValue(records, field) {
  const found = [...records].reverse().find((record) => record[field] !== null && record[field] !== undefined && record[field] !== '');
  return found ? found[field] : null;
}

function vehicleName(vehicle = {}) {
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.vehicle_code || 'Vehicle';
}

export function isFinalRentalPacketAvailable(booking) {
  return FINAL_PACKET_STATUSES.has(normalizeStatus(booking?.status));
}

export async function getFinalRentalPacket(bookingId) {
  const booking = await getBookingDetail(bookingId);

  const [
    { data: rawRecords = [], error: recordsError },
    { data: deposit = null, error: depositError },
    { data: incidentals = [], error: incidentalsError },
    { data: tolls = [], error: tollsError },
    { data: payments = [], error: paymentsError },
    { data: invoice = null, error: invoiceError },
  ] = await Promise.all([
    supabase.from('checkin_records').select('*').eq('booking_id', bookingId).order('created_at', { ascending: true }),
    supabase.from('booking_deposits').select('*').eq('booking_id', bookingId).maybeSingle(),
    supabase.from('incidentals').select('*').eq('booking_id', bookingId).order('created_at', { ascending: true }),
    supabase.from('toll_charges').select('*').eq('booking_id', bookingId).order('toll_date', { ascending: true }),
    supabase.from('payments').select('*').eq('booking_id', bookingId).order('created_at', { ascending: true }),
    supabase.from('invoices').select('*').eq('booking_id', bookingId).maybeSingle(),
  ]);

  const firstError = recordsError || depositError || incidentalsError || tollsError || paymentsError || invoiceError;
  if (firstError) throw firstError;

  const signedRecords = await Promise.all((rawRecords || []).map(signRecordPhotos));
  const pickupRecords = signedRecords.filter((record) => PICKUP_RECORD_TYPES.has(record.record_type));
  const returnRecords = signedRecords.filter((record) => RETURN_RECORD_TYPES.has(record.record_type));
  const pickupPublic = pickupRecords.map(publicRecord);
  const returnPublic = returnRecords.map(publicRecord);
  const activeIncidentals = (incidentals || []).filter((row) => !row.waived);
  const completedPayments = (payments || []).filter(isCompletedPayment).map(publicPayment);
  const declines = (payments || []).filter(isDeclinedPayment).map(publicPayment);
  const refunds = (payments || []).filter(isRefund).map(publicPayment);
  const pickupOdometer = Number(latestValue(pickupRecords, 'odometer') || booking.pickup_mileage || booking.checkin_odometer || 0) || null;
  const returnOdometer = Number(latestValue(returnRecords, 'odometer') || booking.return_mileage || booking.checkout_odometer || 0) || null;
  const milesDriven = pickupOdometer != null && returnOdometer != null && returnOdometer >= pickupOdometer
    ? returnOdometer - pickupOdometer
    : null;
  const depositAmountCents = cents(deposit?.amount ?? dollarsToCents(booking.deposit_amount));
  const depositRefundAmountCents = cents(deposit?.refund_amount);
  const depositAppliedAmountCents = cents(deposit?.applied_amount ?? invoice?.deposit_applied);
  const incidentalTotalCents = activeIncidentals.reduce((sum, row) => sum + cents(row.amount), 0);
  const tollTotalCents = (tolls || []).reduce((sum, row) => sum + cents(row.amount), 0);
  const completedPaymentTotalCents = completedPayments.reduce((sum, row) => sum + Math.max(0, row.amount_cents), 0);
  const refundTotalCents = refunds.reduce((sum, row) => sum + Math.abs(row.amount_cents), 0);
  const invoiceAmountDueCents = invoice ? cents(invoice.amount_due) : null;
  const computedBalanceCents = Math.max(0, incidentalTotalCents - depositAmountCents + depositRefundAmountCents);
  const computedRefundDueCents = Math.max(0, depositAmountCents - depositRefundAmountCents - incidentalTotalCents);

  return {
    generated_at: new Date().toISOString(),
    available: isFinalRentalPacketAvailable(booking),
    booking: {
      id: booking.id,
      booking_code: booking.booking_code,
      status: booking.status,
      pickup_date: booking.pickup_date,
      return_date: booking.return_date,
      pickup_time: booking.pickup_time,
      return_time: booking.return_time,
      actual_pickup_at: booking.actual_pickup_at || booking.picked_up_at || null,
      actual_return_at: booking.actual_return_at || booking.returned_at || null,
    },
    customer: {
      id: booking.customers?.id || booking.customer_id || null,
      first_name: booking.customers?.first_name || null,
      last_name: booking.customers?.last_name || null,
      email: booking.customers?.email || null,
      phone: booking.customers?.phone || null,
    },
    vehicle: {
      id: booking.vehicles?.id || booking.vehicle_id || null,
      label: vehicleName(booking.vehicles),
      year: booking.vehicles?.year || null,
      make: booking.vehicles?.make || null,
      model: booking.vehicles?.model || null,
      vehicle_code: booking.vehicles?.vehicle_code || null,
      vin: booking.vehicles?.vin || null,
    },
    agreement: {
      customer_signed_at: booking.rental_agreements?.[0]?.customer_signed_at || booking.rental_agreements?.customer_signed_at || null,
      owner_signed_at: booking.rental_agreements?.[0]?.owner_signed_at || booking.rental_agreements?.owner_signed_at || null,
    },
    pickup: {
      odometer: pickupOdometer,
      fuel_level: latestValue(pickupRecords, 'fuel_level'),
      records: pickupPublic,
      photos: pickupPublic.flatMap((record) => record.photos.map((photo) => ({ ...photo, record_type: record.record_type, created_at: record.created_at }))),
    },
    return: {
      odometer: returnOdometer,
      fuel_level: latestValue(returnRecords, 'fuel_level'),
      records: returnPublic,
      photos: returnPublic.flatMap((record) => record.photos.map((photo) => ({ ...photo, record_type: record.record_type, created_at: record.created_at }))),
    },
    settlement: {
      deposit: {
        amount_cents: depositAmountCents,
        status: deposit?.status || booking.deposit_status || 'none',
        refund_amount_cents: depositRefundAmountCents,
        applied_amount_cents: depositAppliedAmountCents,
      },
      mileage: {
        pickup_odometer: pickupOdometer,
        return_odometer: returnOdometer,
        miles_driven: milesDriven,
      },
      fuel: {
        pickup_fuel_level: latestValue(pickupRecords, 'fuel_level'),
        return_fuel_level: latestValue(returnRecords, 'fuel_level'),
      },
      cleaning: activeIncidentals.filter((row) => normalizeStatus(row.type).includes('clean')).map(publicIncidental),
      incidentals: activeIncidentals.map(publicIncidental),
      tolls: (tolls || []).map(publicToll),
      payments: {
        completed: completedPayments,
        declines,
        refunds,
      },
      invoice: invoice || null,
      totals: {
        incidental_total_cents: incidentalTotalCents,
        toll_total_cents: tollTotalCents,
        completed_payment_total_cents: completedPaymentTotalCents,
        failed_payment_count: declines.length,
        refund_total_cents: refundTotalCents,
        balance_due_cents: invoiceAmountDueCents != null ? Math.max(0, invoiceAmountDueCents) : computedBalanceCents,
        refund_due_cents: invoiceAmountDueCents != null ? Math.max(0, -invoiceAmountDueCents) : computedRefundDueCents,
      },
    },
  };
}
