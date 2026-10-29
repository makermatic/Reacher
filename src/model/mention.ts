/**
 * Typing @ in a template to pick a fill-in field, like Discord (Zack, round 2).
 * Pure helpers: where the @ is, and which fields match what follows it.
 */

export type FieldItem = { key: string; label: string; group: string };

/**
 * The @ the caret is in, if any: `start` is the @'s index, `query` what's
 * typed after it. Only an @ at the start of a word counts, so an email address
 * (name@studio.com) never opens the picker. No spaces in the query.
 */
export function mentionAt(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf('@');
  if (at < 0) return null;
  const prev = at > 0 ? before[at - 1]! : ' ';
  if (!/[\s([{"'“‘]/.test(prev)) return null;
  const query = before.slice(at + 1);
  if (!/^[\w-]{0,30}$/.test(query)) return null;
  return { start: at, query };
}

/** Fields whose label or key contains the query; ones that start with it first. */
export function matchFields(items: FieldItem[], query: string): FieldItem[] {
  const q = query.toLowerCase().replace(/[_-]/g, ' ').trim();
  if (!q) return items;
  const norm = (s: string) => s.toLowerCase().replace(/[_-]/g, ' ');
  const score = (it: FieldItem) => {
    const l = norm(it.label);
    const k = norm(it.key);
    if (l.startsWith(q) || k.startsWith(q)) return 0;
    if (l.split(' ').some((w) => w.startsWith(q))) return 1;
    if (l.includes(q) || k.includes(q)) return 2;
    return -1;
  };
  return items
    .map((it, i) => ({ it, s: score(it), i }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((x) => x.it);
}

/** Replace the @query with {{key}}; returns the new text and where the caret goes. */
export function insertField(
  text: string,
  start: number,
  caret: number,
  key: string,
): { text: string; caret: number } {
  const tok = `{{${key}}}`;
  return { text: text.slice(0, start) + tok + text.slice(caret), caret: start + tok.length };
}
