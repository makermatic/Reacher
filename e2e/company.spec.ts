import { expect, test } from '@playwright/test';
import { expectToast, field, openDemo, openPage, postStatus, statusCell, tab } from './support';

test.beforeEach(async ({ page }) => {
  await openDemo(page);
});

test('the company page: rename, status by sprint, fields', async ({ page }) => {
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

test('an email from them sets Wrote back!! and clears the follow-up', async ({ page }) => {
  await openPage(page, 'Psyop');
  await tab(page, 'Emails');
  await page.getByLabel('Email text').first().fill('Thanks! Can you send your reel?');
  await page.getByRole('button', { name: 'Add email' }).first().click();
  await expectToast(page, 'Status → Wrote back!!');
  await page.getByRole('button', { name: 'Back to companies' }).click();
  await expect(statusCell(page, 'Psyop')).toHaveText(/Wrote back!!/);
});

test('an interview sets Interview', async ({ page }) => {
  await openPage(page, 'loyalkaspar');
  await tab(page, 'Meetings');
  await page.getByRole('button', { name: 'Interview', exact: true }).click();
  await page.locator('#meet-date').fill('2030-11-06');
  await page.locator('#meet-start').fill('12:30');
  await page.locator('#meet-with').fill('Alex');
  await page.locator('#meet-with').press('Enter');
  await expectToast(page, 'Status → Interview');
  await page.getByRole('button', { name: 'Back to companies' }).click();
  await expect(statusCell(page, 'loyalkaspar')).toHaveText('Interview');
});

test('an application sets Applied', async ({ page }) => {
  await openPage(page, 'Buck');
  await tab(page, 'Applications');
  await page.locator('#app-role').fill('Motion Designer');
  await page.locator('#app-role').press('Enter');
  await expectToast(page, 'Status → Applied');
});

test('the timeline shows what happened', async ({ page }) => {
  await statusCell(page, 'Gretel').click();
  await postStatus(page, 'Reached out');
  await expect(statusCell(page, 'Gretel')).toHaveText('Reached out');
  await openPage(page, 'Gretel');
  await expect(
    page.getByRole('complementary', { name: 'Timeline' }).getByText('Status: none → Reached out'),
  ).toBeVisible();
});

test('meetings, applications and emails can be edited after adding (M7g)', async ({ page }) => {
  await statusCell(page, 'Imaginary Forces').click();
  const p = page.locator('aside[aria-label="Company panel"]');
  await p.getByRole('button', { name: 'Edit meeting' }).first().click();
  await p.getByLabel('With whom').first().fill('Jo, design director');
  await p.getByRole('button', { name: 'Save', exact: true }).click();
  await expectToast(page, 'Saved');
  await expect(p.getByText('with Jo, design director')).toBeVisible();
  // An application.
  await p.locator('#app-role').fill('Animator');
  await p.locator('#app-role').press('Enter');
  await p.getByRole('button', { name: 'Edit application' }).click();
  await p.getByLabel('Result').first().fill('Phone screen');
  await p.getByRole('button', { name: 'Save', exact: true }).click();
  await expectToast(page, 'Application saved');
  await expect(p.getByText('Phone screen')).toBeVisible();
  // An email in a chain.
  await statusCell(page, 'Psyop').click();
  await p.getByRole('button', { name: 'Edit email' }).first().click();
  await p.getByLabel('Edit email text').fill('Hi Sam, edited.');
  await p.getByRole('button', { name: 'Save', exact: true }).click();
  await expectToast(page, 'Email saved');
  await expect(p.getByText('Hi Sam, edited.')).toBeVisible();
});
