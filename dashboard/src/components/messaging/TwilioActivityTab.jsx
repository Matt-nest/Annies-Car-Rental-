import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Inbox,
  MessageSquare,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  RefreshCw,
  Search,
} from 'lucide-react';
import { api } from '../../api/client';
import { timeAgo } from './shared.js';

const ACTIVITY_TYPES = [
  { key: 'calls', label: 'Calls', Icon: PhoneCall },
  { key: 'messages', label: 'Text Messages', Icon: MessageSquare },
];

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'inbound', label: 'Inbound' },
  { key: 'outbound', label: 'Outbound' },
  { key: 'followup', label: 'Needs follow-up' },
];

function titleCase(value) {
  return String(value || 'unknown')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function formatDateTime(value) {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatDuration(seconds) {
  const total = Number(seconds || 0);
  if (total <= 0) return '0s';
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function isMissedCall(call) {
  return ['busy', 'failed', 'no-answer', 'canceled'].includes(String(call.status || '').toLowerCase());
}

function isFailedMessage(message) {
  return ['failed', 'undelivered'].includes(String(message.status || '').toLowerCase());
}

function toneFor(status, type) {
  const normalized = String(status || '').toLowerCase();
  if (type === 'calls' && isMissedCall({ status: normalized })) {
    return { color: '#dc2626', background: 'rgba(220,38,38,0.10)', border: 'rgba(220,38,38,0.24)' };
  }
  if (type === 'messages' && isFailedMessage({ status: normalized })) {
    return { color: '#dc2626', background: 'rgba(220,38,38,0.10)', border: 'rgba(220,38,38,0.24)' };
  }
  if (['completed', 'delivered', 'sent', 'received'].includes(normalized)) {
    return { color: '#059669', background: 'rgba(5,150,105,0.10)', border: 'rgba(5,150,105,0.24)' };
  }
  return { color: '#2563eb', background: 'rgba(37,99,235,0.10)', border: 'rgba(37,99,235,0.24)' };
}

function searchable(record) {
  return [
    record.customerName,
    record.customerPhone,
    record.from,
    record.to,
    record.body,
    record.summary,
    record.status,
    record.direction,
  ].filter(Boolean).join(' ').toLowerCase();
}

export default function TwilioActivityTab() {
  const [activityType, setActivityType] = useState('calls');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [activity, setActivity] = useState({ calls: [], messages: [], configured: true, source: 'twilio' });
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setWarning('');
    try {
      const data = await api.getTwilioActivity({ limit: 40 });
      setActivity({
        calls: Array.isArray(data?.calls) ? data.calls : [],
        messages: Array.isArray(data?.messages) ? data.messages : [],
        configured: data?.configured !== false,
        source: data?.source || 'twilio',
        generatedAt: data?.generatedAt || null,
      });
      if (data?.warning) setWarning(data.warning);
    } catch (err) {
      setActivity({ calls: [], messages: [], configured: false, source: 'unavailable' });
      setError(err?.message || 'Failed to load Twilio activity');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => ({
    calls: activity.calls.length,
    missed: activity.calls.filter(isMissedCall).length,
    texts: activity.messages.length,
    failedTexts: activity.messages.filter(isFailedMessage).length,
  }), [activity.calls, activity.messages]);

  const records = useMemo(() => {
    const list = activityType === 'calls' ? activity.calls : activity.messages;
    const q = query.trim().toLowerCase();
    return list.filter(record => {
      if (filter === 'inbound' && record.direction !== 'inbound') return false;
      if (filter === 'outbound' && record.direction !== 'outbound') return false;
      if (filter === 'followup') {
        const needsFollowup = activityType === 'calls' ? isMissedCall(record) : isFailedMessage(record);
        if (!needsFollowup) return false;
      }
      return !q || searchable(record).includes(q);
    });
  }, [activity.calls, activity.messages, activityType, filter, query]);

  return (
    <div style={{ padding: '20px 16px 32px', maxWidth: 1120, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 6, color: 'var(--accent-color)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <PhoneCall size={13} /> Twilio Activity
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 750, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: 4 }}>
            Call Log & Text Messages
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5, maxWidth: 650 }}>
            Recent calls and SMS events from Twilio, matched to customers when phone numbers line up.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '8px 12px' }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {(warning || error) && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', marginBottom: 14,
          background: error ? 'rgba(220,38,38,0.08)' : 'rgba(245,158,11,0.10)',
          border: `1px solid ${error ? 'rgba(220,38,38,0.24)' : 'rgba(245,158,11,0.28)'}`,
          borderRadius: 12,
        }}>
          <AlertCircle size={15} style={{ color: error ? '#dc2626' : '#d97706', flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>{error || warning}</p>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 10,
        marginBottom: 14,
      }}>
        <StatCard label="Recent Calls" value={stats.calls} Icon={PhoneCall} />
        <StatCard label="Missed Calls" value={stats.missed} Icon={PhoneMissed} tone={stats.missed > 0 ? 'warn' : 'ok'} />
        <StatCard label="Text Messages" value={stats.texts} Icon={MessageSquare} />
        <StatCard label="Failed Texts" value={stats.failedTexts} Icon={AlertCircle} tone={stats.failedTexts > 0 ? 'warn' : 'ok'} />
      </div>

      <div style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 14,
        background: 'var(--bg-elevated)',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14, borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{
              display: 'inline-flex',
              padding: 3,
              borderRadius: 12,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
            }}>
              {ACTIVITY_TYPES.map(({ key, label, Icon }) => {
                const active = activityType === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setActivityType(key)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      minHeight: 36, padding: '8px 12px', borderRadius: 9, border: 'none',
                      background: active ? 'var(--bg-elevated)' : 'transparent',
                      color: active ? 'var(--accent-color)' : 'var(--text-secondary)',
                      boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    <Icon size={14} /> {label}
                  </button>
                );
              })}
            </div>

            <label style={{ position: 'relative', minWidth: 240, flex: '1 1 260px', maxWidth: 420 }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search names, numbers, statuses..."
                className="input"
                style={{ width: '100%', paddingLeft: 34, height: 38, fontSize: 12 }}
              />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {FILTERS.map(option => {
              const active = filter === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setFilter(option.key)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    minHeight: 30, padding: '6px 10px', borderRadius: 999,
                    border: `1px solid ${active ? 'var(--accent-color)' : 'var(--border-subtle)'}`,
                    background: active ? 'rgba(19,41,75,0.08)' : 'transparent',
                    color: active ? 'var(--accent-color)' : 'var(--text-secondary)',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '56px 0' }}>
            <RefreshCw size={22} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />
          </div>
        ) : records.length === 0 ? (
          <EmptyActivity type={activityType} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {records.map(record => (
              <ActivityRow key={`${activityType}-${record.id}`} record={record} type={activityType} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, Icon, tone }) {
  const color = tone === 'warn' ? '#dc2626' : tone === 'ok' ? '#059669' : 'var(--accent-color)';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
      borderRadius: 13, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${color}18`, color,
      }}>
        <Icon size={16} />
      </div>
      <div>
        <p style={{ fontSize: 18, fontWeight: 750, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</p>
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>{label}</p>
      </div>
    </div>
  );
}

function ActivityRow({ record, type }) {
  const isCall = type === 'calls';
  const direction = record.direction === 'inbound' ? 'inbound' : 'outbound';
  const missed = isCall && isMissedCall(record);
  const failedText = !isCall && isFailedMessage(record);
  const statusTone = toneFor(record.status, type);
  const name = record.customerName || (direction === 'inbound' ? record.from : record.to) || 'Unknown contact';
  const phone = record.customerPhone || (direction === 'inbound' ? record.from : record.to) || 'No phone';
  const timestamp = isCall ? record.startedAt : record.sentAt;
  const Icon = isCall
    ? (missed ? PhoneMissed : direction === 'inbound' ? PhoneIncoming : PhoneOutgoing)
    : (direction === 'inbound' ? ArrowDownLeft : ArrowUpRight);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      gap: 14,
      alignItems: 'center',
      padding: '14px 16px',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div style={{ display: 'flex', gap: 12, minWidth: 0 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 12, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: missed || failedText ? 'rgba(220,38,38,0.10)' : 'var(--bg-card)',
          color: missed || failedText ? '#dc2626' : 'var(--accent-color)',
          border: '1px solid var(--border-subtle)',
        }}>
          <Icon size={17} />
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <p style={{ fontSize: 13, fontWeight: 750, color: 'var(--text-primary)', margin: 0 }}>{name}</p>
            <span style={{
              display: 'inline-flex', alignItems: 'center', minHeight: 21, padding: '3px 8px',
              borderRadius: 999, fontSize: 10, fontWeight: 750,
              color: statusTone.color, background: statusTone.background, border: `1px solid ${statusTone.border}`,
            }}>
              {titleCase(record.status)}
            </span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: isCall ? 4 : 6 }}>
            {titleCase(direction)} · {phone} · {formatDateTime(timestamp)}
            {isCall ? ` · ${formatDuration(record.durationSeconds)}` : ''}
          </p>
          {isCall ? (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              {record.summary || `${titleCase(direction)} call`}
            </p>
          ) : (
            <p style={{
              fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {record.body || 'No message body'}
            </p>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'right', color: 'var(--text-tertiary)', fontSize: 11, whiteSpace: 'nowrap' }}>
        {timestamp ? `${timeAgo(timestamp)} ago` : 'No time'}
        <p style={{ marginTop: 4, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {record.source || 'twilio'}
        </p>
      </div>
    </div>
  );
}

function EmptyActivity({ type }) {
  return (
    <div style={{ textAlign: 'center', padding: '52px 18px' }}>
      <div style={{
        width: 58, height: 58, borderRadius: 16, margin: '0 auto 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
        color: 'var(--text-tertiary)',
      }}>
        <Inbox size={22} />
      </div>
      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
        No {type === 'calls' ? 'calls' : 'text messages'} found
      </p>
      <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
        Try another filter or refresh once more activity lands in Twilio.
      </p>
    </div>
  );
}
