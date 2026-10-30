/**
 * The search box, Kitsu's way (M7): plain words match names and any field
 * (with abbreviations, so "LA" finds Los Angeles); `field=value` filters a
 * column (`status=wrote`, `city=la,nyc` for either); `-word` leaves
 * out matching names. Brackets or quotes keep spaces and commas together:
 * `status=[wrote back]`.
 */
import { meta, valueText } from './board';
import { expand, matchesSearch } from './search';
import { statusLabel } from './stages';
import { norm } from './text';
import type { Board, Column, Company } from './types';

export type Query = {
  words: string[];
  excludes: string[];
  filters: { key: string; values: string[]; not: boolean }[];
};

/** Splits on spaces, keeping [..] and "..." groups whole. */
function tokens(q: string): string[] {
  const out: string[] = [];
  const re = /(?:[^\s[\]"]+|\[[^\]]*\]|"[^"]*")+/g;
  for (const m of q.matchAll(re)) out.push(m[0]);
  return out;
}

const unwrap = (s: string) => s.replace(/^[[(]|[\])]$/g, '').replace(/^"|"$/g, '');

export function parseQuery(q: string): Query {
  const query: Query = { words: [], excludes: [], filters: [] };
  const parts = tokens(q.trim());
  for (const t of parts) {
    const eq = t.indexOf('=');
    if (eq > 0) {
      // Values match part of a label, so `status=wrote` finds "Wrote back!!".
      const raw = t.slice(eq + 1);
      const not = raw.startsWith('-');
      const values = unwrap(not ? raw.slice(1) : raw)
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      query.filters.push({ key: unwrap(t.slice(0, eq)), values, not });
    } else if (t.startsWith('-') && t.length > 1) query.excludes.push(unwrap(t.slice(1)));
    else query.words.push(unwrap(t));
  }
  return query;
}

/** The column a filter key names: its name, ignoring case and spaces ("role" finds "Role I want"). */
export function columnFor(board: Board, key: string): Column | undefined {
  const k = norm(key);
  return (
    board.columns.find((c) => norm(c.name) === k) ??
    board.columns.find((c) => norm(c.name).startsWith(k))
  );
}

/**
 * Whether a company (with its stages as seen from the sprint on screen)
 * matches. `outreach=reply` filters one stage; `status=reply` any stage.
 */
export function matchesQuery(board: Board, c: Company, q: Query): boolean {
  if (!q.words.every((w) => matchesSearch(board, c, w))) return false;
  if (q.excludes.some((x) => norm(c.name).includes(norm(x)))) return false;
  for (const f of q.filters) {
    const k = norm(f.key);
    const stage = board.stages.find((s) => norm(s.name) === k || norm(s.name).startsWith(k));
    const statusTexts = (ids: (string | null | undefined)[]) =>
      ids.map((id) => statusLabel(board, id));
    const texts =
      k === 'status'
        ? statusTexts(Object.values(c.stages ?? {}))
        : stage
          ? statusTexts([c.stages?.[stage.id]])
          : null;
    const col = texts ? undefined : columnFor(board, f.key);
    if (!texts && !col) continue;
    const all = texts ?? [valueText(col!, meta(c, col!.id))];
    const hitText = (text: string) =>
      f.values.some((v) =>
        v === 'none' ? !text : norm(text).includes(norm(v)) || expand(text).includes(expand(v)),
      );
    const hit = all.some(hitText) || (f.values.includes('none') && !all.some(Boolean));
    if (hit === f.not) return false;
  }
  return true;
}
