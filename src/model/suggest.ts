import { ALIASES, expand } from './search';
import { norm } from './text';

const titleCase = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

/**
 * Autofill for text cells (Zack, 2026-10-28): values already used in the
 * column, ranked like the status picker, with abbreviations expanded so "LA"
 * offers "Los Angeles". With nothing typed, the most-used values come first.
 */
export function textSuggestions(used: unknown[], query: string, limit = 8): string[] {
  // Distinct values (case and spacing ignored), most used first.
  const counts = new Map<string, { value: string; n: number }>();
  for (const v of used) {
    if (typeof v !== 'string' || !v.trim()) continue;
    const key = norm(v);
    const cur = counts.get(key);
    if (cur) cur.n++;
    else counts.set(key, { value: v.trim(), n: 1 });
  }
  const values = [...counts.values()].sort((a, b) => b.n - a.n).map((x) => x.value);

  const q = norm(query);
  if (!q) return values.slice(0, limit);

  const out: string[] = [];
  const add = (v: string) => {
    if (!out.some((x) => norm(x) === norm(v))) out.push(v);
  };

  // A whole-query abbreviation goes first, in the spelling already used if there is one.
  const alias = ALIASES[query.trim().toLowerCase()];
  if (alias) add(values.find((v) => norm(v) === norm(alias)) ?? titleCase(alias));

  const qx = expand(query);
  const scored = values
    .map((v, i) => {
      const n = norm(v);
      const words = v
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean);
      const score = n.startsWith(q)
        ? 0
        : words.some((w) => w.startsWith(q))
          ? 1
          : n.includes(q) || expand(v).includes(qx)
            ? 2
            : -1;
      return { v, score, i };
    })
    .filter((x) => x.score >= 0)
    .sort((a, b) => a.score - b.score || a.i - b.i);
  for (const { v } of scored) add(v);
  return out.slice(0, limit);
}
