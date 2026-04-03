import { memo } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  size?: number;
  maxStars?: number;
  className?: string;
}

/**
 * Reusable star rating display component.
 * Extracted from VehicleDetailPage, Hero, ReviewsSection, and QuickViewModal
 * where the same pattern was duplicated 4+ times.
 */
const StarRating = memo(function StarRating({
  rating,
  size = 14,
  maxStars = 5,
  className = '',
}: StarRatingProps) {
  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {Array.from({ length: maxStars }, (_, i) => (
        <Star
          key={i}
          size={size}
          fill={i < rating ? 'var(--accent-color)' : 'none'}
          stroke={i < rating ? 'var(--accent-color)' : 'var(--text-tertiary)'}
        />
      ))}
    </div>
  );
});

export default StarRating;
