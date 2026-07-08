import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DoorOpen, UserPlus, Copy, Check, ExternalLink, CalendarPlus,
  MessageSquare, ChevronRight, Loader2, RefreshCw,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { api } from '../api/client';
import brand from '../config/brand';
import StatusBadge from '../components/shared/StatusBadge';
import DataError from '../components/shared/DataError';
import { SkeletonTable } from '../components/shared/Skeleton';
import LongTermOnboardModal from '../components/portal/LongTermOnboardModal';

const ACTIVE_STATUSES = ['approved', 'confirmed', 'ready_for_pickup', 'active', 'returned'];

function portalUrl(code) {
  return `${brand.siteUrl}/portal?code=${encodeURIComponent(code)}`;
}

function RenterCard({ booking, onRefresh }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notes, setNotes] = useState(booking.portal_notes || '');
  const c = booking.customers;
  const v = booking.vehicles;
  const url = portalUrl(booking.booking_code);

  function copyLogin() {
    const text = `Booking code: ${booking.booking_code}\nEmail: ${c?.email || ''}\nPortal: ${url}`;
    navigator.clipboard.writeText(text);
    setCopied('login');
    setTimeout(() => setCopied(''), 2000);
  }

  function copyPortal() {
    navigator.clipboard.writeText(url);
    setCopied('link');
    setTimeout(() => setCopied(''), 2000);
  }

  async function saveNotes() {
    setSavingNotes(true);
    try {
      await api.updateBooking(booking.id, { portal_notes: notes });
      onRefresh();
    } catch { /* ignore */ }
    setSavingNotes(false);
  }

  return (
    <div className="card p-4 sm:p-5 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-semibold text-[var(--text-primary)]">
              {c ? `${c.first_name} ${c.last_name}` : 'Customer'}
            </p>
            <StatusBadge status={booking.status} size="xs" />
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            {v ? `${v.year} ${v.make} ${v.model}` : 'Vehicle'} · <span className="font-mono">{booking.booking_code}</span>
          </p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">
            {booking.pickup_date && booking.return_date
              ? `${format(parseISO(booking.pickup_date), 'MMM d, yyyy')} → ${format(parseISO(booking.return_date), 'MMM d, yyyy')}`
              : 'Dates TBD'}
            {booking.total_cost != null && (
              <> · <span className="tabular-nums font-medium">${Number(booking.total_cost).toFixed(2)}</span></>
            )}
          </p>
          {c?.email && <p className="text-xs text-[var(--text-tertiary)]">{c.email}{c.phone ? ` · ${c.phone}` : ''}</p>}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button type="button" className="btn-primary text-xs py-2" onClick={copyLogin}>
            {copied === 'login' ? <Check size={14} /> : <Copy size={14} />} Copy login
          </button>
          <button type="button" className="btn-secondary text-xs py-2" onClick={copyPortal}>
            {copied === 'link' ? <Check size={14} /> : <Copy size={14} />} Link only
          </button>
          <a href={url} target="_blank" rel="noreferrer" className="btn-ghost text-xs py-2">
            <ExternalLink size={14} /> Open
          </a>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-ghost text-xs py-1.5" onClick={() => navigate(`/bookings/${booking.id}`)}>
          Manage booking <ChevronRight size={12} className="inline" />
        </button>
        {c?.id && (
          <button type="button" className="btn-ghost text-xs py-1.5" onClick={() => navigate('/messaging', { state: { customerId: c.id } })}>
            <MessageSquare size={12} className="inline mr-1" /> Message
          </button>
        )}
        <button type="button" className="btn-ghost text-xs py-1.5" onClick={() => navigate(`/bookings/${booking.id}`, { state: { openExtend: true } })}>
          <CalendarPlus size={12} className="inline mr-1" /> Extend
        </button>
      </div>

      <div className="pt-2 border-t border-[var(--border-subtle)]">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Portal notes</label>
        <div className="flex gap-2 mt-1">
          <textarea
            className="input text-sm resize-none flex-1"
            rows={2}
            placeholder="Renewal terms, payment schedule, gate code…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
          <button type="button" className="btn-secondary text-xs shrink-0 self-end" disabled={savingNotes} onClick={saveNotes}>
            {savingNotes ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PortalPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('renters');
  const [renters, setRenters] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [onboardPrefill, setOnboardPrefill] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [bookRes, inq] = await Promise.all([
        api.getBookings({ rental_type: 'long_term', limit: 100 }),
        api.getMonthlyInquiries({ status: 'new' }).catch(() => []),
      ]);
      const list = Array.isArray(bookRes) ? bookRes : (bookRes?.data || []);
      setRenters(list.filter(b => ACTIVE_STATUSES.includes(b.status) || b.status === 'pending_approval'));
      setInquiries(Array.isArray(inq) ? inq : []);
    } catch (e) {
      setLoadError(e?.message || 'Could not load portal data');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const newLeadCount = inquiries.length;

  return (
    <div className="page-shell lg:p-8 space-y-6 pb-[calc(100px+env(safe-area-inset-bottom))] md:pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-[var(--text-primary)]">
            <DoorOpen size={24} className="text-[var(--accent-color)]" />
            Long-Term Portal
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-xl">
            Onboard long-term renters who are <strong>not in the system yet</strong> — no booking code needed. We create their record and portal login for you.
          </p>
        </div>
        <button type="button" className="btn-primary justify-center w-full sm:w-auto" onClick={() => { setOnboardPrefill(null); setOnboardOpen(true); }}>
          <UserPlus size={15} /> Onboard renter
        </button>
      </div>

      <DataError message={loadError} onRetry={load} />

      <div className="flex gap-1 overflow-x-auto border-b border-[var(--border-subtle)] pb-px">
        {[
          { key: 'renters', label: `Active renters (${renters.length})` },
          { key: 'leads', label: `New leads${newLeadCount ? ` (${newLeadCount})` : ''}` },
        ].map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`shrink-0 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
              tab === t.key
                ? 'text-[var(--accent-color)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] border-b-transparent -mb-px'
                : 'text-[var(--text-tertiary)]'
            }`}
          >
            {t.label}
          </button>
        ))}
        <button type="button" className="btn-ghost ml-auto shrink-0 py-2" onClick={load}>
          <RefreshCw size={14} />
        </button>
      </div>

      {loading ? (
        <SkeletonTable rows={4} cols={3} />
      ) : tab === 'renters' ? (
        renters.length === 0 ? (
          <div className="card p-10 text-center space-y-3">
            <DoorOpen size={32} className="mx-auto text-[var(--text-tertiary)]" />
            <p className="text-sm font-medium text-[var(--text-primary)]">No long-term renters yet</p>
            <p className="text-xs text-[var(--text-tertiary)] max-w-sm mx-auto">
              Use <strong>Onboard renter</strong> — enter their name, email, and vehicle. We generate their booking code and portal login.
            </p>
            <button type="button" className="btn-primary" onClick={() => setOnboardOpen(true)}>Onboard renter</button>
          </div>
        ) : (
          <div className="space-y-3">
            {renters.map(b => (
              <RenterCard key={b.id} booking={b} onRefresh={load} />
            ))}
          </div>
        )
      ) : (
        <div className="space-y-3">
          {inquiries.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)] text-center py-12">No new monthly inquiries.</p>
          ) : inquiries.map(inq => (
            <div key={inq.id} className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[var(--text-primary)]">{inq.name}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{inq.email} · {inq.phone}</p>
                {inq.message && <p className="text-sm text-[var(--text-secondary)] mt-1 line-clamp-2">{inq.message}</p>}
              </div>
              <button
                type="button"
                className="btn-primary text-xs shrink-0"
                onClick={() => {
                  const parts = (inq.name || '').trim().split(/\s+/);
                  setOnboardPrefill({
                    firstName: parts[0] || '',
                    lastName: parts.slice(1).join(' ') || '',
                    email: inq.email || '',
                    phone: inq.phone || '',
                  });
                  setOnboardOpen(true);
                }}
              >
                Onboard
              </button>
            </div>
          ))}
          <button type="button" className="btn-ghost text-xs w-full" onClick={() => navigate('/monthly-inquiries')}>
            View all monthly leads →
          </button>
        </div>
      )}

      <LongTermOnboardModal
        open={onboardOpen}
        onClose={() => setOnboardOpen(false)}
        onCreated={load}
        initialCustomer={onboardPrefill}
      />
    </div>
  );
}
