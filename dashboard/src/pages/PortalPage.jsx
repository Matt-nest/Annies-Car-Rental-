import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DoorOpen, UserPlus, Search, Copy, Check, ExternalLink, CalendarPlus,
  MessageSquare, ChevronRight, Loader2, RefreshCw,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { api } from '../api/client';
import brand from '../config/brand';
import StatusBadge from '../components/shared/StatusBadge';
import DataError from '../components/shared/DataError';
import InlineBanner from '../components/shared/InlineBanner';
import Modal from '../components/shared/Modal';
import { SkeletonTable } from '../components/shared/Skeleton';
import LongTermOnboardModal from '../components/portal/LongTermOnboardModal';

const ACTIVE_STATUSES = ['approved', 'confirmed', 'ready_for_pickup', 'active', 'returned'];

function portalUrl(code) {
  return `${brand.siteUrl}/portal?code=${encodeURIComponent(code)}`;
}

function RenterCard({ booking, onRefresh }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [notes, setNotes] = useState(booking.portal_notes || '');
  const c = booking.customers;
  const v = booking.vehicles;
  const url = portalUrl(booking.booking_code);

  async function saveNotes() {
    setSavingNotes(true);
    try {
      await api.updateBooking(booking.id, { portal_notes: notes });
      onRefresh();
    } catch { /* ignore */ }
    setSavingNotes(false);
  }

  function copyPortal() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          <button type="button" className="btn-secondary text-xs py-2" onClick={copyPortal}>
            {copied ? <Check size={14} /> : <Copy size={14} />} Portal link
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

function PromoteModal({ open, onClose, onPromoted }) {
  const [code, setCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [match, setMatch] = useState(null);
  const [notes, setNotes] = useState('');
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    if (!open) { setCode(''); setMatch(null); setError(''); setNotes(''); }
  }, [open]);

  async function search() {
    if (!code.trim()) return;
    setSearching(true);
    setError('');
    setMatch(null);
    try {
      const res = await api.getBookings({ q: code.trim(), limit: 5 });
      const list = Array.isArray(res) ? res : (res?.data || []);
      const found = list.find(b => b.booking_code?.toUpperCase() === code.trim().toUpperCase()) || list[0];
      if (!found) setError('No booking found for that code.');
      else setMatch(found);
    } catch (e) {
      setError(e.message || 'Search failed');
    }
    setSearching(false);
  }

  async function promote() {
    if (!match) return;
    setPromoting(true);
    setError('');
    try {
      await api.markBookingLongTerm(match.id, { portal_notes: notes.trim() || undefined });
      onPromoted();
      onClose();
    } catch (e) {
      setError(e?.data?.error || e.message);
    }
    setPromoting(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="Add existing booking to Portal" maxWidth="max-w-md">
      <div className="space-y-4">
        <InlineBanner message={error} onDismiss={() => setError('')} />
        <p className="text-sm text-[var(--text-secondary)]">
          For renters already in the system — flag their booking as long-term and manage it here.
        </p>
        <div className="flex gap-2">
          <input
            className="input font-mono flex-1"
            placeholder="Booking code e.g. ACR-XXXX"
            value={code}
            onChange={e => setCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
          />
          <button type="button" className="btn-secondary" onClick={search} disabled={searching}>
            {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          </button>
        </div>
        {match && (
          <div className="rounded-xl p-3 text-sm" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
            <p className="font-semibold text-[var(--text-primary)]">
              {match.customers?.first_name} {match.customers?.last_name} — {match.booking_code}
            </p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              {match.vehicles?.year} {match.vehicles?.make} {match.vehicles?.model}
            </p>
          </div>
        )}
        <div>
          <label className="label">Notes (optional)</label>
          <textarea className="input resize-none" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <button type="button" className="btn-primary w-full justify-center" disabled={!match || promoting} onClick={promote}>
          {promoting ? <Loader2 size={16} className="animate-spin" /> : 'Add to long-term portal'}
        </button>
      </div>
    </Modal>
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
  const [promoteOpen, setPromoteOpen] = useState(false);
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
    <div className="p-6 lg:p-8 space-y-6 pb-[calc(100px+env(safe-area-inset-bottom))] md:pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-[var(--text-primary)]">
            <DoorOpen size={24} className="text-[var(--accent-color)]" />
            Long-Term Portal
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-xl">
            Onboard existing long-term renters, send portal links, and manage ongoing rentals in one place.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button type="button" className="btn-secondary justify-center flex-1 sm:flex-none" onClick={() => setPromoteOpen(true)}>
            <Search size={15} /> Add existing
          </button>
          <button type="button" className="btn-primary justify-center flex-1 sm:flex-none" onClick={() => { setOnboardPrefill(null); setOnboardOpen(true); }}>
            <UserPlus size={15} /> Onboard renter
          </button>
        </div>
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
              Onboard a new renter or add an existing booking to start managing them here.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
              <button type="button" className="btn-primary" onClick={() => setOnboardOpen(true)}>Onboard renter</button>
              <button type="button" className="btn-secondary" onClick={() => setPromoteOpen(true)}>Add existing booking</button>
            </div>
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
      <PromoteModal open={promoteOpen} onClose={() => setPromoteOpen(false)} onPromoted={load} />
    </div>
  );
}
