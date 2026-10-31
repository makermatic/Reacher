/**
 * People (M11): the second list, next to companies (Kitsu's assets next to
 * shots). Their own board of fields, a thumbs up / down status (down = don't
 * contact again), one company at a time with the ones before remembered.
 * The first time, everyone in a company's person fields (Main contact)
 * becomes a person.
 */
import { asPerson, meta } from './board';
import { norm, uid } from './text';
import { isPlainObject } from './text';
import type { Board, Company, Contact } from './types';

/** Status choices: up is the default for everyone new. */
export const DEFAULT_PEOPLE_BOARD: Board = {
  version: 2,
  columns: [
    {
      id: 'status',
      name: 'Status',
      type: 'status',
      locked: true,
      onSheet: true,
      options: [
        { id: 'up', label: 'Good to contact', group: '', color: 'green', tpl: '', icon: '👍' },
        { id: 'down', label: 'Don’t contact', group: '', color: 'red', tpl: '', icon: '👎' },
      ],
    },
    { id: 'role', name: 'Role', type: 'text', onSheet: true },
    { id: 'email', name: 'Email', type: 'text', onSheet: true },
    { id: 'notes', name: 'Notes', type: 'longtext', onSheet: true },
  ],
};

export const UP = 'up';

export const peopleBoardOrDefault = (b: unknown): Board =>
  isPlainObject(b) && Array.isArray(b.columns) ? (b as Board) : DEFAULT_PEOPLE_BOARD;

export const isContactId = (id: string | null | undefined) => !!id && id.startsWith('pe-');

export function newContact(
  name: string,
  companyId: string | null,
  fields: Record<string, unknown> = {},
  now = Date.now(),
): Contact {
  return {
    id: uid('pe'),
    name: name.trim(),
    order: now,
    meta: { status: UP, ...fields },
    due: null,
    companyId,
  };
}

/** The people at a company now, thumbs up first. */
export const contactsAt = (people: Contact[], companyId: string) =>
  people
    .filter((p) => p.companyId === companyId)
    .sort(
      (a, b) =>
        Number(meta(a as never, 'status') === 'down') -
          Number(meta(b as never, 'status') === 'down') || a.order - b.order,
    );

/** Their email (the Email field), lowercased, or ''. */
export const contactEmail = (p: Contact) =>
  String(p.meta?.email ?? '')
    .trim()
    .toLowerCase();

/**
 * Everyone in a company's person fields who isn't a person yet: the
 * one-time move into People, and what a CSV import adds.
 */
export function contactsFromCompanies(
  board: Board,
  companies: Company[],
  existing: Contact[],
  now = Date.now(),
): Contact[] {
  const out: Contact[] = [];
  const known = (companyId: string, name: string, email: string) =>
    [...existing, ...out].some(
      (p) =>
        p.companyId === companyId &&
        ((email && contactEmail(p) === email.toLowerCase()) ||
          (name && norm(p.name) === norm(name))),
    );
  let n = 0;
  for (const c of companies)
    for (const col of board.columns.filter((x) => x.type === 'person')) {
      const p = asPerson(meta(c, col.id));
      if (!p || !(p.name || p.email)) continue;
      if (known(c.id, p.name, p.email)) continue;
      out.push(
        newContact(
          p.name || p.email,
          c.id,
          { ...(p.role ? { role: p.role } : {}), ...(p.email ? { email: p.email } : {}) },
          now + n++,
        ),
      );
    }
  return out;
}

/** Moving to another company keeps where they were (Zack: rare, but it happens). */
export function movePatch(p: Contact, companyId: string | null, today: string): Partial<Contact> {
  if (p.companyId === companyId) return {};
  return {
    companyId,
    ...(p.companyId
      ? { pastCompanies: [...(p.pastCompanies ?? []), { companyId: p.companyId, until: today }] }
      : {}),
  };
}
