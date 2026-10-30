import { expect, test, type Page } from '@playwright/test';
import { drag, expectToast, openDemo, stageCell } from './support';

/** Card names per lane, top to bottom. */
const lane = (page: Page, label: string) =>
  page
    .locator('section[aria-label=Board]')
    .getByRole('group', { name: label, exact: true })
    .locator('[aria-label$="order"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')!.split('.')[0]));
const card = (page: Page, name: string) => page.locator(`[aria-label^="${name}. Select"]`);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 2400, height: 900 });
  await openDemo(page);
  await page.getByRole('button', { name: 'Board', exact: true }).click();
});

test('lanes are statuses of one stage; drop between cards; order is saved', async ({ page }) => {
  await expect.poll(() => lane(page, 'Sent')).toEqual(['Psyop']);
  await drag(page, card(page, 'Buck'), card(page, 'Psyop'));
  await expectToast(page, 'Buck · Outreach → Sent');
  await expect.poll(() => lane(page, 'Sent')).toEqual(['Buck', 'Psyop']);
  await drag(page, card(page, 'Gretel'), card(page, 'Psyop'));
  await expect.poll(() => lane(page, 'Sent')).toEqual(['Buck', 'Gretel', 'Psyop']);
  await drag(page, card(page, 'Psyop'), card(page, 'Buck'));
  await expect.poll(() => lane(page, 'Sent')).toEqual(['Psyop', 'Buck', 'Gretel']);
  await page.reload();
  await expect.poll(() => lane(page, 'Sent')).toEqual(['Psyop', 'Buck', 'Gretel']);
  await page.getByRole('button', { name: 'Sheet', exact: true }).click();
  await expect(stageCell(page, 'Gretel', 'Outreach')).toHaveText('Sent');
});

test('another stage, and a click selects the card', async ({ page }) => {
  await page.getByRole('button', { name: 'Stage' }).click();
  await page.getByRole('menuitemradio', { name: 'Application' }).click();
  await expect.poll(() => lane(page, 'Sent')).toEqual(['MSG Networks']);
  await card(page, 'MSG Networks').click();
  await expect(
    page.locator('aside[aria-label="Company panel"]').getByText('MSG Networks').first(),
  ).toBeVisible();
});
