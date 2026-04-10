import React, { useState, useEffect, useMemo } from 'react';
import { Users, Fuel, Gauge, Settings2, CheckCircle2, XCircle, MapPin, ArrowLeft, Phone, Star, ArrowRight, X, DollarSign, Clock, Car } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Vehicle } from '../../types';
import { getVehicleDisplayName } from '../../data/vehicles';
import { getReviewsForVehicle, addReview } from '../../data/reviews';
import Gallery from './Gallery';
import RequestToBookForm from './RequestToBookForm';
import InsuranceExplainer from './InsuranceExplainer';
import { useTheme } from '../../context/ThemeContext';
import { EASE, DURATION, STAGGER } from '../../utils/motion';
import ThemeToggle from '../common/ThemeToggle';
import StarRating from '../common/StarRating';

interface VehicleDetailPageProps {
  vehicle: Vehicle;
  onBack: () => void;
}

export default function VehicleDetailPage({ vehicle, onBack }: VehicleDetailPageProps) {
  const { theme, toggleTheme } = useTheme();
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [showAddReviewModal, setShowAddReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewName, setReviewName] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const resolveReviews = (v: Vehicle) => {
    const byId = getReviewsForVehicle(v.id);
    return byId.length > 0 ? byId : getReviewsForVehicle(v.vin ?? '');
  };

  const [localReviews, setLocalReviews] = useState(() => resolveReviews(vehicle));

  useEffect(() => {
    setLocalReviews(resolveReviews(vehicle));
    setShowAllReviews(false);
  }, [vehicle.id]);

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewName || !reviewComment) return;
    const newReview = {
      id: `r-new-${Date.now()}`,
      vehicleId: vehicle.id,
      reviewerName: reviewName,
      rating: reviewRating,
      comment: reviewComment,
      date: new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date()),
    };
    addReview(newReview);
    setLocalReviews(getReviewsForVehicle(vehicle.id));
    setShowAddReviewModal(false);
    setReviewName('');
    setReviewComment('');
    setReviewRating(5);
  };

  const displayName = getVehicleDisplayName(vehicle);

  const specs = useMemo(() => [
    { label: 'Transmission', value: vehicle.transmission, icon: Settings2 },
    { label: 'Fuel Economy', value: `${vehicle.mpg} MPG`, icon: Gauge },
    { label: 'Capacity', value: `${vehicle.seats} Passengers`, icon: Users },
    { label: 'Fuel Type', value: vehicle.fuel, icon: Fuel },
  ], [vehicle.transmission, vehicle.mpg, vehicle.seats, vehicle.fuel]);

  const rules = useMemo(() => [
    { label: 'No smoking or pets', desc: 'Smoking or transporting animals incurs a cleaning fee up to $250', icon: XCircle },
    { label: 'Fuel policy', desc: 'Return at the same fuel level — refueling charge is $20 per quarter tank', icon: Fuel },
    { label: 'Tolls & violations', desc: 'You\'re responsible for tolls and traffic fines, plus a $50 admin fee per violation', icon: DollarSign },
    { label: 'Late returns', desc: 'Late returns are charged $30/day — please contact us if you need an extension', icon: Clock },
    { label: '200 miles/day included', desc: 'Every rental includes 200 miles per day — additional miles are just $0.34/mile', icon: Car },
    { label: 'Return condition', desc: 'Return the vehicle in the same condition received, aside from normal wear', icon: CheckCircle2 },
  ], []);

  return (
    <div
      className={`min-h-screen ${theme} transition-colors duration-500`}
      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      {/* Sticky Header */}
      <header
        className="fixed top-0 left-0 right-0 z-[90] h-16 md:h-20 flex items-center justify-between px-4 md:px-8 md:backdrop-blur-2xl border-b"
        style={{
          backgroundColor: theme === 'dark' ? 'rgba(10,10,10,0.97)' : 'rgba(250,250,249,0.97)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-medium transition-all duration-300 hover:opacity-70 group"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={18} className="transition-transform duration-300 group-hover:-translate-x-1" />
          <span className="hidden sm:inline">Back to Fleet</span>
        </button>
        <h1 className="text-sm font-medium tracking-tight truncate max-w-[200px] md:max-w-none">{displayName}</h1>
        <div className="flex items-center gap-3">
          <ThemeToggle size={14} />
          <a
            href="tel:+17729856667"
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-[1.03] active:scale-95"
            style={{ border: '1px solid var(--border-medium)', color: 'var(--text-secondary)' }}
          >
            <Phone size={14} />
            <span className="hidden sm:inline">Call Now</span>
          </a>
        </div>
      </header>

      <div className="pt-16 md:pt-20">
        {/* Gallery */}
        <Gallery images={vehicle.images} alt={displayName} />

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 md:px-6 mt-8 md:mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12 pb-32 lg:pb-16">
          {/* Left Column: Details */}
          <div className="lg:col-span-2 space-y-12">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE.standard }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                <span>{vehicle.category}</span>
                <span>·</span>
                <span>{vehicle.year}</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-light tracking-tight">{displayName}</h1>
            </motion.div>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, ease: EASE.standard }}
              className="text-xl leading-relaxed max-w-2xl"
              style={{ color: 'var(--text-secondary)' }}
            >
              {vehicle.description}
            </motion.p>

            {/* Specs Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {specs.map((spec, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * STAGGER.fast, ease: EASE.standard }}
                  className="rounded-2xl border p-5 flex flex-col gap-3 transition-all duration-300 hover:scale-[1.03]"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <spec.icon size={20} style={{ color: 'var(--text-tertiary)' }} />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>{spec.label}</p>
                    <p className="font-medium text-sm">{spec.value}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Features */}
            <section className="space-y-6">
              <h2 className="text-2xl font-medium">Vehicle Features</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {vehicle.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-3" style={{ color: 'var(--text-secondary)' }}>
                    <CheckCircle2 size={16} className="shrink-0" style={{ color: 'var(--text-primary)' }} />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* What's Included */}
            <section className="space-y-6">
              <h2 className="text-2xl font-medium">Included With Your Rental</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vehicle.included.map((item, i) => (
                  <div key={i} className="flex items-start gap-3" style={{ color: 'var(--text-secondary)' }}>
                    <div
                      className="mt-0.5 p-1 rounded-md shrink-0"
                      style={{ backgroundColor: 'var(--bg-card-hover)' }}
                    >
                      <CheckCircle2 size={14} style={{ color: 'var(--text-primary)' }} />
                    </div>
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Mobile-only: Price, Form, Insurance — appears between Included and Reviews */}
            <div className="lg:hidden space-y-6">
              <RequestToBookForm vehicle={vehicle} />
              <InsuranceExplainer />
            </div>

            {/* Reviews — unified star visualization */}
            <section className="space-y-8 pt-8" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              {localReviews.length > 0 ? (
                <>
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <h2 className="text-3xl font-bold tracking-tight">Ratings & Reviews</h2>
                  <div className="text-left md:text-right">
                    <div className="flex flex-col items-start md:items-end gap-1">
                      <span className="text-4xl font-bold tracking-tight leading-none mb-1 text-right w-full">4.98</span>
                      <div className="flex gap-1 justify-end w-full">
                      <StarRating rating={5} size={16} />
                      </div>
                      <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Based on 156 trips</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 pt-4 pb-8" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {[
                    { label: 'Cleanliness', score: 5 },
                    { label: 'Communication', score: 5 },
                    { label: 'Accuracy', score: 5 },
                    { label: 'Maintenance', score: 4.9 },
                    { label: 'Convenience', score: 5 },
                  ].map((cat) => (
                    <div key={cat.label} className="flex items-center justify-between gap-4">
                      <span className="text-sm font-medium min-w-[120px]" style={{ color: 'var(--text-secondary)' }}>
                        {cat.label}
                      </span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-subtle)' }}>
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${(cat.score / 5) * 100}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.8, ease: EASE.dramatic }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: 'var(--text-primary)' }}
                        />
                      </div>
                      <span className="text-sm font-medium w-6 text-right" style={{ color: 'var(--text-primary)' }}>
                        {cat.score}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="space-y-10">
                  {(showAllReviews ? localReviews : localReviews.slice(0, 2)).map((review) => (
                    <motion.div
                      key={review.id}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ ease: EASE.standard }}
                      className="space-y-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          {review.avatar ? (
                            <img src={review.avatar} alt={review.reviewerName} className="w-12 h-12 rounded-full object-cover" referrerPolicy="no-referrer" loading="lazy" decoding="async" />
                          ) : (
                            <div
                              className="w-12 h-12 rounded-full flex items-center justify-center text-[15px] font-semibold"
                              style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-primary)' }}
                            >
                              {review.reviewerName.charAt(0)}
                            </div>
                          )}
                          <div>
                            <span className="font-semibold text-base block">{review.reviewerName}</span>
                            <span className="text-sm block mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{review.date || 'March 2024'}</span>
                          </div>
                        </div>
                        <div className="flex gap-0.5 mt-2">
                        <StarRating rating={review.rating} size={14} />
                        </div>
                      </div>
                      <p className="text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {review.comment}
                      </p>
                    </motion.div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                  {localReviews.length > 2 && (
                    <button
                      onClick={() => setShowAllReviews(!showAllReviews)}
                      className="flex items-center gap-2 text-[15px] font-medium transition-all group hover:opacity-70"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {showAllReviews ? 'Show fewer reviews' : 'Show more reviews'}
                      <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
                    </button>
                  )}
                  <button
                    onClick={() => setShowAddReviewModal(true)}
                    className="px-6 py-2.5 rounded-full text-sm font-medium transition-all hover:scale-[1.03] active:scale-95 border"
                    style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                  >
                    Add a review
                  </button>
                </div>
                </>
              ) : (
                <div 
                  className="rounded-2xl border p-12 text-center flex flex-col items-center justify-center space-y-4"
                  style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
                >
                  <Star size={42} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }} />
                  <div>
                    <h3 className="text-xl font-medium mb-1">No reviews yet</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>Be the first to review this {displayName}</p>
                  </div>
                  <button
                    onClick={() => setShowAddReviewModal(true)}
                    className="mt-2 px-8 py-3 rounded-full text-sm font-medium transition-all hover:scale-[1.03] active:scale-95 border"
                    style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                  >
                    Write a review
                  </button>
                </div>
              )}
            </section>

            {/* Add Review Modal */}
            <AnimatePresence>
              {showAddReviewModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowAddReviewModal(false)}
                    className="absolute inset-0 bg-black/60"
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-md rounded-3xl p-6 md:p-8"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                    }}
                  >
                    <button
                      onClick={() => setShowAddReviewModal(false)}
                      className="absolute top-4 right-4 p-2 rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                    >
                      <X size={20} />
                    </button>
                    
                    <h3 className="text-2xl font-semibold mb-6">Write a review</h3>
                    <form onSubmit={handleReviewSubmit} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Rating</label>
                        <div className="flex gap-1 mb-2">
                           {[1, 2, 3, 4, 5].map((i) => (
                             <Star
                               key={`add-rate-${i}`}
                               size={24}
                               className="cursor-pointer transition-colors"
                               onClick={() => setReviewRating(i)}
                               fill={i <= reviewRating ? 'var(--accent-color)' : 'none'}
                               stroke={i <= reviewRating ? 'var(--accent-color)' : 'var(--text-tertiary)'}
                             />
                           ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Name</label>
                        <input
                          type="text"
                          required
                          value={reviewName}
                          onChange={(e) => setReviewName(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl outline-none focus:ring-2 mb-2"
                          style={{
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            '--tw-ring-color': 'var(--accent-color)'
                          } as React.CSSProperties}
                          placeholder="Your name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Your review</label>
                        <textarea
                          required
                          rows={4}
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl resize-none outline-none focus:ring-2"
                          style={{
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            '--tw-ring-color': 'var(--accent-color)'
                          } as React.CSSProperties}
                          placeholder="Share your experience..."
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-3.5 mt-2 rounded-xl font-medium transition-all hover:opacity-90 active:scale-[0.98]"
                        style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg-primary)' }}
                      >
                        Submit Review
                      </button>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Rates & Policies */}
            <section className="space-y-6 pt-8" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <div>
                <h2 className="text-2xl font-medium">Rates & Policies</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>Transparent pricing, no surprises. Incidentals are only charged if applicable.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rules.map((rule, i) => (
                  <div key={i} className="flex gap-4">
                    <rule.icon size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                    <div>
                      <h4 className="font-medium text-sm mb-1">{rule.label}</h4>
                      <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{rule.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right Column: Sticky Request Card — desktop only */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              <RequestToBookForm vehicle={vehicle} />
              <InsuranceExplainer />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
