/**
 * SlotPhotoUploader - Structured photo upload for vehicle check-in.
 * Each slot (front, driver_side, passenger_side, rear) is required.
 * Customers can upload up to 8 total condition photos across all slots.
 *
 * Uses VehicleSlotIcons for illustrated placeholders with gold accent.
 * Separate from PhotoUploader.tsx - different UX pattern (slot-based vs list).
 */
import React, { useState, useRef } from 'react';
import { Camera, X, Loader2, Check, AlertTriangle, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { API_URL } from '../../config';
import { compressImage } from '../../utils/compressImage';
import { SLOT_ICONS } from './VehicleSlotIcons';

// ── Slot Configuration ────────────────────────────────────────────────────

interface SlotConfig {
  key: string;
  label: string;
  shortLabel: string;
  required: boolean;
  hint: string;
  multi?: boolean; // damage can have multiple photos
}

const SLOTS: SlotConfig[] = [
  { key: 'front', label: 'Front', shortLabel: 'Front', required: true, hint: 'Full front view of vehicle' },
  { key: 'driver_side', label: 'Driver Side', shortLabel: 'Driver', required: true, hint: 'Full left profile' },
  { key: 'passenger_side', label: 'Passenger Side', shortLabel: 'Passenger', required: true, hint: 'Full right profile' },
  { key: 'rear', label: 'Rear', shortLabel: 'Rear', required: true, hint: 'Full rear view' },
  { key: 'dashboard', label: 'Dashboard', shortLabel: 'Dash', required: false, hint: 'Odometer / dashboard' },
  { key: 'interior_front', label: 'Front Interior', shortLabel: 'Front Int.', required: false, hint: 'Front seats and controls' },
  { key: 'interior_rear', label: 'Rear Interior', shortLabel: 'Rear Int.', required: false, hint: 'Rear seats and floor' },
  { key: 'damage', label: 'Existing Damage', shortLabel: 'Damage', required: false, hint: 'Photo any damage you see', multi: true },
];

const REQUIRED_SLOTS = SLOTS.filter(s => s.required).map(s => s.key);
const MAX_CONDITION_PHOTOS = 8;

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
  const [currentIndex, setCurrentIndex] = useState(0);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  // Maps storage paths → signed URLs for immediate preview in this session
  const previewMap = useRef<Record<string, string>>({});

  const filledCount = REQUIRED_SLOTS.filter(k => slots[k]).length;
  const allFilled = filledCount === REQUIRED_SLOTS.length;
  const photoCount = countSlotPhotos(slots);
  const currentSlot = SLOTS[currentIndex] || SLOTS[0];
  const currentSlotValues = getSlotValues(currentSlot.key);
  const currentPhotoUrl = currentSlotValues[0]
    ? (previewMap.current[currentSlotValues[0]] || (currentSlotValues[0].startsWith('http') ? currentSlotValues[0] : undefined))
    : undefined;
  const isUploadingCurrent = uploading === currentSlot.key;
  const currentSlotFilled = currentSlotValues.length > 0;

  function countSlotPhotos(source: Record<string, string | string[]>) {
    return Object.values(source).reduce((total, value) => {
      if (Array.isArray(value)) return total + value.filter(Boolean).length;
      return total + (value ? 1 : 0);
    }, 0);
  }

  function getSlotValues(slotKey: string) {
    const value = slots[slotKey];
    if (Array.isArray(value)) return value.filter(Boolean);
    return value ? [value] : [];
  }

  function slotIsFilled(slotKey: string) {
    return getSlotValues(slotKey).length > 0;
  }

  function moveSlide(delta: number) {
    setCurrentIndex(index => Math.min(SLOTS.length - 1, Math.max(0, index + delta)));
  }

  const handleUpload = async (slotKey: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(slotKey);
    setUploadError('');

    try {
      const slotDef = SLOTS.find(s => s.key === slotKey);
      const existingSlotCount = Array.isArray(slots[slotKey])
        ? (slots[slotKey] as string[]).filter(Boolean).length
        : (slots[slotKey] ? 1 : 0);
      const remaining = MAX_CONDITION_PHOTOS - photoCount + (slotDef?.multi ? 0 : existingSlotCount);
      if (remaining <= 0) {
        throw new Error(`Maximum ${MAX_CONDITION_PHOTOS} photos allowed`);
      }

      const formData = new FormData();
      // Compress each file to stay under Vercel's 4.5MB body-size limit
      const compressedFiles = await Promise.all(
        Array.from(files).slice(0, slotDef?.multi ? remaining : 1).map(f => compressImage(f))
      );
      compressedFiles.forEach(f => formData.append('photos', f));

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
      // Each photo returns { url: signedUrl, path: storagePath, bucket }.
      // We store the PERMANENT storage path for the database (won't expire).
      // The signed url is used only for immediate preview in this session.
      const photosData: { url: string; path: string }[] = data.photos || [];

      if (photosData.length === 0) throw new Error('No files uploaded');

      const updated = { ...slots };

      if (slotDef?.multi) {
        // Damage: append to array - store paths
        const existing = Array.isArray(updated[slotKey]) ? (updated[slotKey] as string[]) : [];
        updated[slotKey] = [...existing, ...photosData.map(p => p.path)];
      } else {
        // Single: replace - store path
        updated[slotKey] = photosData[0].path;
      }

      // Keep a local preview map so we can show the image immediately
      // using the signed URL from this session
      for (const p of photosData) {
        previewMap.current[p.path] = p.url;
      }

      setSlots(updated);
      const requiredFilled = REQUIRED_SLOTS.every(k => updated[k]);
      onSlotsChange(updated, requiredFilled);
      const nextRequiredIndex = SLOTS.findIndex((slot, index) => index > currentIndex && slot.required && !updated[slot.key]);
      if (nextRequiredIndex >= 0) setCurrentIndex(nextRequiredIndex);
      else if (currentIndex < SLOTS.length - 1) setCurrentIndex(currentIndex + 1);
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Camera size={18} style={{ color: 'var(--accent-color)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Vehicle photos
            </span>
          </div>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            One photo at a time.
          </p>
        </div>
        <div
          className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold tabular-nums"
          style={{
            backgroundColor: allFilled ? 'rgba(34,197,94,0.1)' : 'var(--bg-card-hover)',
            color: allFilled ? '#22c55e' : 'var(--text-tertiary)',
            border: `1px solid ${allFilled ? 'rgba(34,197,94,0.3)' : 'var(--border-subtle)'}`,
          }}
        >
          {photoCount}/{MAX_CONDITION_PHOTOS}
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

      <div
        className="overflow-hidden rounded-3xl"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center justify-between gap-3 p-4">
          <button
            type="button"
            onClick={() => moveSlide(-1)}
            disabled={currentIndex === 0}
            aria-label="Previous photo example"
            className="tap-target rounded-full transition-opacity disabled:opacity-30"
            style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
          >
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0 text-center">
            <div className="flex items-center justify-center gap-2">
              <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {currentSlot.label}
              </p>
              {currentSlot.required && !currentSlotFilled && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                  Required
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {currentIndex + 1} of {SLOTS.length}
            </p>
          </div>
          <button
            type="button"
            onClick={() => moveSlide(1)}
            disabled={currentIndex === SLOTS.length - 1}
            aria-label="Next photo example"
            className="tap-target rounded-full transition-opacity disabled:opacity-30"
            style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <input
          ref={el => { inputRefs.current[currentSlot.key] = el; }}
          type="file"
          accept="image/*"
          capture="environment"
          multiple={currentSlot.multi}
          className="hidden"
          onChange={e => {
            handleUpload(currentSlot.key, e.target.files);
            e.currentTarget.value = '';
          }}
        />

        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={() => inputRefs.current[currentSlot.key]?.click()}
            disabled={isUploadingCurrent}
            className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl transition-transform active:scale-[0.99]"
            style={{
              backgroundColor: currentSlotFilled && currentPhotoUrl ? 'transparent' : 'var(--bg-card-hover)',
              border: currentSlotFilled ? '2px solid rgba(34,197,94,0.42)' : '2px dashed var(--border-medium)',
            }}
          >
            {currentSlotFilled && currentPhotoUrl ? (
              <>
                <img src={currentPhotoUrl} alt={currentSlot.label} className="absolute inset-0 h-full w-full object-cover" />
                <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: '#22c55e', color: '#fff' }}>
                  <Check size={16} strokeWidth={3} />
                </span>
                {currentSlot.multi && currentSlotValues.length > 1 && (
                  <span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-3 py-1 text-xs font-semibold text-white">
                    {currentSlotValues.length} photos
                  </span>
                )}
              </>
            ) : isUploadingCurrent ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent-color)' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Uploading...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 px-6 text-center">
                {(() => {
                  const SlotIcon = SLOT_ICONS[currentSlot.key];
                  return SlotIcon ? <SlotIcon size={72} filled={false} /> : <Camera size={46} style={{ color: 'var(--accent-color)' }} />;
                })()}
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--text-tertiary)' }}>Example</p>
                  <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{currentSlot.hint}</p>
                </div>
              </div>
            )}
          </button>

          <div className="mt-4 grid grid-cols-[1fr_auto] gap-3">
            <button
              type="button"
              onClick={() => inputRefs.current[currentSlot.key]?.click()}
              disabled={isUploadingCurrent}
              className="tap-target rounded-full px-4 text-sm font-semibold transition-transform active:scale-[0.98]"
              style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-fg)' }}
            >
              <Camera size={16} />
              <span>{currentSlotFilled ? 'Retake' : 'Camera / Upload'}</span>
            </button>
            {currentSlotFilled && (
              <button
                type="button"
                onClick={() => removeSlot(currentSlot.key)}
                className="tap-target rounded-full px-3 text-sm font-semibold"
                style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {currentSlot.multi && currentSlotFilled && (
            <button
              type="button"
              onClick={() => inputRefs.current[currentSlot.key]?.click()}
              disabled={photoCount >= MAX_CONDITION_PHOTOS || isUploadingCurrent}
              className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full px-4 text-xs font-semibold disabled:opacity-40"
              style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
            >
              <Upload size={14} />
              Add another damage photo
            </button>
          )}

          <div className="mt-4 flex items-center justify-center gap-1.5">
            {SLOTS.map((slot, index) => {
              const done = slotIsFilled(slot.key);
              const active = index === currentIndex;
              return (
                <button
                  key={slot.key}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  aria-label={`Show ${slot.label}`}
                  className="h-2.5 rounded-full transition-all"
                  style={{
                    width: active ? 22 : 10,
                    backgroundColor: done ? '#22c55e' : active ? 'var(--accent-color)' : 'var(--border-medium)',
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      <p className="text-center text-[11px]" style={{ color: allFilled ? '#22c55e' : 'var(--text-tertiary)' }}>
        {allFilled ? 'Required photos saved.' : `${filledCount}/${REQUIRED_SLOTS.length} required photos saved.`}
      </p>
    </div>
  );
}
