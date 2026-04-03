/**
 * Reusable label/value display field.
 * Used across BookingDetailPage and VehicleDetailPage.
 */
export default function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs text-stone-400">{label}</p>
      <p className="text-sm text-stone-900 font-medium">{value || '—'}</p>
    </div>
  );
}
