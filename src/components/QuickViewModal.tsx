import React from 'react';
import { X, Users, Fuel, Gauge, Settings2, ArrowRight, Phone, ChevronLeft, ChevronRight, Star, MapPin } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Vehicle } from '../types';
import { getVehicleDisplayName } from '../data/vehicles';
import { getReviewsForVehicle } from '../data/reviews';
import { useTheme } from '../App';
import { EASE, DURATION } from '../utils/motion';

interface QuickViewModalProps {
  vehicle: Vehicle;
  onClose: () => void;
  onViewDetails: (vehicle: Vehicle) => void;
}

export default function QuickViewModal({ vehicle, onClose, onViewDetails }: QuickViewModalProps) {
  const { theme } = useTheme();
  const [imgIndex, setImgIndex] = useState(0);
  const reviews = getReviewsForVehicle(vehicle.id);
  const displayName = getVehicleDisplayName(vehicle);

  const specs = [
    { label: 'Seats', value: vehicle.seats.toString(), icon: Users },
    { label: 'MPG', value: vehicle.mpg.toString(), icon: Gauge },
    { label: 'Fuel', value: vehicle.fuel, icon: Fuel },
    { label: 'Trans.', value: vehicle.transmission === 'Automatic' ? 'Auto' : 'Manual', icon: Settings2 },
  ];

  const prevImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgIndex((p) => (p - 1 + vehicle.images.length) % vehicle.images.length);
  };
  const nextImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgIndex((p) => (p + 1) % vehicle.images.length);
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: EASE.smooth }}
        className="fixed inset-0 z-[300]"
        style={{ backgroundColor: 'var(--overlay)' }}
        onClick={onClose}
      />

      {/* Modal — no scroll, everything fits in viewport */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.6, ease: EASE.dramatic }}
        className="fixed inset-2 sm:inset-3 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-[310] md:w-[780px] rounded-2xl sm:rounded-3xl overflow-hidden flex flex-col border"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
          boxShadow: theme === 'dark'
            ? '0 25px 100px -20px rgba(0,0,0,0.7)'
            : '0 25px 100px -20px rgba(0,0,0,0.15)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-[transform] duration-300 hover:scale-110"
          style={{
            backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.95)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <X size={18} />
        </button>

        {/* Image — compact landscape hero */}
        <div className="relative w-full shrink-0 overflow-hidden bg-black" style={{ aspectRatio: '16 / 8' }}>
          <AnimatePresence mode="wait">
            <motion.img
              key={imgIndex}
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: EASE.standard }}
              src={vehicle.images[imgIndex]}
              alt={`${displayName} — angle ${imgIndex + 1}`}
              className="w-full h-full object-contain"
              style={{ backgroundColor: theme === 'dark' ? '#0a0a0a' : '#f0f0f0' }}
              referrerPolicy="no-referrer"
            />
          </AnimatePresence>

          {/* Subtle vignette */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.25) 100%)',
          }} />

          {/* Category + Year pill */}
          <div className="absolute top-4 left-4 flex gap-2 z-10">
            <span className="px-3 py-1.5 bg-black/70 text-[10px] text-white/80 rounded-full border border-white/10 font-semibold uppercase tracking-widest">
              {vehicle.category}
            </span>
            <span className="px-3 py-1.5 bg-black/70 text-[10px] text-white/80 rounded-full border border-white/10 font-medium">
              {vehicle.year}
            </span>
          </div>

          {/* Chevron navigation */}
          {vehicle.images.length > 1 && (
            <>
              <button
                onClick={prevImg}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-[background-color,transform] duration-300 hover:scale-110 z-10"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={nextImg}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-[background-color,transform] duration-300 hover:scale-110 z-10"
              >
                <ChevronRight size={18} />
              </button>
            </>
          )}

          {/* Dot indicators */}
          {vehicle.images.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {vehicle.images.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setImgIndex(i); }}
                  className={`rounded-full transition-all duration-300 ${i === imgIndex ? 'bg-white w-5 h-2' : 'bg-white/40 hover:bg-white/60 w-2 h-2'}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Content — compact, no scroll */}
        <div className="p-4 sm:p-5 md:px-7 md:py-5 space-y-3 sm:space-y-4 flex-1 overflow-y-auto">
          {/* Row 1: Title + stars on left, Price on right */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl md:text-2xl font-light tracking-tight leading-tight">{displayName}</h2>
              {reviews.length > 0 && (
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} size={11} fill="var(--accent-color)" stroke="var(--accent-color)" />
                    ))}
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{reviews.length} reviews</span>
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl md:text-3xl font-light">${vehicle.dailyRate}</span>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>/ day</span>
              </div>
              {vehicle.weeklyRate && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                  ${vehicle.weeklyRate} / week
                </p>
              )}
            </div>
          </div>

          {/* Row 2: Specs inline — compact horizontal strip */}
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            {specs.map((spec, i) => (
              <div
                key={i}
                className="rounded-xl py-2 sm:py-2.5 px-1.5 sm:px-2 text-center border transition-all duration-300 hover:scale-[1.03]"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
              >
                <spec.icon size={14} className="mx-auto mb-1" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-xs font-semibold">{spec.value}</p>
                <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{spec.label}</p>
              </div>
            ))}
          </div>

          {/* Row 3: Review quote — compact */}
          {reviews.length > 0 && (
            <div
              className="rounded-xl px-4 py-3 border flex gap-3 items-start"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="shrink-0 mt-0.5">
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} size={9} fill={i <= reviews[0].rating ? 'var(--accent-color)' : 'none'} stroke={i <= reviews[0].rating ? 'var(--accent-color)' : 'var(--text-tertiary)'} />
                  ))}
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-[13px] italic leading-snug line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                  "{reviews[0].comment}"
                </p>
                <p className="text-[11px] font-medium mt-1" style={{ color: 'var(--text-tertiary)' }}>— {reviews[0].reviewerName}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer bar — CTAs + location, always visible, no scroll */}
        <div
          className="shrink-0 px-4 sm:px-5 md:px-7 py-3 sm:py-4 flex items-center gap-2 sm:gap-3 border-t"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <button
            onClick={() => onViewDetails(vehicle)}
            className="group flex-1 py-3.5 rounded-full font-medium transition-all duration-300 hover:scale-[1.02] hover:shadow-xl active:scale-95 flex items-center justify-center gap-2 text-[14px]"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            View Details & Request
            <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" />
          </button>
          <a
            href="tel:+17729856667"
            className="shrink-0 py-3.5 px-5 rounded-full font-medium border transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 text-[14px]"
            style={{ borderColor: 'var(--border-medium)', color: 'var(--text-secondary)' }}
          >
            <Phone size={14} /> Call
          </a>
          <div className="hidden md:flex items-center gap-1.5 shrink-0 ml-1">
            <MapPin size={11} style={{ color: 'var(--text-tertiary)' }} />
            <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Port St. Lucie, FL</span>
          </div>
        </div>
      </motion.div>
    </>
  );
}
