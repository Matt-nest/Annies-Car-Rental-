import { memo } from 'react';
import { Users, Fuel, Gauge, ArrowUpRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Vehicle } from '../../types';
import { getVehicleDisplayName } from '../../data/vehicles';
import { useTheme } from '../../context/ThemeContext';
import { EASE, STAGGER } from '../../utils/motion';

export interface VehicleCardProps {
  vehicle: Vehicle;
  onClick: () => void;
  index?: number;
}

const VehicleCard = memo(function VehicleCard({ vehicle, onClick, index = 0 }: VehicleCardProps) {
  const { theme } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '50px' }}
      transition={{ delay: index < 3 ? index * STAGGER.normal : 0, duration: 0.6, ease: EASE.standard }}
      whileHover={window.matchMedia('(hover: hover)').matches ? { y: -6, transition: { duration: 0.4, ease: EASE.smooth } } : undefined}
      onClick={onClick}
      className="vehicle-card group cursor-pointer rounded-3xl overflow-hidden border"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Image — object-contain for studio renders, dark bg for contrast */}
      <div
        className="aspect-[16/10] overflow-hidden relative"
        style={{ backgroundColor: theme === 'dark' ? '#0a0a0a' : '#f0f0f0' }}
      >
        <img
          src={vehicle.image}
          alt={getVehicleDisplayName(vehicle)}
          className="w-full h-full object-contain transition-transform duration-700 scale-110 group-hover:scale-[1.18]"
          style={{ filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))' }}
          loading="lazy"
          decoding="async"
        />
        {/* Gradient overlay on hover */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 40%)' }}
        />
        {/* Category badge */}
        <div className="absolute top-3 sm:top-4 left-3 sm:left-4">
          <span
            className="px-2.5 sm:px-3 py-1 md:backdrop-blur-xl text-[10px] rounded-full border font-semibold uppercase tracking-widest"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.92)',
              borderColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              color: theme === 'dark' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)',
            }}
          >
            {vehicle.category}
          </span>
        </div>
        {/* Arrow indicator on hover */}
        <div className="absolute bottom-3 sm:bottom-4 right-3 sm:right-4 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 text-black flex items-center justify-center">
            <ArrowUpRight size={16} />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 sm:p-6">
        <div className="flex justify-between items-start mb-3 sm:mb-4">
          <div className="min-w-0 pr-2">
            <h3 className="text-[15px] sm:text-[17px] font-medium leading-snug mb-1 truncate">{getVehicleDisplayName(vehicle)}</h3>
            {vehicle.weeklyRate && (
              <span className="text-[10px] sm:text-[11px] font-medium uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                Weekly available
              </span>
            )}
          </div>
          <div className="text-right shrink-0">
            <span className="text-xl sm:text-2xl font-light">${vehicle.dailyRate}</span>
            <span className="text-xs sm:text-sm block" style={{ color: 'var(--text-tertiary)' }}>/ day</span>
          </div>
        </div>
        <div
          className="flex gap-4 sm:gap-5 text-xs sm:text-sm pt-3 sm:pt-4"
          style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
        >
          <div className="flex items-center gap-1.5">
            <Users size={12} />
            <span>{vehicle.seats}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Gauge size={12} />
            <span>{vehicle.mpg} MPG</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Fuel size={12} />
            <span>{vehicle.fuel}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

export default VehicleCard;

