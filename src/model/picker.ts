import { optList } from './board';
import { norm } from './text';
import type { Column, Option } from './types';

/**
 * The status picker's list for what's typed (SPEC section 3): labels that
 * start with it, then a word in the label that starts with it, then labels
 * that contain it. Categories are matched only if no label matches.
 */
export function rankOptions(col: Column, query: string): Option[] {
  const opts = optList(col);
  const q = norm(query);
  if (!q) return opts;
  const scored = opts
    .map((o, i) => {
      const label = norm(o.label);
      const words = o.label
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean);
      const score = label.startsWith(q)
        ? 0
        : words.some((w) => w.startsWith(q))
          ? 1
          : label.includes(q)
            ? 2
            : -1;
      return { o, score, i };
    })
    .filter((x) => x.score >= 0)
    .sort((a, b) => a.score - b.score || a.i - b.i);
  if (scored.length) return scored.map((x) => x.o);
  return opts.filter((o) => norm(o.group).includes(q));
}

/** Split a label around the first match of the query, for underlining it. */
export function splitMatch(label: string, query: string): [string, string, string] {
  const q = query.trim().toLowerCase();
  const i = q ? label.toLowerCase().indexOf(q) : -1;
  if (i < 0) return [label, '', ''];
  return [label.slice(0, i), label.slice(i, i + q.length), label.slice(i + q.length)];
}
