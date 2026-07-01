import { AlertCircle, RefreshCw } from 'lucide-react';

export default function DataError({ error, onRetry }) {
  if (!error) return null;
  const message = typeof error === 'string' ? error : (error?.message || 'Something went wrong.');
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--danger-color, #ef4444)' }}>
      <AlertCircle size={16} className="shrink-0" />
      <span className="flex-1 min-w-0">{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry}
          className="inline-flex items-center gap-1.5 font-semibold shrink-0 hover:opacity-80 transition-opacity">
          <RefreshCw size={13} /> Retry
        </button>
      )}
    </div>
  );
}
