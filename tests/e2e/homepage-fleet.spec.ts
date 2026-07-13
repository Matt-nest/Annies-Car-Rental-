import { expect, test } from '@playwright/test';

test('homepage fleet has vehicles or a conversion-safe availability recovery path', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /the fleet/i })).toBeVisible();

  const vehicleCards = page.getByTestId('vehicle-card');
  const recovery = page.getByTestId('fleet-recovery');

  await expect(vehicleCards.first().or(recovery)).toBeVisible();
  await expect(page.getByText('No vehicles match your current filters.')).toHaveCount(0);
});
