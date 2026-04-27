import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, Car, MapPin, CheckCircle, XCircle, Package, RotateCcw, Flag, DollarSign, FileText, Shield, CreditCard, User, ClipboardCheck, Receipt, Navigation } from 'lucide-react';
import { api } from '../api/client';
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
import { format } from 'date-fns';

/* ────────────────────────────────────────────────────────
   Tab Configuration
   ──────────────────────────────────────────────────────── */
const TABS = [
  { id: 'overview',   label: 'Overview',   icon: FileText    },
  { id: 'checkin',    label: 'Check-In',   icon: Package     },
  { id: 'checkout',   label: 'Check-Out',  icon: ClipboardCheck },
  { id: 'invoice',    label: 'Invoice',    icon: Receipt     },
];

/* ────────────────────────────────────────────────────────
   ID Photo Gallery — handles new multi-path + legacy single URL
   ──────────────────────────────────────────────────────── */
const BASE_API = import.meta.env.VITE_API_URL || '/api/v1';

function IdPhotoGallery({ paths, legacyUrl, onView }) {
  const [signedUrls, setSignedUrls] = useState({});
  const [loading, setLoading] = useState({});

  const fetchSignedUrl = async (path, idx) => {
    if (signedUrls[idx] || loading[idx]) return;
    setLoading(prev => ({ ...prev, [idx]: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(
        `${BASE_API}/uploads/signed-url?bucket=id-photos&path=${encodeURIComponent(path)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      const { url } = await res.json();
      setSignedUrls(prev => ({ ...prev, [idx]: url }));
      onView(url);
    } catch {
      /* silent */
    } finally {
      setLoading(prev => ({ ...prev, [idx]: false }));
    }
  };

  // New system: array of storage paths
  if (paths?.length > 0) {
    const labels = ['Front', 'Back'];
    return (
      <div className="flex flex-wrap gap-3">
        {paths.map((path, idx) => (
          <div key={idx} className="flex flex-col items-start gap-1">
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">{labels[idx] ?? `Photo ${idx + 1}`}</span>
            <button
              onClick={() => fetchSignedUrl(path, idx)}
              disabled={loading[idx]}
              className="h-24 w-36 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-hover)] flex items-center justify-center text-xs text-[var(--text-secondary)] hover:opacity-80 transition-all cursor-pointer overflow-hidden"
            >
              {loading[idx] ? (
                <span className="animate-pulse">Loading…</span>
              ) : signedUrls[idx] ? (
                <img src={signedUrls[idx]} alt={`License ${labels[idx] ?? idx + 1}`} className="h-full w-full object-cover" />
              ) : (
                <span>View</span>
              )}
            </button>
          </div>
        ))}
        <p className="w-full text-xs text-[var(--text-tertiary)] -mt-1">Click to load & enlarge</p>
      </div>
    );
  }

  // Legacy: single pre-signed URL stored on customer record
  if (legacyUrl) {
    return (
      <div>
        <button onClick={() => onView(legacyUrl)} className="cursor-pointer">
          <img
            src={legacyUrl}
            alt="Customer photo ID"
            className="h-28 w-auto rounded-lg border border-[var(--border-subtle)] object-cover hover:opacity-80 hover:shadow-md transition-all"
          />
        </button>
        <p className="text-xs text-[var(--text-tertiary)] mt-1">Click to enlarge</p>
      </div>
    );
  }

  return null;
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
  const [paymentForm, setPaymentForm] = useState({ payment_type: 'rental', amount: '', method: 'cash', reference_id: '', notes: '' });
  const [conditionForm, setConditionForm] = useState({ fuel: 'full', notes: '', photoUrl: '' });
  const [damageForm, setDamageForm] = useState({ description: '', severity: 'minor', estimated_cost: '', photo_url: '' });
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'overview');

  const load = async () => {
    setLoading(true);
    try {
      const b = await api.getBooking(id);
      // Normalize rental_agreements — Supabase returns object for 1:1, array for 1:many
      if (b && b.rental_agreements && !Array.isArray(b.rental_agreements)) {
        b.rental_agreements = [b.rental_agreements];
      }
      setBooking(b);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  async function doAction(action) {
    setActioning(true);
    try {
      if (action === 'approve')  await api.approveBooking(id);
      if (action === 'decline')  await api.declineBooking(id, modalInput);
      if (action === 'cancel')   await api.cancelBooking(id, modalInput);
      if (action === 'pickup')   await api.recordPickup(id, {
        mileage: modalInput,
        fuel_level: conditionForm.fuel,
        condition_notes: conditionForm.notes || undefined,
        photos: conditionForm.photoUrl ? [conditionForm.photoUrl] : [],
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
      await load();
    } catch (e) { console.error(e); }
    setModal(null);
    setModalInput('');
    setConditionForm({ fuel: 'full', notes: '', photoUrl: '' });
    setDamageForm({ description: '', severity: 'minor', estimated_cost: '', photo_url: '' });
    setActioning(false);
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

      {/* ── Tab Navigation ──────────────────────────────────────────── */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-[var(--border-subtle)]">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap ${
                isActive
                  ? 'text-[var(--accent-color)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] border-b-transparent -mb-px'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ─────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <OverviewTab booking={booking} c={c} v={v} id={id} load={load}
          setModal={setModal} setPaymentForm={setPaymentForm}
          setLightboxUrl={setLightboxUrl}
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
        actioning={actioning} doAction={doAction}
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
   Overview Tab — extracted from the original monolith
   ──────────────────────────────────────────────────────── */
function OverviewTab({ booking, c, v, id, load, setModal, setPaymentForm, setLightboxUrl }) {
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
      <Section title="Insurance">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-[var(--text-tertiary)]">Provider</p>
            <p className="text-sm font-medium text-[var(--text-primary)] mt-0.5">
              {booking.insurance_provider === 'annies' ? "Annie's Car Rental" :
               booking.insurance_provider === 'own' ? "Customer's Own" :
               booking.insurance_provider === 'bonzah' ? 'Bonzah' :
               booking.insurance_provider || '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-tertiary)]">Status</p>
            <select
              className="input text-sm mt-0.5"
              defaultValue={booking.insurance_status || 'pending'}
              onChange={async e => {
                await api.updateInsuranceStatus(id, e.target.value);
                await load();
              }}
            >
              {['pending', 'active', 'declined', 'not_required', 'external'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Annie's tier display */}
          {booking.insurance_provider === 'annies' && booking.insurance_policy_number && (
            <div className="col-span-2">
              <p className="text-xs text-[var(--text-tertiary)]">Coverage Tier</p>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold capitalize px-2.5 py-1 rounded-full mt-1 ${
                booking.insurance_policy_number === 'premium'  ? 'bg-amber-500/15 text-amber-500' :
                booking.insurance_policy_number === 'standard' ? 'bg-blue-500/10 text-[#63b3ed]' :
                                                                  'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
              }`}>
                {booking.insurance_policy_number === 'basic'    && '🛡️ Basic Protection — $12/day'}
                {booking.insurance_policy_number === 'standard' && '🛡️ Standard Protection — $18/day'}
                {booking.insurance_policy_number === 'premium'  && '🛡️ Premium Protection — $25/day'}
              </span>
            </div>
          )}

          {/* Bonzah / legacy policy ID */}
          {booking.insurance_provider !== 'annies' && booking.insurance_provider !== 'own' && (
            <div className="col-span-2">
              <p className="text-xs text-[var(--text-tertiary)]">Policy ID</p>
              <input
                className="input text-sm mt-0.5"
                defaultValue={booking.insurance_policy_number || booking.bonzah_policy_id || ''}
                placeholder="Policy number (if applicable)"
                onBlur={async e => {
                  const current = booking.insurance_policy_number || booking.bonzah_policy_id || '';
                  if (e.target.value !== current) {
                    await api.updateInsuranceStatus(id, booking.insurance_status, e.target.value);
                    await load();
                  }
                }}
              />
            </div>
          )}
        </div>
        
        {booking.rental_agreements?.length > 0 && 
          booking.rental_agreements[0].insurance_company && (
          <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
            <p className="text-sm font-medium text-[var(--text-primary)] mb-3">Customer Provided Details</p>
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
