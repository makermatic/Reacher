import { expect, test } from '@playwright/test';
import { companyPage, drag, openCompany, openDemo, expectToast } from './support';

test.beforeEach(async ({ page }) => {
  await openDemo(page);
});

test('opens and closes: same name, Escape, click outside', async ({ page }) => {
  const panel = companyPage(page);
  await openCompany(page, 'Buck');
  await expect(panel).toBeVisible();
  await openCompany(page, 'Buck');
  await expect(panel).toHaveCount(0);
  await openCompany(page, 'Buck');
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await openCompany(page, 'Buck');
  await page.mouse.click(100, 760);
  await expect(panel).toHaveCount(0);
});

test('the name is plain text you type into: Enter saves, Escape reverts', async ({ page }) => {
  await openCompany(page, 'Buck');
  const name = companyPage(page).getByLabel('Rename company');
  await name.click();
  expect(await name.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('none');
  await page.keyboard.press('End');
  await page.keyboard.type(' Design');
  await page.keyboard.press('Enter');
  await expect(name).toHaveValue('Buck Design');
  await name.click();
  await page.keyboard.type(' XYZ');
  await page.keyboard.press('Escape');
  await expect(name).toHaveValue('Buck Design');
  await expect(companyPage(page)).toBeVisible();
});

test('an email from them moves status to Wrote back!! and clears the follow-up', async ({
  page,
}) => {
  await openCompany(page, 'Psyop');
  const panel = companyPage(page);
  await panel.getByLabel('Email text').first().fill('Thanks for reaching out! Send your reel?');
  await panel.getByRole('button', { name: 'Add email' }).first().click();
  await expect(panel.locator('button.schip').first()).toHaveText(/Wrote back/);
  await expect(panel.locator('#follow-up')).toHaveValue('');
});

test('notes add with Enter; delete asks first', async ({ page }) => {
  await openCompany(page, 'Psyop');
  const panel = companyPage(page);
  await panel.locator('#note-text').fill('Staffing up in January.');
  await panel.locator('#note-text').press('Enter');
  const entry = panel.getByText('Staffing up in January.');
  await expect(entry).toBeVisible();
  const del = panel.getByRole('button', { name: /^Delete note/ }).first();
  await del.click();
  await expect(panel.getByText('Delete?')).toBeVisible();
  await panel.getByText('Delete?').click();
  await expect(entry).toHaveCount(0);
});

test('an upcoming interview sets Interview and offers a calendar link', async ({ page }) => {
  await openCompany(page, 'loyalkaspar');
  const panel = companyPage(page);
  await panel.getByRole('button', { name: 'Interview', exact: true }).click();
  await panel.locator('#meet-date').fill('2030-11-06');
  await panel.locator('#meet-start').fill('12:30');
  await panel.locator('#meet-with').fill('Alex');
  await panel.locator('#meet-with').press('Enter');
  await expect(panel.locator('button.schip').first()).toHaveText(/Interview/);
  await expectToast(page, 'Interview');
  const href = await panel.getByRole('link', { name: 'Add to Google Calendar' }).first();
  await expect(href).toHaveAttribute('href', /calendar\.google\.com/);
});

test('sections reorder by dragging the header row, and it sticks', async ({ page }) => {
  await openCompany(page, 'Buck');
  const panel = companyPage(page);
  for (const t of ['Details', 'Email chains'])
    await panel
      .getByRole('button', { name: new RegExp(`^${t}`) })
      .first()
      .click();
  const order = () =>
    panel.locator('section[aria-label]').evaluateAll((els) => els.map((e) => e.ariaLabel));
  await expect
    .poll(order)
    .toEqual(['Details', 'Email chains', 'Notes', 'Applications', 'Meetings & interviews']);
  const heads = panel.locator('[title="Drag to reorder"]');
  await drag(page, heads.nth(2), heads.nth(0), 4);
  await expect
    .poll(order)
    .toEqual(['Notes', 'Details', 'Email chains', 'Applications', 'Meetings & interviews']);
  await page.reload();
  await openCompany(page, 'Buck');
  await expect
    .poll(order)
    .toEqual(['Notes', 'Details', 'Email chains', 'Applications', 'Meetings & interviews']);
});
