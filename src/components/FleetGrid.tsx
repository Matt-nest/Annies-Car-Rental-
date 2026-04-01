import { useState, useMemo } from 'react';
import { ArrowUpDown, ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';
import { VEHICLES } from '../data/vehicles';
import { Vehicle, SortOption, FilterCategory } from '../types';
import VehicleCard from './VehicleCard';
import { useTheme } from '../App';
import { EASE } from '../utils/motion';

interface FleetGridProps {
  onSelectVehicle: (vehicle: Vehicle) => void;
}

export default function FleetGrid({ onSelectVehicle }: FleetGridProps) {
  const { theme } = useTheme();
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
  const [showAll, setShowAll] = useState(false);

  const categories: { label: string; value: FilterCategory }[] = [
    { label: 'All Vehicles', value: 'all' },
    { label: 'Economy', value: 'Economy' },
    { label: 'Sedan', value: 'Sedan' },
    { label: 'SUV', value: 'SUV' },
    { label: 'Premium', value: 'Premium' },
  ];

  const filteredAndSorted = useMemo(() => {
    let result = [...VEHICLES];
    if (filterCategory !== 'all') result = result.filter((v) => v.category === filterCategory);
    switch (sortBy) {
      case 'price-asc': result.sort((a, b) => a.dailyRate - b.dailyRate); break;
      case 'price-desc': result.sort((a, b) => b.dailyRate - a.dailyRate); break;
      case 'year-desc': result.sort((a, b) => b.year - a.year); break;
    }
    return result;
  }, [sortBy, filterCategory]);

  const displayedVehicles = showAll ? filteredAndSorted : filteredAndSorted.slice(0, 9);

  return (
    <section id="fleet" className="pt-16 pb-24 sm:pb-32 px-4 sm:px-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-14">
        <div className="max-w-2xl">
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-[11px] uppercase tracking-[0.3em] font-medium mb-4 block"
            style={{ color: 'var(--text-tertiary)' }}
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
            {VEHICLES.length} vehicles ready for daily and weekly rental.
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

      {/* Category Filter Pills */}
      <div className="flex gap-2.5 sm:gap-3 mb-10 sm:mb-14 no-scrollbar overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => { setFilterCategory(cat.value); setShowAll(false); }}
            className="snap-start px-5 sm:px-6 py-3 md:py-2.5 rounded-full text-sm font-medium border transition-all duration-500 hover:scale-[1.03] active:scale-95 whitespace-nowrap shrink-0"
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
        <div className="text-center py-20">
          <p style={{ color: 'var(--text-tertiary)' }} className="text-lg">No vehicles match your current filters.</p>
          <button
            onClick={() => setFilterCategory('all')}
            className="mt-4 underline underline-offset-4"
            style={{ color: 'var(--text-primary)' }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8">
          {displayedVehicles.map((v, i) => (
            <VehicleCard vehicle={v} onClick={() => onSelectVehicle(v)} index={i} key={v.id} />
          ))}
        </div>
      )}

      {/* Show More */}
      {filteredAndSorted.length > 9 && (
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <button
            onClick={() => setShowAll(!showAll)}
            className="px-10 py-4 rounded-full border transition-all duration-500 font-medium active:scale-95 hover:scale-[1.03] hover:bg-[var(--bg-card-hover)]"
            style={{ borderColor: 'var(--border-medium)', color: 'var(--text-secondary)' }}
          >
            {showAll ? 'Show Less' : `View All ${filteredAndSorted.length} Vehicles`}
          </button>
        </motion.div>
      )}
    </section>
  );
}
