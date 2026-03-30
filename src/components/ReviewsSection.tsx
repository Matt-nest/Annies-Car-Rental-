import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useTheme } from '../App';
import { TOTAL_REVIEW_COUNT, REVIEWS } from '../data/reviews';
import { EASE } from '../utils/motion';

// Aggregate category scores (Turo-style)
const CATEGORY_SCORES = [
  { label: 'Cleanliness', score: 4.9 },
  { label: 'Maintenance', score: 4.8 },
  { label: 'Communication', score: 5.0 },
  { label: 'Convenience', score: 5.0 },
  { label: 'Accuracy', score: 5.0 },
];

const OVERALL_RATING = 4.88;
const TOTAL_RATINGS = REVIEWS.length;

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          fill={i <= rating ? 'var(--accent-color)' : 'none'}
          stroke={i <= rating ? 'var(--accent-color)' : 'var(--text-tertiary)'}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

// Cap to 50 reviews for performance (100 DOM nodes with duplication)
// This is more than enough cards to fill any viewport before the seamless loop resets
const CAROUSEL_CAP = 50;

export default function ReviewsSection() {
  const { theme } = useTheme();

  const sliderRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const scrollSpeedRef = useRef(0.6);
  const rafRef = useRef<number>();

  // Pause carousel when section is offscreen (saves mobile CPU)
  const sectionRef = useRef<HTMLElement>(null);
  const isVisibleRef = useRef(true);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { isVisibleRef.current = entry.isIntersecting; },
      { threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Smooth continuous auto-scroll using requestAnimationFrame
  useEffect(() => {
    const slider = sliderRef.current;
    if (!slider) return;

    let lastTime = 0;

    const tick = (time: number) => {
      if (!slider) return;
      
      if (lastTime && isVisibleRef.current) {
        const delta = time - lastTime;
        const normalizedSpeed = scrollSpeedRef.current * (delta / 16.67);
        
        if (!isPaused) {
          slider.scrollLeft += normalizedSpeed;

          const halfWidth = slider.scrollWidth / 2;
          if (slider.scrollLeft >= halfWidth) {
            slider.scrollLeft -= halfWidth;
          }
        }
      }
      lastTime = time;
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPaused]);

  const scrollLeftManual = useCallback(() => {
    if (sliderRef.current) sliderRef.current.scrollBy({ left: -400, behavior: 'smooth' });
  }, []);

  const scrollRightManual = useCallback(() => {
    if (sliderRef.current) sliderRef.current.scrollBy({ left: 400, behavior: 'smooth' });
  }, []);

  // Shuffle and cap reviews, memoized to prevent re-shuffle on re-render
  const carouselReviews = useMemo(() => {
    const shuffled = [...REVIEWS].sort(() => Math.random() - 0.5).slice(0, CAROUSEL_CAP);
    return [...shuffled, ...shuffled]; // duplicate for seamless loop
  }, []);

  // Duplicate reviews for seamless infinite scrolling
  const displayReviews = carouselReviews;

  return (
    <section ref={sectionRef} className="py-16 sm:py-24 px-4 sm:px-6 overflow-hidden" id="reviews">
      <div className="max-w-5xl mx-auto">
        {/* Section Header */}
        <div className="mb-10 sm:mb-14 text-center">
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-[11px] uppercase tracking-[0.3em] font-medium mb-4 block"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Renter Feedback
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ ease: EASE.standard }}
            className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight mb-4"
          >
            Ratings <span className="italic font-serif">&</span> Reviews
          </motion.h2>
        </div>

        {/* Rating Summary Card — Turo-style */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ ease: EASE.standard }}
          className="rounded-2xl sm:rounded-3xl border p-5 sm:p-8 md:p-10 mb-8 sm:mb-10"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 sm:gap-10 items-start">
            {/* Left: Overall score */}
            <div className="text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                <span className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  {OVERALL_RATING}
                </span>
                <Star size={28} fill="var(--accent-color)" stroke="var(--accent-color)" />
              </div>
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                ({TOTAL_RATINGS} ratings)
              </p>
              <StarRating rating={5} size={18} />
            </div>

            {/* Right: Category bars */}
            <div className="space-y-4">
              {CATEGORY_SCORES.map((cat) => (
                <div key={cat.label} className="flex items-center gap-4">
                  <span className="text-sm font-medium w-32 shrink-0" style={{ color: 'var(--text-primary)' }}>
                    {cat.label}
                  </span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-subtle)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${(cat.score / 5) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: 0.2, ease: EASE.dramatic }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: 'var(--accent-color)' }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right" style={{ color: 'var(--text-secondary)' }}>
                    {cat.score.toFixed(1)}
                  </span>
                </div>
              ))}
              <p className="text-xs pt-2" style={{ color: 'var(--text-tertiary)' }}>
                Based on {TOTAL_RATINGS} guest ratings
              </p>
            </div>
          </div>
        </motion.div>

      </div>
      
      {/* Horizontal Bleed Reviews Slider — ALL reviews, infinite auto-scroll */}
      <div className="mt-8 md:mt-16 w-full">
        <div className="flex items-center justify-between mb-8 max-w-5xl mx-auto px-2">
          <h3 className="text-xs uppercase tracking-[0.2em] font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {REVIEWS.length} Reviews
          </h3>
          <div className="flex items-center gap-3">
            <button 
              onClick={scrollLeftManual}
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              className="w-10 h-10 rounded-full flex items-center justify-center border transition-all hover:scale-105 active:scale-95"
              style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-card)' }}
            >
              <ChevronLeft size={18} style={{ color: 'var(--text-primary)' }} />
            </button>
            <button 
              onClick={scrollRightManual}
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              className="w-10 h-10 rounded-full flex items-center justify-center border transition-all hover:scale-105 active:scale-95"
              style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-card)' }}
            >
              <ChevronRight size={18} style={{ color: 'var(--text-primary)' }} />
            </button>
          </div>
        </div>

        <div 
          ref={sliderRef}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
          className="flex gap-4 md:gap-5 overflow-x-auto no-scrollbar pb-6 px-6 md:px-[calc(50vw-512px)] w-full"
          style={{ scrollBehavior: 'auto' }}
        >
          {displayReviews.map((review, idx) => (
            <div 
              key={`${review.id}-${idx}`}
              className="snap-start shrink-0 w-[280px] md:w-[340px] rounded-2xl p-5 md:p-6 border flex flex-col justify-between"
              style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="space-y-3">
                <div className="flex items-center gap-3 mb-1">
                  {review.avatar ? (
                    <img src={review.avatar} alt={review.reviewerName} className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-semibold"
                      style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-primary)' }}
                    >
                      {review.reviewerName.charAt(0)}
                    </div>
                  )}
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-sm">{review.reviewerName}</span>
                    <StarRating rating={review.rating} size={11} />
                  </div>
                </div>
                <p className="text-[13px] leading-relaxed line-clamp-4" style={{ color: 'var(--text-secondary)' }}>
                  {review.comment}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
