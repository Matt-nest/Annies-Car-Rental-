import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Phone, Mail, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import { SkeletonTable } from '../components/shared/Skeleton';
import EmptyState from '../components/shared/EmptyState';
import { format } from 'date-fns';

const EASE = [0.25, 1, 0.5, 1];

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

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Customers</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Your customer relationships</p>
      </motion.div>

      {/* Search */}
      <div
        className="flex items-center gap-2 rounded-xl px-4 py-3 max-w-md"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <Search size={15} style={{ color: 'var(--text-tertiary)' }} />
        <input
          className="bg-transparent text-sm outline-none flex-1"
          style={{ color: 'var(--text-primary)' }}
          placeholder="Search by name, email, phone…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      {/* Grid */}
      {loading ? (
        <SkeletonTable rows={6} cols={4} />
      ) : customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers found"
          description={q ? 'Try adjusting your search.' : 'Customers will appear here once bookings come in.'}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04, duration: 0.4, ease: EASE }}
            >
              <div
                className="liquid-glass p-5 cursor-pointer transition-all duration-200"
                onClick={() => navigate(`/customers/${c.id}`)}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-medium)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, #465FFF, #8B5CF6)',
                      color: 'var(--accent-fg)',
                    }}
                  >
                    {c.first_name?.[0]}{c.last_name?.[0]}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                      {c.first_name} {c.last_name}
                    </p>
                    <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                      <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        <Mail size={10} />{c.email}
                      </span>
                    </div>
                    {c.phone && (
                      <a
                        href={`tel:${c.phone}`}
                        className="flex items-center gap-1 text-xs mt-1 transition-colors"
                        style={{ color: 'var(--text-tertiary)' }}
                        onClick={e => e.stopPropagation()}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-color)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
                      >
                        <Phone size={10} />{c.phone}
                      </a>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div
                  className="mt-4 pt-4 grid grid-cols-3 gap-3"
                  style={{ borderTop: '1px solid var(--border-subtle)' }}
                >
                  <div>
                    <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{c.total_rentals || 0}</p>
                    <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-tertiary)' }}>Rentals</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold tabular-nums" style={{ color: '#22c55e' }}>${Number(c.total_revenue || 0).toLocaleString()}</p>
                    <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-tertiary)' }}>Spent</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{c.created_at ? format(new Date(c.created_at), 'MMM yyyy') : '—'}</p>
                    <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-tertiary)' }}>Since</p>
                  </div>
                </div>

                {/* Tags */}
                {c.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {c.tags.map(t => (
                      <span key={t} className="badge" style={{
                        backgroundColor: 'var(--bg-card-hover)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-subtle)',
                      }}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
