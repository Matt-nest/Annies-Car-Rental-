#!/usr/bin/env node
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dashboardRoot = path.resolve(__dirname, '..');

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) return fallback;
  return process.argv[index + 1];
}

const dashboardUrl = argValue('--dashboard-url', 'http://127.0.0.1:5173');
const customerUrl = argValue('--customer-url', 'http://127.0.0.1:3100');
const outRoot = path.resolve(dashboardRoot, argValue('--out', 'demo-output/real-ui'));

const booking = {
  id: 'booking-e2e-1',
  booking_code: 'E2E-BOOKING-001',
  status: 'pending_approval',
  payment_status: 'unpaid',
  created_at: '2026-07-20T14:00:00.000Z',
  pickup_date: '2026-08-01',
  return_date: '2026-08-08',
  pickup_time: '09:00',
  return_time: '09:00',
  pickup_location: 'Myrtle Beach',
  delivery_type: 'pickup',
  start_date: '2026-08-01',
  end_date: '2026-08-08',
  total_amount: 560,
  daily_rate: 80,
  rental_days: 7,
  subtotal: 560,
  delivery_fee: 0,
  discount_amount: 0,
  mileage_addon_fee: 0,
  toll_addon_fee: 0,
  tax_amount: 0,
  total_cost: 560,
  deposit_amount: 500,
  deposit_status: 'pending',
  insurance_status: 'pending_review',
  booking_addons: [],
  payments: [],
  rental_agreements: [{
    customer_signed_at: '2026-07-20T14:18:00.000Z',
    owner_signed_at: null,
    address_line1: '100 Ocean Blvd',
    city: 'Myrtle Beach',
    state: 'SC',
    zip: '29577',
    date_of_birth: '1990-01-01',
    driver_license_number: 'D1234567',
    driver_license_state: 'SC',
    driver_license_expiry: '2028-01-01',
    insurance_company: 'Palmetto Mutual',
    insurance_policy_number: 'PM-778812',
    insurance_expiry: '2026-09-01',
    insurance_agent_name: 'Jordan Policy',
    insurance_agent_phone: '555-0122',
    signature_type: 'typed',
  }],
  booking_status_log: [],
  customers: {
    id: 'customer-e2e-1',
    first_name: 'Taylor',
    last_name: 'Driver',
    email: 'taylor@example.com',
    phone: '555-0100',
    driver_license_number: 'D1234567',
    driver_license_state: 'SC',
    driver_license_expiry: '2028-01-01',
  },
  vehicles: {
    id: 'vehicle-e2e-1',
    year: 2024,
    make: 'Toyota',
    model: 'Camry',
    vehicle_code: 'CAM-001',
    status: 'available',
  },
};

const vehicle = {
  id: 'vehicle-e2e-1',
  vehicle_code: 'CAM-001',
  year: 2024,
  make: 'Toyota',
  model: 'Camry',
  status: 'available',
  daily_rate: 80,
  weekly_rate: 450,
  location: 'Myrtle Beach',
  license_plate: 'E2E123',
  seats: 5,
  fuel: 'Gas',
  mpg: 31,
  transmission: 'Automatic',
  image: '/favicon.svg',
  images: ['/favicon.svg'],
};

function ymdOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const todayYMD = ymdOffset(0);
const tomorrowYMD = ymdOffset(1);
const yesterdayYMD = ymdOffset(-1);

const vehicleSuv = {
  ...vehicle,
  id: 'vehicle-e2e-2',
  vehicle_code: 'SUV-002',
  year: 2023,
  make: 'Ford',
  model: 'Explorer',
  status: 'rented',
  daily_rate: 125,
  weekly_rate: 760,
  license_plate: 'OPS456',
};

const vehicleVan = {
  ...vehicle,
  id: 'vehicle-e2e-3',
  vehicle_code: 'VAN-003',
  year: 2022,
  make: 'Chrysler',
  model: 'Pacifica',
  status: 'service',
  daily_rate: 115,
  weekly_rate: 690,
  license_plate: 'RET789',
};

function bookingFixture(overrides = {}) {
  return {
    ...booking,
    ...overrides,
    customers: {
      ...booking.customers,
      ...(overrides.customers || {}),
    },
    vehicles: {
      ...booking.vehicles,
      ...(overrides.vehicles || {}),
    },
    rental_agreements: overrides.rental_agreements ?? booking.rental_agreements,
    payments: overrides.payments ?? booking.payments,
    booking_status_log: overrides.booking_status_log ?? booking.booking_status_log,
  };
}

const paymentDueBooking = bookingFixture({
  id: 'booking-e2e-payment-due',
  booking_code: 'PAY-DUE-2026',
  status: 'approved',
  payment_status: 'unpaid',
  pickup_date: todayYMD,
  return_date: ymdOffset(4),
  pickup_time: '11:00',
  return_time: '11:00',
  total_cost: 624,
  total_amount: 624,
  deposit_amount: 500,
  deposit_status: 'pending',
  customers: { id: 'customer-e2e-2', first_name: 'Morgan', last_name: 'Lee', email: 'morgan@example.com', phone: '555-0102' },
  vehicles: vehicleSuv,
  rental_agreements: [{ customer_signed_at: null, owner_signed_at: null }],
});

const readyPickupBooking = bookingFixture({
  id: 'booking-e2e-ready-pickup',
  booking_code: 'READY-PU-2026',
  status: 'ready_for_pickup',
  payment_status: 'paid',
  pickup_date: todayYMD,
  return_date: ymdOffset(3),
  pickup_time: '14:30',
  return_time: '14:30',
  total_cost: 420,
  total_amount: 420,
  deposit_amount: 500,
  deposit_status: 'paid',
  checkin_odometer: 38214,
  pickup_fuel_level: 'full',
  customers: { id: 'customer-e2e-3', first_name: 'Casey', last_name: 'Rivera', email: 'casey@example.com', phone: '555-0103' },
  vehicles: { ...vehicle, id: 'vehicle-e2e-4', vehicle_code: 'SED-004', make: 'Hyundai', model: 'Sonata', status: 'available' },
  rental_agreements: [{ customer_signed_at: `${todayYMD}T09:10:00.000Z`, owner_signed_at: `${todayYMD}T09:15:00.000Z` }],
  payments: [{ payment_type: 'rental', status: 'completed' }],
});

const activeReturnBooking = bookingFixture({
  id: 'booking-e2e-active-return',
  booking_code: 'RETURN-DUE-2026',
  status: 'active',
  payment_status: 'paid',
  pickup_date: ymdOffset(-3),
  return_date: todayYMD,
  pickup_time: '09:00',
  return_time: '17:00',
  total_cost: 545,
  total_amount: 545,
  deposit_amount: 500,
  deposit_status: 'paid',
  checkin_odometer: 44120,
  pickup_fuel_level: 'full',
  customers: { id: 'customer-e2e-4', first_name: 'Jordan', last_name: 'Miles', email: 'jordan@example.com', phone: '555-0104' },
  vehicles: vehicleSuv,
  rental_agreements: [{ customer_signed_at: `${yesterdayYMD}T08:00:00.000Z`, owner_signed_at: `${yesterdayYMD}T08:15:00.000Z` }],
  payments: [{ payment_type: 'rental', status: 'completed' }],
});

const overdueBooking = bookingFixture({
  id: 'booking-e2e-overdue',
  booking_code: 'OVERDUE-2026',
  status: 'active',
  payment_status: 'paid',
  pickup_date: ymdOffset(-6),
  return_date: yesterdayYMD,
  pickup_time: '10:00',
  return_time: '10:00',
  total_cost: 780,
  total_amount: 780,
  deposit_amount: 500,
  deposit_status: 'paid',
  checkin_odometer: 51200,
  pickup_fuel_level: '3/4',
  customers: { id: 'customer-e2e-5', first_name: 'Avery', last_name: 'Stone', email: 'avery@example.com', phone: '555-0105' },
  vehicles: { ...vehicleVan, status: 'rented' },
  rental_agreements: [{ customer_signed_at: `${yesterdayYMD}T07:30:00.000Z`, owner_signed_at: `${yesterdayYMD}T07:45:00.000Z` }],
  payments: [{ payment_type: 'rental', status: 'completed' }],
});

const returnedSettlementBooking = bookingFixture({
  id: 'booking-e2e-returned-settlement',
  booking_code: 'SETTLE-2026',
  status: 'returned',
  payment_status: 'paid',
  pickup_date: ymdOffset(-5),
  return_date: yesterdayYMD,
  pickup_time: '09:00',
  return_time: '09:00',
  total_cost: 690,
  total_amount: 690,
  deposit_amount: 500,
  deposit_status: 'paid',
  checkin_odometer: 30120,
  return_mileage: 30640,
  return_fuel_level: '1/2',
  customers: { id: 'customer-e2e-6', first_name: 'Riley', last_name: 'Cole', email: 'riley@example.com', phone: '555-0106' },
  vehicles: { ...vehicle, id: 'vehicle-e2e-5', vehicle_code: 'RET-005', make: 'Kia', model: 'K5', status: 'available' },
  rental_agreements: [{ customer_signed_at: `${yesterdayYMD}T10:00:00.000Z`, owner_signed_at: `${yesterdayYMD}T10:05:00.000Z` }],
  payments: [{ payment_type: 'rental', status: 'completed' }, { payment_type: 'deposit', status: 'completed' }],
});

const insuranceReviewBooking = bookingFixture({
  id: 'booking-e2e-insurance-review',
  booking_code: 'INS-REVIEW-2026',
  status: 'confirmed',
  payment_status: 'paid',
  insurance_status: 'pending_review',
  pickup_date: tomorrowYMD,
  return_date: ymdOffset(5),
  total_cost: 575,
  total_amount: 575,
  deposit_amount: 500,
  deposit_status: 'paid',
  customers: { id: 'customer-e2e-7', first_name: 'Jamie', last_name: 'Hart', email: 'jamie@example.com', phone: '555-0107' },
  vehicles: { ...vehicle, id: 'vehicle-e2e-6', vehicle_code: 'INS-006', make: 'Nissan', model: 'Altima', status: 'available' },
  rental_agreements: [{
    customer_signed_at: `${todayYMD}T12:00:00.000Z`,
    owner_signed_at: `${todayYMD}T12:05:00.000Z`,
    insurance_company: 'Palmetto Mutual',
    insurance_policy_number: 'PM-778812',
    insurance_expiry: ymdOffset(20),
  }],
  payments: [{ payment_type: 'rental', status: 'completed' }],
});

const longTermBooking = bookingFixture({
  id: 'booking-e2e-long-term',
  booking_code: 'LONGTERM-2026',
  status: 'active',
  rental_type: 'long_term',
  payment_status: 'paid',
  pickup_date: ymdOffset(-22),
  return_date: yesterdayYMD,
  total_cost: 1800,
  total_amount: 1800,
  deposit_amount: 500,
  deposit_status: 'paid',
  customers: { id: 'customer-e2e-8', first_name: 'Drew', last_name: 'Parker', email: 'drew@example.com', phone: '555-0108' },
  vehicles: { ...vehicle, id: 'vehicle-e2e-7', vehicle_code: 'LTR-007', make: 'Chevrolet', model: 'Malibu', status: 'rented' },
  rental_agreements: [{ customer_signed_at: `${ymdOffset(-22)}T09:00:00.000Z`, owner_signed_at: `${ymdOffset(-22)}T09:05:00.000Z` }],
  payments: [{ payment_type: 'rental', status: 'completed' }],
});

const demoBookings = [
  booking,
  paymentDueBooking,
  readyPickupBooking,
  activeReturnBooking,
  overdueBooking,
  returnedSettlementBooking,
  insuranceReviewBooking,
  longTermBooking,
];

const demoVehicles = [
  vehicle,
  vehicleSuv,
  vehicleVan,
  readyPickupBooking.vehicles,
  returnedSettlementBooking.vehicles,
  insuranceReviewBooking.vehicles,
  longTermBooking.vehicles,
];

const checkinRecordsByBooking = {
  [activeReturnBooking.id]: [
    { id: 'check-admin-prep', record_type: 'admin_prep', odometer: 44120, fuel_level: 'full', created_at: `${ymdOffset(-3)}T08:30:00.000Z` },
    { id: 'check-customer-return', record_type: 'customer_checkout', odometer: 44590, fuel_level: '3/4', condition_notes: 'Returned to office lot, key in lockbox.', photo_urls: [], created_at: `${todayYMD}T15:45:00.000Z` },
  ],
  [returnedSettlementBooking.id]: [
    { id: 'check-returned-admin', record_type: 'admin_inspection', odometer: 30640, fuel_level: '1/2', condition_notes: 'Cleaning fee and fuel adjustment reviewed.', photo_urls: [], created_at: `${yesterdayYMD}T11:30:00.000Z` },
  ],
};

const incidentalsByBooking = {
  [returnedSettlementBooking.id]: [
    { id: 'inc-cleaning', type: 'cleaning', description: 'Interior cleaning', amount: 7500, waived: false },
    { id: 'inc-fuel', type: 'gas', description: 'Fuel discrepancy', amount: 4200, waived: false },
  ],
};

const deposits = [
  { id: 'dep-returned', booking_id: returnedSettlementBooking.id, amount: 50000, status: 'held', bookings: returnedSettlementBooking, customers: returnedSettlementBooking.customers },
  { id: 'dep-active', booking_id: activeReturnBooking.id, amount: 50000, status: 'held', bookings: activeReturnBooking, customers: activeReturnBooking.customers },
];

const payments = [
  { id: 'pay-rental-1', booking_id: activeReturnBooking.id, payment_type: 'rental', amount: 54500, status: 'completed', method: 'stripe', created_at: `${ymdOffset(-3)}T10:00:00.000Z`, bookings: activeReturnBooking },
  { id: 'pay-deposit-1', booking_id: returnedSettlementBooking.id, payment_type: 'deposit', amount: 50000, status: 'completed', method: 'stripe', created_at: `${ymdOffset(-5)}T10:00:00.000Z`, bookings: returnedSettlementBooking },
  { id: 'pay-refund-1', booking_id: returnedSettlementBooking.id, payment_type: 'refund', amount: -38300, status: 'completed', method: 'stripe', created_at: `${todayYMD}T11:00:00.000Z`, notes: 'Refund for payment pay-deposit-1 after incidentals', bookings: returnedSettlementBooking },
];

const moneyActions = [
  { id: 'money-reminder', action_key: 'payment_reminder_sent', title: 'Payment reminder sent', subject: paymentDueBooking.booking_code, amount_cents: 112400, status: 'completed', booking_id: paymentDueBooking.id, actor_email: 'ops@example.com', created_at: `${todayYMD}T10:15:00.000Z` },
  { id: 'money-settlement', action_key: 'deposit_settlement_reviewed', title: 'Deposit settlement reviewed', subject: returnedSettlementBooking.booking_code, amount_cents: 11700, status: 'completed', booking_id: returnedSettlementBooking.id, actor_email: 'ops@example.com', created_at: `${todayYMD}T11:25:00.000Z` },
];

const bonzahPolicies = [
  {
    ...insuranceReviewBooking,
    insurance_status: 'pending',
    bonzah_tier_id: 'standard',
    bonzah_policy_no: null,
    bonzah_premium_cents: 8400,
    bonzah_markup_cents: 1800,
    bonzah_total_charged_cents: 10200,
  },
  {
    ...returnedSettlementBooking,
    insurance_status: 'bind_failed',
    bonzah_tier_id: 'essential',
    bonzah_policy_no: null,
    bonzah_premium_cents: 6200,
    bonzah_markup_cents: 1400,
    bonzah_total_charged_cents: 7600,
  },
  {
    ...activeReturnBooking,
    insurance_status: 'active',
    bonzah_tier_id: 'premium',
    bonzah_policy_no: 'BZ-OPS-4412',
    bonzah_premium_cents: 9600,
    bonzah_markup_cents: 2100,
    bonzah_total_charged_cents: 11700,
  },
];

function bookingById(id) {
  return demoBookings.find((row) => row.id === id) || booking;
}

const customerVehicle = {
  id: '1N4BL4DV3SN363627',
  vin: '1N4BL4DV3SN363627',
  make: 'Nissan',
  model: 'Altima',
  year: 2025,
  trim: 'SV',
  category: 'Sedan',
  tags: ['Sedan'],
  dailyRate: 98,
  weeklyRate: 590,
  weeklyDiscountPercent: 15,
  weeklyUnlimitedMileage: true,
  monthlyDisplayPrice: 1800,
  seats: 5,
  fuel: 'Gas',
  mpg: 31,
  transmission: 'Automatic',
  image: '/fleet/1N4BL4DV3SN363627/hero.png',
  images: [
    '/fleet/1N4BL4DV3SN363627/hero.png',
    '/fleet/1N4BL4DV3SN363627/side.png',
    '/fleet/1N4BL4DV3SN363627/rear.png',
  ],
  heroImage: '/fleet/1N4BL4DV3SN363627/hero.png',
  description: 'Reliable midsize sedan for local and rideshare rental use.',
  features: ['Apple CarPlay', 'Backup Camera', 'Bluetooth'],
  included: ['200 miles per day included', 'Professionally cleaned before each rental'],
};

async function isReachable(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function mockDashboardApi(page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const pathName = url.pathname.replace('/api/v1', '');
    const method = route.request().method();
    const bookingId = pathName.split('/')[2];
    const activeBooking = bookingById(bookingId);

    let body = {};
    if (pathName === '/users/me') {
      body = { id: 'e2e-admin', first_name: 'E2E', last_name: 'Admin', role: 'owner', email: 'e2e-admin@example.com' };
    } else if (pathName.endsWith('/approve')) {
      activeBooking.status = 'approved';
      activeBooking.payment_status = 'unpaid';
      body = { ...activeBooking, payment_link: `https://example.test/pay/${activeBooking.booking_code}`, deposit_amount: activeBooking.deposit_amount, is_high_risk: false };
    } else if (pathName.endsWith('/decline')) {
      body = { ok: true };
    } else if (pathName.endsWith('/pickup')) {
      activeBooking.status = 'active';
      body = activeBooking;
    } else if (pathName.endsWith('/return')) {
      activeBooking.status = 'returned';
      activeBooking.return_mileage = activeBooking.return_mileage || 44590;
      activeBooking.return_fuel_level = activeBooking.return_fuel_level || '3/4';
      body = activeBooking;
    } else if (pathName.endsWith('/complete')) {
      activeBooking.status = 'completed';
      body = activeBooking;
    } else if (pathName.endsWith('/checkout')) {
      const records = checkinRecordsByBooking[bookingId] || [];
      records.push({
        id: `admin-inspection-${Date.now()}`,
        record_type: 'admin_inspection',
        odometer: activeBooking.return_mileage || 44590,
        fuel_level: activeBooking.return_fuel_level || '3/4',
        condition_notes: 'Admin inspection saved during walkthrough.',
        photo_urls: [],
        created_at: new Date().toISOString(),
      });
      checkinRecordsByBooking[bookingId] = records;
      body = { success: true };
    } else if (pathName.endsWith('/inspection')) {
      body = { incidentals: incidentalsByBooking[bookingId] || [], total_cents: (incidentalsByBooking[bookingId] || []).reduce((sum, row) => sum + row.amount, 0) };
    } else if (pathName.startsWith('/bookings') && pathName.endsWith('/payments')) {
      body = payments.filter((row) => row.booking_id === bookingId);
    } else if (pathName.startsWith('/agreements/') && pathName.endsWith('/detail')) {
      body = { signed: Boolean(activeBooking.rental_agreements?.[0]?.customer_signed_at), booking: activeBooking };
    } else if (pathName.endsWith('/deposit')) {
      body = deposits.find((row) => row.booking_id === bookingId) || { status: 'none' };
    } else if (pathName.endsWith('/deposit/release')) {
      const deposit = deposits.find((row) => row.booking_id === bookingId);
      if (deposit) deposit.status = 'refunded';
      body = deposit || { status: 'refunded' };
    } else if (pathName.endsWith('/deposit/settle')) {
      const deposit = deposits.find((row) => row.booking_id === bookingId);
      if (deposit) deposit.status = 'applied';
      body = deposit || { status: 'applied' };
    } else if (pathName.endsWith('/invoice')) {
      body = {
        id: `invoice-${bookingId}`,
        status: 'draft',
        amount_due: activeBooking.id === returnedSettlementBooking.id ? 0 : 11700,
        deposit_applied: activeBooking.deposit_amount ? Math.round(Number(activeBooking.deposit_amount) * 100) : 0,
        items: [
          { type: 'deposit', description: 'Security deposit held', amount: activeBooking.deposit_amount ? Math.round(Number(activeBooking.deposit_amount) * 100) : 0 },
          ...(incidentalsByBooking[bookingId] || []).map((row) => ({ type: 'incidental', description: row.description, amount: row.amount })),
        ],
      };
    } else if (pathName.startsWith('/invoices/') && pathName.endsWith('/send')) {
      body = { ok: true, status: 'sent' };
    } else if (pathName.endsWith('/checkin-records')) {
      body = checkinRecordsByBooking[bookingId] || [];
    } else if (pathName.endsWith('/extensions')) {
      body = [];
    } else if (pathName.endsWith('/incidentals')) {
      if (method === 'POST') {
        let payload = {};
        try {
          payload = route.request().postDataJSON() || {};
        } catch {
          payload = {};
        }
        const next = { id: `inc-${Date.now()}`, type: payload.type || 'other', description: payload.description || 'Manual charge', amount: payload.amount || 0, waived: false };
        incidentalsByBooking[bookingId] = [...(incidentalsByBooking[bookingId] || []), next];
      }
      body = incidentalsByBooking[bookingId] || [];
    } else if (pathName.startsWith('/incidentals/')) {
      body = { ok: true };
    } else if (pathName.startsWith('/bookings')) {
      body = pathName === '/bookings' ? { data: demoBookings, total: demoBookings.length, limit: 250, offset: 0 } : activeBooking;
    } else if (pathName.startsWith('/vehicles')) {
      body = pathName === '/vehicles' ? { data: demoVehicles, total: demoVehicles.length } : (demoVehicles.find((row) => row.id === pathName.split('/')[2]) || vehicle);
    } else if (pathName === '/stats/overview') {
      body = {
        active_rentals: demoBookings.filter((row) => row.status === 'active').length,
        pending_approvals: demoBookings.filter((row) => row.status === 'pending_approval').length,
        pending_agreements: demoBookings.filter((row) => !row.rental_agreements?.[0]?.customer_signed_at).length,
        pending_inspections: demoBookings.filter((row) => row.status === 'returned').length,
        pending_reviews: 1,
        deposits_held: deposits.filter((row) => row.status === 'held').length,
        deposits_held_total: '1000.00',
        pickups_today: demoBookings.filter((row) => row.pickup_date === todayYMD),
        returns_today: demoBookings.filter((row) => row.return_date === todayYMD),
        revenue_this_month: 4814,
        available_vehicles: demoVehicles.filter((row) => row.status === 'available').length,
      };
    } else if (pathName.startsWith('/stats/revenue')) {
      body = { total: 4814, series: [{ date: ymdOffset(-5), revenue: 690 }, { date: ymdOffset(-3), revenue: 545 }, { date: todayYMD, revenue: 624 }] };
    } else if (pathName === '/stats/vehicles') {
      body = demoVehicles.map((row, index) => ({ vehicle_id: row.id, label: `${row.make} ${row.model}`, revenue: 560 + index * 145 }));
    } else if (pathName === '/stats/upcoming') {
      body = demoBookings.filter((row) => ['approved', 'confirmed', 'ready_for_pickup'].includes(row.status));
    } else if (pathName.startsWith('/stats/activity')) {
      body = [
        { id: 'act-1', type: 'booking_approved', message: `${paymentDueBooking.booking_code} approved; payment reminder needed`, created_at: `${todayYMD}T10:05:00.000Z` },
        { id: 'act-2', type: 'return_due', message: `${activeReturnBooking.booking_code} is due back today`, created_at: `${todayYMD}T09:30:00.000Z` },
      ];
    } else if (pathName.startsWith('/stats/webhook-failures')) {
      body = [
        { id: 'webhook-failure-1', provider: 'stripe', event_type: 'payment_intent.succeeded', error_message: 'Signature retry pending', created_at: `${todayYMD}T09:45:00.000Z` },
      ];
    } else if (pathName === '/notifications/unread-count') {
      body = { count: 3 };
    } else if (pathName.startsWith('/notifications')) {
      body = [
        { id: 'notif-1', type: 'payment_due', title: 'Payment due', message: paymentDueBooking.booking_code, is_read: false, created_at: `${todayYMD}T10:00:00.000Z` },
        { id: 'notif-2', type: 'webhook_failure', title: 'Webhook retry pending', message: 'Stripe payment event needs review', is_read: false, created_at: `${todayYMD}T09:45:00.000Z` },
      ];
    } else if (pathName.startsWith('/search')) {
      body = { bookings: demoBookings.slice(0, 4), customers: demoBookings.map((row) => row.customers).slice(0, 4), vehicles: demoVehicles.slice(0, 4), payments };
    } else if (pathName.startsWith('/agreements/pending-counter-sign')) {
      body = [paymentDueBooking];
    } else if (pathName.startsWith('/damage-reports')) {
      body = [];
    } else if (pathName.startsWith('/payments')) {
      body = { data: payments, total: payments.length };
    } else if (pathName.startsWith('/deposits')) {
      body = { data: deposits.filter((row) => !url.searchParams.get('status') || row.status === url.searchParams.get('status')), total: deposits.length };
    } else if (pathName.startsWith('/money-actions')) {
      body = { data: moneyActions, total: moneyActions.length };
    } else if (pathName.startsWith('/messaging/conversations')) {
      body = demoBookings.slice(0, 4).map((row) => ({ customer_id: row.customers.id, customers: row.customers, last_message: `Operational follow-up for ${row.booking_code}`, unread_count: row.id === paymentDueBooking.id ? 1 : 0 }));
    } else if (pathName.startsWith('/messaging/conversations/') && pathName.endsWith('/messages')) {
      body = [{ id: 'msg-1', direction: 'outbound', body: 'Payment reminder sent with secure booking link.', created_at: `${todayYMD}T10:15:00.000Z` }];
    } else if (pathName.startsWith('/messaging/conversations/') && pathName.endsWith('/send')) {
      moneyActions.unshift({ id: `money-${Date.now()}`, action_key: 'message_sent', title: 'Customer message sent', status: 'completed', created_at: new Date().toISOString() });
      body = { ok: true };
    } else if (pathName.startsWith('/customers')) {
      body = demoBookings.map((row) => ({ ...row.customers, bookings: [row], total_spent: row.total_cost }));
    } else if (pathName.startsWith('/monthly-inquiries') || pathName.startsWith('/reviews')) {
      body = [];
    } else if (pathName.startsWith('/system/health')) {
      body = { status: 'operational', latency_ms: 42, checks: { database: 'ok', payments: 'ok', notifications: 'degraded', webhooks: 'retrying' } };
    } else if (pathName.startsWith('/admin/bonzah/stats')) {
      body = { counts: { active: 1, pending: 1, bind_failed: 1, cancelled: 0, expired: 0 }, total: bonzahPolicies.length, markup_this_month_cents: 5300, markup_all_time_cents: 14800 };
    } else if (pathName.startsWith('/admin/bonzah/policies')) {
      const status = url.searchParams.get('status');
      body = { policies: bonzahPolicies.filter((row) => !status || row.insurance_status === status) };
    } else if (pathName.startsWith('/admin/bonzah/events')) {
      body = {
        events: [
          { id: 'bz-event-1', event_type: 'quote', status_code: 200, duration_ms: 310, created_at: `${todayYMD}T09:00:00.000Z` },
          { id: 'bz-event-2', event_type: 'bind', status_code: 502, duration_ms: 1220, error_text: 'Carrier timeout. Retry queued.', created_at: `${todayYMD}T09:10:00.000Z` },
        ],
      };
    } else if (pathName.startsWith('/admin/bonzah/health')) {
      body = { ok: true, status: 'operational' };
    } else if (pathName.startsWith('/admin/bonzah/settings')) {
      body = { enabled: true, markup_percent: 18, tiers: ['essential', 'standard', 'premium'] };
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

async function mockCustomerApi(page, options = {}) {
  const status = options.status || 'pending_approval';
  const alreadySigned = Boolean(options.alreadySigned);
  const includeCustomerDefaults = options.customerDefaults !== false;

  await page.route('**/vehicles/catalog', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([customerVehicle]) });
  });
  await page.route('**/uploads/id-photo', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ path: 'demo/id-front.jpg', url: '/favicon.svg', scan_id: 'scan-demo-id' }),
    });
  });
  await page.route('**/uploads/scan-id', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        photo_path: 'demo/id-front.jpg',
        scan_id: 'scan-demo-id',
        fields: {
          firstName: 'Taylor',
          lastName: 'Driver',
          licenseNumber: 'D1234567',
          state: 'SC',
          dob: '1990-01-01',
          expiry: '2028-01-01',
          addressLine1: '100 Ocean Blvd',
          city: 'Myrtle Beach',
          zip: '29577',
        },
      }),
    });
  });
  await page.route('**/agreements/TEST-BOOKING-001', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        alreadySigned,
        prefilledSteps: alreadySigned ? ['scan'] : [],
        autoFilled: {
          bookingCode: 'TEST-BOOKING-001',
          customerName: 'Taylor Driver',
          customerEmail: 'taylor@example.com',
          customerPhone: '555-0100',
          vehicleName: '2025 Nissan Altima SV',
          pickupDate: '2026-08-01',
          returnDate: '2026-08-08',
          pickupTime: '10:00',
          returnTime: '10:00',
          pickupLocation: 'Myrtle Beach',
          rentalDays: 7,
          dailyRate: 98,
          totalCost: 734,
          depositAmount: 500,
          state: 'SC',
        },
        customerDefaults: includeCustomerDefaults ? {
          address_line1: '100 Ocean Blvd',
          city: 'Myrtle Beach',
          state: 'SC',
          zip: '29577',
          date_of_birth: '1990-01-01',
          driver_license_number: 'D1234567',
          driver_license_state: 'SC',
          driver_license_expiry: '2028-01-01',
        } : null,
      }),
    });
  });
  await page.route('**/agreements/TEST-BOOKING-001/sign', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.route('**/bookings/status/TEST-BOOKING-001', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ booking_code: 'TEST-BOOKING-001', status }),
    });
  });
  await page.route('**/square/booking-summary/TEST-BOOKING-001', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        alreadyPaid: false,
        booking: {
          bookingCode: 'TEST-BOOKING-001',
          vehicle: '2025 Nissan Altima SV',
          customerName: 'Taylor Driver',
          customerEmail: 'taylor@example.com',
          rentalDays: 7,
          dailyRate: 98,
          subtotal: 686,
          taxAmount: 48,
          totalCost: 734,
          depositAmount: 500,
          pickupDate: '2026-08-01',
          returnDate: '2026-08-08',
          pickupState: 'SC',
        },
      }),
    });
  });
  await page.route('**/stripe/booking-summary/TEST-BOOKING-001', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        alreadyPaid: false,
        cardOnFileEnabled: false,
        booking: {
          bookingCode: 'TEST-BOOKING-001',
          vehicle: '2025 Nissan Altima SV',
          customerName: 'Taylor Driver',
          customerEmail: 'taylor@example.com',
          rentalDays: 7,
          dailyRate: 98,
          subtotal: 686,
          taxAmount: 48,
          totalCost: 734,
          depositAmount: 500,
          pickupDate: '2026-08-01',
          returnDate: '2026-08-08',
          pickupState: 'SC',
        },
      }),
    });
  });
  await page.route('**/bookings/insurance/config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ enabled: true, tiers: [], markup_percent: 0, excluded_states: [], pai_excluded_states: [] }),
    });
  });
  await page.route('**/bookings/TEST-BOOKING-001/insurance', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.route('**/bookings/TEST-BOOKING-001/insurance/quote', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total_cents: 9200, premium_cents: 7600, markup_cents: 1600 }) });
  });
  await page.route('**/bookings', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ booking_code: 'TEST-BOOKING-001' }) });
  });
}

async function saveRecording(page, context, guideDir) {
  const video = page.video();
  await context.close();
  if (!video) return null;
  const original = await video.path();
  const target = path.join(guideDir, 'recording.webm');
  await rename(original, target);
  return target;
}

async function installTrainingOverlay(page) {
  await page.addStyleTag({
    content: `
      .training-cursor {
        position: fixed;
        left: 0;
        top: 0;
        z-index: 2147483000;
        width: 24px;
        height: 24px;
        pointer-events: none;
        transform: translate3d(72px, 72px, 0);
        transition: transform 420ms cubic-bezier(.2,.8,.2,1);
      }
      .training-cursor::before {
        content: "";
        position: absolute;
        left: 3px;
        top: 2px;
        width: 0;
        height: 0;
        border-left: 15px solid #ffffff;
        border-top: 10px solid transparent;
        border-bottom: 10px solid transparent;
        filter: drop-shadow(0 3px 5px rgba(0,0,0,.45));
        transform: rotate(-18deg);
      }
      .training-cursor.click::after {
        content: "";
        position: absolute;
        left: -14px;
        top: -14px;
        width: 48px;
        height: 48px;
        border: 2px solid rgba(14,165,233,.85);
        border-radius: 999px;
        animation: training-click 520ms ease-out;
      }
      .training-focus-ring {
        position: fixed;
        z-index: 2147482998;
        border: 3px solid rgba(14,165,233,.95);
        border-radius: 14px;
        box-shadow: 0 0 0 9999px rgba(3,7,18,.18), 0 18px 55px rgba(14,165,233,.2);
        pointer-events: none;
        transition: all 420ms cubic-bezier(.2,.8,.2,1);
      }
      .training-callout {
        position: fixed;
        z-index: 2147482999;
        max-width: 360px;
        padding: 10px 12px;
        border-radius: 12px;
        background: rgba(15,23,42,.94);
        color: #fff;
        font: 700 13px/1.35 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        box-shadow: 0 18px 45px rgba(0,0,0,.28);
        pointer-events: none;
        transition: all 420ms cubic-bezier(.2,.8,.2,1);
      }
      @keyframes training-click {
        from { opacity: 1; transform: scale(.4); }
        to { opacity: 0; transform: scale(1.45); }
      }
    `,
  });
  await page.evaluate(() => {
    if (window.__trainingOverlayReady) return;
    const cursor = document.createElement('div');
    const ring = document.createElement('div');
    const callout = document.createElement('div');
    cursor.className = 'training-cursor';
    ring.className = 'training-focus-ring';
    callout.className = 'training-callout';
    ring.style.opacity = '0';
    callout.style.opacity = '0';
    document.body.append(cursor, ring, callout);
    window.__trainingOverlayReady = true;
    window.__setTrainingOverlay = ({ x, y, rect, label, click }) => {
      cursor.style.transform = `translate3d(${Math.max(12, x)}px, ${Math.max(12, y)}px, 0)`;
      cursor.classList.toggle('click', Boolean(click));
      if (rect) {
        ring.style.opacity = '1';
        ring.style.left = `${Math.max(8, rect.x - 8)}px`;
        ring.style.top = `${Math.max(8, rect.y - 8)}px`;
        ring.style.width = `${Math.max(42, rect.width + 16)}px`;
        ring.style.height = `${Math.max(36, rect.height + 16)}px`;
      } else {
        ring.style.opacity = '0';
      }
      if (label) {
        callout.style.opacity = '1';
        callout.textContent = label;
        const preferredLeft = rect ? rect.x + rect.width + 18 : x + 22;
        const left = Math.min(window.innerWidth - 380, Math.max(16, preferredLeft));
        const top = rect ? Math.min(window.innerHeight - 90, Math.max(16, rect.y)) : Math.min(window.innerHeight - 90, y + 22);
        callout.style.left = `${left}px`;
        callout.style.top = `${top}px`;
      } else {
        callout.style.opacity = '0';
      }
      if (click) {
        window.setTimeout(() => cursor.classList.remove('click'), 560);
      }
    };
  });
}

async function setTrainingOverlay(page, options) {
  await page.evaluate((payload) => window.__setTrainingOverlay?.(payload), options);
}

function recordGuideStep(page, caption, kind = 'focus', durationMs = 2600) {
  if (!caption) return;
  if (!page.__guideScript) page.__guideScript = [];
  const startMs = page.__guideScript.reduce((sum, step) => sum + (step.durationMs || 0), 0);
  page.__guideScript.push({
    caption,
    narration: caption,
    kind,
    startMs,
    endMs: startMs + durationMs,
    durationMs,
  });
}

async function highlightLocator(page, locator, label, wait = 900, options = {}) {
  if (options.record !== false) recordGuideStep(page, label, options.kind || 'focus', wait);
  const count = await locator.count().catch(() => 0);
  if (!count) {
    await setTrainingOverlay(page, { x: 96, y: 96, label });
    await page.waitForTimeout(wait);
    return null;
  }
  await locator.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => {});
  const box = await locator.boundingBox().catch(() => null);
  if (!box) {
    await setTrainingOverlay(page, { x: 96, y: 96, label });
    await page.waitForTimeout(wait);
    return null;
  }
  const x = box.x + Math.min(box.width - 8, Math.max(18, box.width * 0.72));
  const y = box.y + Math.min(box.height - 8, Math.max(18, box.height * 0.58));
  await setTrainingOverlay(page, { x, y, rect: box, label });
  await page.waitForTimeout(wait);
  return box;
}

async function clickHighlighted(page, locator, label) {
  recordGuideStep(page, label, 'click', 1500);
  const box = await highlightLocator(page, locator, label, 650, { record: false });
  if (box) {
    const x = box.x + Math.min(box.width - 8, Math.max(18, box.width * 0.72));
    const y = box.y + Math.min(box.height - 8, Math.max(18, box.height * 0.58));
    await setTrainingOverlay(page, { x, y, rect: box, label, click: true });
  } else {
    await setTrainingOverlay(page, { x: 96, y: 96, label, click: true });
  }
  await locator.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(850);
}

async function fillHighlighted(page, locator, value, label) {
  recordGuideStep(page, label, 'fill', 1000);
  await highlightLocator(page, locator, label, 450, { record: false });
  await locator.fill(value, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(350);
}

const dashboardGuideCopy = {
  'admin-approval-payment-unlock': {
    heading: 'Admin approval starts from the completed customer package.',
    status: 'Verify booking code, customer, vehicle, dates, ID, agreement, insurance, pricing, and risk before approving.',
    controls: 'Use the approve modal to set risk and deposit only after the record is clean.',
    workArea: 'Approval notifies the customer and exposes the payment link; it does not mean the booking is paid.',
    decision: 'Do not approve if identity, agreement, insurance, vehicle availability, amount, or deposit risk is unclear.',
  },
  'booking-queue': {
    heading: 'Use the queue to triage booking requests before opening a record.',
    status: 'Confirm age, status, dates, vehicle, and customer before taking action.',
    controls: 'Use filters and search to narrow the queue to the exact operational issue.',
    workArea: 'Open the matching request only after the row matches the customer and trip details.',
    decision: 'Do not approve if payment, insurance, pickup, or vehicle availability is unclear.',
  },
  'booking-lifecycle': {
    heading: 'The booking detail page is the source of truth for the rental.',
    status: 'Read status, customer, vehicle, pickup, return, money, and document state together.',
    controls: 'Move through the lifecycle tabs before making an approval or closeout decision.',
    workArea: 'Use the operational panels to clear one blocker at a time.',
    decision: 'Do not advance the booking if any pickup, return, agreement, payment, or insurance blocker remains.',
  },
  'fleet-availability': {
    heading: 'Use Fleet to confirm what can actually be sold.',
    status: 'Check vehicle status, visibility, pricing, and location before quoting availability.',
    controls: 'Search or filter to the exact vehicle instead of relying on memory.',
    workArea: 'Review blocked dates and vehicle condition before committing inventory.',
    decision: 'Do not sell a vehicle that is hidden, blocked, damaged, in service, or already committed.',
  },
  'payments-deposits-refunds': {
    heading: 'Treat money screens as high-risk operational controls.',
    status: 'Start with what is due, what is held, and what needs settlement.',
    controls: 'Use the ledger, deposits, and audit views before any charge or refund.',
    workArea: 'Open the related booking so the money action matches the rental record.',
    decision: 'Do not charge, refund, release, or apply a deposit until amount, reason, and booking status all match.',
  },
  'calendar-checkins': {
    heading: 'Use Check-Ins to run today’s pickup and return work.',
    status: 'Separate pickups, returns, active rentals, and overdue work before contacting customers.',
    controls: 'Use tabs and filters to focus the team on the next operational step.',
    workArea: 'Open the matching rental and verify identity, vehicle, inspection, and timing.',
    decision: 'Do not hand over or close out a vehicle if inspection, license, payment, or damage status is unresolved.',
  },
  'insurance-review': {
    heading: 'Insurance review is a pickup gate, not just a document folder.',
    status: 'Confirm named driver, vehicle, coverage dates, limits, and proof source.',
    controls: 'Use review controls to separate clean approvals from policy mismatches.',
    workArea: 'Tie every insurance decision back to the exact booking and customer.',
    decision: 'Do not proceed if the driver, vehicle, dates, or coverage limits do not match the booking.',
  },
  'customers-portal-long-term': {
    heading: 'Use Customers to keep support and long-term work tied to the right person.',
    status: 'Confirm contact details, rental history, portal access, and long-term status.',
    controls: 'Search first so duplicates do not split notes, payments, or messages.',
    workArea: 'Open the customer record before making portal, billing, or support changes.',
    decision: 'Do not create a duplicate customer or send portal access until identity and contact details are confirmed.',
  },
  'messaging-notifications': {
    heading: 'Messaging should trigger one clear customer action.',
    status: 'Confirm the message belongs to the right booking, customer, and lifecycle step.',
    controls: 'Use templates and conversation context instead of rewriting from scratch.',
    workArea: 'Review the destination, timing, and opt-out state before sending.',
    decision: 'Do not send if consent, recipient, booking status, or message intent is unclear.',
  },
  'revenue-reporting': {
    heading: 'Use revenue reporting to decide what to change operationally.',
    status: 'Read totals alongside vehicle performance, date range, and booking quality.',
    controls: 'Adjust filters before drawing conclusions from the chart or table.',
    workArea: 'Look for fleet, price, occupancy, or channel patterns that explain the result.',
    decision: 'Do not make pricing or fleet changes from one number without checking context and time period.',
  },
  'system-health': {
    heading: 'System health is the first stop when normal workflows misbehave.',
    status: 'Check payment, webhook, notification, and settings signals together.',
    controls: 'Use diagnostics before retrying or manually patching an operational record.',
    workArea: 'Match each failure to the affected booking, customer, or money event.',
    decision: 'Do not keep processing if payments, webhooks, messages, or required integrations are failing.',
  },
};

async function screenshotStep(page, guideDir, index) {
  await page.screenshot({ path: path.join(guideDir, `screen-${String(index).padStart(2, '0')}.png`), fullPage: false });
  return index + 1;
}

async function runDashboardWalkthrough(page, guideId, guideDir, shotIndex) {
  const copy = dashboardGuideCopy[guideId] || {
    heading: 'Start on the operational screen for this guide.',
    status: 'Read the status area before taking action.',
    controls: 'Use the visible controls to narrow the workflow.',
    workArea: 'Confirm the work area matches the intended customer, booking, or vehicle.',
    decision: 'Do not proceed if the screen does not match the operational facts.',
  };

  if (guideId === 'system-health') {
    const systemTab = page.getByRole('button', { name: /^system$/i }).first();
    if (await systemTab.isVisible().catch(() => false)) {
      await clickHighlighted(page, systemTab, 'Open System before checking diagnostics.');
      await page.waitForTimeout(800);
    }
  }

  const fallbackSteps = [
    { locator: page.locator('h1').first(), label: copy.heading, wait: 1800 },
    { locator: page.locator('main section, main article, main [class*="card"], main table').first(), label: copy.status, wait: 2100 },
    { locator: page.locator('main [role="tablist"], main button, main input, main select').first(), label: copy.controls, wait: 1900 },
    { scroll: 260, locator: page.locator('main table, main [role="row"], main section, main article, main [class*="grid"]').nth(1), label: copy.workArea, wait: 2200 },
  ];

  const walkthroughSteps = {
    'admin-approval-payment-unlock': [
      { locator: page.locator('h1').first(), label: 'Open Booking Detail before approving a customer package.', wait: 1800 },
      { locator: page.getByText(/Insurance Review Required|Your Counter-Signature|E2E-BOOKING/i).first(), label: 'Review submitted agreement and insurance signals before approval.', wait: 2400 },
      { locator: page.getByText(/Taylor Driver|D1234567|Palmetto Mutual|PM-778812/i).first(), label: 'Verify identity, license, contact, vehicle, dates, and insurance against the booking.', wait: 2600 },
      { locator: page.getByRole('button', { name: /^approve$/i }).first(), label: 'Open approval only after operational blockers are clear.', wait: 2200 },
    ],
    'booking-queue': [
      { locator: page.locator('h1').first(), label: 'Bookings is the triage queue, not the place to guess or skip record review.', wait: 1800 },
      { locator: page.getByPlaceholder(/search booking/i), label: 'Search only when you know the booking code, customer, phone, email, or vehicle.', wait: 1800 },
      { locator: page.getByRole('button', { name: /needs approval/i }).first(), label: 'Lifecycle chips narrow the queue by the actual operating problem.', wait: 1900 },
      { locator: page.getByText(/E2E-BOOKING-001|Taylor Driver|Camry/i).first(), label: 'Verify the row: booking code, customer, vehicle, dates, status, and total.', wait: 2300 },
      { locator: page.getByTitle(/approve/i).first(), label: 'Approve only when the request can be fulfilled; otherwise open the record or decline with a reason.', wait: 2200 },
    ],
    'booking-lifecycle': [
      { locator: page.locator('h1').first(), label: 'Booking Detail is the record of truth for this rental.', wait: 1800 },
      { locator: page.getByText(/pending approval|approved|confirmed|ready for pickup|active|returned|completed/i).first(), label: 'Read the current status before choosing a lifecycle action.', wait: 1800 },
      { locator: page.getByRole('button', { name: /overview/i }).first(), label: 'Overview verifies customer, vehicle, pickup, return, money, agreement, and insurance facts.', wait: 2100 },
      { locator: page.getByRole('button', { name: /check-in/i }).first(), label: 'Check-In records admin prep and readiness before customer handoff.', wait: 2100 },
      { locator: page.getByRole('button', { name: /check-out/i }).first(), label: 'Check-Out records return condition, charges, deposit settlement, invoice, and completion.', wait: 2300 },
    ],
    'fleet-availability': [
      { locator: page.locator('h1').first(), label: 'Fleet controls what can actually be sold.', wait: 1700 },
      { locator: page.getByText(/CAM-001|Toyota|available/i).first(), label: 'Confirm the exact vehicle, status, rate, location, and visibility.', wait: 2300 },
      { locator: page.locator('main button, main a').first(), label: 'Open Vehicle Detail before changing pricing, photos, status, or blocked dates.', wait: 2100 },
      { locator: page.getByText(/service|available|rented|vehicle/i).first(), label: 'Do not sell a vehicle that is hidden, blocked, damaged, in service, or committed.', wait: 2300 },
    ],
    'payments-deposits-refunds': [
      { locator: page.locator('h1').first(), label: 'Payments identifies money risk; Booking Detail authorizes action.', wait: 1800 },
      { locator: page.getByText(/collection queue|deposits held|needs settlement|long-term/i).first(), label: 'Start with the risk tiles: collection, held deposits, settlement, and long-term exposure.', wait: 2300 },
      { locator: page.getByText(/collect rental balance|payment due/i).first(), label: 'For unpaid approved bookings, confirm the customer, booking, amount, and reason.', wait: 2300 },
      { locator: page.getByRole('button', { name: /copy link|send reminder/i }).first(), label: 'Customer-facing money actions need booking context and an audit trail.', wait: 2400 },
      { locator: page.getByText(/action history|audit/i).first(), label: 'Check the action history after reminders, copied links, refunds, releases, or settlements.', wait: 2200 },
    ],
    'calendar-checkins': [
      { locator: page.locator('h1').first(), label: 'Check-Ins turns the schedule into the daily operations board.', wait: 1800 },
      { locator: page.getByText(/blocked pickup|ready handoff|overdue|due back|active out|settle/i).first(), label: 'Read lane counts before opening individual rentals.', wait: 2300 },
      { locator: page.getByText(/blocked from pickup/i).first(), label: 'Blocked pickups go to Overview to clear payment, agreement, counter-sign, insurance, or readiness.', wait: 2300 },
      { locator: page.getByText(/ready for handoff|due back today|overdue returns|returned/i).first(), label: 'Pickup cards open Check-In; return and settlement cards open Check-Out.', wait: 2400 },
      { locator: page.getByText(/RETURN-DUE|OVERDUE|SETTLE/i).first(), label: 'Open the exact rental before recording return, override, charges, or deposit settlement.', wait: 2400 },
    ],
    'insurance-review': [
      { locator: page.locator('h1').first(), label: 'Insurance is a pickup gate, not just a policy list.', wait: 1800 },
      { locator: page.getByText(/active|pending bind|bind failed|markup/i).first(), label: 'Use the status tiles to spot pending binds and bind failures first.', wait: 2300 },
      { locator: page.getByRole('button', { name: /bind failed/i }).first(), label: 'Filter bind failures when a customer may have paid but no policy was issued.', wait: 2200 },
      { locator: page.getByText(/INS-REVIEW|SETTLE|RETURN-DUE|policy|premium/i).first(), label: 'Verify driver, vehicle, dates, tier, premium, markup, charged amount, and status.', wait: 2500 },
      { locator: page.getByText(/recent activity|HTTP|Carrier timeout/i).first(), label: 'Recent activity explains provider errors that must be reconciled before pickup.', wait: 2300 },
    ],
    'customers-portal-long-term': [
      { locator: page.locator('h1').first(), label: 'Portal groups customer account work that is still operationally active.', wait: 1800 },
      { locator: page.getByText(/onboarding|past due|renewal|checkout|active/i).first(), label: 'Review onboarding, active, renewal soon, past-due, and returned account states.', wait: 2400 },
      { locator: page.getByText(/LONGTERM|Drew|portal|payment plan|renewal/i).first(), label: 'Tie portal links, payment plans, renewal invoices, and checkout work to the exact booking.', wait: 2500 },
      { locator: page.getByRole('button', { name: /refresh/i }).first(), label: 'Refresh before acting so account risk is based on current booking data.', wait: 1900 },
    ],
    'messaging-notifications': [
      { locator: page.locator('h1').first(), label: 'Messaging is for one clear customer action tied to the right record.', wait: 1800 },
      { locator: page.getByRole('button', { name: /templates|conversations|opt-outs|cron/i }).first(), label: 'Use conversations, templates, sequences, and opt-outs for different communication checks.', wait: 2300 },
      { locator: page.getByText(/Taylor|Morgan|Operational follow-up|Payment reminder/i).first(), label: 'Pick the customer conversation that matches the booking or account reason.', wait: 2300 },
      { locator: page.locator('textarea, [contenteditable="true"], input').last(), label: 'Before sending, confirm recipient, consent, booking code, link, and deadline.', wait: 2300 },
    ],
    'revenue-reporting': [
      { locator: page.locator('h1').first(), label: 'Revenue is for business decisions; Payments is for reconciliation.', wait: 1800 },
      { locator: page.getByRole('button', { name: /last 30 days|all time/i }).first(), label: 'Set the date range before reading any number.', wait: 2000 },
      { locator: page.getByText(/total revenue|this month|avg per booking|avg rental length/i).first(), label: 'Read total revenue, current month, average booking value, and average rental length together.', wait: 2400 },
      { locator: page.getByText(/monthly revenue|rate type|vehicle/i).first(), label: 'Use charts for signal and detailed rows for context before changing pricing or fleet decisions.', wait: 2500 },
    ],
    'system-health': [
      { locator: page.locator('h1').first(), label: 'System checks separate workflow problems from integration problems.', wait: 1800 },
      { locator: page.getByText(/system status|operational|latency/i).first(), label: 'Start with backend health and latency before retrying a failed workflow.', wait: 2300 },
      { locator: page.getByText(/notifications|stripe|environment variables|twilio|resend/i).first(), label: 'Check environment, notification, payment, and automation settings for mismatched configuration.', wait: 2500 },
      { locator: page.getByText(/webhook|automation|return reminder|payment processing/i).first(), label: 'If a payment, message, or booking update failed, check webhooks before asking the customer to repeat it.', wait: 2500 },
    ],
  };

  const steps = walkthroughSteps[guideId] || fallbackSteps;
  for (const step of steps) {
    if (step.scroll) {
      await page.mouse.wheel(0, step.scroll).catch(() => {});
      await page.waitForTimeout(500);
    }
    await highlightLocator(page, step.locator, step.label, step.wait || 2000);
    shotIndex = await screenshotStep(page, guideDir, shotIndex);
  }

  recordGuideStep(page, copy.decision, 'stop', 2600);
  await setTrainingOverlay(page, { x: 560, y: 590, label: copy.decision });
  await page.waitForTimeout(2400);
  shotIndex = await screenshotStep(page, guideDir, shotIndex);

  await page.mouse.wheel(0, -260).catch(() => {});
  await page.waitForTimeout(400);
  return shotIndex;
}

async function captureDashboardGuide(browser, guideId, routePath, actions = []) {
  const guideDir = path.join(outRoot, guideId);
  await mkdir(guideDir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: guideDir, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  await mockDashboardApi(page);
  page.__guideScript = [];
  await page.goto(`${dashboardUrl}${routePath}`, { waitUntil: 'domcontentloaded' });
  await installTrainingOverlay(page);
  await page.waitForTimeout(1200);
  recordGuideStep(page, 'Start on the exact operational screen for this guide.', 'intro', 1800);
  await setTrainingOverlay(page, { x: 260, y: 150, label: 'Start on the exact operational screen for this guide.' });
  await page.screenshot({ path: path.join(guideDir, 'screen-01.png'), fullPage: false });
  let shotIndex = await runDashboardWalkthrough(page, guideId, guideDir, 2);

  for (let i = 0; i < actions.length; i += 1) {
    await actions[i](page);
    await page.waitForTimeout(700);
    shotIndex = await screenshotStep(page, guideDir, shotIndex);
  }

  const recording = await saveRecording(page, context, guideDir);
  await writeFile(
    path.join(guideDir, 'manifest.json'),
    JSON.stringify({ guideId, source: 'dashboard', routePath, recording, script: page.__guideScript || [] }, null, 2),
    'utf8',
  );
}

async function captureCustomerBooking(browser) {
  const guideId = 'customer-booking-flow';
  const guideDir = path.join(outRoot, guideId);
  await mkdir(guideDir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: guideDir, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  await mockCustomerApi(page);
  page.__guideScript = [];
  await page.goto(customerUrl, { waitUntil: 'domcontentloaded' });
  await installTrainingOverlay(page);
  await page.waitForTimeout(1200);
  recordGuideStep(page, 'Start at the customer site and move from browsing to request submission.', 'intro', 1800);
  await setTrainingOverlay(page, { x: 260, y: 190, label: 'Start at the customer site and move from browsing to request submission.' });
  await page.screenshot({ path: path.join(guideDir, 'screen-01-home.png'), fullPage: false });

  await page.locator('#fleet').scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(500);
  const card = page.getByTestId('vehicle-card').first();
  if (await card.isVisible().catch(() => false)) {
    await clickHighlighted(page, card, 'Select the vehicle card from the live fleet.');
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(guideDir, 'screen-02-vehicle-card.png'), fullPage: false });
  }

  const viewDetails = page.getByRole('button', { name: /view details/i });
  if (await viewDetails.isVisible().catch(() => false)) {
    await clickHighlighted(page, viewDetails, 'Open vehicle details before requesting dates.');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(guideDir, 'screen-03-detail.png'), fullPage: false });
  }

  const form = page.getByTestId('request-booking-form');
  if (await form.isVisible().catch(() => false)) {
    await highlightLocator(page, form, 'Use the booking form on the vehicle detail page.');
    const dateButtons = form.locator('button[aria-label^="Select"]:not([disabled])');
    const dateCount = await dateButtons.count().catch(() => 0);
    if (dateCount >= 2) {
      await clickHighlighted(page, dateButtons.nth(Math.min(3, dateCount - 2)), 'Pick the pickup date.');
      await clickHighlighted(page, dateButtons.nth(Math.min(8, dateCount - 1)), 'Pick the return date.');
      await page.screenshot({ path: path.join(guideDir, 'screen-04-dates.png'), fullPage: false });
    }

    await clickHighlighted(page, form.getByRole('button', { name: /continue/i }), 'Continue after dates are selected.');
    await clickHighlighted(page, form.getByRole('button', { name: /continue/i }), 'Confirm pickup or delivery details.');
    const tolls = form.getByRole('button', { name: /unlimited tolls/i });
    if (await tolls.isVisible().catch(() => false)) {
      await clickHighlighted(page, tolls, 'Optional add-ons are selected here.');
    }
    await clickHighlighted(page, form.getByRole('button', { name: /continue/i }), 'Continue to customer details.');

    await fillHighlighted(page, form.getByLabel(/first name/i), 'Taylor', 'Enter the customer first name.');
    await fillHighlighted(page, form.getByLabel(/last name/i), 'Driver', 'Enter the customer last name.');
    await fillHighlighted(page, form.getByLabel(/mobile phone/i), '(555) 010-0100', 'Enter the mobile phone for updates.');
    await fillHighlighted(page, form.getByLabel(/email address/i), 'taylor@example.com', 'Enter the customer email for confirmation.');
    await page.screenshot({ path: path.join(guideDir, 'screen-05-details.png'), fullPage: false });

    await clickHighlighted(page, form.getByRole('button', { name: /continue/i }), 'Review the request before submitting.');
    await page.screenshot({ path: path.join(guideDir, 'screen-06-review.png'), fullPage: false });
    await clickHighlighted(page, form.getByRole('button', { name: /request availability/i }), 'Submit the booking request.');
    await page.waitForURL(/\/confirm\?ref=TEST-BOOKING-001/, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1600);
    await setTrainingOverlay(page, { x: 760, y: 420, label: 'The customer lands in the confirmation flow with the booking code.' });
    await page.screenshot({ path: path.join(guideDir, 'screen-07-confirmation.png'), fullPage: false });
  }

  const recording = await saveRecording(page, context, guideDir);
  await writeFile(
    path.join(guideDir, 'manifest.json'),
    JSON.stringify({ guideId, source: 'customer', routePath: '/', recording, script: page.__guideScript || [] }, null, 2),
    'utf8',
  );
}

async function captureCustomerVerificationGate(browser) {
  const guideId = 'customer-verification-approval-gate';
  const guideDir = path.join(outRoot, guideId);
  await mkdir(guideDir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: guideDir, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  await mockCustomerApi(page, { status: 'pending_approval', alreadySigned: false, customerDefaults: false });
  page.__guideScript = [];
  await page.goto(`${customerUrl}/confirm?ref=TEST-BOOKING-001`, { waitUntil: 'domcontentloaded' });
  await installTrainingOverlay(page);
  await page.waitForTimeout(1400);

  let shotIndex = 1;
  await highlightLocator(page, page.getByText(/Complete Your Booking|TEST-BOOKING-001/i).first(), 'The confirmation link opens the customer verification wizard for this booking code.', 2300);
  shotIndex = await screenshotStep(page, guideDir, shotIndex);

  await clickHighlighted(page, page.getByRole('button', { name: /continue/i }).first(), 'Start with the rental summary and continue only if the booking code, dates, vehicle, and total look right.');
  await highlightLocator(page, page.getByText(/Scan your license/i).first(), 'The customer scans the license barcode when possible, or uses manual entry if camera scan is unavailable.', 2400);
  shotIndex = await screenshotStep(page, guideDir, shotIndex);
  await clickHighlighted(page, page.getByRole('button', { name: /enter details manually/i }).first(), 'Manual entry is the fallback when scanning is not available.');

  await fillHighlighted(page, page.locator('input[placeholder="123 Main St"]').first(), '100 Ocean Blvd', 'Enter the legal street address.');
  await fillHighlighted(page, page.locator('input[placeholder="Myrtle Beach"]').first(), 'Myrtle Beach', 'Enter city.');
  await highlightLocator(page, page.locator('select').first(), 'Select the customer state.', 700);
  await page.locator('select').first().selectOption('SC').catch(() => {});
  await fillHighlighted(page, page.locator('input[type="date"]').first(), '1990-01-01', 'Enter date of birth for verification.');
  shotIndex = await screenshotStep(page, guideDir, shotIndex);
  await clickHighlighted(page, page.getByRole('button', { name: /continue/i }).first(), 'Continue after address and date of birth are complete.');

  await fillHighlighted(page, page.locator('input[placeholder*="S530"]').first(), 'D1234567', 'Enter the driver license number.');
  await highlightLocator(page, page.locator('select').first(), 'Select the issuing state.', 700);
  await page.locator('select').first().selectOption('SC').catch(() => {});
  await fillHighlighted(page, page.locator('input[type="date"]').first(), '2028-01-01', 'Enter license expiration.');
  await highlightLocator(page, page.getByText(/License Photos/i).first(), 'License photos are optional, but they speed up admin verification and pickup.', 1900);
  shotIndex = await screenshotStep(page, guideDir, shotIndex);
  await clickHighlighted(page, page.getByRole('button', { name: /continue/i }).first(), 'Continue after license fields are complete.');

  await clickHighlighted(page, page.getByRole('button', { name: /read full terms/i }).first(), 'Open and read the full terms before accepting.');
  await page.evaluate(() => {
    const panels = [...document.querySelectorAll('div')];
    const scrollPanel = panels.find((el) => el.textContent?.includes('End of Terms') && el.scrollHeight > el.clientHeight);
    if (scrollPanel) {
      scrollPanel.scrollTop = scrollPanel.scrollHeight;
      scrollPanel.dispatchEvent(new Event('scroll', { bubbles: true }));
    }
  }).catch(() => {});
  await page.waitForTimeout(500);
  await clickHighlighted(page, page.getByText(/I have read and agree/i).first(), 'Accept terms only after scrolling to the end.');
  shotIndex = await screenshotStep(page, guideDir, shotIndex);
  await clickHighlighted(page, page.getByRole('button', { name: /continue/i }).first(), 'Continue after terms are accepted.');

  const ackLabels = page.locator('label');
  const ackCount = await ackLabels.count().catch(() => 0);
  for (let index = 0; index < ackCount; index += 1) {
    await ackLabels.nth(index).click({ timeout: 1200 }).catch(() => {});
    await page.waitForTimeout(120);
  }
  await highlightLocator(page, page.getByText(/Acknowledgements/i).first(), 'Every acknowledgement must be checked before the signature step.', 2200);
  shotIndex = await screenshotStep(page, guideDir, shotIndex);
  await clickHighlighted(page, page.getByRole('button', { name: /continue/i }).first(), 'Continue after all acknowledgements are checked.');

  await clickHighlighted(page, page.getByRole('button', { name: /type/i }).first(), 'Typed signature is available when drawing is not ideal.');
  await fillHighlighted(page, page.getByPlaceholder(/type your full legal name/i), 'Taylor Driver', 'Type the customer legal signature.');
  shotIndex = await screenshotStep(page, guideDir, shotIndex);
  await clickHighlighted(page, page.getByRole('button', { name: /continue to insurance/i }).first(), 'Continue to insurance after signature is saved.');

  await clickHighlighted(page, page.getByRole('button', { name: /I have my own insurance/i }).first(), 'Choose personal insurance or Bonzah coverage before review.');
  await fillHighlighted(page, page.getByPlaceholder(/State Farm/i).first(), 'Palmetto Mutual', 'Enter insurance company.');
  await fillHighlighted(page, page.getByPlaceholder(/POL-123456/i).first(), 'PM-778812', 'Enter policy number.');
  await fillHighlighted(page, page.locator('input[type="date"]').first(), '2026-09-01', 'Enter policy expiration.');
  shotIndex = await screenshotStep(page, guideDir, shotIndex);
  await clickHighlighted(page, page.getByRole('button', { name: /continue to review/i }).first(), 'Continue to review; payment is still gated by approval.');

  await highlightLocator(page, page.getByText(/Review your booking/i).first(), 'Review the itemized package before submitting for approval.', 2200);
  shotIndex = await screenshotStep(page, guideDir, shotIndex);
  await clickHighlighted(page, page.getByRole('button', { name: /submit for approval/i }).first(), 'Submit the completed package for admin approval.');
  await page.waitForTimeout(2200);
  await highlightLocator(page, page.getByText(/Awaiting Approval/i).first(), 'The customer waits here until admin approval unlocks payment.', 3000);
  shotIndex = await screenshotStep(page, guideDir, shotIndex);

  const recording = await saveRecording(page, context, guideDir);
  await writeFile(
    path.join(guideDir, 'manifest.json'),
    JSON.stringify({ guideId, source: 'customer', routePath: '/confirm?ref=TEST-BOOKING-001', recording, script: page.__guideScript || [] }, null, 2),
    'utf8',
  );
}

async function captureCustomerPaymentAfterApproval(browser) {
  const guideId = 'customer-payment-after-approval';
  const guideDir = path.join(outRoot, guideId);
  await mkdir(guideDir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: guideDir, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  await mockCustomerApi(page, { status: 'approved', alreadySigned: true, customerDefaults: true });
  page.__guideScript = [];
  await page.goto(`${customerUrl}/confirm?code=TEST-BOOKING-001`, { waitUntil: 'domcontentloaded' });
  await installTrainingOverlay(page);
  await page.waitForTimeout(1800);

  let shotIndex = 1;
  await highlightLocator(page, page.getByText(/Your booking is approved/i).first(), 'After admin approval, the confirmation link unlocks receipt review and payment.', 2600);
  shotIndex = await screenshotStep(page, guideDir, shotIndex);
  await highlightLocator(page, page.getByText(/Rental total|Itemized|deposit|total/i).first(), 'Review rental total, insurance, deposit, dates, vehicle, and booking code before charging.', 2600);
  shotIndex = await screenshotStep(page, guideDir, shotIndex);
  await highlightLocator(page, page.getByRole('button', { name: /continue to payment/i }).first(), 'The customer continues to the secure payment form only after approval.', 2400);
  shotIndex = await screenshotStep(page, guideDir, shotIndex);
  await clickHighlighted(page, page.getByRole('button', { name: /continue to payment/i }).first(), 'Open payment form.');
  await page.waitForTimeout(2200);
  await highlightLocator(page, page.locator('form, iframe, [class*="Payment"], [class*="payment"]').first(), 'Payment is now the provider step. If this fails, check payment provider and webhooks before retrying.', 3000);
  shotIndex = await screenshotStep(page, guideDir, shotIndex);

  const recording = await saveRecording(page, context, guideDir);
  await writeFile(
    path.join(guideDir, 'manifest.json'),
    JSON.stringify({ guideId, source: 'customer', routePath: '/confirm?code=TEST-BOOKING-001', recording, script: page.__guideScript || [] }, null, 2),
    'utf8',
  );
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const dashboardReachable = await isReachable(dashboardUrl);
  const customerReachable = await isReachable(customerUrl);

  if (customerReachable) {
    await captureCustomerBooking(browser);
    await captureCustomerVerificationGate(browser);
    await captureCustomerPaymentAfterApproval(browser);
  } else {
    console.warn(`Skipping customer capture: ${customerUrl} is not reachable.`);
  }

  if (dashboardReachable) {
    await captureDashboardGuide(browser, 'admin-approval-payment-unlock', '/bookings/booking-e2e-1', [
      async (page) => {
        const approve = page.getByRole('button', { name: /^approve$/i }).first();
        if (await approve.isVisible().catch(() => false)) {
          await clickHighlighted(page, approve, 'Open Review & approve after checking the submitted customer package.');
        }
      },
      async (page) => {
        await highlightLocator(page, page.getByText(/Review & approve booking|Itemized receipt|High-risk customer/i).first(), 'Set high-risk and deposit only when the customer package supports the decision.', 2600);
      },
      async (page) => {
        const approveNotify = page.getByRole('button', { name: /approve & notify customer/i }).first();
        if (await approveNotify.isVisible().catch(() => false)) {
          await clickHighlighted(page, approveNotify, 'Approve and notify customer. This unlocks payment; it does not mark the booking paid.');
        }
      },
      async (page) => {
        await highlightLocator(page, page.getByText(/Approved|customer notified|Payment link/i).first(), 'After approval, copy the payment link only after confirming the customer and booking code.', 3000);
      },
    ]);
    await captureDashboardGuide(browser, 'booking-queue', '/bookings', [
      async (page) => {
        const row = page.getByText(/E2E-BOOKING-001|Taylor|Camry/i).first();
        await highlightLocator(page, row, 'Review customer, vehicle, dates, and status before opening a record.');
      },
    ]);
    await captureDashboardGuide(browser, 'booking-lifecycle', '/bookings/booking-e2e-1', [
      async (page) => {
        const heading = page.getByText(/E2E-BOOKING-001|Taylor|Camry/i).first();
        await highlightLocator(page, heading, 'Booking detail is the source of truth for pickup, return, money, and documents.');
      },
      async (page) => {
        const approve = page.getByRole('button', { name: /approve/i }).first();
        if (await approve.isVisible().catch(() => false)) await clickHighlighted(page, approve, 'Approve only after operational blockers are clear.');
      },
    ]);
    await captureDashboardGuide(browser, 'fleet-availability', '/fleet', [
      async (page) => highlightLocator(page, page.getByText(/CAM-001|Toyota|available/i).first(), 'Check status, pricing, visibility, and blocked dates before selling availability.'),
    ]);
    await captureDashboardGuide(browser, 'payments-deposits-refunds', '/payments', [
      async (page) => highlightLocator(page, page.getByText(/payment|deposit|refund|unpaid/i).first(), 'Open the booking before any charge, refund, or deposit action.'),
      async (page) => {
        const copyLink = page.getByRole('button', { name: /copy link/i }).first();
        if (await copyLink.isVisible().catch(() => false)) await clickHighlighted(page, copyLink, 'Copying a payment link records a money action in the audit trail.');
      },
    ]);
    await captureDashboardGuide(browser, 'calendar-checkins', '/check-ins', [
      async (page) => highlightLocator(page, page.getByText(/pickup|return|today|active/i).first(), 'Use Check-Ins to clear pickup and return blockers for today.'),
      async (page) => {
        const dueReturn = page.getByText(/RETURN-DUE|OVERDUE|SETTLE/i).first();
        if (await dueReturn.isVisible().catch(() => false)) await clickHighlighted(page, dueReturn, 'Open the exact rental before recording return or settlement work.');
      },
    ]);
    await captureDashboardGuide(browser, 'insurance-review', '/insurance', [
      async (page) => highlightLocator(page, page.getByText(/insurance|policy|coverage/i).first(), 'Insurance is a pickup gate; approve only clean coverage.'),
      async (page) => {
        const failedFilter = page.getByRole('button', { name: /bind failed/i }).first();
        if (await failedFilter.isVisible().catch(() => false)) await clickHighlighted(page, failedFilter, 'Filtering bind failures isolates policies that need reconciliation before pickup.');
      },
    ]);
    await captureDashboardGuide(browser, 'customers-portal-long-term', '/portal', [
      async (page) => highlightLocator(page, page.getByText(/Taylor|customer|portal/i).first(), 'Search first so support work stays tied to the existing customer record.'),
    ]);
    await captureDashboardGuide(browser, 'messaging-notifications', '/messaging', [
      async (page) => highlightLocator(page, page.getByText(/message|notification|template/i).first(), 'Send one clear action from the related booking or customer context.'),
    ]);
    await captureDashboardGuide(browser, 'revenue-reporting', '/revenue', [
      async (page) => highlightLocator(page, page.getByText(/revenue|total|vehicle/i).first(), 'Use revenue screens to turn performance signals into pricing or fleet decisions.'),
    ]);
    await captureDashboardGuide(browser, 'system-health', '/settings', [
      async (page) => highlightLocator(page, page.getByText(/webhook|payment|notification|settings/i).first(), 'Use system health when normal workflows do not behave as expected.'),
      async (page) => {
        const refresh = page.getByRole('button', { name: /refresh|check/i }).first();
        if (await refresh.isVisible().catch(() => false)) await clickHighlighted(page, refresh, 'Refresh diagnostics before retrying a failed operational workflow.');
      },
    ]);
  } else {
    console.warn(`Skipping dashboard capture: ${dashboardUrl} is not reachable.`);
  }

  await browser.close();
  console.log(`Real UI captures written to ${outRoot}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
