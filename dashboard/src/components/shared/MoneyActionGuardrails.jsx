import { AlertTriangle, CheckCircle2, Clock3, ShieldCheck } from 'lucide-react';
import Modal from './Modal';

export function formatMoney(value, maximumFractionDigits = 2) {
  const n = Number(value || 0);
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits,
  });
}

export function buildActionEntry(action, status = 'Completed') {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    source: action?.source || 'session',
    status,
    title: action?.title || 'Action recorded',
    detail: action?.auditDetail || action?.impact || '',
    subject: action?.subject || '',
    amount: action?.amount,
    at: new Date().toISOString(),
  };
}

export function normalizeAuditEntries(entries = []) {
  return entries.map((entry) => ({
    id: entry.id,
    source: 'persistent',
    status: entry.status || 'completed',
    title: entry.title || 'Action recorded',
    detail: entry.detail || entry.metadata?.detail || '',
    subject: entry.subject || entry.metadata?.subject || entry.metadata?.booking_code || '',
    amount: entry.amount,
    actorEmail: entry.actorEmail,
    at: entry.at || entry.created_at,
  }));
}

export function MoneyActionConfirm({ action, busy = false, onCancel, onConfirm }) {
  if (!action) return null;
  const tone = action.tone || 'amber';
  const confirmClass = tone === 'danger' ? 'btn-danger' : 'btn-primary';

  return (
    <Modal open={!!action} onClose={busy ? undefined : onCancel} title={action.title || 'Confirm Action'}>
      <div className="space-y-5">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card-hover)] p-3">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{action.subject}</p>
          {action.amount != null && (
            <p className="mt-1 text-xl font-bold tabular-nums text-[var(--text-primary)]">
              {formatMoney(action.amount, 2)}
            </p>
          )}
          {action.impact && <p className="mt-1 text-xs text-[var(--text-secondary)]">{action.impact}</p>}
        </div>

        {Array.isArray(action.checklist) && action.checklist.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Before confirming</p>
            {action.checklist.map((item) => (
              <div key={item} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        )}

        {action.warning && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
              <p className="text-xs text-[var(--text-secondary)]">{action.warning}</p>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Audit trail</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {action.auditDetail || 'This action will be visible in the booking money history and this session action log.'}
          </p>
        </div>

        <div className="flex gap-3">
          <button type="button" className="btn-secondary flex-1 justify-center" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={`${confirmClass} flex-1 justify-center`} disabled={busy} onClick={onConfirm}>
            {busy && <Clock3 size={14} className="animate-spin" />}
            {action.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function ActionHistoryPanel({ entries = [], title = 'Action history' }) {
  const hasPersistent = entries.some((entry) => entry.source === 'persistent');
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">{title}</p>
        <span className="text-[10px] text-[var(--text-tertiary)]">{hasPersistent ? 'Persistent' : 'This session'}</span>
      </div>
      {entries.length === 0 ? (
        <p className="mt-2 text-xs text-[var(--text-tertiary)]">No money actions recorded yet.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {entries.slice(0, 5).map((entry) => (
            <div key={entry.id} className="flex items-start gap-2 rounded-lg bg-[var(--bg-card-hover)] px-2.5 py-2">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[var(--text-primary)]">
                  {entry.title}
                  {entry.amount != null && <span className="tabular-nums"> · {formatMoney(entry.amount, 2)}</span>}
                </p>
                {(entry.subject || entry.detail) && (
                  <p className="text-[11px] text-[var(--text-tertiary)] truncate">{entry.subject || entry.detail}</p>
                )}
                {entry.actorEmail && (
                  <p className="text-[10px] text-[var(--text-tertiary)] truncate">By {entry.actorEmail}</p>
                )}
              </div>
              <span className="text-[10px] text-[var(--text-tertiary)]">
                {new Date(entry.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DisabledReason({ reason }) {
  if (!reason) return null;
  return <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">{reason}</p>;
}
