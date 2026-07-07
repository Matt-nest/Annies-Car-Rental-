import { AlertCircle, RefreshCw } from 'lucide-react';

export default function DataError({ error, message, onRetry }) {
  const text = error || message;
  if (!text) return null;
  const label = typeof text === 'string' ? text : text?.message || 'Something went wrong';
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm"
      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--danger-color, #ef4444)' }}>
      <div className="flex items-center gap-3 min-w-0">
        <AlertCircle size={16} className="shrink-0" />
        <span>{label}</span>
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-ghost py-1.5 px-2.5 shrink-0 text-xs">
          <RefreshCw size={13} /> Retry
        </button>
      )}
    </div>
  );
}
