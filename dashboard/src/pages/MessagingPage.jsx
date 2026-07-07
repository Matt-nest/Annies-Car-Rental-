/**
 * Messaging route — orchestrator only.
 */

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, FileText, Clock, ShieldOff, GitBranch } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import ConversationList from '../components/messaging/ConversationList';
import ChatPanel from '../components/messaging/ChatPanel';
import EmailTemplatesTab from '../components/messaging/EmailTemplatesTab';
import SequencesTab from '../components/messaging/SequencesTab';
import OptOutsTab from '../components/messaging/OptOutsTab';
import TimelineView from '../components/messaging/TimelineView';
import { EASE } from '../components/messaging/shared.js';

export default function MessagingPage() {
  const [tab, setTab] = useState('conversations');
  const [conversations, setConversations] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [search, setSearch] = useState('');
  const [, setLoading] = useState(true);

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

  useEffect(() => {
    loadConversations().finally(() => setLoading(false));
  }, [loadConversations]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations();
    }, 30_000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  const handleRefresh = () => {
    loadConversations();
  };

  const tabs = [
    { key: 'conversations', label: 'Chat', fullLabel: 'Conversations', Icon: MessageSquare },
    { key: 'timeline', label: 'Timeline', fullLabel: 'Timeline', Icon: GitBranch },
    { key: 'templates', label: 'Templates', fullLabel: 'Templates', Icon: FileText },
    { key: 'sequences', label: 'Cron', fullLabel: 'Sequences', Icon: Clock },
    { key: 'optouts', label: 'Opt-Outs', fullLabel: 'Opt-Outs', Icon: ShieldOff },
  ];

  return (
    <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', maxWidth: '100%' }}>

      {!(isMobile && selectedCustomer) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          style={{
            padding: isMobile ? '10px 12px' : '14px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: isMobile ? 'stretch' : 'center',
            justifyContent: 'space-between',
            flexDirection: isMobile ? 'column' : 'row',
            flexWrap: isMobile ? 'nowrap' : 'wrap',
            gap: '8px',
            background: 'var(--bg-elevated)',
            backdropFilter: 'blur(12px)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
            <div className="min-w-0">
              <h1 style={{
                fontSize: isMobile ? '16px' : '18px',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'var(--text-primary)',
              }}>SMS Conversations</h1>
              {!isMobile && (
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: 2 }}>
                  Two-way SMS & email messaging
                </p>
              )}
            </div>
            {!isMobile && (
              <a
                href="https://app.crisp.chat"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: '12px', fontWeight: 500, padding: '6px 12px',
                  borderRadius: 8, border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)',
                  textDecoration: 'none', transition: 'all 0.2s ease', cursor: 'pointer',
                  flexShrink: 0,
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--accent-color)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
              >
                <MessageSquare size={13} />
                Open Crisp Dashboard
              </a>
            )}
          </div>

          <div style={{
            display: isMobile ? 'grid' : 'flex',
            gridTemplateColumns: isMobile ? 'repeat(5, 1fr)' : undefined,
            borderRadius: 12,
            padding: 3,
            background: 'var(--bg-card, rgba(0,0,0,0.03))',
            border: '1px solid var(--border-subtle)',
            maxWidth: '100%',
          }}>
            {tabs.map(({ key, label, fullLabel, Icon }) => {
              const isActive = tab === key;
              return (
                <motion.button
                  key={key}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setTab(key)}
                  aria-label={fullLabel}
                  style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: isMobile ? 2 : 5,
                    padding: isMobile ? '8px 4px' : '7px 14px',
                    borderRadius: 9,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: isMobile ? '10px' : '12px',
                    fontWeight: 600,
                    letterSpacing: '-0.005em',
                    minHeight: isMobile ? 44 : undefined,
                    background: isActive ? 'var(--bg-elevated, #fff)' : 'transparent',
                    color: isActive ? '#007AFF' : 'var(--text-secondary)',
                    boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Icon size={isMobile ? 15 : 13} />
                  {isMobile ? (isActive ? label : null) : label}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}

      {tab === 'timeline' ? (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <TimelineView />
        </div>
      ) : tab === 'sequences' ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', minHeight: 0 }}>
          <SequencesTab />
        </div>
      ) : tab === 'templates' ? (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <EmailTemplatesTab />
        </div>
      ) : tab === 'optouts' ? (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <OptOutsTab />
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
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

          {isMobile && !selectedCustomer && (
            <div style={{ width: '100%', minWidth: 0 }}>
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
                className="tap-target"
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
    </div>
  );
}
