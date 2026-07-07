/**
 * Messaging route — orchestrator only.
 *
 * Phase 2E decomposition: heavy lifting lives in components/messaging/*.
 * This file is now ~200 lines (was 1,406). Adding new functionality should
 * land in the appropriate component file rather than bloating the orchestrator.
 *
 * Components:
 *   ConversationList   — left panel, customer rows
 *   ChatPanel          — message thread + compose
 *   EmailTemplatesTab  — templates CRUD with preview + active toggle
 *   SequencesTab       — read-only listing of cron-driven stages
 *   shared.js          — utility helpers + constants (TEMPLATE_STAGES, EASE, etc.)
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
            }}>SMS Conversations</h1>
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: 2 }}>
              Two-way SMS & email messaging
            </p>
          </div>
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
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--accent-color)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
          >
            <MessageSquare size={13} />
            Open Crisp Dashboard
          </a>

          {/* Tab switcher */}
          <div style={{
            display: 'flex', borderRadius: 12, padding: 3,
            background: 'var(--bg-card, rgba(0,0,0,0.03))',
            border: '1px solid var(--border-subtle)',
          }}>
            {[
              { key: 'conversations', label: 'Conversations', Icon: MessageSquare },
              { key: 'timeline',      label: 'Timeline',      Icon: GitBranch },
              { key: 'templates',     label: 'Templates',     Icon: FileText },
              { key: 'sequences',     label: 'Sequences',     Icon: Clock },
              { key: 'optouts',       label: 'Opt-Outs',      Icon: ShieldOff },
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
      {tab === 'timeline' ? (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <TimelineView />
        </div>
      ) : tab === 'sequences' ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
          <SequencesTab />
        </div>
      ) : tab === 'templates' ? (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <EmailTemplatesTab />
        </div>
      ) : tab === 'optouts' ? (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <OptOutsTab />
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
