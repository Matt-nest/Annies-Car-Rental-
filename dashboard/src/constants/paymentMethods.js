export const PAYMENT_METHOD_OPTIONS = [
  { value: 'stripe', label: 'Stripe/Card' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'cash', label: 'Cash' },
  { value: 'cashapp', label: 'Cashapp' }
];

export function paymentMethodLabel(value) {
  const option = PAYMENT_METHOD_OPTIONS.find((method) => method.value === value);
  return option?.label || value;
}
