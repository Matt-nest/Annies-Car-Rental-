import brand from '../config/brand.js';

const isJd = brand.name.toLowerCase().includes('jd coastal');
const codePrefix = isJd ? 'JDSTAGE' : 'ANNSTAGE';
const emailDomain = isJd ? 'jdcoastal.test' : 'annies.test';
const paymentProvider = isJd ? 'stripe' : 'square';

const ids = {
  vehicles: [
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003',
  ],
  customers: [
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000004',
  ],
  bookings: [
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000004',
    '30000000-0000-4000-8000-000000000005',
  ],
};

const vehicles = [
  {
    id: ids.vehicles[0],
    code: `${codePrefix}-SEDAN`,
    make: 'Nissan',
    model: 'Altima',
    year: 2023,
    trim: 'SV',
    color: 'White',
    plate: `${codePrefix.slice(0, 3)}001`,
    vin: isJd ? '1N4BL4DV7PN338432' : '1N4BL4DV4SN333164',
    category: 'sedan',
    daily: 95,
    weekly: 565,
    monthly: 1950,
    deposit: 150,
    notes: 'Staging sedan fixture for booking and pricing QA.',
  },
  {
    id: ids.vehicles[1],
    code: `${codePrefix}-SUV`,
    make: 'Nissan',
    model: 'Rogue',
    year: 2022,
    trim: 'SV',
    color: 'Gray',
    plate: `${codePrefix.slice(0, 3)}002`,
    vin: isJd ? 'JN8AT2MT2KW254745' : '5N1AZ2BJ3MC123044',
    category: 'suv',
    daily: 125,
    weekly: 745,
    monthly: 2450,
    deposit: 200,
    notes: 'Staging SUV fixture for delivery, document, and pickup QA.',
  },
  {
    id: ids.vehicles[2],
    code: `${codePrefix}-PREM`,
    make: isJd ? 'Audi' : 'Volkswagen',
    model: isJd ? 'A3' : 'Passat',
    year: 2021,
    trim: isJd ? 'Premium' : 'R-Line',
    color: 'Black',
    plate: `${codePrefix.slice(0, 3)}003`,
    vin: isJd ? 'WAUB8GFF7G1059702' : '1VWAA7A30JC008356',
    category: isJd ? 'luxury' : 'sedan',
    daily: 145,
    weekly: 865,
    monthly: 2850,
    deposit: 250,
    notes: 'Staging premium fixture for payment and incidentals QA.',
  },
];

const customers = [
  {
    id: ids.customers[0],
    first: 'Pending',
    last: 'Renter',
    email: `pending.renter@${emailDomain}`,
    phone: '+15550001001',
    tags: ['staging', 'pending_docs'],
  },
  {
    id: ids.customers[1],
    first: 'Approved',
    last: 'Paydue',
    email: `approved.paydue@${emailDomain}`,
    phone: '+15550001002',
    tags: ['staging', 'payment_due'],
  },
  {
    id: ids.customers[2],
    first: 'Active',
    last: 'Pickup',
    email: `active.pickup@${emailDomain}`,
    phone: '+15550001003',
    tags: ['staging', 'active_rental'],
  },
  {
    id: ids.customers[3],
    first: 'Completed',
    last: 'Reviewer',
    email: `completed.reviewer@${emailDomain}`,
    phone: '+15550001004',
    tags: ['staging', 'completed_rental'],
  },
];

const bookingFixtures = [
  {
    id: ids.bookings[0],
    code: `${codePrefix}-PENDING`,
    customer: customers[0],
    vehicle: vehicles[0],
    pickup: "CURRENT_DATE + INTERVAL '3 days'",
    dropoff: "CURRENT_DATE + INTERVAL '9 days'",
    status: 'pending_approval',
    depositStatus: 'pending',
    total: 604.65,
    paymentStatus: 'pending',
    source: 'website',
    special: 'Staging pending booking: needs approval and document review.',
  },
  {
    id: ids.bookings[1],
    code: `${codePrefix}-PAYDUE`,
    customer: customers[1],
    vehicle: vehicles[1],
    pickup: "CURRENT_DATE + INTERVAL '10 days'",
    dropoff: "CURRENT_DATE + INTERVAL '16 days'",
    status: 'approved',
    depositStatus: 'pending',
    total: 797.15,
    paymentStatus: 'pending',
    source: 'website',
    special: 'Staging approved booking: customer owes rental/deposit payment.',
  },
  {
    id: ids.bookings[2],
    code: `${codePrefix}-ACTIVE`,
    customer: customers[2],
    vehicle: vehicles[2],
    pickup: "CURRENT_DATE - INTERVAL '2 days'",
    dropoff: "CURRENT_DATE + INTERVAL '5 days'",
    status: 'active',
    depositStatus: 'collected',
    total: 925.55,
    paymentStatus: 'completed',
    source: 'admin',
    special: 'Staging active booking: pickup complete, return pending.',
  },
  {
    id: ids.bookings[3],
    code: `${codePrefix}-RETURN`,
    customer: customers[3],
    vehicle: vehicles[0],
    pickup: "CURRENT_DATE - INTERVAL '16 days'",
    dropoff: "CURRENT_DATE - INTERVAL '9 days'",
    status: 'returned',
    depositStatus: 'collected',
    total: 604.65,
    paymentStatus: 'completed',
    source: 'referral',
    special: 'Staging returned booking: needs inspection and deposit closeout.',
  },
  {
    id: ids.bookings[4],
    code: `${codePrefix}-DONE`,
    customer: customers[3],
    vehicle: vehicles[1],
    pickup: "CURRENT_DATE - INTERVAL '35 days'",
    dropoff: "CURRENT_DATE - INTERVAL '28 days'",
    status: 'completed',
    depositStatus: 'refunded',
    total: 797.15,
    paymentStatus: 'completed',
    source: 'repeat',
    special: 'Staging completed booking: review request and reporting fixture.',
  },
];

function sqlString(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function json(value) {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

function money(value) {
  return Number(value).toFixed(2);
}

function fixedUuid(area, index) {
  return `${area}-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

function rentalDays(booking) {
  if (booking.code.endsWith('PENDING') || booking.code.endsWith('PAYDUE')) return 7;
  if (booking.code.endsWith('ACTIVE')) return 8;
  return 8;
}

function bookingLineItems(booking) {
  return [
    { label: 'Rental subtotal', amount: Number((booking.total / 1.07).toFixed(2)) },
    { label: 'Tax', amount: Number((booking.total - booking.total / 1.07).toFixed(2)) },
  ];
}

function bookingInsert(booking) {
  const days = rentalDays(booking);
  const subtotal = Number((booking.total / 1.07).toFixed(2));
  const tax = Number((booking.total - subtotal).toFixed(2));
  const paymentIntent = booking.paymentStatus === 'completed'
    ? `${paymentProvider}_staging_paid_${booking.code.toLowerCase()}`
    : null;

  return `INSERT INTO bookings (
  id, booking_code, customer_id, vehicle_id, pickup_date, return_date,
  pickup_time, return_time, pickup_location, return_location,
  delivery_requested, daily_rate, rental_days, subtotal, tax_amount,
  total_cost, deposit_amount, deposit_status, insurance_provider,
  insurance_status, status, owner_approved_at, actual_pickup_at,
  actual_return_at, special_requests, internal_notes, source,
  rate_type, weekly_discount_applied, mileage_allowance, line_items,
  stripe_payment_intent_id, delivery_type, customer_receipt_snapshot,
  created_at, updated_at
) VALUES (
  ${sqlString(booking.id)}, ${sqlString(booking.code)}, ${sqlString(booking.customer.id)}, ${sqlString(booking.vehicle.id)},
  (${booking.pickup})::date, (${booking.dropoff})::date,
  '09:00', '09:00', ${sqlString(`${brand.location.city}, ${brand.location.state}`)}, ${sqlString(`${brand.location.city}, ${brand.location.state}`)},
  false, ${money(booking.vehicle.daily)}, ${days}, ${money(subtotal)}, ${money(tax)},
  ${money(booking.total)}, ${money(booking.vehicle.deposit)}, ${sqlString(booking.depositStatus)}, 'own_policy',
  ${booking.status === 'pending_approval' ? sqlString('pending') : sqlString('verified')}, ${sqlString(booking.status)},
  ${booking.status === 'pending_approval' ? 'NULL' : 'now() - interval \'1 day\''},
  ${['active', 'returned', 'completed'].includes(booking.status) ? `(${booking.pickup})::date + TIME '09:10'` : 'NULL'},
  ${['returned', 'completed'].includes(booking.status) ? `(${booking.dropoff})::date + TIME '09:05'` : 'NULL'},
  ${sqlString(booking.special)}, ${sqlString('Generated staging fixture. Safe to delete from staging.')}, ${sqlString(booking.source)},
  'weekly', 15, 'unlimited', ${json(bookingLineItems(booking))},
  ${sqlString(paymentIntent)}, 'pickup', ${json({ booking_code: booking.code, total: booking.total, payment_provider: paymentProvider })},
  now(), now()
) ON CONFLICT (booking_code) DO UPDATE SET
  customer_id = EXCLUDED.customer_id,
  vehicle_id = EXCLUDED.vehicle_id,
  pickup_date = EXCLUDED.pickup_date,
  return_date = EXCLUDED.return_date,
  status = EXCLUDED.status,
  total_cost = EXCLUDED.total_cost,
  deposit_amount = EXCLUDED.deposit_amount,
  deposit_status = EXCLUDED.deposit_status,
  line_items = EXCLUDED.line_items,
  customer_receipt_snapshot = EXCLUDED.customer_receipt_snapshot,
  updated_at = now();`;
}

function output() {
  const lines = [];
  lines.push(`-- ${brand.name} staging seed fixtures`);
  lines.push('-- Generated by backend/scripts/generate_staging_seed_sql.mjs');
  lines.push('-- Apply only to staging or local databases. Do not run against production.');
  lines.push('-- Idempotent: rows use deterministic IDs, emails, vehicle codes, and booking codes.');
  lines.push('');
  lines.push('BEGIN;');
  lines.push('');

  lines.push('-- Vehicles');
  for (const vehicle of vehicles) {
    lines.push(`INSERT INTO vehicles (
  id, vehicle_code, make, model, year, trim, color, license_plate, vin,
  category, daily_rate, weekly_rate, monthly_rate, monthly_display_price,
  deposit_amount, mileage_limit_per_day, overage_rate_per_mile, seats,
  fuel_type, transmission, features, thumbnail_url, photo_urls, status, notes,
  weekly_discount_percent, weekly_unlimited_mileage_enabled, created_at, updated_at
) VALUES (
  ${sqlString(vehicle.id)}, ${sqlString(vehicle.code)}, ${sqlString(vehicle.make)}, ${sqlString(vehicle.model)}, ${vehicle.year},
  ${sqlString(vehicle.trim)}, ${sqlString(vehicle.color)}, ${sqlString(vehicle.plate)}, ${sqlString(vehicle.vin)},
  ${sqlString(vehicle.category)}, ${money(vehicle.daily)}, ${money(vehicle.weekly)}, ${money(vehicle.monthly)}, ${Math.round(vehicle.monthly)},
  ${money(vehicle.deposit)}, 150, 0.34, ${vehicle.category === 'suv' ? 7 : 5},
  'gasoline', 'automatic', ${json(['Bluetooth', 'Backup Camera', 'Apple CarPlay', 'USB Charging'])},
  NULL, '[]'::jsonb, 'available', ${sqlString(vehicle.notes)},
  15, true, now(), now()
) ON CONFLICT (vehicle_code) DO UPDATE SET
  make = EXCLUDED.make,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  trim = EXCLUDED.trim,
  daily_rate = EXCLUDED.daily_rate,
  weekly_rate = EXCLUDED.weekly_rate,
  monthly_rate = EXCLUDED.monthly_rate,
  monthly_display_price = EXCLUDED.monthly_display_price,
  deposit_amount = EXCLUDED.deposit_amount,
  status = EXCLUDED.status,
  notes = EXCLUDED.notes,
  updated_at = now();`);
  }

  lines.push('');
  lines.push('-- Customers');
  for (const customer of customers) {
    lines.push(`INSERT INTO customers (
  id, first_name, last_name, email, phone, date_of_birth,
  driver_license_number, driver_license_state, driver_license_expiry,
  address_line1, city, state, zip, emergency_contact_name,
  emergency_contact_phone, tags, notes, created_at, updated_at
) VALUES (
  ${sqlString(customer.id)}, ${sqlString(customer.first)}, ${sqlString(customer.last)}, ${sqlString(customer.email)}, ${sqlString(customer.phone)},
  '1990-01-15', ${sqlString(`${codePrefix}${customer.first.toUpperCase()}`)}, 'FL', CURRENT_DATE + INTERVAL '2 years',
  '100 Staging Way', ${sqlString(brand.location.city)}, ${sqlString(brand.location.state)}, ${sqlString(brand.location.zip)},
  'Staging Emergency Contact', '+15550009999', ${json(customer.tags)}, 'Generated staging customer fixture.', now(), now()
) ON CONFLICT (email) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone = EXCLUDED.phone,
  driver_license_expiry = EXCLUDED.driver_license_expiry,
  tags = EXCLUDED.tags,
  notes = EXCLUDED.notes,
  updated_at = now();`);
  }

  lines.push('');
  lines.push('-- Bookings');
  for (const booking of bookingFixtures) lines.push(bookingInsert(booking));

  lines.push('');
  lines.push('-- Status log, payments, deposits, documents, operations, notifications');
  for (const [index, booking] of bookingFixtures.entries()) {
    lines.push(`INSERT INTO booking_status_log (id, booking_id, from_status, to_status, changed_by, reason, metadata, created_at)
VALUES (${sqlString(fixedUuid('41000000', index + 1))}, ${sqlString(booking.id)}, NULL, ${sqlString(booking.status)}, 'staging-seed', 'Seeded operational state', ${json({ fixture: true, booking_code: booking.code })}, now())
ON CONFLICT DO NOTHING;`);

    lines.push(`INSERT INTO payments (id, booking_id, payment_type, amount, method, status, reference_id, notes, paid_at, created_at)
VALUES (
  ${sqlString(fixedUuid('42000000', index + 1))}, ${sqlString(booking.id)}, 'rental', ${money(booking.total)}, 'card', ${sqlString(booking.paymentStatus)},
  ${sqlString(`${paymentProvider}_staging_${booking.code.toLowerCase()}`)}, 'Staging payment ledger fixture.',
  ${booking.paymentStatus === 'completed' ? 'now() - interval \'1 day\'' : 'NULL'}, now()
) ON CONFLICT DO NOTHING;`);

    lines.push(`INSERT INTO booking_deposits (id, booking_id, amount, status, stripe_charge_id, refund_amount, applied_amount, refunded_at, refunded_by, created_at, updated_at)
VALUES (
  ${sqlString(fixedUuid('43000000', index + 1))}, ${sqlString(booking.id)}, ${Math.round(booking.vehicle.deposit * 100)}, ${sqlString(booking.depositStatus === 'refunded' ? 'refunded' : booking.depositStatus === 'collected' ? 'held' : 'pending')},
  ${booking.depositStatus === 'pending' ? 'NULL' : sqlString(`${paymentProvider}_deposit_${booking.code.toLowerCase()}`)},
  ${booking.depositStatus === 'refunded' ? Math.round(booking.vehicle.deposit * 100) : 'NULL'}, NULL,
  ${booking.depositStatus === 'refunded' ? 'now() - interval \'27 days\'' : 'NULL'}, ${booking.depositStatus === 'refunded' ? sqlString('staging-seed') : 'NULL'}, now(), now()
) ON CONFLICT (booking_id) DO UPDATE SET
  amount = EXCLUDED.amount,
  status = EXCLUDED.status,
  stripe_charge_id = EXCLUDED.stripe_charge_id,
  refund_amount = EXCLUDED.refund_amount,
  refunded_at = EXCLUDED.refunded_at,
  updated_at = now();`);

    lines.push(`INSERT INTO notification_log (booking_code, stage, event_date, sent_at)
VALUES (${sqlString(booking.code)}, ${sqlString(booking.status === 'pending_approval' ? 'booking_submitted' : 'booking_approved')}, CURRENT_DATE, now())
ON CONFLICT (booking_code, stage, event_date) DO NOTHING;`);

    lines.push(`INSERT INTO notifications (id, type, title, message, link, is_read, metadata, created_at)
VALUES (
  ${sqlString(fixedUuid('44000000', index + 1))}, 'staging_fixture', ${sqlString(`${booking.code} ${booking.status}`)},
  ${sqlString(`Staging fixture for ${booking.status} workflow QA.`)}, ${sqlString(`/bookings/${booking.id}`)}, false,
  ${json({ fixture: true, booking_code: booking.code, status: booking.status })}, now()
) ON CONFLICT DO NOTHING;`);
  }

  for (const [index, vehicle] of vehicles.entries()) {
    lines.push(`INSERT INTO vehicle_deposits (id, vehicle_id, amount, created_at, updated_at)
VALUES (${sqlString(fixedUuid('45000000', index + 1))}, ${sqlString(vehicle.id)}, ${Math.round(vehicle.deposit * 100)}, now(), now())
ON CONFLICT (vehicle_id) DO UPDATE SET amount = EXCLUDED.amount, updated_at = now();`);
  }

  const active = bookingFixtures[2];
  const returned = bookingFixtures[3];
  const completed = bookingFixtures[4];

  lines.push(`INSERT INTO rental_agreements (
  id, booking_id, address_line1, city, state, zip, date_of_birth,
  driver_license_number, driver_license_state, driver_license_expiry,
  insurance_company, insurance_policy_number, insurance_expiry,
  customer_signature_data, customer_signature_type, customer_signed_at,
  owner_signature_data, owner_signature_type, owner_signed_at, owner_signed_by,
  terms_version, license_scan_metadata, created_at, updated_at
) VALUES (
  ${sqlString(fixedUuid('46000000', 1))}, ${sqlString(active.id)}, '100 Staging Way', ${sqlString(brand.location.city)}, ${sqlString(brand.location.state)}, ${sqlString(brand.location.zip)}, '1990-01-15',
  ${sqlString(`${codePrefix}ACTIVE`)}, 'FL', CURRENT_DATE + INTERVAL '2 years',
  'Staging Insurance Co', 'STAGE-POLICY-001', CURRENT_DATE + INTERVAL '1 year',
  'typed: Active Pickup', 'typed', now() - interval '2 days',
  'typed: Staging Owner', 'typed', now() - interval '1 day', 'staging-admin@example.test',
  '1.0', ${json({ fixture: true, method: 'manual', name_match: true })}, now(), now()
) ON CONFLICT (booking_id) DO UPDATE SET
  customer_signed_at = EXCLUDED.customer_signed_at,
  owner_signed_at = EXCLUDED.owner_signed_at,
  license_scan_metadata = EXCLUDED.license_scan_metadata,
  updated_at = now();`);

  for (const [index, booking] of [active, returned, completed].entries()) {
    lines.push(`INSERT INTO checkin_records (id, booking_id, record_type, odometer, fuel_level, condition_notes, photo_urls, created_by, created_at)
VALUES (
  ${sqlString(fixedUuid('47000000', index + 1))}, ${sqlString(booking.id)}, ${sqlString(booking.status === 'active' ? 'customer_checkin' : 'admin_inspection')},
  ${booking.status === 'active' ? 42110 : 42880}, 'full', ${sqlString(`Staging ${booking.status} condition record.`)}, '{}', 'staging-seed', now()
) ON CONFLICT DO NOTHING;`);
  }

  lines.push(`INSERT INTO incidentals (id, booking_id, type, amount, description, photo_urls, waived, created_by, created_at, updated_at)
VALUES (${sqlString(fixedUuid('48000000', 1))}, ${sqlString(returned.id)}, 'cleaning', 3500, 'Staging cleaning fee pending review.', '{}', false, 'staging-seed', now(), now())
ON CONFLICT DO NOTHING;`);

  lines.push(`INSERT INTO toll_charges (id, vehicle_id, booking_id, amount, toll_date, description, logged_by, created_at, updated_at)
VALUES (${sqlString(fixedUuid('49000000', 1))}, ${sqlString(returned.vehicle.id)}, ${sqlString(returned.id)}, 725, CURRENT_DATE - INTERVAL '10 days', 'Staging toll fixture.', 'staging-seed', now(), now())
ON CONFLICT DO NOTHING;`);

  lines.push(`INSERT INTO invoices (id, booking_id, items, subtotal, deposit_applied, amount_due, status, sent_at, stripe_payment_id, created_at, updated_at)
VALUES (
  ${sqlString(fixedUuid('50000000', 1))}, ${sqlString(returned.id)}, ${json([{ type: 'cleaning', description: 'Staging cleaning fee', amount: 3500 }, { type: 'toll', description: 'Staging toll', amount: 725 }])},
  4225, 0, 4225, 'sent', now(), ${sqlString(`${paymentProvider}_invoice_${returned.code.toLowerCase()}`)}, now(), now()
) ON CONFLICT (booking_id) DO UPDATE SET
  items = EXCLUDED.items,
  subtotal = EXCLUDED.subtotal,
  amount_due = EXCLUDED.amount_due,
  status = EXCLUDED.status,
  updated_at = now();`);

  lines.push(`INSERT INTO reviews (id, booking_id, customer_id, vehicle_id, rating, review_text, source, is_public, created_at)
VALUES (
  ${sqlString(fixedUuid('51000000', 1))}, ${sqlString(completed.id)}, ${sqlString(completed.customer.id)}, ${sqlString(completed.vehicle.id)}, 5,
  ${sqlString(`Smooth staging rental experience with ${brand.name}.`)}, 'direct', true, now() - interval '25 days'
) ON CONFLICT DO NOTHING;`);

  lines.push(`INSERT INTO messages (id, customer_id, direction, channel, subject, body, status, external_id, metadata, created_at)
VALUES (
  ${sqlString(fixedUuid('52000000', 1))}, ${sqlString(active.customer.id)}, 'outbound', 'email', 'Staging pickup reminder',
  ${sqlString(`Your ${brand.name} staging pickup is ready for QA.`)}, 'sent', ${sqlString(`stage_msg_${active.code.toLowerCase()}`)},
  ${json({ fixture: true, booking_code: active.code, stage: 'pickup_reminder', automated: true })}, now()
) ON CONFLICT DO NOTHING;`);

  lines.push('');
  lines.push('COMMIT;');
  lines.push('');
  lines.push(`-- Smoke checks:`);
  lines.push(`-- SELECT booking_code, status, total_cost FROM bookings WHERE booking_code LIKE '${codePrefix}-%' ORDER BY booking_code;`);
  lines.push(`-- SELECT vehicle_code, status, daily_rate, deposit_amount FROM vehicles WHERE vehicle_code LIKE '${codePrefix}-%' ORDER BY vehicle_code;`);
  lines.push(`-- SELECT email, tags FROM customers WHERE email LIKE '%@${emailDomain}' ORDER BY email;`);

  return lines.join('\n\n');
}

console.log(output());
