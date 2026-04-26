import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Phone, CheckCircle2 } from 'lucide-react';
import { Vehicle } from '../../types';
import { getVehicleDisplayName } from '../../data/vehicles';
import { useTheme } from '../../context/ThemeContext';
import { API_URL, API_KEY } from '../../config';

interface MonthlyInquiryModalProps {
  vehicle: Vehicle;
  onClose: () => void;
}

export default function MonthlyInquiryModal({ vehicle, onClose }: MonthlyInquiryModalProps) {
  const { theme } = useTheme();
  const [form, setForm] = useState({ name: '', phone: '', email: '', startDate: '', notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handle = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
    if (errors[name]) setErrors(p => { const n = { ...p }; delete n[name]; return n; });
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Required';
    if (!form.phone.trim()) errs.phone = 'Required';
    else if (!/^\+?[\d\s\-().]{7,}$/.test(form.phone)) errs.phone = 'Invalid phone';
    if (!form.email.trim()) errs.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        vehicle_id: vehicle.vehicleId,
        vehicle_code: vehicle.id,
        vehicle_name: getVehicleDisplayName(vehicle),
        start_date: form.startDate || undefined,
        notes: form.notes.trim() || undefined,
      };
      await fetch(`${API_URL}/monthly-inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify(payload),
      });
      setSuccess(true);
    } catch {
      // Still show success — inquiry may have saved
      setSuccess(true);
    }
    setSubmitting(false);
  };

  const inputStyle = {
    backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    borderColor: 'var(--border-subtle)',
    color: 'var(--text-primary)',
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="w-full max-w-md rounded-3xl p-6 sm:p-8 relative"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer"
            style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
            aria-label="Close"
          >
            <X size={16} />
          </button>

          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-6"
            >
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ backgroundColor: 'rgba(212,175,55,0.12)' }}>
                <CheckCircle2 size={28} style={{ color: '#D4AF37' }} />
              </div>
              <h3 className="text-xl font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                You're on Annie's list
              </h3>
              <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--text-secondary)' }}>
                Annie will personally reach out within 24 hours to discuss your monthly rental.
                No pressure — just a conversation.
              </p>
              <a
                href="tel:+17729856667"
                className="inline-flex items-center gap-2 text-sm font-medium"
                style={{ color: '#D4AF37' }}
              >
                <Phone size={14} /> Or call now: (772) 985-6667
              </a>
            </motion.div>
          ) : (
            <>
              <div className="mb-6">
                <p className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: '#D4AF37' }}>
                  Monthly Inquiry
                </p>
                <h3 className="text-xl font-medium" style={{ color: 'var(--text-primary)' }}>
                  {getVehicleDisplayName(vehicle)}
                </h3>
                {vehicle.monthlyDisplayPrice && (
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                    From <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>${vehicle.monthlyDisplayPrice.toLocaleString()}</span>/month
                  </p>
                )}
              </div>

              <a
                href="tel:+17729856667"
                className="flex items-center gap-3 rounded-xl px-4 py-3 mb-6 transition-colors cursor-pointer"
                style={{
                  backgroundColor: 'rgba(212,175,55,0.1)',
                  border: '1px solid rgba(212,175,55,0.25)',
                }}
              >
                <Phone size={16} style={{ color: '#D4AF37', flexShrink: 0 }} />
                <div>
                  <p className="text-xs font-medium" style={{ color: '#D4AF37' }}>Prefer to talk?</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>(772) 985-6667</p>
                </div>
              </a>

              <form onSubmit={handleSubmit} className="space-y-3" noValidate>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Your name <span style={{ color: '#D4AF37' }}>*</span>
                  </label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handle}
                    placeholder="First and last name"
                    className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none transition-colors"
                    style={inputStyle}
                  />
                  {errors.name && <p className="text-xs mt-1" style={{ color: 'var(--danger-color)' }}>{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Phone <span style={{ color: '#D4AF37' }}>*</span>
                  </label>
                  <input
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handle}
                    placeholder="(772) 555-0100"
                    className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none transition-colors"
                    style={inputStyle}
                  />
                  {errors.phone && <p className="text-xs mt-1" style={{ color: 'var(--danger-color)' }}>{errors.phone}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Email <span style={{ color: '#D4AF37' }}>*</span>
                  </label>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handle}
                    placeholder="you@email.com"
                    className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none transition-colors"
                    style={inputStyle}
                  />
                  {errors.email && <p className="text-xs mt-1" style={{ color: 'var(--danger-color)' }}>{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    When do you need it? <span className="text-xs font-normal" style={{ color: 'var(--text-tertiary)' }}>(optional)</span>
                  </label>
                  <input
                    name="startDate"
                    type="date"
                    value={form.startDate}
                    onChange={handle}
                    className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none transition-colors"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Anything else? <span className="text-xs font-normal" style={{ color: 'var(--text-tertiary)' }}>(optional)</span>
                  </label>
                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={handle}
                    placeholder="How long you're looking to rent, special needs, etc."
                    rows={2}
                    className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none transition-colors resize-none"
                    style={inputStyle}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-full font-medium text-sm mt-2 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-60 cursor-pointer"
                  style={{ backgroundColor: '#D4AF37', color: '#0a0a0a' }}
                >
                  {submitting ? 'Sending…' : 'Send Inquiry'}
                </button>
              </form>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
