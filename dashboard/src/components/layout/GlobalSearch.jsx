import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, BookOpen, Users, Car, CreditCard, Clock, Command } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../api/client';

const CATEGORY_CONFIG = {
  bookings: { icon: BookOpen, label: 'Bookings', color: '#818cf8' },
  customers: { icon: Users, label: 'Customers', color: 'var(--accent-color)' },
  vehicles: { icon: Car, label: 'Vehicles', color: '#63b3ed' },
  payments: { icon: CreditCard, label: 'Payments', color: '#f59e0b' },
};

function ResultItem({ item, category, isActive, onClick }) {
  const config = CATEGORY_CONFIG[category];
  const Icon = config.icon;

  let title = '';
  let subtitle = '';

  switch (category) {
    case 'bookings':
      title = item.booking_code;
      subtitle = [
        item.customers ? `${item.customers.first_name} ${item.customers.last_name}` : '',
        item.vehicles ? `${item.vehicles.year} ${item.vehicles.make} ${item.vehicles.model}` : '',
      ].filter(Boolean).join(' — ');
      break;
    case 'customers':
      title = `${item.first_name} ${item.last_name}`;
      subtitle = [item.email, item.phone].filter(Boolean).join(' · ');
      break;
    case 'vehicles':
      title = `${item.year} ${item.make} ${item.model}`;
      subtitle = [item.vehicle_code, item.license_plate, item.status].filter(Boolean).join(' · ');
      break;
    case 'payments':
      title = `$${Math.abs(Number(item.amount)).toFixed(2)} — ${item.payment_type}`;
      subtitle = item.bookings?.booking_code
        ? `${item.bookings.booking_code} · ${item.bookings.customers?.first_name || ''} ${item.bookings.customers?.last_name || ''}`
        : item.reference_id || '';
      break;
  }

  return (
    <button
      onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors rounded-lg ${
          isActive
          ? 'bg-[var(--bg-card-hover)]'
          : 'hover:bg-[var(--bg-card-hover)]'
        }`}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${config.color}15`, color: config.color }}
      >
        <Icon size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{title}</p>
        {subtitle && (
          <p className="text-xs text-[var(--text-secondary)] truncate">{subtitle}</p>
        )}
      </div>
    </button>
  );
}

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dashboard-recent-searches') || '[]');
    } catch { return []; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);
  const navigate = useNavigate();

  // Flatten results into a navigable list
  const flatResults = results
    ? Object.entries(results).flatMap(([category, items]) =>
        (items || []).map(item => ({ item, category }))
      )
    : [];

  const totalResults = flatResults.length;

  // Debounced search
  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.searchAll(q);
      setResults(data);
      setActiveIndex(-1);
    } catch (err) {
      console.error('Search failed:', err);
      setResults({ bookings: [], customers: [], vehicles: [], payments: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.length >= 2) {
      debounceRef.current = setTimeout(() => doSearch(query), 300);
    } else {
      setResults(null);
    }
    return () => clearTimeout(debounceRef.current);
  }, [query, doSearch]);

  // Cmd+K shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (window.innerWidth < 768) {
          setMobileOpen(true);
        } else {
          inputRef.current?.focus();
          setIsOpen(true);
        }
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        setMobileOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Navigate to result
  const navigateToResult = useCallback((item, category) => {
    let path = '/';
    switch (category) {
      case 'bookings': path = `/bookings/${item.id}`; break;
      case 'customers': path = `/customers/${item.id}`; break;
      case 'vehicles': path = `/fleet/${item.id}`; break;
      case 'payments': path = `/payments`; break;
    }

    // Save to recent
    const term = query.trim();
    if (term) {
      const updated = [term, ...recentSearches.filter(s => s !== term)].slice(0, 5);
      setRecentSearches(updated);
      try { localStorage.setItem('dashboard-recent-searches', JSON.stringify(updated)); } catch {}
    }

    setIsOpen(false);
    setMobileOpen(false);
    setQuery('');
    setResults(null);
    navigate(path);
  }, [query, recentSearches, navigate]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen && !mobileOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < totalResults - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : totalResults - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0 && flatResults[activeIndex]) {
      e.preventDefault();
      const { item, category } = flatResults[activeIndex];
      navigateToResult(item, category);
    }
  };

  const renderDropdownContent = () => (
    <div className="py-2">
      {loading && (
        <div className="px-4 py-6 text-center">
          <div className="inline-block w-5 h-5 border-2 border-gray-300 border-t-brand-500 rounded-full animate-spin" />
          <p className="text-xs text-gray-400 mt-2">Searching…</p>
        </div>
      )}

      {!loading && query.length < 2 && recentSearches.length > 0 && (
        <div>
          <p className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
            Recent Searches
          </p>
          {recentSearches.map((term, i) => (
            <button
              key={i}
              onClick={() => { setQuery(term); setIsOpen(true); }}
              className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-[var(--bg-card-hover)] rounded-lg"
            >
              <Clock size={14} className="text-[var(--text-tertiary)] shrink-0" />
              <span className="text-sm text-[var(--text-secondary)]">{term}</span>
            </button>
          ))}
        </div>
      )}

      {!loading && query.length >= 2 && results && totalResults === 0 && (
        <div className="px-4 py-8 text-center">
          <Search size={24} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No results for "{query}"</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Try a different search term</p>
        </div>
      )}

      {!loading && results && totalResults > 0 && (
        <div>
          {Object.entries(results).map(([category, items]) => {
            if (!items?.length) return null;
            const config = CATEGORY_CONFIG[category];
            return (
              <div key={category} className="mb-1">
                <p className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {config.label}
                </p>
                {items.map((item) => {
                  const globalIdx = flatResults.findIndex(
                    f => f.item.id === item.id && f.category === category
                  );
                  return (
                    <ResultItem
                      key={item.id}
                      item={item}
                      category={category}
                      isActive={globalIdx === activeIndex}
                      onClick={() => navigateToResult(item, category)}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop search */}
      <div className="hidden md:flex relative w-full" ref={dropdownRef}>
        <div className="relative w-full">
          <span className="absolute -translate-y-1/2 left-4 top-1/2">
            <Search size={20} className="text-[var(--text-secondary)]" />
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search bookings, customers…"
            className="h-11 w-full rounded-lg border border-[var(--border-subtle)] bg-transparent py-2.5 pl-12 pr-14 text-sm text-[var(--text-primary)] shadow-xs placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-color)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)]"
          />
          <button
            onClick={() => inputRef.current?.focus()}
            className="absolute right-2.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-0.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-[7px] py-[4.5px] text-xs -tracking-[0.2px] text-[var(--text-secondary)]"
          >
            <span>⌘</span>
            <span>K</span>
          </button>
        </div>

        {/* Desktop dropdown */}
        <AnimatePresence>
          {isOpen && (query.length >= 2 || recentSearches.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-0 right-0 mt-2 max-h-[420px] overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-lg z-[99999]"
            >
              {renderDropdownContent()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile search button */}
      <button
        className="flex md:hidden items-center justify-center w-10 h-10 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
        onClick={() => setMobileOpen(true)}
        aria-label="Search"
      >
        <Search size={20} />
      </button>

      {/* Mobile full-screen overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999999] bg-[var(--bg-primary)] flex flex-col safe-top safe-bottom"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-subtle)] safe-x shrink-0">
              <Search size={20} className="text-[var(--text-tertiary)] shrink-0" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search…"
                className="flex-1 bg-transparent text-base text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
              />
              <button
                onClick={() => { setMobileOpen(false); setQuery(''); setResults(null); }}
                className="tap-target rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] shrink-0"
                aria-label="Close search"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {renderDropdownContent()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
