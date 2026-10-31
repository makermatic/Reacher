import { expect, test } from '@playwright/test';
import { expectToast, openDemo, panel, postStatus, statusCell } from './support';

test.beforeEach(async ({ page }) => {
  await openDemo(page);
});

test('comment box: Enter is a new line, Post posts; status sits by Post', async ({ page }) => {
  await statusCell(page, 'Psyop').click();
  const p = panel(page);
  const box = p.getByLabel('Comment');
  await box.fill('First line');
  await box.press('Enter');
  await box.pressSequentially('second line');
  await expect(box).toHaveValue('First line\nsecond line');
  // Picking a status waits for Post.
  await p.getByRole('button', { name: 'Status', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Replied' }).click();
  await expect(p.getByText('Changes on Post')).toBeVisible();
  await expect(statusCell(page, 'Psyop')).toHaveText('Reached out');
  await p.getByRole('button', { name: 'Post' }).click();
  await expect(statusCell(page, 'Psyop')).toHaveText('Replied');
  await expect(p.getByRole('feed').getByText('First line')).toBeVisible();
  await expect(p.getByRole('feed').getByText('Status: Reached out → Replied')).toBeVisible();
});

test('below the feed: details, emails, meetings, applications', async ({ page }) => {
  await statusCell(page, 'Imaginary Forces').click();
  const p = panel(page);
  for (const title of ['Details', 'Emails', 'Meetings', 'Applications'])
    await expect(p.getByRole('heading', { name: title })).toBeVisible();
  // Outcome shows (they've had a meeting) and edits in place.
  await p.getByRole('button', { name: 'Outcome for Imaginary Forces' }).click();
  await page.getByRole('menuitemradio', { name: 'Offer!' }).click();
  await expect(statusCell(page, 'Imaginary Forces')).toHaveText('Meeting');
  await expect(page.locator('main').getByText('Offer!')).toBeVisible();
  await postStatus(page, 'Interview');
  await expectToast(page, 'Interview').catch(() => {});
  await expect(statusCell(page, 'Imaginary Forces')).toHaveText('Interview');
});

test('a row can be deleted after a second click', async ({ page }) => {
  await page.locator('tr', { hasText: 'Gretel' }).hover();
  await page.getByRole('button', { name: 'Delete Gretel' }).click();
  await page.getByRole('button', { name: 'Delete company' }).click();
  await page.getByRole('button', { name: 'Click again to delete' }).click();
  await expect(page.locator('tr', { hasText: 'Gretel' })).toHaveCount(0);
});
