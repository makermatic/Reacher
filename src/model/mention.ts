/**
 * Fill-in fields in the template editor, written #first_name like Discord
 * channels (Zack, round 3). Typing # opens a menu of fields. Templates are
 * still stored with {{first_name}} (the prototype's format, which export,
 * import and the email writer read); only the editor shows #.
 */

export type FieldItem = { key: string; label: string; group: string };

/**
 * The # the caret is in, if any: `start` is the #'s index, `query` what's
 * typed after it. A # right after a letter or digit (C#, ab#1) doesn't count.
 * No spaces in the query.
 */
export function mentionAt(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf('#');
  if (at < 0) return null;
  const prev = at > 0 ? before[at - 1]! : ' ';
  if (/[\p{L}\p{N}_]/u.test(prev)) return null;
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

/** Replace the #query with #key; returns the new text and where the caret goes. */
export function insertField(
  text: string,
  start: number,
  caret: number,
  key: string,
): { text: string; caret: number } {
  const tok = `#${key}`;
  return { text: text.slice(0, start) + tok + text.slice(caret), caret: start + tok.length };
}

/** Stored {{key}} → #key for the editor (only known fields; others stay as written). */
export const toHashes = (text: string, keys: Set<string>) =>
  text.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (keys.has(k) ? `#${k}` : m));

/** Editor #key → stored {{key}}. The longest known field wins (#company_type over #company). */
export const fromHashes = (text: string, keys: Set<string>) =>
  text.replace(/(^|[^\p{L}\p{N}_])#(\w+)/gu, (m, pre: string, word: string) => {
    for (let n = word.length; n > 0; n--) {
      const k = word.slice(0, n);
      if (keys.has(k)) return `${pre}{{${k}}}${word.slice(n)}`;
    }
    return m;
  });
