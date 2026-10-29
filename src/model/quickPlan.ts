import { coerce, findCompany, matchOption, missingOptions, type QuickAction } from './aiActions';
import { colByName, isEmptyValue, meta, metaPatch } from './board';
import { isPlainObject, norm, uid } from './text';
import type { Board, Chain, Company, Meeting, Page } from './types';

/** Everything needed to put things back the way they were before a quick update. */
export type QuickUndo = {
  /** Companies the update created: Undo deletes them (with their pages and chains). */
  created: string[];
  /** Companies it changed, as they were. */
  companies: Company[];
  /** Their pages as they were (null: there was none). */
  pages: Record<string, Page | null>;
  /** Their chains as they were. */
  chains: Record<string, Chain[]>;
  /** The board as it was, when the update added list choices. */
  board: Board | null;
};

/** The writes a quick update makes. */
export type QuickPlan = {
  /** Actions that changed something. */
  applied: QuickAction[];
  /** Actions skipped because the tracker already had them (Zack, round 2). */
  skipped: QuickAction[];
  companies: Company[];
  pages: Record<string, Page>;
  chains: Chain[];
  board: Board | null;
  created: Company[];
  /** Meetings the update added, so upcoming ones can go on Google Calendar (M8). */
  newMeetings: { companyId: string; meeting: Meeting }[];
  undo: QuickUndo;
};

type State = {
  board: Board;
  companies: Company[];
  pages: Record<string, Page>;
  chains: Chain[];
};

const emptyPage = (): Page => ({ notes: [], applications: [], meetings: [] });

const words = (t: string) =>
  new Set(
    t
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2),
  );

/** Two short texts say the same thing: one contains the other, or most words overlap. */
export function similarText(a: string, b: string) {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return na === nb;
  if (na.includes(nb) || nb.includes(na)) return true;
  const wa = words(a);
  const wb = words(b);
  const shared = [...wa].filter((w) => wb.has(w)).length;
  return shared / Math.max(1, Math.min(wa.size, wb.size)) >= 0.6;
}

/**
 * Applies cleaned actions to copies of the data (the prototype's applyQuick).
 * Nothing is written here; the caller writes the plan and keeps its undo.
 */
export function planQuick(state: State, actions: QuickAction[], now = Date.now()): QuickPlan {
  let board: Board | null = null;
  const work = new Map<string, Company>();
  const created: Company[] = [];
  const newMeetings: QuickPlan['newMeetings'] = [];
  const pages = new Map<string, Page>();
  const chains = new Map<string, Chain>();
  const undo: QuickUndo = { created: [], companies: [], pages: {}, chains: {}, board: null };
  const applied: QuickAction[] = [];
  const skipped: QuickAction[] = [];

  const current = () => [...state.companies.map((c) => work.get(c.id) ?? c), ...created];
  const company = (name: string): Company => {
    const found = findCompany(current(), name);
    if (found) {
      if (!work.has(found.id) && !created.includes(found)) {
        undo.companies.push(structuredClone(found));
        undo.pages[found.id] = state.pages[found.id]
          ? structuredClone(state.pages[found.id]!)
          : null;
        undo.chains[found.id] = state.chains
          .filter((ch) => ch.companyId === found.id)
          .map((ch) => structuredClone(ch));
        work.set(found.id, structuredClone(found));
      }
      return work.get(found.id) ?? found;
    }
    const c: Company = {
      id: uid('co'),
      name,
      order: now + created.length,
      meta: {},
      auto: {},
      due: null,
    };
    created.push(c);
    undo.created.push(c.id);
    return c;
  };
  const page = (id: string) => {
    if (!pages.has(id)) {
      const p = state.pages[id];
      pages.set(id, p ? structuredClone(p) : emptyPage());
    }
    return pages.get(id)!;
  };
  const curBoard = () => board ?? state.board;
  const setMeta = (c: Company, colId: string, value: unknown) => {
    const patch = metaPatch(curBoard(), c, colId, value);
    c.meta = { ...c.meta, ...patch.meta };
    c.auto = { ...c.auto, [colId]: null };
  };

  for (const a of actions) {
    const existed = !!findCompany(current(), a.company);
    const c = company(a.company);
    let changed = true;
    switch (a.type) {
      case 'add_company':
        changed = !existed;
        break;
      case 'set_status': {
        const col = colByName(curBoard(), a.column);
        const v = col && coerce(col, a.value);
        changed = !!col && !!v && meta(c, col.id) !== v;
        if (changed) setMeta(c, col!.id, v);
        break;
      }
      case 'log_email': {
        const mine = (ch: Chain) => ch.companyId === c.id && norm(ch.title) === norm(a.chain);
        let ch =
          [...chains.values()].find(mine) ??
          (state.chains.find(mine) ? structuredClone(state.chains.find(mine)!) : undefined);
        // The same email already in any of this company's chains: skip it.
        const allMessages = [
          ...state.chains.filter((x) => x.companyId === c.id && x.id !== ch?.id),
          ...(ch ? [ch] : []),
        ].flatMap((x) => x.messages);
        if (
          allMessages.some(
            (m) => m.date === a.date && m.dir === a.dir && similarText(m.text, a.text),
          )
        ) {
          changed = false;
          break;
        }
        ch ??= {
          id: uid('ch'),
          companyId: c.id,
          title: a.chain,
          started: a.date,
          messages: [],
          summary: null,
        };
        ch.messages = [...ch.messages, { id: uid('m'), dir: a.dir, date: a.date, text: a.text }];
        if (!ch.started || a.date < ch.started) ch.started = a.date;
        chains.set(ch.id, ch);
        break;
      }
      case 'add_note': {
        const p = page(c.id);
        changed = !p.notes.some((n) => n.date === a.date && similarText(n.text, a.text));
        if (changed) p.notes.push({ id: uid('n'), date: a.date, text: a.text });
        break;
      }
      case 'add_application': {
        const p = page(c.id);
        changed = !p.applications.some((x) => x.date === a.date && norm(x.role) === norm(a.role));
        if (changed)
          p.applications.push({
            id: uid('a'),
            date: a.date,
            role: a.role,
            link: a.link,
            result: a.result,
          });
        break;
      }
      case 'add_meeting': {
        // One meeting of a kind per company per day: a second one is a repeat.
        const p = page(c.id);
        changed = !p.meetings.some((m) => m.date === a.date && m.kind === a.kind);
        if (changed) {
          const meeting: Meeting = {
            id: uid('mt'),
            date: a.date,
            start: a.start,
            end: a.end,
            kind: a.kind,
            with: a.with,
            notes: a.notes,
          };
          p.meetings.push(meeting);
          newMeetings.push({ companyId: c.id, meeting });
        }
        break;
      }
      case 'set_follow_up':
        changed = c.due !== a.date;
        c.due = a.date;
        break;
      case 'set_field': {
        const col = colByName(curBoard(), a.column);
        if (!col) {
          changed = false;
          break;
        }
        const v = matchOption(col, coerce(col, a.value));
        if (JSON.stringify(meta(c, col.id)) === JSON.stringify(v)) {
          changed = false;
          break;
        }
        const add = missingOptions(col, v);
        if (add.length) {
          undo.board ??= structuredClone(state.board);
          const b = structuredClone(curBoard());
          const target = b.columns.find((x) => x.id === col.id)!;
          target.options = [...(target.options ?? []), ...add];
          board = b;
        }
        setMeta(c, col.id, v);
        break;
      }
    }
    (changed ? applied : skipped).push(a);
  }

  return {
    applied,
    skipped,
    companies: [...work.values()],
    pages: Object.fromEntries(pages),
    chains: [...chains.values()],
    board,
    created,
    newMeetings,
    undo,
  };
}

export type Candidate = { name: string; about: string; fields: Record<string, unknown> };

/** Lookup candidates from the AI, tidied: up to 4, each with a name. */
export function cleanCandidates(raw: unknown): Candidate[] {
  const list = isPlainObject(raw) && Array.isArray(raw.candidates) ? raw.candidates : [];
  return list
    .filter((x): x is Record<string, unknown> => isPlainObject(x) && !!x.name)
    .slice(0, 4)
    .map((x) => ({
      name: String(x.name),
      about: String(x.about ?? ''),
      fields: isPlainObject(x.fields) ? x.fields : {},
    }));
}

/**
 * What picking a lookup candidate changes (the prototype's applyCandidate):
 * fills only empty fields (or ones lookup filled before), marks them as
 * looked up, and fixes the name. Returns the filled column names too.
 */
export function planCandidate(board: Board, c: Company, cand: Candidate, fillable: string[]) {
  const patch: { meta: Record<string, unknown>; auto: Record<string, boolean>; name?: string } = {
    meta: {},
    auto: {},
  };
  const filled: string[] = [];
  const newOptions: Record<string, string[]> = {};
  for (const [k, raw] of Object.entries(cand.fields)) {
    const col = colByName(board, k);
    if (!col || !fillable.includes(col.id)) continue;
    if (!isEmptyValue(meta(c, col.id)) && !c.auto?.[col.id]) continue;
    const coerced = coerce(col, raw);
    if (coerced === undefined) continue;
    const v = matchOption(col, coerced);
    const add = missingOptions(col, v);
    if (add.length) newOptions[col.id] = add;
    patch.meta[col.id] = v;
    patch.auto[col.id] = true;
    filled.push(col.name);
  }
  if (cand.name && cand.name !== c.name) patch.name = cand.name;
  return { patch, filled, newOptions };
}
