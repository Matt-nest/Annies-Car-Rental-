const OPTIONAL_BOOKING_COLUMNS = new Set([
  'late_return',
  'insurance_reviewed_at',
  'insurance_reviewed_by',
  'insurance_review_reason',
]);

export function getMissingSchemaColumn(error) {
  const message = error?.message || '';
  if (error?.code !== 'PGRST204' && !message.includes('schema cache')) return null;
  return message.match(/Could not find the '([^']+)' column/)?.[1] || null;
}

export async function updateBookingWithSchemaFallback(supabase, bookingId, fields, { context = 'bookings update' } = {}) {
  const payload = { ...fields };
  const skippedColumns = [];

  while (true) {
    const { error } = await supabase
      .from('bookings')
      .update(payload)
      .eq('id', bookingId);

    if (!error) {
      if (skippedColumns.length) {
        console.warn(`[SchemaFallback] ${context} skipped optional booking columns: ${skippedColumns.join(', ')}`);
      }
      return { success: true, skippedColumns };
    }

    const missingColumn = getMissingSchemaColumn(error);
    if (
      missingColumn &&
      OPTIONAL_BOOKING_COLUMNS.has(missingColumn) &&
      Object.prototype.hasOwnProperty.call(payload, missingColumn)
    ) {
      delete payload[missingColumn];
      skippedColumns.push(missingColumn);
      continue;
    }

    throw error;
  }
}
