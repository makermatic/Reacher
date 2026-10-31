import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // One JS file and one CSS file, so scripts/build-artifact.mjs can inline them into the page.
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
  test: {
    environment: 'jsdom',
    // e2e/ holds the Playwright browser tests (npm run e2e), not unit tests.
    include: ['src/**/*.test.ts'],
  },
});
