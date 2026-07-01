/**
 * Notification Timeline — horizontal lifecycle view of every notification
 * stage from request to post-trip. Each stage is a card grouped under its
 * lifecycle_position column (0-7). Drag within a column reorders
 * (persists to email_templates.visual_order). Click a card opens
 * TimelineEditorPanel.
 *
 * Migration 020 backfills timing config from current cron.js hardcoded
 * values; cron.js (commit 2) reads from DB only when FEATURE_TIMELINE_TIMING
 * env flag is true, falling back to hardcoded defaults otherwise. So edits
 * persisted here are display-only until the flag flips.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, RefreshCw, AlertCircle, Zap, Clock, Power } from 'lucide-react';
import { api } from '../../api/client';
import TimelineEditorPanel from './TimelineEditorPanel';
import { EASE } from './shared.js';

const LIFECYCLE_COLUMNS = [
  { position: 0, label: 'Request',   subtitle: 'Submitted',           color: '#64748b' },
  { position: 1, label: 'Approval',  subtitle: 'Admin + insurance',   color: '#10b981' },
  { position: 2, label: 'Payment',   subtitle: 'Stripe confirmation', color: '#3b82f6' },
  { position: 3, label: 'Ready',     subtitle: 'Vehicle prepped',     color: '#8b5cf6' },
  { position: 4, label: 'Pickup',    subtitle: 'Customer collects',   color: '#f59e0b' },
  { position: 5, label: 'During',    subtitle: 'Active rental',       color: '#a78bfa' },
  { position: 6, label: 'Return',    subtitle: 'Vehicle returned',    color: '#ec4899' },
  { position: 7, label: 'Post-trip', subtitle: 'Review + loyalty',    color: '#06b6d4' },
];

function formatOffsetShort(minutes, anchor) {
  if (minutes == null || !anchor) return null;
  const anchorShort = anchor === 'pickup_date' ? 'pickup' : 'return';
  if (minutes === 0) return `morning of ${anchorShort}`;
  const abs = Math.abs(minutes);
  const dir = minutes < 0 ? '-' : '+';
  if (abs < 60) return `${dir}${abs}m ${anchorShort}`;
  if (abs < 1440) return `${dir}${abs / 60}h ${anchorShort}`;
  const days = abs / 1440;
  return `${dir}${days % 1 === 0 ? days : days.toFixed(1)}d ${anchorShort}`;
}

export default function TimelineView() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  // null = unknown (don't warn); false = flag off (edits won't drive sends yet).
  const [timingLive, setTimingLive] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getEmailTemplates();
      setTemplates(data || []);
    } catch (err) {
      setError(err?.message || 'Failed to load templates');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Best-effort: find out whether cron actually reads DB timing yet. If we
  // can't tell, stay silent (timingLive === null) rather than warn incorrectly.
  useEffect(() => {
    let cancelled = false;
    api.getSystemHealth()
      .then(h => { if (!cancelled) setTimingLive(!!h?.checks?.integrations?.timeline_timing); })
      .catch(() => { /* unknown — no banner */ });
    return () => { cancelled = true; };
  }, []);

  // Group templates by lifecycle_position; sort each column by visual_order
  // (fallback to stage alpha so the order is deterministic when visual_order
  // is unset). Templates without a position (custom user-created) are NOT
  // shown on the timeline — they're still editable via the legacy Templates
  // tab until that's removed in the cleanup commit.
  const byColumn = {};
  for (const c of LIFECYCLE_COLUMNS) byColumn[c.position] = [];
  for (const t of templates) {
    if (t.lifecycle_position == null) continue;
    if (byColumn[t.lifecycle_position]) byColumn[t.lifecycle_position].push(t);
  }
  for (const pos of Object.keys(byColumn)) {
    byColumn[pos].sort((a, b) => {
      const ao = a.visual_order ?? 0, bo = b.visual_order ?? 0;
      if (ao !== bo) return ao - bo;
      return (a.stage || '').localeCompare(b.stage || '');
    });
  }

  function handleSaved(updated) {
    setTemplates(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
    setSelected(s => s && s.id === updated.id ? { ...s, ...updated } : s);
  }

  return (
    <div style={{ padding: '20px 16px 32px' }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: 4 }}>
            Notification Timeline
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5, maxWidth: 720 }}>
            Every customer-facing message, laid out by where it fires in the rental lifecycle.
            Click a card to edit copy, channel, and timing — with live email + SMS preview matching the real send.
            Drag within a column to reorder.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', fontSize: 11, fontWeight: 600,
            borderRadius: 8, border: '1px solid var(--border-subtle)',
            background: 'transparent', color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {error && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', marginBottom: 14,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12,
        }}>
          <AlertCircle size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 12, color: 'var(--text-primary)' }}>{error}</p>
        </div>
      )}

      {timingLive === false && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', marginBottom: 14,
          background: 'rgba(245,158,11,0.09)', border: '1px solid rgba(245,158,11,0.28)', borderRadius: 12,
        }}>
          <Clock size={14} style={{ color: '#b45309', flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>
            <strong>Timing edits are saved but not live yet.</strong> Copy, channel, and active-state changes take effect immediately, but the <em>send timing</em> you set here won't change when reminders actually fire until scheduled-timing is enabled on the server (<code>FEATURE_TIMELINE_TIMING</code>).
          </p>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <RefreshCw size={20} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${LIFECYCLE_COLUMNS.length}, minmax(180px, 1fr))`,
          gap: 12,
          overflowX: 'auto',
          paddingBottom: 8,
        }}>
          {LIFECYCLE_COLUMNS.map(col => (
            <LifecycleColumn
              key={col.position}
              column={col}
              templates={byColumn[col.position] || []}
              onSelect={setSelected}
              onReorder={(newOrder) => {
                // Optimistic update: rewrite visual_order in local state,
                // then persist each changed row. Failure on any single PUT
                // logs but doesn't roll back the visible reorder (worst
                // case: user refreshes and sees old order).
                setTemplates(prev => {
                  const map = new Map(prev.map(t => [t.id, t]));
                  newOrder.forEach((id, idx) => {
                    const t = map.get(id);
                    if (t) map.set(id, { ...t, visual_order: idx });
                  });
                  return Array.from(map.values());
                });
                newOrder.forEach((id, idx) => {
                  api.updateEmailTemplate(id, { visual_order: idx }).catch(err => {
                    console.error(`[Timeline] persist visual_order failed for ${id}:`, err.message);
                  });
                });
              }}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {selected && (
          <TimelineEditorPanel
            template={selected}
            onClose={() => setSelected(null)}
            onSaved={handleSaved}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Lifecycle column — header + sortable card list
   ════════════════════════════════════════════════════════════════════════ */
function LifecycleColumn({ column, templates, onSelect, onReorder }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = templates.map(t => t.id);
    const oldIndex = ids.indexOf(active.id);
    const newIndex = ids.indexOf(over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(ids, oldIndex, newIndex));
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      borderRadius: 12, padding: 10,
      background: 'var(--bg-card, rgba(0,0,0,0.02))',
      border: '1px solid var(--border-subtle)',
      minHeight: 200,
    }}>
      {/* Column header */}
      <div style={{ paddingBottom: 8, borderBottom: `2px solid ${column.color}40` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: column.color }} />
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {column.label}
          </p>
        </div>
        <p style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{column.subtitle}</p>
      </div>

      {/* Sortable cards */}
      {templates.length === 0 ? (
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic', padding: '12px 4px' }}>
          No stages
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={templates.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {templates.map(t => (
                <SortableCard
                  key={t.id}
                  template={t}
                  color={column.color}
                  onClick={() => onSelect(t)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Sortable card
   ════════════════════════════════════════════════════════════════════════ */
function SortableCard({ template, color, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: template.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto',
  };

  const active = template.is_active !== false;
  const channel = template.channel || 'email';
  const offsetShort = formatOffsetShort(template.trigger_offset_minutes, template.trigger_anchor);

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 10,
        padding: '8px 10px',
        cursor: isDragging ? 'grabbing' : 'pointer',
        opacity: style.opacity * (active ? 1 : 0.55),
        transition: 'opacity 0.2s, border-color 0.2s, box-shadow 0.2s',
      }}
      onClick={(e) => {
        // Avoid opening editor when the drag handle is what triggered the event
        if (e.target.closest('[data-drag-handle]')) return;
        onClick();
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0 4px 12px ${color}22`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Top row: stage name + drag handle + active dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <span
          {...attributes}
          {...listeners}
          data-drag-handle
          style={{
            cursor: 'grab', padding: 2, marginLeft: -4,
            color: 'var(--text-tertiary)', touchAction: 'none',
            opacity: 0.4, transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = 1; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = 0.4; }}
          aria-label="Drag to reorder"
        >
          <GripVertical size={11} />
        </span>
        <p style={{
          flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600,
          color: 'var(--text-primary)', letterSpacing: '-0.01em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {template.name || template.stage}
        </p>
        {active ? (
          <span title="Active" style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 4px #22c55e' }} />
        ) : (
          <Power size={10} style={{ color: 'var(--text-tertiary)' }} aria-label="Inactive" />
        )}
      </div>

      {/* Trigger description */}
      {template.trigger_kind === 'cron' && offsetShort ? (
        <p style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 3, marginBottom: 4 }}>
          <Clock size={9} /> {offsetShort}
        </p>
      ) : template.trigger_kind === 'event' ? (
        <p style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 3, marginBottom: 4 }}>
          <Zap size={9} /> on event
        </p>
      ) : null}

      {/* Channel pill */}
      <span style={{
        display: 'inline-block', fontSize: 9, fontWeight: 600,
        padding: '1px 6px', borderRadius: 4,
        background: channel === 'sms' ? 'rgba(34,197,94,0.12)' : channel === 'both' ? 'rgba(99,102,241,0.12)' : 'rgba(59,130,246,0.12)',
        color: channel === 'sms' ? '#22c55e' : channel === 'both' ? '#6366f1' : '#3b82f6',
        letterSpacing: '0.04em',
      }}>
        {channel === 'both' ? '📱✉️' : channel === 'sms' ? '📱 SMS' : '✉️ EMAIL'}
      </span>
    </div>
  );
}
