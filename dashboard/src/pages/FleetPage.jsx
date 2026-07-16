import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Car, Plus, Search, ChevronDown, Upload, Link, X, Send, Copy, Check,
  ExternalLink, Loader2, LayoutGrid, Table2, Filter, SlidersHorizontal,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import StatusBadge from '../components/shared/StatusBadge';
import { SkeletonFleetGrid, SkeletonKpi } from '../components/shared/Skeleton';
import EmptyState from '../components/shared/EmptyState';
import DataError from '../components/shared/DataError';
import InlineBanner from '../components/shared/InlineBanner';
import Modal from '../components/shared/Modal';
import DamageSummaryWidget from '../components/dashboard/widgets/DamageSummaryWidget';
import brand from '../config/brand';

const MAIN_SITE = brand.siteUrl;
function resolveThumb(url) {
  if (!url) return '';
  return url.startsWith('/fleet/') ? `${MAIN_SITE}${url}` : url;
}

const EASE = [0.25, 1, 0.5, 1];

const EMPTY_VEHICLE = {
  vehicle_code: '', make: '', model: '', year: new Date().getFullYear(),
  category: 'sedan', daily_rate: '', weekly_rate: '', seats: 5,
  fuel_type: 'gasoline', transmission: 'automatic', thumbnail_url: '',
  mileage_limit_per_day: 150, status: 'available',
};

export default function FleetPage() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [imageError, setImageError] = useState('');
  const [filter, setFilter] = useState({ status: '', q: '', category: '', make: '', model: '' });
  const [viewMode, setViewMode] = useState('cards');
  const [addModal, setAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ ...EMPTY_VEHICLE });
  const [adding, setAdding] = useState(false);
  const [statusDropdown, setStatusDropdown] = useState(null);
  const navigate = useNavigate();

  const [imageMode, setImageMode] = useState('upload');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // ── Booking Link Modal ──────────────────────────────────────
  const [linkModal, setLinkModal] = useState(null); // vehicle object when open
  const [linkForm, setLinkForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    pickup_date: '', return_date: '', pickup_time: '10:00', return_time: '10:00',
  });
  const [linkCreating, setLinkCreating] = useState(false);
  const [linkResult, setLinkResult] = useState(null); // { continue_url, booking_code }
  const [linkError, setLinkError] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  async function loadVehicles() {
    setLoading(true);
    setLoadError(null);
    try { setVehicles(await api.getVehicles()); }
    catch (e) {
      console.error(e);
      setLoadError(e?.message || 'Could not load fleet');
    }
    setLoading(false);
  }

  useEffect(() => { loadVehicles(); }, []);

  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setImageError('File too large. Max 10MB.'); return; }
    setImageError('');
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setAddForm(f => ({ ...f, thumbnail_url: '' }));
  };

  const clearImageFile = () => {
    setImageFile(null);
    setImagePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  async function handleAdd() {
    setAdding(true);
    try {
      let thumbnailUrl = addForm.thumbnail_url;
      if (imageFile) {
        setUploading(true);
        const result = await api.uploadVehicleImage(imageFile);
        thumbnailUrl = result.url;
        setUploading(false);
      }
      const code = addForm.vehicle_code || `v-${addForm.make.toLowerCase()}-${addForm.model.toLowerCase().replace(/\s+/g, '')}`;
      await api.createVehicle({ ...addForm, vehicle_code: code, thumbnail_url: thumbnailUrl });
      setAddModal(false);
      setAddForm({ ...EMPTY_VEHICLE });
      clearImageFile();
      setImageMode('upload');
      await loadVehicles();
    } catch (e) { console.error(e); }
    setAdding(false);
    setUploading(false);
  }

  async function handleQuickStatus(vehicleId, newStatus, e) {
    e.stopPropagation();
    setStatusDropdown(null);
    try {
      await api.updateVehicleStatus(vehicleId, newStatus);
      setVehicles(vs => vs.map(v => v.id === vehicleId ? { ...v, status: newStatus } : v));
    } catch (err) { console.error(err); }
  }

  const categories = [...new Set(vehicles.map(v => v.category).filter(Boolean))].sort();
  const makes = [...new Set(vehicles.map(v => v.make).filter(Boolean))].sort();
  const models = [...new Set(vehicles.map(v => v.model).filter(Boolean))].sort();
  const hasAdvancedFilters = !!(filter.status || filter.category || filter.make || filter.model || filter.q);

  const filtered = vehicles.filter(v => {
    if (filter.status && v.status !== filter.status) return false;
    if (filter.category && v.category !== filter.category) return false;
    if (filter.make && v.make !== filter.make) return false;
    if (filter.model && v.model !== filter.model) return false;
    if (filter.q) {
      const q = filter.q.toLowerCase();
      return `${v.make} ${v.model} ${v.year} ${v.vehicle_code} ${v.category}`.toLowerCase().includes(q);
    }
    return true;
  });

  const clearFilters = () => setFilter({ status: '', q: '', category: '', make: '', model: '' });

  function openLinkModal(vehicle, e) {
    e.stopPropagation();
    setLinkModal(vehicle);
    setLinkForm({
      first_name: '', last_name: '', email: '', phone: '',
      pickup_date: '', return_date: '', pickup_time: '10:00', return_time: '10:00',
    });
    setLinkResult(null);
    setLinkError('');
    setLinkCopied(false);
  }

  async function handleCreateLink() {
    setLinkCreating(true);
    setLinkError('');
    try {
      const result = await api.createAdminBooking({
        vehicle_code: linkModal.vehicle_code,
        first_name: linkForm.first_name,
        last_name: linkForm.last_name,
        email: linkForm.email,
        phone: linkForm.phone,
        pickup_date: linkForm.pickup_date,
        return_date: linkForm.return_date,
        pickup_time: linkForm.pickup_time,
        return_time: linkForm.return_time,
      });
      setLinkResult(result);
    } catch (e) {
      setLinkError(e.message || 'Failed to create booking link');
    } finally {
      setLinkCreating(false);
    }
  }

  function handleCopyLink() {
    if (linkResult?.continue_url) {
      navigator.clipboard.writeText(linkResult.continue_url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  }

  return (
    <div className="page-shell lg:p-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Fleet</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Manage your vehicle inventory</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-1">
            {[
              { key: 'cards', label: 'Cards', icon: LayoutGrid },
              { key: 'sheet', label: 'Sheet', icon: Table2 },
            ].map(option => {
              const Icon = option.icon;
              const active = viewMode === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setViewMode(option.key)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors sm:flex-none"
                  style={{
                    backgroundColor: active ? 'var(--accent-glow)' : 'transparent',
                    color: active ? 'var(--accent-color)' : 'var(--text-secondary)',
                  }}
                  aria-pressed={active}
                >
                  <Icon size={14} /> {option.label}
                </button>
              );
            })}
          </div>
          <button onClick={() => setAddModal(true)} className="btn-primary w-full justify-center sm:w-auto">
            <Plus size={16} /> Add Vehicle
          </button>
        </div>
      </motion.div>

      <DataError message={loadError} onRetry={loadVehicles} />

      {/* Filters */}
      <section className="card p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-[var(--accent-color)]" />
            <p className="text-sm font-bold text-[var(--text-primary)]">Fleet filters</p>
            <span className="rounded-full bg-[var(--bg-card-hover)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-tertiary)]">
              {filtered.length}/{vehicles.length}
            </span>
          </div>
          {hasAdvancedFilters && (
            <button type="button" className="btn-ghost py-1.5 text-xs" onClick={clearFilters}>
              Clear
            </button>
          )}
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_150px_150px_150px_150px]">
          <div className="flex items-center gap-2 rounded-xl px-4 py-3 min-w-0"
            style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
            <Search size={15} style={{ color: 'var(--text-tertiary)' }} />
            <input
              className="bg-transparent text-sm outline-none flex-1"
              style={{ color: 'var(--text-primary)' }}
              placeholder="Search make, model, code, type…"
              value={filter.q}
              onChange={e => setFilter(f => ({ ...f, q: e.target.value }))}
            />
          </div>
          <select
            className="input"
            value={filter.status}
            onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
          >
            <option value="">All statuses</option>
            <option value="available">Available</option>
            <option value="rented">Rented</option>
            <option value="turo">On Turo</option>
            <option value="maintenance">Maintenance</option>
            <option value="retired">Retired</option>
          </select>
          <select className="input capitalize" value={filter.category} onChange={e => setFilter(f => ({ ...f, category: e.target.value }))}>
            <option value="">All types</option>
            {categories.map(category => <option key={category} value={category}>{category}</option>)}
          </select>
          <select className="input" value={filter.make} onChange={e => setFilter(f => ({ ...f, make: e.target.value, model: '' }))}>
            <option value="">All makes</option>
            {makes.map(make => <option key={make} value={make}>{make}</option>)}
          </select>
          <select className="input" value={filter.model} onChange={e => setFilter(f => ({ ...f, model: e.target.value }))}>
            <option value="">All models</option>
            {models.filter(model => !filter.make || vehicles.some(v => v.make === filter.make && v.model === model)).map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <span className="flex items-center gap-1 rounded-full bg-[var(--bg-primary)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
              <SlidersHorizontal size={11} /> By status
            </span>
            {['available', 'rented', 'turo', 'maintenance'].map(status => (
              <button
                key={status}
                type="button"
                className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-colors"
                onClick={() => setFilter(f => ({ ...f, status: f.status === status ? '' : status }))}
                style={{
                  borderColor: filter.status === status ? 'var(--accent-color)' : 'var(--border-subtle)',
                  backgroundColor: filter.status === status ? 'var(--accent-glow)' : 'var(--bg-primary)',
                  color: filter.status === status ? 'var(--accent-color)' : 'var(--text-secondary)',
                }}
              >
                {status === 'turo' ? 'On Turo' : status}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <span className="shrink-0 rounded-full bg-[var(--bg-primary)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">By type</span>
            {categories.slice(0, 8).map(category => (
              <button
                key={category}
                type="button"
                className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-colors"
                onClick={() => setFilter(f => ({ ...f, category: f.category === category ? '' : category }))}
                style={{
                  borderColor: filter.category === category ? 'var(--accent-color)' : 'var(--border-subtle)',
                  backgroundColor: filter.category === category ? 'var(--accent-glow)' : 'var(--bg-primary)',
                  color: filter.category === category ? 'var(--accent-color)' : 'var(--text-secondary)',
                }}
              >
                {category}
              </button>
            ))}
            <span className="shrink-0 rounded-full bg-[var(--bg-primary)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">By model</span>
            {models.slice(0, 8).map(model => (
              <button
                key={model}
                type="button"
                className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
                onClick={() => setFilter(f => ({ ...f, model: f.model === model ? '' : model }))}
                style={{
                  borderColor: filter.model === model ? 'var(--accent-color)' : 'var(--border-subtle)',
                  backgroundColor: filter.model === model ? 'var(--accent-glow)' : 'var(--bg-primary)',
                  color: filter.model === model ? 'var(--accent-color)' : 'var(--text-secondary)',
                }}
              >
                {model}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Stats bar */}
      {loading ? (
        <SkeletonKpi count={5} />
      ) : (
        <div className="flex md:grid md:grid-cols-5 gap-3 scroll-x-contained no-scrollbar pb-1 max-w-full">
          {['available', 'rented', 'turo', 'maintenance', 'retired'].map(s => (
            <button
              key={s}
              className="liquid-glass p-3 text-center transition-all duration-200 shrink-0 min-w-[72px]"
              onClick={() => setFilter(f => ({ ...f, status: f.status === s ? '' : s }))}
              style={{
                borderColor: filter.status === s ? 'var(--accent-color)' : undefined,
                minHeight: 64,
              }}
            >
              <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {vehicles.filter(v => v.status === s).length}
              </p>
              <p className="text-[10px] uppercase tracking-wider font-semibold capitalize" style={{ color: 'var(--text-tertiary)' }}>{s}</p>
            </button>
          ))}
        </div>
      )}

      {/* Vehicle grid / sheet */}
      {loading ? (
        <SkeletonFleetGrid />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Car}
          title="No vehicles found"
          description="Try adjusting your search or filters, or add a new vehicle to your fleet."
          action={() => setAddModal(true)}
          actionLabel="Add Vehicle"
        />
      ) : viewMode === 'cards' ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((v, i) => (
            <motion.div
              key={v.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05, duration: 0.4, ease: EASE }}
            >
              <div
                className="card overflow-hidden cursor-pointer hover-zoom transition-all duration-300 group"
                onClick={() => navigate(`/fleet/${v.id}`)}
              >
                {/* Photo */}
                <div className="h-40 flex items-center justify-center relative" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  {v.thumbnail_url ? (
                    <img src={resolveThumb(v.thumbnail_url)} alt={`${v.make} ${v.model}`} className="h-full w-full object-contain p-4" style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.2))' }} />
                  ) : (
                    <Car size={36} style={{ color: 'var(--text-tertiary)', opacity: 0.3 }} />
                  )}
                  {/* Status badge */}
                  <div className="absolute top-3 right-3" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setStatusDropdown(statusDropdown === v.id ? null : v.id)}
                      className="flex items-center gap-1 cursor-pointer"
                    >
                      <StatusBadge status={v.status} />
                      <ChevronDown size={10} style={{ color: 'var(--text-tertiary)' }} />
                    </button>
                    {statusDropdown === v.id && (
                      <div className="absolute right-0 top-full mt-1 rounded-xl py-1.5 z-20 min-w-[140px]"
                        style={{
                          backgroundColor: 'var(--bg-elevated)',
                          border: '1px solid var(--border-medium)',
                          boxShadow: '0 12px 40px -8px rgba(0,0,0,0.25)',
                        }}
                      >
                        {['available', 'turo', 'maintenance', 'retired'].map(s => (
                          <button
                            key={s}
                            onClick={e => handleQuickStatus(v.id, s, e)}
                            className="w-full text-left px-4 py-2 text-xs capitalize transition-colors"
                            style={{
                              color: v.status === s ? 'var(--accent-color)' : 'var(--text-secondary)',
                              fontWeight: v.status === s ? 600 : 400,
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            {s === 'available' ? 'Available' : s === 'turo' ? 'On Turo' : s === 'maintenance' ? 'Maintenance' : 'Retired'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="p-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--accent-color)' }}>{v.category}</p>
                  <p className="font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>{v.year} {v.make} {v.model}</p>
                  <p className="text-xs mono-code mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{v.vehicle_code}</p>
                  <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--accent-color)' }}>${v.daily_rate}</p>
                    <div className="flex items-center gap-1.5">
                      {v.status === 'available' && (
                        <button
                          onClick={e => openLinkModal(v, e)}
                          className="p-1.5 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
                          style={{ color: 'var(--accent-color)', backgroundColor: 'var(--accent-glow)' }}
                          title="Send booking link"
                        >
                          <Send size={13} />
                        </button>
                      )}
                      <p className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: 'var(--text-tertiary)' }}>per day</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="scroll-x-contained">
            <table className="min-w-[1040px] w-full text-left">
              <thead className="bg-[var(--bg-primary)]">
                <tr className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Rate</th>
                  <th className="px-4 py-3">Specs</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filtered.map((v) => (
                  <tr
                    key={v.id}
                    className="cursor-pointer bg-[var(--bg-card)] transition-colors hover:bg-[var(--bg-card-hover)]"
                    onClick={() => navigate(`/fleet/${v.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-primary)]">
                          {v.thumbnail_url ? (
                            <img src={resolveThumb(v.thumbnail_url)} alt={`${v.make} ${v.model}`} className="h-full w-full object-contain p-2" />
                          ) : (
                            <Car size={22} style={{ color: 'var(--text-tertiary)', opacity: 0.4 }} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-[var(--text-primary)]">{v.year} {v.make} {v.model}</p>
                          <p className="text-xs text-[var(--text-tertiary)]">{v.make} / {v.model}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="relative inline-flex">
                        <button
                          type="button"
                          onClick={() => setStatusDropdown(statusDropdown === v.id ? null : v.id)}
                          className="flex items-center gap-1"
                        >
                          <StatusBadge status={v.status} />
                          <ChevronDown size={10} style={{ color: 'var(--text-tertiary)' }} />
                        </button>
                        {statusDropdown === v.id && (
                          <div className="absolute left-0 top-full mt-1 rounded-xl py-1.5 z-20 min-w-[140px]"
                            style={{
                              backgroundColor: 'var(--bg-elevated)',
                              border: '1px solid var(--border-medium)',
                              boxShadow: '0 12px 40px -8px rgba(0,0,0,0.25)',
                            }}
                          >
                            {['available', 'turo', 'maintenance', 'retired'].map(s => (
                              <button
                                key={s}
                                onClick={e => handleQuickStatus(v.id, s, e)}
                                className="w-full text-left px-4 py-2 text-xs capitalize transition-colors"
                                style={{
                                  color: v.status === s ? 'var(--accent-color)' : 'var(--text-secondary)',
                                  fontWeight: v.status === s ? 600 : 400,
                                }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                {s === 'available' ? 'Available' : s === 'turo' ? 'On Turo' : s === 'maintenance' ? 'Maintenance' : 'Retired'}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-[var(--bg-primary)] px-2.5 py-1 text-xs font-bold capitalize text-[var(--text-secondary)]">{v.category || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold tabular-nums text-[var(--accent-color)]">${v.daily_rate}</p>
                      <p className="text-[11px] text-[var(--text-tertiary)]">{v.weekly_rate ? `$${v.weekly_rate}/week` : 'daily only'}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                      <p>{v.seats || '-'} seats · {v.transmission || 'auto'}</p>
                      <p className="text-[11px] text-[var(--text-tertiary)]">{v.fuel_type || 'fuel n/a'} · {v.mileage_limit_per_day || '-'} mi/day</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--text-tertiary)]">{v.vehicle_code}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {v.status === 'available' && (
                          <button
                            type="button"
                            onClick={e => openLinkModal(v, e)}
                            className="btn-secondary py-1.5 text-xs"
                          >
                            <Send size={12} /> Link
                          </button>
                        )}
                        <button type="button" className="btn-ghost py-1.5 text-xs" onClick={() => navigate(`/fleet/${v.id}`)}>
                          Open
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Vehicle Modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add Vehicle" maxWidth="max-w-xl">
        <div className="space-y-4">
          <InlineBanner message={imageError} onDismiss={() => setImageError('')} />
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Make *</label>
              <input className="input" value={addForm.make} onChange={e => setAddForm(f => ({...f, make: e.target.value}))} placeholder="Ford" />
            </div>
            <div>
              <label className="label">Model *</label>
              <input className="input" value={addForm.model} onChange={e => setAddForm(f => ({...f, model: e.target.value}))} placeholder="Focus" />
            </div>
            <div>
              <label className="label">Year *</label>
              <input className="input" type="number" value={addForm.year} onChange={e => setAddForm(f => ({...f, year: parseInt(e.target.value)}))} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Vehicle Code</label>
              <input className="input mono-code text-xs" value={addForm.vehicle_code}
                onChange={e => setAddForm(f => ({...f, vehicle_code: e.target.value}))}
                placeholder="Auto-generated" />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input capitalize" value={addForm.category} onChange={e => setAddForm(f => ({...f, category: e.target.value}))}>
                {['sedan', 'suv', 'luxury', 'economy'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Daily Rate ($) *</label>
              <input className="input" type="number" value={addForm.daily_rate} onChange={e => setAddForm(f => ({...f, daily_rate: e.target.value}))} placeholder="150" />
            </div>
            <div>
              <label className="label">Weekly Rate ($)</label>
              <input className="input" type="number" value={addForm.weekly_rate} onChange={e => setAddForm(f => ({...f, weekly_rate: e.target.value}))} placeholder="940" />
            </div>
            <div>
              <label className="label">Seats</label>
              <input className="input" type="number" value={addForm.seats} onChange={e => setAddForm(f => ({...f, seats: parseInt(e.target.value)}))} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Fuel Type</label>
              <select className="input" value={addForm.fuel_type} onChange={e => setAddForm(f => ({...f, fuel_type: e.target.value}))}>
                {['gasoline', 'diesel', 'electric', 'hybrid'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Transmission</label>
              <select className="input" value={addForm.transmission} onChange={e => setAddForm(f => ({...f, transmission: e.target.value}))}>
                <option value="automatic">Automatic</option>
                <option value="manual">Manual</option>
              </select>
            </div>
          </div>

          {/* Image */}
          <div>
            <label className="label">Vehicle Image</label>
            <div className="flex gap-1 mb-2">
              <button type="button" onClick={() => { setImageMode('upload'); clearImageFile(); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
                style={{
                  backgroundColor: imageMode === 'upload' ? 'var(--accent-glow)' : 'var(--bg-card)',
                  color: imageMode === 'upload' ? 'var(--accent-color)' : 'var(--text-secondary)',
                }}>
                <Upload size={12} /> Upload
              </button>
              <button type="button" onClick={() => { setImageMode('url'); clearImageFile(); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
                style={{
                  backgroundColor: imageMode === 'url' ? 'var(--accent-glow)' : 'var(--bg-card)',
                  color: imageMode === 'url' ? 'var(--accent-color)' : 'var(--text-secondary)',
                }}>
                <Link size={12} /> URL
              </button>
            </div>

            {imageMode === 'upload' ? (
              <>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageFileChange} className="hidden" id="vehicleImageInput" />
                {!imageFile ? (
                  <label htmlFor="vehicleImageInput"
                    className="flex flex-col items-center justify-center gap-1.5 py-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors"
                    style={{
                      borderColor: 'var(--border-medium)',
                      backgroundColor: 'var(--bg-card)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-color)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-medium)'}
                  >
                    <Upload size={20} style={{ color: 'var(--text-tertiary)' }} />
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Click to upload · JPEG, PNG, WebP · Max 10MB</span>
                  </label>
                ) : (
                  <div className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                    <img src={imagePreview} alt="Preview" className="w-16 h-12 object-cover rounded-xl" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{imageFile.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{(imageFile.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                    <button type="button" onClick={clearImageFile} className="p-2 rounded-xl transition-colors"
                      style={{ color: 'var(--text-tertiary)' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    ><X size={14} /></button>
                  </div>
                )}
              </>
            ) : (
              <div>
                <input className="input text-xs" value={addForm.thumbnail_url} onChange={e => setAddForm(f => ({...f, thumbnail_url: e.target.value}))} placeholder="https://…" />
                {addForm.thumbnail_url && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={addForm.thumbnail_url} alt="Preview" className="w-16 h-12 object-cover rounded-xl" style={{ border: '1px solid var(--border-subtle)' }} onError={e => e.currentTarget.style.display = 'none'} />
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Preview</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setAddModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button
              onClick={handleAdd}
              disabled={adding || uploading || !addForm.make || !addForm.model || !addForm.daily_rate}
              className="btn-primary flex-1 justify-center"
            >
              {uploading ? 'Uploading…' : adding ? 'Adding…' : 'Add Vehicle'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Damage Reports ──────────────────────────────────────────── */}
      <DamageSummaryWidget />

      {/* ── Send Booking Link Modal ──────────────────────────────── */}
      <Modal open={!!linkModal} onClose={() => setLinkModal(null)} title="Send Booking Link" maxWidth="max-w-lg">
        {linkModal && !linkResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
              {linkModal.thumbnail_url && (
                <img src={resolveThumb(linkModal.thumbnail_url)} alt="" className="h-10 w-16 object-contain" />
              )}
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{linkModal.year} {linkModal.make} {linkModal.model}</p>
                <p className="text-xs mono-code" style={{ color: 'var(--text-tertiary)' }}>{linkModal.vehicle_code}</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">First Name *</label>
                <input className="input" value={linkForm.first_name} onChange={e => setLinkForm(f => ({...f, first_name: e.target.value}))} placeholder="Jane" />
              </div>
              <div>
                <label className="label">Last Name *</label>
                <input className="input" value={linkForm.last_name} onChange={e => setLinkForm(f => ({...f, last_name: e.target.value}))} placeholder="Doe" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Email *</label>
                <input className="input" type="email" value={linkForm.email} onChange={e => setLinkForm(f => ({...f, email: e.target.value}))} placeholder="jane@example.com" />
              </div>
              <div>
                <label className="label">Phone *</label>
                <input className="input" type="tel" value={linkForm.phone} onChange={e => setLinkForm(f => ({...f, phone: e.target.value}))} placeholder="(555) 123-4567" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Pickup Date *</label>
                <input className="input" type="date" value={linkForm.pickup_date} onChange={e => setLinkForm(f => ({...f, pickup_date: e.target.value}))} />
              </div>
              <div>
                <label className="label">Return Date *</label>
                <input className="input" type="date" value={linkForm.return_date} onChange={e => setLinkForm(f => ({...f, return_date: e.target.value}))} />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Pickup Time</label>
                <input className="input" type="time" value={linkForm.pickup_time} onChange={e => setLinkForm(f => ({...f, pickup_time: e.target.value}))} />
              </div>
              <div>
                <label className="label">Return Time</label>
                <input className="input" type="time" value={linkForm.return_time} onChange={e => setLinkForm(f => ({...f, return_time: e.target.value}))} />
              </div>
            </div>

            {linkError && (
              <p className="text-xs p-3 rounded-xl" style={{ color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {linkError}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setLinkModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button
                onClick={handleCreateLink}
                disabled={linkCreating || !linkForm.first_name || !linkForm.last_name || !linkForm.email || !linkForm.phone || !linkForm.pickup_date || !linkForm.return_date}
                className="btn-primary flex-1 justify-center"
              >
                {linkCreating ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : <><Send size={14} /> Generate Link</>}
              </button>
            </div>
          </div>
        )}

        {linkResult && (
          <div className="space-y-4 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: 'rgba(34,197,94,0.1)' }}>
              <Check size={28} style={{ color: '#22c55e' }} />
            </div>
            <div>
              <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Booking Link Created!</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                Code: <span className="font-mono font-bold">{linkResult.booking_code}</span> — A continue-booking email has been sent to the customer.
              </p>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-xl text-left" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
              <input
                readOnly
                value={linkResult.continue_url}
                className="bg-transparent text-xs flex-1 outline-none font-mono"
                style={{ color: 'var(--text-primary)' }}
                onFocus={e => e.target.select()}
              />
              <button
                onClick={handleCopyLink}
                className="p-2 rounded-lg transition-colors shrink-0"
                style={{ backgroundColor: linkCopied ? 'rgba(34,197,94,0.1)' : 'var(--accent-glow)', color: linkCopied ? '#22c55e' : 'var(--accent-color)' }}
                title="Copy link"
              >
                {linkCopied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setLinkModal(null)} className="btn-secondary flex-1 justify-center">Done</button>
              <a
                href={linkResult.continue_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary flex-1 justify-center inline-flex items-center gap-1.5"
              >
                <ExternalLink size={14} /> Open Link
              </a>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
