import { expect, type Locator, type Page } from '@playwright/test';
import { resolve } from 'node:path';

export const PAGE_FILE = resolve('e2e/.out/page.html');
const DEMO = resolve('e2e/fixtures/demo-export.json');

/** A scripted AI answer: the first one whose `match` is in the prompt wins. */
export type Reply = { match: string; json?: unknown; text?: string; delay?: number };

/**
 * Stands in for the artifact runtime: AI (`sample`) answers from the script,
 * Export (`downloads`) records the file, and there's no db, so data saves in
 * the browser like `npm run dev`. Every prompt is kept in window.__prompts.
 */
export async function installClaude(page: Page, replies: Reply[] = []) {
  await page.addInitScript((script: Reply[]) => {
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
    w.claude = {
      use: async (name: string) =>
        name === 'sample' ? sample : name === 'downloads' ? downloads : null,
    };
  }, replies);
}

/** Opens Reacher with the prototype's demo data imported. */
export async function openDemo(page: Page, replies: Reply[] = []) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await installClaude(page, replies);
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
