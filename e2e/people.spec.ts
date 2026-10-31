import { expect, test, type Page } from '@playwright/test';
import { expectToast, openDemo, settings } from './support';

const person = (page: Page) => page.locator('aside[aria-label="Person panel"]');
const toPeople = (page: Page) => page.getByRole('button', { name: 'Show people' }).click();

test.beforeEach(async ({ page }) => {
  await openDemo(page);
});

test('Main contacts become people; a person has a status, notes and a company', async ({
  page,
}) => {
  await toPeople(page);
  const rows = page.locator('main tbody tr:not(.add-row)');
  await expect(rows).toHaveCount(3);
  await expect(page.getByRole('cell', { name: 'Status for Sam Example' })).toHaveText(
    /Good to contact/,
  );
  await page.locator('button[title="Open Sam Example"]').click();
  const p = person(page);
  await expect(p.getByLabel('Role for Sam Example', { exact: true })).toHaveValue('Recruiter');
  // Thumbs down, with a note, on Post.
  await p.getByLabel('Comment').fill('Left the industry');
  await p.getByRole('button', { name: 'Status', exact: true }).click();
  await page.getByRole('menuitemradio', { name: /Don’t contact/ }).click();
  await p.getByRole('button', { name: 'Post' }).click();
  await expect(page.getByRole('cell', { name: 'Status for Sam Example' })).toHaveText(
    /Don’t contact/,
  );
  await expect(p.getByRole('feed').getByText('Left the industry')).toBeVisible();
  // Moves to another company; the old one is remembered.
  await p.getByRole('button', { name: 'Company for Sam Example' }).click();
  await page.getByLabel('Find a company').fill('buck');
  await page.getByRole('menuitemradio', { name: 'Buck' }).click();
  await expect(p.getByText(/Before: Psyop/)).toBeVisible();
  await expect(p.getByRole('feed').getByText('Moved from Psyop to Buck')).toBeVisible();
});

test('add people from the list and from a company; the board shows their company', async ({
  page,
}) => {
  await page.locator('button[title="Open Gretel"]').click();
  const c = page.locator('aside[aria-label="Company panel"]');
  await c.getByLabel('Add someone at Gretel').fill('Fred Smith');
  await c.getByLabel('Add someone at Gretel').press('Enter');
  await c.getByRole('button', { name: /Fred Smith/ }).click();
  await expect(person(page).getByLabel('Rename person')).toHaveValue('Fred Smith');
  await toPeople(page);
  await page.fill('#new-person', 'Ana Ruiz');
  await page.getByLabel('At company').selectOption({ label: 'Psyop' });
  await page.press('#new-person', 'Enter');
  await expectToast(page, 'Added Ana Ruiz');
  await expect(page.getByRole('button', { name: 'Company for Ana Ruiz' })).toHaveText('Psyop');
  await page.getByRole('button', { name: 'Board', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Ana Ruiz\. Select/ })).toContainText('Psyop');
  await expect(page.getByRole('button', { name: /^Fred Smith\. Select/ })).toContainText('Gretel');
});

test('People statuses are editable in Status types', async ({ page }) => {
  await settings(page, 'Status types');
  await page.fill('#new-person-status', 'Warm');
  await page.getByRole('button', { name: 'Add', exact: true }).last().click();
  await expectToast(page, 'Added Warm');
  await page.getByRole('button', { name: 'Back to companies' }).click();
  await toPeople(page);
  await page.locator('button[title="Open Alex Sample"]').click();
  await person(page).getByRole('button', { name: 'Status', exact: true }).click();
  await expect(page.getByRole('menuitemradio', { name: /Warm/ })).toBeVisible();
});

test('the list toggle: the list on screen is pressed', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Show companies' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await toPeople(page);
  await expect(page.getByRole('button', { name: 'Show people' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Sprint', exact: true })).toHaveText(/All/);
});

test('a company note that names someone goes to them too; their emails are theirs', async ({
  page,
}) => {
  await page.locator('button[title="Open Psyop"]').click();
  const c = page.locator('aside[aria-label="Company panel"]');
  await c.getByLabel('Comment').fill('Sam liked the reel');
  await c.getByRole('button', { name: 'Post' }).click();
  // Tagged with Sam on the company; in Sam's feed too.
  await c.getByRole('feed').getByRole('button', { name: 'Sam Example' }).click();
  const p = person(page);
  await expect(p.getByRole('feed').getByText('Sam liked the reel')).toBeVisible();
  await expect(p.getByRole('feed').getByText('on Psyop’s page')).toBeVisible();
  // A chain started with Sam is in Sam's Emails.
  await p.getByRole('button', { name: '+ New chain with Sam' }).click();
  await expect(p.getByLabel('Rename chain')).toHaveValue(/Email with Sam/);
});
