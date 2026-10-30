import { expect, test } from '@playwright/test';
import {
  expectToast,
  main,
  openDemo,
  openPage,
  postStatus,
  row,
  settings,
  statusCell,
} from './support';

test.beforeEach(async ({ page }) => {
  await openDemo(page);
});

const newSprint = async (page: import('@playwright/test').Page, name: string) => {
  await page.getByRole('button', { name: 'Sprint', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'New sprint' }).click();
  await page.fill('#new-sprint-name', name);
  await page.keyboard.press('Enter');
};

test('a new sprint is named with today’s date and starts empty', async ({ page }) => {
  await newSprint(page, 'First Light');
  const d = new Date();
  const label = `First Light ${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
  await expect(page.getByRole('button', { name: 'Sprint', exact: true })).toContainText(label);
  await expect(page.getByText(/No companies in this sprint yet/)).toBeVisible();
});

test('companies you have are suggested and join with their status', async ({ page }) => {
  await newSprint(page, 'First Light');
  await page.fill('#new-company', 'psy');
  await page.getByRole('menuitemradio', { name: /Psyop/ }).click();
  await expectToast(page, 'Added Psyop to First Light');
  await expect(statusCell(page, 'Psyop')).toHaveText('Reached out');
  await expect(row(page, 'Buck')).toHaveCount(0);
});

test('each sprint keeps its own status; All companies shows the latest', async ({ page }) => {
  await newSprint(page, 'First Light');
  await page.fill('#new-company', 'Psyop');
  await page.press('#new-company', 'Enter');
  await statusCell(page, 'Psyop').click();
  await postStatus(page, 'Rejected');
  await expect(statusCell(page, 'Psyop')).toHaveText('Rejected');
  await newSprint(page, 'Second Wind');
  await page.fill('#new-company', 'Psyop');
  await page.press('#new-company', 'Enter');
  await statusCell(page, 'Psyop').click();
  await postStatus(page, /Wrote back/);
  await expect(statusCell(page, 'Psyop')).toHaveText(/Wrote back/);
  // The first sprint still says Rejected; All says the latest.
  await page.getByRole('button', { name: 'Sprint', exact: true }).click();
  await page.getByRole('menuitemradio', { name: /^First Light/ }).click();
  await expect(statusCell(page, 'Psyop')).toHaveText('Rejected');
  await page.getByRole('button', { name: 'Sprint', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'All companies' }).click();
  await expect(statusCell(page, 'Psyop')).toHaveText(/Wrote back/);
  // A newer sprint ended the first one (an end date shows once it's a later day).
  await page.getByRole('button', { name: 'Sprint', exact: true }).click();
  await expect(page.getByRole('menuitemradio', { name: /^Second Wind .*Current$/ })).toBeVisible();
  await expect(page.getByRole('menuitemradio', { name: /^First Light [\d/]+$/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await openPage(page, 'Psyop');
  await expect(page.getByRole('cell', { name: /^First Light/ })).toBeVisible();
  await expect(page.getByRole('cell', { name: /^Second Wind/ })).toBeVisible();
});

test('News Feed and My Tasks', async ({ page }) => {
  await statusCell(page, 'Gretel').click();
  await postStatus(page, /Wrote back/);
  await expect(statusCell(page, 'Gretel')).toHaveText(/Wrote back/);
  await page.getByRole('button', { name: 'Open the menu' }).click();
  await page
    .getByRole('navigation', { name: 'Menu' })
    .getByRole('button', { name: 'News Feed' })
    .click();
  await expect(main(page).getByText('Status: none → Wrote back!!')).toBeVisible();
  // No second dropdown in the top bar.
  await expect(page.getByRole('button', { name: 'Page', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open the menu' }).click();
  await page
    .getByRole('navigation', { name: 'Menu' })
    .getByRole('button', { name: 'My Tasks' })
    .click();
  await expect(page.getByText('Reply to Gretel')).toBeVisible();
  await page.getByText('Reply to Gretel').click();
  await expect(main(page).locator('..').getByLabel('Company panel')).toBeVisible();
  await page.getByRole('tab', { name: 'Board' }).click();
  await expect(page.getByText('Reply to Gretel')).toBeVisible();
});

test('statuses are editable; light theme', async ({ page }) => {
  await settings(page, 'Settings');
  await page.getByRole('button', { name: 'Statuses' }).click();
  await page.fill('#new-status', 'Ghosted');
  await page.getByRole('button', { name: 'Add', exact: true }).first().click();
  await expectToast(page, 'Added Ghosted');
  await page.getByRole('button', { name: 'Appearance' }).click();
  await page.getByRole('radio', { name: 'Light' }).click();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
  await page.getByRole('button', { name: 'Back to companies' }).click();
  await statusCell(page, 'Buck').click();
  await postStatus(page, 'Ghosted');
  await expect(statusCell(page, 'Buck')).toHaveText('Ghosted');
});
