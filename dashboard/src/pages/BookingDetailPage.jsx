import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, Car, MapPin, CheckCircle, XCircle, Package, RotateCcw, Flag, DollarSign, FileText, Shield, CreditCard, User, ClipboardCheck, Receipt, Navigation, RefreshCw, AlertCircle, Loader2, FolderOpen, Download } from 'lucide-react';
import { api } from '../api/client';
import { bonzahApi } from '../api/bonzah';
import { supabase } from '../auth/supabaseClient';
import StatusBadge from '../components/shared/StatusBadge';
import { SkeletonDashboard } from '../components/shared/Skeleton';
import AgreementSection from '../components/shared/AgreementSection';
import BookingModals from '../components/shared/BookingModals';
import BookingTimeline from '../components/shared/BookingTimeline';
import Section from '../components/shared/Section';
import Field from '../components/shared/Field';
import CheckInPrepTab from '../components/booking-tabs/CheckInPrepTab';
import CheckOutTab from '../components/booking-tabs/CheckOutTab';
import InvoiceTab from '../components/booking-tabs/InvoiceTab';
import BookingActionBar from '../components/booking-tabs/BookingActionBar';
import DocumentsFolder from '../components/bookings/DocumentsFolder';
import { useAlerts } from '../lib/alertsContext';
import { format } from 'date-fns';

/* ────────────────────────────────────────────────────────
   Tab Configuration
   ──────────────────────────────────────────────────────── */
const TABS = [
  { id: 'overview',   label: 'Overview',   icon: FileText    },
  { id: 'checkin',    label: 'Check-In',   icon: Package     },
  { id: 'checkout',   label: 'Check-Out',  icon: ClipboardCheck },
  { id: 'invoice',    label: 'Invoice',    icon: Receipt     },
  { id: 'documents',  label: 'Documents',  icon: FolderOpen  },
];

/* ────────────────────────────────────────────────────────
   ID Photo Gallery — handles new multi-path + legacy single URL
   ──────────────────────────────────────────────────────── */
const BASE_API = import.meta.env.VITE_API_URL || '/api/v1';

function IdPhotoGallery({ paths, legacyUrl, onView }) {
  const [signedUrls, setSignedUrls] = useState({});
  const [loading, setLoading] = useState({});
  const [legacySignedUrl, setLegacySignedUrl] = useState(null);

  // Pre-fetch signed URLs on mount so the photos render inline (no click-to-load).
  // Click-to-zoom is preserved via the lightbox.
  useEffect(() => {
    if (!paths?.length) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        await Promise.all(paths.map(async (path, idx) => {
          setLoading(prev => ({ ...prev, [idx]: true }));
          try {
            const res = await fetch(
              `${BASE_API}/uploads/signed-url?bucket=id-photos&path=${encodeURIComponent(path)}`,
              { headers: token ? { Authorization: `Bearer ${token}` } : {} }
            );
            const { url } = await res.json();
            if (!cancelled) setSignedUrls(prev => ({ ...prev, [idx]: url }));
          } catch { /* silent */ }
          finally {
            if (!cancelled) setLoading(prev => ({ ...prev, [idx]: false }));
          }
        }));
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [JSON.stringify(paths)]);

  // If legacyUrl is a storage path (not a URL), sign it on demand
  useEffect(() => {
    if (!legacyUrl || paths?.length > 0) return;
    // Already a full URL — use as-is
    if (legacyUrl.startsWith('http')) {
      setLegacySignedUrl(legacyUrl);
      return;
    }
    // It's a storage path — sign it
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch(
          `${BASE_API}/uploads/signed-url?bucket=id-photos&path=${encodeURIComponent(legacyUrl)}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        const { url } = await res.json();
        if (!cancelled) setLegacySignedUrl(url);
      } catch { if (!cancelled) setLegacySignedUrl(legacyUrl); }
    })();
    return () => { cancelled = true; };
  }, [legacyUrl, paths?.length]);

  // New system: array of storage paths — render inline, click to enlarge
  if (paths?.length > 0) {
    const labels = ['Front', 'Back'];
    return (
      <div className="flex flex-wrap gap-3">
        {paths.map((_path, idx) => (
          <div key={idx} className="flex flex-col items-start gap-1">
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">{labels[idx] ?? `Photo ${idx + 1}`}</span>
            <button
              type="button"
              onClick={() => signedUrls[idx] && onView(signedUrls[idx])}
              disabled={!signedUrls[idx]}
              title={signedUrls[idx] ? 'Click to enlarge' : 'Loading…'}
              className="h-32 w-48 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-hover)] flex items-center justify-center overflow-hidden hover:opacity-90 hover:shadow-md transition-all cursor-pointer disabled:cursor-wait"
            >
              {loading[idx] && !signedUrls[idx] ? (
                <span className="text-xs animate-pulse text-[var(--text-secondary)]">Loading…</span>
              ) : signedUrls[idx] ? (
                <img src={signedUrls[idx]} alt={`License ${labels[idx] ?? idx + 1}`} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-[var(--text-tertiary)]">Unavailable</span>
              )}
            </button>
          </div>
        ))}
      </div>
    );
  }

  // Legacy/path: single stored value (could be pre-signed URL or storage path)
  if (legacyUrl) {
    return (
      <div>
        {legacySignedUrl ? (
          <button onClick={() => onView(legacySignedUrl)} className="cursor-pointer" title="Click to enlarge">
            <img
              src={legacySignedUrl}
              alt="Customer photo ID"
              className="h-32 w-auto rounded-lg border border-[var(--border-subtle)] object-cover hover:opacity-80 hover:shadow-md transition-all"
            />
          </button>
        ) : (
          <div className="h-32 w-48 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-hover)] flex items-center justify-center">
            <span className="text-xs animate-pulse text-[var(--text-secondary)]">Loading…</span>
          </div>
        )}
      </div>
    );
  }

  return null;
}

/* ────────────────────────────────────────────────────────
   Condition Photos — admin & customer × check-in / check-out
   ──────────────────────────────────────────────────────── */
function ConditionPhotosSection({ records, onView }) {
  if (!Array.isArray(records) || records.length === 0) return null;

  // Group records by source × phase. Multiple records of the same type are
  // merged photo-wise so we always show every photo across the booking.
  const groups = [
    { key: 'admin_in',     title: 'Admin · Check-In',    types: ['admin_prep', 'admin_handoff', 'admin_checkin'] },
    { key: 'customer_in',  title: 'Customer · Check-In', types: ['customer_checkin'] },
    { key: 'admin_out',    title: 'Admin · Check-Out',   types: ['admin_inspection', 'admin_checkout'] },
    { key: 'customer_out', title: 'Customer · Check-Out', types: ['customer_checkout'] },
  ];

  const collected = groups.map(g => {
    const matched = records.filter(r => g.types.includes(r.record_type));
    const photos = matched.flatMap(r => Array.isArray(r.photo_urls) ? r.photo_urls : []);
    const slotPhotos = matched.flatMap(r => {
      const slots = r.photo_slots && typeof r.photo_slots === 'object' ? r.photo_slots : {};
      return Object.values(slots).filter(Boolean);
    });
    const allPhotos = [...new Set([...photos, ...slotPhotos])];
    return { ...g, photos: allPhotos };
  });

  if (collected.every(g => g.photos.length === 0)) return null;

  return (
    <Section title="Condition Photos">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {collected.map(g => (
          <div key={g.key} className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-tertiary)]">{g.title}</p>
              <span className="text-[10px] text-[var(--text-tertiary)] tabular-nums">{g.photos.length}</span>
            </div>
            {g.photos.length === 0 ? (
              <p className="text-xs text-[var(--text-tertiary)] italic">No photos recorded</p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {g.photos.map((url, i) => (
                  <button
                    type="button"
                    key={`${g.key}-${i}`}
                    onClick={() => onView(url)}
                    title="Click to enlarge"
                    className="aspect-square rounded-lg overflow-hidden border border-[var(--border-subtle)] hover:opacity-80 transition-opacity cursor-pointer"
                  >
                    <img src={url} alt={`${g.title} ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ────────────────────────────────────────────────────────
   Main Component
   ──────────────────────────────────────────────────────── */
export default function BookingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [modalInput, setModalInput] = useState('');
  const [actioning, setActioning] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ payment_type: 'rental', amount: '', method: 'cash', reference_id: '', notes: '' });
  const [conditionForm, setConditionForm] = useState({ fuel: 'full', notes: '', photoUrl: '' });
  const [damageForm, setDamageForm] = useState({ description: '', severity: 'minor', estimated_cost: '', photo_url: '' });
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'overview');
  const [checkinRecords, setCheckinRecords] = useState([]);
  const { refresh: refreshAlerts } = useAlerts();

  // Insurance review state
  const [insuranceActioning, setInsuranceActioning] = useState(false);
  const [insuranceError, setInsuranceError] = useState(null);
  const [insuranceRejectReason, setInsuranceRejectReason] = useState('');
  // Admin override for the "can't pick up an unpaid booking" server guard —
  // used for in-person cash/terminal payments recorded separately.
  const [pickupOverride, setPickupOverride] = useState({ enabled: false, reason: '' });

  const load = async () => {
    setLoading(true);
    try {
      const b = await api.getBooking(id);
      // Normalize rental_agreements — Supabase returns object for 1:1, array for 1:many
      if (b && b.rental_agreements && !Array.isArray(b.rental_agreements)) {
        b.rental_agreements = [b.rental_agreements];
      }
      setBooking(b);
      // Pull the four condition records (admin/customer × in/out) so we can
      // surface them in a dedicated photos section below the booking detail.
      try {
        const records = await api.getCheckinRecords(id);
        setCheckinRecords(Array.isArray(records) ? records : []);
      } catch { /* non-fatal */ }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  // Clear any stale action error whenever the open modal changes (opening a
  // different action or closing). A failure leaves `modal` unchanged, so this
  // never wipes the error the user needs to see.
  useEffect(() => { setActionError(null); }, [modal]);

  async function doAction(action) {
    setActioning(true);
    setActionError(null);
    try {
      if (action === 'approve')  await api.approveBooking(id);
      if (action === 'decline')  await api.declineBooking(id, modalInput);
      if (action === 'cancel')   await api.cancelBooking(id, modalInput);
      if (action === 'pickup')   await api.recordPickup(id, {
        mileage: modalInput,
        fuel_level: conditionForm.fuel,
        condition_notes: conditionForm.notes || undefined,
        photos: conditionForm.photoUrl ? [conditionForm.photoUrl] : [],
        override_payment: pickupOverride.enabled || undefined,
        override_reason: pickupOverride.enabled ? (pickupOverride.reason || undefined) : undefined,
      });
      if (action === 'return')   await api.recordReturn(id, {
        mileage: modalInput,
        fuel_level: conditionForm.fuel,
        condition_notes: conditionForm.notes || undefined,
        photos: conditionForm.photoUrl ? [conditionForm.photoUrl] : [],
      });
      if (action === 'complete') await api.completeBooking(id);
      if (action === 'payment')  await api.recordPayment(id, paymentForm);
      if (action === 'damage')   await api.fileDamageReport(id, damageForm);
      // Reload booking + dashboard alert badges in parallel so the top-bar
      // pills, sidebar badges, and detail page all reflect the new state.
      await Promise.all([load(), refreshAlerts()]);
      // Success — close the modal and reset its forms.
      setModal(null);
      setModalInput('');
      setConditionForm({ fuel: 'full', notes: '', photoUrl: '' });
      setDamageForm({ description: '', severity: 'minor', estimated_cost: '', photo_url: '' });
      setPickupOverride({ enabled: false, reason: '' });
    } catch (e) {
      // Keep the modal open and tell the user — previously this swallowed the
      // error and closed the modal as if the action had succeeded.
      console.error(e);
      setActionError(e?.data?.error || 'That action could not be completed. Please try again.');
    } finally {
      setActioning(false);
    }
  }

  async function handleInsuranceAction(action) {
    setInsuranceActioning(true);
    setInsuranceError(null);
    try {
      if (action === 'approve') {
        await api.approveInsurance(id);
      } else {
        await api.rejectInsurance(id, insuranceRejectReason);
      }
      setInsuranceRejectReason('');
      // Refetch so the banner reflects the new insurance_status — a successful
      // approve/reject moves it off 'pending_review' and dismisses this banner.
      await Promise.all([load(), refreshAlerts()]);
    } catch (e) {
      // Previously this only hit console.error, so a failed request left the
      // spinner-then-nothing symptom with no on-screen feedback. Surface it.
      console.error(`Insurance ${action} failed:`, e);
      setInsuranceError(e?.data?.error || `Could not ${action === 'approve' ? 'approve' : 'reject'} insurance. Please try again.`);
    } finally {
      setInsuranceActioning(false);
    }
  }

  if (loading) return <SkeletonDashboard />;
  if (!booking) return <div className="p-6 text-[var(--text-secondary)]">Booking not found</div>;

  const { status, customers: c, vehicles: v } = booking;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/bookings')} className="btn-ghost py-1.5 px-2">
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tabular-nums mono-code tracking-tight">{booking.booking_code}</h1>
              <StatusBadge status={status} />
            </div>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              Created {format(new Date(booking.created_at), 'MMM d, yyyy h:mm a')}
            </p>
          </div>
        </div>

        {/* Contextual action buttons */}
        <div className="flex flex-wrap gap-2 shrink-0 w-full sm:w-auto">
          {status === 'pending_approval' && (
            <>
              <button onClick={() => setModal('approve')} className="btn-primary">
                <CheckCircle size={15} /> Approve
              </button>
              <button onClick={() => setModal('decline')} className="btn-danger">
                <XCircle size={15} /> Decline
              </button>
            </>
          )}
          {['approved', 'confirmed'].includes(status) && (
            <button onClick={() => setActiveTab('checkin')} className="btn-primary">
              <Package size={15} /> Go to Check-In
            </button>
          )}
          {status === 'active' && (
            <button onClick={() => setActiveTab('checkout')} className="btn-primary">
              <RotateCcw size={15} /> Go to Check-Out
            </button>
          )}
          {status === 'returned' && (
            <button onClick={() => setActiveTab('checkout')} className="btn-primary">
              <ClipboardCheck size={15} /> Continue Check-Out
            </button>
          )}
          {['pending_approval', 'approved', 'confirmed', 'ready_for_pickup', 'active'].includes(status) && (
            <button onClick={() => setModal('cancel')} className="btn-ghost text-[var(--danger-color)]">
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Action-needed banner */}
      {(() => {
        const ag = booking.rental_agreements?.[0];
        const needsCounterSign = ag?.customer_signed_at && !ag?.owner_signed_at;
        const needsPayment = status === 'approved' && booking.deposit_status !== 'paid';
        
        if (needsCounterSign) {
          return (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center shrink-0">
                <FileText size={18} className="text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">Your Counter-Signature Is Needed</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  The customer has signed the rental agreement. Scroll down to the Rental Agreement section to counter-sign and activate this rental.
                </p>
              </div>
              <button
                onClick={() => document.querySelector('[data-section="agreement"]')?.scrollIntoView({ behavior: 'smooth' })}
                className="btn-primary text-xs shrink-0"
              >
                <FileText size={14} /> Counter-Sign Now
              </button>
            </div>
          );
        }

        if (needsPayment) {
          return (
            <div className="bg-[rgba(99,179,237,0.07)] border border-[rgba(99,179,237,0.15)] rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-[rgba(99,179,237,0.15)] rounded-full flex items-center justify-center shrink-0">
                <CreditCard size={18} className="text-[#63b3ed]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#63b3ed]">Waiting for Customer Payment</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Booking has been approved. The customer needs to complete payment of ${booking.total_cost} to proceed.
                </p>
              </div>
            </div>
          );
        }

        return null;
      })()}

      {/* Insurance review banner — shown when a customer submits own insurance for admin review */}
      {booking.insurance_status === 'pending_review' && (() => {
        const ag = booking.rental_agreements?.[0];
        return (
          <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(251,191,36,0.15)' }}>
                <Shield size={18} className="text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">Insurance Review Required</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  The customer submitted their own insurance details for review. Please verify the information below and approve or reject.
                </p>
              </div>
            </div>
            {ag && (
              <div className="grid sm:grid-cols-2 gap-2 pl-[52px]">
                {ag.insurance_company && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-tertiary)' }}>Company</p>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{ag.insurance_company}</p>
                  </div>
                )}
                {ag.insurance_policy_number && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-tertiary)' }}>Policy Number</p>
                    <p className="text-sm font-medium font-mono" style={{ color: 'var(--text-primary)' }}>{ag.insurance_policy_number}</p>
                  </div>
                )}
                {ag.insurance_expiry && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-tertiary)' }}>Expiry</p>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{ag.insurance_expiry}</p>
                  </div>
                )}
                {ag.insurance_agent_name && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-tertiary)' }}>Agent</p>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{ag.insurance_agent_name} {ag.insurance_agent_phone ? `· ${ag.insurance_agent_phone}` : ''}</p>
                  </div>
                )}
                {!ag.insurance_company && !ag.insurance_policy_number && (
                  <p className="text-xs italic" style={{ color: 'var(--text-tertiary)' }}>No insurance details provided yet — customer may still be completing the booking wizard.</p>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 pl-[52px] pt-1">
              <button
                onClick={() => handleInsuranceAction('approve')}
                disabled={insuranceActioning}
                className="btn-primary text-xs"
              >
                {insuranceActioning ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                Approve Insurance
              </button>
              <button
                onClick={() => handleInsuranceAction('reject')}
                disabled={insuranceActioning}
                className="btn-danger text-xs"
              >
                <XCircle size={13} /> Reject
              </button>
            </div>
            {insuranceError && (
              <p className="text-xs text-red-500 pl-[52px]">{insuranceError}</p>
            )}
          </div>
        );
      })()}

      {/* ── Tab Navigation ──────────────────────────────────────────── */}
      {/* Sprint 8: mobile = 4 equal-width grid with icon stacked above label
          (Material Design tab pattern). Desktop = original horizontal scroll
          with icon-left-of-label. .tap-target ensures every tab is 44+ px
          tall on touch. */}
      <div className="grid grid-cols-4 md:flex md:gap-1 md:overflow-x-auto pb-0 md:pb-1 border-b border-[var(--border-subtle)]">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`tap-target flex flex-col md:flex-row items-center justify-center gap-1 md:gap-1.5 px-2 md:px-4 py-3 md:py-2.5 text-[11px] md:text-sm font-medium md:rounded-t-lg transition-all whitespace-nowrap relative ${
                isActive
                  ? 'text-[var(--accent-color)] md:bg-[var(--bg-elevated)] md:border md:border-[var(--border-subtle)] md:border-b-transparent md:-mb-px'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
              }`}
            >
              <Icon size={18} className="md:!w-[14px] md:!h-[14px]" />
              <span>{tab.label}</span>
              {/* Mobile-only active indicator bar (md+ uses the bordered tab look) */}
              {isActive && (
                <span
                  className="md:hidden absolute bottom-0 inset-x-2 h-[2px] rounded-t"
                  style={{ backgroundColor: 'var(--accent-color)' }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ─────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <OverviewTab booking={booking} c={c} v={v} id={id} load={load}
          setModal={setModal} setPaymentForm={setPaymentForm}
          setLightboxUrl={setLightboxUrl}
          checkinRecords={checkinRecords}
        />
      )}

      {/* Tab content — z-10 so dropdowns float above the agreement section */}
      <div className="relative" style={{ zIndex: 10 }}>
        {activeTab === 'checkin' && (
          <CheckInPrepTab booking={booking} onReload={load} />
        )}

        {activeTab === 'checkout' && (
          <CheckOutTab booking={booking} onReload={load} />
        )}

        {activeTab === 'invoice' && (
          <InvoiceTab booking={booking} onReload={load} />
        )}

        {activeTab === 'documents' && (
          <BookingDocumentsTab booking={booking} id={id} />
        )}
      </div>

      {/* Rental Agreement (always visible below tabs) */}
      <div className="relative" style={{ zIndex: 0 }}>
        <AgreementSection bookingId={id} />
      </div>

      {/* Timeline (always visible below tabs) */}
      <Section title="Status Timeline">
        <BookingTimeline logs={booking.booking_status_log} />
      </Section>

      {/* Action modals */}
      <BookingModals
        booking={booking}
        modal={modal} setModal={setModal}
        modalInput={modalInput} setModalInput={setModalInput}
        conditionForm={conditionForm} setConditionForm={setConditionForm}
        damageForm={damageForm} setDamageForm={setDamageForm}
        paymentForm={paymentForm} setPaymentForm={setPaymentForm}
        pickupOverride={pickupOverride} setPickupOverride={setPickupOverride}
        actioning={actioning} doAction={doAction} actionError={actionError}
      />

      {/* Sprint 8b: phone-only sticky bottom CTA — single primary action per
          booking state. Triggers the existing setModal flow so all existing
          modals (decline reason, pickup mileage, return condition, etc.)
          remain the source of truth. Hidden at md+. */}
      <BookingActionBar
        status={status}
        onAction={(action) => setModal(action)}
        disabled={actioning}
      />

      {/* Photo Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-zoom-out"
          onClick={() => setLightboxUrl(null)}
          onKeyDown={e => e.key === 'Escape' && setLightboxUrl(null)}
          role="dialog"
          aria-label="Photo viewer"
          tabIndex={-1}
        >
          <img
            src={lightboxUrl}
            alt="Customer photo ID — full size"
            className="max-h-[85vh] max-w-[90vw] rounded-2xl shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
          <button
            className="absolute top-6 right-6 text-white/70 hover:text-white text-2xl font-bold transition-colors"
            onClick={() => setLightboxUrl(null)}
            aria-label="Close photo viewer"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}


/* ────────────────────────────────────────────────────────
   Documents Tab — archived contracts + invoices for this booking,
   plus a one-click download of the current rental contract (renders
   even when unsigned, so the admin can print one to sign in person).
   ──────────────────────────────────────────────────────── */
function BookingDocumentsTab({ booking, id }) {
  const [downloading, setDownloading] = useState(false);
  const [err, setErr] = useState('');

  async function downloadLiveContract() {
    setDownloading(true); setErr('');
    try {
      const blob = await api.downloadAgreementPdf(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rental_Agreement_${booking?.booking_code || id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      setErr(e?.data?.error || e.message || 'Could not generate the contract.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Section title="Documents" icon={FolderOpen}>
        <DocumentsFolder bookingId={id} />
      </Section>
      <Section title="Generate Contract" icon={FileText}>
        <p className="text-sm text-[var(--text-secondary)] mb-3">
          Download the current rental contract for this booking — fully filled from the booking data.
          If it hasn't been signed yet, it prints with blank signature lines to complete by hand.
        </p>
        <button type="button" onClick={downloadLiveContract} disabled={downloading} className="btn-primary">
          {downloading ? <><Loader2 size={14} className="animate-spin" /> Preparing…</> : <><Download size={14} /> Download contract PDF</>}
        </button>
        {err && <p className="text-xs text-[#ef4444] mt-2">{err}</p>}
      </Section>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   Overview Tab — extracted from the original monolith
   ──────────────────────────────────────────────────────── */
function OverviewTab({ booking, c, v, id, load, setModal, setPaymentForm, setLightboxUrl, checkinRecords }) {
  return (
    <div className="grid md:grid-cols-2 gap-5">
      {/* Customer */}
      <Section title="Customer">
        <p className="font-semibold text-[var(--text-primary)]">{c?.first_name} {c?.last_name}</p>
        <div className="space-y-2">
          <a href={`tel:${c?.phone}`} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent-color)]">
            <Phone size={14} /> {c?.phone}
          </a>
          <a href={`mailto:${c?.email}`} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent-color)]">
            <Mail size={14} /> {c?.email}
          </a>
        </div>
        {c?.driver_license_number && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="DL Number" value={c.driver_license_number} />
            <Field label="DL State" value={c.driver_license_state} />
            <Field label="DL Expiry" value={c.driver_license_expiry} />
          </div>
        )}
      </Section>

      {/* Customer Documents */}
      {(() => {
        const ag = booking.rental_agreements?.[0];
        const hasDL = ag?.driver_license_number || c?.driver_license_number;
        const hasAddress = ag?.address_line1 || c?.address_line1;
        const hasIdPhoto = (ag?.license_photo_paths?.length > 0) || c?.id_photo_url;
        if (!hasDL && !hasAddress && !hasIdPhoto && !ag) return null;
        return (
          <Section title="Customer Documents">
            {hasDL && (
              <div>
                <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <CreditCard size={12} /> Driver's License
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="License Number" value={ag?.driver_license_number || c?.driver_license_number} />
                  <Field label="State" value={ag?.driver_license_state || c?.driver_license_state} />
                  <Field label="Expiry" value={ag?.driver_license_expiry || c?.driver_license_expiry} />
                  {(ag?.date_of_birth || c?.date_of_birth) && (
                    <Field label="Date of Birth" value={ag?.date_of_birth || c?.date_of_birth} />
                  )}
                </div>
              </div>
            )}
            {hasAddress && (
              <div className={hasDL ? 'pt-3 border-t border-[var(--border-subtle)]' : ''}>
                <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MapPin size={12} /> Address
                </p>
                <p className="text-sm text-[var(--text-primary)]">
                  {ag?.address_line1 || c?.address_line1}
                  {(ag?.city || c?.city) && `, ${ag?.city || c?.city}`}
                  {(ag?.state || c?.state) && `, ${ag?.state || c?.state}`}
                  {' '}{ag?.zip || c?.zip}
                </p>
              </div>
            )}
            {hasIdPhoto && (
              <div className={(hasDL || hasAddress) ? 'pt-3 border-t border-[var(--border-subtle)]' : ''}>
                <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <User size={12} /> Photo ID
                </p>
                <IdPhotoGallery
                  paths={ag?.license_photo_paths}
                  legacyUrl={c?.id_photo_url}
                  onView={setLightboxUrl}
                />
              </div>
            )}
          </Section>
        );
      })()}

      {/* Vehicle */}
      <Section title="Vehicle">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[var(--bg-card)] rounded-xl flex items-center justify-center">
            <Car size={18} className="text-[var(--text-secondary)]" />
          </div>
          <div>
            <p className="font-semibold text-[var(--text-primary)]">{v?.year} {v?.make} {v?.model}</p>
            <p className="text-xs text-[var(--text-tertiary)] font-mono">{v?.vehicle_code}</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Daily Rate" value={`$${booking.daily_rate}`} />
          <Field label="Rental Days" value={booking.rental_days} />
        </div>
        {(() => {
          const m = booking.special_requests?.match(/Rate preference:\s*(daily|weekly|monthly)/i);
          if (!m) return null;
          const pref = m[1].toLowerCase();
          const applied = booking.rate_type || '';
          const mismatch =
            (pref === 'weekly' && !applied.startsWith('weekly')) ||
            (pref === 'daily' && applied.startsWith('weekly')) ||
            pref === 'monthly';
          return (
            <div
              className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs"
              style={{
                backgroundColor: mismatch ? 'rgba(234,179,8,0.08)' : 'rgba(99,179,237,0.07)',
                color: mismatch ? '#a16207' : '#3182ce',
                border: `1px solid ${mismatch ? 'rgba(234,179,8,0.25)' : 'rgba(99,179,237,0.2)'}`,
              }}
            >
              <span>
                Customer chose <strong className="capitalize">{pref}</strong>
                {applied && ` · applied ${applied.replace('_', ' ')}`}
              </span>
              {mismatch && <span className="text-[10px] uppercase tracking-wider font-semibold">Mismatch — review</span>}
            </div>
          );
        })()}
      </Section>

      {/* Rental Details */}
      <Section title="Rental Details">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Check-In Date" value={format(new Date(booking.pickup_date), 'MMM d, yyyy')} />
          <Field label="Check-In Time" value={booking.pickup_time} />
          <Field label="Check-Out Date" value={format(new Date(booking.return_date), 'MMM d, yyyy')} />
          <Field label="Check-Out Time" value={booking.return_time} />
        </div>
        <div className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
          <MapPin size={14} className="mt-0.5 shrink-0" />
          {booking.pickup_location}
        </div>
        {booking.delivery_requested && (
          <p className="text-xs text-[#63b3ed] bg-[rgba(99,179,237,0.07)] px-3 py-1.5 rounded-lg">
            Delivery requested: {booking.delivery_address}
          </p>
        )}
      </Section>

      {/* Pricing */}
      <Section title="Pricing">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-[var(--text-secondary)]">
            <span>${booking.daily_rate}/day × {booking.rental_days}d</span>
            <span>${booking.subtotal}</span>
          </div>
          {booking.delivery_fee > 0 && (
            <div className="flex justify-between text-[var(--text-secondary)]">
              <span>Delivery fee</span>
              <span>${booking.delivery_fee}</span>
            </div>
          )}
          {booking.discount_amount > 0 && (
            <div className="flex justify-between text-[#22c55e]">
              <span>Discount</span>
              <span>-${booking.discount_amount}</span>
            </div>
          )}
          {Number(booking.mileage_addon_fee) > 0 && (
            <div className="flex justify-between text-[var(--text-secondary)]">
              <span>Unlimited Miles</span>
              <span>${booking.mileage_addon_fee}</span>
            </div>
          )}
          {Number(booking.toll_addon_fee) > 0 && (
            <div className="flex justify-between text-[var(--text-secondary)]">
              <span>Unlimited Tolls</span>
              <span>${booking.toll_addon_fee}</span>
            </div>
          )}
          <div className="flex justify-between text-[var(--text-secondary)]">
            <span>Tax</span>
            <span>${booking.tax_amount}</span>
          </div>
          <div className="flex justify-between font-semibold text-[var(--text-primary)] pt-1.5 border-t border-[var(--border-subtle)]">
            <span>Total</span>
            <span>${booking.total_cost}</span>
          </div>
          <div className="flex justify-between text-[var(--text-secondary)]">
            <span>Deposit</span>
            <span>${booking.deposit_amount} ({booking.deposit_status})</span>
          </div>
        </div>
      </Section>

      {/* Insurance */}
      <BookingInsuranceSection booking={booking} bookingId={id} reload={load} />

      {/* Payments */}
      <Section title="Payments">
        {booking.payments?.length > 0 ? (
          <div className="space-y-2">
            {booking.payments.map(p => (
              <div key={p.id} className="flex justify-between text-sm py-1.5 border-b border-[var(--border-subtle)] last:border-0">
                <div>
                  <p className="font-medium text-[var(--text-primary)] capitalize">{p.payment_type} ({p.method})</p>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                    {p.created_at && <span>{new Date(p.created_at).toLocaleDateString()}</span>}
                    {p.reference_id && <span className="mono-code">{p.reference_id}</span>}
                  </div>
                </div>
                <span className={`font-semibold tabular-nums ${p.payment_type === 'refund' ? 'text-[var(--danger-color)]' : 'text-[#22c55e]'}`}>
                  {p.payment_type === 'refund' ? '-' : '+'}${Math.abs(Number(p.amount)).toFixed(2)}
                </span>
              </div>
            ))}
            <div className="flex justify-between pt-2 text-sm font-semibold text-[var(--text-primary)]">
              <span>Total Paid</span>
              <span className="tabular-nums">
                ${booking.payments.reduce((sum, p) => sum + (p.payment_type === 'refund' ? -Number(p.amount) : Number(p.amount)), 0).toFixed(2)}
              </span>
            </div>
            {booking.total_cost && (
              <div className="flex justify-between text-xs text-[var(--text-tertiary)]">
                <span>Balance remaining</span>
                <span className="tabular-nums">
                  ${(Number(booking.total_cost) - booking.payments.reduce((sum, p) => sum + (p.payment_type === 'refund' ? -Number(p.amount) : Number(p.amount)), 0)).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-tertiary)]">No payments recorded</p>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => { setPaymentForm(p => ({ ...p, payment_type: 'rental' })); setModal('payment'); }}
            className="btn-secondary flex-1 justify-center"
          >
            <DollarSign size={14} /> Record Payment
          </button>
          <button
            onClick={() => { setPaymentForm(p => ({ ...p, payment_type: 'refund', amount: '' })); setModal('payment'); }}
            className="btn-ghost flex-1 justify-center text-[var(--danger-color)] hover:bg-[var(--danger-glow)]"
          >
            Issue Refund
          </button>
        </div>
      </Section>

      {/* Vehicle Condition */}
      {(booking.pickup_mileage || booking.return_mileage) && (
        <Section title="Vehicle Condition">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Check-In Mileage" value={booking.pickup_mileage} />
            <Field label="Check-In Fuel" value={booking.pickup_fuel_level} />
            <Field label="Check-Out Mileage" value={booking.return_mileage} />
            <Field label="Check-Out Fuel" value={booking.return_fuel_level} />
          </div>
          {booking.pickup_condition_notes && <Field label="Check-In Notes" value={booking.pickup_condition_notes} />}
          {booking.return_condition_notes && <Field label="Check-Out Notes" value={booking.return_condition_notes} />}
        </Section>
      )}

      {/* Condition Photos — admin/customer × check-in/check-out */}
      <ConditionPhotosSection records={checkinRecords} onView={setLightboxUrl} />

      {/* Notes */}
      <Section title="Notes">
        {booking.special_requests && (
          <div>
            <p className="text-xs text-[var(--text-tertiary)] mb-1">Customer requests</p>
            <p className="text-sm text-[var(--text-secondary)]">{booking.special_requests}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-[var(--text-tertiary)] mb-1">Internal notes (private)</p>
          <textarea
            className="input resize-none text-xs"
            rows={3}
            defaultValue={booking.internal_notes || ''}
            placeholder="Add private notes here…"
            onBlur={async e => {
              if (e.target.value !== booking.internal_notes) {
                await api.updateBooking(id, { internal_notes: e.target.value });
              }
            }}
          />
        </div>
      </Section>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   Insurance Section — Bonzah live panel + own-insurance fallback
   ──────────────────────────────────────────────────────── */
function BookingInsuranceSection({ booking, bookingId, reload }) {
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [downloadingCoverage, setDownloadingCoverage] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [policyOverride, setPolicyOverride] = useState(booking.insurance_policy_number || booking.bonzah_policy_id || '');

  const isBonzah = booking.insurance_provider === 'bonzah';
  const isOwn = booking.insurance_provider === 'own';
  const hasPolicy = !!booking.bonzah_policy_id;
  const isCancelled = booking.insurance_status === 'cancelled';
  const isBindFailed = booking.insurance_status === 'bind_failed';

  // Coverage info from the most recent quote/poll snapshot
  const coverages = Array.isArray(booking.bonzah_coverage_json) ? booking.bonzah_coverage_json : [];

  const tierLabel = booking.bonzah_tier_id
    ? booking.bonzah_tier_id.charAt(0).toUpperCase() + booking.bonzah_tier_id.slice(1)
    : null;

  const premium = booking.bonzah_premium_cents != null ? booking.bonzah_premium_cents / 100 : null;
  const markup = booking.bonzah_markup_cents != null ? booking.bonzah_markup_cents / 100 : null;
  const totalCharged = booking.bonzah_total_charged_cents != null ? booking.bonzah_total_charged_cents / 100 : null;

  async function handleRefresh() {
    setRefreshing(true);
    setError('');
    try {
      await bonzahApi.refreshBookingPolicy(bookingId);
      await reload();
    } catch (e) {
      setError(`Refresh failed: ${e.message}`);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleCancel() {
    if (!window.confirm(
      'Cancel this Bonzah policy?\n\nThis files a cancel endorsement with Bonzah. ' +
      'Refund (if any) goes to Annie\'s broker credit — NOT the customer. ' +
      'Underwriter approval is async; the polling job will pick up the final status.'
    )) return;

    setCancelling(true);
    setError('');
    try {
      await bonzahApi.cancelBookingPolicy(bookingId, 'Cancelled manually from booking detail page');
      await reload();
    } catch (e) {
      setError(`Cancel failed: ${e.message}`);
    } finally {
      setCancelling(false);
    }
  }

  async function handleSaveOverride() {
    try {
      await api.updateInsuranceStatus(bookingId, booking.insurance_status, policyOverride);
      setEditing(false);
      await reload();
    } catch (e) {
      setError(`Save failed: ${e.message}`);
    }
  }

  async function handleDownloadPdf(coverage) {
    setDownloadingCoverage(coverage);
    setError('');
    try {
      await bonzahApi.downloadBookingPdf(bookingId, coverage);
    } catch (e) {
      setError(`PDF download failed: ${e.message}`);
    } finally {
      setDownloadingCoverage(null);
    }
  }

  // Derive opted coverages from the snapshot. Each coverage_information item has
  // optional_addon_cover_name like "Collision Damage Waiver (CDW)" — pattern match.
  const optedCoverages = [];
  const COVERAGE_DETECT = [
    { code: 'cdw',  match: /\bCDW\b/i,  label: 'CDW' },
    { code: 'rcli', match: /\bRCLI\b/i, label: 'RCLI' },
    { code: 'sli',  match: /\bSLI\b/i,  label: 'SLI' },
    { code: 'pai',  match: /\bPAI\b/i,  label: 'PAI' },
  ];
  for (const cov of COVERAGE_DETECT) {
    const opted = coverages.some(c =>
      cov.match.test(c.optional_addon_cover_name || '') ||
      cov.match.test(c.optional_addon_code || '')
    );
    if (opted) optedCoverages.push(cov);
  }

  return (
    <Section title="Insurance">
      {/* Header row: provider + status + action buttons */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="grid sm:grid-cols-2 gap-3 flex-1 min-w-0">
          <div>
            <p className="text-xs text-[var(--text-tertiary)]">Provider</p>
            <p className="text-sm font-medium text-[var(--text-primary)] mt-0.5 flex items-center gap-2">
              {isBonzah ? 'Bonzah' : isOwn ? "Customer's Own" : booking.insurance_provider || '—'}
              {tierLabel && (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[rgba(70,95,255,0.15)] text-[#465FFF]">
                  {tierLabel}
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-tertiary)]">Status</p>
            <select
              className="input text-sm mt-0.5"
              value={booking.insurance_status || 'pending'}
              onChange={async e => {
                await api.updateInsuranceStatus(bookingId, e.target.value);
                await reload();
              }}
            >
              {['pending', 'active', 'cancelled', 'bind_failed', 'expired', 'declined', 'not_required', 'external'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {hasPolicy && (
          <div className="flex flex-col gap-2 shrink-0">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)] transition-colors flex items-center gap-1.5"
            >
              {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Refresh from Bonzah
            </button>
            {!isCancelled && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[rgba(239,68,68,0.3)] text-[#ef4444] hover:bg-[rgba(239,68,68,0.06)] transition-colors flex items-center gap-1.5"
              >
                {cancelling ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                Cancel Policy
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bind-failed alert */}
      {isBindFailed && (
        <div className="mt-3 rounded-lg p-3 text-xs flex items-start gap-2 bg-[rgba(239,68,68,0.07)] border border-[rgba(239,68,68,0.2)] text-[#ef4444]">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Bind failed</p>
            <p className="opacity-80 mt-0.5">Customer was charged via Stripe but Bonzah did not issue a policy. Manual reconciliation required — check the Settings → Integrations event log for the underlying error.</p>
          </div>
        </div>
      )}

      {/* Error feedback */}
      {error && (
        <div className="mt-3 rounded-lg p-2 text-xs bg-[rgba(239,68,68,0.07)] border border-[rgba(239,68,68,0.2)] text-[#ef4444]">
          {error}
        </div>
      )}

      {/* Bonzah policy details panel */}
      {isBonzah && hasPolicy && (
        <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Policy #" value={booking.bonzah_policy_no || '—'} />
            <Field label="Policy ID" value={booking.bonzah_policy_id} />
            {premium != null && <Field label="Premium (Bonzah base)" value={`$${premium.toFixed(2)}`} />}
            {markup != null && <Field label="Markup (Annie's)" value={`$${markup.toFixed(2)}`} />}
            {totalCharged != null && <Field label="Total charged" value={`$${totalCharged.toFixed(2)}`} />}
            <Field
              label="Last synced"
              value={booking.bonzah_last_synced_at
                ? format(new Date(booking.bonzah_last_synced_at), 'MMM d, h:mm a')
                : 'Never'}
            />
          </div>

          {coverages.length > 0 && (
            <div>
              <p className="text-xs text-[var(--text-tertiary)] mb-1.5">Coverage details</p>
              <div className="space-y-1">
                {coverages.map((c, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] text-xs">
                    <span className="font-medium text-[var(--text-primary)]">
                      {c.optional_addon_cover_name || c.optional_addon_type || c.optional_addon_code || c.cover_type || 'Coverage'}
                    </span>
                    <span className="font-mono text-[var(--text-tertiary)] text-[10px]">
                      {c.optional_addon_premium != null && `$${c.optional_addon_premium}`}
                      {c.cover_limit && ` · ${c.cover_limit}`}
                      {c.deductible && ` · deductible ${c.deductible}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {optedCoverages.length > 0 && (
            <div>
              <p className="text-xs text-[var(--text-tertiary)] mb-1.5">Policy documents</p>
              <div className="flex flex-wrap gap-2">
                {optedCoverages.map(cov => (
                  <button
                    key={cov.code}
                    onClick={() => handleDownloadPdf(cov.code)}
                    disabled={downloadingCoverage === cov.code}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)] transition-colors flex items-center gap-1.5"
                  >
                    {downloadingCoverage === cov.code ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                    {cov.label} PDF
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Manual override (legacy / fix-up) */}
          <div>
            <button
              type="button"
              onClick={() => setEditing(!editing)}
              className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] underline"
            >
              {editing ? 'Cancel edit' : 'Edit policy # manually (legacy override)'}
            </button>
            {editing && (
              <div className="flex gap-2 mt-2">
                <input
                  className="input text-sm flex-1"
                  value={policyOverride}
                  onChange={e => setPolicyOverride(e.target.value)}
                  placeholder="Policy number"
                />
                <button
                  onClick={handleSaveOverride}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#465FFF] text-white hover:opacity-90"
                >
                  Save
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Customer-provided own-policy details */}
      {booking.rental_agreements?.length > 0 &&
        booking.rental_agreements[0].insurance_company && (
        <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
          <p className="text-sm font-medium text-[var(--text-primary)] mb-3">
            {isOwn ? 'Customer Provided Details' : 'Customer-Provided Details (also on file)'}
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Company" value={booking.rental_agreements[0].insurance_company} />
            <Field label="Policy #" value={booking.rental_agreements[0].insurance_policy_number} />
            <Field label="Expiry" value={booking.rental_agreements[0].insurance_expiry} />
            {booking.rental_agreements[0].insurance_agent_name && (
              <Field label="Agent" value={booking.rental_agreements[0].insurance_agent_name} />
            )}
            {booking.rental_agreements[0].insurance_agent_phone && (
              <Field label="Agent Phone" value={booking.rental_agreements[0].insurance_agent_phone} />
            )}
          </div>
        </div>
      )}
    </Section>
  );
}
