import { colByName, optionOf, optList } from './board';
import { fmtDate, fmtTime, isISODate, todayISO } from './dates';
import { normalizeUrl } from '../lib/links';
import { isPlainObject, norm } from './text';
import type { Board, Column, Company } from './types';

/** The changes a quick update can make (SPEC section 9). */
export type QuickAction =
  | { type: 'add_company'; company: string }
  | { type: 'set_status'; company: string; column: string; value: string }
  | {
      type: 'log_email';
      company: string;
      chain: string;
      dir: 'in' | 'out';
      date: string;
      text: string;
    }
  | { type: 'add_note'; company: string; date: string; text: string }
  | {
      type: 'add_application';
      company: string;
      date: string;
      role: string;
      link: string;
      result: string;
    }
  | {
      type: 'add_meeting';
      company: string;
      date: string;
      start: string;
      end: string;
      kind: 'meeting' | 'interview';
      with: string;
      notes: string;
    }
  | { type: 'set_follow_up'; company: string; date: string }
  | { type: 'set_field'; company: string; column: string; value: unknown };

/** What the quick update prompt asks for back. */
export type QuickReply = { confirm?: boolean; reply?: string; actions?: unknown };

/**
 * Find a tracked company by name: exact (ignoring case and punctuation),
 * else one name starting with the other ("NY Life" ~ "New York Life" won't
 * match, but "Psyop" ~ "Psyop Inc" will).
 */
export function findCompany<T extends Pick<Company, 'name'>>(
  list: T[],
  name: string,
): T | undefined {
  const n = norm(name);
  if (!n) return undefined;
  return (
    list.find((c) => norm(c.name) === n) ??
    list.find((c) => norm(c.name).startsWith(n) || n.startsWith(norm(c.name)))
  );
}

/** A value from the AI in the shape a column stores, or undefined if it doesn't fit. */
export function coerce(col: Column, v: unknown): unknown {
  if (v == null || v === '') return undefined;
  switch (col.type) {
    case 'number': {
      const n = Number(v);
      return isNaN(n) ? undefined : n;
    }
    case 'checkbox':
      return !!v;
    case 'tags':
      return (Array.isArray(v) ? v : String(v).split(','))
        .map((x) => String(x).trim())
        .filter(Boolean);
    case 'person':
      return isPlainObject(v)
        ? { name: String(v.name ?? ''), role: String(v.role ?? ''), email: String(v.email ?? '') }
        : { name: String(v), role: '', email: '' };
    case 'link':
      return normalizeUrl(String(v)) || undefined;
    case 'date':
      return isISODate(v) ? v : undefined;
    case 'status':
      return optList(col).find((o) => norm(o.label) === norm(v) || o.id === v)?.id;
    case 'checklist':
      return undefined;
    default:
      return String(v);
  }
}

/** Use the column's own spelling of a choice when it already has it ("dream" → "Dream"). */
export function matchOption(col: Column, v: unknown): unknown {
  const opts = (col.options ?? []).map(String);
  const match = (x: unknown) => opts.find((o) => norm(o) === norm(x)) ?? x;
  if (col.type === 'values') return match(v);
  if (col.type === 'tags' && Array.isArray(v)) return v.map(match);
  return v;
}

/** List choices a value uses that the column doesn't have yet. */
export function missingOptions(col: Column, v: unknown): string[] {
  if (col.type !== 'values' && col.type !== 'tags') return [];
  const opts = (col.options ?? []).map(String);
  return (Array.isArray(v) ? v : [v])
    .map(String)
    .filter((x) => x && !opts.some((o) => norm(o) === norm(x)));
}

const isTime = (x: unknown): x is string => typeof x === 'string' && /^\d{2}:\d{2}$/.test(x);
const str = (v: unknown) => (v == null ? '' : String(v));

/**
 * Keep only actions that make sense for this board, with dates filled in
 * and values in the right shape (the prototype's cleanActions).
 */
export function cleanActions(board: Board, list: unknown, today = todayISO()): QuickAction[] {
  const out: QuickAction[] = [];
  const date = (d: unknown) => (isISODate(d) ? d : today);
  for (const raw of Array.isArray(list) ? list : []) {
    if (!isPlainObject(raw) || !raw.company) continue;
    const company = str(raw.company).trim();
    switch (raw.type) {
      case 'add_company':
        out.push({ type: 'add_company', company });
        break;
      case 'set_status': {
        const col = colByName(board, str(raw.column) || 'Status');
        const id = col?.type === 'status' ? coerce(col, raw.value) : undefined;
        if (col && typeof id === 'string')
          out.push({
            type: 'set_status',
            company,
            column: col.name,
            value: optionOf(col, id)?.label ?? id,
          });
        break;
      }
      case 'log_email':
        if (raw.text)
          out.push({
            type: 'log_email',
            company,
            chain: str(raw.chain) || 'Email chain',
            dir: raw.dir === 'in' ? 'in' : 'out',
            date: date(raw.date),
            text: str(raw.text),
          });
        break;
      case 'add_note':
        if (raw.text)
          out.push({ type: 'add_note', company, date: date(raw.date), text: str(raw.text) });
        break;
      case 'add_application':
        out.push({
          type: 'add_application',
          company,
          date: date(raw.date),
          role: str(raw.role),
          link: str(raw.link),
          result: str(raw.result),
        });
        break;
      case 'add_meeting':
        out.push({
          type: 'add_meeting',
          company,
          date: date(raw.date),
          start: isTime(raw.start) ? raw.start : '',
          end: isTime(raw.end) ? raw.end : '',
          kind: raw.kind === 'interview' ? 'interview' : 'meeting',
          with: str(raw.with),
          notes: str(raw.notes),
        });
        break;
      case 'set_follow_up':
        if (isISODate(raw.date)) out.push({ type: 'set_follow_up', company, date: raw.date });
        break;
      case 'set_field': {
        const col = colByName(board, str(raw.column));
        if (col && col.type !== 'status' && coerce(col, raw.value) !== undefined)
          out.push({ type: 'set_field', company, column: col.name, value: raw.value });
        break;
      }
    }
  }
  return out;
}

/** One line for the "Updated" card (the prototype's describe). */
export function describeAction(board: Board, a: QuickAction): string {
  switch (a.type) {
    case 'add_company':
      return `Add ${a.company}`;
    case 'set_status':
      return `${a.company} · ${a.column} → ${a.value}`;
    case 'log_email':
      return `${a.company} · email chain “${a.chain}”: ${a.dir === 'in' ? 'email from them' : 'email you sent'} on ${fmtDate(a.date, true)}: “${a.text}”`;
    case 'add_note':
      return `${a.company} · note on ${fmtDate(a.date, true)}: “${a.text}”`;
    case 'add_application':
      return `${a.company} · application${a.role ? ` for ${a.role}` : ''} on ${fmtDate(a.date, true)}${a.result ? ` (${a.result})` : ''}`;
    case 'add_meeting':
      return `${a.company} · ${a.kind}${a.with ? ` with ${a.with}` : ''} on ${fmtDate(a.date, true)}${
        a.start ? `, ${fmtTime(a.start)}${a.end ? `–${fmtTime(a.end)}` : ''}` : ''
      }${a.notes ? `: “${a.notes}”` : ''}`;
    case 'set_follow_up':
      return `${a.company} · follow up on ${fmtDate(a.date, true)}`;
    case 'set_field': {
      const col = colByName(board, a.column);
      const v = a.value;
      const text = Array.isArray(v)
        ? v.join(', ')
        : isPlainObject(v)
          ? [v.name, v.role, v.email].filter(Boolean).join(', ')
          : String(v);
      return `${a.company} · ${col?.name ?? a.column}: ${text}`;
    }
  }
}
