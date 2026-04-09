import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import Section from '../shared/Section';
import { MapPin, Plus, Trash2, DollarSign, Calendar } from 'lucide-react';

export default function TollsTab({ booking }) {
  const [tolls, setTolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ amount: '', tollDate: '', description: '' });

  const vehicleId = booking.vehicle_id || booking.vehicles?.id;

  useEffect(() => {
    if (vehicleId) loadTolls();
  }, [vehicleId]);

  async function loadTolls() {
    setLoading(true);
    try {
      const data = await api.getVehicleTolls(vehicleId);
      setTolls(data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function handleAdd() {
    if (!form.amount || !form.tollDate) return;
    setAdding(true);
    try {
      await api.addTollCharge(vehicleId, {
        amount: Math.round(Number(form.amount) * 100),
        tollDate: form.tollDate,
        description: form.description || undefined,
        bookingId: booking.id,
      });
      setForm({ amount: '', tollDate: '', description: '' });
      await loadTolls();
    } catch (e) { console.error(e); alert(e.message); }
    setAdding(false);
  }

  async function handleDelete(id) {
    if (!confirm('Delete this toll charge?')) return;
    try {
      await api.deleteTollCharge(id);
      await loadTolls();
    } catch (e) { console.error(e); }
  }

  // Filter tolls for this booking
  const bookingTolls = tolls.filter(t => t.booking_id === booking.id);
  const otherTolls = tolls.filter(t => t.booking_id !== booking.id);
  const totalBookingTolls = bookingTolls.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-5">
      {/* Summary */}
      {bookingTolls.length > 0 && (
        <div className="bg-[var(--bg-elevated)] rounded-xl p-4 border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">Booking Tolls</p>
              <p className="text-2xl font-bold tabular-nums text-[var(--text-primary)] mt-1">
                ${(totalBookingTolls / 100).toFixed(2)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-[var(--text-secondary)]">{bookingTolls.length} charge{bookingTolls.length !== 1 ? 's' : ''}</p>
              {booking.has_unlimited_tolls && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-full mt-1">
                  Unlimited Tolls Active
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toll Charges for this Booking */}
      <Section title="Toll Charges — This Booking">
        {bookingTolls.length > 0 ? (
          <div className="space-y-2">
            {bookingTolls.map(toll => (
              <div key={toll.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center">
                    <MapPin size={14} className="text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm text-[var(--text-primary)]">{toll.description || 'Toll charge'}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      <Calendar size={10} className="inline mr-1" />
                      {new Date(toll.toll_date).toLocaleDateString()}
                      {toll.logged_by && ` · by ${toll.logged_by}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                    ${(toll.amount / 100).toFixed(2)}
                  </span>
                  <button
                    onClick={() => handleDelete(toll.id)}
                    className="text-[var(--text-tertiary)] hover:text-[var(--danger-color)] transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-tertiary)]">No toll charges recorded for this booking</p>
        )}

        {/* Add Toll Form */}
        <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Add Toll Charge</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <input
                type="number"
                step="0.01"
                className="input text-sm"
                placeholder="Amount ($)"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div>
              <input
                type="date"
                className="input text-sm"
                value={form.tollDate}
                onChange={e => setForm(f => ({ ...f, tollDate: e.target.value }))}
              />
            </div>
            <div>
              <input
                className="input text-sm"
                placeholder="Location / description"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <button onClick={handleAdd} disabled={adding || !form.amount || !form.tollDate} className="btn-secondary mt-3">
            <Plus size={14} />
            {adding ? 'Adding…' : 'Add Toll'}
          </button>
        </div>
      </Section>

      {/* Other Vehicle Tolls (from other bookings) */}
      {otherTolls.length > 0 && (
        <Section title={`Other Tolls — ${booking.vehicles?.year} ${booking.vehicles?.make} ${booking.vehicles?.model}`}>
          <div className="space-y-2 opacity-60">
            {otherTolls.slice(0, 10).map(toll => (
              <div key={toll.id} className="flex items-center justify-between p-2 text-sm">
                <div>
                  <span className="text-[var(--text-secondary)]">{toll.description || 'Toll'}</span>
                  <span className="text-xs text-[var(--text-tertiary)] ml-2">
                    {new Date(toll.toll_date).toLocaleDateString()}
                    {toll.bookings?.booking_code && ` · ${toll.bookings.booking_code}`}
                  </span>
                </div>
                <span className="tabular-nums text-[var(--text-secondary)]">${(toll.amount / 100).toFixed(2)}</span>
              </div>
            ))}
            {otherTolls.length > 10 && (
              <p className="text-xs text-[var(--text-tertiary)] text-center">+ {otherTolls.length - 10} more</p>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}
