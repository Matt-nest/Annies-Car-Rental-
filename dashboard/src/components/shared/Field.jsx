/**
 * Reusable label/value display field.
 */
export default function Field({ label, value }) {
  return (
    <div>
      <p
        className="text-[10px] uppercase tracking-wider font-semibold mb-1"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {label}
      </p>
      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
        {value || '—'}
      </p>
    </div>
  );
}
