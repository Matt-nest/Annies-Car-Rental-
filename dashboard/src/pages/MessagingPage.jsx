import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Send, Mail, MessageSquare, Users, Plus, FileText, Trash2, Eye, Search,
  ChevronRight, RefreshCw, Phone, Image, Paperclip, Check, CheckCheck,
  ArrowDown, Smile, MoreVertical, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client';

/* ── Design Tokens (leadflow-template aligned) ── */
const EASE = [0.25, 1, 0.5, 1];
const SPRING = { type: 'spring', stiffness: 500, damping: 30 };

const TEMPLATE_STAGES = [
  // Booking flow
  { value: 'booking_submitted', label: 'Booking Submitted', color: '#22c55e' },
  { value: 'booking_approved', label: 'Booking Approved', color: '#10b981' },
  { value: 'booking_declined', label: 'Booking Declined', color: '#ef4444' },
  { value: 'booking_cancelled', label: 'Booking Cancelled', color: '#f97316' },
  // Payment
  { value: 'payment_confirmed', label: 'Payment Confirmed', color: '#3b82f6' },
  { value: 'refund_processed', label: 'Refund Processed', color: '#6366f1' },
  // Pickup flow
  { value: 'pickup_reminder', label: 'Pre-Pickup (24h)', color: '#f59e0b' },
  { value: 'day_of_pickup', label: 'Day-of Pickup', color: '#eab308' },
  { value: 'delivery_offer', label: 'Delivery Offer', color: '#d97706' },
  // During rental
  { value: 'mid_rental_checkin', label: 'Mid-Rental Check-in', color: '#8b5cf6' },
  { value: 'extension_offer', label: 'Extension Offer', color: '#a78bfa' },
  // Return flow
  { value: 'return_reminder', label: 'Pre-Return (24h)', color: '#ec4899' },
  { value: 'day_of_return', label: 'Day-of Return', color: '#f472b6' },
  { value: 'return_confirmed', label: 'Return Confirmed', color: '#14b8a6' },
  // Post-rental
  { value: 'rental_completed', label: 'Review Request', color: '#06b6d4' },
  { value: 'repeat_customer', label: 'Loyalty / Repeat', color: '#007AFF' },
  // Alerts
  { value: 'late_return_warning', label: 'Late Warning (1h)', color: '#f97316' },
  { value: 'late_return_escalation', label: 'Late Escalation (4h)', color: '#dc2626' },
  // Other
  { value: 'damage_notification', label: 'Damage Report', color: '#991b1b' },
];

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

function getInitials(name) {
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
];

function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/* ── Conversation List ── */
function ConversationList({ conversations, selected, onSelect, search, onSearch, onRefresh }) {
  const filtered = useMemo(() => conversations.filter(c => {
    if (!search) return true;
    const name = `${c.customer?.first_name || ''} ${c.customer?.last_name || ''}`.toLowerCase();
    return name.includes(search.toLowerCase()) || (c.customer?.email || '').includes(search.toLowerCase()) || (c.customer?.phone || '').includes(search.toLowerCase());
  }), [conversations, search]);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-secondary, #f5f5f5)', borderRight: '1px solid var(--border-subtle, rgba(0,0,0,0.07))' }}>
      {/* Search + Sync header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.06))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', flex: 1 }}>
            Messages
          </h2>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onRefresh}
            title="Refresh conversations"
            style={{
              width: 32, height: 32, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-card, rgba(0,0,0,0.03))',
              border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              transition: 'all 0.2s ease',
            }}
          >
            <RefreshCw size={14} />
          </motion.button>
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px 8px 32px', fontSize: '13px',
              borderRadius: 10, border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
              background: 'var(--bg-elevated, #fff)', color: 'var(--text-primary)',
              outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
            onFocus={(e) => { e.target.style.borderColor = '#007AFF'; e.target.style.boxShadow = '0 0 0 3px rgba(0,122,255,0.1)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; e.target.style.boxShadow = 'none'; }}
          />
        </div>
      </div>

      {/* Conversation items */}
      <div style={{ flex: 1, overflowY: 'auto' }} className="no-scrollbar">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ padding: '48px 16px', textAlign: 'center' }}
            >
              <div style={{
                width: 56, height: 56, borderRadius: 16, margin: '0 auto 12px',
                background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Users size={24} style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                {search ? 'No conversations match your search' : 'No conversations yet'}
              </p>
              {!search && (
                <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: 4 }}>
                  Send a message to get started
                </p>
              )}
            </motion.div>
          ) : (
            filtered.map((c, i) => {
              const isActive = selected === c.customer_id;
              const name = `${c.customer?.first_name || ''} ${c.customer?.last_name || ''}`.trim() || 'Unknown';
              const initials = getInitials(name);
              const avatarBg = getAvatarColor(name);

              return (
                <motion.button
                  key={c.customer_id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.03, ease: EASE }}
                  onClick={() => onSelect(c.customer_id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px', textAlign: 'left', border: 'none',
                    cursor: 'pointer', position: 'relative',
                    background: isActive
                      ? 'linear-gradient(135deg, rgba(0,122,255,0.08) 0%, rgba(0,122,255,0.04) 100%)'
                      : 'transparent',
                    borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.04))',
                    transition: 'background 0.2s ease',
                  }}
                  onMouseEnter={(e) => !isActive && (e.currentTarget.style.background = 'var(--bg-card-hover, rgba(0,0,0,0.02))')}
                  onMouseLeave={(e) => !isActive && (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <motion.div
                      layoutId="activeIndicator"
                      style={{
                        position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                        width: 3, height: 32, borderRadius: '0 4px 4px 0',
                        background: 'linear-gradient(180deg, #007AFF 0%, #0066DD 100%)',
                      }}
                      transition={SPRING}
                    />
                  )}

                  {/* Avatar */}
                  <div style={{
                    width: 42, height: 42, borderRadius: 13, flexShrink: 0,
                    background: avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: 700, color: '#fff', letterSpacing: '0.02em',
                    boxShadow: isActive ? '0 4px 12px rgba(0,122,255,0.2)' : '0 2px 8px rgba(0,0,0,0.08)',
                    transition: 'box-shadow 0.3s ease',
                  }}>
                    {initials}
                  </div>

                  {/* Content */}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                      <p style={{
                        fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        letterSpacing: '-0.01em',
                      }}>{name}</p>
                      <span style={{
                        fontSize: '10px', color: 'var(--text-tertiary)',
                        fontWeight: 500, flexShrink: 0, marginLeft: 8,
                      }}>{timeAgo(c.last_at)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <p style={{
                        fontSize: '12px', color: 'var(--text-secondary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        flex: 1, lineHeight: '1.4',
                      }}>
                        {c.last_direction === 'outbound' && <span style={{ color: 'var(--text-tertiary)' }}>You: </span>}
                        {c.last_message || 'Start a conversation'}
                      </p>
                      {/* Channel badge */}
                      <span style={{
                        fontSize: '9px', fontWeight: 600, letterSpacing: '0.04em',
                        padding: '2px 6px', borderRadius: 6, flexShrink: 0, textTransform: 'uppercase',
                        background: c.last_channel === 'sms'
                          ? 'rgba(34,197,94,0.1)' : 'rgba(59,130,246,0.1)',
                        color: c.last_channel === 'sms' ? '#16a34a' : '#2563eb',
                      }}>
                        {c.last_channel === 'sms' ? 'SMS' : 'Email'}
                      </span>
                    </div>
                  </div>
                </motion.button>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Chat Panel ── */
function ChatPanel({ customerId, conversations }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [channel, setChannel] = useState('all');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);

  const conversation = conversations.find(c => c.customer_id === customerId);
  const customerName = conversation
    ? `${conversation.customer?.first_name || ''} ${conversation.customer?.last_name || ''}`.trim()
    : '';
  const customerEmail = conversation?.customer?.email || '';
  const customerPhone = conversation?.customer?.phone || '';

  useEffect(() => {
    if (!customerId) return;
    setLoading(true);
    api.getMessages(customerId).then(data => {
      setMessages(data || []);
      setLoading(false);
      setTimeout(() => scrollToBottom('auto'), 50);
    }).catch(() => setLoading(false));
  }, [customerId]);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior });
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 100);
  }, []);

  const handleSend = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      // Use 'email' as default when 'all' is selected for composing
      const sendChannel = channel === 'all' ? 'email' : channel;
      const payload = { channel: sendChannel, body: body.trim() };
      if (sendChannel === 'email' && subject.trim()) payload.subject = subject.trim();
      const result = await api.sendMessage(customerId, payload);
      if (result?.message) {
        setMessages(prev => [...prev, result.message]);
      }
      setBody('');
      setSubject('');
    } catch (err) {
      console.error('Send failed:', err);
    }
    setSending(false);
  };

  const handleApplyTemplate = (template) => {
    setSubject(template.subject);
    setBody(template.body);
    setChannel('email');
    setShowTemplates(false);
  };

  const loadTemplates = async () => {
    setShowTemplates(!showTemplates);
    if (!showTemplates) {
      const data = await api.getEmailTemplates().catch(() => []);
      setTemplates(data || []);
    }
  };

  // Group messages by date, filtered by selected channel
  const groupedMessages = useMemo(() => {
    const filtered = channel === 'all'
      ? messages
      : messages.filter(m => m.channel === channel || m.channel === 'system');
    const groups = [];
    let currentDate = '';
    for (const msg of filtered) {
      const date = formatDate(msg.created_at);
      if (date !== currentDate) {
        currentDate = date;
        groups.push({ type: 'date', label: date, key: `date-${date}` });
      }
      groups.push({ type: 'message', ...msg, key: msg.id });
    }
    return groups;
  }, [messages, channel]);

  if (!customerId) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-primary)',
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: EASE }}
          style={{ textAlign: 'center', maxWidth: 280 }}
        >
          <div style={{
            width: 72, height: 72, borderRadius: 20, margin: '0 auto 20px',
            background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--border-subtle)',
          }}>
            <MessageSquare size={28} style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, letterSpacing: '-0.01em' }}>
            Select a conversation
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: '1.5' }}>
            Choose a customer from the left panel to view messages and start chatting
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* ── Chat header ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        style={{
          padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-elevated, #fff)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 12, flexShrink: 0,
            background: getAvatarColor(customerName || 'U'),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 700, color: '#fff',
          }}>
            {getInitials(customerName || 'U')}
          </div>
          <div>
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              {customerName || 'Customer'}
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
              {customerEmail}{customerPhone ? ` · ${customerPhone}` : ''}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Channel toggle */}
          <div style={{
            display: 'flex', borderRadius: 10, padding: 2,
            background: 'var(--bg-card, rgba(0,0,0,0.03))',
            border: '1px solid var(--border-subtle)',
          }}>
            {[
              { key: 'all', label: 'All', Icon: MessageSquare, color: '#007AFF' },
              { key: 'email', label: 'Email', Icon: Mail, color: '#2563eb' },
              { key: 'sms', label: 'SMS', Icon: MessageSquare, color: '#16a34a' },
            ].map(({ key, label, Icon, color }) => (
              <motion.button
                key={key}
                whileTap={{ scale: 0.95 }}
                onClick={() => setChannel(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: '11px', fontWeight: 600, letterSpacing: '0.01em',
                  background: channel === key ? 'var(--bg-elevated, #fff)' : 'transparent',
                  color: channel === key ? color : 'var(--text-tertiary)',
                  boxShadow: channel === key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <Icon size={12} />
                {label}
              </motion.button>
            ))}
          </div>

          {/* Templates button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={loadTemplates}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)',
              background: showTemplates ? 'rgba(0,122,255,0.1)' : 'var(--bg-card)',
              color: showTemplates ? '#007AFF' : 'var(--text-secondary)',
              fontSize: '11px', fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <FileText size={12} /> Templates
          </motion.button>
        </div>
      </motion.div>

      {/* ── Template picker ── */}
      <AnimatePresence>
        {showTemplates && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            style={{
              overflow: 'hidden',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'var(--bg-elevated)',
            }}
          >
            <div style={{ padding: '12px 16px', maxHeight: 180, overflowY: 'auto' }}>
              {templates.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '8px 0' }}>
                  No active templates. Create one in the Templates tab.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {templates.filter(t => t.is_active !== false).map(t => (
                    <motion.button
                      key={t.id}
                      whileHover={{ x: 4 }}
                      onClick={() => handleApplyTemplate(t)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 12px', borderRadius: 10, textAlign: 'left',
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-card)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</p>
                        <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{t.stage.replace(/_/g, ' ')} · {t.subject}</p>
                      </div>
                      <ChevronRight size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Messages area ── */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1, overflowY: 'auto', padding: '20px 24px',
          position: 'relative',
          background: 'var(--bg-primary)',
        }}
        className="no-scrollbar"
      >
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              border: '3px solid var(--border-subtle)', borderTopColor: '#007AFF',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: 'center', padding: '48px 0' }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: 16, margin: '0 auto 12px',
              background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--border-subtle)',
            }}>
              <Mail size={22} style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              No messages yet
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
              Send the first message to {customerName || 'this customer'}
            </p>
          </motion.div>
        )}

        {groupedMessages.map((item) => {
          if (item.type === 'date') {
            return (
              <div key={item.key} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                margin: '20px 0 12px', padding: '0 20px',
              }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
                <span style={{
                  fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)',
                  letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                }}>{item.label}</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
              </div>
            );
          }

          const msg = item;
          const isOutbound = msg.direction === 'outbound';

          return (
            <motion.div
              key={msg.key}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, ease: EASE }}
              style={{
                display: 'flex', justifyContent: isOutbound ? 'flex-end' : 'flex-start',
                marginBottom: 8,
              }}
            >
              <div style={{
                maxWidth: '72%', position: 'relative',
              }}>
                {/* Message bubble */}
                <div style={{
                  padding: '10px 14px',
                  borderRadius: isOutbound ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  fontSize: '13px', lineHeight: '1.55', letterSpacing: '-0.005em',
                  position: 'relative', overflow: 'hidden',
                  backdropFilter: 'blur(7px) saturate(1.17) brightness(1.029)',
                  WebkitBackdropFilter: 'blur(7px) saturate(1.17) brightness(1.029)',
                  background: isOutbound
                    ? 'rgba(0, 122, 255, 0.22)'
                    : 'rgba(255, 255, 255, 0.039)',
                  color: isOutbound ? '#fff' : 'var(--text-primary)',
                  border: `1px solid ${isOutbound ? 'rgba(0,122,255,0.3)' : 'rgba(255,255,255,0.12)'}`,
                  boxShadow: isOutbound
                    ? '0 4px 20px rgba(0,122,255,0.22), inset 0 0.5px 0 rgba(255,255,255,0.2)'
                    : '0 2px 12px rgba(0,0,0,0.12), inset 0 0.5px 0 rgba(255,255,255,0.15)',
                }}>
                  {msg.subject && (
                    <p style={{
                      fontSize: '11px', fontWeight: 600, marginBottom: 4,
                      color: isOutbound ? 'rgba(255,255,255,0.75)' : 'var(--text-secondary)',
                    }}>
                      📧 {msg.subject}
                    </p>
                  )}
                  <p style={{ whiteSpace: 'pre-wrap', margin: 0, wordBreak: 'break-word' }}>{msg.body}</p>
                </div>

                {/* Meta info */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  marginTop: 3, padding: '0 4px',
                  justifyContent: isOutbound ? 'flex-end' : 'flex-start',
                }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                  <span style={{
                    fontSize: '9px', color: 'var(--text-tertiary)', fontWeight: 600,
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}>
                    {msg.channel}
                  </span>
                  {isOutbound && (
                    <CheckCheck size={12} style={{ color: '#007AFF' }} />
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      <AnimatePresence>
        {showScrollBtn && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={() => scrollToBottom()}
            style={{
              position: 'absolute', bottom: 120, right: 32,
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', zIndex: 10,
            }}
          >
            <ArrowDown size={16} style={{ color: 'var(--text-secondary)' }} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Compose area ── */}
      <div style={{
        padding: '12px 20px 16px',
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-elevated)',
      }}>
        {(channel === 'email' || channel === 'all') && (
          <motion.input
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            type="text"
            placeholder="Email subject..."
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={{
              width: '100%', marginBottom: 8, padding: '8px 12px',
              fontSize: '13px', borderRadius: 10,
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-primary)', color: 'var(--text-primary)',
              outline: 'none', transition: 'border-color 0.2s',
            }}
            onFocus={(e) => e.target.style.borderColor = '#007AFF'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border-subtle)'}
          />
        )}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <textarea
              placeholder={`Type your ${channel === 'sms' ? 'SMS message' : 'email'}...`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              style={{
                width: '100%', padding: '10px 14px', fontSize: '13px',
                borderRadius: 14, border: '1px solid var(--border-subtle)',
                background: 'var(--bg-primary)', color: 'var(--text-primary)',
                outline: 'none', resize: 'none', lineHeight: '1.5',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#007AFF'; e.target.style.boxShadow = '0 0 0 3px rgba(0,122,255,0.08)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)'; e.target.style.boxShadow = 'none'; }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            onClick={handleSend}
            disabled={!body.trim() || sending}
            style={{
              width: 42, height: 42, borderRadius: 14, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', cursor: !body.trim() || sending ? 'not-allowed' : 'pointer',
              background: body.trim()
                ? 'linear-gradient(135deg, #007AFF 0%, #0066DD 100%)'
                : 'var(--bg-card)',
              color: body.trim() ? '#fff' : 'var(--text-tertiary)',
              boxShadow: body.trim() ? '0 4px 14px rgba(0,122,255,0.3)' : 'none',
              transition: 'all 0.3s ease',
              opacity: sending ? 0.7 : 1,
            }}
          >
            {sending ? (
              <div style={{
                width: 16, height: 16, borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                animation: 'spin 0.8s linear infinite',
              }} />
            ) : (
              <Send size={16} />
            )}
          </motion.button>
        </div>
        <p style={{
          fontSize: '10px', color: 'var(--text-tertiary)', marginTop: 6,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ opacity: 0.7 }}>⌘</span> + Enter to send
        </p>
      </div>
    </div>
  );
}

/* ── Email Templates Tab ── */
function EmailTemplatesTab() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', stage: 'custom', subject: '', body: '' });
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    const data = await api.getEmailTemplates().catch(() => []);
    setTemplates(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

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
    setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, is_active: newActive } : t));
    try {
      await api.updateEmailTemplate(template.id, { is_active: newActive });
    } catch (err) {
      setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, is_active: !newActive } : t));
      console.error('Toggle failed:', err);
    }
  };

  const startEdit = (template) => {
    setEditing(template);
    setForm({ name: template.name, stage: template.stage, subject: template.subject, body: template.body });
  };

  const stageData = TEMPLATE_STAGES.find(s => s.value === form.stage) || TEMPLATE_STAGES[6];

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

        {/* Preview overlay */}
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
                    <button onClick={() => startEdit(t)} style={{ padding: 6, borderRadius: 8, background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }} title="Edit"><FileText size={14} /></button>
                    <button onClick={() => handleDelete(t.id)} style={{ padding: 6, borderRadius: 8, background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }} title="Delete"><Trash2 size={14} /></button>
                  </div>
                </div>
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
    </div>
  );
}

/* ── Main Messaging Page ── */
export default function MessagingPage() {
  const [tab, setTab] = useState('conversations');
  const [conversations, setConversations] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);


  // Mobile viewport detection (768px = Tailwind md breakpoint)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    setIsMobile(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const loadConversations = useCallback(() => {
    return api.getConversations()
      .then(data => setConversations(data || []))
      .catch(() => { });
  }, []);

  // Initial load
  useEffect(() => {
    loadConversations().finally(() => setLoading(false));
  }, [loadConversations]);

  // Poll for new messages every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations();
    }, 30_000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  const handleRefresh = () => {
    loadConversations();
  };

  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>


      {/* Page header — hidden on mobile when viewing a chat */}
      {!(isMobile && selectedCustomer) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: '8px',
            background: 'var(--bg-elevated)',
            backdropFilter: 'blur(12px)',
            flexShrink: 0,
          }}
        >
          <div>
            <h1 style={{
              fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
            }}>Messaging</h1>
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: 2 }}>
              Two-way SMS & email messaging
            </p>
          </div>

          {/* Tab switcher */}
          <div style={{
            display: 'flex', borderRadius: 12, padding: 3,
            background: 'var(--bg-card, rgba(0,0,0,0.03))',
            border: '1px solid var(--border-subtle)',
          }}>
            {[
              { key: 'conversations', label: 'Conversations', Icon: MessageSquare },
              { key: 'templates', label: 'Templates', Icon: FileText },
            ].map(({ key, label, Icon }) => (
              <motion.button
                key={key}
                whileTap={{ scale: 0.97 }}
                onClick={() => setTab(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 14px', borderRadius: 9, border: 'none',
                  cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                  letterSpacing: '-0.005em',
                  background: tab === key ? 'var(--bg-elevated, #fff)' : 'transparent',
                  color: tab === key ? '#007AFF' : 'var(--text-secondary)',
                  boxShadow: tab === key ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <Icon size={13} />
                {label}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Content area */}
      {tab === 'templates' ? (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <EmailTemplatesTab />
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* ── DESKTOP LAYOUT: side-by-side, always both visible ── */}
          {!isMobile && (
            <>
              <div style={{ width: 340, flexShrink: 0 }}>
                <ConversationList
                  conversations={conversations}
                  selected={selectedCustomer}
                  onSelect={setSelectedCustomer}
                  search={search}
                  onSearch={setSearch}
                  onRefresh={handleRefresh}
                />
              </div>
              <ChatPanel customerId={selectedCustomer} conversations={conversations} />
            </>
          )}

          {/* ── MOBILE LAYOUT: list OR chat, never both ── */}
          {isMobile && !selectedCustomer && (
            <div style={{ width: '100%' }}>
              <ConversationList
                conversations={conversations}
                selected={selectedCustomer}
                onSelect={setSelectedCustomer}
                search={search}
                onSearch={setSearch}
                onRefresh={handleRefresh}
              />
            </div>
          )}
          {isMobile && selectedCustomer && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
              <button
                onClick={() => setSelectedCustomer(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '12px 16px', fontSize: '14px', fontWeight: 600,
                  color: 'var(--accent-color)', background: 'none', border: 'none',
                  borderBottom: '1px solid var(--border-subtle)',
                  cursor: 'pointer', flexShrink: 0,
                }}
              >
                ← Back to conversations
              </button>
              <ChatPanel customerId={selectedCustomer} conversations={conversations} />
            </div>
          )}
        </div>
      )}

      {/* Keyframe injection */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg) }
          to { transform: rotate(360deg) }
        }
      `}</style>
    </div>
  );
}
