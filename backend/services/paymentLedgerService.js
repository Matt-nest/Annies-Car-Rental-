function normalizedAmount(row) {
  return Number(row?.amount || 0).toFixed(2);
}

function normalizedValue(value) {
  return String(value || '').trim().toLowerCase();
}

export function paymentLedgerDedupeKey(row) {
  const referenceId = normalizedValue(row?.reference_id);
  if (!referenceId) return null;

  return [
    normalizedValue(row?.booking_id),
    normalizedValue(row?.payment_type),
    normalizedValue(row?.method),
    referenceId,
    normalizedValue(row?.status),
    normalizedAmount(row),
  ].join('|');
}

function timeValue(value) {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

function shouldReplacePayment(existing, next) {
  const existingTime = timeValue(existing?.created_at || existing?.paid_at);
  const nextTime = timeValue(next?.created_at || next?.paid_at);
  if (nextTime !== existingTime) return nextTime < existingTime;
  return String(next?.id || '') < String(existing?.id || '');
}

export function dedupePaymentLedgerRows(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const canonicalByKey = new Map();
  const passthrough = [];

  for (const row of rows) {
    const key = paymentLedgerDedupeKey(row);
    if (!key) {
      passthrough.push(row);
      continue;
    }

    const existing = canonicalByKey.get(key);
    if (!existing || shouldReplacePayment(existing, row)) {
      canonicalByKey.set(key, row);
    }
  }

  const canonicalRows = new Set(Array.from(canonicalByKey.values()));
  const canonicalIds = new Set(
    Array.from(canonicalRows)
      .map((row) => row?.id)
      .filter(Boolean)
  );

  return rows.filter((row) => {
    const key = paymentLedgerDedupeKey(row);
    if (!key) return passthrough.includes(row);
    return row?.id ? canonicalIds.has(row.id) : canonicalRows.has(row);
  });
}

export function withDedupedBookingPayments(booking) {
  if (!booking || !Array.isArray(booking.payments)) return booking;
  return {
    ...booking,
    payments: dedupePaymentLedgerRows(booking.payments),
  };
}
