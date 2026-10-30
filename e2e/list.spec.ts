import { expect, test } from '@playwright/test';
import { expectToast, field, openDemo, panel, postStatus, row, statusCell } from './support';

test.beforeEach(async ({ page }) => {
  await openDemo(page);
});

test('one Status column, with Outcome after a meeting', async ({ page }) => {
  await expect(statusCell(page, 'Psyop')).toHaveText('Reached out');
  await expect(statusCell(page, 'loyalkaspar')).toHaveText(/Wrote back!!/);
  await expect(statusCell(page, 'MSG Networks')).toHaveText('Applied');
  await expect(field(page, 'Imaginary Forces', 'Outcome')).toHaveText('Hopeful');
  await expect(field(page, 'Psyop', 'Outcome')).toHaveCount(0);
});

test('add a company: in a sprint, companies you have come first', async ({ page }) => {
  const input = page.locator('#new-company');
  const list = page.getByRole('listbox', { name: 'Companies you have' });
  // In All companies they're all on the list already: no suggestions.
  await input.fill('Gre');
  await expect(list).toHaveCount(0);
  await input.fill('buck');
  await input.press('Enter');
  await expectToast(page, 'Buck is already on the list');
  await expect(row(page, 'Buck')).toHaveCount(1);
  await input.fill('Sibling Rivalry');
  await input.press('Enter');
  await expect(row(page, 'Sibling Rivalry')).toBeVisible();
  // In a sprint: the ones not in it yet, then New company.
  await page.getByRole('button', { name: 'Sprint', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'New sprint' }).click();
  await page.fill('#new-sprint-name', 'First Light');
  await page.keyboard.press('Enter');
  await input.fill('Gre');
  await expect(list.getByRole('menuitemradio')).toHaveText([/Gretel/, 'New company “Gre”']);
  await page.keyboard.press('Escape');
  await expect(list).toHaveCount(0);
  await expect(input).toHaveValue('Gre');
  await page.keyboard.press('Escape');
  await expect(input).toHaveValue('');
  // Enter adds the company you have, never a duplicate.
  await input.fill('gre');
  await input.press('Enter');
  await expectToast(page, 'Added Gretel to First Light');
  // Clicking away clears the row.
  await input.fill('Bu');
  await expect(list).toBeVisible();
  await page.locator('#sheet-search').click();
  await expect(list).toHaveCount(0);
  await expect(input).toHaveValue('');
});

test('name and status both open the panel; status changes on Post', async ({ page }) => {
  await statusCell(page, 'Gretel').click();
  await expect(statusCell(page, 'Gretel')).toHaveAttribute('aria-selected', 'true');
  await expect(panel(page).getByText('Gretel').first()).toBeVisible();
  await postStatus(page, /Wrote back/);
  await expect(statusCell(page, 'Gretel')).toHaveText(/Wrote back!!/);
  await expect(panel(page).getByText('Status: none → Wrote back!!')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel(page)).toHaveCount(0);
  await page.locator('button[title="Open Psyop"]').click();
  await expect(panel(page).getByText('Psyop').first()).toBeVisible();
  // A click outside the panel closes it.
  await page.locator('#sheet-search').click();
  await expect(panel(page)).toHaveCount(0);
  // The full page and the panel are never open together.
  await statusCell(page, 'Psyop').click();
  await panel(page).getByRole('button', { name: 'Open the company page' }).click();
  await expect(page.getByLabel('Rename company')).toBeVisible();
  await expect(panel(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to companies' }).click();
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

test('search: words, abbreviations, status=', async ({ page }) => {
  await field(page, 'Buck', 'City').fill('Los Angeles');
  await field(page, 'Buck', 'City').press('Enter');
  const search = page.locator('#sheet-search');
  await search.fill('LA');
  await expect(row(page, 'Buck')).toBeVisible();
  await expect(row(page, 'Psyop')).toHaveCount(0);
  await search.fill('status=applied');
  await expect(row(page, 'MSG Networks')).toBeVisible();
  await expect(row(page, 'Psyop')).toHaveCount(0);
  await search.fill('status=none');
  await expect(row(page, 'Gretel')).toBeVisible();
  await expect(row(page, 'Psyop')).toHaveCount(0);
  // Saved searches come back as chips.
  await page.getByRole('button', { name: 'Save this search' }).click();
  await search.fill('');
  await page.getByRole('button', { name: 'status=none', exact: true }).click();
  await expect(search).toHaveValue('status=none');
});

test('add a field, take one off the sheet, sort by name', async ({ page }) => {
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
  const names = await page
    .locator('tbody tr button[title^="Open"]:not([aria-label])')
    .allTextContents();
  expect(names).toEqual([...names].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
});

test('star a field in the panel to show it on the sheet', async ({ page }) => {
  await expect(field(page, 'Buck', 'Website')).toHaveCount(0);
  await page.locator('button[title="Open Buck"]').click();
  const star = panel(page).getByRole('button', { name: 'Show Website on the sheet' });
  await expect(star).toHaveAttribute('aria-pressed', 'false');
  await star.click();
  await expect(star).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('main').getByLabel('Website for Buck', { exact: true })).toBeVisible();
});

test('changes survive a reload', async ({ page }) => {
  await page.fill('#new-company', 'Oddfellows');
  await page.press('#new-company', 'Enter');
  await expect(row(page, 'Oddfellows')).toBeVisible();
  await page.reload();
  await expect(row(page, 'Oddfellows')).toBeVisible();
});
