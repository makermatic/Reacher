import { meta, valueText } from './board';
import { daysUntil } from './dates';
import { norm } from './text';
import type { Board, Company } from './types';

/** Abbreviations search treats as the full thing (SPEC section 4). */
export const ALIASES: Record<string, string> = {
  la: 'los angeles',
  nyc: 'new york',
  ny: 'new york',
  sf: 'san francisco',
  dc: 'washington',
  atl: 'atlanta',
  chi: 'chicago',
  bk: 'brooklyn',
  philly: 'philadelphia',
  nola: 'new orleans',
  ldn: 'london',
  tor: 'toronto',
  van: 'vancouver',
  mtl: 'montreal',
  sav: 'savannah',
  pdx: 'portland',
  sea: 'seattle',
  bos: 'boston',
  atx: 'austin',
  slc: 'salt lake city',
  lv: 'las vegas',
  hk: 'hong kong',
  uk: 'united kingdom',
  us: 'united states',
  usa: 'united states',
  mograph: 'motion graphics',
  vfx: 'visual effects',
  fx: 'effects',
  ad: 'advertising',
  ads: 'advertising',
  tv: 'television',
};

/** Text with every known abbreviation expanded, normalized for comparison. */
const expand = (s: unknown) =>
  norm(
    String(s ?? '')
      .toLowerCase()
      .replace(/[a-z]+/g, (w) => ALIASES[w] ?? w),
  );

/** Whether a company matches the search: its name or any column's text, raw or expanded. */
export function matchesSearch(board: Board, c: Company, query: string) {
  const q = norm(query);
  if (!q) return true;
  const qx = expand(query);
  const hit = (v: unknown) => {
    const t = String(v ?? '');
    return norm(t).includes(q) || expand(t).includes(qx);
  };
  return hit(c.name) || board.columns.some((col) => hit(valueText(col, meta(c, col.id))));
}

/** Needs me: they wrote back, or the follow-up is due or late. */
export const needsMe = (c: Company, now = new Date()) =>
  meta(c, 'status') === 'wroteback' || (!!c.due && daysUntil(c.due, now) <= 0);

export type Filter = 'all' | 'needs';

/** The sheet's rows: in the order added, then searched and filtered. */
export function visibleCompanies(
  board: Board,
  companies: Company[],
  query: string,
  filter: Filter,
) {
  return [...companies]
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .filter((c) => matchesSearch(board, c, query))
    .filter((c) => filter === 'all' || needsMe(c));
}
