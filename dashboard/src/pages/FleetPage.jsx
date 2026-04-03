import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Plus, Search, ChevronDown, Upload, Link, X } from 'lucide-react';
import { api } from '../api/client';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import Modal from '../components/shared/Modal';

const STATUS_COLORS = {
  available:   'bg-green-100 text-green-700',
  rented:      'bg-blue-100 text-blue-700',
  turo:        'bg-indigo-100 text-indigo-700',
  maintenance: 'bg-amber-100 text-amber-700',
  retired:     'bg-stone-100 text-stone-500',
};

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

  // Image upload state
  const [imageMode, setImageMode] = useState('upload'); // 'upload' or 'url'
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
    setAddForm(f => ({ ...f, thumbnail_url: '' })); // clear URL if switching to file
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

      // If file was selected, upload it first
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

  if (loading) return <LoadingSpinner className="min-h-screen" />;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-stone-900">Fleet</h1>
        <button onClick={() => setAddModal(true)} className="btn-primary">
          <Plus size={15} /> Add Vehicle
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-lg px-3 py-2">
          <Search size={14} className="text-stone-400" />
          <input
            className="bg-transparent text-sm outline-none placeholder-stone-400"
            placeholder="Search vehicles…"
            value={filter.q}
            onChange={e => setFilter(f => ({ ...f, q: e.target.value }))}
          />
        </div>
        <select
          className="text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white outline-none"
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
      <div className="grid grid-cols-5 gap-3">
        {['available', 'rented', 'turo', 'maintenance', 'retired'].map(s => (
          <div key={s} className="card p-3 text-center cursor-pointer hover:border-amber-200 transition-colors"
            onClick={() => setFilter(f => ({ ...f, status: f.status === s ? '' : s }))}>
            <p className="text-2xl font-semibold text-stone-900">
              {vehicles.filter(v => v.status === s).length}
            </p>
            <p className="text-xs text-stone-500 capitalize">{s}</p>
          </div>
        ))}
      </div>

      {/* Vehicle grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400 text-sm">No vehicles found</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(v => (
            <div
              key={v.id}
              className="card overflow-hidden cursor-pointer hover:border-amber-200 hover:shadow-md transition-all duration-200"
              onClick={() => navigate(`/fleet/${v.id}`)}
            >
              {/* Photo */}
              <div className="h-36 bg-stone-100 flex items-center justify-center relative">
                {v.thumbnail_url ? (
                  <img src={v.thumbnail_url} alt={`${v.make} ${v.model}`} className="h-full w-full object-cover" />
                ) : (
                  <Car size={36} className="text-stone-300" />
                )}
                {/* Quick status dropdown */}
                <div className="absolute top-2 right-2" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => setStatusDropdown(statusDropdown === v.id ? null : v.id)}
                    className={`badge ${STATUS_COLORS[v.status] || 'bg-stone-100 text-stone-500'} flex items-center gap-1 cursor-pointer hover:opacity-80`}
                  >
                    {v.status} <ChevronDown size={10} />
                  </button>
                  {statusDropdown === v.id && (
                    <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-stone-200 py-1 z-20 min-w-[120px]">
                      {['available', 'turo', 'maintenance', 'retired'].map(s => (
                        <button
                          key={s}
                          onClick={e => handleQuickStatus(v.id, s, e)}
                          className={`w-full text-left px-3 py-1.5 text-xs capitalize hover:bg-stone-50 transition-colors
                            ${v.status === s ? 'text-amber-700 font-medium' : 'text-stone-600'}`}
                        >
                          {s === 'available' ? '✓ Available' : s === 'turo' ? '🚗 On Turo' : s === 'maintenance' ? '🔧 Maintenance' : '🚫 Retired'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <p className="font-semibold text-stone-900">{v.year} {v.make} {v.model}</p>
                <p className="text-xs text-stone-400 font-mono">{v.vehicle_code}</p>
                <div className="flex items-center justify-between mt-3">
                  <p className="text-sm font-medium text-amber-700">${v.daily_rate}/day</p>
                  <p className="text-xs text-stone-400 capitalize">{v.category}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Vehicle Modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add Vehicle" maxWidth="max-w-xl">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Vehicle Code</label>
              <input className="input font-mono text-xs" value={addForm.vehicle_code}
                onChange={e => setAddForm(f => ({...f, vehicle_code: e.target.value}))}
                placeholder="Auto-generated (e.g. v-ford-focus)" />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input capitalize" value={addForm.category} onChange={e => setAddForm(f => ({...f, category: e.target.value}))}>
                {['sedan', 'suv', 'luxury', 'economy'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
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
          <div className="grid grid-cols-2 gap-3">
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

          {/* Vehicle Image — Upload or URL */}
          <div>
            <label className="label">Vehicle Image</label>
            <div className="flex gap-1 mb-2">
              <button type="button" onClick={() => { setImageMode('upload'); clearImageFile(); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${imageMode === 'upload' ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>
                <Upload size={12} /> Upload
              </button>
              <button type="button" onClick={() => { setImageMode('url'); clearImageFile(); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${imageMode === 'url' ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>
                <Link size={12} /> URL
              </button>
            </div>

            {imageMode === 'upload' ? (
              <>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageFileChange} className="hidden" id="vehicleImageInput" />
                {!imageFile ? (
                  <label htmlFor="vehicleImageInput"
                    className="flex flex-col items-center justify-center gap-1.5 py-5 rounded-lg border-2 border-dashed border-stone-200 cursor-pointer hover:border-amber-300 transition-colors bg-stone-50">
                    <Upload size={20} className="text-stone-400" />
                    <span className="text-xs text-stone-500">Click to upload · JPEG, PNG, WebP · Max 10MB</span>
                  </label>
                ) : (
                  <div className="flex items-center gap-3 p-2.5 rounded-lg border border-stone-200 bg-stone-50">
                    <img src={imagePreview} alt="Preview" className="w-16 h-12 object-cover rounded" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-700 truncate">{imageFile.name}</p>
                      <p className="text-xs text-stone-400">{(imageFile.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                    <button type="button" onClick={clearImageFile} className="p-1 rounded-full hover:bg-stone-200 text-stone-400"><X size={14} /></button>
                  </div>
                )}
              </>
            ) : (
              <div>
                <input className="input text-xs" value={addForm.thumbnail_url} onChange={e => setAddForm(f => ({...f, thumbnail_url: e.target.value}))} placeholder="https://…" />
                {addForm.thumbnail_url && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={addForm.thumbnail_url} alt="Preview" className="w-16 h-12 object-cover rounded border border-stone-200" onError={e => e.currentTarget.style.display = 'none'} />
                    <span className="text-xs text-stone-400">Preview</span>
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
    </div>
  );
}
