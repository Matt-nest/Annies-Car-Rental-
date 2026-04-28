import { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../../context/ThemeContext';
import { EASE, DURATION } from '../../utils/motion';

interface GalleryProps {
  images: string[];
  alt: string;
}

export default function Gallery({ images, alt }: GalleryProps) {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const next = () => setCurrentIndex((prev) => (prev + 1) % images.length);
  const prev = () => setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);

  return (
    <>
      {/* Gallery Grid — adaptive: renders only existing images */}
      {images.length > 0 && (
        <section className="relative w-full overflow-hidden">
          {images.length === 1 ? (
            <div className="p-2 md:p-4 h-[40vh] md:h-[65vh]">
              <div
                className="w-full h-full relative rounded-2xl md:rounded-3xl overflow-hidden group cursor-pointer"
                style={{ backgroundColor: theme === 'dark' ? '#0a0a0a' : '#f0f0f0' }}
                onClick={() => { setCurrentIndex(0); setIsOpen(true); }}
              >
                <div className="absolute inset-0 img-shimmer" />
                <img
                  src={images[0]}
                  alt={alt}
                  className="relative w-full h-full object-contain transition-transform duration-700 group-hover:scale-105"
                  style={{ filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))' }}
                  fetchPriority="high"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-40 pointer-events-none" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500 pointer-events-none" />
              </div>
            </div>
          ) : images.length === 2 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-2 md:p-4 h-[40vh] md:h-[65vh]">
              {images.map((img, i) => (
                <div
                  key={i}
                  className={`${i === 1 ? 'hidden md:block' : ''} relative rounded-2xl md:rounded-3xl overflow-hidden group cursor-pointer`}
                  style={{ backgroundColor: theme === 'dark' ? '#0a0a0a' : '#f0f0f0' }}
                  onClick={() => { setCurrentIndex(i); setIsOpen(true); }}
                >
                  <div className="absolute inset-0 img-shimmer" />
                  <img
                    src={img}
                    alt={`${alt}${i === 0 ? '' : ` view ${i + 1}`}`}
                    className="relative w-full h-full object-contain transition-transform duration-700 group-hover:scale-105"
                    style={{ filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))' }}
                    fetchPriority={i === 0 ? 'high' : 'auto'}
                    loading={i === 0 ? undefined : 'lazy'}
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500 pointer-events-none" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 grid-rows-2 gap-2 p-2 md:p-4 h-[40vh] md:h-[65vh]">
              <div
                className="col-span-4 md:col-span-3 row-span-2 relative rounded-2xl md:rounded-3xl overflow-hidden group cursor-pointer"
                style={{ backgroundColor: theme === 'dark' ? '#0a0a0a' : '#f0f0f0' }}
                onClick={() => { setCurrentIndex(0); setIsOpen(true); }}
              >
                <div className="absolute inset-0 img-shimmer" />
                <img
                  src={images[0]}
                  alt={alt}
                  className="relative w-full h-full object-contain transition-transform duration-700 group-hover:scale-105"
                  style={{ filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))' }}
                  fetchPriority="high"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-40 pointer-events-none" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500 pointer-events-none" />
              </div>
              {images.slice(1, 3).map((img, i) => (
                <div
                  key={i}
                  className="hidden md:block rounded-3xl overflow-hidden relative cursor-pointer group"
                  style={{ backgroundColor: theme === 'dark' ? '#0a0a0a' : '#f0f0f0' }}
                  onClick={() => { setCurrentIndex(i + 1); setIsOpen(true); }}
                >
                  <div className="absolute inset-0 img-shimmer" />
                  <img
                    src={img}
                    alt={`${alt} view ${i + 2}`}
                    className="relative w-full h-full object-contain transition-transform duration-500 group-hover:scale-110"
                    style={{ filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.25))' }}
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500" />
                  {i === 1 && images.length > 3 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 hover:bg-black/30 transition-colors duration-500">
                      <span className="text-white font-medium text-sm">+{images.length - 3} Photos</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {/* Mobile view all button — only show if there's more than one image */}
          {images.length > 1 && (
            <button
              onClick={() => { setCurrentIndex(0); setIsOpen(true); }}
              className="md:hidden absolute bottom-6 right-6 px-4 py-2 rounded-full bg-black/80 border border-white/10 text-white text-sm font-medium"
            >
              View All Photos
            </button>
          )}
        </section>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE.smooth }}
            className="fixed inset-0 z-[200] bg-black flex flex-col"
          >
            {/* Header */}
            <div className="p-4 md:p-6 flex items-center justify-between text-white">
              <span className="text-sm font-medium tracking-widest uppercase opacity-60">
                {currentIndex + 1} / {images.length}
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all duration-300 hover:scale-110"
              >
                <X size={22} />
              </button>
            </div>

            {/* Image */}
            <div className="flex-1 relative flex items-center justify-center p-4 md:p-12">
              <button
                onClick={prev}
                className="absolute left-2 md:left-12 p-3 md:p-4 bg-white/10 hover:bg-white/20 rounded-full transition-all duration-300 text-white z-10 hover:scale-110"
              >
                <ChevronLeft size={22} />
              </button>

              <motion.img
                key={currentIndex}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: EASE.standard }}
                src={images[currentIndex]}
                alt={`${alt} ${currentIndex + 1}`}
                className="max-w-full max-h-full object-contain rounded-2xl"
                style={{ filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.4))' }}
              />

              <button
                onClick={next}
                className="absolute right-2 md:right-12 p-3 md:p-4 bg-white/10 hover:bg-white/20 rounded-full transition-all duration-300 text-white z-10 hover:scale-110"
              >
                <ChevronRight size={22} />
              </button>
            </div>

            {/* Thumbnails */}
            <div className="p-4 md:p-6 flex justify-center gap-2 overflow-x-auto no-scrollbar">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`relative w-14 h-14 md:w-16 md:h-16 rounded-xl overflow-hidden flex-shrink-0 transition-all duration-300 ${
                    i === currentIndex ? 'ring-2 ring-white scale-110' : 'opacity-40 hover:opacity-80'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-contain" style={{ backgroundColor: '#111' }} loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
