import { useMemo } from 'react';
import { RefreshCw, Search, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { EASE, SPRING, timeAgo, getInitials, getAvatarColor } from './shared.js';

/* ── Conversation List ── */
export default function ConversationList({ conversations, selected, onSelect, search, onSearch, onRefresh }) {
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
            onFocus={(e) => { e.target.style.borderColor = '#465FFF'; e.target.style.boxShadow = '0 0 0 3px rgba(70,95,255,0.1)'; }}
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
                      ? 'linear-gradient(135deg, rgba(70,95,255,0.08) 0%, rgba(70,95,255,0.04) 100%)'
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
                        background: 'linear-gradient(180deg, #465FFF 0%, #465FFF 100%)',
                      }}
                      transition={SPRING}
                    />
                  )}

                  {/* Avatar */}
                  <div style={{
                    width: 42, height: 42, borderRadius: 13, flexShrink: 0,
                    background: avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: 700, color: '#fff', letterSpacing: '0.02em',
                    boxShadow: isActive ? '0 4px 12px rgba(70,95,255,0.2)' : '0 2px 8px rgba(0,0,0,0.08)',
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
                      {(() => {
                        // 2D: chat (Crisp) is a third channel; system messages match no badge.
                        const ch = c.last_channel;
                        const styles = ch === 'sms'
                          ? { bg: 'rgba(34,197,94,0.1)', fg: '#16a34a', label: 'SMS' }
                          : ch === 'chat'
                            ? { bg: 'rgba(139,92,246,0.12)', fg: '#7c3aed', label: 'Chat' }
                            : { bg: 'rgba(59,130,246,0.1)', fg: '#2563eb', label: 'Email' };
                        return (
                          <span style={{
                            fontSize: '9px', fontWeight: 600, letterSpacing: '0.04em',
                            padding: '2px 6px', borderRadius: 6, flexShrink: 0, textTransform: 'uppercase',
                            background: styles.bg, color: styles.fg,
                          }}>{styles.label}</span>
                        );
                      })()}
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
