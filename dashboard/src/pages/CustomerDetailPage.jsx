import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, User, Calendar, DollarSign } from 'lucide-react';
import { api } from '../api/client';
import StatusBadge from '../components/shared/StatusBadge';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { format, formatDistanceToNow } from 'date-fns';

function Section({ title, icon: Icon, children }) {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={15} className="text-stone-400" />}
        <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs text-stone-400">{label}</p>
      <p className="text-sm text-stone-900 font-medium">{value || '—'}</p>
    </div>
  );
}

export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [c, b] = await Promise.all([
          api.getCustomer(id),
          api.getCustomerBookings(id),
        ]);
        setCustomer(c);
        setBookings(b || []);
        setNotes(c.notes || '');
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, [id]);

  async function saveNotes() {
    if (notes !== (customer.notes || '')) {
      await api.updateCustomer(id, { notes }).catch(console.error);
    }
  }

  if (loading) return <LoadingSpinner className="min-h-screen" />;
  if (!customer) return <div className="p-6 text-stone-500">Customer not found</div>;

  const totalSpent = bookings
    .filter(b => ['completed', 'active', 'returned'].includes(b.status))
    .reduce((sum, b) => sum + Number(b.total_cost || 0), 0);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate('/customers')} className="btn-ghost py-1.5 px-2">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-stone-900">
            {customer.first_name} {customer.last_name}
          </h1>
          <p className="text-xs text-stone-400">
            Customer since {format(new Date(customer.created_at), 'MMMM yyyy')}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-semibold text-stone-900">{bookings.length}</p>
          <p className="text-xs text-stone-500">Total Rentals</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-semibold text-green-700">${totalSpent.toLocaleString()}</p>
          <p className="text-xs text-stone-500">Total Spent</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-semibold text-stone-900">
            {customer.total_rentals || bookings.length}
          </p>
          <p className="text-xs text-stone-500">Completed</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Contact Info */}
        <Section title="Contact" icon={User}>
          <div className="space-y-3">
            <a href={`tel:${customer.phone}`} className="flex items-center gap-2.5 text-sm text-stone-700 hover:text-amber-600 transition-colors">
              <div className="w-8 h-8 bg-stone-100 rounded-lg flex items-center justify-center">
                <Phone size={14} className="text-stone-500" />
              </div>
              {customer.phone}
            </a>
            <a href={`mailto:${customer.email}`} className="flex items-center gap-2.5 text-sm text-stone-700 hover:text-amber-600 transition-colors">
              <div className="w-8 h-8 bg-stone-100 rounded-lg flex items-center justify-center">
                <Mail size={14} className="text-stone-500" />
              </div>
              {customer.email}
            </a>
          </div>
          {customer.driver_license_number && (
            <div className="pt-3 border-t border-stone-100 grid grid-cols-2 gap-3">
              <Field label="DL Number" value={customer.driver_license_number} />
              <Field label="DL State" value={customer.driver_license_state} />
              <Field label="DL Expiry" value={customer.driver_license_expiry} />
            </div>
          )}
          {customer.id_photo_url && (
            <div className="pt-3 border-t border-stone-100">
              <p className="text-xs text-stone-400 mb-2">Photo ID</p>
              <a href={customer.id_photo_url} target="_blank" rel="noopener noreferrer">
                <img
                  src={customer.id_photo_url}
                  alt="Customer photo ID"
                  className="h-28 w-auto rounded-lg border border-stone-200 object-cover hover:opacity-90 transition-opacity cursor-pointer"
                />
              </a>
              <p className="text-xs text-stone-400 mt-1">Click to open full size</p>
            </div>
          )}
          {customer.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {customer.tags.map(t => (
                <span key={t} className="badge bg-stone-100 text-stone-600">{t}</span>
              ))}
            </div>
          )}
        </Section>

        {/* Notes */}
        <Section title="Internal Notes" icon={User}>
          <textarea
            className="input resize-none text-sm"
            rows={5}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder="Add private notes about this customer…"
          />
          <p className="text-xs text-stone-400">Notes auto-save when you click away.</p>
        </Section>
      </div>

      {/* Booking History */}
      <Section title={`Booking History (${bookings.length})`} icon={Calendar}>
        {bookings.length === 0 ? (
          <p className="text-sm text-stone-400">No bookings yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  {['Booking', 'Vehicle', 'Dates', 'Status', 'Total'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-stone-400 px-3 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {bookings.map(b => (
                  <tr
                    key={b.id}
                    className="hover:bg-stone-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/bookings/${b.id}`)}
                  >
                    <td className="px-3 py-2.5 font-mono text-xs text-stone-600">{b.booking_code}</td>
                    <td className="px-3 py-2.5 text-stone-700">
                      {b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-stone-500 text-xs">
                      {format(new Date(b.pickup_date), 'MMM d')} → {format(new Date(b.return_date), 'MMM d, yyyy')}
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge status={b.status} /></td>
                    <td className="px-3 py-2.5 font-medium text-stone-800">${Number(b.total_cost || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
