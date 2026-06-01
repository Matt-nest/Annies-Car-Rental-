import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { DollarSign, Loader2, AlertCircle } from 'lucide-react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { API_URL } from './constants';
import BookingSummaryCard from './BookingSummaryCard';

interface StripeCheckoutFormProps {
  bookingSummary: any;
  onSuccess: () => void;
  theme: string;
}

/**
 * Stripe payment form with PaymentElement.
 * Must be rendered inside <Elements> provider.
 */
export default function StripeCheckoutForm({
  bookingSummary,
  onSuccess,
  theme,
}: StripeCheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setPaying(true);
    setPayError('');

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href, // fallback only; we handle inline
      },
      redirect: 'if_required',
    });

    if (error) {
      setPayError(error.message || 'Payment failed. Please try again.');
      setPaying(false);
    } else {
      // Payment succeeded — tell the backend to record it
      try {
        await fetch(`${API_URL}/stripe/confirm-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_intent_id: paymentIntent?.id }),
        });
      } catch {
        // Non-critical: webhook will catch it in production
        console.warn('Could not confirm payment with backend');
      }
      // Fire the receipt dispatch on a separate, idempotent endpoint with
      // small retries. The backend dedupes via PI metadata, so multiple
      // triggers (webhook, confirm-payment, this) yield at most one email.
      if (paymentIntent?.id) {
        triggerReceiptWithRetry(paymentIntent.id).catch(() => {
          // Receipt failures must never block the success UX.
        });
      }
      onSuccess();
    }
  };

  async function triggerReceiptWithRetry(piId: string, attempt = 0): Promise<void> {
    try {
      const res = await fetch(`${API_URL}/stripe/send-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_intent_id: piId }),
      });
      if (res.ok) return;
      throw new Error(`Receipt dispatch returned ${res.status}`);
    } catch (err) {
      if (attempt >= 2) {
        console.warn('Receipt dispatch failed after retries:', err);
        return;
      }
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
      return triggerReceiptWithRetry(piId, attempt + 1);
    }
  }

  const total = bookingSummary?.totalCost || 0;

  return (
    <form onSubmit={handlePay}>
      {/* Booking summary */}
      <BookingSummaryCard bookingSummary={bookingSummary} theme={theme} />

      {/* Stripe Payment Element */}
      <div className="mb-6">
        <PaymentElement
          options={{
            layout: 'tabs',
          }}
        />
      </div>

      {/* Error */}
      <AnimatePresence>
        {payError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div
              className="flex items-start gap-3 p-4 rounded-xl border text-sm"
              style={{
                backgroundColor: 'rgba(239,68,68,0.08)',
                borderColor: 'rgba(239,68,68,0.25)',
                color: '#ef4444',
              }}
            >
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{payError}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pay button */}
      <button
        type="submit"
        disabled={!stripe || paying}
        className={`group w-full py-4 rounded-full font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
          paying
            ? 'opacity-60 cursor-not-allowed'
            : 'hover:scale-[1.02] hover:-translate-y-px active:scale-95 hover:shadow-lg cursor-pointer'
        }`}
        style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
      >
        {paying ? (
          <>
            <Loader2 className="animate-spin" size={18} />
            Processing…
          </>
        ) : (
          <>
            <DollarSign size={18} />
            Pay ${total.toFixed(2)}
          </>
        )}
      </button>
    </form>
  );
}
