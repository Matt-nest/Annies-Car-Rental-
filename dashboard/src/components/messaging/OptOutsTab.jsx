/**
 * Opt-Outs Tab — Phase 1 admin view of customers who replied STOP to SMS.
 *
 * Read: any authenticated admin (GET /customers/sms-opt-outs).
 * Re-opt-in: owner/admin only (POST /customers/:id/sms-opt-in), gated behind
 * a confirmation modal that requires an explicit consent note for TCPA defense.
 *
 * Source of truth: customers.sms_opt_out flag (migration 013). The audit trail
 * is sms_opt_out_log (migration 018) — written by the keyword handler and by
 * this tab's re-opt-in action.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldOff, RefreshCw, AlertCircle, Phone, Mail, Check, X } from 'lucide-react';
import { api } from '../../api/client';
import { EASE, timeAgo } from './shared.js';

export default function OptOutsTab() {
  const [optOuts, setOptOuts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(null);   // customer object pending re-opt-in
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getSmsOptOuts();
      setOptOuts(data || []);
    } catch (err) {
      setError(err?.message || 'Failed to load opt-outs');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleConfirmOptIn(customerId, note) {
    try {
      await api.smsOptInCustomer(customerId, note);
      setConfirming(null);
      setToast({ kind: 'ok', text: 'Customer re-opted in. Future automated SMS will go through.' });
      load();
    } catch (err) {
      setToast({ kind: 'err', text: err?.message || 'Re-opt-in failed' });
    }
    setTimeout(() => setToast(null), 4500);
  }

  return (
    <div style={{ padding: '24px', maxWidth: 880, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <ShieldOff size={16} style={{ color: '#ef4444' }} />
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            SMS Opt-Outs
          </h2>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          Customers who replied STOP, UNSUB, CANCEL, END, or QUIT to your texts.
          Their automated SMS sends are blocked at the app layer (and at the Twilio carrier layer).
          Re-opt-in requires explicit customer consent — TCPA violations can be $500–$1,500 per message.
        </p>
      </div>

      {error && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', marginBottom: 16,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12,
        }}>
          <AlertCircle size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 12, color: 'var(--text-primary)' }}>{error}</p>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <RefreshCw size={20} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />
        </div>
      ) : optOuts.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '48px 0' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: '0 auto 12px',
            background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--border-subtle)',
          }}>
            <Check size={22} style={{ color: '#22c55e' }} />
          </div>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            No SMS opt-outs
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Every customer is currently eligible for automated SMS.
          </p>
        </motion.div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {optOuts.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, ease: EASE }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 12, padding: '14px 16px', borderRadius: 12,
                background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  {c.first_name} {c.last_name}
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {c.phone && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Phone size={11} /> {c.phone}
                    </span>
                  )}
                  {c.email && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Mail size={11} /> {c.email}
                    </span>
                  )}
                  {c.sms_opt_out_at && (
                    <span>Opted out {timeAgo(c.sms_opt_out_at)} ago</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setConfirming(c)}
                style={{
                  flexShrink: 0, padding: '8px 14px', borderRadius: 10,
                  border: '1px solid var(--border-subtle)', background: 'transparent',
                  color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#13294B'; e.currentTarget.style.color = '#13294B'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                Re-opt-in
              </button>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {confirming && (
          <OptInConfirmModal
            customer={confirming}
            onCancel={() => setConfirming(null)}
            onConfirm={(note) => handleConfirmOptIn(confirming.id, note)}
          />
        )}
      </AnimatePresence>

      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
            padding: '10px 16px', borderRadius: 12,
            background: toast.kind === 'ok' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
            border: `1px solid ${toast.kind === 'ok' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: toast.kind === 'ok' ? '#16a34a' : '#dc2626',
            fontSize: 13, fontWeight: 600,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            maxWidth: 360,
          }}
        >
          {toast.text}
        </motion.div>
      )}
    </div>
  );
}

/* ─── Re-opt-in confirmation modal ─────────────────────────────────────── */
function OptInConfirmModal({ customer, onCancel, onConfirm }) {
  const [note, setNote] = useState('');
  const [consentAck, setConsentAck] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = consentAck && note.trim().length > 0 && !submitting;

  async function handleSubmit() {
    setSubmitting(true);
    await onConfirm(note.trim());
    setSubmitting(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
      }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 16 }}
        style={{
          width: '100%', maxWidth: 480, margin: '0 16px',
          borderRadius: 16, background: 'var(--bg-elevated, #fff)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
          border: '1px solid var(--border-subtle)', overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} style={{ color: '#f59e0b' }} />
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              Re-opt-in {customer.first_name} {customer.last_name}?
            </p>
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{
            padding: '12px 14px', marginBottom: 16,
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 10, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
          }}>
            <strong style={{ color: 'var(--text-primary)' }}>TCPA notice:</strong> Re-opting in a customer
            without their explicit, recent consent is a federal violation. Each unauthorized message
            can carry a $500–$1,500 penalty.
          </div>

          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
            How did the customer give consent?
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder="e.g. Customer called 2026-05-12, asked to receive booking reminders again"
            style={{
              width: '100%', padding: 12, fontSize: 13, borderRadius: 10,
              border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)',
              color: 'var(--text-primary)', outline: 'none', resize: 'none',
              fontFamily: 'inherit', lineHeight: 1.5, marginBottom: 14,
            }}
          />

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', lineHeight: 1.5 }}>
            <input
              type="checkbox"
              checked={consentAck}
              onChange={e => setConsentAck(e.target.checked)}
              style={{ marginTop: 2, cursor: 'pointer' }}
            />
            <span>I confirm this customer has given <strong style={{ color: 'var(--text-primary)' }}>explicit, recent consent</strong> to receive automated SMS messages from Annie's Car Rental.</span>
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <button
              onClick={onCancel}
              style={{
                padding: '8px 14px', borderRadius: 10,
                border: '1px solid var(--border-subtle)', background: 'transparent',
                color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                padding: '8px 16px', borderRadius: 10, border: 'none',
                background: canSubmit ? 'linear-gradient(135deg, #13294B 0%, #1E3A5F 100%)' : 'var(--bg-card)',
                color: canSubmit ? '#fff' : 'var(--text-tertiary)',
                fontSize: 12, fontWeight: 600,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                opacity: canSubmit ? 1 : 0.6,
                boxShadow: canSubmit ? '0 4px 14px rgba(19,41,75,0.25)' : 'none',
              }}
            >
              {submitting ? 'Re-opting in…' : 'Confirm re-opt-in'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
