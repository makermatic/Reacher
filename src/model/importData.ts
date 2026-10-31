import { boardOrDefault } from './board';
import { isPlainObject } from './text';
import { peopleBoardOrDefault } from './people';
import { statusFromStages, unstageCompany } from './unstage';
import type {
  Board,
  Contact,
  Chain,
  Company,
  FeedEvent,
  Me,
  Message,
  Page,
  Sprint,
  SprintEntry,
  Template,
} from './types';

/**
 * Reads the prototype's Export file (Your details → Export data):
 * { exported, board, companies, chains, pages, templates, me }.
 * Reacher's own export (M6) uses the same shape, plus `sprints` (M7).
 */
export type ImportData = {
  board: Board;
  sprints: Sprint[];
  companies: Company[];
  chains: Chain[];
  pages: Record<string, Page>;
  templates: Template[];
  me: Me | null;
  /** People (M11) and their board; absent in older exports. */
  people: Contact[];
  peopleBoard: Board | null;
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
    ...(typeof c.rank === 'number' ? { rank: c.rank } : {}),
    // Stage statuses from Reacher Test v12, turned back into Status below.
    ...(isPlainObject(c.stages) ? { stages: c.stages } : {}),
    ...(c.example ? { example: true } : {}),
    ...(isPlainObject(c.sprints) ? { sprints: sprintEntries(c.sprints) } : {}),
  }));
  const companyIds = new Set(companies.map((c) => c.id));
  const people: Contact[] = arr(raw.people)
    .filter(withId)
    .map((p) => ({
      id: str(p.id),
      name: str(p.name).trim() || 'Untitled',
      order: typeof p.order === 'number' ? p.order : 0,
      meta: isPlainObject(p.meta) ? p.meta : {},
      due: null,
      ...(typeof p.rank === 'number' ? { rank: p.rank } : {}),
      companyId: companyIds.has(str(p.companyId)) ? str(p.companyId) : null,
      ...(Array.isArray(p.pastCompanies)
        ? { pastCompanies: p.pastCompanies as Contact['pastCompanies'] }
        : {}),
    }));
  const pageOwners = new Set([...companyIds, ...people.map((p) => p.id)]);

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
      if (!pageOwners.has(cid) || !isPlainObject(p)) continue;
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
        ...(Array.isArray(p.events) ? { events: p.events.filter(withId) as FeedEvent[] } : {}),
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

  const sprints: Sprint[] = arr(raw.sprints)
    .filter(withId)
    .map((x, i) => ({
      id: str(x.id),
      name: str(x.name) || 'Sprint',
      start: str(x.start),
      end: typeof x.end === 'string' && x.end ? x.end : null,
      order: typeof x.order === 'number' ? x.order : i,
    }));

  const board = boardOrDefault(isPlainObject(raw.board) ? raw.board : null);
  return {
    sprints,
    board,
    // Saved with stages (Reacher Test v12): back to one Status.
    companies: companies.map((c) => unstageCompany(board, c)),
    chains,
    pages,
    templates,
    me,
    people,
    peopleBoard: isPlainObject(raw.peopleBoard) ? peopleBoardOrDefault(raw.peopleBoard) : null,
  };
}

/** "34 companies, 12 email chains, 20 notes…" for the confirm step. */
export function describeImport(d: ImportData) {
  const pages = Object.values(d.pages);
  const count = (k: 'notes' | 'applications' | 'meetings') =>
    pages.reduce((n, p) => n + p[k].length, 0);
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

function sprintEntries(raw: Record<string, unknown>): Record<string, SprintEntry> {
  const out: Record<string, SprintEntry> = {};
  for (const [id, e] of Object.entries(raw))
    if (isPlainObject(e))
      out[id] = {
        meta: isPlainObject(e.meta)
          ? e.meta
          : { status: statusFromStages(isPlainObject(e.stages) ? e.stages : {}) },
        added: str(e.added),
        updated: str(e.updated),
      };
  return out;
}
