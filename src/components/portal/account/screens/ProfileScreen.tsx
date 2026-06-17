/**
 * ProfileScreen — the customer's account + personal details.
 * Avatar upload, inline editing of contact/address, change-password, sign-out.
 */
import { useRef, useState } from 'react';
import { Mail, Phone, MapPin, KeyRound, LogOut, ChevronRight, Camera, Loader2, Pencil, Check, X } from 'lucide-react';
import { useAccountAuth } from '../AccountAuthContext';
import SetPasswordScreen from '../SetPasswordScreen';
import { uploadAvatar, updateProfile, type PortalCustomer } from '../portalClient';
import { brand } from '../../../../config/brand';

function initials(first?: string, last?: string) {
  return `${(first || '').charAt(0)}${(last || '').charAt(0)}`.toUpperCase() || '?';
}

const EDIT_FIELDS: { key: keyof PortalCustomer; label: string; placeholder: string }[] = [
  { key: 'phone', label: 'Phone', placeholder: '(772) 555-0100' },
  { key: 'address_line1', label: 'Address', placeholder: 'Street address' },
  { key: 'address_line2', label: 'Apt / unit', placeholder: 'Apt, suite (optional)' },
  { key: 'city', label: 'City', placeholder: 'City' },
  { key: 'state', label: 'State', placeholder: 'FL' },
  { key: 'zip', label: 'ZIP', placeholder: '34952' },
];

export default function ProfileScreen() {
  const { customer, username, token, logout, setCustomer } = useAccountAuth();
  const [changingPw, setChangingPw] = useState(false);
  const [editing, setEditing] = useState(false);

  if (changingPw) return <SetPasswordScreen onDone={() => setChangingPw(false)} />;
  if (!customer) return null;

  const accent = brand.colors.accent;
  const address = [customer.address_line1, customer.city, customer.state, customer.zip].filter(Boolean).join(', ');

  return (
    <div className="px-5 pt-6">
      <h1 className="text-2xl font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>Profile</h1>

      {/* Identity card with avatar upload */}
      <div
        className="rounded-2xl p-5 flex items-center gap-4 mb-5"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <AvatarUploader
          customer={customer}
          token={token}
          accent={accent}
          onUploaded={(c) => setCustomer(c)}
        />
        <div className="min-w-0">
          <p className="text-base font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {customer.first_name} {customer.last_name}
          </p>
          {username && <p className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>@{username}</p>}
        </div>
      </div>

      {/* Personal details — view or edit */}
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
          Personal details
        </h2>
        {!editing && (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs" style={{ color: accent }}>
            <Pencil size={13} /> Edit
          </button>
        )}
      </div>

      {editing ? (
        <EditForm
          customer={customer}
          token={token}
          onCancel={() => setEditing(false)}
          onSaved={(c) => { setCustomer(c); setEditing(false); }}
        />
      ) : (
        <div
          className="rounded-2xl overflow-hidden mb-5"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <Row icon={Mail} label="Email" value={customer.email} />
          <Divider />
          <Row icon={Phone} label="Phone" value={customer.phone} />
          {address && (<><Divider /><Row icon={MapPin} label="Address" value={address} /></>)}
        </div>
      )}

      {/* Account actions */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <button onClick={() => setChangingPw(true)} className="w-full flex items-center gap-3 px-4 py-4 text-left">
          <KeyRound size={18} style={{ color: 'var(--text-secondary)' }} />
          <span className="text-sm flex-1" style={{ color: 'var(--text-primary)' }}>Change password</span>
          <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} />
        </button>
        <Divider />
        <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-4 text-left">
          <LogOut size={18} style={{ color: '#ef4444' }} />
          <span className="text-sm flex-1" style={{ color: '#ef4444' }}>Sign out</span>
        </button>
      </div>

      <p className="text-xs text-center mt-6" style={{ color: 'var(--text-tertiary)' }}>{brand.name}</p>
    </div>
  );
}

function AvatarUploader({
  customer, token, accent, onUploaded,
}: {
  customer: PortalCustomer;
  token: string | null;
  accent: string;
  onUploaded: (c: PortalCustomer) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file || !token) return;
    setBusy(true); setError('');
    try {
      const res = await uploadAvatar(token, file);
      onUploaded(res.customer);
    } catch (err: any) {
      setError(err?.message || 'Upload failed');
    }
    setBusy(false);
  }

  return (
    <div className="shrink-0">
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="relative w-16 h-16 rounded-full flex items-center justify-center text-lg font-semibold overflow-hidden"
        style={{ background: accent, color: '#0a0a0a' }}
        aria-label="Change profile photo"
      >
        {customer.avatar_url
          ? <img src={customer.avatar_url} alt="" className="w-full h-full object-cover" />
          : initials(customer.first_name, customer.last_name)}
        <span
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.35)', opacity: busy ? 1 : 0 }}
        >
          {busy ? <Loader2 size={18} className="animate-spin text-white" /> : null}
        </span>
        <span
          className="absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <Camera size={12} style={{ color: 'var(--text-secondary)' }} />
        </span>
      </button>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={onPick} />
      {error && <p className="text-[10px] mt-1" style={{ color: '#ef4444' }}>{error}</p>}
    </div>
  );
}

function EditForm({
  customer, token, onCancel, onSaved,
}: {
  customer: PortalCustomer;
  token: string | null;
  onCancel: () => void;
  onSaved: (c: PortalCustomer) => void;
}) {
  const [form, setForm] = useState<Record<string, string>>(() => {
    const f: Record<string, string> = {};
    for (const { key } of EDIT_FIELDS) f[key as string] = (customer[key] as string) || '';
    return f;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!token) return;
    setBusy(true); setError('');
    try {
      const res = await updateProfile(token, form);
      onSaved(res.customer);
    } catch (err: any) {
      setError(err?.message || 'Could not save');
      setBusy(false);
    }
  }

  return (
    <div
      className="rounded-2xl p-4 mb-5 space-y-3"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      {EDIT_FIELDS.map(({ key, label, placeholder }) => (
        <div key={key as string}>
          <label className="text-[11px] block mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</label>
          <input
            value={form[key as string]}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            placeholder={placeholder}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
          />
        </div>
      ))}
      {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          disabled={busy}
          className="flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5"
          style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
        >
          <X size={15} /> Cancel
        </button>
        <button
          onClick={save}
          disabled={busy}
          className="flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5"
          style={{ background: brand.colors.accent, color: '#0a0a0a', opacity: busy ? 0.6 : 1 }}
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Save
        </button>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <Icon size={18} style={{ color: 'var(--text-secondary)' }} />
      <div className="min-w-0">
        <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
        <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{value || '—'}</p>
      </div>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, backgroundColor: 'var(--border-subtle)' }} />;
}
