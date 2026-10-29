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
 * Stands in for the artifact runtime: AI (`sample`) answers from the script,
 * Export (`downloads`) records the file, and there's no db, so data saves in
 * the browser like `npm run dev`. Every prompt is kept in window.__prompts.
 */
export async function installClaude(page: Page, replies: Reply[] = [], calendar?: FakeCalendar) {
  await page.addInitScript(
    ({ script, cal }: { script: Reply[]; cal?: FakeCalendar }) => {
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
      const mcp = {
        callTool: async (_server: string, tool: string, input: unknown) => {
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
      w.claude = {
        use: async (name: string) =>
          name === 'sample'
            ? sample
            : name === 'downloads'
              ? downloads
              : name === 'mcp' && cal
                ? mcp
                : null,
      };
    },
    { script: replies, cal: calendar },
  );
}

/** Opens Reacher with the prototype's demo data imported. */
export async function openDemo(page: Page, replies: Reply[] = [], calendar?: FakeCalendar) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await installClaude(page, replies, calendar);
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
export const companyPage = (page: Page) => page.locator('aside[aria-label="Company page"]');
export const row = (page: Page, name: string) => page.locator('tr', { hasText: name });
export const openCompany = (page: Page, name: string) =>
  page.locator(`button[title="Open ${name}"]`).click();

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
