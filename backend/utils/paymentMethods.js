const METHOD_ALIASES = new Map([
  ['stripe', 'stripe'],
  ['stripe/card', 'stripe'],
  ['stripe card', 'stripe'],
  ['card', 'stripe'],
  ['credit_card', 'stripe'],
  ['credit card', 'stripe'],
  ['debit_card', 'stripe'],
  ['debit card', 'stripe'],
  ['zelle', 'zelle'],
  ['cash', 'cash'],
  ['cashapp', 'cashapp'],
  ['cash_app', 'cashapp'],
  ['cash app', 'cashapp'],
  ['$cashapp', 'cashapp']
]);

export const DASHBOARD_PAYMENT_METHOD_OPTIONS = [
  { value: 'stripe', label: 'Stripe/Card' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'cash', label: 'Cash' },
  { value: 'cashapp', label: 'Cashapp' }
];

const METHOD_LABELS = new Map([
  ...DASHBOARD_PAYMENT_METHOD_OPTIONS.map((method) => [method.value, method.label]),
  ['square', 'Square/Card']
]);

export function normalizeDashboardPaymentMethod(method = 'cash') {
  const normalized = METHOD_ALIASES.get(String(method || '').trim().toLowerCase());
  if (!normalized) {
    const allowed = DASHBOARD_PAYMENT_METHOD_OPTIONS.map((option) => option.label).join(', ');
    const error = new Error(`Unsupported payment method. Use one of: ${allowed}.`);
    error.status = 400;
    throw error;
  }
  return normalized;
}

export function getPaymentMethodLabel(method = 'cash') {
  const normalized = String(method || '').trim().toLowerCase();
  return METHOD_LABELS.get(normalized) || method;
}
