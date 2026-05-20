import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  MessageSquare, Mail, Send, FileText, ChevronRight, ArrowDown, CheckCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../api/client';
import { EASE, formatDate, getInitials, getAvatarColor } from './shared.js';

/* ── Chat Panel ── */
export default function ChatPanel({ customerId, conversations }) {
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
              { key: 'all', label: 'All', Icon: MessageSquare, color: '#465FFF' },
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
              background: showTemplates ? 'rgba(70,95,255,0.1)' : 'var(--bg-card)',
              color: showTemplates ? '#465FFF' : 'var(--text-secondary)',
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
              border: '3px solid var(--border-subtle)', borderTopColor: '#465FFF',
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
                    ? 'rgba(70, 95, 255, 0.22)'
                    : 'rgba(255, 255, 255, 0.039)',
                  color: isOutbound ? '#fff' : 'var(--text-primary)',
                  border: `1px solid ${isOutbound ? 'rgba(70,95,255,0.3)' : 'rgba(255,255,255,0.12)'}`,
                  boxShadow: isOutbound
                    ? '0 4px 20px rgba(70,95,255,0.22), inset 0 0.5px 0 rgba(255,255,255,0.2)'
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
                    <CheckCheck size={12} style={{ color: '#465FFF' }} />
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
            onFocus={(e) => e.target.style.borderColor = '#465FFF'}
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
              onFocus={(e) => { e.target.style.borderColor = '#465FFF'; e.target.style.boxShadow = '0 0 0 3px rgba(70,95,255,0.08)'; }}
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
                ? 'linear-gradient(135deg, #465FFF 0%, #465FFF 100%)'
                : 'var(--bg-card)',
              color: body.trim() ? '#fff' : 'var(--text-tertiary)',
              boxShadow: body.trim() ? '0 4px 14px rgba(70,95,255,0.3)' : 'none',
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
