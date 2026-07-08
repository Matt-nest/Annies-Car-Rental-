import type { WizardDraft } from '../components/booking/confirm-booking/constants';

export interface ReceiptLineItem {
  label: string;
  amount: number;
}

export interface CustomerReceiptSnapshot {
  captured_at: string;
  booking_code?: string;
  vehicle: string | null;
  pickup_date: string;
  return_date: string;
  pickup_time?: string;
  return_time?: string;
  rental_days: number;
  delivery_type?: string;
  delivery_address?: string;
  line_items: ReceiptLineItem[];
  rental_total: number;
  insurance: {
    choice: 'bonzah' | 'own' | null;
    label: string;
    amount: number;
    tier_id?: string | null;
  };
  deposit: {
    amount: number;
    label: string;
    note: string;
  };
  grand_total: number;
  currency: 'USD';
}

/** Build the exact itemized receipt the customer sees on the Review step. */
export function buildCustomerReceiptSnapshot(
  bookingSummary: any,
  draft: WizardDraft,
  depositAmount: number,
  extras?: { pickupTime?: string; returnTime?: string; deliveryType?: string; deliveryAddress?: string },
): CustomerReceiptSnapshot {
  const rentalDays = bookingSummary?.rentalDays || 1;
  const rentalTotal = Number(bookingSummary?.totalCost || 0);

  const line_items: ReceiptLineItem[] = [];
  if (bookingSummary?.lineItems?.length > 0) {
    for (const item of bookingSummary.lineItems) {
      line_items.push({ label: item.label, amount: Number(item.amount) });
    }
  } else {
    line_items.push({
      label: `Rental (${rentalDays} day${rentalDays !== 1 ? 's' : ''} × $${Number(bookingSummary?.dailyRate || 0).toFixed(2)}/day)`,
      amount: Number(bookingSummary?.subtotal || 0),
    });
    if (Number(bookingSummary?.deliveryFee || 0) > 0) {
      line_items.push({ label: 'Delivery fee', amount: Number(bookingSummary.deliveryFee) });
    }
    if (Number(bookingSummary?.discountAmount || 0) > 0) {
      line_items.push({ label: 'Discount', amount: -Number(bookingSummary.discountAmount) });
    }
    if (Number(bookingSummary?.mileageAddonFee || 0) > 0) {
      line_items.push({ label: 'Unlimited Miles', amount: Number(bookingSummary.mileageAddonFee) });
    }
    if (Number(bookingSummary?.tollAddonFee || 0) > 0) {
      line_items.push({ label: 'Unlimited Tolls', amount: Number(bookingSummary.tollAddonFee) });
    }
    if (Number(bookingSummary?.taxAmount || 0) > 0) {
      line_items.push({ label: 'Tax', amount: Number(bookingSummary.taxAmount) });
    }
  }

  let insuranceCost = 0;
  let insuranceLabel = 'No coverage selected';
  let tierId: string | null = null;
  if (draft.insuranceChoice === 'bonzah' && draft.bonzahQuote) {
    insuranceCost = draft.bonzahQuote.total_cents / 100;
    const tierLabel = draft.bonzahTierId
      ? draft.bonzahTierId.charAt(0).toUpperCase() + draft.bonzahTierId.slice(1)
      : 'Bonzah';
    insuranceLabel = `Bonzah Insurance: ${tierLabel} (${rentalDays} day${rentalDays === 1 ? '' : 's'})`;
    tierId = draft.bonzahTierId;
  } else if (draft.insuranceChoice === 'own') {
    insuranceLabel = 'Your own insurance (no charge)';
  }

  const grandTotal = rentalTotal + insuranceCost + depositAmount;

  return {
    captured_at: new Date().toISOString(),
    booking_code: bookingSummary?.bookingCode,
    vehicle: bookingSummary?.vehicle || null,
    pickup_date: bookingSummary?.pickupDate,
    return_date: bookingSummary?.returnDate,
    pickup_time: extras?.pickupTime,
    return_time: extras?.returnTime,
    rental_days: rentalDays,
    delivery_type: extras?.deliveryType || bookingSummary?.deliveryType,
    delivery_address: extras?.deliveryAddress || bookingSummary?.deliveryAddress,
    line_items,
    rental_total: rentalTotal,
    insurance: {
      choice: draft.insuranceChoice,
      label: insuranceLabel,
      amount: insuranceCost,
      tier_id: tierId,
    },
    deposit: {
      amount: depositAmount,
      label: 'Refundable Deposit',
      note: 'Fully refunded after post-return vehicle inspection (typically 3–5 business days)',
    },
    grand_total: grandTotal,
    currency: 'USD',
  };
}
