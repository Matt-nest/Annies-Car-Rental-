import { expect, type Locator, type Page, test } from '@playwright/test';

const vehicle = {
  id: 'test-altima',
  vin: 'TESTVIN1234567890',
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
  image: '/favicon.svg',
  images: ['/favicon.svg'],
  heroImage: '/favicon.svg',
  sideImage: null,
  rearImage: null,
  description: 'Reliable midsize sedan for local and rideshare rental use.',
  features: ['Apple CarPlay', 'Backup Camera', 'Bluetooth'],
  included: ['200 miles per day included', 'Professionally cleaned before each rental'],
};

function ymdFromToday(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function mockCatalog(page: Page) {
  await page.route('**/vehicles/catalog', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([vehicle]),
    });
  });
}

async function openFirstVehicleDetail(page: Page): Promise<Locator> {
  await mockCatalog(page);
  await page.goto('/');
  await expect(page.getByTestId('vehicle-card').first()).toBeVisible();
  await page.getByTestId('vehicle-card').first().click();

  const viewDetails = page.getByRole('button', { name: /view details & request/i });
  if (await viewDetails.isVisible().catch(() => false)) {
    await viewDetails.click();
  }

  await expect(page).toHaveURL(/\/detail\?vin=/);
  const forms = page.getByTestId('request-booking-form');
  const formCount = await forms.count();
  for (let i = 0; i < formCount; i += 1) {
    const candidate = forms.nth(i);
    if (await candidate.isVisible().catch(() => false)) {
      return candidate;
    }
  }

  const viewport = page.viewportSize();
  if (!viewport || viewport.width >= 1024) {
    await expect(forms.first()).toBeVisible();
    return forms.first();
  }

  const dialog = page.getByRole('dialog', { name: /book this vehicle/i });
  if (!await dialog.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /book now/i }).click();
  }
  const dialogForm = dialog.getByTestId('request-booking-form');
  await expect(dialogForm).toBeVisible();
  return dialogForm;
}

test('vehicle detail page exposes the booking request wizard', async ({ page }) => {
  const bookingForm = await openFirstVehicleDetail(page);

  await expect(bookingForm.getByRole('heading', { name: /when do you need it/i })).toBeVisible();
  await expect(bookingForm.getByText(/step 1 of 5/i)).toBeVisible();
  await bookingForm.getByRole('button', { name: /^continue/i }).click();
  await expect(bookingForm.getByText('Select a start date to continue.')).toBeVisible();
});

test('customer can submit a booking request through the wizard with mocked API', async ({ page }) => {
  const bookingForm = await openFirstVehicleDetail(page);

  let submittedPayload: any;
  await page.route('**/bookings', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    submittedPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ booking_code: 'TEST-BOOKING-001' }),
    });
  });

  await bookingForm.getByLabel(`Select ${ymdFromToday(1)}`).click();
  await bookingForm.getByLabel(`Select ${ymdFromToday(3)}`).click();
  await bookingForm.getByRole('button', { name: /^continue/i }).click();

  await expect(bookingForm.getByRole('heading', { name: /pickup & delivery/i })).toBeVisible();
  await bookingForm.getByRole('button', { name: /^continue/i }).click();

  await expect(bookingForm.getByRole('heading', { name: /optional add-ons/i })).toBeVisible();
  await bookingForm.getByRole('button', { name: /^continue/i }).click();

  await expect(bookingForm.getByRole('heading', { name: /your details/i })).toBeVisible();
  await bookingForm.getByLabel(/first name/i).fill('Test');
  await bookingForm.getByLabel(/last name/i).fill('Driver');
  await bookingForm.getByLabel(/mobile phone/i).fill('(772) 555-0100');
  await bookingForm.getByLabel(/email address/i).fill('test.driver@example.com');
  await bookingForm.getByRole('button', { name: /^continue/i }).click();

  await expect(bookingForm.getByRole('heading', { name: /review your request/i })).toBeVisible();
  await bookingForm.getByRole('button', { name: /request availability/i }).click();

  await expect(page).toHaveURL(/\/confirm\?ref=TEST-BOOKING-001/);
  expect(submittedPayload).toMatchObject({
    first_name: 'Test',
    last_name: 'Driver',
    phone: '(772) 555-0100',
    email: 'test.driver@example.com',
    vehicle_code: 'test-altima',
    source: 'website',
  });
});
