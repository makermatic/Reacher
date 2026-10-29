import { expect, test, type Page } from '@playwright/test';
import { drag, openDemo, expectToast } from './support';

/** Card names per lane, top to bottom. */
const lane = (page: Page, name: string) =>
  page
    .locator('section[aria-label=Board] [class*="c-"]', {
      has: page.locator(`button[title="Collapse ${name}"]`),
    })
    .locator('[aria-label$="order"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')!.split('.')[0]));
const card = (page: Page, name: string) => page.locator(`[aria-label^="${name}. Open"]`);

test.beforeEach(async ({ page }) => {
  // Wide enough that no lane sits off screen (the board scrolls itself during a drag).
  await page.setViewportSize({ width: 2600, height: 900 });
  await openDemo(page);
  await page.getByRole('button', { name: 'Board', exact: true }).click();
});

test('drop on top, between, and reorder within a lane; order is saved', async ({ page }) => {
  await expect.poll(() => lane(page, 'Meeting')).toEqual(['Imaginary Forces']);
  await drag(page, card(page, 'Gretel'), card(page, 'Imaginary Forces'));
  await expectToast(page, 'Gretel → Meeting');
  await expect.poll(() => lane(page, 'Meeting')).toEqual(['Gretel', 'Imaginary Forces']);
  await drag(page, card(page, 'Buck'), card(page, 'Imaginary Forces'));
  await expect.poll(() => lane(page, 'Meeting')).toEqual(['Gretel', 'Buck', 'Imaginary Forces']);
  await drag(page, card(page, 'Imaginary Forces'), card(page, 'Gretel'));
  await expect.poll(() => lane(page, 'Meeting')).toEqual(['Imaginary Forces', 'Gretel', 'Buck']);
  await page.reload();
  await expect.poll(() => lane(page, 'Meeting')).toEqual(['Imaginary Forces', 'Gretel', 'Buck']);
});

test('a click opens the card; lanes collapse and stay collapsed', async ({ page }) => {
  await card(page, 'Buck').click();
  await expect(page.locator('aside[aria-label="Company page"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('button[title="Collapse Rejected"]').click();
  await expect(page.locator('button[title="Show Rejected"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('button[title="Show Rejected"]')).toBeVisible();
});
