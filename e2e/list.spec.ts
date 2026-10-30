import { expect, test } from '@playwright/test';
import { expectToast, field, openDemo, panel, row, stageCell } from './support';

test.beforeEach(async ({ page }) => {
  await openDemo(page);
});

test('old statuses arrive as stages', async ({ page }) => {
  await expect(stageCell(page, 'Psyop', 'Outreach')).toHaveText('Sent');
  await expect(stageCell(page, 'loyalkaspar', 'Outreach')).toHaveText('Reply');
  await expect(stageCell(page, 'MSG Networks', 'Application')).toHaveText('Sent');
  await expect(field(page, 'Imaginary Forces', 'Outcome')).toHaveValue('Hopeful');
});

test('add a company; duplicates are caught', async ({ page }) => {
  await page.fill('#new-company', 'Sibling Rivalry');
  await page.press('#new-company', 'Enter');
  await expect(row(page, 'Sibling Rivalry')).toBeVisible();
  await page.fill('#new-company', 'buck');
  await page.press('#new-company', 'Enter');
  await expectToast(page, 'Buck is already on the list');
});

test('a stage cell selects; the panel changes its status', async ({ page }) => {
  await stageCell(page, 'Gretel', 'Outreach').click();
  await expect(stageCell(page, 'Gretel', 'Outreach')).toHaveAttribute('aria-selected', 'true');
  await expect(panel(page).getByText('Gretel').first()).toBeVisible();
  await panel(page).getByRole('button', { name: 'Outreach status' }).click();
  await page.getByRole('menuitemradio', { name: /^Reply/ }).click();
  await expect(stageCell(page, 'Gretel', 'Outreach')).toHaveText('Reply');
  // The change is in the feed.
  await expect(panel(page).getByText('Outreach: none → Reply')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Outreach status' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(panel(page)).toHaveCount(0);
});

test('fields edit in place; abbreviations expand', async ({ page }) => {
  const city = field(page, 'Buck', 'City');
  await city.fill('LA');
  await city.press('Enter');
  await expect(city).toHaveValue('Los Angeles');
  const priority = field(page, 'Gretel', 'Priority');
  await priority.selectOption('Dream');
  await page.reload();
  await expect(field(page, 'Buck', 'City')).toHaveValue('Los Angeles');
  await expect(field(page, 'Gretel', 'Priority')).toHaveValue('Dream');
});

test('search: words, abbreviations, stage=status, status=any', async ({ page }) => {
  await field(page, 'Buck', 'City').fill('Los Angeles');
  await field(page, 'Buck', 'City').press('Enter');
  const search = page.locator('#sheet-search');
  await search.fill('LA');
  await expect(row(page, 'Buck')).toBeVisible();
  await expect(row(page, 'Psyop')).toHaveCount(0);
  await search.fill('outreach=reply');
  await expect(row(page, 'loyalkaspar')).toBeVisible();
  await expect(row(page, 'Psyop')).toHaveCount(0);
  await search.fill('status=sent');
  await expect(row(page, 'Psyop')).toBeVisible();
  await expect(row(page, 'MSG Networks')).toBeVisible();
  await expect(row(page, 'Gretel')).toHaveCount(0);
  // Saved searches come back as chips.
  await page.getByRole('button', { name: 'Save this search' }).click();
  await search.fill('');
  await page.getByRole('button', { name: 'status=sent', exact: true }).click();
  await expect(search).toHaveValue('status=sent');
});

test('add a field, hide one, sort by name', async ({ page }) => {
  await page.getByRole('button', { name: 'Add a field' }).click();
  await page.fill('#field-name', 'Salary');
  await page.selectOption('#field-type', 'number');
  await page.getByRole('button', { name: 'Add field' }).click();
  await expect(field(page, 'Buck', 'Salary')).toBeVisible();
  await page.getByRole('button', { name: 'Display' }).click();
  await page.getByRole('checkbox', { name: 'City', exact: true }).uncheck();
  await page.keyboard.press('Escape');
  await expect(field(page, 'Buck', 'City')).toHaveCount(0);
  await page.getByRole('button', { name: 'Company', exact: true }).click();
  const names = await page.locator('tbody tr button[title^="Open"]').allTextContents();
  expect(names).toEqual([...names].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
});

test('changes survive a reload', async ({ page }) => {
  await page.fill('#new-company', 'Oddfellows');
  await page.press('#new-company', 'Enter');
  await expect(row(page, 'Oddfellows')).toBeVisible();
  await page.reload();
  await expect(row(page, 'Oddfellows')).toBeVisible();
});
