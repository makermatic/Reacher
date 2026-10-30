import { expect, test } from '@playwright/test';
import { expectToast, openDemo, panel, stageCell } from './support';

test.beforeEach(async ({ page }) => {
  await openDemo(page);
});

test('Ctrl-click selects several cells; one status for all', async ({ page }) => {
  await stageCell(page, 'Buck', 'Outreach').click();
  await stageCell(page, 'Gretel', 'Outreach').click({ modifiers: ['Control'] });
  await expect(panel(page).getByText('2 selected', { exact: true })).toBeVisible();
  await panel(page).getByRole('button', { name: 'New status' }).click();
  await page.getByRole('menuitemradio', { name: /^Sent/ }).click();
  await panel(page).getByLabel('Comment for all').fill('Sent the batch');
  await panel(page)
    .getByRole('button', { name: /Change status for the 2 selected/ })
    .click();
  await expectToast(page, '2 updated');
  await expect(stageCell(page, 'Buck', 'Outreach')).toHaveText('Sent');
  await expect(stageCell(page, 'Gretel', 'Outreach')).toHaveText('Sent');
});

test('Shift-click selects a range', async ({ page }) => {
  await stageCell(page, 'Buck', 'Outreach').click();
  await stageCell(page, 'Buck', 'Interview').click({ modifiers: ['Shift'] });
  await expect(panel(page).getByText('4 selected', { exact: true })).toBeVisible();
});

test('the panel switches stage and keeps a feed', async ({ page }) => {
  await stageCell(page, 'Psyop', 'Outreach').click();
  const p = panel(page);
  await p.getByRole('tab', { name: /Application/ }).click();
  await expect(stageCell(page, 'Psyop', 'Application')).toHaveAttribute('aria-selected', 'true');
  await p.getByRole('button', { name: 'Application status' }).click();
  await page.getByRole('menuitemradio', { name: /^Sent/ }).click();
  await expect(p.getByText('Application: none → Sent')).toBeVisible();
  await p.getByRole('button', { name: 'Close the panel' }).click();
  await expect(p).toHaveCount(0);
});

test('a row can be deleted after a second click', async ({ page }) => {
  await page.locator('tr', { hasText: 'Gretel' }).hover();
  await page.getByRole('button', { name: 'Delete Gretel' }).click();
  await page.getByRole('button', { name: 'Delete company' }).click();
  await page.getByRole('button', { name: 'Click again to delete' }).click();
  await expect(page.locator('tr', { hasText: 'Gretel' })).toHaveCount(0);
});
