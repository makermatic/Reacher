import { expect, test } from '@playwright/test';
import { main, openTab, openDemo, expectToast, settings } from './support';

test.beforeEach(async ({ page }) => {
  await openDemo(page, [
    {
      match: 'Write the next email',
      json: { subject: 'Hello from Zack', body: 'Hi Fred,\n\nAI draft.\n\nZack' },
    },
  ]);
});

test('the writer picks the template and chain from the status', async ({ page }) => {
  await openTab(page, 'Psyop', 'Emails');
  const panel = main(page);
  await expect(panel.locator('#compose-target option:checked')).toHaveText(/^Reply in:/);
  await expect(panel.locator('#compose-template option:checked')).toHaveText(
    'Check-in (no reply yet)',
  );
  await openTab(page, 'Gretel', 'Emails');
  await expect(panel.locator('#compose-template option:checked')).toHaveText('First outreach');
});

test('To saves the contact and fills their name; Log as sent moves status', async ({ page }) => {
  await openTab(page, 'Gretel', 'Emails');
  const panel = main(page);
  await panel.locator('#compose-to').fill('fred.smith@gretel.ny');
  await panel.locator('#compose-to').press('Enter');
  await expectToast(page, 'Saved to Main contact: Fred Smith');
  await expect(panel.locator('#compose-body')).toHaveValue(/^Hi Fred,/);
  await panel.getByRole('button', { name: 'Draft with AI' }).click();
  await expect(panel.locator('#compose-subject')).toHaveValue('Hello from Zack');
  await panel.getByRole('button', { name: 'Log as sent' }).click();
  await expectToast(page, 'Outreach → Sent');
});

test('templates: # opens the field menu, typing narrows it, Enter fills in', async ({ page }) => {
  await settings(page, 'Email templates');
  const body = page.locator('#tpl-body');
  const menu = page.getByRole('listbox', { name: 'Fill-in fields' });
  await body.click();
  await body.press('Control+End');
  await page.keyboard.type(' C#');
  await expect(menu).toHaveCount(0);
  await page.keyboard.type('\nSee #');
  await expect(menu.getByRole('option').first()).toBeVisible();
  expect(await menu.getByRole('option').count()).toBeGreaterThan(10);
  await page.keyboard.type('por');
  await expect(menu.getByRole('option')).toHaveText(['PortfolioYou']);
  await page.keyboard.press('Enter');
  await expect(menu).toHaveCount(0);
  await expect(body).toHaveValue(/See #my_portfolio$/);
  await page.keyboard.type(' #x');
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(page.locator('#tpl-body')).toBeVisible();
  // The preview fills it in, and it's saved in the stored {{}} form.
  await expect(page.getByText('zackzand.com').last()).toBeVisible();
  await page.getByRole('button', { name: 'Save template' }).click();
  await expectToast(page, 'Template saved');
});

test('Export data saves a file', async ({ page }) => {
  await settings(page, 'Settings');
  await page.getByRole('button', { name: 'Import & export' }).click();
  await page.getByRole('button', { name: 'Export data' }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as never as { __saved: { filename: string } | null }).__saved?.filename,
      ),
    )
    .toMatch(/^reacher-.*\.json$/);
});
