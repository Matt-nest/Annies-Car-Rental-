/**
 * MessagesScreen — the customer's conversation with the business. Reads/writes
 * the shared `messages` table (admin sees + replies from the Conversations
 * inbox). Inbound = the customer's own messages (right); outbound = from the
 * business (left).
 */
import { useEffect, useRef, useState } from 'react';
import { Send, Loader2, MessageSquare } from 'lucide-react';
import { useAccountAuth } from '../AccountAuthContext';
import { getMessages, sendMessage, type PortalMessage } from '../portalClient';
import { brand } from '../../../../config/brand';

function fmtTime(iso: string): string {
  try { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  catch { return ''; }
}

export default function MessagesScreen() {
  const { token } = useAccountAuth();
  const accent = brand.colors.accent;
  const [messages, setMessages] = useState<PortalMessage[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  async function load() {
    if (!token) return;
    try { setMessages(await getMessages(token)); }
    catch (e: any) { setError(e?.message || 'Could not load messages'); setMessages([]); }
  }

  useEffect(() => { load(); }, [token]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send() {
    const body = draft.trim();
    if (!token || !body || sending) return;
    setSending(true); setError('');
    // Optimistic append
    const optimistic: PortalMessage = { id: `tmp-${Date.now()}`, direction: 'inbound', channel: 'portal', body, created_at: new Date().toISOString() };
    setMessages((m) => [...(m || []), optimistic]);
    setDraft('');
    try {
      await sendMessage(token, body);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not send');
      setMessages((m) => (m || []).filter((x) => x.id !== optimistic.id)); // roll back
      setDraft(body);
    }
    setSending(false);
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 64px)' }}>
      <div className="px-5 pt-6 pb-3">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Messages</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Questions? We're here to help.</p>
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto px-5 py-2 space-y-2.5">
        {messages === null && (
          <div className="flex justify-center py-10" style={{ color: 'var(--text-tertiary)' }}><Loader2 size={20} className="animate-spin" /></div>
        )}

        {messages && messages.length === 0 && (
          <div className="flex flex-col items-center text-center pt-16">
            <MessageSquare size={28} style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-sm mt-3" style={{ color: 'var(--text-secondary)' }}>No messages yet</p>
            <p className="text-xs mt-1 max-w-xs" style={{ color: 'var(--text-tertiary)' }}>
              Send a message and {brand.name} will get back to you here.
            </p>
          </div>
        )}

        {messages?.map((m) => {
          const mine = m.direction === 'inbound';
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[80%]">
                <div
                  className="px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words"
                  style={mine
                    ? { background: accent, color: '#0a0a0a', borderBottomRightRadius: 4 }
                    : { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderBottomLeftRadius: 4 }}
                >
                  {m.body}
                </div>
                <p className={`text-[10px] mt-1 ${mine ? 'text-right' : 'text-left'}`} style={{ color: 'var(--text-tertiary)' }}>
                  {fmtTime(m.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {error && <p className="text-xs px-5 pb-1" style={{ color: '#ef4444' }}>{error}</p>}

      {/* Composer */}
      <div className="px-4 py-3 flex items-end gap-2" style={{ borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-primary)' }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1}
          placeholder="Type a message…"
          className="flex-1 px-4 py-2.5 rounded-2xl text-sm outline-none resize-none"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', maxHeight: 120 }}
        />
        <button
          onClick={send}
          disabled={!draft.trim() || sending}
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ background: accent, color: '#0a0a0a', opacity: (!draft.trim() || sending) ? 0.5 : 1 }}
          aria-label="Send"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
