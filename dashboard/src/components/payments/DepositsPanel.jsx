import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Shield, RefreshCw, ExternalLink, DollarSign, ClipboardCheck, Clock, Calculator } from 'lucide-react';
import { api } from '../../api/client';
import { SkeletonTable } from '../shared/Skeleton';
import EmptyState from '../shared/EmptyState';
import DataError from '../shared/DataError';
import Modal from '../shared/Modal';
import InlineBanner from '../shared/InlineBanner';
import { ActionHistoryPanel, DisabledReason, MoneyActionConfirm, buildActionEntry, normalizeAuditEntries } from '../shared/MoneyActionGuardrails';

const STATUS_STYLES = {
  held: { label: 'Held', color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  partial_refund: { label: 'Partial', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  refunded: { label: 'Refunded', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  applied: { label: 'Applied', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
};

function depositRefundable(row) {
  return Math.max(0, Number(row.amount || 0) - Number(row.refund_amount || 0) - Number(row.applied_amount || 0));
}

function requiresDepositReview(row) {
  return ['held', 'partial_refund'].includes(row.status)
    && ['returned', 'completed'].includes(String(row.bookings?.status || '').toLowerCase());
}

function settlementLabel(row) {
  const status = row.bookings?.status;
  if (requiresDepositReview(row)) return 'Review required';
  if (row.status !== 'held') return STATUS_STYLES[row.status]?.label || row.status;
  if (status === 'active') return 'Hold until return';
  return 'Pre-trip hold';
}

function settlementTone(row) {
  const status = row.bookings?.status;
  if (requiresDepositReview(row)) return { label: 'Review required', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
  if (row.status !== 'held') return STATUS_STYLES[row.status] || STATUS_STYLES.held;
  if (status === 'active') return { label: 'Hold until return', color: '#6366f1', bg: 'rgba(99,102,241,0.12)' };
  return { label: 'Pre-trip hold', color: '#64748b', bg: 'rgba(148,163,184,0.12)' };
}

export default function DepositsPanel() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ count: 0, total_held_dollars: '0.00' });
  const [status, setStatus] = useState('review_required');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acting, setActing] = useState(null);
  const [settleRow, setSettleRow] = useState(null);
  const [incidentalTotal, setIncidentalTotal] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionHistory, setActionHistory] = useState([]);
  const [persistedHistory, setPersistedHistory] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.listDeposits({ status });
      const audit = await api.getMoneyActions({ limit: 20 }).catch(() => ({ data: [] }));
      setRows(res.data || []);
      setSummary(res.summary || { count: 0, total_held_dollars: '0.00' });
      setPersistedHistory(normalizeAuditEntries(audit?.data || []).filter((entry) => (
        ['deposit_released', 'deposit_settled', 'deposit_recorded', 'payment_refund_issued'].includes(entry.actionKey)
      )));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [status]);

  const recordAction = (action, status) => {
    setActionHistory((items) => [buildActionEntry(action, status), ...items].slice(0, 8));
  };

  const runRelease = async (row, action) => {
    const bookingId = row?.bookings?.id;
    if (!bookingId) return;
    setActing(bookingId);
    setActionError('');
    try {
      await api.releaseDeposit(bookingId);
      setNotice('Deposit release started. Refresh if the gateway needs a few seconds to settle.');
      recordAction(action || {
        title: 'Deposit release started',
        subject: row?.bookings?.booking_code,
        amount: depositRefundable(row) / 100,
      });
      await load();
    } catch (err) {
      setActionError(err.message || 'Release failed');
    }
    setActing(null);
    setConfirmAction(null);
  };

  const requestRelease = (row) => {
    const bookingStatus = String(row?.bookings?.status || '').toLowerCase();
    if (!['returned', 'completed'].includes(bookingStatus)) {
      setActionError('Return/check-out completion must be recorded before releasing a deposit.');
      return;
    }
    const refundable = depositRefundable(row);
    setConfirmAction({
      title: 'Release Full Deposit',
      subject: `${row?.bookings?.booking_code} · ${row?.bookings?.customers?.first_name || ''} ${row?.bookings?.customers?.last_name || ''}`.trim(),
      amount: refundable / 100,
      impact: 'Refunds the remaining security deposit to the original payment method when supported.',
      checklist: ['Vehicle has been returned.', 'Inspection is complete.', 'No damage, fuel, toll, cleaning, or late-return charges are being applied.'],
      warning: 'This may move money immediately and cannot be undone from the dashboard.',
      auditDetail: 'Release will update deposit status, payment ledger, customer notifications, and this session action log.',
      confirmLabel: 'Release Deposit',
      tone: 'danger',
      onConfirm: () => runRelease(row, {
        title: 'Deposit release started',
        subject: row?.bookings?.booking_code,
        amount: refundable / 100,
        auditDetail: 'Operator released the remaining security deposit.',
      }),
    });
  };

  const openSettle = (row) => {
    setSettleRow(row);
    setIncidentalTotal('');
    setActionError('');
  };

  const handleSettle = async (event) => {
    event.preventDefault();
    const amount = Number(incidentalTotal || 0);
    if (!Number.isFinite(amount) || amount < 0) {
      setActionError('Applied charge must be zero or greater.');
      return;
    }
    const bookingId = settleRow?.bookings?.id;
    if (!bookingId) return;
    const refundable = depositRefundable(settleRow);
    const refundEstimate = Math.max(0, refundable - Math.round(amount * 100));
    setConfirmAction({
      title: 'Settle Deposit',
      subject: `${settleRow?.bookings?.booking_code} · ${settleRow?.bookings?.customers?.first_name || ''} ${settleRow?.bookings?.customers?.last_name || ''}`.trim(),
      amount,
      impact: `Applies ${amount.toFixed(2)} from the deposit and refunds about $${(refundEstimate / 100).toFixed(2)}.`,
      checklist: ['Vehicle return is recorded.', 'Inspection charges are final.', 'Incidentals match photos, notes, tolls, fuel, or cleaning records.'],
      warning: 'This may refund the remaining deposit and create settlement ledger rows.',
      auditDetail: 'Settlement will be visible in deposit status, payment ledger, customer notification history, and this session action log.',
      confirmLabel: 'Settle Deposit',
      tone: amount > 0 ? 'danger' : 'amber',
      onConfirm: () => runSettle(amount, refundEstimate),
    });
  };

  const runSettle = async (amount, refundEstimate) => {
    const bookingId = settleRow?.bookings?.id;
    if (!bookingId) return;
    setActing(bookingId);
    setActionError('');
    try {
      await api.settleDeposit(bookingId, { incidentalTotal: amount });
      setSettleRow(null);
      setNotice('Deposit settlement recorded.');
      recordAction({
        title: 'Deposit settled',
        subject: settleRow?.bookings?.booking_code,
        amount,
        auditDetail: `Estimated refund: $${(refundEstimate / 100).toFixed(2)}.`,
      });
      await load();
    } catch (err) {
      setActionError(err.message || 'Settlement failed');
    }
    setActing(null);
    setConfirmAction(null);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Review Required</p>
          <p className="text-2xl font-bold tabular-nums mt-1 text-[var(--text-primary)]">
            {status === 'review_required' ? summary.count : rows.filter(requiresDepositReview).length}
          </p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Refundable Exposure</p>
          <p className="text-2xl font-bold tabular-nums mt-1 text-indigo-500">${summary.total_held_dollars}</p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Ready to Settle</p>
          <p className="text-2xl font-bold tabular-nums mt-1 text-amber-500">
            {rows.filter(requiresDepositReview).length}
          </p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Active Holds</p>
          <p className="text-2xl font-bold tabular-nums mt-1 text-[var(--text-primary)]">
            {rows.filter(row => row.status === 'held' && row.bookings?.status === 'active').length}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: 'review_required', label: 'Review Required' },
          { key: 'held', label: 'Held' },
          { key: 'all', label: 'All' },
          { key: 'refunded', label: 'Refunded' },
          { key: 'applied', label: 'Applied' },
        ].map(opt => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setStatus(opt.key)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: status === opt.key ? 'var(--accent-glow)' : 'var(--bg-card-hover)',
              color: status === opt.key ? 'var(--accent-color)' : 'var(--text-secondary)',
              border: status === opt.key ? '1px solid var(--accent-color)' : '1px solid var(--border-subtle)',
            }}
          >
            {opt.label}
          </button>
        ))}
        <button className="btn-secondary ml-auto" onClick={load}>
          <RefreshCw size={14} /> Sync
        </button>
      </div>

      {error && <DataError message={error} onRetry={load} />}
      <InlineBanner message={actionError} onDismiss={() => setActionError('')} />
      <InlineBanner message={notice} tone="success" onDismiss={() => setNotice('')} />
      <MoneyActionConfirm
        action={confirmAction}
        busy={!!acting}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => confirmAction?.onConfirm?.()}
      />
      <ActionHistoryPanel entries={[...actionHistory, ...persistedHistory]} title="Deposit action history" />

      {loading ? (
        <SkeletonTable rows={4} cols={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No deposits found"
          description={status === 'review_required'
            ? 'Returned/completed deposits needing review appear here before any refund or settlement.'
            : status === 'held'
            ? 'Held deposits appear here after checkout payment or when you record a manual deposit on a booking.'
            : 'Try a different filter.'}
        />
      ) : (
        <>
        <div className="space-y-3 md:hidden">
          {rows.map(row => {
            const b = row.bookings;
            const cust = b?.customers;
            const veh = b?.vehicles;
            const st = settlementTone(row);
            const refundable = depositRefundable(row);
            const settlement = settlementLabel(row);
            const reviewRequired = requiresDepositReview(row);
            const canMoneyMove = ['held', 'partial_refund'].includes(row.status) && refundable > 0 && reviewRequired;
            const disabledReason = ['held', 'partial_refund'].includes(row.status) && refundable > 0 && !reviewRequired
              ? 'Return/check-out completion required before deposit review.'
              : '';
            return (
              <article
                key={row.id}
                className="rounded-3xl p-4 shadow-sm"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link to={`/bookings/${b?.id}`} className="font-mono text-sm font-bold text-[var(--accent-color)]">
                      {b?.booking_code}
                    </Link>
                    <p className="mt-1 text-sm font-semibold text-[var(--text-primary)] truncate">
                      {cust ? `${cust.first_name} ${cust.last_name}` : 'Customer not linked'}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] truncate">
                      {veh ? `${veh.year} ${veh.make} ${veh.model}` : 'Vehicle not linked'}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ color: st.color, backgroundColor: st.bg }}>
                    {settlement}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl p-3" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Held</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-[var(--text-primary)]">${(row.amount / 100).toFixed(2)}</p>
                  </div>
                  <div className="rounded-2xl p-3" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Refundable</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-indigo-500">${(refundable / 100).toFixed(2)}</p>
                  </div>
                </div>

                {reviewRequired && (
                  <p className="mt-3 flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-semibold text-amber-600" style={{ backgroundColor: 'rgba(245,158,11,0.10)' }}>
                    <ClipboardCheck size={13} /> Inspect, apply charges, or refund.
                  </p>
                )}
                {row.status === 'held' && b?.status === 'active' && (
                  <p className="mt-3 flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs text-[var(--text-secondary)]" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                    <Clock size={13} /> Keep held until check-out.
                  </p>
                )}

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Link to={`/bookings/${b?.id}`} className="tap-target rounded-2xl border border-[var(--border-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]">
                    <ExternalLink size={14} /> Open
                  </Link>
                  {['held', 'partial_refund'].includes(row.status) && refundable > 0 && (
                    <>
                      <button
                        type="button"
                        className="tap-target rounded-2xl border border-[var(--border-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] disabled:opacity-50"
                        disabled={acting === b?.id || !canMoneyMove}
                        onClick={() => openSettle(row)}
                      >
                        <Calculator size={14} /> Apply
                      </button>
                      <button
                        type="button"
                        className="tap-target rounded-2xl border border-[var(--border-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] disabled:opacity-50"
                        disabled={acting === b?.id || !canMoneyMove}
                        onClick={() => requestRelease(row)}
                      >
                        <DollarSign size={14} /> Release
                      </button>
                    </>
                  )}
                </div>
                <DisabledReason reason={disabledReason} />
              </article>
            );
          })}
        </div>

        <div className="hidden md:block rounded-xl overflow-hidden scroll-x-contained" style={{ border: '1px solid var(--border-subtle)' }}>
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                {['Booking', 'Customer', 'Vehicle', 'Amount', 'Decision', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const b = row.bookings;
                const cust = b?.customers;
                const veh = b?.vehicles;
                const st = settlementTone(row);
                const refundable = depositRefundable(row);
                const settlement = settlementLabel(row);
                const reviewRequired = requiresDepositReview(row);
                const canMoneyMove = ['held', 'partial_refund'].includes(row.status) && refundable > 0 && reviewRequired;
                const disabledReason = ['held', 'partial_refund'].includes(row.status) && refundable > 0 && !reviewRequired
                  ? 'Return/check-out completion required before deposit review.'
                  : '';
                return (
                  <tr key={row.id} className="border-t border-[var(--border-subtle)]" style={{ backgroundColor: 'var(--bg-card)' }}>
                    <td className="px-4 py-3">
                      <Link to={`/bookings/${b?.id}`} className="font-mono text-xs font-semibold text-[var(--accent-color)] hover:underline">
                        {b?.booking_code}
                      </Link>
                      <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{b?.status}</p>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-primary)]">
                      {cust ? `${cust.first_name} ${cust.last_name}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {veh ? `${veh.year} ${veh.make} ${veh.model}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold tabular-nums text-[var(--text-primary)]">${(row.amount / 100).toFixed(2)}</span>
                      {refundable < row.amount && (
                        <p className="text-[11px] text-[var(--text-tertiary)]">${(refundable / 100).toFixed(2)} refundable</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ color: st.color, backgroundColor: st.bg }}>
                        {settlement}
                      </span>
                      {reviewRequired && (
                        <p className="text-[11px] text-amber-500 mt-1 flex items-center gap-1"><ClipboardCheck size={11} /> Inspect, apply charges, or refund.</p>
                      )}
                      {row.status === 'held' && b?.status === 'active' && (
                        <p className="text-[11px] text-[var(--text-tertiary)] mt-1 flex items-center gap-1"><Clock size={11} /> Keep held until check-out.</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <Link to={`/bookings/${b?.id}`} className="btn-ghost text-xs py-1.5 px-2">
                          <ExternalLink size={13} /> Open
                        </Link>
                        {['held', 'partial_refund'].includes(row.status) && refundable > 0 && (
                          <>
                            <button
                              type="button"
                              className="btn-secondary text-xs py-1.5 px-2"
                              disabled={acting === b?.id || !canMoneyMove}
                              onClick={() => openSettle(row)}
                            >
                              <Calculator size={13} /> Apply
                            </button>
                            <button
                              type="button"
                              className="btn-secondary text-xs py-1.5 px-2"
                              disabled={acting === b?.id || !canMoneyMove}
                              onClick={() => requestRelease(row)}
                            >
                              <DollarSign size={13} /> Release
                            </button>
                          </>
                        )}
                      </div>
                      <DisabledReason reason={disabledReason} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      <Modal open={!!settleRow} onClose={() => setSettleRow(null)} title="Apply or Settle Deposit">
        <form className="space-y-5" onSubmit={handleSettle}>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card-hover)] p-3">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {settleRow?.bookings?.booking_code} · {settleRow?.bookings?.customers?.first_name} {settleRow?.bookings?.customers?.last_name}
            </p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              Refundable balance: ${(depositRefundable(settleRow || {}) / 100).toFixed(2)}
            </p>
          </div>

          <div>
            <label className="label">Charges to apply from deposit ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={incidentalTotal}
              onChange={(e) => setIncidentalTotal(e.target.value)}
              placeholder="0.00"
            />
            <p className="text-xs mt-1.5 text-[var(--text-tertiary)]">
              Use 0.00 for a full refund after inspection. Enter damage, tolls, fuel, cleaning, or late-return charges to apply.
            </p>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
            <p className="text-xs font-semibold text-amber-600">Money movement</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              This records the settlement and may refund the remaining balance to the original payment method.
            </p>
          </div>

          <div className="flex gap-3">
            <button type="button" className="btn-secondary flex-1 justify-center" onClick={() => setSettleRow(null)}>Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={acting === settleRow?.bookings?.id}>
              {acting === settleRow?.bookings?.id && <RefreshCw size={14} className="animate-spin" />}
              Settle Deposit
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
