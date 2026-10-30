/**
 * Email templates and the writer (SPEC sections 7 and 8): fill-in fields,
 * placeholders for blanks, the default template and chain, and name guessing.
 */
import { asPerson, meta, valueText } from './board';
import { suggestedTemplate } from './stages';
import { slug } from './text';
import type { Board, Chain, Column, Company, Me, Person, Template } from './types';

export const ME_TOKENS: [string, string][] = [
  ['my_name', 'Your name'],
  ['my_portfolio', 'Portfolio'],
  ['my_reel', 'Reel link'],
  ['my_intro', 'Intro paragraph'],
  ['my_phone', 'Phone'],
];

/** The template field buttons, grouped like the prototype: Contact / Company / You. */
export function tokenGroups(board: Board): { name: string; items: [string, string][] }[] {
  return [
    {
      name: 'Contact',
      items: [
        ['first_name', 'First name'],
        ['contact_name', 'Full name'],
        ['contact_role', 'Role'],
      ] as [string, string][],
    },
    {
      name: 'Company',
      items: [
        ['company', 'Company name'],
        ...board.columns
          .filter((c) => c.type !== 'checklist')
          .map((c) => [slug(c.name), c.name] as [string, string]),
      ],
    },
    { name: 'You', items: ME_TOKENS },
  ];
}

/** The person columns a company has filled in (the To: choices). */
export function peopleOf(board: Board, c: Company) {
  return board.columns
    .filter((col) => col.type === 'person')
    .map((col) => ({ col, p: asPerson(meta(c, col.id)) }))
    .filter((x): x is { col: Column; p: Person } => !!x.p && !!(x.p.name || x.p.email));
}

/** Every field's value for one company, contact and sender. Blank values are ''. */
export function tokenMap(
  board: Board,
  c: Company | undefined,
  p: Person | null | undefined,
  me: Me | null,
) {
  const m: Record<string, string> = {};
  const name = (p?.name ?? '').trim();
  m.first_name = name.split(/\s+/)[0] ?? '';
  m.contact_name = name;
  m.contact_role = p?.role ?? '';
  m.company = c?.name ?? '';
  for (const col of board.columns) m[slug(col.name)] = c ? valueText(col, meta(c, col.id)) : '';
  m.my_name = me?.name ?? '';
  m.my_portfolio = me?.portfolio ?? '';
  m.my_reel = me?.reel ?? '';
  m.my_intro = me?.intro ?? '';
  m.my_phone = me?.phone ?? '';
  return m;
}

const TOKEN = /\{\{\s*([a-z0-9_]+)\s*\}\}/g;

/** The words for a field: "Priority", "Contact first name", "Your name". */
export function tokenLabel(board: Board, key: string) {
  for (const g of tokenGroups(board))
    for (const [id, l] of g.items)
      if (id === key) return g.name === 'Contact' ? `Contact ${l.toLowerCase()}` : l;
  return `{{${key}}}`;
}

/** "[Priority]": how a blank field shows in the editable text. */
export const placeholder = (board: Board, key: string) => `[${tokenLabel(board, key)}]`;

/** Fill a template: known values go in, blanks become [placeholders]. */
export const fillWithPlaceholders = (board: Board, text: string, m: Record<string, string>) =>
  text.replace(TOKEN, (_match, k: string) => m[k] || placeholder(board, k));

/** Pieces of a template for the preview: filled text, or a blank field. */
export function previewParts(board: Board, text: string, m: Record<string, string>) {
  const parts: { text: string; kind: 'plain' | 'filled' | 'missing' }[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const i = match.index ?? 0;
    if (i > last) parts.push({ text: text.slice(last, i), kind: 'plain' });
    const k = match[1]!;
    parts.push(
      m[k] ? { text: m[k]!, kind: 'filled' } : { text: tokenLabel(board, k), kind: 'missing' },
    );
    last = i + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), kind: 'plain' });
  return parts;
}

/**
 * Once a blank field gets a value, its placeholder in edited text is
 * replaced automatically, even after edits (SPEC section 7).
 */
export function replaceFilled(board: Board, text: string, m: Record<string, string>) {
  let out = text;
  for (const [k, v] of Object.entries(m)) {
    if (!v) continue;
    const ph = placeholder(board, k);
    if (out.includes(ph)) out = out.split(ph).join(v);
  }
  return out;
}

/** Fields still shown as placeholders in the text, for the "Fill in before sending" warning. */
export function missingFields(
  board: Board,
  texts: string[],
  template: Template | undefined,
  m: Record<string, string>,
) {
  const keys = new Set(Object.keys(m));
  for (const t of [template?.subject ?? '', template?.body ?? ''])
    for (const match of t.matchAll(TOKEN)) keys.add(match[1]!);
  return [...keys].filter((k) => !m[k] && texts.some((t) => t.includes(placeholder(board, k))));
}

/**
 * The template suggested for where the company is (M7: its active stage's
 * status, see Board.suggest); nothing started yet: First outreach (SPEC section 7).
 */
export function defaultTemplateId(board: Board, c: Company, templates: Template[]) {
  const stages = c.stages ?? {};
  const started = Object.values(stages).some((v) => v && v !== 'todo');
  let tpl = suggestedTemplate(board, stages) || (started ? '' : 'tpl-intro');
  if (!templates.some((t) => t.id === tpl)) tpl = '';
  if (!tpl && !started && templates[0]) tpl = templates[0].id;
  return tpl;
}

/** Reply in the latest chain once outreach has started; else a new chain. */
export function defaultTarget(c: Company, chains: Chain[]) {
  const latest = [...chains]
    .filter((ch) => ch.companyId === c.id)
    .sort((a, b) => (a.started < b.started ? 1 : -1))[0];
  const outreach = c.stages?.outreach;
  return latest && outreach && outreach !== 'todo' ? latest.id : 'new';
}

/** Shared inboxes: never guess a person's name from these. */
export const GENERIC_INBOX =
  /^(info|hello|hi|hey|jobs|job|careers|career|contact|team|hr|recruit|recruiting|recruitment|talent|studio|admin|office|press|work|apply|hiring|general|mail|inquiries|enquiries|production|newbiz|support|people)$/;

/** fred.smith@ → "Fred Smith". '' when it can't tell (or it's a shared inbox). */
export function guessName(email: string) {
  const local = email.split('@')[0]!.toLowerCase().replace(/\d+/g, '');
  const parts = local.split(/[._-]+/).filter((x) => x.length > 1 && /^[a-z]+$/.test(x));
  if (!parts.length || parts.some((x) => GENERIC_INBOX.test(x))) return '';
  const cap = (x: string) => x[0]!.toUpperCase() + x.slice(1);
  return parts.length >= 2 ? parts.slice(0, 2).map(cap).join(' ') : '';
}

export const isSharedInbox = (email: string) =>
  GENERIC_INBOX.test(email.split('@')[0]!.toLowerCase());
