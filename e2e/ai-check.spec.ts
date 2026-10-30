import { expect, test } from '@playwright/test';
import { openDemo, settings } from './support';

test('AI check runs every sample and grades it', async ({ page }) => {
  await openDemo(page, [
    { match: '"""asdf"""', json: { reply: 'What happened?', actions: [] } },
    { match: 'You update a job seeker', json: { reply: 'ok', actions: [] } },
  ]);
  await settings(page, 'AI check');
  await page.getByRole('button', { name: 'Run AI check' }).click();
  await expect(page.getByText('1 of 6 passed')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('✓ asks what you meant')).toBeVisible();
  await expect(page.getByText('✗ Interview stage Scheduled')).toBeVisible();
});
