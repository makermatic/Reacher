import { boardOrDefault } from './board';
import { isPlainObject } from './text';
import type { Board, Chain, Company, Me, Message, Page, Template } from './types';

/**
 * Reads the prototype's Export file (Your details → Export data):
 * { exported, board, companies, chains, pages, templates, me }.
 * Reacher's own export (M6) uses the same shape.
 */
export type ImportData = {
  board: Board;
  companies: Company[];
  chains: Chain[];
  pages: Record<string, Page>;
  templates: Template[];
  me: Me | null;
};

export class ImportError extends Error {}

const str = (v: unknown) => (v == null ? '' : String(v));
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const withId = (v: unknown): v is Record<string, unknown> & { id: unknown } =>
  isPlainObject(v) && typeof v.id === 'string' && !!v.id;

export function parseExport(text: string): ImportData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ImportError("That file isn't readable. Pick the .json file the prototype exported.");
  }
  if (!isPlainObject(raw) || !Array.isArray(raw.companies)) {
    throw new ImportError(
      "That file doesn't look like a Reacher export. It should come from Your details → Export data.",
    );
  }

  const companies: Company[] = raw.companies.filter(withId).map((c) => ({
    id: str(c.id),
    name: str(c.name).trim() || 'Untitled',
    order: typeof c.order === 'number' ? c.order : 0,
    meta: isPlainObject(c.meta) ? c.meta : {},
    due: typeof c.due === 'string' && c.due ? c.due : null,
    auto: isPlainObject(c.auto) ? (c.auto as Company['auto']) : {},
    ...(c.example ? { example: true } : {}),
  }));
  const companyIds = new Set(companies.map((c) => c.id));

  // Chains export as an array; accept an id-keyed object too.
  const rawChains = Array.isArray(raw.chains)
    ? raw.chains
    : isPlainObject(raw.chains)
      ? Object.entries(raw.chains).map(([id, ch]) => ({ id, ...(isPlainObject(ch) ? ch : {}) }))
      : [];
  const chains: Chain[] = rawChains
    .filter(withId)
    .filter((ch) => companyIds.has(str(ch.companyId)))
    .map((ch) => ({
      id: str(ch.id),
      companyId: str(ch.companyId),
      title: str(ch.title) || 'Email chain',
      started: str(ch.started),
      messages: arr(ch.messages)
        .filter(withId)
        .map((m): Message => ({
          id: str(m.id),
          dir: m.dir === 'out' ? 'out' : 'in',
          date: str(m.date),
          text: str(m.text),
        })),
      summary: isPlainObject(ch.summary)
        ? {
            text: str(ch.summary.text),
            at: str(ch.summary.at),
            count: Number(ch.summary.count) || 0,
          }
        : null,
    }));

  const pages: Record<string, Page> = {};
  if (isPlainObject(raw.pages)) {
    for (const [cid, p] of Object.entries(raw.pages)) {
      if (!companyIds.has(cid) || !isPlainObject(p)) continue;
      pages[cid] = {
        notes: arr(p.notes)
          .filter(withId)
          .map((n) => ({ id: str(n.id), date: str(n.date), text: str(n.text) })),
        applications: arr(p.applications)
          .filter(withId)
          .map((a) => ({
            id: str(a.id),
            date: str(a.date),
            role: str(a.role),
            link: str(a.link),
            result: str(a.result),
          })),
        meetings: arr(p.meetings)
          .filter(withId)
          .map((m) => ({
            id: str(m.id),
            date: str(m.date),
            start: str(m.start),
            end: str(m.end),
            kind: m.kind === 'interview' ? 'interview' : 'meeting',
            with: str(m.with),
            notes: str(m.notes),
          })),
      };
    }
  }

  const templates: Template[] = arr(raw.templates)
    .filter(withId)
    .map((t) => ({
      id: str(t.id),
      name: str(t.name) || 'Untitled',
      subject: str(t.subject),
      body: str(t.body),
    }));

  const me = isPlainObject(raw.me)
    ? {
        name: str(raw.me.name),
        portfolio: str(raw.me.portfolio),
        reel: str(raw.me.reel),
        phone: str(raw.me.phone),
        intro: str(raw.me.intro),
      }
    : null;

  return {
    board: boardOrDefault(isPlainObject(raw.board) ? (raw.board as Board) : null),
    companies,
    chains,
    pages,
    templates,
    me,
  };
}

/** "34 companies, 12 email chains, 20 notes…" for the confirm step. */
export function describeImport(d: ImportData) {
  const pages = Object.values(d.pages);
  const count = (k: keyof Page) => pages.reduce((n, p) => n + p[k].length, 0);
  const parts: [number, string, string][] = [
    [d.companies.length, 'company', 'companies'],
    [d.chains.length, 'email chain', 'email chains'],
    [count('notes'), 'note', 'notes'],
    [count('applications'), 'application', 'applications'],
    [count('meetings'), 'meeting or interview', 'meetings and interviews'],
    [d.templates.length, 'email template', 'email templates'],
  ];
  return parts.filter(([n]) => n > 0).map(([n, one, many]) => `${n} ${n === 1 ? one : many}`);
}
