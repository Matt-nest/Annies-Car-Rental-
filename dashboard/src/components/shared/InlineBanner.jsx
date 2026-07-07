/** Compact inline banner for tab-level action feedback (replaces alert()). */
export default function InlineBanner({ message, tone = 'error', onDismiss }) {
  if (!message) return null;
  const isError = tone === 'error';
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-2 px-3 py-2.5 rounded-xl text-sm"
      style={{
        backgroundColor: isError ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
        border: `1px solid ${isError ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
        color: isError ? 'var(--danger-color)' : '#22c55e',
      }}
    >
      <span className="min-w-0">{message}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="text-xs underline shrink-0">Dismiss</button>
      )}
    </div>
  );
}
