import { expect, test, type Page } from '@playwright/test';
import { companyPage, expectToast, openCompany, openDemo, type FakeGmail } from './support';

const THREADS: FakeGmail['threads'] = [
  {
    id: 'g1',
    subject: 'Intro to Sam',
    messages: [
      {
        from: 'Zack <zack@gmail.com>',
        to: 'sam@example.com',
        daysAgo: 6,
        text: 'Hi Sam, following up on my reel.',
        sent: true,
      },
      {
        from: 'Sam Example <sam@example.com>',
        to: 'zack@gmail.com',
        daysAgo: 1,
        text: 'Thanks Zack! Can you send your rates?\n\nOn Mon, Zack wrote:\n> Hi Sam',
      },
    ],
  },
  {
    id: 'g2',
    subject: 'Motion designer role',
    messages: [
      { from: 'jo@buck.co', to: 'zack@gmail.com', daysAgo: 2, text: 'Are you free to chat?' },
    ],
  },
  {
    id: 'g3',
    subject: 'Your order shipped',
    messages: [{ from: 'shop@store.com', to: 'zack@gmail.com', daysAgo: 1, text: 'On its way.' }],
  },
];

type Call = { tool: string; input: Record<string, unknown> };
const calls = (page: Page) =>
  page.evaluate(() => (window as never as { __gmailCalls: Call[] }).__gmailCalls);

test('before the OK: the page offers Check Gmail, and replies come in', async ({ page }) => {
  await openDemo(page, [], undefined, { threads: THREADS });
  await openCompany(page, 'Psyop');
  const panel = companyPage(page);
  await panel.getByRole('button', { name: 'Check Gmail' }).click();
  await expectToast(page, 'Psyop: 2 new emails from Gmail. Status → Wrote back!!');
  await expect(panel.locator('button.schip').first()).toHaveText(/Wrote back/);
  await expect(panel.getByText('Thanks Zack! Can you send your rates?')).toBeVisible();
  // The quoted older email is cut off.
  await expect(panel.getByText('> Hi Sam')).toHaveCount(0);
  await expect(panel.getByRole('link', { name: 'Gmail ↗' })).toHaveAttribute(
    'href',
    /mail\.google\.com/,
  );
  await expect(panel.getByText(/Checked just now/)).toBeVisible();
  // Checking again adds nothing.
  await panel.getByRole('button', { name: 'Check now' }).click();
  await expect(panel.getByText('Thanks Zack! Can you send your rates?')).toHaveCount(1);
  // Each thread is fetched once: g1 is known, the others aren't Psyop's.
  expect((await calls(page)).filter((c) => c.tool === 'get_thread')).toHaveLength(3);
});

test('once allowed, opening Reacher checks every company', async ({ page }) => {
  await openDemo(page, [], undefined, { threads: THREADS, allowed: true });
  await page.reload();
  await expectToast(page, 'Psyop: 2 new emails from Gmail');
  await expectToast(page, 'Buck: 1 new email from Gmail');
  const search = (await calls(page)).find((c) => c.tool === 'search_threads')!;
  expect(search.input.query).toContain('from:psyop.com');
  await openCompany(page, 'Buck');
  await expect(companyPage(page).getByLabel('Rename chain')).toHaveValue('Motion designer role');
  await expect(page.getByText('On its way.')).toHaveCount(0);
});

test('a deleted Gmail email or chain stays deleted', async ({ page }) => {
  await openDemo(page, [], undefined, { threads: THREADS, allowed: true });
  await openCompany(page, 'Buck');
  const panel = companyPage(page);
  // Allowed already: opening the page checks by itself.
  await expect(panel.getByLabel('Rename chain')).toHaveValue('Motion designer role');
  await panel.getByRole('button', { name: 'Chain options' }).click();
  await page.getByRole('button', { name: 'Delete this chain' }).click();
  await page.getByRole('button', { name: 'Click again to delete' }).click();
  await expect(panel.getByLabel('Rename chain')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Check now' }).click();
  await expect(panel.getByText(/Checked just now/)).toBeVisible();
  await expect(panel.getByLabel('Rename chain')).toHaveCount(0);
});

test('a company with no website or contact email says what to add', async ({ page }) => {
  await openDemo(page, [], undefined, { threads: THREADS });
  await openCompany(page, 'MSG Networks');
  await companyPage(page).getByRole('button', { name: 'Check Gmail' }).click();
  await expect(companyPage(page).getByText(/Add a website or a contact’s email/)).toBeVisible();
});

test('Save to Gmail drafts replies in the thread, and never sends', async ({ page }) => {
  await openDemo(page, [], undefined, { threads: THREADS });
  await openCompany(page, 'Psyop');
  const panel = companyPage(page);
  await panel.getByRole('button', { name: 'Check Gmail' }).click();
  await expect(panel.getByText(/Checked just now/)).toBeVisible();
  await panel.getByRole('button', { name: 'Save to Gmail drafts' }).click();
  await expect(panel.getByText('Saved in your Gmail drafts.')).toBeVisible();
  const draft = (await calls(page)).find((c) => c.tool === 'create_draft')!;
  expect(draft.input).toMatchObject({ to: ['sam@example.com'], replyToMessageId: 'g1-m1' });
  expect((await calls(page)).map((c) => c.tool)).not.toContain('send_message');
});

test('outside Claude there is no Gmail', async ({ page }) => {
  await openDemo(page);
  await openCompany(page, 'Psyop');
  await expect(companyPage(page).getByRole('button', { name: 'Check Gmail' })).toHaveCount(0);
  await expect(companyPage(page).getByRole('button', { name: 'Save to Gmail drafts' })).toHaveCount(
    0,
  );
});
