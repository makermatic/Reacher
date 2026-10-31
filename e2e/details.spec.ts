import { expect, test } from '@playwright/test';
import { expectToast, field, openDemo, settings } from './support';

test('Fill in missing details looks companies up and fills only empty fields', async ({ page }) => {
  await openDemo(page, [
    {
      match: 'adding a company',
      json: {
        sure: true,
        candidates: [
          { name: 'Official Name', about: '', fields: { Size: '50-200', City: 'Chicago' } },
        ],
      },
    },
  ]);
  await settings(page, 'Settings');
  await page.getByRole('button', { name: 'Import & export' }).click();
  await page.getByRole('button', { name: /^Look up \d+ compan/ }).click();
  await expectToast(page, 'Filled in details for');
  await page.getByRole('button', { name: 'Back to companies' }).click();
  // Names stay as typed; typed cities stay; empty fields get filled.
  await expect(page.locator('button[title="Open Buck"]')).toBeVisible();
  await expect(field(page, 'Buck', 'City')).toHaveValue('New York');
});
