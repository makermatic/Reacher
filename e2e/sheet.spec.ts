import { expect, test } from '@playwright/test';
import { openDemo, row, expectToast } from './support';

test.beforeEach(async ({ page }) => {
  await openDemo(page);
});

test('add a company; duplicates are caught', async ({ page }) => {
  await page.fill('#new-company', 'Sibling Rivalry');
  await page.press('#new-company', 'Enter');
  await expect(row(page, 'Sibling Rivalry')).toBeVisible();
  await page.fill('#new-company', 'buck');
  await page.press('#new-company', 'Enter');
  await expectToast(page, 'Buck is already on the list');
});

test('status picker: type to filter, Enter picks; Outcome shows at Meeting', async ({ page }) => {
  const gretel = row(page, 'Gretel');
  await gretel.locator('button.schip').first().click();
  await page.keyboard.type('meet');
  await page.keyboard.press('Enter');
  await expect(gretel.locator('button.schip').first()).toHaveText(/Meeting/);
  await expect(gretel.locator('button.schip')).toHaveCount(2);
});

test('text editor opens on top of the value, text lined up', async ({ page }) => {
  const cell = row(page, 'Buck').locator('button[aria-label^="Edit City"]');
  const c = (await cell.boundingBox())!;
  await cell.click();
  const input = page.locator('[data-radix-popper-content-wrapper] input').first();
  const i = (await input.boundingBox())!;
  expect(Math.abs(i.x - c.x)).toBeLessThan(4);
  expect(Math.abs(i.y - c.y)).toBeLessThan(4);
  await input.fill('Chicago');
  await page.keyboard.press('Enter');
  await expect(cell).toHaveText('Chicago');
});

test('search expands abbreviations; Needs me filters', async ({ page }) => {
  const count = page.getByText(/\d+ of \d+ companies/);
  await expect(count).toHaveText(/6 of 6/);
  const city = row(page, 'Buck').locator('button[aria-label^="Edit City"]');
  await city.click();
  await page.locator('[data-radix-popper-content-wrapper] input').first().fill('Los Angeles');
  await page.keyboard.press('Enter');
  await page.fill('#sheet-search', 'LA');
  await expect(row(page, 'Buck')).toBeVisible();
  await expect(row(page, 'Psyop')).toHaveCount(0);
  await page.fill('#sheet-search', 'NYC');
  await expect(row(page, 'Psyop')).toBeVisible();
  await expect(row(page, 'Buck')).toHaveCount(0);
  await page.fill('#sheet-search', '');
  await page.getByRole('button', { name: 'Needs me', exact: true }).click();
  await expect(count).not.toHaveText(/6 of 6/);
});

test('changes survive a reload', async ({ page }) => {
  await page.fill('#new-company', 'Oddfellows');
  await page.press('#new-company', 'Enter');
  await expect(row(page, 'Oddfellows')).toBeVisible();
  await page.reload();
  await expect(row(page, 'Oddfellows')).toBeVisible();
});

test('header keeps one line with the company page open', async ({ page }) => {
  await page.locator('button[title="Open Psyop"]').click();
  const header = page.locator('header').first();
  expect((await header.boundingBox())!.height).toBeLessThan(48);
  await expect(page.getByRole('button', { name: 'Email templates' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Your details' })).toBeVisible();
});
