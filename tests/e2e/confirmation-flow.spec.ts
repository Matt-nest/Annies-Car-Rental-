import { expect, Page, test } from '@playwright/test';

const bookingCode = 'TEST-CONFIRM-001';

const draft = {
  _v: 5,
  stage: 4,
  subStep: 1,
  address: { line1: '123 Test Ave', city: 'Port St. Lucie', state: 'FL', zip: '34952' },
  dob: '1990-01-01',
  license: { number: 'D1234567', state: 'FL', expiry: '2028-01-01' },
  termsAccepted: true,
  acknowledgements: [true, true, true],
  signature: { mode: 'type', data: 'Test Driver' },
  personalInsurance: { company: '', policyNumber: '', expiry: '', agentName: '', agentPhone: '', vehicleDescription: '' },
  insuranceChoice: 'own',
  bonzahTierId: null,
  bonzahQuote: null,
  licensePhotoPaths: [],
  licenseScanMetadata: null,
  completedStages: [1, 2, 3],
};

const bookingSummary = {
  vehicle: 'Toyota Camry',
  pickupDate: '2026-08-01',
  returnDate: '2026-08-08',
  rentalDays: 7,
  dailyRate: 80,
  subtotal: 560,
  deliveryFee: 0,
  discountAmount: 0,
  taxAmount: 0,
  totalCost: 560,
  depositAmount: 500,
  customerName: 'Test Driver',
  customerEmail: 'test.driver@example.com',
};

async function seedPaymentStage(page: Page) {
  await page.addInitScript(({ code, savedDraft }) => {
    window.sessionStorage.setItem(`wizard_${code}`, JSON.stringify(savedDraft));
  }, { code: bookingCode, savedDraft: draft });
}

async function mockConfirmationApis(page: Page, status: 'pending_approval' | 'approved') {
  async function fulfillJson(route: any, body: unknown) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  }

  await page.route(`**/agreements/${bookingCode}`, async (route) => {
    await fulfillJson(route, {
      alreadySigned: true,
      autoFilled: { depositAmount: 500, pickupTime: '09:00', returnTime: '09:00', deliveryType: 'pickup' },
      customerDefaults: {},
      prefilledSteps: ['scan'],
    });
  });

  await page.route(`**/square/booking-summary/${bookingCode}`, async (route) => {
    await fulfillJson(route, {
      alreadyPaid: false,
      booking: bookingSummary,
    });
  });

  await page.route(`**/bookings/status/${bookingCode}`, async (route) => {
    await fulfillJson(route, { status });
  });

  await page.route('**/*', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith(`/agreements/${bookingCode}`)) {
      await fulfillJson(route, {
        alreadySigned: true,
        autoFilled: { depositAmount: 500, pickupTime: '09:00', returnTime: '09:00', deliveryType: 'pickup' },
        customerDefaults: {},
        prefilledSteps: ['scan'],
      });
      return;
    }
    if (path.endsWith(`/square/booking-summary/${bookingCode}`)) {
      await fulfillJson(route, {
        alreadyPaid: false,
        booking: bookingSummary,
      });
      return;
    }
    if (path.endsWith(`/bookings/status/${bookingCode}`)) {
      await fulfillJson(route, { status });
      return;
    }
    await route.continue();
  });
}

test.beforeEach(async ({ page }) => {
  await seedPaymentStage(page);
});

test('pending confirmation stays gated before payment', async ({ page }) => {
  await mockConfirmationApis(page, 'pending_approval');
  await page.goto(`/confirm?ref=${bookingCode}`);

  await expect(page.getByRole('heading', { name: 'Awaiting Approval' })).toBeVisible();
  await expect(page.getByText(bookingCode).first()).toBeVisible();
  await expect(page.getByText(/complete payment/i)).toBeVisible();
});

test('approved confirmation unlocks receipt and payment CTA', async ({ page }) => {
  await mockConfirmationApis(page, 'approved');
  await page.goto(`/confirm?ref=${bookingCode}`);

  await expect(page.getByRole('heading', { name: 'Your booking is approved' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Order Summary' })).toBeVisible();
  await expect(page.getByText('Toyota Camry')).toBeVisible();
  await expect(page.getByText('Total Charge Today')).toBeVisible();
  await expect(page.getByRole('button', { name: /continue to payment/i })).toBeVisible();
});
