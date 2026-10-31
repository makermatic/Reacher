import { expect, test } from '@playwright/test';
import { openDemo, panel, statusCell } from './support';

/** Applications (Zack, round 5): the third list, from the dropdown by the sprint. */
test.beforeEach(async ({ page }) => {
  await openDemo(page);
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Applications' }).click();
});

test('every application, editable in place; add one from the last row', async ({ page }) => {
  const list = page.getByRole('region', { name: 'Applications' });
  await expect(list.getByLabel('Role at MSG Networks')).toHaveValue('Broadcast Graphics Designer');
  await expect(list.getByText('1 application')).toBeVisible();
  // Edit the result in place.
  await list.getByLabel('Result at MSG Networks').fill('Rejected');
  await list.getByLabel('Result at MSG Networks').press('Enter');
  await expect(list.getByLabel('Result at MSG Networks')).toHaveValue('Rejected');
  // Add one: pick a company you have, then the role.
  await page.fill('#new-application', 'Gre');
  await page.getByRole('listbox', { name: 'Companies you have' }).getByText('Gretel').click();
  await page.fill('#new-application-role', 'Designer');
  await page.press('#new-application-role', 'Enter');
  await expect(page.getByText(/Application to Gretel added/)).toBeVisible();
  await expect(list.getByLabel('Role at Gretel')).toHaveValue('Designer');
  await expect(list.getByText('2 applications')).toBeVisible();
  // It's on Gretel's page too, and the company click opens its panel.
  await list.locator('button[title="Open Gretel"]').click();
  await expect(panel(page)).toBeVisible();
  await expect(panel(page).getByText('Designer', { exact: true })).toBeVisible();
  // Back on Companies, Gretel's status moved to Applied.
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Companies' }).click();
  await expect(statusCell(page, 'Gretel')).toHaveText('Applied');
});
