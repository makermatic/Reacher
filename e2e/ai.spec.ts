import { expect, test, type Page } from '@playwright/test';
import { companyPage, openCompany, openDemo, row, type Reply } from './support';

const QUICK = 'You update a job seeker';
const LOOKUP = 'adding a company';

const replies: Reply[] = [
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
        { type: 'set_status', company: 'Buck', column: 'Status', value: 'Interview' },
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
  await expect(row(page, 'Buck').locator('button.schip').first()).toHaveText(/Interview/);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(row(page, 'Buck').locator('button.schip').first()).not.toHaveText(/Interview/);
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

test('an unclear new company opens its page and asks there', async ({ page }) => {
  await page.fill('#new-company', 'big star');
  await page.press('#new-company', 'Enter');
  const panel = companyPage(page);
  await expect(panel.getByText('Which “big star” did you mean?')).toBeVisible();
  await panel.getByRole('button', { name: /^BigStar/ }).click();
  await expect(panel.getByText('Filled in BigStar')).toBeVisible();
  await expect(row(page, 'BigStar').locator('button[aria-label^="Edit City"]')).toHaveText(
    'New York',
  );
});

test('a lookup from the page shows its progress on the page', async ({ page }) => {
  await openCompany(page, 'Buck');
  const panel = companyPage(page);
  await panel.getByRole('button', { name: 'Look up company details' }).click();
  await expect(panel.locator('.ai-working')).toContainText('Looking up Buck');
  await expect(panel.getByText(/Couldn't find a media company/)).toBeVisible();
});

test('summarize shows three lines', async ({ page }) => {
  await openCompany(page, 'Psyop');
  const panel = companyPage(page);
  await panel.getByRole('button', { name: 'Summarize' }).click();
  await expect(panel.locator('.ai-working')).toHaveCount(1);
  await expect(panel.getByText('Where it stands: x')).toBeVisible();
});
