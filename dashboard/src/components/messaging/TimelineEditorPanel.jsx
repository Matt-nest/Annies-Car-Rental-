/**
 * Slide-in editor for a single notification stage. Opened by clicking a
 * TimelineCard. Contains: active toggle, subject/body/sms_body editors,
 * editable trigger offset (cron stages only), server-rendered email preview
 * in a sandboxed iframe, client-rendered SMS preview as an iMessage bubble.
 *
 * Critical invariant: the email preview uses the same backend renderer as
 * real customer-facing sends (POST /email-templates/preview-html, which
 * imports `wrapInBrandedHTML` from notifyService). What you see is what the
 * customer gets.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Send, MessageSquare, Mail, Clock, AlertCircle, Check } from 'lucide-react';
import { api } from '../../api/client';
import { EASE } from './shared.js';

/* ─── Offset preset chips ────────────────────────────────────────────────── */
const OFFSET_PRESETS = [
  { minutes: -10080, label: '7d before' },
  { minutes: -4320,  label: '3d before' },
  { minutes: -2880,  label: '2d before' },
  { minutes: -1440,  label: '24h before' },
  { minutes: -720,   label: '12h before' },
  { minutes: -360,   label: '6h before' },
  { minutes: -60,    label: '1h before' },
  { minutes: 0,      label: 'morning of' },
  { minutes: 1440,   label: '1d after' },
  { minutes: 2880,   label: '2d after' },
  { minutes: 5760,   label: '4d after' },
  { minutes: 10080,  label: '7d after' },
  { minutes: 43200,  label: '30d after' },
];

/* ─── Human-readable offset ──────────────────────────────────────────────── */
function formatOffset(minutes, anchor) {
  if (minutes == null || !anchor) return 'No trigger configured';
  const anchorLabel = anchor === 'pickup_date' ? 'pickup' : anchor === 'return_date' ? 'return' : anchor;
  if (minutes === 0) return `Morning of ${anchorLabel}`;
  const abs = Math.abs(minutes);
  const direction = minutes < 0 ? 'before' : 'after';
  if (abs < 60) return `${abs}min ${direction} ${anchorLabel}`;
  if (abs < 1440) {
    const hours = abs / 60;
    return `${hours % 1 === 0 ? hours : hours.toFixed(1)}h ${direction} ${anchorLabel}`;
  }
  const days = abs / 1440;
  return `${days % 1 === 0 ? days : days.toFixed(1)}d ${direction} ${anchorLabel}`;
}

/* ─── Critical stages (deactivation confirmation) ────────────────────────── */
const CRITICAL_STAGES = new Set([
  'booking_approved',
  'payment_confirmed',
  'ready_for_pickup',
  'pickup_reminder',
]);

/* ─── SMS segment math (GSM-7) ──────────────────────────────────────────── */
function smsSegments(body) {
  const len = (body || '').length;
  if (len === 0) return { chars: 0, segments: 0 };
  if (len <= 160) return { chars: len, segments: 1 };
  return { chars: len, segments: Math.ceil(len / 153) };
}

/* ════════════════════════════════════════════════════════════════════════
   MAIN EDITOR PANEL
   ════════════════════════════════════════════════════════════════════════ */
export default function TimelineEditorPanel({ template, onClose, onSaved }) {
  const [draft, setDraft] = useState({
    name: template.name || '',
    subject: template.subject || '',
    body: template.body || '',
    sms_body: template.sms_body || '',
    channel: template.channel || 'email',
    is_active: template.is_active !== false,
    trigger_offset_minutes: template.trigger_offset_minutes,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(null);
  const [toast, setToast] = useState(null);

  const dirty = (
    draft.name !== template.name ||
    draft.subject !== (template.subject || '') ||
    draft.body !== (template.body || '') ||
    draft.sms_body !== (template.sms_body || '') ||
    draft.channel !== (template.channel || 'email') ||
    draft.is_active !== (template.is_active !== false) ||
    draft.trigger_offset_minutes !== template.trigger_offset_minutes
  );

  const isCron = template.trigger_kind === 'cron';
  const isCronLateWarning = template.stage === 'late_return_warning';   // ongoing — not editable
  const canEditOffset = isCron && !isCronLateWarning;

  function set(patch) { setDraft(d => ({ ...d, ...patch })); }

  async function handleSave() {
    // Confirmation guard for deactivating customer-essential stages
    if (!draft.is_active && template.is_active !== false && CRITICAL_STAGES.has(template.stage)) {
      const ok = window.confirm(
        `"${template.name}" is a customer-essential stage. Deactivating it means customers will NOT receive this message. Continue?`
      );
      if (!ok) return;
    }

    setSaving(true);
    setError('');
    try {
      const updates = {
        name: draft.name,
        subject: draft.subject,
        body: draft.body,
        sms_body: draft.sms_body,
        channel: draft.channel,
        is_active: draft.is_active,
      };
      if (canEditOffset && draft.trigger_offset_minutes !== template.trigger_offset_minutes) {
        updates.trigger_offset_minutes = draft.trigger_offset_minutes;
      }
      const updated = await api.updateEmailTemplate(template.id, updates);
      onSaved(updated);
      setToast({ kind: 'ok', text: 'Saved' });
      setTimeout(() => setToast(null), 2400);
    } catch (err) {
      setError(err?.message || 'Save failed');
    }
    setSaving(false);
  }

  async function handleTestEmail() {
    if (!draft.subject || !draft.body) {
      setToast({ kind: 'err', text: 'Subject + body required' });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    setTesting('email');
    try {
      const r = await api.testSendEmailTemplate({ subject: draft.subject, body: draft.body });
      setToast({ kind: r?.ok ? 'ok' : 'err', text: r?.ok ? `Test sent to ${r.to}` : 'Email send failed' });
    } catch (err) {
      setToast({ kind: 'err', text: err?.message || 'Failed' });
    }
    setTesting(null);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleTestSms() {
    if (!draft.sms_body) {
      setToast({ kind: 'err', text: 'SMS body required' });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    setTesting('sms');
    try {
      const r = await api.testSendSmsTemplate({ sms_body: draft.sms_body });
      setToast({ kind: r?.ok ? 'ok' : 'err', text: r?.ok ? `Test SMS sent to ${r.to}` : (r?.result?.error?.message || 'SMS send failed') });
    } catch (err) {
      setToast({ kind: 'err', text: err?.message || 'Failed' });
    }
    setTesting(null);
    setTimeout(() => setToast(null), 3000);
  }

  const showEmailPreview = draft.channel === 'email' || draft.channel === 'both';
  const showSmsPreview   = draft.channel === 'sms' || draft.channel === 'both';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 38 }}
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0,
          width: '100%', maxWidth: 640,
          background: 'var(--bg-primary, #fff)',
          borderLeft: '1px solid var(--border-subtle)',
          boxShadow: '-12px 0 32px rgba(0,0,0,0.12)',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 2,
          padding: '14px 20px', background: 'var(--bg-elevated)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              {template.name || template.stage}
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {template.stage} · {template.trigger_kind === 'cron' ? 'Cron-triggered' : 'Event-triggered'} · {formatOffset(template.trigger_offset_minutes, template.trigger_anchor)}
            </p>
          </div>
          <button onClick={onClose} style={{
            padding: 6, borderRadius: 8, background: 'none', border: 'none',
            color: 'var(--text-tertiary)', cursor: 'pointer',
          }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Active toggle */}
          <Row label="Active">
            <button
              type="button"
              onClick={() => set({ is_active: !draft.is_active })}
              style={{
                position: 'relative', width: 42, height: 24, borderRadius: 12,
                border: 'none', cursor: 'pointer', padding: 0,
                background: draft.is_active ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'var(--bg-card)',
                boxShadow: draft.is_active ? '0 2px 8px rgba(34,197,94,0.3)' : 'inset 0 1px 3px rgba(0,0,0,0.15)',
                transition: 'background 0.25s',
              }}
              aria-pressed={draft.is_active}
            >
              <span style={{
                position: 'absolute', top: 2, width: 20, height: 20,
                borderRadius: '50%', background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)',
                left: draft.is_active ? 20 : 2,
              }} />
            </button>
          </Row>

          {/* Channel */}
          <Row label="Channel">
            <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              {[
                { value: 'email', label: '✉️ Email' },
                { value: 'sms', label: '📱 SMS' },
                { value: 'both', label: '📱✉️ Both' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set({ channel: opt.value })}
                  style={{
                    padding: '6px 12px', fontSize: 11, fontWeight: 600,
                    borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: draft.channel === opt.value ? 'var(--bg-elevated)' : 'transparent',
                    color: draft.channel === opt.value ? '#007AFF' : 'var(--text-secondary)',
                    boxShadow: draft.channel === opt.value ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >{opt.label}</button>
              ))}
            </div>
          </Row>

          {/* Timing — cron only */}
          {isCron && (
            <Row label="Timing">
              {isCronLateWarning ? (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                  Fires every day a booking is overdue — ongoing trigger, not editable.
                </div>
              ) : (
                <TimingControl
                  offsetMinutes={draft.trigger_offset_minutes}
                  anchor={template.trigger_anchor}
                  onChange={v => set({ trigger_offset_minutes: v })}
                />
              )}
            </Row>
          )}

          {/* Subject + Email body */}
          {showEmailPreview && (
            <>
              <Field label="Subject line" hint="Customer sees this in their inbox">
                <input
                  type="text"
                  value={draft.subject}
                  onChange={e => set({ subject: e.target.value })}
                  className="input text-sm w-full"
                  placeholder="Your rental {{booking_code}} is confirmed"
                />
              </Field>
              <Field label="Email body" hint="Plain text + merge fields like {{first_name}}">
                <textarea
                  rows={8}
                  value={draft.body}
                  onChange={e => set({ body: e.target.value })}
                  className="input text-sm w-full"
                  style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
                  placeholder="Hi {{first_name}},&#10;&#10;Your rental..."
                />
              </Field>
            </>
          )}

          {/* SMS body */}
          {showSmsPreview && (
            <Field
              label="SMS body"
              hint={(() => {
                const { chars, segments } = smsSegments(draft.sms_body);
                if (segments === 0) return 'Empty';
                const cost = (segments * 0.0083).toFixed(4);
                return `${chars} chars · ${segments} segment${segments === 1 ? '' : 's'} · ~$${cost} per send`;
              })()}
              hintWarn={smsSegments(draft.sms_body).segments > 1}
            >
              <textarea
                rows={4}
                value={draft.sms_body}
                onChange={e => set({ sms_body: e.target.value })}
                className="input text-sm w-full"
                style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                placeholder="Hi {{first_name}}, your rental..."
              />
            </Field>
          )}

          {/* Preview */}
          <div style={{
            borderRadius: 12, border: '1px solid var(--border-subtle)',
            background: 'var(--bg-card)', overflow: 'hidden',
          }}>
            <div style={{
              padding: '10px 14px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--text-tertiary)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>Live preview · what the customer sees</span>
            </div>
            {showEmailPreview && (
              <div style={{ padding: 12, borderBottom: showSmsPreview ? '1px solid var(--border-subtle)' : 'none' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#007AFF', marginBottom: 6, letterSpacing: '0.04em' }}>EMAIL</p>
                <EmailPreview subject={draft.subject} body={draft.body} stage={template.stage} />
              </div>
            )}
            {showSmsPreview && (
              <div style={{ padding: 12 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#22c55e', marginBottom: 6, letterSpacing: '0.04em' }}>SMS</p>
                <SmsPreview body={draft.sms_body} />
              </div>
            )}
          </div>

          {error && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <AlertCircle size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: 12, color: 'var(--text-primary)' }}>{error}</p>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, paddingTop: 6, flexWrap: 'wrap' }}>
            {showEmailPreview && (
              <button
                type="button"
                onClick={handleTestEmail}
                disabled={!!testing}
                style={btnSecondary(!!testing)}
              >
                <Mail size={12} /> {testing === 'email' ? 'Sending…' : 'Test email'}
              </button>
            )}
            {showSmsPreview && (
              <button
                type="button"
                onClick={handleTestSms}
                disabled={!!testing}
                style={btnSecondary(!!testing)}
              >
                <MessageSquare size={12} /> {testing === 'sms' ? 'Sending…' : 'Test SMS'}
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving}
              style={btnPrimary(!dirty || saving)}
            >
              <Save size={12} /> {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              style={{
                position: 'fixed', bottom: 24, right: 24, zIndex: 10000,
                padding: '10px 16px', borderRadius: 12,
                background: toast.kind === 'ok' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                border: `1px solid ${toast.kind === 'ok' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                color: toast.kind === 'ok' ? '#16a34a' : '#dc2626',
                fontSize: 13, fontWeight: 600,
                boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {toast.kind === 'ok' && <Check size={14} />}
              {toast.text}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Subcomponents
   ════════════════════════════════════════════════════════════════════════ */

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      {children}
    </div>
  );
}

function Field({ label, hint, hintWarn, children }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
        {label}
      </label>
      {children}
      {hint && (
        <p style={{ fontSize: 11, color: hintWarn ? '#f59e0b' : 'var(--text-tertiary)', marginTop: 4 }}>{hint}</p>
      )}
    </div>
  );
}

function TimingControl({ offsetMinutes, anchor, onChange }) {
  const [direct, setDirect] = useState(String(offsetMinutes ?? 0));

  useEffect(() => { setDirect(String(offsetMinutes ?? 0)); }, [offsetMinutes]);

  function commitDirect() {
    const n = parseInt(direct, 10);
    if (Number.isFinite(n) && n >= -10080 && n <= 43200) {
      onChange(n);
    } else {
      setDirect(String(offsetMinutes ?? 0));   // revert on invalid
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="number"
          value={direct}
          onChange={e => setDirect(e.target.value)}
          onBlur={commitDirect}
          onKeyDown={e => e.key === 'Enter' && commitDirect()}
          style={{
            width: 100, padding: '6px 10px', fontSize: 12,
            borderRadius: 8, border: '1px solid var(--border-subtle)',
            background: 'var(--bg-primary)', color: 'var(--text-primary)',
            outline: 'none', fontVariantNumeric: 'tabular-nums', textAlign: 'right',
          }}
        />
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>min from {anchor === 'pickup_date' ? 'pickup' : 'return'}</span>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
        <Clock size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
        {formatOffset(offsetMinutes, anchor)}
      </p>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {OFFSET_PRESETS.map(preset => (
          <button
            key={preset.minutes}
            type="button"
            onClick={() => onChange(preset.minutes)}
            style={{
              padding: '4px 10px', fontSize: 10, fontWeight: 600,
              borderRadius: 999, cursor: 'pointer',
              border: '1px solid var(--border-subtle)',
              background: offsetMinutes === preset.minutes ? 'rgba(70,95,255,0.12)' : 'transparent',
              color: offsetMinutes === preset.minutes ? '#465FFF' : 'var(--text-secondary)',
              transition: 'all 0.15s',
            }}
          >{preset.label}</button>
        ))}
      </div>
    </div>
  );
}

/* ─── Email preview — server-rendered HTML in sandboxed iframe ──────────── */
function EmailPreview({ subject, body, stage }) {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const iframeRef = useRef(null);

  // Debounced re-render on edits
  const fetchPreview = useCallback(async () => {
    if (!subject || !body) {
      setHtml('<p style="padding:20px;color:#999;font-family:sans-serif;font-size:13px;">Fill in subject and body to preview</p>');
      setErr('');
      return;
    }
    setLoading(true);
    setErr('');
    try {
      const h = await api.previewEmailTemplate({ subject, body, stage });
      setHtml(h);
    } catch (e) {
      setErr(e?.message || 'Preview failed');
    }
    setLoading(false);
  }, [subject, body, stage]);

  useEffect(() => {
    const t = setTimeout(fetchPreview, 400);
    return () => clearTimeout(t);
  }, [fetchPreview]);

  return (
    <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', background: '#fff', border: '1px solid var(--border-subtle)' }}>
      {loading && (
        <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, color: 'var(--text-tertiary)' }}>updating…</div>
      )}
      {err && (
        <p style={{ padding: 12, fontSize: 12, color: '#dc2626' }}>{err}</p>
      )}
      <iframe
        ref={iframeRef}
        title="Email preview"
        srcDoc={html}
        sandbox="allow-same-origin"
        style={{
          width: '100%', height: 360, border: 'none', display: 'block',
          background: '#fff',
        }}
      />
    </div>
  );
}

/* ─── SMS preview — iMessage-style bubble (client-side, no roundtrip) ────── */
function SmsPreview({ body }) {
  // Interpolate the same mock data the backend preview uses so SMS matches email's source-of-truth.
  const mock = {
    first_name: 'Sarah', last_name: 'Preview', vehicle: '2024 Nissan Altima',
    booking_code: 'BK-PREVIEW', pickup_date: 'Fri, May 15', pickup_time: '10:00 AM',
    return_date: 'Wed, May 20', return_time: '10:00 AM', total_cost: '500.00',
    lockbox_code: '2580', portal_link: 'anniescarrental.com/portal',
    status_link: 'anniescarrental.com/booking-status', rental_days: '5',
  };
  const rendered = (body || '').replace(/\{\{(\w+)\}\}/g, (m, k) => mock[k] != null ? mock[k] : m);

  return (
    <div style={{
      padding: 14, borderRadius: 12, background: 'var(--bg-primary, #f5f5f7)',
      border: '1px solid var(--border-subtle)',
    }}>
      <p style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center', marginBottom: 8, fontWeight: 500 }}>
        Annie's Car Rental · iMessage preview
      </p>
      {rendered ? (
        <div style={{
          maxWidth: '85%', padding: '10px 14px', borderRadius: 18,
          background: '#e9e9eb', color: '#000',
          fontSize: 13, lineHeight: 1.45, whiteSpace: 'pre-wrap',
          borderBottomLeftRadius: 4,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}>
          {rendered}
        </div>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
          Type an SMS body to preview
        </p>
      )}
    </div>
  );
}

/* ─── Button styles ──────────────────────────────────────────────────────── */
function btnPrimary(disabled) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '8px 14px', borderRadius: 10, border: 'none',
    background: 'linear-gradient(135deg, #465FFF 0%, #3b4cdb 100%)',
    color: '#fff', fontSize: 12, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    boxShadow: disabled ? 'none' : '0 4px 14px rgba(70,95,255,0.25)',
  };
}
function btnSecondary(disabled) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '8px 12px', borderRadius: 10,
    border: '1px solid var(--border-subtle)', background: 'transparent',
    color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
}
