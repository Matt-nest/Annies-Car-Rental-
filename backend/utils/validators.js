export function validateBookingPayload(body) {
  const errors = [];
  const required = [
    'first_name', 'last_name', 'email', 'phone',
    'vehicle_code', 'pickup_date', 'return_date',
    'pickup_time', 'return_time', 'pickup_location',
  ];

  for (const field of required) {
    if (!body[field]) errors.push(`${field} is required`);
  }

  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    errors.push('email is invalid');
  }

  if (body.pickup_date && body.return_date) {
    const pickup = new Date(body.pickup_date);
    const ret = new Date(body.return_date);
    if (isNaN(pickup) || isNaN(ret)) {
      errors.push('pickup_date and return_date must be valid dates');
    } else if (ret <= pickup) {
      errors.push('return_date must be after pickup_date');
    } else if (pickup < new Date(new Date().toDateString())) {
      errors.push('pickup_date cannot be in the past');
    }
  }

  return errors;
}

export function validatePaymentPayload(body) {
  const errors = [];
  if (!body.payment_type) errors.push('payment_type is required');
  if (!body.amount || isNaN(Number(body.amount)) || Number(body.amount) <= 0) {
    errors.push('amount must be a positive number');
  }
  return errors;
}

export function validateDamageReportPayload(body) {
  const errors = [];
  if (!body.description) errors.push('description is required');
  if (!['minor', 'moderate', 'major'].includes(body.severity)) {
    errors.push('severity must be minor, moderate, or major');
  }
  return errors;
}
