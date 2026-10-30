import { expect, test } from '@playwright/test';
import { expectToast, main, openDemo, openPage, panel, row, settings, stageCell } from './support';

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

test('companies you have are suggested and join with their stages', async ({ page }) => {
  await newSprint(page, 'First Light');
  await page.fill('#new-company', 'psy');
  await page.getByRole('menuitemradio', { name: /Psyop/ }).click();
  await expectToast(page, 'Added Psyop to First Light');
  await expect(stageCell(page, 'Psyop', 'Outreach')).toHaveText('Sent');
  await expect(row(page, 'Buck')).toHaveCount(0);
});

test('each sprint keeps its own status; All companies shows the latest', async ({ page }) => {
  await newSprint(page, 'First Light');
  await page.fill('#new-company', 'Psyop');
  await page.press('#new-company', 'Enter');
  await stageCell(page, 'Psyop', 'Outreach').click();
  await panel(page).getByRole('button', { name: 'Outreach status' }).click();
  await page.getByRole('menuitemradio', { name: /^No turned/ }).click();
  await newSprint(page, 'Second Wind');
  await page.fill('#new-company', 'Psyop');
  await page.press('#new-company', 'Enter');
  await stageCell(page, 'Psyop', 'Outreach').click();
  await panel(page).getByRole('button', { name: 'Outreach status' }).click();
  await page.getByRole('menuitemradio', { name: /^Reply/ }).click();
  await page.keyboard.press('Escape');
  // The first sprint still says No; All says the latest (Reply).
  await page.getByRole('button', { name: 'Sprint', exact: true }).click();
  await page.getByRole('menuitemradio', { name: /^First Light/ }).click();
  await expect(stageCell(page, 'Psyop', 'Outreach')).toHaveText('No');
  await page.getByRole('button', { name: 'Sprint', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'All companies' }).click();
  await expect(stageCell(page, 'Psyop', 'Outreach')).toHaveText('Reply');
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
  await stageCell(page, 'Gretel', 'Outreach').click();
  await panel(page).getByRole('button', { name: 'Outreach status' }).click();
  await page.getByRole('menuitemradio', { name: /^Reply/ }).click();
  await page.getByRole('button', { name: 'Page', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'News Feed' }).click();
  await expect(main(page).getByText('Outreach: none → Reply')).toBeVisible();
  await page.getByRole('button', { name: 'Open the menu' }).click();
  await page
    .getByRole('navigation', { name: 'Menu' })
    .getByRole('button', { name: 'My Tasks' })
    .click();
  await expect(page.getByText('Reply to Gretel (Outreach)')).toBeVisible();
  await page.getByText('Reply to Gretel (Outreach)').click();
  await expect(panel(page).getByText('Gretel').first()).toBeVisible();
  await page.getByRole('tab', { name: 'Board' }).click();
  await expect(page.getByText('Reply to Gretel (Outreach)')).toBeVisible();
});

test('stages and statuses are editable; light theme', async ({ page }) => {
  await settings(page, 'Settings');
  await page.getByRole('button', { name: 'Stages & statuses' }).click();
  await page.fill('#new-stage', 'Offer');
  await page.getByRole('button', { name: 'Add stage' }).click();
  await page.getByRole('button', { name: 'Appearance' }).click();
  await page.getByRole('radio', { name: 'Light' }).click();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
  await page.getByRole('button', { name: 'Back to companies' }).click();
  await expect(stageCell(page, 'Buck', 'Offer')).toBeVisible();
});
