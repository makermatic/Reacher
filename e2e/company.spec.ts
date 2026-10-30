import { expect, test } from '@playwright/test';
import { expectToast, field, openDemo, openPage, stageCell, tab } from './support';

test.beforeEach(async ({ page }) => {
  await openDemo(page);
});

test('the company page: rename, stages table, fields', async ({ page }) => {
  await openPage(page, 'Buck');
  const name = page.getByLabel('Rename company');
  await name.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Design');
  await page.keyboard.press('Enter');
  await expect(name).toHaveValue('Buck Design');
  await expect(page.getByRole('cell', { name: 'Latest' })).toBeVisible();
  await field(page, 'Buck Design', 'Role I want').fill('Animator');
  await field(page, 'Buck Design', 'Role I want').press('Enter');
  await page.getByRole('button', { name: 'Back to companies' }).click();
  await expect(field(page, 'Buck Design', 'Role I want')).toHaveValue('Animator');
});

test('an email from them puts Outreach at Reply and clears the follow-up', async ({ page }) => {
  await openPage(page, 'Psyop');
  await tab(page, 'Emails');
  await page.getByLabel('Email text').first().fill('Thanks! Can you send your reel?');
  await page.getByRole('button', { name: 'Add email' }).first().click();
  await expectToast(page, 'Outreach → Reply');
  await page.getByRole('button', { name: 'Back to companies' }).click();
  await expect(stageCell(page, 'Psyop', 'Outreach')).toHaveText('Reply');
});

test('an upcoming interview puts Interview at Scheduled; an application at Sent', async ({
  page,
}) => {
  await openPage(page, 'loyalkaspar');
  await tab(page, 'Meetings');
  await page.getByRole('button', { name: 'Interview', exact: true }).click();
  await page.locator('#meet-date').fill('2030-11-06');
  await page.locator('#meet-start').fill('12:30');
  await page.locator('#meet-with').fill('Alex');
  await page.locator('#meet-with').press('Enter');
  await expectToast(page, 'Interview → Scheduled');
  await tab(page, 'Applications');
  await page.locator('#app-role').fill('Motion Designer');
  await page.locator('#app-role').press('Enter');
  await expectToast(page, 'Application → Sent');
  await page.getByRole('button', { name: 'Back to companies' }).click();
  await expect(stageCell(page, 'loyalkaspar', 'Interview')).toHaveText('Scheduled');
  await expect(stageCell(page, 'loyalkaspar', 'Application')).toHaveText('Sent');
});

test('the timeline shows what happened', async ({ page }) => {
  await stageCell(page, 'Gretel', 'Outreach').click();
  await page.getByRole('button', { name: 'Outreach status' }).click();
  await page.getByRole('menuitemradio', { name: /^Sent/ }).click();
  await openPage(page, 'Gretel');
  await expect(
    page.getByRole('complementary', { name: 'Timeline' }).getByText('Outreach: none → Sent'),
  ).toBeVisible();
});
