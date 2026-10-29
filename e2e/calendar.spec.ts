import { expect, test, type Page } from '@playwright/test';
import { companyPage, expectToast, openCompany, openDemo } from './support';

type Call = { tool: string; input: Record<string, unknown> };
const calls = (page: Page) =>
  page.evaluate(() => (window as never as { __calendarCalls: Call[] }).__calendarCalls);
const created = async (page: Page) =>
  (await calls(page)).filter((c) => c.tool === 'create_event').map((c) => c.input);
const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

test('a new upcoming interview goes on the calendar as it is added', async ({ page }) => {
  await openDemo(page, [], {});
  await openCompany(page, 'loyalkaspar');
  const panel = companyPage(page);
  await expect(panel.locator('#meet-calendar')).toBeChecked();
  await panel.getByRole('button', { name: 'Interview', exact: true }).click();
  await panel.locator('#meet-date').fill(inDays(5));
  await panel.locator('#meet-start').fill('12:30');
  await panel.locator('#meet-with').fill('Alex');
  await panel.locator('#meet-with').press('Enter');
  await expectToast(page, 'Added to Google Calendar');
  await expect(panel.getByRole('link', { name: 'On your Google Calendar ↗' })).toBeVisible();
  expect(await created(page)).toEqual([
    {
      summary: 'Interview: loyalkaspar',
      description: 'With Alex\nAdded by Reacher',
      startTime: `${inDays(5)}T12:30:00`,
      endTime: `${inDays(5)}T13:00:00`,
    },
  ]);
});

test('switched off, it adds only when asked, from the entry', async ({ page }) => {
  await openDemo(page, [], {});
  await openCompany(page, 'Buck');
  const panel = companyPage(page);
  await panel.locator('#meet-calendar').uncheck();
  await panel.locator('#meet-date').fill(inDays(2));
  await panel.locator('#meet-with').press('Enter');
  await expect(panel.getByRole('button', { name: 'Add to Google Calendar' })).toBeVisible();
  expect(await created(page)).toEqual([]);
  await panel.getByRole('button', { name: 'Add to Google Calendar' }).click();
  await expect(panel.getByRole('link', { name: 'On your Google Calendar ↗' })).toBeVisible();
  expect(await created(page)).toHaveLength(1);
  await page.reload();
  await openCompany(page, 'Buck');
  await expect(panel.locator('#meet-calendar')).not.toBeChecked();
});

test('calendar events about the company can be added to Meetings', async ({ page }) => {
  await openDemo(page, [], {
    events: [
      { title: 'Coffee chat with Buck', inDays: 3, start: '10:00' },
      { title: 'Dentist', inDays: 4 },
    ],
  });
  await openCompany(page, 'Buck');
  const panel = companyPage(page);
  await expect(panel.getByText('Coffee chat with Buck')).toBeVisible();
  await expect(panel.getByText('Dentist')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Add to Meetings' }).click();
  await expectToast(page, 'Added to Meetings');
  await expect(panel.getByRole('button', { name: 'Add to Meetings' })).toHaveCount(0);
  await expect(panel.getByRole('link', { name: 'On your Google Calendar ↗' })).toBeVisible();
  await openCompany(page, 'Psyop');
  await expect(panel.getByText('Coffee chat with Buck')).toHaveCount(0);
});

test('before the OK, the page offers to allow Google Calendar', async ({ page }) => {
  await openDemo(page, [], {
    askFirst: true,
    events: [{ title: 'Interview with Buck', inDays: 6, start: '15:00' }],
  });
  await openCompany(page, 'Buck');
  const panel = companyPage(page);
  await panel.getByRole('button', { name: 'Allow Google Calendar' }).click();
  await expect(panel.getByText('Interview with Buck')).toBeVisible();
});

test('a quick update with an upcoming interview adds it to the calendar', async ({ page }) => {
  await openDemo(
    page,
    [
      {
        match: 'You update a job seeker',
        json: {
          confirm: false,
          reply: 'ok',
          actions: [
            {
              type: 'add_meeting',
              company: 'Psyop',
              date: inDays(9),
              start: '09:00',
              end: '',
              kind: 'interview',
              with: '',
              notes: '',
            },
          ],
        },
      },
    ],
    {},
  );
  await page.fill('#quick-input', 'Interview with Psyop next week at 9');
  await page.press('#quick-input', 'Enter');
  await expectToast(page, 'Added to Google Calendar: Psyop');
  expect((await created(page))[0]).toMatchObject({ summary: 'Interview: Psyop' });
});

test('outside Claude, the template link stays', async ({ page }) => {
  await openDemo(page);
  await openCompany(page, 'Imaginary Forces');
  const panel = companyPage(page);
  await expect(panel.locator('#meet-calendar')).toHaveCount(0);
  await expect(panel.getByRole('link', { name: 'Add to Google Calendar' }).first()).toHaveAttribute(
    'href',
    /calendar\.google\.com\/calendar\/render/,
  );
});
