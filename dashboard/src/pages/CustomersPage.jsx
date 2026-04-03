import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Phone, Mail } from 'lucide-react';
import { api } from '../api/client';
import DataTable from '../components/shared/DataTable';
import { format } from 'date-fns';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.getCustomers({ q });
        setCustomers(data);
      } catch (e) { console.error(e); }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [q]);

  const columns = [
    { key: 'name', label: 'Name', render: c => (
      <div>
        <p className="font-medium text-stone-900">{c.first_name} {c.last_name}</p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="flex items-center gap-1 text-xs text-stone-400"><Mail size={10} />{c.email}</span>
        </div>
      </div>
    )},
    { key: 'phone', label: 'Phone', render: c => (
      <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-sm text-stone-600 hover:text-amber-600" onClick={e => e.stopPropagation()}>
        <Phone size={13} /> {c.phone}
      </a>
    )},
    { key: 'total_rentals', label: 'Rentals', render: c => (
      <span className="font-medium">{c.total_rentals}</span>
    )},
    { key: 'total_revenue', label: 'Total Spent', render: c => (
      <span className="font-medium text-green-700">${Number(c.total_revenue || 0).toLocaleString()}</span>
    )},
    { key: 'tags', label: 'Tags', render: c => (
      <div className="flex flex-wrap gap-1">
        {(c.tags || []).map(t => (
          <span key={t} className="badge bg-stone-100 text-stone-600">{t}</span>
        ))}
      </div>
    )},
    { key: 'created_at', label: 'Since', render: c => (
      <span className="text-stone-400 text-xs">{format(new Date(c.created_at), 'MMM yyyy')}</span>
    )},
  ];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      <h1 className="text-xl font-semibold text-stone-900">Customers</h1>

      <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-lg px-3 py-2 max-w-sm">
        <Search size={14} className="text-stone-400" />
        <input
          className="bg-transparent text-sm outline-none placeholder-stone-400 flex-1"
          placeholder="Search by name, email, phone…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={customers}
          loading={loading}
          emptyMessage="No customers found"
          onRowClick={c => navigate(`/customers/${c.id}`)}
        />
      </div>
    </div>
  );
}
