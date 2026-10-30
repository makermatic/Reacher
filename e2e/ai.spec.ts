import { expect, test, type Page } from '@playwright/test';
import { field, openDemo, openPage, panel, stageCell, tab, type Reply } from './support';

const QUICK = 'You update a job seeker';
const LOOKUP = 'adding a company';

const replies: Reply[] = [
  {
    match: "written on Psyop's page",
    json: {
      confirm: false,
      reply: 'Psyop is not hiring.',
      actions: [{ type: 'set_status', company: 'Psyop', stage: 'Outreach', status: 'No' }],
    },
  },
  {
    match: 'big star',
    json: {
      sure: false,
      candidates: [
        { name: 'BigStar', about: 'Motion design studio, New York', fields: { City: 'New York' } },
        { name: 'Big Star Films', about: 'Production company, Los Angeles', fields: {} },
      ],
    },
  },
  {
    match: QUICK,
    delay: 600,
    json: {
      confirm: false,
      reply: 'Interview at Buck on Nov 6.',
      actions: [
        { type: 'set_status', company: 'Buck', stage: 'Interview', status: 'Scheduled' },
        {
          type: 'add_meeting',
          company: 'Buck',
          date: '2030-11-06',
          start: '12:30',
          end: '13:00',
          kind: 'interview',
          with: '',
          notes: '',
        },
      ],
    },
  },
  { match: LOOKUP, json: { sure: false, candidates: [] } },
  {
    match: 'Where it stands',
    text: 'Where it stands: x\nYou owe them: y\nNext step: z',
    delay: 600,
  },
];

const prompts = (page: Page) =>
  page.evaluate(() => (window as never as { __prompts: string[] }).__prompts);
const card = (page: Page) => page.locator('[data-keep-panel] [role=status]').first();

test.beforeEach(async ({ page }) => {
  await openDemo(page, replies);
});

test('quick update applies, glows while working, and undoes', async ({ page }) => {
  await page.fill('#quick-input', 'Interview with Buck 11/6 at 12:30');
  await page.press('#quick-input', 'Enter');
  await expect(page.locator('form.ai-working')).toBeVisible();
  await expect(card(page)).toContainText('Updated');
  await expect(stageCell(page, 'Buck', 'Interview')).toHaveText('Scheduled');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(stageCell(page, 'Buck', 'Interview')).not.toHaveText('Scheduled');
});

test('the same update twice adds nothing the second time', async ({ page }) => {
  for (let i = 0; i < 2; i++) {
    await page.fill('#quick-input', 'Interview with Buck 11/6 at 12:30');
    await page.press('#quick-input', 'Enter');
    await expect(page.locator('form.ai-working')).toHaveCount(0);
  }
  await expect(card(page)).toContainText('Nothing new');
});

test('the prompt carries what the tracker already has for a named company', async ({ page }) => {
  await page.fill('#quick-input', 'Interview with Buck 11/6 at 12:30');
  await page.press('#quick-input', 'Enter');
  await expect(card(page)).toContainText('Updated');
  await page.fill('#quick-input', 'Spoke to buck again');
  await page.press('#quick-input', 'Enter');
  await expect
    .poll(async () => (await prompts(page)).filter((p) => p.includes(QUICK)).length)
    .toBe(2);
  const second = (await prompts(page)).filter((p) => p.includes(QUICK))[1]!;
  expect(second).toContain('Buck so far:');
  expect(second).toContain('INTERVIEW');
});

test('a comment in the panel is an update about that company', async ({ page }) => {
  await stageCell(page, 'Psyop', 'Outreach').click();
  await panel(page).getByLabel('Comment').fill('they are not hiring');
  await panel(page).getByLabel('Comment').press('Enter');
  await expect(stageCell(page, 'Psyop', 'Outreach')).toHaveText('No');
  await expect(panel(page).getByText('they are not hiring', { exact: true })).toBeVisible();
  const p = (await prompts(page)).find((x) => x.includes(QUICK))!;
  expect(p).toContain("written on Psyop's page");
});

test('an unclear new company opens the panel and asks there', async ({ page }) => {
  await page.fill('#new-company', 'big star');
  await page.press('#new-company', 'Enter');
  await expect(panel(page).getByText('Which “big star” did you mean?')).toBeVisible();
  await panel(page)
    .getByRole('button', { name: /^BigStar/ })
    .click();
  await expect(panel(page).getByText('Filled in BigStar')).toBeVisible();
  await expect(field(page, 'BigStar', 'City')).toHaveValue('New York');
});

test('a lookup from the panel shows its progress there', async ({ page }) => {
  await stageCell(page, 'Buck', 'Outreach').click();
  await panel(page).getByRole('button', { name: 'Look up company details' }).click();
  await expect(panel(page).locator('.ai-working')).toContainText('Looking up Buck');
  await expect(panel(page).getByText(/Couldn't find a media company/)).toBeVisible();
});

test('summarize shows three lines', async ({ page }) => {
  await openPage(page, 'Psyop');
  await tab(page, 'Emails');
  await page.getByRole('button', { name: 'Summarize' }).click();
  await expect(page.locator('.ai-working')).toHaveCount(1);
  await expect(page.getByText('Where it stands: x')).toBeVisible();
});
