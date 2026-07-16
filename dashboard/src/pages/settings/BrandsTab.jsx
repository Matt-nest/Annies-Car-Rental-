import { useState, useEffect } from 'react';
import {
  Plus, Save, X, Download, Trash2, Edit3, RefreshCw, Check,
  Globe, Phone, MapPin, Palette, Search as SearchIcon, FileText,
  Building2, Mail, DollarSign, Eye, AlertCircle, ChevronDown,
  ExternalLink,
} from 'lucide-react';
import { brandsApi } from '../../api/brands';
import InlineBanner from '../../components/shared/InlineBanner';

/* ─── Section wrapper (collapsible) ───────────────────── */
function FormSection({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
      >
        <span className="flex items-center gap-2">
          <Icon size={15} style={{ color: 'var(--accent-color)' }} />
          {title}
        </span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--text-tertiary)' }} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-[var(--border-subtle)]">
          {children}
        </div>
      )}
    </div>
  );
}

/* ─── Input field ─────────────────────────────────────── */
function Field({ label, value, onChange, placeholder, type = 'text', hint, required }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {type === 'textarea' ? (
        <textarea
          className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[#13294B] transition-colors resize-none"
          rows={3}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          type={type}
          className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[#13294B] transition-colors"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
      {hint && <p className="text-[10px] text-[var(--text-tertiary)] mt-1">{hint}</p>}
    </div>
  );
}

/* ─── Color picker with live preview ──────────────────── */
function ColorField({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || '#E79B3C'}
          onChange={e => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg border border-[var(--border-subtle)] cursor-pointer p-0.5"
          style={{ backgroundColor: 'var(--bg-card)' }}
        />
        <input
          type="text"
          className="flex-1 px-3 py-2.5 rounded-lg text-sm bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[#13294B] transition-colors font-mono"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder="#E79B3C"
        />
      </div>
    </div>
  );
}

/* ─── Mini brand preview card ─────────────────────────── */
function BrandPreview({ form }) {
  const accent = form.color_accent || '#E79B3C';
  return (
    <div
      className="rounded-xl p-4 border"
      style={{
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
        borderColor: 'rgba(255,255,255,0.08)',
      }}
    >
      <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
        Live Preview
      </p>
      <div className="flex items-center gap-3 mb-3">
        {form.logo_url ? (
          <img src={form.logo_url} alt="" className="w-8 h-8 rounded-lg object-contain" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
        ) : (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ backgroundColor: accent, color: '#0a0a0a' }}>
            {(form.name || 'B')[0]}
          </div>
        )}
        <div>
          <p className="text-sm font-semibold text-white">{form.name || 'Brand Name'}</p>
          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{form.city || 'City'}, {form.state || 'ST'}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <span
          className="px-3 py-1.5 rounded-full text-[10px] font-semibold"
          style={{ backgroundColor: accent, color: '#0a0a0a' }}
        >
          Book Now
        </span>
        <span
          className="px-3 py-1.5 rounded-full text-[10px] font-semibold border"
          style={{ borderColor: accent, color: accent }}
        >
          Call {form.phone || '(xxx) xxx-xxxx'}
        </span>
      </div>
      {form.domain && (
        <p className="text-[10px] mt-2 font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {form.domain}
        </p>
      )}
    </div>
  );
}

/* ─── Empty default form ──────────────────────────────── */
const EMPTY_FORM = {
  name: '', legal_entity: '', dba: '', domain: '',
  phone: '', email: '', owner_email: '',
  city: '', state: '', zip: '', address: '', timezone: 'America/New_York',
  color_accent: '#E79B3C', color_accent_dark: '#B8941E', logo_url: '',
  meta_description: '',
  stripe_prefix: '', review_link: '', chat_widget_id: '',
  tax_rate: '0.07', deposit_cents: '15000',
};

/* ════════════════════════════════════════════════════════
   BRANDS TAB (main export)
   ════════════════════════════════════════════════════════ */
export default function BrandsTab() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Editor state
  const [editing, setEditing] = useState(null); // null = list view, 'new' = create, uuid = edit
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => { loadBrands(); }, []);

  async function loadBrands() {
    setLoading(true);
    setError('');
    try {
      const data = await brandsApi.list();
      setBrands(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setEditing('new');
    setSaveError('');
    setSaved(false);
  }

  function openEdit(brand) {
    setForm({
      ...EMPTY_FORM,
      ...brand,
      tax_rate: String(brand.tax_rate ?? '0.07'),
      deposit_cents: String(brand.deposit_cents ?? '15000'),
    });
    setEditing(brand.id);
    setSaveError('');
    setSaved(false);
  }

  function closeEditor() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setSaveError('');
    setSaved(false);
  }

  async function handleSave() {
    if (!form.name?.trim()) {
      setSaveError('Brand name is required');
      return;
    }
    setSaving(true);
    setSaveError('');
    setSaved(false);
    try {
      const payload = {
        ...form,
        tax_rate: parseFloat(form.tax_rate) || 0.07,
        deposit_cents: parseInt(form.deposit_cents) || 15000,
      };

      if (editing === 'new') {
        await brandsApi.create(payload);
      } else {
        await brandsApi.update(editing, payload);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      await loadBrands();

      if (editing === 'new') {
        closeEditor();
      }
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Deactivate this brand? It can be reactivated later.')) return;
    try {
      await brandsApi.remove(id);
      await loadBrands();
      if (editing === id) closeEditor();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleExport(id) {
    try {
      await brandsApi.exportEnv(id);
    } catch (e) {
      setError(`Export failed: ${e.message}`);
    }
  }

  function setField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  // ─── Editor view ────────────────────────────────────────
  if (editing !== null) {
    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {editing === 'new' ? 'Create New Brand' : `Edit: ${form.name || 'Brand'}`}
            </h3>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              {editing === 'new' ? 'Set up a new white-label client' : 'Update brand configuration'}
            </p>
          </div>
          <button
            onClick={closeEditor}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all"
          >
            <X size={14} /> Close
          </button>
        </div>

        <div className="grid lg:grid-cols-[1fr_300px] gap-5">
          {/* Form */}
          <div className="space-y-4">
            <FormSection title="Identity" icon={Building2}>
              <Field label="Brand Name" value={form.name} onChange={v => setField('name', v)} placeholder="Sunshine Rentals" required />
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Legal Entity" value={form.legal_entity} onChange={v => setField('legal_entity', v)} placeholder="Sunshine Rentals LLC" />
                <Field label="DBA" value={form.dba} onChange={v => setField('dba', v)} placeholder="DBA Sunshine Rentals" />
              </div>
              <Field label="Domain" value={form.domain} onChange={v => setField('domain', v)} placeholder="sunshinerentals.com" hint="Used for email links, site URL, and dashboard URL" />
            </FormSection>

            <FormSection title="Contact" icon={Phone}>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Phone" value={form.phone} onChange={v => setField('phone', v)} placeholder="(305) 555-0199" />
                <Field label="Email" value={form.email} onChange={v => setField('email', v)} placeholder="info@sunshinerentals.com" type="email" />
              </div>
              <Field label="Owner Email" value={form.owner_email} onChange={v => setField('owner_email', v)} placeholder="owner@sunshinerentals.com" type="email" hint="Receives admin notifications and approval reminders" />
            </FormSection>

            <FormSection title="Location" icon={MapPin}>
              <Field label="Address" value={form.address} onChange={v => setField('address', v)} placeholder="123 Ocean Drive" />
              <div className="grid sm:grid-cols-3 gap-3">
                <Field label="City" value={form.city} onChange={v => setField('city', v)} placeholder="Miami" />
                <Field label="State" value={form.state} onChange={v => setField('state', v)} placeholder="FL" />
                <Field label="ZIP" value={form.zip} onChange={v => setField('zip', v)} placeholder="33139" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Timezone</label>
                <select
                  className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[#13294B] transition-colors"
                  value={form.timezone}
                  onChange={e => setField('timezone', e.target.value)}
                >
                  <option value="America/New_York">Eastern (New York)</option>
                  <option value="America/Chicago">Central (Chicago)</option>
                  <option value="America/Denver">Mountain (Denver)</option>
                  <option value="America/Los_Angeles">Pacific (Los Angeles)</option>
                </select>
              </div>
            </FormSection>

            <FormSection title="Visual Identity" icon={Palette}>
              <div className="grid sm:grid-cols-2 gap-3">
                <ColorField label="Accent Color (Dark Mode)" value={form.color_accent} onChange={v => setField('color_accent', v)} />
                <ColorField label="Accent Color (Light Mode)" value={form.color_accent_dark} onChange={v => setField('color_accent_dark', v)} />
              </div>
              <Field label="Logo URL" value={form.logo_url} onChange={v => setField('logo_url', v)} placeholder="https://cdn.example.com/logo.svg" hint="Direct URL to the brand's logo file (SVG or PNG)" />
            </FormSection>

            <FormSection title="SEO" icon={SearchIcon} defaultOpen={false}>
              <Field label="Meta Description" value={form.meta_description} onChange={v => setField('meta_description', v)} type="textarea" placeholder="Premium car rentals in Miami. Skip the airport lines..." hint="Appears in Google search results (150-160 characters recommended)" />
            </FormSection>

            <FormSection title="Integrations" icon={Globe} defaultOpen={false}>
              <Field label="Stripe Description Prefix" value={form.stripe_prefix} onChange={v => setField('stripe_prefix', v)} placeholder="Sunshine Rentals" hint="Appears on customer credit card statements" />
              <Field label="Google Review Link" value={form.review_link} onChange={v => setField('review_link', v)} placeholder="https://g.page/sunshine-rentals/review" />
              <Field label="Chat Widget ID" value={form.chat_widget_id} onChange={v => setField('chat_widget_id', v)} placeholder="Leave empty to disable" hint="LeadConnector widget ID — leave blank for no chat widget" />
            </FormSection>

            <FormSection title="Financial" icon={DollarSign} defaultOpen={false}>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Tax Rate" value={form.tax_rate} onChange={v => setField('tax_rate', v)} placeholder="0.07" hint="e.g. 0.07 = 7%" />
                <Field label="Default Deposit (cents)" value={form.deposit_cents} onChange={v => setField('deposit_cents', v)} placeholder="15000" hint="e.g. 15000 = $150.00" />
              </div>
            </FormSection>
          </div>

          {/* Sidebar: Preview + Actions */}
          <div className="space-y-4">
            <BrandPreview form={form} />

            {/* Save */}
            {saveError && (
              <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 p-3 rounded-lg">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                {saveError}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #13294B, #1E3A5F)', boxShadow: '0 4px 14px rgba(19,41,75,0.3)' }}
            >
              {saved ? <><Check size={14} /> Saved!</> : saving ? <><RefreshCw size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> {editing === 'new' ? 'Create Brand' : 'Save Changes'}</>}
            </button>

            {editing !== 'new' && (
              <button
                onClick={() => handleExport(editing)}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-medium border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all"
              >
                <Download size={14} /> Export .env File
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── List view ──────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">White-Label Brands</h3>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
            {brands.length} brand{brands.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #13294B, #1E3A5F)', boxShadow: '0 4px 14px rgba(19,41,75,0.3)' }}
        >
          <Plus size={14} /> New Brand
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 p-3 rounded-lg">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] py-8 justify-center">
          <RefreshCw size={14} className="animate-spin" /> Loading brands…
        </div>
      ) : brands.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="w-16 h-16 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center mx-auto">
            <Building2 size={28} style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <p className="text-sm font-medium text-[var(--text-primary)]">No brands yet</p>
          <p className="text-xs text-[var(--text-tertiary)] max-w-sm mx-auto">
            Create your first white-label brand to get started. Each brand gets its own identity, contact info, colors, and deployment configuration.
          </p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold text-white mt-2"
            style={{ background: 'linear-gradient(135deg, #13294B, #1E3A5F)' }}
          >
            <Plus size={14} /> Create First Brand
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Brand</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider hidden sm:table-cell">Domain</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider hidden md:table-cell">Location</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Color</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {brands.map(b => (
                <tr key={b.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ backgroundColor: b.color_accent || '#E79B3C', color: '#0a0a0a' }}
                      >
                        {(b.name || '?')[0]}
                      </div>
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">{b.name}</p>
                        <p className="text-[10px] text-[var(--text-tertiary)]">{b.legal_entity || b.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {b.domain ? (
                      <a href={`https://${b.domain}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--accent-color)] hover:underline inline-flex items-center gap-1">
                        {b.domain} <ExternalLink size={10} />
                      </a>
                    ) : (
                      <span className="text-xs text-[var(--text-tertiary)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-[var(--text-secondary)]">{b.city ? `${b.city}, ${b.state}` : '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div
                      className="w-6 h-6 rounded-full mx-auto border border-[var(--border-subtle)]"
                      style={{ backgroundColor: b.color_accent || '#E79B3C' }}
                      title={b.color_accent || '#E79B3C'}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full ${
                      b.is_active
                        ? 'text-green-400 bg-green-500/10'
                        : 'text-red-400 bg-red-500/10'
                    }`}>
                      {b.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(b)}
                        className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[#13294B] hover:bg-[rgba(19,41,75,0.08)] transition-all"
                        title="Edit"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleExport(b.id)}
                        className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all"
                        title="Download .env"
                      >
                        <Download size={14} />
                      </button>
                      {b.is_active && (
                        <button
                          onClick={() => handleDelete(b.id)}
                          className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="Deactivate"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
