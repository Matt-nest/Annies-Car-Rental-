import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Car, Calendar, MapPin, Key, Camera, Check, CheckCircle2, AlertCircle,
  Loader2, Shield, DollarSign, MessageSquare, ArrowRight,
  Fuel, Gauge, ChevronRight, ChevronDown, ExternalLink, X, Star, Phone, Receipt, CreditCard, Clock,
  ClipboardCheck,
  ArrowLeft, Navigation, Sparkles,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { EASE, DURATION } from '../../utils/motion';
import { API_URL } from '../../config';
import Navbar from '../layout/Navbar';
import Footer from '../layout/Footer';
import PhotoUploader from './PhotoUploader';
import SlotPhotoUploader, { type PhotoSlots } from './SlotPhotoUploader';
import CrispWidget, { openCrispChat } from './CrispWidget';
import PortalActionBar from './PortalActionBar';
import StatusHero from './StatusHero';
import PushOptInCard from './PushOptInCard';
import ExtendRentalCard from './ExtendRentalCard';
import PaymentMethodCard from './PaymentMethodCard';
import BalanceDueCard from './BalanceDueCard';
import PaymentPlanCard from './PaymentPlanCard';
import Sheet from '../common/Sheet';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { brand } from '../../config/brand';

/* Persisted portal session — keeps long-term renters signed in across refreshes. */
const SESSION_KEY = 'portal_session';
function saveSession(token: string, bookingCode: string, email: string) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ token, bookingCode, email })); } catch { /* ignore */ }
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

/* Helpers */
const fmt = (d: string) => {
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
};
const fmtTime = (t: string) => {
  if (!t?.includes(':')) return t;
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function isTokenExpired(token: string): boolean {
  try {
    const payload = decodePortalPayload(token);
    return payload.exp ? payload.exp * 1000 < Date.now() : false;
  } catch { return true; }
}

function decodePortalPayload(token: string): any {
  return JSON.parse(atob(token.split('.')[1]));
}

/* Styles (inline to match main site) */
const card = (theme: string) => ({
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '16px',
  overflow: 'hidden' as const,
});

type PortalTabKey = 'overview' | 'money' | 'pickup' | 'help';

function isLongTermRental(booking: any): boolean {
  return booking?.rental_type === 'long_term' || booking?.rate_preference === 'monthly';
}

function PortalTabs({
  active,
  onChange,
  status,
}: {
  active: PortalTabKey;
  onChange: (tab: PortalTabKey) => void;
  status: string;
}) {
  const pickupLabel = status === 'active'
    ? 'Return'
    : status === 'ready_for_pickup'
      ? 'Pickup'
      : 'Trip';
  const tabs: Array<{ key: PortalTabKey; label: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }> = [
    { key: 'overview', label: 'Overview', icon: Car },
    { key: 'money', label: 'Money', icon: Receipt },
    { key: 'pickup', label: pickupLabel, icon: Key },
    { key: 'help', label: 'Help', icon: MessageSquare },
  ];

  return (
    <nav
      aria-label="Portal sections"
      className="sticky z-[70] -mx-1 rounded-2xl p-1"
      style={{
        top: 'calc(env(safe-area-inset-top, 0px) + 76px)',
        backgroundColor: 'color-mix(in srgb, var(--bg-card) 92%, transparent)',
        border: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        boxShadow: '0 12px 30px rgba(0,0,0,0.08)',
      }}
    >
      <div className="grid w-full grid-cols-4 gap-1">
        {tabs.map(({ key, label, icon: Icon }) => {
          const selected = active === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              onPointerUp={(event) => event.currentTarget.blur()}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]"
              style={{
                backgroundColor: selected ? 'var(--accent-color)' : 'transparent',
                color: selected ? 'var(--accent-fg)' : 'var(--text-secondary)',
                WebkitTapHighlightColor: 'transparent',
              }}
              aria-current={selected ? 'page' : undefined}
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function PortalSectionHeader({
  active,
  status,
  booking,
}: {
  active: PortalTabKey;
  status: string;
  booking: any;
}) {
  if (active === 'overview') return null;
  const pickupTitle = status === 'active'
    ? 'Return'
    : status === 'ready_for_pickup'
      ? 'Pickup'
      : 'Trip steps';
  const config: Record<Exclude<PortalTabKey, 'overview'>, {
    title: string;
    eyebrow: string;
    body: string;
    icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  }> = {
    money: {
      title: 'Money',
      eyebrow: 'Payments and receipt',
      body: status === 'approved' || status === 'confirmed'
        ? 'Review your itemized total and pay what is due. Your previously submitted details stay saved.'
        : 'Review receipts, balances, deposits, and any inspection charges in one place.',
      icon: Receipt,
    },
    pickup: {
      title: pickupTitle,
      eyebrow: status === 'active' ? 'Bring the vehicle back' : 'Vehicle handoff',
      body: status === 'active'
        ? 'Follow the return steps, upload photos, and confirm the key is back in the lockbox.'
        : status === 'ready_for_pickup'
          ? `Go to ${brand.location.address}, complete check-in, then unlock your code.`
          : 'Review pickup, return, and saved trip records.',
      icon: Key,
    },
    help: {
      title: 'Help',
      eyebrow: 'Support',
      body: `Message ${brand.name}, call us, or enable important portal updates for this rental.`,
      icon: MessageSquare,
    },
  };
  const item = config[active];
  const Icon = item.icon;
  const vehicleName = [booking?.vehicles?.year, booking?.vehicles?.make, booking?.vehicles?.model].filter(Boolean).join(' ');
  return (
    <motion.section
      key={active}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ease: EASE.standard }}
      className="rounded-2xl p-4"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      aria-label={`${item.title} section`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: 'var(--accent-glow)' }}>
          <Icon size={18} style={{ color: 'var(--accent-color)' }} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--text-tertiary)' }}>{item.eyebrow}</p>
          <h2 className="mt-1 text-xl font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>{item.title}</h2>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{item.body}</p>
          {vehicleName && (
            <p className="mt-2 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{vehicleName}</p>
          )}
        </div>
      </div>
    </motion.section>
  );
}

function NextActionCard({
  booking,
  onTab,
  onCheckIn,
  onCheckOut,
}: {
  booking: any;
  onTab: (tab: PortalTabKey) => void;
  onCheckIn: () => void;
  onCheckOut: () => void;
}) {
  const status = booking?.status || 'pending_approval';
  const longTerm = isLongTermRental(booking);
  const vehicleName = [booking?.vehicles?.year, booking?.vehicles?.make, booking?.vehicles?.model].filter(Boolean).join(' ') || 'your vehicle';

  const copy: Record<string, { title: string; body: string; label: string; tab: PortalTabKey; tone: 'blue' | 'green' | 'amber' | 'slate'; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }> = {
    pending_approval: {
      title: 'We are reviewing your request',
      body: 'No action is needed right now. We will update this portal as soon as your booking is approved.',
      label: 'View trip',
      tab: 'overview',
      tone: 'amber',
      icon: Clock,
    },
    approved: {
      title: 'Review your booking and pay',
      body: 'Your submitted details are saved. Review the receipt, pay any balance due, and you are set for pickup.',
      label: 'Review money',
      tab: 'money',
      tone: 'blue',
      icon: CreditCard,
    },
    confirmed: {
      title: 'Review your booking and pay',
      body: 'Your submitted details are saved. Review the receipt, pay any balance due, and you are set for pickup.',
      label: 'Review money',
      tab: 'money',
      tone: 'blue',
      icon: CreditCard,
    },
    ready_for_pickup: {
      title: `${vehicleName} is ready`,
      body: 'Start check-in, upload the required photos, confirm the odometer and fuel, then the lockbox code is revealed.',
      label: 'Start check-in',
      tab: 'pickup',
      tone: 'green',
      icon: Key,
    },
    active: {
      title: longTerm ? 'Manage your monthly rental' : 'You are on the road',
      body: longTerm
        ? 'Handle renewal timing, payments, extensions, and return steps from one place.'
        : 'Need more time, have a balance, or ready to return? Start with the next step below.',
      label: 'Return vehicle',
      tab: 'pickup',
      tone: 'green',
      icon: Car,
    },
    returned: {
      title: 'Inspection is in progress',
      body: 'We will post the final settlement here. You can review charges and dispute anything that looks off.',
      label: 'View settlement',
      tab: 'money',
      tone: 'amber',
      icon: Receipt,
    },
    completed: {
      title: 'Rental complete',
      body: 'Your receipt and payment history are saved here. Leaving a quick review helps a lot.',
      label: 'View receipt',
      tab: 'money',
      tone: 'green',
      icon: CheckCircle2,
    },
    cancelled: {
      title: 'This booking was cancelled',
      body: 'If this does not look right, contact us and we will help.',
      label: 'Contact us',
      tab: 'help',
      tone: 'slate',
      icon: AlertCircle,
    },
    declined: {
      title: 'This request was not confirmed',
      body: 'If you still need a vehicle, reach out and we will help you find another option.',
      label: 'Contact us',
      tab: 'help',
      tone: 'slate',
      icon: AlertCircle,
    },
  };

  const item = copy[status] || copy.pending_approval;
  const Icon = item.icon;
  const tone = item.tone === 'green'
    ? { bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.22)', fg: '#15803d' }
    : item.tone === 'amber'
      ? { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.22)', fg: '#b45309' }
      : item.tone === 'blue'
        ? { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.22)', fg: '#2563eb' }
        : { bg: 'var(--bg-card)', border: 'var(--border-subtle)', fg: 'var(--text-primary)' };

  function handlePrimary() {
    if (status === 'ready_for_pickup') return onCheckIn();
    if (status === 'active') return onCheckOut();
    onTab(item.tab);
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ease: EASE.standard }}
      className="rounded-3xl p-5"
      style={{ backgroundColor: tone.bg, border: `1px solid ${tone.border}` }}
      aria-label="Next step"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: 'var(--bg-card)' }}>
          <Icon size={20} style={{ color: tone.fg }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: tone.fg }}>Next step</p>
          <h2 className="mt-1 text-base font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>{item.title}</h2>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{item.body}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={handlePrimary}
          className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-transform active:scale-95"
          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-fg)' }}
        >
          {item.label} <ArrowRight size={15} />
        </button>
        {status === 'active' && (
          <button
            type="button"
            onClick={() => onTab('money')}
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-transform active:scale-95"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
          >
            Extend or pay
          </button>
        )}
      </div>
    </motion.section>
  );
}

function FlowStepHeader({
  steps,
  current,
  accent = 'var(--accent-color, #B8941E)',
}: {
  steps: string[];
  current: number;
  accent?: string;
}) {
  const progress = steps.length > 0 ? ((current + 1) / steps.length) * 100 : 100;
  return (
    <div className="space-y-3">
      <div className="relative h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.28, ease: EASE.standard }}
          style={{ backgroundColor: accent }}
        />
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((step, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <div key={step} className="flex min-w-0 flex-col items-center gap-1 text-center">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-black transition-all"
                style={{
                  backgroundColor: done || active ? accent : 'var(--bg-card-hover)',
                  border: done || active ? `1px solid ${accent}` : '1px solid var(--border-subtle)',
                  color: done || active ? 'var(--accent-fg)' : 'var(--text-tertiary)',
                  boxShadow: active ? `0 0 0 6px color-mix(in srgb, ${accent} 14%, transparent)` : 'none',
                }}
              >
                {done ? <Check size={14} /> : index + 1}
              </div>
              <span className="truncate text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: active ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FlowShell({
  title,
  subtitle,
  steps,
  current,
  accent,
  children,
}: {
  title: string;
  subtitle: string;
  steps: string[];
  current: number;
  accent: string;
  children: React.ReactNode;
}) {
  const activeStep = steps[current] || steps[0] || 'Step';
  return (
    <div
      className="relative -mx-2 overflow-hidden rounded-3xl px-2 pb-1"
      style={{ backgroundColor: 'var(--bg-elevated, #fff)' }}
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute left-4 right-4 top-0 h-1 rounded-full"
        initial={false}
        animate={{ opacity: [0.35, 0.75, 0.35] }}
        transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        }}
      />
      <div className="relative space-y-5 py-2">
        <div className="flex items-start gap-3">
          <motion.div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            animate={{ y: [0, -2, 0] }}
            transition={{ repeat: Infinity, duration: 3.2, ease: 'easeInOut' }}
            style={{ backgroundColor: 'color-mix(in srgb, var(--accent-color) 12%, transparent)', color: accent }}
          >
            <Sparkles size={21} />
          </motion.div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--text-tertiary)' }}>
              Guided handoff · {current + 1} of {steps.length} · {activeStep}
            </p>
            <h3 className="mt-1 text-xl font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>{title}</h3>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>
          </div>
        </div>
        <FlowStepHeader steps={steps} current={current} accent={accent} />
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.22, ease: EASE.standard }}
            className="space-y-4"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function FlowFooter({
  backLabel = 'Back',
  nextLabel,
  onBack,
  onNext,
  nextDisabled = false,
  loading = false,
  accent = 'var(--accent-color, #B8941E)',
  submit = false,
}: {
  backLabel?: string;
  nextLabel: string;
  onBack?: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  loading?: boolean;
  accent?: string;
  submit?: boolean;
}) {
  return (
    <div
      className={`sticky bottom-0 z-10 -mx-1 grid gap-3 rounded-t-2xl px-1 pt-3 ${onBack ? 'grid-cols-[0.8fr_1.2fr]' : 'grid-cols-1'}`}
      style={{ backgroundColor: 'color-mix(in srgb, var(--bg-elevated, #fff) 94%, transparent)' }}
    >
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="flex min-h-12 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-transform active:scale-95 disabled:opacity-50"
          style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
        >
          <ArrowLeft size={15} /> {backLabel}
        </button>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled || loading}
        className="flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-transform active:scale-95 disabled:opacity-50"
        style={{
          backgroundColor: accent,
          border: `1px solid ${accent}`,
          boxShadow: `0 14px 32px color-mix(in srgb, ${accent} 28%, transparent)`,
          color: 'var(--accent-fg, #111827)',
        }}
      >
        {loading ? <><Loader2 size={16} className="animate-spin" /> Processing...</> : <>{nextLabel} {submit ? <Check size={16} /> : <ChevronRight size={16} />}</>}
      </button>
    </div>
  );
}

function HandoffLauncherCard({
  mode,
  title,
  body,
  cta,
  onOpen,
  accent,
}: {
  mode: 'pickup' | 'return';
  title: string;
  body: string;
  cta: string;
  onOpen: () => void;
  accent: string;
}) {
  const Icon = mode === 'pickup' ? Key : Car;
  return (
    <motion.div
      id={mode === 'pickup' ? 'portal-checkin' : 'portal-checkout'}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18, ease: EASE.standard }}
      className="rounded-3xl p-5"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        scrollMarginTop: '100px',
        boxShadow: '0 18px 45px rgba(15,23,42,0.08)',
      }}
    >
      <div className="flex items-start gap-3">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: 'color-mix(in srgb, var(--accent-color) 12%, transparent)' }}>
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-2xl"
            animate={{ scale: [1, 1.16, 1], opacity: [0.28, 0, 0.28] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ border: `1px solid ${accent}` }}
          />
          <Icon size={21} style={{ color: accent }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--text-tertiary)' }}>
            {mode === 'pickup' ? 'Pickup flow' : 'Return flow'}
          </p>
          <h3 className="mt-1 text-lg font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{body}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-transform active:scale-95"
        style={{ backgroundColor: accent, color: 'var(--accent-fg)' }}
      >
        {cta} <ArrowRight size={15} />
      </button>
    </motion.div>
  );
}

/* ── Collapsible section ─────────────────────────────────── */
function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
  rightHint,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  defaultOpen?: boolean;
  children: React.ReactNode;
  rightHint?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ease: EASE.standard }}
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[var(--bg-card-hover)]"
        aria-expanded={open}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
          <Icon size={16} style={{ color: 'var(--text-secondary)' }} />
        </div>
        <span className="flex-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</span>
        {rightHint && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{rightHint}</span>}
        <ChevronDown
          size={16}
          style={{
            color: 'var(--text-tertiary)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 220ms ease',
          }}
        />
      </button>
      {/* CSS-grid expand trick: animating grid-template-rows from 0fr → 1fr
          lets the browser handle the layout math each frame on the compositor
          rather than measuring the child's intrinsic height in JS on every
          frame (which is what animate={{ height: 'auto' }} was doing). The
          surrounding flow still reflows correctly because grid IS layout. */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ gridTemplateRows: '0fr', opacity: 0 }}
            animate={{ gridTemplateRows: '1fr', opacity: 1 }}
            exit={{ gridTemplateRows: '0fr', opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE.smooth }}
            style={{ display: 'grid', overflow: 'hidden' }}
          >
            <div style={{ minHeight: 0 }}>
              <div className="px-5 pb-5 pt-0" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                {children}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Main Component ─────────────────────────────────────── */
export default function CustomerPortal() {
  const { theme } = useTheme();
  const params = new URLSearchParams(window.location.search);
  const initialBookingCode = params.get('code') || params.get('ref') || '';
  const initialEmail = params.get('email') || '';
  const codeFromUrl = !!initialBookingCode;

  const [bookingCode, setBookingCode] = useState(initialBookingCode);
  const [email, setEmail] = useState(initialEmail);
  const [token, setToken] = useState<string | null>(null);
  const [booking, setBooking] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<'login' | 'dashboard'>('login');
  const [activePortalTab, setActivePortalTab] = useState<PortalTabKey>('overview');

  // Check-in/out form state
  const [odometer, setOdometer] = useState('');
  const [fuel, setFuel] = useState('full');
  const [conditionConfirmed, setConditionConfirmed] = useState(false);
  const [keyReturned, setKeyReturned] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [lockbox, setLockbox] = useState<string | null>(null);
  const [lockboxCopied, setLockboxCopied] = useState(false);

  // Photo uploads
  const [checkinPhotos, setCheckinPhotos] = useState<string[]>([]);
  const [disputePhotos, setDisputePhotos] = useState<string[]>([]);

  // Slot-based check-in photos (new)
  const [photoSlots, setPhotoSlots] = useState<PhotoSlots>({});
  const [allSlotsReady, setAllSlotsReady] = useState(false);

  // Return form mirrors check-in - slot photos + odometer + fuel are required
  const [returnPhotoSlots, setReturnPhotoSlots] = useState<PhotoSlots>({});
  const [returnSlotsReady, setReturnSlotsReady] = useState(false);
  const [returnOdometer, setReturnOdometer] = useState('');
  const [returnFuel, setReturnFuel] = useState('full');

  // Dispute form
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [disputeSuccess, setDisputeSuccess] = useState(false);

  // Pending overage charges (scheduled with 48h dispute window)
  const [pendingCharges, setPendingCharges] = useState<any[]>([]);
  const [overageDisputeMsg, setOverageDisputeMsg] = useState<Record<string, string>>({});
  const [overageDisputingId, setOverageDisputingId] = useState<string | null>(null);

  // Review form
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);

  const scrollToSection = (section: string) => {
    if (section === 'home') window.location.href = '/';
    else window.location.href = `/#${section}`;
  };

  /* ── Auth ── */
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingCode || !email) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/portal/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingCode, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      setToken(data.token);
      saveSession(data.token, bookingCode, email);
      setView('dashboard');
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  /* Rehydrate a stored session on mount so a refresh doesn't kick the customer back to login. */
  useEffect(() => {
    const previewToken = new URLSearchParams(window.location.search).get('preview_token');
    if (previewToken) {
      if (isTokenExpired(previewToken)) {
        setError('This portal preview link has expired. Open a fresh preview from the dashboard.');
        return;
      }
      try {
        const payload = decodePortalPayload(previewToken);
        if (payload.bookingCode) setBookingCode(payload.bookingCode);
        if (payload.email) setEmail(payload.email);
        setToken(previewToken);
        setView('dashboard');

        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('preview_token');
        cleanUrl.searchParams.delete('admin_preview');
        if (payload.bookingCode && !cleanUrl.searchParams.get('code')) {
          cleanUrl.searchParams.set('code', payload.bookingCode);
        }
        window.history.replaceState({}, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
      } catch {
        setError('This portal preview link is invalid. Open a fresh preview from the dashboard.');
      }
      return;
    }
    if (token) return;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s?.token && !isTokenExpired(s.token)) {
        setToken(s.token);
        if (s.bookingCode) setBookingCode(s.bookingCode);
        if (s.email) setEmail(s.email);
        setView('dashboard');
      } else {
        clearSession();
      }
    } catch { /* ignore */ }
  }, []);

  const refreshSessionIfNeeded = useCallback(async (tok: string) => {
    try {
      const payload = decodePortalPayload(tok);
      if (payload.adminPreview) return;
      const msLeft = (payload.exp || 0) * 1000 - Date.now();
      if (msLeft > 2 * 60 * 60 * 1000) return;
      const res = await fetch(`${API_URL}/portal/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.token) {
        setToken(data.token);
        saveSession(data.token, bookingCode, email);
      }
    } catch { /* ignore */ }
  }, [bookingCode, email]);

  const handleSignOut = () => {
    clearSession();
    setToken(null);
    setBooking(null);
    setPlan(null);
    setView('login');
    setActivePortalTab('overview');
  };

  const handlePortalTabChange = useCallback((tab: PortalTabKey) => {
    setActivePortalTab(tab);
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => window.scrollTo({ top: 0 }));
    }
  }, []);

  /* ── Load Booking ── */
  const loadBooking = useCallback(async () => {
    if (!token) return;
    if (isTokenExpired(token)) {
      clearSession();
      setToken(null);
      setView('login');
      setError('Your session has expired. Please verify again.');
      return;
    }
    await refreshSessionIfNeeded(token);
    try {
      const res = await fetch(`${API_URL}/portal/booking`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBooking(data);

      if (['confirmed', 'ready_for_pickup', 'active', 'returned'].includes(data.status)) {
        try {
          const p = await fetch(`${API_URL}/portal/payment-plan`, {
            headers: { Authorization: `Bearer ${token}` },
          }).then(r => r.ok ? r.json() : null);
          setPlan(p && p.plan ? p : null);
        } catch { setPlan(null); }
      } else {
        setPlan(null);
      }

      // Load lockbox only when check-in is complete (active status)
      // Lockbox is gated behind check-in - not available during ready_for_pickup
      if (data.status === 'active') {
        const lb = await fetch(`${API_URL}/portal/lockbox`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.json()).catch(() => null);
        if (lb?.lockbox_code) setLockbox(lb.lockbox_code);
      }

      // Load pending overage charges (returned/completed bookings only - these
      // are the charges scheduled to fire 48h after inspection). Returns []
      // when the FEATURE_AUTO_OVERAGE_CHARGES flag is off.
      if (['returned', 'completed'].includes(data.status)) {
        try {
          const charges = await fetch(`${API_URL}/portal/pending-charges`, {
            headers: { Authorization: `Bearer ${token}` },
          }).then(r => r.ok ? r.json() : []);
          setPendingCharges(Array.isArray(charges) ? charges : []);
        } catch { /* silent */ }
      }
    } catch (err: any) {
      setError(err.message);
    }
  }, [token, refreshSessionIfNeeded]);

  useEffect(() => { loadBooking(); }, [loadBooking]);

  // Pull-to-refresh - refetches the booking when the user swipes down at
  // the top of the page. No-op on desktop/mouse pointers.
  const { pullDistance, isRefreshing, progress, triggered } = usePullToRefresh(loadBooking);

  // The same guided handoff sheet is used on mobile and desktop so every CTA
  // enters the same focused pickup / return flow.
  const [checkInSheetOpen, setCheckInSheetOpen] = useState(false);
  const [checkOutSheetOpen, setCheckOutSheetOpen] = useState(false);
  const [checkInStep, setCheckInStep] = useState(0);
  const [checkOutStep, setCheckOutStep] = useState(0);

  const openCheckInWizard = useCallback(() => {
    setError('');
    setActionSuccess('');
    setCheckInStep(0);
    setCheckInSheetOpen(true);
  }, []);

  const openCheckOutWizard = useCallback(() => {
    setError('');
    setActionSuccess('');
    setCheckOutStep(0);
    setCheckOutSheetOpen(true);
  }, []);

  // Auto-close the active sheet when a check-in/out completes successfully -
  // user should see the resulting lockbox reveal / completion state in the
  // main page rather than a sheet that's no longer relevant.
  useEffect(() => {
    if (actionSuccess) {
      setCheckInSheetOpen(false);
      setCheckOutSheetOpen(false);
    }
  }, [actionSuccess]);

  /* ── Self-Service Check-In ── */
  const handleCheckIn = async () => {
    if (!conditionConfirmed || !allSlotsReady) return;
    if (!odometer || isNaN(Number(odometer)) || Number(odometer) <= 0) {
      setError('Please enter a valid odometer reading');
      return;
    }
    if (token && isTokenExpired(token)) {
      setToken(null);
      setView('login');
      setError('Your session has expired. Please verify again.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/portal/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          odometer: Number(odometer),
          fuelLevel: fuel,
          photoSlots,
          conditionConfirmed: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // The lockbox code is returned on successful check-in - reveal it
      if (data.lockbox_code) {
        setLockbox(data.lockbox_code);
        setActionSuccess('Check-in complete! Your lockbox code is below. Grab your keys and drive safe! 🚗');
      } else if (data.lockbox_error) {
        // Lockbox not configured in database - show the fallback message
        setActionSuccess(`Check-in complete! ${data.lockbox_error}`);
      } else {
        setActionSuccess(`Check-in complete! Contact ${brand.name} at ${brand.phone} for your key pickup instructions.`);
      }
      await loadBooking();
    } catch (err: any) { setError(err.message); }
    setActionLoading(false);
  };

  /* ── Self-Service Check-Out - mirrors check-in: required slot photos +
        odometer + fuel + key-returned acknowledgement. ── */
  const handleCheckOut = async () => {
    if (!keyReturned || !returnSlotsReady) return;
    if (!returnOdometer || isNaN(Number(returnOdometer)) || Number(returnOdometer) <= 0) {
      setError('Please enter a valid return odometer reading');
      return;
    }
    if (token && isTokenExpired(token)) {
      setToken(null);
      setView('login');
      setError('Your session has expired. Please verify again.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/portal/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          odometer: Number(returnOdometer),
          fuelLevel: returnFuel,
          photoSlots: returnPhotoSlots,
          keyReturned: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActionSuccess('Check-out submitted.');
      await loadBooking();
    } catch (err: any) { setError(err.message); }
    setActionLoading(false);
  };

  /* ── Dispute ── */
  /* Dispute a scheduled overage charge during the 48h window. */
  const handleOverageDispute = async (chargeId: string) => {
    const message = (overageDisputeMsg[chargeId] || '').trim();
    if (!message) return;
    setOverageDisputingId(chargeId);
    try {
      const res = await fetch(`${API_URL}/portal/pending-charges/${chargeId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispute charge');
      setPendingCharges(prev => prev.map(c => c.id === chargeId ? { ...c, status: 'disputed', dispute_message: message } : c));
    } catch (err: any) {
      setError(err.message);
    }
    setOverageDisputingId(null);
  };

  const handleDispute = async () => {
    if (!disputeReason.trim()) return;
    if (token && isTokenExpired(token)) {
      setToken(null);
      setView('login');
      setError('Your session has expired. Please verify again.');
      return;
    }
    setDisputeSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/portal/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: disputeReason, photoUrls: disputePhotos.length > 0 ? disputePhotos : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDisputeSuccess(true);
      await loadBooking();
    } catch (err: any) { setError(err.message); }
    setDisputeSubmitting(false);
  };

  /* ═══════════════════════════════════════════════════════
     LOGIN VIEW
     ═══════════════════════════════════════════════════════ */
  if (view === 'login') {
    return (
      <>
        <Navbar onNavigate={scrollToSection} />
        <main className="min-h-dvh px-4 sm:px-6" style={{ paddingTop: '120px', paddingBottom: '80px' }}>
          <div className="max-w-md mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION.slow, ease: EASE.dramatic }}
              className="text-center mb-10"
            >
              <h1 className="text-3xl sm:text-4xl font-light mb-3" style={{ color: 'var(--text-primary)' }}>
                Rental{' '}
                <span className="font-serif italic" style={{ color: 'var(--accent-color)' }}>Portal</span>
              </h1>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Access your booking details, check in, and check out.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5, ease: EASE.standard }}
              style={card(theme)}
            >
              <div className="p-6 sm:p-8">
                {codeFromUrl && (
                  <div className="mb-6 text-center">
                    <span
                      className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium"
                      style={{
                        backgroundColor: 'var(--accent-glow)',
                        border: '1px solid var(--accent-color)',
                        color: 'var(--accent-color)',
                      }}
                    >
                      Booking: <span className="font-mono font-bold tracking-wider">{bookingCode}</span>
                    </span>
                  </div>
                )}

                <form onSubmit={handleVerify} className="space-y-4">
                  {!codeFromUrl && (
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                        Booking Code
                      </label>
                      <input
                        type="text"
                        required
                        autoCapitalize="characters"
                        className="w-full px-4 py-3 rounded-xl text-sm font-mono tracking-wider transition-all duration-200"
                        style={{
                          backgroundColor: 'var(--bg-card-hover)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-primary)',
                          outline: 'none',
                        }}
                        placeholder="e.g. BK-20260427-MJS3"
                        value={bookingCode}
                        onChange={e => setBookingCode(e.target.value.trim())}
                        onFocus={e => (e.target.style.borderColor = 'var(--accent-color)')}
                        onBlur={e => (e.target.style.borderColor = 'var(--border-subtle)')}
                      />
                      <p className="text-xs mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
                        Find this in your confirmation email or text.
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      className="w-full px-4 py-3 rounded-xl text-sm transition-all duration-200"
                      style={{
                        backgroundColor: 'var(--bg-card-hover)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                      }}
                      placeholder="Enter the email used for your booking"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onFocus={e => (e.target.style.borderColor = 'var(--accent-color)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--border-subtle)')}
                    />
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{
                      backgroundColor: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      color: '#ef4444',
                    }}>
                      <AlertCircle size={16} className="mt-0.5 shrink-0" />
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !bookingCode || !email}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-medium transition-all duration-300 hover:scale-[1.02] active:scale-95 text-sm disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--accent-color)',
                      color: '#1c1917',
                    }}
                  >
                    {loading ? (
                      <><Loader2 size={16} className="animate-spin" /> Verifying…</>
                    ) : (
                      <><ArrowRight size={16} /> Access My Booking</>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  /* ═══════════════════════════════════════════════════════
     DASHBOARD VIEW
     ═══════════════════════════════════════════════════════ */
  if (!booking) {
    return (
      <>
        <Navbar onNavigate={scrollToSection} />
        <main className="min-h-dvh flex items-center justify-center">
          <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent-color)' }} />
        </main>
      </>
    );
  }

  const { status, customers: c, vehicles: v } = booking;
  // Status badge styling moved into StatusHero (Sprint 7b). No longer rendered
  // inline here - the old `statusConfig` map and `sc` local lookup were removed.

  return (
    <>
      <Navbar onNavigate={scrollToSection} />

      {/* Pull-to-refresh visual indicator - sits below Navbar, animates in as
          the user pulls down. Saturates at `triggered` then spins while
          isRefreshing. Touch-only - desktop never sees this. */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="md:hidden fixed left-1/2 -translate-x-1/2 z-[95] pointer-events-none flex items-center justify-center w-10 h-10 rounded-full"
          style={{
            top: `calc(env(safe-area-inset-top, 0px) + ${64 + pullDistance * 0.6}px)`,
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            opacity: progress,
            transition: isRefreshing ? 'top 200ms ease-out' : 'none',
          }}
          aria-hidden="true"
        >
          <Loader2
            size={18}
            className={isRefreshing ? 'animate-spin' : ''}
            style={{
              color: triggered ? 'var(--accent-color)' : 'var(--text-tertiary)',
              transform: isRefreshing ? 'none' : `rotate(${progress * 270}deg)`,
              transition: 'color 200ms',
            }}
          />
        </div>
      )}

      <main
        className="min-h-dvh px-4 sm:px-6"
        style={{
          paddingTop: '84px',
          // Reserve space for the sticky bottom action bar (visible on mobile only)
          // + safe-area-inset-bottom. lg keeps the original 80px since no bar there.
          paddingBottom: 'max(120px, calc(96px + env(safe-area-inset-bottom)))',
        }}
      >
        <div className="max-w-lg mx-auto space-y-5">

          <PortalTabs
            active={activePortalTab}
            onChange={handlePortalTabChange}
            status={status}
          />

          {/* Success Message */}
          <AnimatePresence>
            {actionSuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="p-4 rounded-xl text-sm font-medium flex items-start gap-3"
                style={{ backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e' }}
              >
                <Check size={18} className="shrink-0 mt-0.5" />
                <div className="flex-1">{actionSuccess}</div>
                <button onClick={() => setActionSuccess('')}><X size={14} /></button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-xl text-sm flex items-start gap-3" style={{
              backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444',
            }}>
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div className="flex-1">{error}</div>
              <button onClick={() => setError('')}><X size={14} /></button>
            </div>
          )}

          {activePortalTab === 'overview' ? (
            <>
              {/* Status Hero - shown only on Overview so Money/Pickup/Help stay focused. */}
              <StatusHero
                status={status as any}
                customerName={`${c?.first_name || ''} ${c?.last_name || ''}`.trim() || 'Customer'}
                bookingCode={booking.booking_code}
                pickupDate={booking.pickup_date}
                pickupTime={booking.pickup_time}
                returnDate={booking.return_date}
                returnTime={booking.return_time}
              />

              <NextActionCard
                booking={booking}
                onTab={handlePortalTabChange}
                onCheckIn={openCheckInWizard}
                onCheckOut={openCheckOutWizard}
              />
            </>
          ) : (
            <PortalSectionHeader
              active={activePortalTab}
              status={status}
              booking={booking}
            />
          )}

          {/* ── Unified Rental Card: photo + vehicle + dates + progress bar ── */}
          {activePortalTab === 'overview' && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, ease: EASE.standard }}
            style={card(theme)}
          >
            {/* Vehicle hero photo */}
            {v?.vehicle_code && (
              <div
                className="aspect-[16/9] flex items-center justify-center p-4"
                style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}
              >
                <img
                  src={`/fleet/${v.vehicle_code}/hero.png`}
                  alt={`${v.year} ${v.make} ${v.model}`}
                  className="max-w-full max-h-full object-contain"
                  style={{ filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.3))' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            )}

            <div className="p-5 space-y-4">
              {/* Vehicle name */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--accent-glow)' }}>
                  <Car size={18} style={{ color: 'var(--accent-color)' }} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{v?.year} {v?.make} {v?.model}</p>
                  <p className="text-xs font-mono truncate" style={{ color: 'var(--text-tertiary)' }}>{v?.vehicle_code}</p>
                </div>
              </div>

              {/* Dates + location */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <Calendar size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Pickup</p>
                    <p>{fmt(booking.pickup_date)}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{fmtTime(booking.pickup_time)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <Calendar size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Return</p>
                    <p>{fmt(booking.return_date)}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{fmtTime(booking.return_time)}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <MapPin size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                <span>{booking.pickup_location}</span>
              </div>

              {/* Trimmed 4-step progress bar - only the milestones the customer experiences */}
              {(() => {
                const steps = [
                  { key: 'confirmed', label: 'Confirmed' },
                  { key: 'ready', label: 'Ready' },
                  { key: 'active', label: 'Active' },
                  { key: 'returned', label: 'Returned' },
                ];
                const statusToStep: Record<string, number> = {
                  pending_approval: 0, approved: 0, confirmed: 0,
                  ready_for_pickup: 1, active: 2, returned: 3, completed: 3,
                  cancelled: -1, declined: -1,
                };
                const current = statusToStep[status] ?? 0;
                if (current < 0) return null;

                return (
                  <div className="pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <p className="text-[10px] uppercase tracking-[0.15em] font-bold mb-3" style={{ color: 'var(--text-tertiary)' }}>
                      Rental Progress
                    </p>
                    <div className="flex items-center gap-0" style={{ overflow: 'hidden' }}>
                      {steps.map((step, i) => {
                        const done = i <= current;
                        const isCurrent = i === current;
                        return (
                          <div key={step.key} className="flex items-center" style={{ flex: i < steps.length - 1 ? 1 : 'none' }}>
                            <div className="flex flex-col items-center" style={{ minWidth: 36 }}>
                              <div
                                className="flex items-center justify-center rounded-full transition-all"
                                style={{
                                  width: isCurrent ? 28 : 20,
                                  height: isCurrent ? 28 : 20,
                                  backgroundColor: done ? (isCurrent ? 'var(--accent-color)' : '#22c55e') : 'var(--bg-card-hover)',
                                  border: done ? 'none' : '2px solid var(--border-subtle)',
                                  boxShadow: isCurrent ? '0 0 12px color-mix(in srgb, var(--accent-color) 40%, transparent)' : 'none',
                                }}
                              >
                                {done && !isCurrent && <Check size={10} color="#fff" strokeWidth={3} />}
                                {isCurrent && <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#1c1917' }} />}
                              </div>
                              <span
                                className="text-[10px] font-semibold mt-1.5 whitespace-nowrap"
                                style={{ color: isCurrent ? 'var(--accent-color)' : done ? '#22c55e' : 'var(--text-tertiary)' }}
                              >
                                {step.label}
                              </span>
                            </div>
                            {i < steps.length - 1 && (
                              <div
                                style={{
                                  flex: 1,
                                  height: 2,
                                  backgroundColor: i < current ? '#22c55e' : 'var(--border-subtle)',
                                  marginTop: -14,
                                  minWidth: 8,
                                }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </motion.div>
          )}


          {/* ── Pickup Guide (ready_for_pickup only) ──────────── */}
          {status === 'ready_for_pickup' && activePortalTab === 'pickup' && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, ease: EASE.standard }}
              className="rounded-2xl overflow-hidden"
              style={{ border: '2px solid rgba(6,182,212,0.2)', backgroundColor: 'rgba(6,182,212,0.04)' }}
            >
              <div className="p-5 space-y-4">
                {/* Pickup Address */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin size={18} style={{ color: '#06b6d4' }} />
                    <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#06b6d4' }}>
                      Pickup Location
                    </h3>
                  </div>
                  <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                    {brand.location.address}
                  </p>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    {brand.location.city}, {brand.location.state} {brand.location.zip}
                  </p>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(`${brand.location.address}, ${brand.location.city}, ${brand.location.state} ${brand.location.zip}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:scale-105 active:scale-95"
                    style={{ backgroundColor: 'rgba(6,182,212,0.12)', color: '#06b6d4' }}
                  >
                    <ExternalLink size={12} />
                    Open in Maps
                  </a>
                </div>

                {/* Step-by-step */}
                <div style={{ borderTop: '1px solid rgba(6,182,212,0.15)', paddingTop: 16 }}>
                  <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#06b6d4' }}>
                    How Pickup Works
                  </h4>
                  <div className="space-y-3">
                    {[
                      { num: '1', text: `Head to ${brand.location.address}, ${brand.location.city}` },
                      { num: '2', text: `Find your ${v?.year || ''} ${v?.make || ''} ${v?.model || ''} — the lockbox is on the driver-side window` },
                      { num: '3', text: 'Tap Start check-in and follow the guided photo, odometer, and fuel steps' },
                      { num: '4', text: 'Once submitted, your lockbox code will be revealed' },
                      { num: '5', text: 'Open the lockbox, grab the key, and you\'re off!' },
                    ].map((step) => (
                      <div key={step.num} className="flex items-start gap-3">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                          style={{ backgroundColor: 'rgba(6,182,212,0.15)', color: '#06b6d4' }}
                        >
                          {step.num}
                        </div>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {step.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Why photos */}
                <div className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)' }}>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    <Camera size={12} className="inline mr-1 -mt-0.5" style={{ color: '#f59e0b' }} />
                    <strong style={{ color: 'var(--text-primary)' }}>Why we ask for photos:</strong> They document the vehicle's condition at pickup, protecting you from being charged for any pre-existing damage.
                  </p>
                </div>

                {/* House rules */}
                <div className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Quick reminders:</strong> No smoking 🚭 and no pets 🐾 inside the vehicle ($150 cleaning fee each). Please return with the same fuel level you received it with — returning below that level incurs the refill cost plus a $10 inconvenience fee.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Admin Vehicle Prep Report - always collapsed at this status,
              hidden behind a "View vehicle prep report" toggle. ── */}
          {status === 'ready_for_pickup' && activePortalTab === 'pickup' && booking.checkinRecords && (() => {
            const prepRecord = booking.checkinRecords.find((r: any) => r.record_type === 'admin_prep');
            if (!prepRecord) return null;
            const fuelLabels: Record<string, string> = { full: 'Full', three_quarter: '¾ Tank', half: '½ Tank', quarter: '¼ Tank', empty: 'Empty' };
            return (
              <CollapsibleSection title="View vehicle prep report" icon={Shield}>
                <div className="space-y-3 pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    {prepRecord.fuel_level && (
                      <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                        <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-tertiary)' }}>
                          <Fuel size={10} className="inline mr-1" />Fuel Level
                        </p>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {fuelLabels[prepRecord.fuel_level] || prepRecord.fuel_level}
                        </p>
                      </div>
                    )}
                    {prepRecord.odometer && (
                      <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                        <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-tertiary)' }}>
                          <Gauge size={10} className="inline mr-1" />Odometer
                        </p>
                        <p className="text-sm font-semibold font-mono" style={{ color: 'var(--text-primary)' }}>
                          {Number(prepRecord.odometer).toLocaleString()} mi
                        </p>
                      </div>
                    )}
                  </div>

                  {prepRecord.photo_urls && prepRecord.photo_urls.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: 'var(--text-tertiary)' }}>
                        <Camera size={10} className="inline mr-1" />Inspection Photos
                      </p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {prepRecord.photo_urls.slice(0, 4).map((url: string, i: number) => (
                          <div key={i} className="aspect-square rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                            <img src={url} alt={`Prep ${i + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            );
          })()}

          {/* ── Customer Check-In Record (returned / completed only - active version
                renders below the Return Your Vehicle card) ── */}
          {['returned', 'completed'].includes(status) && activePortalTab === 'pickup' && booking.checkinRecords && (() => {
            const customerCheckin = booking.checkinRecords.find((r: any) => r.record_type === 'customer_checkin');
            if (!customerCheckin) return null;
            const allPhotos = customerCheckin.photo_urls || [];
            const fuelLabels: Record<string, string> = { full: 'Full', three_quarter: '¾ Tank', half: '½ Tank', quarter: '¼ Tank', empty: 'Empty' };

            return (
              <CollapsibleSection
                title="Your check-in record"
                icon={Camera}
                rightHint={customerCheckin.created_at ? fmt(customerCheckin.created_at) : undefined}
              >
                <div className="space-y-3 pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                      <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-tertiary)' }}>
                        <Gauge size={10} className="inline mr-1" />Odometer
                      </p>
                      <p className="text-sm font-semibold font-mono" style={{ color: 'var(--text-primary)' }}>
                        {customerCheckin.odometer ? Number(customerCheckin.odometer).toLocaleString() : 'N/A'} mi
                      </p>
                    </div>
                    <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                      <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-tertiary)' }}>
                        <Fuel size={10} className="inline mr-1" />Fuel Level
                      </p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {fuelLabels[customerCheckin.fuel_level] || customerCheckin.fuel_level || 'N/A'}
                      </p>
                    </div>
                  </div>

                  {allPhotos.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: 'var(--text-tertiary)' }}>
                        Pickup photos
                      </p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {allPhotos.map((url: string, i: number) => (
                          <div key={i} className="aspect-square rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                            <img src={url} alt={`Check-in ${i + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            );
          })()}

          {/* Self-Service Check-In: one guided modal on mobile and desktop. */}
          {status === 'ready_for_pickup' && (() => {
            const checkInSteps = ['Arrive', 'Photos', 'Details', 'Unlock'];
            const checkInAccent = '#22c55e';
            const formBody = (
              <FlowShell
                title="Start your rental"
                subtitle="A simple pickup flow: arrive, capture photos, confirm details, then unlock the key code."
                steps={checkInSteps}
                current={checkInStep}
                accent={checkInAccent}
              >
                {checkInStep === 0 && (
                  <>
                    <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                      <div className="flex items-start gap-3">
                        <Navigation size={19} style={{ color: '#06b6d4' }} />
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--text-tertiary)' }}>Pickup location</p>
                          <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{brand.location.address}</p>
                          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{brand.location.city}, {brand.location.state} {brand.location.zip}</p>
                        </div>
                      </div>
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(`${brand.location.address}, ${brand.location.city}, ${brand.location.state} ${brand.location.zip}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold"
                        style={{ backgroundColor: 'rgba(6,182,212,0.12)', color: '#0891b2' }}
                      >
                        <ExternalLink size={12} /> Open in Maps
                      </a>
                    </div>
                    <div className="grid gap-2">
                      {['Find the vehicle and lockbox.', 'Take four required photos before driving.', 'Confirm odometer and fuel to reveal the code.'].map((item, index) => (
                        <div key={item} className="flex items-center gap-3 rounded-2xl p-3" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                          <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-black" style={{ backgroundColor: 'rgba(34,197,94,0.14)', color: '#15803d' }}>{index + 1}</span>
                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item}</span>
                        </div>
                      ))}
                    </div>
                    <FlowFooter nextLabel="Start photos" onNext={() => setCheckInStep(1)} accent={checkInAccent} />
                  </>
                )}
                {checkInStep === 1 && (
                  <>
                    {token && (
                      <SlotPhotoUploader
                        token={token}
                        onSlotsChange={(slots, ready) => {
                          setPhotoSlots(slots);
                          setAllSlotsReady(ready);
                        }}
                      />
                    )}
                    {!allSlotsReady && (
                      <p className="text-[11px] text-center" style={{ color: 'var(--text-tertiary)' }}>
                        Upload all 4 required photos to continue.
                      </p>
                    )}
                    <FlowFooter
                      onBack={() => setCheckInStep(0)}
                      nextLabel="Add details"
                      onNext={() => setCheckInStep(2)}
                      nextDisabled={!allSlotsReady}
                      accent={checkInAccent}
                    />
                  </>
                )}
                {checkInStep === 2 && (
                  <>
                    <div className="rounded-2xl p-4" style={{ backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.22)' }}>
                      <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: '#15803d' }}>Pickup details</p>
                      <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        Enter the exact dashboard readings before driving. The final review comes next.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                          <Gauge size={12} className="inline mr-1" />Odometer *
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          placeholder="e.g. 42350"
                          value={odometer}
                          onChange={e => setOdometer(e.target.value)}
                          className="w-full px-3 py-3 rounded-xl text-base font-mono"
                          style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', outline: 'none' }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                          <Fuel size={12} className="inline mr-1" />Fuel Level *
                        </label>
                        <select
                          value={fuel}
                          onChange={e => setFuel(e.target.value)}
                          className="w-full px-3 py-3 rounded-xl text-base"
                          style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', outline: 'none', appearance: 'none' as const }}
                        >
                          <option value="full">Full</option>
                          <option value="three_quarter">¾ Tank</option>
                          <option value="half">½ Tank</option>
                          <option value="quarter">¼ Tank</option>
                          <option value="empty">Empty</option>
                        </select>
                      </div>
                    </div>
                    <FlowFooter
                      onBack={() => setCheckInStep(1)}
                      nextLabel="Review pickup"
                      onNext={() => setCheckInStep(3)}
                      nextDisabled={!odometer}
                      accent={checkInAccent}
                    />
                  </>
                )}
                {checkInStep === 3 && (
                  <>
                    <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={18} style={{ color: checkInAccent }} />
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Ready to unlock</p>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                          <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>Photos</p>
                          <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{allSlotsReady ? '4 saved' : 'Missing'}</p>
                        </div>
                        <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                          <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>Odometer</p>
                          <p className="mt-1 text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{odometer ? Number(odometer).toLocaleString() : 'Missing'}</p>
                        </div>
                        <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                          <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>Fuel</p>
                          <p className="mt-1 text-sm font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>{fuel.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                    </div>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl px-4 py-3 transition-all" style={{
                      backgroundColor: conditionConfirmed ? 'rgba(34,197,94,0.08)' : 'var(--bg-card-hover)',
                      border: conditionConfirmed ? '2px solid rgba(34,197,94,0.3)' : '2px solid var(--border-subtle)',
                    }}>
                      <input type="checkbox" checked={conditionConfirmed} onChange={e => setConditionConfirmed(e.target.checked)}
                        className="mt-0.5 h-5 w-5 shrink-0 rounded accent-[#22c55e]" />
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        I inspected the vehicle and confirm these photos document its pickup condition.
                      </span>
                    </label>
                    <FlowFooter
                      onBack={() => setCheckInStep(2)}
                      nextLabel="Reveal key code"
                      onNext={handleCheckIn}
                      nextDisabled={!conditionConfirmed || !allSlotsReady || !odometer}
                      loading={actionLoading}
                      accent={checkInAccent}
                      submit
                    />
                  </>
                )}
              </FlowShell>
            );
            return (
              <>
                {activePortalTab === 'pickup' && (
                  <HandoffLauncherCard
                    mode="pickup"
                    title="Check in step by step"
                    body="Open the guided flow when you are at the vehicle. The lockbox code appears after photos and details are submitted."
                    cta="Start check-in"
                    onOpen={openCheckInWizard}
                    accent={checkInAccent}
                  />
                )}
                <Sheet
                  open={checkInSheetOpen}
                  onOpenChange={(o) => {
                    setCheckInSheetOpen(o);
                    if (o) setCheckInStep(0);
                  }}
                  title="Check in to your rental"
                  maxWidth="34rem"
                >
                  {formBody}
                </Sheet>
              </>
            );
          })()}

          {/* Lockbox Code - only revealed AFTER successful check-in.
              The entire code block is a single tap target on mobile so the
              user can reveal the key without precision-tapping a small button. */}
          <AnimatePresence>
            {lockbox && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.5, ease: EASE.dramatic }}
                className="p-6 sm:p-8 rounded-2xl text-center"
                style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '2px solid rgba(245,158,11,0.25)' }}
              >
                <Key size={36} className="mx-auto mb-4" style={{ color: '#f59e0b' }} />
                <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: '#f59e0b' }}>
                  Your Lockbox Code
                </p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(lockbox);
                    setLockboxCopied(true);
                    window.setTimeout(() => setLockboxCopied(false), 1800);
                  }}
                  aria-label={`Copy lockbox code ${lockbox}`}
                  className="block w-full rounded-2xl px-4 py-3 mb-3 active:scale-[0.98] transition-transform cursor-pointer"
                  style={{
                    backgroundColor: 'rgba(245,158,11,0.04)',
                    border: '1px dashed rgba(245,158,11,0.35)',
                  }}
                >
                  <p
                    className="text-5xl sm:text-6xl font-black tracking-[0.4em] font-mono select-all"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {lockbox}
                  </p>
                </button>
                <AnimatePresence mode="wait">
                  {lockboxCopied ? (
                    <motion.div
                      key="copied"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.18 }}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold"
                      style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#15803d' }}
                    >
                      <CheckCircle2 size={16} /> Copied!
                    </motion.div>
                  ) : (
                    <motion.button
                      key="copy"
                      type="button"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18 }}
                      onClick={() => {
                        navigator.clipboard?.writeText(lockbox);
                        setLockboxCopied(true);
                        window.setTimeout(() => setLockboxCopied(false), 1800);
                      }}
                      className="tap-target inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-semibold transition-transform hover:scale-105 active:scale-95"
                      style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}
                    >
                      Tap to Copy
                    </motion.button>
                  )}
                </AnimatePresence>
                <p className="text-xs mt-3" style={{ color: 'var(--text-tertiary)' }}>
                  Use this code to retrieve the key from the lockbox at the pickup location.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Self-Service Check-Out (active) */}
          {status === 'active' && (() => {
            const checkOutSteps = ['Park', 'Photos', 'Details', 'Finish'];
            const checkOutAccent = 'var(--accent-color, #B8941E)';
            const formBody = (
              <FlowShell
                title="Return your vehicle"
                subtitle="A focused return flow: park, capture photos, confirm readings, then finish the trip."
                steps={checkOutSteps}
                current={checkOutStep}
                accent={checkOutAccent}
              >
                {checkOutStep === 0 && (
                  <>
                    <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)' }}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--accent-color) 14%, transparent)' }}>
                          <MapPin size={18} style={{ color: 'var(--accent-color)' }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--text-tertiary)' }}>
                            Return location
                          </p>
                          <p className="text-sm font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
                            {brand.location.address}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            {brand.location.city}, {brand.location.state} {brand.location.zip}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-3">
                      {[
                        ['1', 'Park in the approved return area.'],
                        ['2', 'Place the key back in the lockbox.'],
                        ['3', 'Take photos and submit the return.'],
                      ].map(([n, text]) => (
                        <div key={n} className="flex items-center gap-3 rounded-2xl p-3" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                          <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black" style={{ backgroundColor: 'color-mix(in srgb, var(--accent-color) 14%, transparent)', color: 'var(--accent-color)' }}>
                            {n}
                          </span>
                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{text}</span>
                        </div>
                      ))}
                    </div>
                    <FlowFooter nextLabel="Start photos" onNext={() => setCheckOutStep(1)} accent={checkOutAccent} />
                  </>
                )}
                {checkOutStep === 1 && (
                  <>
                    {token && (
                      <SlotPhotoUploader
                        token={token}
                        onSlotsChange={(slots, ready) => {
                          setReturnPhotoSlots(slots);
                          setReturnSlotsReady(ready);
                        }}
                      />
                    )}
                    {!returnSlotsReady && (
                      <p className="text-[11px] text-center" style={{ color: 'var(--text-tertiary)' }}>
                        Upload all 4 required photos to continue
                      </p>
                    )}
                    <FlowFooter
                      onBack={() => setCheckOutStep(0)}
                      nextLabel="Return details"
                      onNext={() => setCheckOutStep(2)}
                      nextDisabled={!returnSlotsReady}
                      accent={checkOutAccent}
                    />
                  </>
                )}
                {checkOutStep === 2 && (
                  <>
                    <div className="rounded-2xl p-4" style={{ backgroundColor: 'color-mix(in srgb, var(--accent-color) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-color) 24%, transparent)' }}>
                      <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--accent-color)' }}>Return details</p>
                      <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        Record the final mileage and fuel level before you lock up.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                          <Gauge size={12} className="inline mr-1" />Odometer *
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          placeholder="e.g. 42410"
                          value={returnOdometer}
                          onChange={e => setReturnOdometer(e.target.value)}
                          className="w-full px-3 py-3 rounded-xl text-base font-mono"
                          style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', outline: 'none' }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                          <Fuel size={12} className="inline mr-1" />Fuel Level *
                        </label>
                        <select
                          value={returnFuel}
                          onChange={e => setReturnFuel(e.target.value)}
                          className="w-full px-3 py-3 rounded-xl text-base"
                          style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', outline: 'none', appearance: 'none' as const }}
                        >
                          <option value="full">Full</option>
                          <option value="three_quarter">¾ Tank</option>
                          <option value="half">½ Tank</option>
                          <option value="quarter">¼ Tank</option>
                          <option value="empty">Empty</option>
                        </select>
                      </div>
                    </div>
                    <FlowFooter
                      onBack={() => setCheckOutStep(1)}
                      nextLabel="Review return"
                      onNext={() => setCheckOutStep(3)}
                      nextDisabled={!returnOdometer}
                      accent={checkOutAccent}
                    />
                  </>
                )}
                {checkOutStep === 3 && (
                  <>
                    <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                      <div className="flex items-center gap-2">
                        <ClipboardCheck size={18} style={{ color: 'var(--accent-color)' }} />
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Final return check</p>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                          <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>Photos</p>
                          <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{returnSlotsReady ? '4 saved' : 'Missing'}</p>
                        </div>
                        <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                          <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>Odometer</p>
                          <p className="mt-1 text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{returnOdometer ? Number(returnOdometer).toLocaleString() : 'Missing'}</p>
                        </div>
                        <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                          <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--text-tertiary)' }}>Fuel</p>
                          <p className="mt-1 text-sm font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>{returnFuel.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                    </div>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl px-4 py-3 transition-all" style={{
                      backgroundColor: keyReturned ? 'color-mix(in srgb, var(--accent-color) 10%, transparent)' : 'var(--bg-card-hover)',
                      border: keyReturned ? '2px solid color-mix(in srgb, var(--accent-color) 28%, transparent)' : '2px solid var(--border-subtle)',
                    }}>
                      <input type="checkbox" checked={keyReturned} onChange={e => setKeyReturned(e.target.checked)}
                        className="mt-0.5 h-5 w-5 shrink-0 rounded accent-[var(--accent-color)]" />
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        I returned the key to the lockbox, removed my belongings, and parked the vehicle.
                      </span>
                    </label>
                    <FlowFooter
                      onBack={() => setCheckOutStep(2)}
                      nextLabel="Complete return"
                      onNext={handleCheckOut}
                      nextDisabled={!keyReturned || !returnSlotsReady || !returnOdometer}
                      loading={actionLoading}
                      accent={checkOutAccent}
                      submit
                    />
                  </>
                )}
              </FlowShell>
            );
            return (
              <>
                {activePortalTab === 'pickup' && (
                  <HandoffLauncherCard
                    mode="return"
                    title="Return step by step"
                    body="Open the guided return flow when the vehicle is parked. Photos, mileage, fuel, and key return are captured together."
                    cta="Start return"
                    onOpen={openCheckOutWizard}
                    accent={checkOutAccent}
                  />
                )}
                <Sheet
                  open={checkOutSheetOpen}
                  onOpenChange={(o) => {
                    setCheckOutSheetOpen(o);
                    if (o) setCheckOutStep(0);
                  }}
                  title="Return your vehicle"
                  maxWidth="34rem"
                >
                  {formBody}
                </Sheet>
              </>
            );
          })()}

          {/* Extend rental + payment method on file (active rentals) */}
          {status === 'active' && activePortalTab === 'money' && token && (
            <ExtendRentalCard
              booking={booking}
              token={token}
              theme={theme}
              onExtended={loadBooking}
            />
          )}

          {['ready_for_pickup', 'active'].includes(status) && activePortalTab === 'money' && token && (
            <PaymentMethodCard token={token} theme={theme} />
          )}

          {token && activePortalTab === 'money' && plan?.plan?.status === 'active' && (
            <PaymentPlanCard data={plan} />
          )}

          {token && activePortalTab === 'money' && plan?.plan?.status !== 'active' && (
            <BalanceDueCard token={token} theme={theme} onPaid={loadBooking} />
          )}

          {/* ── Customer Check-In Record (under Return Vehicle, active only) ── */}
          {status === 'active' && activePortalTab === 'pickup' && booking.checkinRecords && (() => {
            const customerCheckin = booking.checkinRecords.find((r: any) => r.record_type === 'customer_checkin');
            if (!customerCheckin) return null;
            const allPhotos = customerCheckin.photo_urls || [];
            const fuelLabels: Record<string, string> = { full: 'Full', three_quarter: '¾ Tank', half: '½ Tank', quarter: '¼ Tank', empty: 'Empty' };

            return (
              <CollapsibleSection
                title="Your check-in record"
                icon={Camera}
                rightHint={customerCheckin.created_at ? fmt(customerCheckin.created_at) : undefined}
              >
                <div className="space-y-3 pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                      <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-tertiary)' }}>
                        <Gauge size={10} className="inline mr-1" />Odometer
                      </p>
                      <p className="text-sm font-semibold font-mono" style={{ color: 'var(--text-primary)' }}>
                        {customerCheckin.odometer ? Number(customerCheckin.odometer).toLocaleString() : 'N/A'} mi
                      </p>
                    </div>
                    <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                      <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-tertiary)' }}>
                        <Fuel size={10} className="inline mr-1" />Fuel Level
                      </p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {fuelLabels[customerCheckin.fuel_level] || customerCheckin.fuel_level || 'N/A'}
                      </p>
                    </div>
                  </div>

                  {allPhotos.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: 'var(--text-tertiary)' }}>
                        Pickup photos
                      </p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {allPhotos.map((url: string, i: number) => (
                          <div key={i} className="aspect-square rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                            <img src={url} alt={`Check-in ${i + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            );
          })()}

          {/* ── Emergency tap-to-call (active, under Return Vehicle) ── */}
          {status === 'active' && activePortalTab === 'help' && (
            <motion.a
              href={`tel:${brand.phone.replace(/[^\d+]/g, '')}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ease: EASE.standard }}
              className="flex items-center gap-3 p-4 rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{
                backgroundColor: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(239,68,68,0.12)' }}>
                <Phone size={16} style={{ color: '#ef4444' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#ef4444' }}>Emergency · Tap to call</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{brand.phone}</p>
              </div>
              <ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} />
            </motion.a>
          )}

          {/* ── Safety & return guide (active, collapsed) ── */}
          {status === 'active' && activePortalTab === 'pickup' && (
            <CollapsibleSection title="Safety & return guide" icon={Shield}>
              <div className="space-y-2 pt-3">
                <div className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.1)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#f59e0b' }}>
                    <AlertCircle size={11} className="inline mr-1 -mt-0.5" /> If You're in an Accident
                  </p>
                  <ol className="text-xs leading-relaxed space-y-0.5 pl-4" style={{ color: 'var(--text-secondary)', listStyleType: 'decimal' }}>
                    <li>Ensure everyone is safe. Call 911 if needed</li>
                    <li>Exchange info with the other driver</li>
                    <li>Take photos of all vehicles and the scene</li>
                    <li>Call {brand.name} at {brand.phone} immediately</li>
                  </ol>
                </div>

                <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                    <Key size={11} className="inline mr-1 -mt-0.5" style={{ color: 'var(--accent-color)' }} /> Returning the Vehicle
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    Park at the pickup location, place the key back in the lockbox, and complete the return form below.
                  </p>
                </div>
              </div>
            </CollapsibleSection>
          )}

          {/* Deposit & Invoice (returned / completed) */}
          {['returned', 'completed'].includes(status) && activePortalTab === 'money' && (
            <motion.div
              id="portal-inspection"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, ease: EASE.standard }}
              style={{ ...card(theme), scrollMarginTop: '100px' }}
            >
              <div className="p-5 space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <DollarSign size={20} style={{ color: 'var(--accent-color)' }} /> Settlement
                </h3>

                {/* Pending-inspection banner - shown only while we're still
                    inspecting. Mirrors the same visual rhythm as the welcome
                    note above the vehicle photo. */}
                {status === 'returned' && (
                  <div
                    className="px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2"
                    style={{
                      backgroundColor: 'rgba(245,158,11,0.08)',
                      border: '1px solid rgba(245,158,11,0.22)',
                      color: '#b45309',
                    }}
                  >
                    <Clock size={13} className="shrink-0" />
                    Pending inspection. Final settlement posts once we've reviewed the vehicle.
                  </div>
                )}

                {/* Deposit */}
                {booking.deposit && (
                  <div className="flex items-center justify-between p-3 rounded-xl" style={{
                    backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)',
                  }}>
                    <div>
                      <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--text-tertiary)' }}>Security Deposit</p>
                      <p className="text-lg font-bold tabular-nums mt-0.5" style={{ color: 'var(--text-primary)' }}>
                        {money(booking.deposit.amount)}
                      </p>
                    </div>
                    <span className="text-xs font-semibold px-3 py-1 rounded-full capitalize" style={{
                      backgroundColor: booking.deposit.status === 'refunded' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                      color: booking.deposit.status === 'refunded' ? '#22c55e' : '#f59e0b',
                    }}>
                      {booking.deposit.status}
                    </span>
                  </div>
                )}

                {/* Invoice */}
                {booking.invoice && (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--text-tertiary)' }}>Invoice</p>
                    {(booking.invoice.items || []).map((item: any, i: number) => (
                      <div key={i} className="flex justify-between text-sm py-1" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{item.description}</span>
                        <span className="font-medium tabular-nums" style={{ color: 'var(--text-primary)' }}>{money(item.amount)}</span>
                      </div>
                    ))}
                    {booking.invoice.amount_due !== 0 && (
                      <div className="flex justify-between font-semibold pt-2" style={{ color: 'var(--text-primary)' }}>
                        <span>{booking.invoice.amount_due > 0 ? 'Amount Due' : 'Refund Due'}</span>
                        <span className={`tabular-nums ${booking.invoice.amount_due > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                          {money(Math.abs(booking.invoice.amount_due))}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Dispute */}
                {booking.invoice && !disputeSuccess && (
                  <div className="pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-tertiary)' }}>
                      Disagree with a charge?
                    </p>
                    <textarea
                      className="w-full px-3 py-2.5 rounded-xl text-sm resize-none mb-3"
                      rows={3}
                      style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                      placeholder="Explain what you disagree with…"
                      value={disputeReason}
                      onChange={e => setDisputeReason(e.target.value)}
                    />
                    {token && (
                      <PhotoUploader
                        token={token}
                        onPhotosChange={setDisputePhotos}
                        maxPhotos={5}
                        label="Supporting Photos"
                        hint="Upload photos that support your dispute (optional)"
                      />
                    )}
                    <button
                      onClick={handleDispute}
                      disabled={disputeSubmitting || !disputeReason.trim()}
                      className="mt-2 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all hover:scale-[1.02] disabled:opacity-50"
                      style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                    >
                      <MessageSquare size={13} />
                      {disputeSubmitting ? 'Submitting…' : 'Submit Dispute'}
                    </button>
                  </div>
                )}

                {disputeSuccess && (
                  <div className="p-3 rounded-xl text-sm" style={{
                    backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e',
                  }}>
                    <Check size={14} className="inline mr-2" />
                    Your dispute has been submitted. We'll review it and follow up within 24 hours.
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Review prompt - completed rentals only */}
          {status === 'completed' && activePortalTab === 'overview' && !reviewDone && (
            <motion.div
              id="portal-review"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, ease: EASE.standard }}
              style={{ ...card(theme), scrollMarginTop: '100px' }}
            >
              <div className="p-5 space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Star size={16} style={{ color: 'var(--accent-color)' }} /> How was your rental?
                </h3>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => setReviewRating(n)}
                      className="transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                      aria-label={`${n} star${n !== 1 ? 's' : ''}`}
                    >
                      <Star
                        size={28}
                        fill={n <= reviewRating ? 'var(--accent-color)' : 'none'}
                        stroke={n <= reviewRating ? 'var(--accent-color)' : 'var(--text-tertiary)'}
                        strokeWidth={1.5}
                      />
                    </button>
                  ))}
                </div>
                <textarea
                  rows={3}
                  value={reviewComment}
                  onChange={e => setReviewComment(e.target.value)}
                  placeholder={`Tell ${brand.name} how it went…`}
                  className="w-full px-3 py-2.5 rounded-xl text-sm resize-none"
                  style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                />
                <button
                  disabled={reviewSubmitting || !reviewComment.trim()}
                  onClick={async () => {
                    setReviewSubmitting(true);
                    try {
                      const res = await fetch(`${API_URL}/reviews`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          booking_code: bookingCode,
                          reviewer_name: booking?.customer_name || 'Guest',
                          rating: reviewRating,
                          comment: reviewComment.trim(),
                          vehicle_name: booking?.vehicle_name || undefined,
                        }),
                      });
                      if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        throw new Error(data.error || 'Could not submit your review');
                      }
                      setReviewDone(true);
                    } catch (err: any) {
                      setError(err.message || 'Could not submit your review');
                    }
                    setReviewSubmitting(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-fg)' }}
                >
                  {reviewSubmitting ? 'Sending…' : 'Submit Review'}
                </button>
              </div>
            </motion.div>
          )}
          {status === 'completed' && activePortalTab === 'overview' && reviewDone && (
            <div className="rounded-2xl p-4 text-center text-sm" style={{
              backgroundColor: 'color-mix(in srgb, var(--accent-color) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-color) 20%, transparent)', color: 'var(--accent-color)',
            }}>
              Thank you. {brand.name} appreciates the feedback!
            </div>
          )}

          {/* ── Pending Overage Charges (post-inspection, 48h dispute window) ── */}
          {pendingCharges.length > 0 && activePortalTab === 'money' && (
            <div className="rounded-2xl overflow-hidden" style={{ border: '2px solid rgba(245,158,11,0.25)', backgroundColor: 'rgba(245,158,11,0.04)' }}>
              <div className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(245,158,11,0.15)' }}>
                    <AlertCircle size={18} style={{ color: '#b45309' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Inspection Charges</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      You have 48 hours from when each charge was scheduled to dispute it before it's processed against your card on file.
                    </p>
                  </div>
                </div>

                {pendingCharges.map((charge: any) => {
                  const scheduled = new Date(charge.scheduled_for);
                  const hoursLeft = Math.max(0, Math.round((scheduled.getTime() - Date.now()) / 3600000));
                  const disputable = charge.status === 'pending' && hoursLeft > 0;
                  const statusColor = charge.status === 'disputed' ? '#3b82f6'
                    : charge.status === 'succeeded' ? '#15803d'
                    : charge.status === 'failed' ? '#ef4444'
                    : '#b45309';
                  return (
                    <div key={charge.id} className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{charge.description}</p>
                          <p className="text-xs mt-0.5 capitalize" style={{ color: statusColor }}>
                            {charge.status}{disputable ? ` · ${hoursLeft}h to dispute` : charge.status === 'pending' ? ' · processing soon' : ''}
                          </p>
                        </div>
                        <p className="text-base font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                          ${(charge.amount_cents / 100).toFixed(2)}
                        </p>
                      </div>
                      {disputable && (
                        <div className="mt-3 space-y-2">
                          <textarea
                            rows={2}
                            placeholder="Tell us why you're disputing this charge…"
                            value={overageDisputeMsg[charge.id] || ''}
                            onChange={e => setOverageDisputeMsg((prev: Record<string, string>) => ({ ...prev, [charge.id]: e.target.value }))}
                            className="w-full text-xs px-3 py-2 rounded-lg resize-none"
                            style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                          />
                          <button
                            type="button"
                            onClick={() => handleOverageDispute(charge.id)}
                            disabled={overageDisputingId === charge.id || !(overageDisputeMsg[charge.id] || '').trim()}
                            className="text-xs font-semibold px-3 py-1.5 rounded-full disabled:opacity-50"
                            style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}
                          >
                            {overageDisputingId === charge.id ? 'Submitting…' : 'Dispute charge'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Itemized Receipt (collapsed) ──────────────────── */}
          {(() => {
            const fmtMoney = (n: any) => `$${Number(n || 0).toFixed(2)}`;
            const rentalPayment = (booking.payments || []).find((p: any) => p.payment_type === 'rental' && p.status === 'completed');
            const depositPayment = (booking.payments || []).find((p: any) => p.payment_type === 'deposit' && p.status === 'completed');
            const totalPaid = (booking.payments || [])
              .filter((p: any) => p.status === 'completed')
              .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
            const paidAt = rentalPayment?.paid_at || depositPayment?.paid_at;
            const methodLabel = rentalPayment
              ? (rentalPayment.method === 'stripe' ? 'Card via Stripe' : rentalPayment.method)
              : null;
            const totalHint = totalPaid > 0 ? fmtMoney(totalPaid) : fmtMoney(booking.total_cost);

            if (activePortalTab !== 'money') return null;
            return (
              <CollapsibleSection title="Itemized receipt" icon={Receipt} rightHint={totalHint}>
                <div className="space-y-4 pt-3 text-sm">
                  {/* Payment header */}
                  {(methodLabel || paidAt) && (
                    <div
                      className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)' }}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--accent-glow)' }}>
                        <CreditCard size={14} style={{ color: 'var(--accent-color)' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{methodLabel || 'Payment on file'}</p>
                        {paidAt && (
                          <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                            Paid {fmt(paidAt)}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Charges */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: 'var(--text-tertiary)' }}>Rental Charges</p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                        <span>{fmtMoney(booking.daily_rate)}/day × {booking.rental_days} day{booking.rental_days !== 1 ? 's' : ''}</span>
                        <span>{fmtMoney(booking.subtotal)}</span>
                      </div>
                      {Number(booking.delivery_fee) > 0 && (
                        <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                          <span>Delivery fee</span>
                          <span>{fmtMoney(booking.delivery_fee)}</span>
                        </div>
                      )}
                      {Number(booking.mileage_addon_fee) > 0 && (
                        <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                          <span>Unlimited miles add-on</span>
                          <span>{fmtMoney(booking.mileage_addon_fee)}</span>
                        </div>
                      )}
                      {Number(booking.toll_addon_fee) > 0 && (
                        <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                          <span>Unlimited tolls add-on</span>
                          <span>{fmtMoney(booking.toll_addon_fee)}</span>
                        </div>
                      )}
                      {Number(booking.discount_amount) > 0 && (
                        <div className="flex justify-between" style={{ color: '#22c55e' }}>
                          <span>Discount</span>
                          <span>-{fmtMoney(booking.discount_amount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                        <span>FL sales tax</span>
                        <span>{fmtMoney(booking.tax_amount)}</span>
                      </div>
                      <div className="flex justify-between font-semibold pt-2" style={{
                        borderTop: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
                      }}>
                        <span>Rental total</span>
                        <span>{fmtMoney(booking.total_cost)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Deposit */}
                  {Number(booking.deposit_amount) > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: 'var(--text-tertiary)' }}>Security Deposit</p>
                      <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                        <span>Refundable hold</span>
                        <span>{fmtMoney(booking.deposit_amount)}</span>
                      </div>
                      <p className="text-[11px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
                        Returned 3 to 5 business days after vehicle inspection.
                      </p>
                    </div>
                  )}

                  {/* Total charged */}
                  {totalPaid > 0 && (
                    <div className="flex justify-between font-bold pt-3" style={{
                      borderTop: '1px solid var(--border-subtle)', color: 'var(--text-primary)',
                    }}>
                      <span>Total charged</span>
                      <span className="font-mono">{fmtMoney(totalPaid)}</span>
                    </div>
                  )}

                  {/* Payment ledger */}
                  {(booking.payments || []).length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: 'var(--text-tertiary)' }}>Payment History</p>
                      <div className="space-y-1.5">
                        {booking.payments.map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                            <span className="capitalize">{p.payment_type} · {p.status}{p.paid_at ? ` · ${fmt(p.paid_at)}` : ''}</span>
                            <span className="font-mono">{fmtMoney(p.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            );
          })()}

          {/* ── Add-Ons (collapsed, below receipt) ───────────────────────────── */}
          {activePortalTab === 'money' && (booking.unlimited_miles || booking.unlimited_tolls || (booking.addons && booking.addons.length > 0)) && (
            <CollapsibleSection title="Your add-ons" icon={Gauge}>
              <div className="space-y-2 pt-3">
                <div className="space-y-2">
                  {(booking.unlimited_miles || booking.addons.some((a: any) => a.addon_type === 'unlimited_miles')) && (
                    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(34,197,94,0.15)' }}>
                        <Gauge size={16} style={{ color: '#22c55e' }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Unlimited Miles</p>
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No mileage restrictions. Drive as far as you want</p>
                      </div>
                    </div>
                  )}
                  {(booking.unlimited_tolls || booking.addons.some((a: any) => a.addon_type === 'unlimited_tolls')) && (
                    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(59,130,246,0.15)' }}>
                        <Shield size={16} style={{ color: '#3b82f6' }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Unlimited Tolls</p>
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>SunPass/toll coverage included</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CollapsibleSection>
          )}

          {/* Contact footer */}
          {activePortalTab === 'help' && (
          <>
          {/* Push notifications opt-in - renders only when supported/configured. */}
          <PushOptInCard status={status as any} portalToken={token} />

          <div
            id="portal-message"
            className="flex flex-col items-center gap-3 py-5 text-xs"
            style={{ color: 'var(--text-tertiary)', scrollMarginTop: '100px' }}
          >
            <button
              onClick={() => {
                try { openCrispChat(); }
                catch { window.location.href = `tel:${brand.phone.replace(/[^\d+]/g, '')}`; }
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm transition-all hover:scale-[1.03] active:scale-95 cursor-pointer"
              style={{ backgroundColor: 'color-mix(in srgb, var(--accent-color) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-color) 30%, transparent)', color: 'var(--accent-color)' }}
            >
              <MessageSquare size={14} />
              Message Us
            </button>
            <span>
              Or call <a href={`tel:${brand.phone.replace(/[^\d+]/g, '')}`} style={{ color: 'var(--accent-color)' }}>{brand.phone}</a>
            </span>
          </div>
          </>
          )}
        </div>
      </main>

      {/* Sticky bottom CTA - phone-only, per-state primary action.
          Sprint 7c: ready_for_pickup + active states now open a Vaul
          bottom-sheet form instead of scrolling to a long inline section. */}
      {!checkInSheetOpen && !checkOutSheetOpen && activePortalTab !== 'overview' && ['ready_for_pickup', 'active'].includes(status) && (
        <PortalActionBar
          status={status as any}
          disabled={actionLoading}
          onCheckIn={openCheckInWizard}
          onCheckOut={openCheckOutWizard}
        />
      )}

      <Footer />
      {/* F-16: mount once at the portal root, toggle visibility via prop. */}
      <CrispWidget booking={booking} visible={view === 'dashboard'} />
    </>
  );
}
