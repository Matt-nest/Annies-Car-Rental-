/**
 * VehicleSlotIcons — SVG illustrated car outline placeholders for each photo slot.
 * Reusable, themeable, gold accent on dark / muted on light.
 * Follows customer site design system.
 */
import React from 'react';

interface SlotIconProps {
  size?: number;
  filled?: boolean;
  className?: string;
}

const baseStyle = (filled: boolean): React.CSSProperties => ({
  opacity: filled ? 1 : 0.45,
  transition: 'opacity 0.3s ease, transform 0.3s ease',
  transform: filled ? 'scale(1)' : 'scale(0.95)',
});

/** Front view — car facing viewer */
export function FrontViewIcon({ size = 48, filled = false, className }: SlotIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} style={baseStyle(filled)}>
      <path d="M12 42h40v4a4 4 0 01-4 4H16a4 4 0 01-4-4v-4z" stroke="currentColor" strokeWidth="1.5" fill={filled ? 'currentColor' : 'none'} opacity={filled ? 0.1 : 1} />
      <path d="M16 42l4-14a4 4 0 013.8-2.8h16.4A4 4 0 0144 28l4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="20" cy="42" r="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="44" cy="42" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M22 32h20" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
      <rect x="18" y="44" width="6" height="2" rx="1" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <rect x="40" y="44" width="6" height="2" rx="1" stroke="currentColor" strokeWidth="1" opacity="0.6" />
    </svg>
  );
}

/** Driver side view — car profile from left */
export function DriverSideIcon({ size = 48, filled = false, className }: SlotIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} style={baseStyle(filled)}>
      <path d="M6 40h52" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 40l2-6h8l6-10h16l4 10h8l2 6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill={filled ? 'currentColor' : 'none'} opacity={filled ? 0.1 : 1} />
      <circle cx="18" cy="42" r="4" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="46" cy="42" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M26 24h6v10h-6z" stroke="currentColor" strokeWidth="1" opacity="0.4" rx="1" />
      <path d="M34 28h8v6h-8z" stroke="currentColor" strokeWidth="1" opacity="0.4" rx="1" />
    </svg>
  );
}

/** Passenger side view — car profile from right */
export function PassengerSideIcon({ size = 48, filled = false, className }: SlotIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} style={baseStyle(filled)}>
      <path d="M58 40H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M54 40l-2-6h-8l-6-10H22l-4 10h-8l-2 6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill={filled ? 'currentColor' : 'none'} opacity={filled ? 0.1 : 1} />
      <circle cx="46" cy="42" r="4" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="18" cy="42" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M38 24h-6v10h6z" stroke="currentColor" strokeWidth="1" opacity="0.4" rx="1" />
      <path d="M30 28h-8v6h8z" stroke="currentColor" strokeWidth="1" opacity="0.4" rx="1" />
    </svg>
  );
}

/** Rear view — car from behind */
export function RearViewIcon({ size = 48, filled = false, className }: SlotIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} style={baseStyle(filled)}>
      <path d="M12 42h40v4a4 4 0 01-4 4H16a4 4 0 01-4-4v-4z" stroke="currentColor" strokeWidth="1.5" fill={filled ? 'currentColor' : 'none'} opacity={filled ? 0.1 : 1} />
      <path d="M16 42l3-12a4 4 0 013.9-3h18.2a4 4 0 013.9 3l3 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="18" y="44" width="8" height="2" rx="1" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <rect x="38" y="44" width="8" height="2" rx="1" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <path d="M24 34h16" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}

/** Dashboard / interior view */
export function DashboardIcon({ size = 48, filled = false, className }: SlotIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} style={baseStyle(filled)}>
      <rect x="8" y="18" width="48" height="28" rx="6" stroke="currentColor" strokeWidth="1.5" fill={filled ? 'currentColor' : 'none'} opacity={filled ? 0.1 : 1} />
      <circle cx="24" cy="32" r="8" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
      <path d="M24 26v6l3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      <circle cx="42" cy="32" r="5" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
      <rect x="14" y="42" width="36" height="4" rx="2" stroke="currentColor" strokeWidth="1" opacity="0.3" />
    </svg>
  );
}

/** Damage detail icon */
export function DamageIcon({ size = 48, filled = false, className }: SlotIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} style={baseStyle(filled)}>
      <circle cx="32" cy="32" r="20" stroke="currentColor" strokeWidth="1.5" fill={filled ? 'currentColor' : 'none'} opacity={filled ? 0.1 : 1} />
      <path d="M32 22v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="32" cy="42" r="1.5" fill="currentColor" />
    </svg>
  );
}

/** Lookup map: slot name → icon component */
export const SLOT_ICONS: Record<string, React.FC<SlotIconProps>> = {
  front: FrontViewIcon,
  driver_side: DriverSideIcon,
  passenger_side: PassengerSideIcon,
  rear: RearViewIcon,
  dashboard: DashboardIcon,
  damage: DamageIcon,
};
