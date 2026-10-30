import { expect, type Locator, type Page } from '@playwright/test';
import { resolve } from 'node:path';

export const PAGE_FILE = resolve('e2e/.out/page.html');
const DEMO = resolve('e2e/fixtures/demo-export.json');

/** A scripted AI answer: the first one whose `match` is in the prompt wins. */
export type Reply = { match: string; json?: unknown; text?: string; delay?: number };

/**
 * A stand-in Google Calendar connector. `events` are listed (dates as days
 * from today); `askFirst` makes reads fail as "not allowed yet" until one
 * call goes through, like a viewer who hasn't given the OK. Calls are kept in
 * window.__calendarCalls.
 */
export type FakeCalendar = {
  events?: { title: string; inDays: number; start?: string; attendees?: string[] }[];
  askFirst?: boolean;
};

/**
 * A stand-in Gmail connector: `threads` come back from every search (dates as
 * days ago). Until `allowed`, Reacher's quiet checks see "not allowed yet";
 * any call (a click) allows it. Calls are kept in window.__gmailCalls.
 */
export type FakeGmail = {
  allowed?: boolean;
  threads?: {
    id: string;
    subject: string;
    messages: { from: string; to: string; daysAgo: number; text: string; sent?: boolean }[];
  }[];
};

/**
 * Stands in for the artifact runtime: AI (`sample`) answers from the script,
 * Export (`downloads`) records the file, and there's no db, so data saves in
 * the browser like `npm run dev`. Every prompt is kept in window.__prompts.
 */
export async function installClaude(
  page: Page,
  replies: Reply[] = [],
  calendar?: FakeCalendar,
  gmail?: FakeGmail,
) {
  await page.addInitScript(
    ({ script, cal, mail }: { script: Reply[]; cal?: FakeCalendar; mail?: FakeGmail }) => {
      const w = window as unknown as Record<string, unknown>;
      const prompts: string[] = [];
      w.__prompts = prompts;
      w.__saved = null;
      const answer = (prompt: string) => {
        prompts.push(prompt);
        const r = script.find((x) => prompt.includes(x.match));
        return new Promise((done) => setTimeout(() => done(r), r?.delay ?? 300)) as Promise<
          Reply | undefined
        >;
      };
      const sample = async (prompt: string) => ({
        text: (await answer(prompt))?.text ?? 'ok',
        truncated: false,
        modelTierApplied: 'quick',
      });
      sample.json = async (prompt: string) => (await answer(prompt))?.json ?? {};
      const downloads = {
        save: async (r: { filename: string; data: string }) => {
          w.__saved = { filename: r.filename, size: r.data.length };
          return { filename: r.filename };
        },
      };
      const calls: { tool: string; input: unknown }[] = [];
      w.__calendarCalls = calls;
      let allowed = !cal?.askFirst;
      const day = (n: number) => {
        const d = new Date();
        d.setDate(d.getDate() + n);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };
      const listed = () => ({
        events: (cal?.events ?? []).map((e, i) => ({
          id: `cal-${i}`,
          summary: e.title,
          start: e.start
            ? { dateTime: `${day(e.inDays)}T${e.start}:00-05:00` }
            : { date: day(e.inDays) },
          end: e.start
            ? { dateTime: `${day(e.inDays)}T${e.start}:00-05:00` }
            : { date: day(e.inDays + 1) },
          htmlLink: `https://calendar.google.com/event?eid=cal-${i}`,
          attendees: (e.attendees ?? []).map((email) => ({ email })),
        })),
      });
      const notAllowed = { code: 'not_in_manifest', message: 'not allowed yet' };
      let made = 0;
      const gmailCalls: { tool: string; input: unknown }[] = [];
      w.__gmailCalls = gmailCalls;
      let mailAllowed = !!mail?.allowed;
      const ago = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
      const gmailTool = (tool: string, input: Record<string, unknown>) => {
        const threads = mail?.threads ?? [];
        if (tool === 'search_threads')
          return { threads: threads.map((t) => ({ id: t.id, messageCount: t.messages.length })) };
        if (tool === 'get_thread') {
          const t = threads.find((x) => x.id === input.threadId)!;
          return {
            id: t.id,
            viewUrl: `https://mail.google.com/mail/#all/${t.id}`,
            messages: t.messages.map((m, i) => ({
              id: `${t.id}-m${i}`,
              threadId: t.id,
              sender: m.from,
              toRecipients: [m.to],
              date: ago(m.daysAgo),
              subject: i ? `Re: ${t.subject}` : t.subject,
              plaintextBody: m.text,
              labelIds: m.sent ? ['SENT'] : ['INBOX'],
            })),
          };
        }
        return {
          id: 'draft-1',
          threadId: 'thread-draft',
          viewUrl: 'https://mail.google.com/mail/#drafts/1',
        };
      };
      const mcp = {
        callTool: async (server: string, tool: string, input: unknown) => {
          if (server === 'Gmail') {
            gmailCalls.push({ tool, input });
            await new Promise((r) => setTimeout(r, 50));
            mailAllowed = true;
            return { payload: gmailTool(tool, input as Record<string, unknown>) };
          }
          calls.push({ tool, input });
          await new Promise((r) => setTimeout(r, 100));
          allowed = true;
          if (tool === 'create_event') {
            made += 1;
            return {
              payload: {
                id: `new-${made}`,
                htmlLink: `https://calendar.google.com/event?eid=new-${made}`,
              },
            };
          }
          return { payload: listed() };
        },
        watchTool: (_s: string, tool: string, input: unknown, handler: (ev: unknown) => void) => {
          calls.push({ tool: `watch:${tool}`, input });
          const t = setTimeout(
            () =>
              handler(
                allowed
                  ? { type: 'data', result: { payload: listed() } }
                  : { type: 'error', error: notAllowed },
              ),
            50,
          );
          return () => clearTimeout(t);
        },
      };
      const permissions = {
        state: async (name: string) =>
          name === 'mcp:Gmail' ? (mailAllowed ? 'granted' : 'prompt') : 'prompt',
      };
      w.claude = {
        use: async (name: string) =>
          name === 'sample'
            ? sample
            : name === 'downloads'
              ? downloads
              : name === 'mcp' && (cal || mail)
                ? mcp
                : name === 'permissions'
                  ? permissions
                  : null,
      };
    },
    { script: replies, cal: calendar, mail: gmail },
  );
}

/** Opens Reacher with the prototype's demo data imported. */
export async function openDemo(
  page: Page,
  replies: Reply[] = [],
  calendar?: FakeCalendar,
  gmail?: FakeGmail,
) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await installClaude(page, replies, calendar, gmail);
  await page.goto(`file://${PAGE_FILE}`);
  await page.getByRole('button', { name: 'Import from the prototype' }).click();
  await page.setInputFiles('#import-file', DEMO);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('tr', { hasText: 'Psyop' })).toBeVisible();
  return errors;
}

/** Waits for a toast containing this text. */
export const expectToast = (page: Page, text: string) =>
  expect(page.locator('[aria-live]').getByText(text).first()).toBeVisible();
/** The side panel (M7). */
export const panel = (page: Page) => page.locator('aside[aria-label="Company panel"]');
export const row = (page: Page, name: string) => page.locator('tr', { hasText: name });
/** A stage cell on the list: click it to select. */
export const stageCell = (page: Page, company: string, stage: string) =>
  page.getByRole('cell', { name: `${stage} for ${company}`, exact: true });
/** A field's editor (list cell or company page row). */
export const field = (page: Page, company: string, col: string) =>
  page.getByLabel(`${col} for ${company}`, { exact: true });
/** The company page. */
export const openPage = async (page: Page, name: string) => {
  // From a company page, go back to the list first.
  const back = page.getByRole('button', { name: 'Back to companies' });
  if (await back.isVisible()) await back.click();
  await page.locator(`button[title="Open ${name}"]`).click();
};
/** A tab on the company page. */
export const tab = (page: Page, name: string) =>
  page.getByRole('tab', { name, exact: true }).click();
/** Settings, at a tab (routes live in the address). */
export const settings = async (page: Page, tabName: string) => {
  await page.getByRole('button', { name: 'Open the menu' }).click();
  await page
    .getByRole('navigation', { name: 'Menu' })
    .getByRole('button', { name: tabName })
    .click();
};

/** Drags with the mouse in small steps, so drag libraries see a real drag. */
export async function drag(page: Page, from: Locator, to: Locator, offsetY = 2) {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  await page.mouse.move(a.x + 40, a.y + 15);
  await page.mouse.down();
  await page.mouse.move(a.x + 50, a.y + 30, { steps: 4 });
  await page.mouse.move(b.x + 40, b.y + offsetY, { steps: 15 });
  await page.waitForTimeout(150);
  await page.mouse.up();
}

/** The page area (company page and the rest), for older tests' "companyPage". */
export const main = (page: Page) => page.locator('main');
/** Opens a company's page at a tab. */
export async function openTab(page: Page, name: string, tabName: string) {
  await openPage(page, name);
  await tab(page, tabName);
}
