import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, RefreshCw, DollarSign, CreditCard, Landmark, CheckCircle, XCircle, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import { SkeletonKpi, SkeletonTable } from '../components/shared/Skeleton';
import EmptyState from '../components/shared/EmptyState';

const EASE = [0.25, 1, 0.5, 1];

function StatusBadge({ status }) {
  const config = {
    succeeded: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', label: 'Succeeded' },
    pending: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', label: 'Pending' },
    failed: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', label: 'Failed' },
    refunded: { bg: 'rgba(129,140,248,0.12)', color: '#818cf8', label: 'Refunded' },
  };
  const c = config[status] || config.pending;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: c.bg, color: c.color }}>
      {c.label}
    </span>
  );
}

function formatDate(timestamp) {
  if (!timestamp) return '—';
  return new Date(timestamp * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function StripePage() {
  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [acct, bal, txns] = await Promise.all([
        api.getStripeAccount().catch(() => null),
        api.getStripeBalance().catch(() => null),
        api.getStripeTransactions({ limit: 25 }).catch(() => ({ transactions: [], refunds: [] })),
      ]);
      setAccount(acct);
      setBalance(bal);
      setTransactions(txns.transactions || []);
      setRefunds(txns.refunds || []);
    } catch (err) {
      console.error('Failed to fetch Stripe data:', err);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const isLive = account?.livemode;
  const isConnected = account && !account?.error?.includes?.('Invalid');

  const availableBalance = balance?.available?.reduce((s, b) => s + b.amount, 0) || 0;
  const pendingBalance = balance?.pending?.reduce((s, b) => s + b.amount, 0) || 0;

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        <div className="skeleton skeleton-text" style={{ width: 120, height: 28 }} />
        <SkeletonKpi count={3} />
        <SkeletonTable rows={8} cols={6} />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Stripe</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Payment processing management</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchAll(true)}
            className="btn-ghost"
            disabled={refreshing}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <a
            href="https://dashboard.stripe.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            <ExternalLink size={14} /> Stripe Dashboard
          </a>
        </div>
      </motion.div>

      {/* Connection & Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Connection Status */}
        <div className="liquid-glass p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                {isConnected ? (
                  <CheckCircle size={16} className="text-green-500" />
                ) : (
                  <XCircle size={16} className="text-red-500" />
                )}
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {isConnected ? 'Connected' : 'Not Connected'}
                </span>
              </div>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isLive
                  ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
              }`}>
                <ShieldCheck size={10} />
                {isLive ? 'Live Mode' : 'Test Mode'}
              </span>
              {account?.id && account.id !== 'self' && (
                <p className="text-[11px] font-mono mt-2" style={{ color: 'var(--text-tertiary)' }}>{account.id}</p>
              )}
            </div>
            <div className="p-2.5 rounded-xl" style={{ backgroundColor: 'rgba(99,179,237,0.1)', color: '#63b3ed' }}>
              <Landmark size={18} />
            </div>
          </div>
        </div>

        {/* Available Balance */}
        <div className="liquid-glass p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-2xl font-bold tabular-nums" style={{ color: '#22c55e' }}>
                ${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm mt-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Available Balance</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Ready for payout</p>
            </div>
            <div className="p-2.5 rounded-xl" style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
              <DollarSign size={18} />
            </div>
          </div>
        </div>

        {/* Pending Balance */}
        <div className="liquid-glass p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-2xl font-bold tabular-nums" style={{ color: '#f59e0b' }}>
                ${pendingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm mt-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>Pending Balance</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Processing</p>
            </div>
            <div className="p-2.5 rounded-xl" style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
              <CreditCard size={18} />
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Transactions</h2>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{transactions.length} charges</span>
        </div>
        <div className="overflow-x-auto glass-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {['Date', 'Amount', 'Status', 'Booking', 'Customer', 'Card', 'Receipt'].map(h => (
                  <th key={h} className="text-left px-5 py-4 font-bold uppercase" style={{ color: 'var(--text-tertiary)', fontSize: '10px', letterSpacing: '0.08em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr><td colSpan="7"><EmptyState icon={CreditCard} title="No transactions yet" description="Charges will appear here once payments are processed." /></td></tr>
              ) : (
                transactions.map((t) => (
                  <tr
                    key={t.id}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td className="px-5 py-4">
                      <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{formatDate(t.created)}</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{formatTime(t.created)}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-bold tabular-nums" style={{ color: t.refunded ? '#818cf8' : '#22c55e' }}>
                        ${t.amount.toFixed(2)}
                      </p>
                      {t.amount_refunded > 0 && (
                        <p className="text-[10px] tabular-nums" style={{ color: '#818cf8' }}>
                          -${t.amount_refunded.toFixed(2)} refunded
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={t.refunded ? 'refunded' : t.status} />
                    </td>
                    <td className="px-5 py-4">
                      {t.booking_code ? (
                        <a href={`/bookings/${t.booking_id}`} className="text-xs font-mono font-semibold hover:underline" style={{ color: '#FFFFFF' }}>
                          {t.booking_code}
                        </a>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {t.customer_email || '—'}
                    </td>
                    <td className="px-5 py-4">
                      {t.card_last4 ? (
                        <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                          {t.card_brand && <span className="capitalize">{t.card_brand} </span>}
                          •••• {t.card_last4}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t.payment_method}</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {t.receipt_url ? (
                        <a href={t.receipt_url} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:text-brand-600 transition-colors">
                          <ArrowUpRight size={14} />
                        </a>
                      ) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Refunds */}
      {refunds.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Refunds</h2>
          </div>
          <div className="overflow-x-auto glass-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Date', 'Amount', 'Status', 'Reason'].map(h => (
                    <th key={h} className="text-left px-5 py-4 font-bold uppercase" style={{ color: 'var(--text-tertiary)', fontSize: '10px', letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {refunds.map((r) => (
                  <tr
                    key={r.id}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td className="px-5 py-4 text-xs" style={{ color: 'var(--text-primary)' }}>{formatDate(r.created)}</td>
                    <td className="px-5 py-4 font-bold tabular-nums" style={{ color: '#818cf8' }}>-${r.amount.toFixed(2)}</td>
                    <td className="px-5 py-4"><StatusBadge status={r.status} /></td>
                    <td className="px-5 py-4 text-xs capitalize" style={{ color: 'var(--text-secondary)' }}>{r.reason?.replace(/_/g, ' ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* API Key Status */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>API Configuration</h2>
        <div className="space-y-2">
          {[
            { label: 'Secret Key', envKey: 'STRIPE_SECRET_KEY', set: !!account },
            { label: 'Webhook Secret', envKey: 'STRIPE_WEBHOOK_SECRET', note: 'Required for production webhook verification' },
            { label: 'Publishable Key', envKey: 'VITE_STRIPE_PUBLISHABLE_KEY', note: 'Used in customer checkout' },
          ].map(({ label, envKey, note, set }) => (
            <div key={envKey} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
                <p className="text-[11px] font-mono" style={{ color: 'var(--text-tertiary)' }}>{envKey}</p>
                {note && <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{note}</p>}
              </div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                set !== false ? 'bg-green-100 text-green-600 dark:bg-green-500/10 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400'
              }`}>
                {set !== false ? 'Configured' : 'Check Vercel'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
