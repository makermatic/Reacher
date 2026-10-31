import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { PAGE_FILE } from './support';

/** Wraps the built fragment in a page, the way the artifact host does. */
export default function globalSetup() {
  const built = 'dist-artifact/reacher-test.html';
  if (!existsSync(built)) throw new Error(`${built} is missing. Run npm run build first.`);
  mkdirSync(dirname(PAGE_FILE), { recursive: true });
  writeFileSync(
    PAGE_FILE,
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style></head><body>${readFileSync(built, 'utf8')}</body></html>`,
  );
}
