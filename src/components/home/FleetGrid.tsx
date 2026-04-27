import { useState, useMemo } from 'react';
import { ArrowUpDown, ChevronDown, TrendingUp, ArrowRight, Phone, MessageSquare } from 'lucide-react';
import RateToggle from './RateToggle';
import { AnimatePresence, motion } from 'motion/react';
import { useVehicles } from '../../hooks/useVehicles';
import { Vehicle, SortOption, FilterCategory, RateMode } from '../../types';
import VehicleCard from './VehicleCard';
import MonthlyInquiryModal from './MonthlyInquiryModal';
import { useTheme } from '../../context/ThemeContext';
import { EASE } from '../../utils/motion';

interface FleetGridProps {
  onSelectVehicle: (vehicle: Vehicle) => void;
  rateMode?: RateMode;
  onRateModeChange?: (mode: RateMode) => void;
}

export default function FleetGrid({ onSelectVehicle, rateMode = 'daily', onRateModeChange }: FleetGridProps) {
  const { theme } = useTheme();
  const { vehicles } = useVehicles();
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
  const [showAll, setShowAll] = useState(false);
  const [monthlyVehicle, setMonthlyVehicle] = useState<Vehicle | null>(null);

  const categories: { label: string; value: FilterCategory }[] = [
    { label: 'All Vehicles', value: 'all' },
    { label: 'Economy', value: 'Economy' },
    { label: 'Sedan', value: 'Sedan' },
    { label: 'SUV', value: 'SUV' },
    { label: 'Premium', value: 'Premium' },
  ];

  const filteredAndSorted = useMemo(() => {
    let result = [...vehicles];
    if (filterCategory !== 'all') result = result.filter((v) => v.tags.includes(filterCategory));
    switch (sortBy) {
      case 'price-asc': result.sort((a, b) => a.dailyRate - b.dailyRate); break;
      case 'price-desc': result.sort((a, b) => b.dailyRate - a.dailyRate); break;
      case 'year-desc': result.sort((a, b) => b.year - a.year); break;
    }
    return result;
  }, [vehicles, sortBy, filterCategory]);

  // In monthly mode, filter out vehicles without a monthly price
  const displayableVehicles = useMemo(() => {
    if (rateMode !== 'monthly') return filteredAndSorted;
    return filteredAndSorted.filter(v => v.monthlyDisplayPrice != null);
  }, [filteredAndSorted, rateMode]);

  const displayedVehicles = showAll ? displayableVehicles : displayableVehicles.slice(0, 9);

  const handleCardClick = (vehicle: Vehicle) => {
    if (rateMode === 'monthly') {
      setMonthlyVehicle(vehicle);
    } else {
      onSelectVehicle(vehicle);
    }
  };

  const monthlySubtitle = rateMode === 'monthly'
    ? `${displayableVehicles.length} vehicle${displayableVehicles.length !== 1 ? 's' : ''} available for monthly rental`
    : `${vehicles.length} vehicle${vehicles.length !== 1 ? 's' : ''} ready to rent.`;

  return (
    <section id="fleet" className="pt-16 pb-24 sm:pb-32 px-4 sm:px-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-6">
        <div className="max-w-2xl">
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-[11px] uppercase tracking-[0.3em] font-medium mb-4 block"
            style={{ color: 'var(--accent-color)' }}
          >
            Our Collection
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ ease: EASE.standard }}
            className="text-4xl md:text-6xl font-light tracking-tight mb-4"
          >
            The Fleet
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, ease: EASE.standard }}
            className="text-lg"
            style={{ color: 'var(--text-secondary)' }}
          >
            {monthlySubtitle}
          </motion.p>
        </div>

        {/* Sort */}
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            aria-label="Sort vehicles"
            className="appearance-none pl-10 pr-14 py-3 rounded-full border text-sm font-medium transition-all duration-300 focus:outline-none cursor-pointer"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-medium)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="default">Default Order</option>
            <option value="price-asc">Price: Low → High</option>
            <option value="price-desc">Price: High → Low</option>
            <option value="year-desc">Newest First</option>
          </select>
          <ArrowUpDown className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-tertiary)' }} size={14} />
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-tertiary)' }} size={14} />
        </div>
      </div>

      {/* Rate Toggle Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
        <RateToggle value={rateMode} onChange={onRateModeChange ?? (() => {})} />

        <AnimatePresence mode="wait">
          {rateMode === 'daily' && (
            <motion.button
              key="daily-hint"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.25 }}
              onClick={() => onRateModeChange?.('weekly')}
              className="flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-medium transition-all duration-300 hover:scale-[1.02] active:scale-95 cursor-pointer self-start sm:self-auto"
              style={{
                backgroundColor: 'rgba(212,175,55,0.08)',
                borderColor: 'rgba(212,175,55,0.35)',
                color: 'var(--accent-color)',
              }}
            >
              <TrendingUp size={12} />
              Weekly &amp; monthly save more — see the difference
              <ArrowRight size={12} />
            </motion.button>
          )}
          {rateMode === 'weekly' && (
            <motion.p
              key="weekly-hint"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.25 }}
              className="text-xs font-medium"
              style={{ color: 'var(--accent-color)' }}
            >
              ∞ Unlimited mileage on all weekly rentals
            </motion.p>
          )}
          {rateMode === 'monthly' && (
            <motion.p
              key="monthly-hint"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.25 }}
              className="text-xs font-medium"
              style={{ color: 'var(--accent-color)' }}
            >
              Every long-term rental is personal — call Annie for your rate
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Category Filter Pills */}
      <div className="flex gap-2.5 sm:gap-3 mb-10 sm:mb-14 no-scrollbar overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => { setFilterCategory(cat.value); setShowAll(false); }}
            className="snap-start px-5 sm:px-6 py-3 md:py-2.5 rounded-full text-sm font-medium border transition-all duration-500 hover:scale-[1.03] active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
            style={{
              backgroundColor: filterCategory === cat.value ? 'var(--accent)' : 'var(--bg-card)',
              color: filterCategory === cat.value ? 'var(--accent-fg)' : 'var(--text-secondary)',
              borderColor: filterCategory === cat.value ? 'var(--accent)' : 'var(--border-subtle)',
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {displayedVehicles.length === 0 ? (
        <div className="py-8">
          {rateMode === 'monthly' ? (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE.standard }}
              className="max-w-2xl mx-auto rounded-3xl p-10 md:p-14 text-center border relative overflow-hidden"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              {/* Subtle gold glow top-right */}
              <div
                className="absolute -top-16 -right-16 w-64 h-64 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.07) 0%, transparent 70%)' }}
              />

              <div className="w-10 h-px mx-auto mb-8" style={{ backgroundColor: 'var(--accent-color)' }} />

              <span className="text-[11px] uppercase tracking-[0.3em] font-semibold mb-4 block" style={{ color: 'var(--accent-color)' }}>
                Long-Term Rentals
              </span>

              <h3 className="text-3xl md:text-4xl font-light tracking-tight mb-5">
                Let's work something out.
              </h3>

              <p className="text-base leading-relaxed mb-10 max-w-lg mx-auto" style={{ color: 'var(--text-secondary)' }}>
                Monthly rates are personal — every situation is different.
                Snowbird staying the season? Rideshare driver needing a weekly car?
                Between vehicles? Call Annie, tell her what you need, and she'll
                put together a rate that makes sense. No platform fees. No fine print.
                Just a fair deal, directly with the owner.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href="tel:+17729856667"
                  className="px-8 py-4 rounded-full font-medium transition-all duration-500 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 text-sm"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
                >
                  <Phone size={15} />
                  Call (772) 985-6667
                </a>
                <a
                  href="sms:+17729856667"
                  className="px-8 py-4 rounded-full font-medium border transition-all duration-500 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 text-sm"
                  style={{ borderColor: 'var(--border-medium)', color: 'var(--text-secondary)' }}
                >
                  <MessageSquare size={15} />
                  Text Us
                </a>
              </div>

              <p className="text-xs mt-8" style={{ color: 'var(--text-tertiary)' }}>
                We respond same day · Serving Port St. Lucie and the Treasure Coast
              </p>
            </motion.div>
          ) : (
            <>
              <p style={{ color: 'var(--text-tertiary)' }} className="text-lg text-center py-20">No vehicles match your current filters.</p>
              <div className="text-center">
                <button
                  onClick={() => setFilterCategory('all')}
                  className="mt-4 underline underline-offset-4"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Clear filters
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8">
          {displayedVehicles.map((v: Vehicle, i: number) => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              onClick={() => handleCardClick(v)}
              index={i}
              rateMode={rateMode}
            />
          ))}
        </div>
      )}

      {/* Show More */}
      {displayableVehicles.length > 9 && (
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <button
            onClick={() => setShowAll(!showAll)}
            className="px-10 py-4 rounded-full border transition-all duration-500 font-medium active:scale-95 hover:scale-[1.03] hover:bg-[var(--bg-card-hover)] cursor-pointer"
            style={{ borderColor: 'var(--border-medium)', color: 'var(--text-secondary)' }}
          >
            {showAll ? 'Show Less' : `View All ${displayableVehicles.length} Vehicles`}
          </button>
        </motion.div>
      )}

      {/* Monthly Inquiry Modal */}
      <AnimatePresence>
        {monthlyVehicle && (
          <MonthlyInquiryModal
            vehicle={monthlyVehicle}
            onClose={() => setMonthlyVehicle(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
