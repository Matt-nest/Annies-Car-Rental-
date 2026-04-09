import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Car, Edit3, Save, X, Plus, Trash2, Calendar, DollarSign, AlertTriangle } from 'lucide-react';
import { api } from '../api/client';
import StatusBadge from '../components/shared/StatusBadge';
import { SkeletonDashboard } from '../components/shared/Skeleton';
import Modal from '../components/shared/Modal';
import Section from '../components/shared/Section';
import Field from '../components/shared/Field';
import { format } from 'date-fns';

const MAIN_SITE = 'https://www.anniescarrental.com';
function resolveThumb(url) {
  if (!url) return '';
  return url.startsWith('/fleet/') ? `${MAIN_SITE}${url}` : url;
}

const STATUS_OPTIONS = ['available', 'turo', 'maintenance', 'retired'];
const STATUS_COLORS = {
  available:   'bg-green-500',
  rented:      'bg-[rgba(99,179,237,0.07)]0',
  turo:        'bg-indigo-500',
  maintenance: 'bg-amber-500',
  retired:     'bg-stone-400',
};

export default function VehicleDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [blocked, setBlocked] = useState([]);
  const [blockModal, setBlockModal] = useState(false);
  const [blockForm, setBlockForm] = useState({ start_date: '', end_date: '', reason: 'personal_use', notes: '' });
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [v, b] = await Promise.all([
        api.getVehicle(id),
        api.getBlockedDates(id),
      ]);
      setVehicle(v);
      setBlocked(b || []);
      setEditForm({
        make: v.make, model: v.model, year: v.year, category: v.category,
        daily_rate: v.daily_rate, weekly_rate: v.weekly_rate || '',
        seats: v.seats, fuel_type: v.fuel_type, transmission: v.transmission,
        thumbnail_url: v.thumbnail_url || '', notes: v.notes || '',
        mileage_limit_per_day: v.mileage_limit_per_day || 150,
      });
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function handleStatusChange(newStatus) {
    try {
      await api.updateVehicleStatus(id, newStatus);
      setVehicle(v => ({ ...v, status: newStatus }));
    } catch (e) { console.error(e); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.updateVehicle(id, editForm);
      setVehicle(updated);
      setEditing(false);
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  async function handleAddBlock() {
    try {
      await api.addBlockedDates(id, blockForm);
      setBlockModal(false);
      setBlockForm({ start_date: '', end_date: '', reason: 'personal_use', notes: '' });
      const b = await api.getBlockedDates(id);
      setBlocked(b || []);
    } catch (e) { console.error(e); }
  }

  async function handleDeleteBlock(blockId) {
    try {
      await api.deleteBlockedDate(blockId);
      setBlocked(b => b.filter(x => x.id !== blockId));
    } catch (e) { console.error(e); }
  }

  async function handleDeleteVehicle() {
    const name = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
    if (!confirm(`Are you sure you want to permanently delete ${name}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.deleteVehicle(id);
      navigate('/fleet');
    } catch (e) {
      const msg = e?.message || 'Failed to delete vehicle';
      alert(msg);
    }
    setDeleting(false);
  }

  if (loading) return <SkeletonDashboard />;
  if (!vehicle) return <div className="p-6 text-[var(--text-secondary)]">Vehicle not found</div>;

  const bookings = (vehicle.bookings || []).sort((a, b) => b.pickup_date.localeCompare(a.pickup_date));
  const activeBookings = bookings.filter(b => ['active', 'approved', 'confirmed'].includes(b.status));
  const completedCount = bookings.filter(b => b.status === 'completed').length;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/fleet')} className="btn-ghost py-1.5 px-2">
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-[var(--text-primary)]">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h1>
              <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[vehicle.status]}`} />
            </div>
            <p className="text-xs text-[var(--text-tertiary)] font-mono">{vehicle.vehicle_code}</p>
          </div>
        </div>

        {/* Status buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              disabled={vehicle.status === s}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all capitalize
                ${vehicle.status === s
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'bg-white text-[var(--text-secondary)] border-stone-200 hover:border-stone-400'
                }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Active booking alert */}
      {activeBookings.length > 0 && (
        <div className="bg-[rgba(99,179,237,0.07)] border border-[rgba(99,179,237,0.15)] rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={16} className="text-[#63b3ed] shrink-0" />
          <p className="text-sm text-[#63b3ed]">
            This vehicle has {activeBookings.length} active/upcoming booking{activeBookings.length !== 1 ? 's' : ''}.
          </p>
        </div>
      )}

      {/* Photo + Details */}
      <div className="grid md:grid-cols-2 gap-5">
        {/* Photo */}
        <div className="card overflow-hidden">
          {vehicle.thumbnail_url ? (
            <img src={resolveThumb(vehicle.thumbnail_url)} alt={`${vehicle.make} ${vehicle.model}`} className="w-full h-56 object-contain p-4" style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.2))' }} />
          ) : (
            <div className="h-56 bg-[var(--bg-card)] flex items-center justify-center">
              <Car size={48} className="text-[var(--text-tertiary)]" />
            </div>
          )}
        </div>

        {/* Details */}
        <Section title="Details" icon={Car}
          action={
            !editing ? (
              <button onClick={() => setEditing(true)} className="btn-ghost text-xs py-1 px-2">
                <Edit3 size={13} /> Edit
              </button>
            ) : (
              <div className="flex gap-1.5">
                <button onClick={() => setEditing(false)} className="btn-ghost text-xs py-1 px-2"><X size={13} /> Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary text-xs py-1 px-2">
                  <Save size={13} /> {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            )
          }
        >
          {!editing ? (
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Make" value={vehicle.make} />
              <Field label="Model" value={vehicle.model} />
              <Field label="Year" value={vehicle.year} />
              <Field label="Category" value={vehicle.category} />
              <Field label="Daily Rate" value={`$${vehicle.daily_rate}`} />
              <Field label="Weekly Rate" value={vehicle.weekly_rate ? `$${vehicle.weekly_rate}` : '—'} />
              <Field label="Seats" value={vehicle.seats} />
              <Field label="Fuel" value={vehicle.fuel_type} />
              <Field label="Transmission" value={vehicle.transmission} />
              <Field label="Mileage Limit/Day" value={`${vehicle.mileage_limit_per_day || 150} mi`} />
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { label: 'Make', key: 'make', type: 'text' },
                { label: 'Model', key: 'model', type: 'text' },
                { label: 'Year', key: 'year', type: 'number' },
                { label: 'Category', key: 'category', type: 'select', options: ['sedan', 'suv', 'luxury', 'economy'] },
                { label: 'Daily Rate ($)', key: 'daily_rate', type: 'number' },
                { label: 'Weekly Rate ($)', key: 'weekly_rate', type: 'number' },
                { label: 'Seats', key: 'seats', type: 'number' },
                { label: 'Fuel Type', key: 'fuel_type', type: 'select', options: ['gasoline', 'diesel', 'electric', 'hybrid'] },
                { label: 'Transmission', key: 'transmission', type: 'select', options: ['automatic', 'manual'] },
                { label: 'Mileage Limit/Day', key: 'mileage_limit_per_day', type: 'number' },
              ].map(f => (
                <div key={f.key}>
                  <label className="label">{f.label}</label>
                  {f.type === 'select' ? (
                    <select className="input capitalize" value={editForm[f.key] || ''} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}>
                      {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input className="input" type={f.type} value={editForm[f.key] || ''} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} />
                  )}
                </div>
              ))}
            </div>
          )}
          {vehicle.notes && !editing && (
            <div className="pt-2 border-t border-[var(--border-subtle)]">
              <p className="text-xs text-[var(--text-tertiary)] mb-1">Description</p>
              <p className="text-sm text-[var(--text-secondary)]">{vehicle.notes}</p>
            </div>
          )}
        </Section>
      </div>

      {/* Blocked Dates */}
      <Section title="Blocked Dates" icon={Calendar}
        action={
          <button onClick={() => setBlockModal(true)} className="btn-secondary text-xs py-1.5 px-3">
            <Plus size={13} /> Block Dates
          </button>
        }
      >
        {blocked.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">No dates blocked. Use this to mark days when the vehicle is unavailable (personal use, servicing, etc.)</p>
        ) : (
          <div className="space-y-2">
            {blocked.map(b => (
              <div key={b.id} className="flex items-center justify-between py-2 px-3 bg-[var(--bg-card)] rounded-lg">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {format(new Date(b.start_date), 'MMM d, yyyy')} — {format(new Date(b.end_date), 'MMM d, yyyy')}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)] capitalize">{b.reason?.replace('_', ' ')}{b.notes ? ` · ${b.notes}` : ''}</p>
                </div>
                <button onClick={() => handleDeleteBlock(b.id)} className="btn-ghost p-1.5 text-red-400 hover:text-[var(--danger-color)]">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Booking History */}
      <Section title={`Booking History (${bookings.length})`} icon={DollarSign}>
        {bookings.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">No bookings for this vehicle yet.</p>
        ) : (
          <div className="space-y-1">
            {bookings.map(b => (
              <Link
                key={b.id}
                to={`/bookings/${b.id}`}
                className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-[var(--bg-card)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <StatusBadge status={b.status} />
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {b.customers?.first_name} {b.customers?.last_name}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)] font-mono">{b.booking_code}</p>
                  </div>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  {format(new Date(b.pickup_date), 'MMM d')} → {format(new Date(b.return_date), 'MMM d, yyyy')}
                </p>
              </Link>
            ))}
          </div>
        )}
      </Section>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-semibold text-[var(--text-primary)]">{bookings.length}</p>
          <p className="text-xs text-[var(--text-secondary)]">Total Bookings</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-semibold text-[var(--text-primary)]">{completedCount}</p>
          <p className="text-xs text-[var(--text-secondary)]">Completed</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-semibold text-[var(--text-primary)]">{activeBookings.length}</p>
          <p className="text-xs text-[var(--text-secondary)]">Active Now</p>
        </div>
      </div>

      {/* Block dates modal */}
      <Modal open={blockModal} onClose={() => setBlockModal(false)} title="Block Dates">
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Start Date</label>
              <input className="input" type="date" value={blockForm.start_date} onChange={e => setBlockForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div>
              <label className="label">End Date</label>
              <input className="input" type="date" value={blockForm.end_date} onChange={e => setBlockForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Reason</label>
            <select className="input" value={blockForm.reason} onChange={e => setBlockForm(f => ({ ...f, reason: e.target.value }))}>
              <option value="personal_use">Personal Use</option>
              <option value="turo">Listed on Turo</option>
              <option value="maintenance">Maintenance / Repair</option>
              <option value="inspection">Inspection</option>
              <option value="cleaning">Deep Cleaning</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <input className="input" value={blockForm.notes} onChange={e => setBlockForm(f => ({ ...f, notes: e.target.value }))} placeholder="Oil change at dealership…" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setBlockModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={handleAddBlock} disabled={!blockForm.start_date || !blockForm.end_date} className="btn-primary flex-1 justify-center">
              Block Dates
            </button>
          </div>
        </div>
      </Modal>

      {/* Danger zone */}
      <div className="card p-5 border border-red-200 dark:border-red-500/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-red-600 dark:text-red-400">Delete Vehicle</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              Permanently remove this vehicle from the fleet. Vehicles with active bookings cannot be deleted.
            </p>
          </div>
          <button
            onClick={handleDeleteVehicle}
            disabled={deleting}
            className="text-xs font-medium px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete Vehicle'}
          </button>
        </div>
      </div>
    </div>
  );
}
