/**
 * SlotPhotoUploader — Structured photo upload for vehicle check-in.
 * Each slot (front, driver_side, passenger_side, rear) is required.
 * Dashboard and damage are optional.
 *
 * Uses VehicleSlotIcons for illustrated placeholders with gold accent.
 * Separate from PhotoUploader.tsx — different UX pattern (slot-based vs list).
 */
import React, { useState, useRef } from 'react';
import { Camera, X, Loader2, Check, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { API_URL } from '../../config';
import { SLOT_ICONS } from './VehicleSlotIcons';

// ── Slot Configuration ────────────────────────────────────────────────────

interface SlotConfig {
  key: string;
  label: string;
  required: boolean;
  hint: string;
  multi?: boolean; // damage can have multiple photos
}

const SLOTS: SlotConfig[] = [
  { key: 'front', label: 'Front', required: true, hint: 'Full front view of vehicle' },
  { key: 'driver_side', label: 'Driver Side', required: true, hint: 'Full left profile' },
  { key: 'passenger_side', label: 'Passenger Side', required: true, hint: 'Full right profile' },
  { key: 'rear', label: 'Rear', required: true, hint: 'Full rear view' },
  { key: 'dashboard', label: 'Dashboard', required: false, hint: 'Odometer / dashboard (optional)' },
  { key: 'damage', label: 'Existing Damage', required: false, hint: 'Photo any damage you see (optional)', multi: true },
];

const REQUIRED_SLOTS = SLOTS.filter(s => s.required).map(s => s.key);

// ── Types ─────────────────────────────────────────────────────────────────

export interface PhotoSlots {
  [key: string]: string | string[];
}

interface SlotPhotoUploaderProps {
  token: string;
  onSlotsChange: (slots: PhotoSlots, allRequiredFilled: boolean) => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function SlotPhotoUploader({ token, onSlotsChange }: SlotPhotoUploaderProps) {
  const [slots, setSlots] = useState<Record<string, string | string[]>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const filledCount = REQUIRED_SLOTS.filter(k => slots[k]).length;
  const allFilled = filledCount === REQUIRED_SLOTS.length;

  const handleUpload = async (slotKey: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(slotKey);
    setUploadError('');

    try {
      const formData = new FormData();
      Array.from(files).forEach(f => formData.append('photos', f));

      const res = await fetch(`${API_URL}/uploads/checkin-photos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(data.error || 'Upload failed');
      }

      const data = await res.json();
      const urls: string[] = data.photos?.map((p: any) => p.url) || data.urls || data.files?.map((f: any) => f.url) || [];

      if (urls.length === 0) throw new Error('No files uploaded');

      const slotDef = SLOTS.find(s => s.key === slotKey);
      const updated = { ...slots };

      if (slotDef?.multi) {
        // Damage: append to array
        const existing = Array.isArray(updated[slotKey]) ? (updated[slotKey] as string[]) : [];
        updated[slotKey] = [...existing, ...urls];
      } else {
        // Single: replace
        updated[slotKey] = urls[0];
      }

      setSlots(updated);
      const requiredFilled = REQUIRED_SLOTS.every(k => updated[k]);
      onSlotsChange(updated, requiredFilled);
    } catch (err: any) {
      setUploadError(err.message);
    }
    setUploading(null);
  };

  const removeSlot = (slotKey: string, index?: number) => {
    const updated = { ...slots };
    if (typeof index === 'number' && Array.isArray(updated[slotKey])) {
      const arr = [...(updated[slotKey] as string[])];
      arr.splice(index, 1);
      updated[slotKey] = arr.length > 0 ? arr : [];
      if (arr.length === 0) delete updated[slotKey];
    } else {
      delete updated[slotKey];
    }
    setSlots(updated);
    const requiredFilled = REQUIRED_SLOTS.every(k => updated[k]);
    onSlotsChange(updated, requiredFilled);
  };

  return (
    <div className="space-y-4">
      {/* Progress Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera size={18} style={{ color: 'var(--accent-color)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Vehicle Photos
          </span>
        </div>
        <div
          className="text-xs font-mono font-semibold px-3 py-1 rounded-full"
          style={{
            backgroundColor: allFilled ? 'rgba(34,197,94,0.1)' : 'var(--bg-card-hover)',
            color: allFilled ? '#22c55e' : 'var(--text-tertiary)',
            border: `1px solid ${allFilled ? 'rgba(34,197,94,0.3)' : 'var(--border-subtle)'}`,
          }}
        >
          {filledCount}/{REQUIRED_SLOTS.length} required
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {uploadError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-3 rounded-xl text-xs flex items-center gap-2"
            style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <AlertTriangle size={14} />
            {uploadError}
            <button onClick={() => setUploadError('')} className="ml-auto"><X size={12} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slot Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {SLOTS.map(slot => {
          const SlotIcon = SLOT_ICONS[slot.key];
          const isUploading = uploading === slot.key;
          const hasPhoto = slot.multi
            ? Array.isArray(slots[slot.key]) && (slots[slot.key] as string[]).length > 0
            : !!slots[slot.key];
          const photoUrl = slot.multi
            ? (Array.isArray(slots[slot.key]) ? (slots[slot.key] as string[])[0] : undefined)
            : (slots[slot.key] as string | undefined);

          return (
            <div key={slot.key} className="relative group">
              <input
                ref={el => { inputRefs.current[slot.key] = el; }}
                type="file"
                accept="image/*"
                capture="environment"
                multiple={slot.multi}
                className="hidden"
                onChange={e => handleUpload(slot.key, e.target.files)}
              />

              <button
                onClick={() => inputRefs.current[slot.key]?.click()}
                disabled={isUploading}
                className="w-full aspect-[4/3] rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer"
                style={{
                  backgroundColor: hasPhoto ? 'transparent' : 'var(--bg-card-hover)',
                  border: hasPhoto
                    ? '2px solid rgba(34,197,94,0.4)'
                    : slot.required
                      ? '2px dashed var(--accent-color)'
                      : '2px dashed var(--border-subtle)',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {/* Uploaded photo preview */}
                {hasPhoto && photoUrl ? (
                  <>
                    <img
                      src={photoUrl}
                      alt={slot.label}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        borderRadius: '10px',
                      }}
                    />
                    {/* Success overlay */}
                    <div style={{
                      position: 'absolute',
                      top: 6, right: 6,
                      width: 22, height: 22,
                      borderRadius: '50%',
                      backgroundColor: '#22c55e',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Check size={12} color="#fff" strokeWidth={3} />
                    </div>
                    {slot.multi && Array.isArray(slots[slot.key]) && (slots[slot.key] as string[]).length > 1 && (
                      <div style={{
                        position: 'absolute',
                        bottom: 6, right: 6,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}>
                        +{(slots[slot.key] as string[]).length - 1}
                      </div>
                    )}
                  </>
                ) : isUploading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent-color)' }} />
                    <span className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>Uploading…</span>
                  </>
                ) : (
                  <>
                    {SlotIcon && <SlotIcon size={36} filled={false} />}
                    <span className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                      {slot.hint}
                    </span>
                  </>
                )}
              </button>

              {/* Label + remove */}
              <div className="flex items-center justify-between mt-1.5 px-1">
                <span className="text-xs font-medium" style={{
                  color: hasPhoto ? '#22c55e' : slot.required ? 'var(--accent-color)' : 'var(--text-tertiary)',
                }}>
                  {slot.label}
                  {slot.required && !hasPhoto && <span style={{ color: '#ef4444' }}> *</span>}
                </span>
                {hasPhoto && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeSlot(slot.key); }}
                    className="text-[10px] font-medium transition-opacity hover:opacity-100 opacity-60"
                    style={{ color: '#ef4444' }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Help text */}
      <p className="text-[11px] text-center" style={{ color: 'var(--text-tertiary)' }}>
        Photos document the vehicle's condition at pickup. Take clear, well-lit photos from each angle.
      </p>
    </div>
  );
}
