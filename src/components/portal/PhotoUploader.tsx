import React, { useState, useRef } from 'react';
import { Camera, X, Loader2, ImagePlus, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { API_URL } from '../../config';

interface PhotoUploaderProps {
  token: string;
  onPhotosChange: (urls: string[]) => void;
  maxPhotos?: number;
  label?: string;
  hint?: string;
}

export default function PhotoUploader({
  token,
  onPhotosChange,
  maxPhotos = 10,
  label = 'Upload Photos',
  hint = 'Take or upload photos of the vehicle condition',
}: PhotoUploaderProps) {
  const [photos, setPhotos] = useState<{ url: string; path: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const remaining = maxPhotos - photos.length;
    if (remaining <= 0) {
      setUploadError(`Maximum ${maxPhotos} photos allowed`);
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remaining);
    setUploading(true);
    setUploadError('');

    try {
      const formData = new FormData();
      filesToUpload.forEach(f => formData.append('photos', f));

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
      const newPhotos = data.photos.map((p: any) => ({ url: p.url, path: p.path }));
      const updated = [...photos, ...newPhotos];
      setPhotos(updated);
      onPhotosChange(updated.map(p => p.url));
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload photos');
    }

    setUploading(false);
    // Reset the file input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (index: number) => {
    const updated = photos.filter((_, i) => i !== index);
    setPhotos(updated);
    onPhotosChange(updated.map(p => p.url));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
          <Camera size={13} className="inline mr-1.5 -mt-0.5" />
          {label}
        </label>
        <span className="text-xs tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
          {photos.length}/{maxPhotos}
        </span>
      </div>

      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <AnimatePresence>
            {photos.map((photo, i) => (
              <motion.div
                key={photo.path || i}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="relative aspect-square rounded-xl overflow-hidden group"
                style={{ border: '1px solid var(--border-subtle)' }}
              >
                <img
                  src={photo.url}
                  alt={`Photo ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => removePhoto(i)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    color: '#fff',
                  }}
                >
                  <X size={12} />
                </button>
                <div
                  className="absolute bottom-0 left-0 right-0 px-2 py-1 text-[10px] font-medium"
                  style={{ backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff' }}
                >
                  Photo {i + 1}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Upload button */}
      {photos.length < maxPhotos && (
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
          style={{
            backgroundColor: 'var(--bg-card-hover)',
            border: '2px dashed var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
        >
          {uploading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <ImagePlus size={18} />
              {photos.length === 0 ? 'Tap to Add Photos' : 'Add More Photos'}
            </>
          )}
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />

      {/* Hint */}
      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
        {hint}
      </p>

      {/* Error */}
      <AnimatePresence>
        {uploadError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
            style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
          >
            <AlertCircle size={13} />
            {uploadError}
            <button onClick={() => setUploadError('')} className="ml-auto"><X size={12} /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
