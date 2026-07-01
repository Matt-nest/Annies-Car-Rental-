import React from 'react';
import { motion } from 'motion/react';
import { CalendarClock, Check, Clock, AlertCircle } from 'lucide-react';
import { EASE } from '../../utils/motion';

const money = (cents: number) => `$${(Number(cents || 0) / 100).toFixed(2)}`;
const fmtDate = (d: string) => {
  try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
};

interface Installment {
  id: string; sequence: number; due_date: string; amount_cents: number; status: string; paid_at?: string;
}
interface PlanData {
  plan: { interval: string; status: string };
  installments: Installment[];
  summary: { totalCents: number; paidCents: number; remainingCents: number; paidCount: number; count: number; nextDueDate: string | null; nextAmountCents: number | null };
}

export default function PaymentPlanCard({ data }: { data: PlanData }) {
  const { plan, installments, summary } = data;

  const iconFor = (s: string) =>
    s === 'paid' ? <Check size={13} style={{ color: '#22c55e' }} />
    : s === 'failed' ? <AlertCircle size={13} style={{ color: '#ef4444' }} />
    : <Clock size={13} style={{ color: 'var(--text-tertiary)' }} />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ease: EASE.standard }}
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px' }}
    >
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--accent-glow)' }}>
            <CalendarClock size={18} style={{ color: 'var(--accent-color)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Payment plan</h3>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {money(summary.paidCents)} of {money(summary.totalCents)} paid
              {plan.status === 'active' && summary.nextDueDate
                ? ` · next ${money(summary.nextAmountCents || 0)} on ${fmtDate(summary.nextDueDate)}`
                : ` · ${plan.status}`}
            </p>
          </div>
        </div>

        {plan.status === 'active' && (
          <p className="text-xs px-3 py-2 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}>
            Installments are charged automatically to your card on file on each due date.
          </p>
        )}

        <div className="space-y-1.5">
          {installments.map(inst => (
            <div key={inst.id} className="flex items-center justify-between text-sm py-1" style={{ color: 'var(--text-secondary)' }}>
              <span className="flex items-center gap-2">
                {iconFor(inst.status)}
                <span>#{inst.sequence} · {fmtDate(inst.due_date)}</span>
              </span>
              <span className="tabular-nums" style={{ color: inst.status === 'paid' ? '#22c55e' : 'var(--text-primary)' }}>
                {money(inst.amount_cents)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
