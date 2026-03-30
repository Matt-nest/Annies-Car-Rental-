import { Users, Fuel, Gauge, ArrowUpRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Vehicle } from '../types';
import { getVehicleDisplayName } from '../data/vehicles';
import { useTheme } from '../App';
import { EASE, STAGGER } from '../utils/motion';

interface VehicleCardProps {
  vehicle: Vehicle;
  onClick: () => void;
  index?: number;
}

export default function VehicleCard({ vehicle, onClick, index = 0 }: VehicleCardProps) {
  const { theme } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ delay: (index % 3) * STAGGER.normal, duration: 0.6, ease: EASE.standard }}
      whileHover={{ y: -6, transition: { duration: 0.4, ease: EASE.smooth } }}
      onClick={onClick}
      className="vehicle-card group cursor-pointer rounded-3xl overflow-hidden border"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Image with shimmer placeholder */}
      <div className="aspect-[16/10] overflow-hidden relative bg-[var(--bg-card)]">
        <img
          src={vehicle.image}
          alt={getVehicleDisplayName(vehicle)}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          referrerPolicy="no-referrer"
          loading="lazy"
        />
        {/* Gradient overlay on hover */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)' }}
        />
        {/* Category badge */}
        <div className="absolute top-4 left-4">
          <span
            className="px-3 py-1 backdrop-blur-xl text-[10px] rounded-full border font-semibold uppercase tracking-widest"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.85)',
              borderColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              color: theme === 'dark' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)',
            }}
          >
            {vehicle.category}
          </span>
        </div>
        {/* Arrow indicator on hover */}
        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0">
          <div className="w-10 h-10 rounded-full bg-white/90 text-black flex items-center justify-center backdrop-blur-sm">
            <ArrowUpRight size={18} />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-[17px] font-medium leading-snug mb-1">{getVehicleDisplayName(vehicle)}</h3>
            {vehicle.weeklyRate && (
              <span className="text-[11px] font-medium uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                Weekly available
              </span>
            )}
          </div>
          <div className="text-right shrink-0 ml-4">
            <span className="text-2xl font-light">${vehicle.dailyRate}</span>
            <span className="text-sm block" style={{ color: 'var(--text-tertiary)' }}>/ day</span>
          </div>
        </div>
        <div
          className="flex gap-5 text-sm pt-4"
          style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
        >
          <div className="flex items-center gap-1.5">
            <Users size={13} />
            <span>{vehicle.seats}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Gauge size={13} />
            <span>{vehicle.mpg} MPG</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Fuel size={13} />
            <span>{vehicle.fuel}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
