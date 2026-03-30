import { Shield, Info } from 'lucide-react';
import { useTheme } from '../App';

export default function InsuranceExplainer() {
  const { theme } = useTheme();

  return (
    <div
      className="rounded-2xl border p-6 space-y-4"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
    >
      <div className="flex items-center gap-4">
        <div
          className="p-3 rounded-xl shrink-0"
          style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)' }}
        >
          <Shield size={22} style={{ color: 'var(--text-secondary)' }} />
        </div>
        <div>
          <h4 className="font-medium text-sm">Insurance & Protection</h4>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Options available after approval</p>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <div className="flex items-start gap-3 text-sm">
          <Info size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
          <p style={{ color: 'var(--text-secondary)' }} className="leading-relaxed">
            Protection plans are available for every rental. Coverage details and pricing are reviewed with you after your request is approved.
          </p>
        </div>
        <div className="flex items-start gap-3 text-sm">
          <Info size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
          <p style={{ color: 'var(--text-secondary)' }} className="leading-relaxed">
            You can bring your own coverage or select from our available plans. We'll walk you through the options before your rental begins.
          </p>
        </div>
      </div>

      <div
        className="rounded-xl border p-4 text-xs leading-relaxed"
        style={{
          backgroundColor: 'var(--bg-card-hover)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-tertiary)',
        }}
      >
        No insurance purchase is required at the time of request. All coverage details are finalized after availability is confirmed.
      </div>
    </div>
  );
}
