import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests: they drive the built page (`npm run build` first) in a
 * real browser, with a stand-in for Claude so AI answers are scripted. They
 * are the safety net for the UI overhaul: the look can change completely and
 * these still prove every feature works. Run with `npm run e2e`.
 */
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
});
