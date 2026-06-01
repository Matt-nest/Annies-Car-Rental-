import { AlertCircle } from 'lucide-react';

export default function DataError({ error }) {
  if (!error) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--danger-color, #ef4444)' }}>
      <AlertCircle size={16} className="shrink-0" />
      {error}
    </div>
  );
}
