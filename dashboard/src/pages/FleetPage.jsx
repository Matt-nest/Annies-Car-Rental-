import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Plus, Search, ChevronDown, Upload, Link, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import StatusBadge from '../components/shared/StatusBadge';
import { SkeletonFleetGrid, SkeletonKpi } from '../components/shared/Skeleton';
import EmptyState from '../components/shared/EmptyState';
import Modal from '../components/shared/Modal';
import DamageSummaryWidget from '../components/dashboard/widgets/DamageSummaryWidget';

const MAIN_SITE = 'https://www.anniescarrental.com';
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
  const [filter, setFilter] = useState({ status: '', q: '' });
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

  async function loadVehicles() {
    setLoading(true);
    try { setVehicles(await api.getVehicles()); }
    catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { loadVehicles(); }, []);

  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('File too large. Max 10MB.'); return; }
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

  const filtered = vehicles.filter(v => {
    if (filter.status && v.status !== filter.status) return false;
    if (filter.q) {
      const q = filter.q.toLowerCase();
      return `${v.make} ${v.model} ${v.year} ${v.vehicle_code}`.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Fleet</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Manage your vehicle inventory</p>
        </div>
        <button onClick={() => setAddModal(true)} className="btn-primary">
          <Plus size={16} /> Add Vehicle
        </button>
      </motion.div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 flex-1 min-w-[200px]"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <Search size={15} style={{ color: 'var(--text-tertiary)' }} />
          <input
            className="bg-transparent text-sm outline-none flex-1"
            style={{ color: 'var(--text-primary)' }}
            placeholder="Search vehicles…"
            value={filter.q}
            onChange={e => setFilter(f => ({ ...f, q: e.target.value }))}
          />
        </div>
        <select
          className="input max-w-[180px]"
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
      </div>

      {/* Stats bar */}
      {loading ? (
        <SkeletonKpi count={5} />
      ) : (
        <div className="flex md:grid md:grid-cols-5 gap-3 overflow-x-auto no-scrollbar pb-1">
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

      {/* Vehicle grid */}
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
      ) : (
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
                    <p className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: 'var(--text-tertiary)' }}>per day</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Vehicle Modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add Vehicle" maxWidth="max-w-xl">
        <div className="space-y-4">
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
    </div>
  );
}
