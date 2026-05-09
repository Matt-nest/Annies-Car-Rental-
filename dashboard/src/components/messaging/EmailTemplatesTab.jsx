import { useState, useEffect, useCallback } from 'react';
import { Plus, FileText, Trash2, Eye, Send, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../api/client';
import { EASE, TEMPLATE_STAGES } from './shared.js';

/* ── Email Templates Tab ── */
export default function EmailTemplatesTab() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', stage: 'custom', subject: '', body: '' });
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  // Phase 2B: per-stage source map (db/fallback/none) + test-send state
  const [stageStatus, setStageStatus] = useState([]);
  const [testSending, setTestSending] = useState(null); // template id being sent (or 'editor')
  const [testToast, setTestToast] = useState(null);     // { kind: 'ok' | 'err', text }

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    const [data, status] = await Promise.all([
      api.getEmailTemplates().catch(() => []),
      api.getEmailTemplateStatus().catch(() => []),
    ]);
    setTemplates(data || []);
    setStageStatus(status || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  // Phase 2B: send the current draft (or saved card) to the admin's own email.
  const handleTestSend = async (template, slot = 'card') => {
    if (!template?.subject || !template?.body) {
      setTestToast({ kind: 'err', text: 'Template needs subject + body before testing' });
      return;
    }
    setTestSending(slot);
    try {
      const result = await api.testSendEmailTemplate({
        subject: template.subject,
        body: template.body,
      });
      if (result?.ok) {
        setTestToast({ kind: 'ok', text: `Test sent to ${result.to}` });
      } else {
        setTestToast({ kind: 'err', text: 'Send failed — check console' });
      }
    } catch (err) {
      console.error('Test-send failed:', err);
      setTestToast({ kind: 'err', text: err?.message || 'Send failed' });
    }
    setTestSending(null);
    setTimeout(() => setTestToast(null), 4000);
  };

  // Stages currently rendered from the hardcoded fallback templates (no
  // active DB row). Surfaced at the top of the list as informational.
  const fallbackStages = stageStatus.filter(s => s.source === 'fallback');

  const handleSave = async () => {
    if (!form.name || !form.subject || !form.body) return;
    setSaving(true);
    try {
      if (editing?.id) {
        await api.updateEmailTemplate(editing.id, form);
      } else {
        await api.createEmailTemplate(form);
      }
      setEditing(null);
      setForm({ name: '', stage: 'custom', subject: '', body: '' });
      fetchTemplates();
    } catch (err) {
      console.error('Save failed:', err);
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this template?')) return;
    await api.deleteEmailTemplate(id).catch(() => { });
    fetchTemplates();
  };

  const handleToggle = async (template) => {
    const newActive = template.is_active === false ? true : false;

    // F-18: when activating, deactivate any other active template for the same
    // stage first. Otherwise the partial unique index (migration 015) rejects
    // the second is_active=true with 23505. Optimistic UI: flip locally,
    // rollback on server error.
    const peersToDeactivate = newActive
      ? templates.filter(t => t.id !== template.id && t.stage === template.stage && t.is_active !== false)
      : [];

    setTemplates(prev => prev.map(t => {
      if (t.id === template.id) return { ...t, is_active: newActive };
      if (peersToDeactivate.some(p => p.id === t.id)) return { ...t, is_active: false };
      return t;
    }));

    try {
      // Deactivate peers first to respect the partial unique index
      for (const peer of peersToDeactivate) {
        await api.updateEmailTemplate(peer.id, { is_active: false });
      }
      await api.updateEmailTemplate(template.id, { is_active: newActive });
    } catch (err) {
      // Roll back optimistic update + refetch from server for canonical state
      console.error('Toggle failed:', err);
      fetchTemplates();
    }
  };

  const startEdit = (template) => {
    setEditing(template);
    setForm({ name: template.name, stage: template.stage, subject: template.subject, body: template.body });
  };

  // Preview overlay — rendered in both editor and listing branches so the
  // eye-icon Preview button works on the listing page (Phase 1 audit F-9).
  const previewNode = (
    <AnimatePresence>
      {preview && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
          onClick={() => setPreview(null)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            style={{ width: '100%', maxWidth: 480, margin: '0 16px', borderRadius: 20, background: 'var(--bg-elevated, #fff)', boxShadow: '0 24px 48px rgba(0,0,0,0.15)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Email Preview</p>
              <button onClick={() => setPreview(null)} style={{ background: 'none', border: 'none', fontSize: '16px', color: 'var(--text-tertiary)', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '20px' }}>
              <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>Subject</p>
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>{preview.subject}</p>
              <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border-subtle)', fontSize: '13px', whiteSpace: 'pre-wrap', color: 'var(--text-primary)', lineHeight: '1.6', background: 'var(--bg-primary)' }}>
                {preview.body}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (editing !== null) {
    return (
      <div style={{ padding: '24px', maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {editing.id ? 'Edit Template' : 'New Template'}
          </h2>
          <button
            onClick={() => { setEditing(null); setForm({ name: '', stage: 'custom', subject: '', body: '' }); }}
            style={{
              padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)',
              background: 'transparent', color: 'var(--text-secondary)', fontSize: '12px',
              fontWeight: 500, cursor: 'pointer',
            }}
          >Cancel</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', letterSpacing: '0.03em', textTransform: 'uppercase' }}>Template Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', fontSize: '13px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }}
                placeholder="e.g., Booking Confirmation"
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', letterSpacing: '0.03em', textTransform: 'uppercase' }}>Stage</label>
              <select
                value={form.stage}
                onChange={(e) => setForm({ ...form, stage: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', fontSize: '13px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }}
              >
                {TEMPLATE_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', letterSpacing: '0.03em', textTransform: 'uppercase' }}>Subject Line</label>
            <input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', fontSize: '13px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }}
              placeholder="e.g., Your booking {{booking_code}} is confirmed!"
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', letterSpacing: '0.03em', textTransform: 'uppercase' }}>Email Body</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={10}
              style={{ width: '100%', padding: '12px', fontSize: '13px', borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none', resize: 'none', fontFamily: "'Inter', monospace", lineHeight: '1.6' }}
              placeholder={'Hi {{first_name}},\n\nThank you for your booking...'}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={() => setPreview(form)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border-subtle)',
                background: 'transparent', color: 'var(--text-secondary)', fontSize: '12px',
                fontWeight: 600, cursor: 'pointer',
              }}
            ><Eye size={12} /> Preview</button>
            <button
              onClick={() => handleTestSend(form, 'editor')}
              disabled={testSending === 'editor' || !form.subject || !form.body}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border-subtle)',
                background: 'transparent', color: 'var(--text-secondary)', fontSize: '12px',
                fontWeight: 600, cursor: 'pointer',
                opacity: testSending === 'editor' || !form.subject || !form.body ? 0.5 : 1,
              }}
              title="Send a test rendering to your own email"
            ><Send size={12} /> {testSending === 'editor' ? 'Sending...' : 'Send Test'}</button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name || !form.subject || !form.body}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '8px 16px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg, #007AFF 0%, #0066DD 100%)',
                color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                opacity: saving || !form.name || !form.subject || !form.body ? 0.5 : 1,
                boxShadow: '0 4px 14px rgba(0,122,255,0.25)',
              }}
            >{saving ? 'Saving...' : editing.id ? 'Update Template' : 'Create Template'}</button>
          </div>
        </div>

        {previewNode}
        {testToast && <TestToast toast={testToast} />}
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Email Templates</h2>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setEditing({})}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '8px 14px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg, #007AFF 0%, #0066DD 100%)',
            color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(0,122,255,0.25)',
          }}
        ><Plus size={12} /> New Template</motion.button>
      </div>

      {/* Phase 2B: stages currently rendering from the hardcoded fallback */}
      {fallbackStages.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '12px 14px', marginBottom: 16,
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: 12,
        }}>
          <AlertCircle size={14} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
              {fallbackStages.length} stage{fallbackStages.length === 1 ? '' : 's'} using built-in fallback templates
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
              Create a custom template for any of these to override the fallback:
              {' '}
              <span style={{ color: 'var(--text-secondary)' }}>
                {fallbackStages.map(s => s.stage).join(', ')}
              </span>
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--border-subtle)', borderTopColor: '#007AFF', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : templates.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '48px 0' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 12px', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-subtle)' }}>
            <FileText size={22} style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>No templates yet</p>
          <button
            onClick={() => setEditing({})}
            style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #007AFF 0%, #0066DD 100%)', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,122,255,0.25)' }}
          >Create your first template</button>
        </motion.div>
      ) : (
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {templates.map((t, i) => {
            const stage = TEMPLATE_STAGES.find(s => s.value === t.stage) || { value: t.stage, label: t.stage?.replace(/_/g, ' ') || 'Custom', color: '#6b7280' };
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, ease: EASE }}
                style={{
                  padding: 16, borderRadius: 14,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                  transition: 'box-shadow 0.3s, border-color 0.3s, opacity 0.3s',
                  opacity: t.is_active === false ? 0.5 : 1,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-medium)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'; e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.opacity = t.is_active === false ? '0.5' : '1'; }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{t.name}</p>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                        background: `${stage.color}15`, color: stage.color,
                        letterSpacing: '0.03em', textTransform: 'capitalize',
                      }}>{stage.label}</span>
                      {/* Channel badge */}
                      <span style={{
                        fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: 6,
                        background: t.channel === 'sms' ? 'rgba(34,197,94,0.1)' : t.channel === 'both' ? 'rgba(99,102,241,0.1)' : 'rgba(59,130,246,0.1)',
                        color: t.channel === 'sms' ? '#22c55e' : t.channel === 'both' ? '#6366f1' : '#3b82f6',
                      }}>
                        {t.channel === 'both' ? '📱✉️ Both' : t.channel === 'sms' ? '📱 SMS' : '✉️ Email'}
                      </span>
                      {/* Trigger badge */}
                      <span style={{
                        fontSize: '10px', fontWeight: 500, padding: '2px 6px', borderRadius: 6,
                        background: t.trigger_type === 'manual' ? 'rgba(245,158,11,0.1)' : 'rgba(20,184,166,0.1)',
                        color: t.trigger_type === 'manual' ? '#f59e0b' : '#14b8a6',
                      }}>
                        {t.trigger_type === 'manual' ? '👤 Manual' : '⚡ Auto'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {/* Toggle switch */}
                    <button
                      onClick={() => handleToggle(t)}
                      title={t.is_active === false ? 'Enable template' : 'Disable template'}
                      style={{
                        position: 'relative', width: 36, height: 20, borderRadius: 10,
                        border: 'none', cursor: 'pointer', padding: 0,
                        background: t.is_active === false
                          ? 'var(--bg-card, rgba(255,255,255,0.06))'
                          : 'linear-gradient(135deg, #007AFF, #0066DD)',
                        boxShadow: t.is_active === false
                          ? 'inset 0 1px 3px rgba(0,0,0,0.15)'
                          : '0 2px 8px rgba(0,122,255,0.3)',
                        transition: 'background 0.25s, box-shadow 0.25s',
                      }}
                    >
                      <span style={{
                        position: 'absolute', top: 2, width: 16, height: 16,
                        borderRadius: '50%', background: '#fff',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)',
                        left: t.is_active === false ? 2 : 18,
                      }} />
                    </button>
                    <button onClick={() => setPreview(t)} style={{ padding: 6, borderRadius: 8, background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }} title="Preview"><Eye size={14} /></button>
                    <button
                      onClick={() => handleTestSend(t, t.id)}
                      disabled={testSending === t.id}
                      style={{ padding: 6, borderRadius: 8, background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', opacity: testSending === t.id ? 0.5 : 1 }}
                      title="Send test to my email"
                    ><Send size={14} /></button>
                    <button onClick={() => startEdit(t)} style={{ padding: 6, borderRadius: 8, background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }} title="Edit"><FileText size={14} /></button>
                    <button onClick={() => handleDelete(t.id)} style={{ padding: 6, borderRadius: 8, background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }} title="Delete"><Trash2 size={14} /></button>
                  </div>
                </div>
                {/* Phase 2B: LIVE indicator — this template is what fires for its stage */}
                {t.is_active !== false && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', borderRadius: 6, marginBottom: 4,
                    background: 'rgba(34,197,94,0.12)', color: '#16a34a',
                    fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#16a34a', boxShadow: '0 0 4px #16a34a' }} />
                    Live
                  </div>
                )}
                {t.subject && (
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                    {t.subject}
                  </p>
                )}
                {t.description && (
                  <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.description}
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
      {previewNode}
      {testToast && <TestToast toast={testToast} />}
    </div>
  );
}

/* ── Test-send toast (Phase 2B) ─────────────────────────────────────────── */
function TestToast({ toast }) {
  const colors = toast.kind === 'ok'
    ? { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', text: '#16a34a' }
    : { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', text: '#dc2626' };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        padding: '10px 16px', borderRadius: 12,
        background: colors.bg, border: `1px solid ${colors.border}`,
        color: colors.text, fontSize: '13px', fontWeight: 600,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}
    >
      {toast.text}
    </motion.div>
  );
}
