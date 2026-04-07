import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Mail, MessageSquare, Users, Plus, FileText, Trash2, Eye, Search, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client';

const EASE = [0.25, 1, 0.5, 1];

const TEMPLATE_STAGES = [
  { value: 'new_booking', label: 'New Booking' },
  { value: 'approval', label: 'Approval' },
  { value: 'pickup_reminder', label: 'Pickup Reminder' },
  { value: 'return_reminder', label: 'Return Reminder' },
  { value: 'completion', label: 'Completion' },
  { value: 'review_request', label: 'Review Request' },
  { value: 'custom', label: 'Custom' },
];

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function ConversationList({ conversations, selected, onSelect, search, onSearch }) {
  const filtered = conversations.filter(c => {
    if (!search) return true;
    const name = `${c.customer?.first_name || ''} ${c.customer?.last_name || ''}`.toLowerCase();
    return name.includes(search.toLowerCase()) || (c.customer?.email || '').includes(search.toLowerCase());
  });

  return (
    <div className="flex flex-col h-full border-r border-gray-200 dark:border-gray-800">
      <div className="p-3 border-b border-gray-200 dark:border-gray-800">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50 focus:outline-none focus:ring-1 focus:ring-brand-500"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="py-10 text-center">
            <Users size={24} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-xs text-gray-400">No conversations</p>
          </div>
        ) : (
          filtered.map(c => {
            const isActive = selected === c.customer_id;
            const name = `${c.customer?.first_name || ''} ${c.customer?.last_name || ''}`.trim() || 'Unknown';
            return (
              <button
                key={c.customer_id}
                onClick={() => onSelect(c.customer_id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-gray-100 dark:border-gray-800/50 ${
                  isActive ? 'bg-brand-50/40 dark:bg-brand-500/5' : 'hover:bg-gray-50 dark:hover:bg-white/[0.02]'
                }`}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold bg-brand-500 text-white shrink-0">
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{name}</p>
                    <span className="text-[10px] text-gray-400 shrink-0 ml-2">{timeAgo(c.last_at)}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{c.last_message || 'No messages'}</p>
                  <span className={`inline-block mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    c.last_channel === 'sms' ? 'bg-green-100 text-green-600 dark:bg-green-500/10 dark:text-green-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
                  }`}>
                    {c.last_channel === 'sms' ? 'SMS' : 'Email'}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function ChatPanel({ customerId, conversations }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [channel, setChannel] = useState('email');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState([]);
  const messagesEndRef = useRef(null);

  const conversation = conversations.find(c => c.customer_id === customerId);
  const customerName = conversation ? `${conversation.customer?.first_name || ''} ${conversation.customer?.last_name || ''}`.trim() : '';

  useEffect(() => {
    if (!customerId) return;
    setLoading(true);
    api.getMessages(customerId).then(data => {
      setMessages(data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [customerId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      const payload = { channel, body: body.trim() };
      if (channel === 'email' && subject.trim()) payload.subject = subject.trim();
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

  if (!customerId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <MessageSquare size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-gray-400">Select a conversation to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Chat header */}
      <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{customerName || 'Customer'}</p>
          <p className="text-xs text-gray-400">{conversation?.customer?.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChannel(channel === 'email' ? 'sms' : 'email')}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
              channel === 'email'
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
                : 'bg-green-100 text-green-600 dark:bg-green-500/10 dark:text-green-400'
            }`}
          >
            {channel === 'email' ? <><Mail size={12} className="inline mr-1" />Email</> : <><MessageSquare size={12} className="inline mr-1" />SMS</>}
          </button>
          <button onClick={loadTemplates} className="btn-ghost text-xs py-1 px-2">
            <FileText size={12} /> Templates
          </button>
        </div>
      </div>

      {/* Template picker */}
      <AnimatePresence>
        {showTemplates && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-b border-gray-200 dark:border-gray-800"
          >
            <div className="p-3 space-y-1 max-h-[180px] overflow-y-auto">
              {templates.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-2">No templates yet. Create one in the Templates tab.</p>
              ) : (
                templates.filter(t => t.is_active).map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleApplyTemplate(t)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{t.name}</p>
                      <p className="text-[10px] text-gray-400 capitalize">{t.stage.replace(/_/g, ' ')}</p>
                    </div>
                    <ChevronRight size={12} className="text-gray-300 shrink-0" />
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {loading && (
          <div className="py-10 text-center">
            <div className="inline-block w-5 h-5 border-2 border-gray-300 border-t-brand-500 rounded-full animate-spin" />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="py-10 text-center">
            <Mail size={28} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-400">No messages yet. Send the first one!</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
                msg.direction === 'outbound'
                  ? 'bg-brand-500 text-white rounded-br-md'
                  : 'bg-gray-100 dark:bg-gray-800 rounded-bl-md'
              }`}
              style={msg.direction === 'inbound' ? { color: 'var(--text-primary)' } : {}}
            >
              {msg.subject && (
                <p className={`text-xs font-semibold mb-1 ${msg.direction === 'outbound' ? 'text-white/80' : 'text-gray-500'}`}>
                  Re: {msg.subject}
                </p>
              )}
              <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>
              <div className={`flex items-center gap-2 mt-1.5 ${msg.direction === 'outbound' ? 'justify-end' : ''}`}>
                <span className={`text-[10px] ${msg.direction === 'outbound' ? 'text-white/60' : 'text-gray-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </span>
                <span className={`text-[10px] uppercase ${msg.direction === 'outbound' ? 'text-white/40' : 'text-gray-300'}`}>
                  {msg.channel}
                </span>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Compose */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-4">
        {channel === 'email' && (
          <input
            type="text"
            placeholder="Subject..."
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full mb-2 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-500"
            style={{ color: 'var(--text-primary)' }}
          />
        )}
        <div className="flex items-end gap-2">
          <textarea
            placeholder={`Type your ${channel === 'email' ? 'email' : 'SMS'}...`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
            style={{ color: 'var(--text-primary)' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            onClick={handleSend}
            disabled={!body.trim() || sending}
            className="btn-primary px-4 py-2.5 shrink-0"
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send size={14} />
            )}
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">⌘ + Enter to send</p>
      </div>
    </div>
  );
}

function EmailTemplatesTab() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null = list, {} = new, {id:...} = edit
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
    await api.deleteEmailTemplate(id).catch(() => {});
    fetchTemplates();
  };

  const startEdit = (template) => {
    setEditing(template);
    setForm({
      name: template.name,
      stage: template.stage,
      subject: template.subject,
      body: template.body,
    });
  };

  if (editing !== null) {
    return (
      <div className="p-5 space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {editing.id ? 'Edit Template' : 'New Template'}
          </h2>
          <button onClick={() => { setEditing(null); setForm({ name: '', stage: 'custom', subject: '', body: '' }); }} className="btn-ghost text-xs">
            Cancel
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Template Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-500"
                style={{ color: 'var(--text-primary)' }}
                placeholder="e.g., Booking Confirmation"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Stage</label>
              <select
                value={form.stage}
                onChange={(e) => setForm({ ...form, stage: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-500"
                style={{ color: 'var(--text-primary)' }}
              >
                {TEMPLATE_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Subject Line</label>
            <input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-500"
              style={{ color: 'var(--text-primary)' }}
              placeholder="e.g., Your booking {{booking_code}} is confirmed!"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Email Body</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={10}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none font-mono"
              style={{ color: 'var(--text-primary)' }}
              placeholder="Hi {{first_name}},&#10;&#10;Thank you for your booking..."
            />
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setPreview(form)} className="btn-ghost text-xs py-2 px-3">
              <Eye size={12} /> Preview
            </button>
            <button onClick={handleSave} disabled={saving || !form.name || !form.subject || !form.body} className="btn-primary text-xs py-2 px-4">
              {saving ? 'Saving...' : editing.id ? 'Update Template' : 'Create Template'}
            </button>
          </div>
        </div>

        {/* Preview overlay */}
        <AnimatePresence>
          {preview && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
              onClick={() => setPreview(null)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 10 }}
                className="w-full max-w-lg mx-4 rounded-2xl bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Email Preview</p>
                  <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>
                <div className="p-5">
                  <p className="text-xs text-gray-400 mb-1">Subject:</p>
                  <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{preview.subject}</p>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
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
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Email Templates</h2>
        <button onClick={() => setEditing({})} className="btn-primary text-xs py-1.5 px-3">
          <Plus size={12} /> New Template
        </button>
      </div>

      {loading ? (
        <div className="py-10 text-center">
          <div className="inline-block w-5 h-5 border-2 border-gray-300 border-t-brand-500 rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="py-10 text-center">
          <FileText size={28} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-sm text-gray-400 mb-3">No email templates yet</p>
          <button onClick={() => setEditing({})} className="btn-primary text-xs py-1.5 px-3">
            Create your first template
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map(t => (
            <div key={t.id} className="card p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t.name}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-gray-500 capitalize">
                    {t.stage.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setPreview(t)} className="p-1.5 rounded-md text-gray-400 hover:text-brand-500 hover:bg-gray-100 dark:hover:bg-white/5">
                    <Eye size={12} />
                  </button>
                  <button onClick={() => startEdit(t)} className="p-1.5 rounded-md text-gray-400 hover:text-brand-500 hover:bg-gray-100 dark:hover:bg-white/5">
                    <FileText size={12} />
                  </button>
                  <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 truncate">{t.subject}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MessagingPage() {
  const [tab, setTab] = useState('conversations'); // 'conversations' | 'templates'
  const [conversations, setConversations] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getConversations()
      .then(data => setConversations(data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="px-5 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between"
      >
        <div>
          <h1 className="text-lg font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Messaging</h1>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Two-way messaging with GHL integration</p>
        </div>
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          {[
            { key: 'conversations', label: 'Conversations', icon: MessageSquare },
            { key: 'templates', label: 'Templates', icon: FileText },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                tab === key
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-brand-500'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      </motion.div>

      {tab === 'templates' ? (
        <div className="flex-1 overflow-y-auto">
          <EmailTemplatesTab />
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          <div className="w-[320px] shrink-0">
            <ConversationList
              conversations={conversations}
              selected={selectedCustomer}
              onSelect={setSelectedCustomer}
              search={search}
              onSearch={setSearch}
            />
          </div>
          <ChatPanel customerId={selectedCustomer} conversations={conversations} />
        </div>
      )}
    </div>
  );
}
