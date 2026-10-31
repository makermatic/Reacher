import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { expectToast, field, openDemo, settings, statusCell } from './support';

/** Import CSV lives in Settings → Import & export (Zack, M11 round 1). */
const openImporter = async (page: Page) => {
  await settings(page, 'Settings');
  await page.getByRole('button', { name: 'Import & export' }).click();
  await page.getByRole('button', { name: 'Import CSV' }).click();
};
const backToList = (page: Page) => page.getByRole('button', { name: 'Back to companies' }).click();

const CSV = [
  'Studio,Name,Title,Email,Stage,Website',
  'Oddfellows,Ana Ruiz,Producer,ana@oddfellows.tv,Emailed,oddfellows.tv',
  'Psyop,Sam Example,Recruiter,sam@psyop.com,Wrote back,',
  'Oddfellows,Ben Lee,EP,ben@oddfellows.tv,,',
  ',Nobody,,,,',
].join('\n');

test.beforeEach(async ({ page }) => {
  await openDemo(page);
});

test('CSV import: columns matched, existing companies found, then imported', async ({ page }) => {
  await openImporter(page);
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('tab', { name: 'Paste' }).click();
  await dialog.locator('#csv-paste').fill(CSV);
  await dialog.getByRole('button', { name: 'Preview' }).click();

  // Every column got a sensible match from its header or contents.
  await expect(dialog.getByLabel('Column Studio')).toHaveValue('company');
  await expect(dialog.getByLabel('Column Name')).toHaveValue('person:contact:name');
  await expect(dialog.getByLabel('Column Title')).toHaveValue('person:contact:role');
  await expect(dialog.getByLabel('Column Email')).toHaveValue('person:contact:email');
  await expect(dialog.getByLabel('Column Stage')).toHaveValue('status');
  await expect(dialog.getByLabel('Column Website')).toHaveValue('col:website');

  // Psyop is already on the list: skipped unless updating.
  const rows = dialog.locator('tbody tr');
  await expect(rows.nth(1)).toContainText('On your list');
  await expect(rows.nth(2)).toContainText('Same as line 2');
  await expect(rows.nth(3)).toContainText('No company name');
  await expect(dialog.getByText(/Adds 1 new company/)).toBeVisible();
  await dialog.getByLabel('Update companies you already have').check();
  await expect(rows.nth(1)).toContainText('Updates');

  // Ignore a column, then import.
  await dialog.getByLabel('Column Website').selectOption('ignore');
  await dialog.getByRole('button', { name: 'Import', exact: true }).click();
  await expectToast(page, 'Added 1 company and 2 people, updated 1');
  await backToList(page);
  await expect(page.locator('main tr:not(.person-row)', { hasText: 'Oddfellows' })).toBeVisible();
  await expect(statusCell(page, 'Oddfellows')).toHaveText('Reached out');
  await expect(statusCell(page, 'Psyop')).toHaveText(/Wrote back/);
  await expect(field(page, 'Oddfellows', 'Main contact')).toContainText('Ana Ruiz');
});

test('CSV import from a file, with no company column picked', async ({ page }) => {
  await openImporter(page);
  await page.locator('#csv-file').setInputFiles({
    name: 'list.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Who,Mail,Color\nAna,ana@x.co,blue\n'),
  });
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/Pick which column is the company name/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Import', exact: true })).toBeDisabled();
  await dialog.getByLabel('Column Who').selectOption('company');
  await dialog.getByLabel('Column Color').selectOption('new');
  await dialog.getByRole('button', { name: 'Import', exact: true }).click();
  await expectToast(page, 'Added 1 company');
  await backToList(page);
  await expect(page.locator('main tr:not(.person-row)', { hasText: 'Ana' })).toBeVisible();
  // The new field is there, with the value (in Details; star it to show it on the sheet).
  await page.locator('button[title="Open Ana"]').click();
  await expect(
    page.locator('aside[aria-label="Company panel"]').getByLabel('Color for Ana', { exact: true }),
  ).toHaveValue('blue');
});
