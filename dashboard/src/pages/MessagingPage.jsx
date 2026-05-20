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
    <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

      {/* Page header — hidden on mobile when viewing a chat (the ChatPanel
          renders its own sticky chat header bar in that mode). */}
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
            gap: isMobile ? '8px' : '8px',
            background: 'var(--bg-elevated)',
            backdropFilter: 'blur(12px)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <h1 style={{
                fontSize: isMobile ? '16px' : '18px',
                fontWeight: 700, letterSpacing: '-0.02em',
                color: 'var(--text-primary)',
              }}>SMS Conversations</h1>
              {!isMobile && (
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: 2 }}>
                  Two-way SMS & email messaging
                </p>
              )}
            </div>
            {/* Crisp dashboard link — desktop-only. Annie won't open Crisp's
                full admin UI on her phone. */}
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
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
              >
                <MessageSquare size={13} />
                Open Crisp Dashboard
              </a>
            )}
          </div>

          {/* Tab switcher — Sprint 9: on mobile becomes icon-only equal-grid
              with the active tab showing its label. Desktop unchanged. */}
          <div style={{
            display: isMobile ? 'grid' : 'flex',
            gridTemplateColumns: isMobile ? 'repeat(5, 1fr)' : undefined,
            borderRadius: 12, padding: 3,
            background: 'var(--bg-card, rgba(0,0,0,0.03))',
            border: '1px solid var(--border-subtle)',
          }}>
            {[
              { key: 'conversations', label: 'Chat',      fullLabel: 'Conversations', Icon: MessageSquare },
              { key: 'timeline',      label: 'Timeline',  fullLabel: 'Timeline',      Icon: GitBranch },
              { key: 'templates',     label: 'Templates', fullLabel: 'Templates',     Icon: FileText },
              { key: 'sequences',     label: 'Cron',      fullLabel: 'Sequences',     Icon: Clock },
              { key: 'optouts',       label: 'Opt-Outs',  fullLabel: 'Opt-Outs',      Icon: ShieldOff },
            ].map(({ key, label, fullLabel, Icon }) => {
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
                    borderRadius: 9, border: 'none',
                    cursor: 'pointer',
                    fontSize: isMobile ? '10px' : '12px',
                    fontWeight: 600,
                    letterSpacing: '-0.005em',
                    minHeight: isMobile ? 44 : undefined,
                    background: isActive ? 'var(--bg-elevated, #fff)' : 'transparent',
                    color: isActive ? '#465FFF' : 'var(--text-secondary)',
                    boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Icon size={isMobile ? 16 : 13} />
                  <span>{isMobile ? label : fullLabel}</span>
                </motion.button>
              );
            })}
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
              {/* Sprint 9: iOS-style sticky chat header — back button + avatar
                  + customer name. Replaces the plain "← Back" text link. */}
              {(() => {
                const conv = conversations.find(c => c.customer_id === selectedCustomer);
                const name = conv
                  ? `${conv.customer?.first_name || ''} ${conv.customer?.last_name || ''}`.trim() || 'Customer'
                  : 'Customer';
                const initials = (conv?.customer?.first_name?.[0] || '') + (conv?.customer?.last_name?.[0] || '');
                const phone = conv?.customer?.phone;
                return (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: 'max(10px, env(safe-area-inset-top)) 12px 10px',
                    borderBottom: '1px solid var(--border-subtle)',
                    background: 'var(--bg-elevated)',
                    flexShrink: 0,
                  }}>
                    <button
                      onClick={() => setSelectedCustomer(null)}
                      aria-label="Back to conversation list"
                      style={{
                        minWidth: 44, minHeight: 44,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--accent-color)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        marginLeft: -8,
                      }}
                    >
                      <span style={{ fontSize: 24, lineHeight: 1, fontWeight: 300 }}>‹</span>
                    </button>
                    <div
                      aria-hidden="true"
                      style={{
                        width: 36, height: 36, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'linear-gradient(135deg, var(--accent-color) 0%, #465FFF 100%)',
                        color: '#fff', fontSize: 13, fontWeight: 700,
                        boxShadow: '0 2px 8px rgba(70,95,255,0.25)',
                        flexShrink: 0,
                      }}
                    >
                      {initials.toUpperCase() || '?'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
                        margin: 0, lineHeight: 1.2,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{name}</p>
                      {phone && (
                        <p style={{
                          fontSize: 11, color: 'var(--text-tertiary)',
                          margin: 0, lineHeight: 1.2, marginTop: 1,
                        }}>{phone}</p>
                      )}
                    </div>
                    {phone && (
                      <a
                        href={`tel:${phone}`}
                        aria-label={`Call ${name}`}
                        style={{
                          minWidth: 44, minHeight: 44,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'var(--accent-color)',
                          textDecoration: 'none',
                        }}
                      >
                        <MessageSquare size={20} style={{ display: 'none' }} />
                        {/* Phone icon */}
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                      </a>
                    )}
                  </div>
                );
              })()}
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
