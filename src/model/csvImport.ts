/**
 * Importing companies and contacts from a CSV (Zack, after M7g), the way
 * Kitsu's importer works: every column gets matched to a place in Reacher
 * (by its header, or by what's in it when the header doesn't say), you can
 * change any match or ignore the column, companies you already have are
 * found, and you choose whether their rows update them or are skipped.
 */
import { asPerson, colById, optList } from './board';
import { isISODate, toISO } from './dates';
import { normalizeUrl } from '../lib/links';
import { newColumn } from './columns';
import { norm } from './text';
import type { Board, Column, Company, Person } from './types';

/** Where a column goes: 'company', 'status', 'comment', 'ignore', `col:<id>` or `person:<colId>:<part>`. */
export type Target = string;
export type PersonPart = 'name' | 'first' | 'last' | 'email' | 'role';

export const IGNORE = 'ignore';
/** A column that becomes a new text field, named after its header. */
export const NEW_FIELD = 'new';

/** Lowercase words with single spaces: "Job-Title " → "job title" (norm drops the spaces). */
const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const PART_LABEL: Record<PersonPart, string> = {
  name: 'name',
  first: 'first name',
  last: 'last name',
  email: 'email',
  role: 'title / role',
};

/** Every place a column can go, labeled for the column menus. */
export function importTargets(board: Board): { id: Target; label: string; group: string }[] {
  const out: { id: Target; label: string; group: string }[] = [
    { id: 'company', label: 'Company name', group: 'Company' },
  ];
  for (const col of board.columns) {
    if (col.type === 'person')
      for (const part of ['name', 'first', 'last', 'email', 'role'] as PersonPart[])
        out.push({
          id: `person:${col.id}:${part}`,
          label: `${col.name}: ${PART_LABEL[part]}`,
          group: 'Contact',
        });
  }
  for (const col of board.columns) {
    if (col.type === 'person' || col.type === 'checklist') continue;
    out.push({
      id: col.id === 'status' ? 'status' : `col:${col.id}`,
      label: col.name,
      group: 'Fields',
    });
  }
  out.push({ id: 'comment', label: 'Comment in the feed', group: 'Other' });
  return out;
}

const firstPerson = (board: Board) => board.columns.find((c) => c.type === 'person');
const colNamed = (board: Board, ...names: string[]) =>
  board.columns.find((c) => names.some((n) => norm(c.name) === norm(n) || c.id === n));

const SYNONYMS: [RegExp, (board: Board) => Target | null][] = [
  [
    /^(company|company name|companies|studio|studio name|organi[sz]ation|org|employer|agency|business|account|account name|brand)$/,
    () => 'company',
  ],
  [/^(first|first name|firstname|given name)$/, (b) => person(b, 'first')],
  [/^(last|last name|lastname|surname|family name)$/, (b) => person(b, 'last')],
  [
    /^(contact|contact name|contact person|full name|person|recruiter|hiring manager|point of contact|poc)$/,
    (b) => person(b, 'name'),
  ],
  [/(^|\s)e ?mail( address)?$|^email/, (b) => person(b, 'email')],
  [
    /^(title|job title|contact title|contact role|position|their role|job)$/,
    (b) => person(b, 'role'),
  ],
  [/^(status|stage|state)$/, () => 'status'],
  [/^(website|site|url|web|homepage|web site|domain|link)$/, (b) => col(b, 'website', 'Website')],
  [/^(city|location|town|based in|office)$/, (b) => col(b, 'city', 'City')],
  [/^(notes?|comments?|description|about)$/, (b) => col(b, 'notes', 'Notes') ?? 'comment'],
  [/^(type|category|kind|industry)$/, (b) => col(b, 'tags', 'Company type')],
  [/^(size|employees|headcount|company size)$/, (b) => col(b, 'size', 'Size')],
  [/^(priority)$/, (b) => col(b, 'priority', 'Priority')],
];

function person(board: Board, part: PersonPart): Target | null {
  const p = firstPerson(board);
  return p ? `person:${p.id}:${part}` : null;
}
function col(board: Board, ...names: string[]): Target | null {
  const c = colNamed(board, ...names);
  return c ? (c.id === 'status' ? 'status' : `col:${c.id}`) : null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL = /^(https?:\/\/)?(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i;

/** What a column holds when its header doesn't say: emails, links, or nothing we can tell. */
function sniff(board: Board, cells: string[]): Target | null {
  const filled = cells.filter(Boolean).slice(0, 30);
  if (!filled.length) return null;
  const share = (re: RegExp) => filled.filter((c) => re.test(c)).length / filled.length;
  if (share(EMAIL) >= 0.6) return person(board, 'email');
  if (share(URL) >= 0.6) return col(board, 'website', 'Website');
  return null;
}

/**
 * A first guess for every column, like Kitsu's: a header that's a field's
 * name goes there, then common names (Company, Email, Title...), then what
 * the cells look like. "Name" is the company unless another column already
 * is. Each place is used once; the rest are ignored.
 */
export function guessTargets(board: Board, header: string[], rows: string[][]): Target[] {
  const guesses: (Target | null)[] = header.map((h) => {
    const k = words(h);
    if (!k) return null;
    const exact = board.columns.find((c) => norm(c.name) === k);
    if (exact && exact.type !== 'person' && exact.type !== 'checklist')
      return exact.id === 'status' ? 'status' : `col:${exact.id}`;
    if (exact?.type === 'person') return `person:${exact.id}:name`;
    for (const [re, to] of SYNONYMS) if (re.test(k)) return to(board);
    return k === 'name' ? 'name?' : null;
  });
  // "Name": the company if nothing else is; else the contact.
  const hasCompany = guesses.includes('company');
  const resolved = guesses.map((g) =>
    g === 'name?' ? (hasCompany ? person(board, 'name') : 'company') : g,
  );
  const sniffed = resolved.map(
    (g, i) =>
      g ??
      sniff(
        board,
        rows.map((r) => r[i] ?? ''),
      ),
  );
  const used = new Set<Target>();
  return sniffed.map((g) => {
    if (!g || (g !== 'comment' && used.has(g))) return IGNORE;
    used.add(g);
    return g;
  });
}

/** Status words people use, for the built-in choices. */
const STATUS_WORDS: [RegExp, string][] = [
  [/^(gathering|research(ing)?|to contact|todo|to do|not contacted|lead|new)$/, 'gathering'],
  [/^(reached( out)?|contacted|emailed|sent|messaged|applied via email)$/, 'reached'],
  [/^(wrote back|responded|response|they replied|reply|replied to me)$/, 'wroteback'],
  [/^(replied|followed up|follow ?up sent|waiting)$/, 'replied'],
  [/^(meeting|met|call|coffee( chat)?|chat|talked)$/, 'meeting'],
  [/^(applied|application( sent)?|submitted)$/, 'applied'],
  [/^(rejected|no|declined|turned down|not hiring|passed|closed)$/, 'rejected'],
  [/^(interview(ing|ed)?|in process)$/, 'interview'],
];

/** One cell as a value for a column; null when it's empty or can't be read. */
export function cellValue(c: Column, raw: string): unknown {
  const v = raw.trim();
  if (!v) return null;
  switch (c.type) {
    case 'number': {
      const n = Number(v.replace(/[$,£€\s]/g, ''));
      return Number.isFinite(n) ? n : null;
    }
    case 'checkbox':
      return /^(y|yes|true|x|1|✓|✔|done)$/i.test(v);
    case 'date':
      return toDate(v);
    case 'link':
      return normalizeUrl(v) || null;
    case 'tags':
      return v
        .split(/[,;|]/)
        .map((t) => t.trim())
        .filter(Boolean);
    case 'status': {
      const hit = optList(c).find((o) => norm(o.label) === norm(v) || o.id === norm(v));
      if (hit) return hit.id;
      if (c.id !== 'status') return null;
      const word = STATUS_WORDS.find(([re]) => re.test(words(v)))?.[1];
      return word && optList(c).some((o) => o.id === word) ? word : null;
    }
    case 'values':
      return optList(c).find((o) => norm(o.label) === norm(v))?.label ?? v;
    default:
      return v;
  }
}

function toDate(v: string): string | null {
  const iso = isISODate(v) ? v : null;
  if (iso) return iso;
  const m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) {
    const y = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
    const iso = `${y}-${m[1]!.padStart(2, '0')}-${m[2]!.padStart(2, '0')}`;
    return isISODate(iso) ? iso : null;
  }
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : toISO(new Date(t));
}

export type RowState = 'new' | 'update' | 'skip' | 'incomplete' | 'merged';

export type RowPlan = {
  /** Line in the file (the header is line 1). */
  line: number;
  name: string;
  state: RowState;
  /** The company it matches, when you already have it. */
  existing: Company | null;
  /** For 'merged': the line it adds to (the same company earlier in the file). */
  into?: number;
  meta: Record<string, unknown>;
  comment: string;
};

export type ImportPlan = {
  rows: RowPlan[];
  /** Choices to add to "values" columns, by column id. */
  newOptions: Record<string, string[]>;
  counts: { create: number; update: number; skip: number };
  /** Places used by more than one column (the later ones are ignored). */
  duplicates: Target[];
};

/**
 * Makes the new fields a file asks for (NEW_FIELD columns): the board with
 * them added, and the targets pointing at them.
 */
export function withNewFields(
  board: Board,
  header: string[],
  targets: Target[],
): { board: Board; targets: Target[] } {
  const columns = [...board.columns];
  const next = targets.map((t, i) => {
    if (t !== NEW_FIELD) return t;
    const name = header[i]?.trim() || `Column ${i + 1}`;
    const existing = columns.find((c) => norm(c.name) === norm(name));
    if (existing) return existing.id === 'status' ? 'status' : `col:${existing.id}`;
    const c = newColumn(name, 'text', [], false);
    columns.push(c);
    return `col:${c.id}`;
  });
  const added = columns.length > board.columns.length;
  return { board: added ? { ...board, columns } : board, targets: next };
}

/**
 * What importing would do, row by row. A company you have is updated (when
 * `update`) or skipped; the same company twice in the file is one company,
 * later rows filling what earlier ones left empty.
 */
export function planImport(
  board: Board,
  companies: Company[],
  header: string[],
  rows: string[][],
  targets: Target[],
  update: boolean,
): ImportPlan {
  const seen = new Set<Target>();
  const duplicates: Target[] = [];
  const live = targets.map((t) => {
    if (t === IGNORE || t === 'comment') return t;
    if (seen.has(t)) {
      duplicates.push(t);
      return IGNORE;
    }
    seen.add(t);
    return t;
  });
  const at = live.indexOf('company');
  const newOptions: Record<string, string[]> = {};
  const plans: RowPlan[] = [];
  const firstLine = new Map<string, RowPlan>();

  rows.forEach((row, i) => {
    const line = i + 2;
    const name = at >= 0 ? (row[at] ?? '').trim() : '';
    const meta: Record<string, unknown> = {};
    const people: Record<string, Partial<Record<PersonPart, string>>> = {};
    const comments: string[] = [];
    live.forEach((t, j) => {
      const raw = (row[j] ?? '').trim();
      if (!raw || t === IGNORE || t === 'company') return;
      if (t === 'comment') return void comments.push(`${header[j] || 'Note'}: ${raw}`);
      if (t.startsWith('person:')) {
        const [, colId, part] = t.split(':') as [string, string, PersonPart];
        (people[colId] ??= {})[part] = raw;
        return;
      }
      const c = t === 'status' ? colById(board, 'status') : colById(board, t.slice(4));
      if (!c) return;
      const v = cellValue(c, raw);
      if (v == null) return;
      meta[c.id] = v;
      if (c.type === 'values' && !optList(c).some((o) => o.label === v)) {
        const list = (newOptions[c.id] ??= []);
        if (!list.includes(String(v))) list.push(String(v));
      }
    });
    for (const [colId, p] of Object.entries(people)) {
      const full = p.name || [p.first, p.last].filter(Boolean).join(' ');
      meta[colId] = { name: full, email: p.email ?? '', role: p.role ?? '' } satisfies Person;
    }
    const comment = comments.join('\n');

    if (!name) {
      plans.push({ line, name, state: 'incomplete', existing: null, meta, comment });
      return;
    }
    const key = norm(name);
    const earlier = firstLine.get(key);
    if (earlier) {
      // Same company again: fill what the earlier row left empty.
      for (const [k, v] of Object.entries(meta)) if (earlier.meta[k] == null) earlier.meta[k] = v;
      if (comment) earlier.comment = [earlier.comment, comment].filter(Boolean).join('\n');
      plans.push({
        line,
        name,
        state: 'merged',
        existing: null,
        into: earlier.line,
        meta,
        comment,
      });
      return;
    }
    const existing = companies.find((c) => norm(c.name) === key) ?? null;
    const plan: RowPlan = {
      line,
      name,
      state: existing ? (update ? 'update' : 'skip') : 'new',
      existing,
      meta,
      comment,
    };
    firstLine.set(key, plan);
    plans.push(plan);
  });

  // An update keeps the contact's details the file doesn't have.
  for (const p of plans)
    if (p.state === 'update' && p.existing)
      for (const [k, v] of Object.entries(p.meta)) {
        const before = asPerson(p.existing.meta?.[k]);
        if (before && v && typeof v === 'object' && !Array.isArray(v)) {
          const next = v as Person;
          p.meta[k] = {
            name: next.name || before.name,
            email: next.email || before.email,
            role: next.role || before.role,
          };
        }
      }

  return {
    rows: plans,
    newOptions,
    duplicates,
    counts: {
      create: plans.filter((p) => p.state === 'new').length,
      update: plans.filter((p) => p.state === 'update').length,
      skip: plans.filter((p) => p.state === 'skip' || p.state === 'incomplete').length,
    },
  };
}
