import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useToast } from '../components/Toast';
import { nextStatus, type StatusEvent } from '../model/automation';
import { boardOrDefault, colById, metaPatch, optionOf, statusCol } from '../model/board';
import { findCompany, describeAction, type QuickAction } from '../model/aiActions';
import { makeEvent, statusText } from '../model/events';
import {
  joinPatch,
  mirrorStatus,
  newestSprint,
  newSprint,
  statusPatch,
  targetSprint,
} from '../model/sprints';
import { readPref, writePref } from '../lib/prefs';
import { addDays, fmtDate, todayISO } from '../model/dates';
import { DEFAULT_TEMPLATES } from '../model/defaults';
import { fillableColumns } from '../ai/prompts';
import type { ImportData } from '../model/importData';
import { planCandidate, type Candidate, type QuickPlan, type QuickUndo } from '../model/quickPlan';
import { norm, uid } from '../model/text';
import type {
  Application,
  Board,
  Chain,
  Company,
  Me,
  Meeting,
  Message,
  Note,
  Page,
  FeedEvent,
  Sprint,
  Template,
} from '../model/types';
import { useRuntime } from '../runtime/RuntimeProvider';
import type { Json, Store } from '../runtime/store';

/**
 * Everything the user has, live, plus the actions that change it. Views read
 * from here and never touch the store directly.
 */
export type Workspace = {
  loading: boolean;
  board: Board;
  companies: Company[];
  pages: Record<string, Page>;
  chains: Chain[];
  templates: Template[];
  me: Me | null;
  /** Sprints, oldest first (M7). */
  sprints: Sprint[];
  /** The sprint on screen, or null for All companies. */
  sprint: string | null;
  setSprint: (id: string | null) => void;
  actions: Actions;
};

/** Pages written in the last few seconds, read before the store catches up, so quick writes don't overwrite each other. */
type Pending = Map<string, { page: Page; at: number }>;
const PENDING_MS = 5000;

export type Actions = ReturnType<typeof makeActions>;

const WorkspaceContext = createContext<Workspace | null>(null);

export function useWorkspace() {
  const ws = useContext(WorkspaceContext);
  if (!ws) throw new Error('useWorkspace needs a WorkspaceProvider');
  return ws;
}

/** Stands in until the connection is ready: reads nothing, refuses writes. */
const NOT_READY: Store = {
  getDoc: async () => null,
  setDoc: () => Promise.reject(new Error('Still connecting')),
  watchDoc: () => () => {},
  watchCollection: () => () => {},
  setItem: () => Promise.reject(new Error('Still connecting')),
  updateItem: () => Promise.reject(new Error('Still connecting')),
  deleteItem: () => Promise.reject(new Error('Still connecting')),
};

const withIds = <T,>(items: Record<string, Json>) =>
  Object.entries(items).map(([id, v]) => ({ ...v, id }) as T);

/** A store item without its id (the id is the key). */
const body = <T extends { id: string }>(item: T): Json => {
  const rest: Json = { ...item };
  delete rest.id;
  return rest;
};

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const runtime = useRuntime();
  const store = runtime.status === 'ready' ? runtime.store : null;
  const toast = useToast();

  const [board, setBoard] = useState<Board | null | undefined>();
  const [companies, setCompanies] = useState<Company[] | undefined>();
  const [pages, setPages] = useState<Record<string, Page>>({});
  const [chains, setChains] = useState<Chain[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  // 'all' = All companies; undefined = not chosen yet (the newest sprint).
  const [chosen, setChosen] = useState<string | undefined>(() =>
    readPref<string | undefined>('sprint', undefined, (v): v is string => typeof v === 'string'),
  );
  // One map for the provider's life (state, not a ref: it's read while rendering).
  const [pending] = useState<Pending>(() => new Map());

  useEffect(() => {
    if (!store) return;
    const stops = [
      store.watchDoc<Board>('board', setBoard),
      store.watchDoc<Me>('me', setMe),
      store.watchCollection('companies', (items) => setCompanies(withIds<Company>(items))),
      store.watchCollection<Page>('pages', setPages),
      store.watchCollection('chains', (items) => setChains(withIds<Chain>(items))),
      store.watchCollection('templates', (items) => setTemplates(withIds<Template>(items))),
      store.watchCollection('sprints', (items) =>
        setSprints(
          withIds<Sprint>(items).sort((a, b) =>
            a.start < b.start ? -1 : a.start > b.start ? 1 : a.order - b.order,
          ),
        ),
      ),
    ];
    return () => stops.forEach((stop) => stop());
  }, [store]);

  const fail = useCallback(
    (e: unknown) => {
      console.warn('Reacher: write failed', e);
      const code = (e as { code?: string } | null)?.code;
      if (code === 'quota_exceeded')
        toast('Storage is full. Delete some companies or emails, then try again.');
      else if (code === 'invalid_argument')
        toast("That change couldn't be saved. You may only have view access.");
      else toast("Couldn't save that change. Try again in a moment.");
    },
    [toast],
  );

  const resolvedBoard = boardOrDefault(board);
  const sprint =
    chosen === 'all'
      ? null
      : (sprints.find((x) => x.id === chosen)?.id ?? newestSprint(sprints)?.id ?? null);
  const setSprint = useCallback((id: string | null) => {
    setChosen(id ?? 'all');
    writePref('sprint', id ?? 'all');
  }, []);
  const actions = useMemo(
    () =>
      makeActions(
        store ?? NOT_READY,
        resolvedBoard,
        companies ?? [],
        pages,
        chains,
        templates,
        sprints,
        sprint,
        pending,
        fail,
      ),
    [store, resolvedBoard, companies, pages, chains, templates, sprints, sprint, pending, fail],
  );

  const value = useMemo<Workspace>(
    () => ({
      loading: !store || companies === undefined || board === undefined,
      board: resolvedBoard,
      companies: companies ?? [],
      pages,
      chains,
      // A new account starts with the default templates until it saves its own.
      templates: templates.length ? templates : DEFAULT_TEMPLATES,
      me,
      sprints,
      sprint,
      setSprint,
      actions,
    }),
    [
      store,
      actions,
      companies,
      board,
      resolvedBoard,
      pages,
      chains,
      templates,
      me,
      sprints,
      sprint,
      setSprint,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

function makeActions(
  store: Store,
  board: Board,
  companies: Company[],
  pages: Record<string, Page>,
  chains: Chain[],
  storedTemplates: Template[],
  sprints: Sprint[],
  active: string | null,
  pending: Pending,
  fail: (e: unknown) => void,
) {
  const company = (id: string) => companies.find((c) => c.id === id);
  const guard = (p: Promise<unknown>) => p.catch(fail);
  const isStatusCol = (colId: string) => colById(board, colId)?.type === 'status';
  /** Where a change to this company lands: the sprint on screen, else its newest. */
  const sprintFor = (c: Company) => targetSprint(c, sprints, active);
  /** A status change as a feed event. */
  const statusEvent = (
    c: Company,
    sprintId: string | null,
    colId: string,
    to: unknown,
    by: FeedEvent['by'],
  ) => {
    const from = (sprintId ? c.sprints?.[sprintId]?.meta?.[colId] : c.meta?.[colId]) ?? null;
    return makeEvent('status', statusText(board, colId, from, to), by, {
      sprintId,
      status: { col: colId, from: from as string | null, to: (to as string | null) ?? null },
    });
  };

  const api = {
    /** An exact (by letters and digits) match on name, for duplicate checks. */
    findByName(name: string) {
      const n = norm(name);
      return n ? companies.find((c) => norm(c.name) === n) : undefined;
    },

    /** Adds a company at the bottom of the sheet (and to the sprint on screen); returns it. */
    addCompany(name: string): Company {
      const id = uid('co');
      const c: Company = {
        id,
        name: name.trim(),
        order: Date.now(),
        meta: {},
        auto: {},
        due: null,
        ...(active ? { sprints: joinPatch(board, { meta: {} } as Company, active).sprints } : {}),
      };
      void guard(store.setItem('companies', id, body(c)));
      api.logEvents(id, [makeEvent('company', 'Added to Reacher', 'you', { sprintId: active })]);
      return c;
    },

    // ---------- sprints (M7) ----------

    /** Makes a sprint named "<name> <today>"; returns its id. */
    createSprint(name: string) {
      const s = newSprint(name, Date.now());
      void guard(store.setItem('sprints', s.id, body(s)));
      return s.id;
    },

    updateSprint(s: Sprint) {
      void guard(store.setItem('sprints', s.id, body(s)));
    },

    /** Deletes a sprint; its companies stay, with their statuses from other sprints. */
    deleteSprint(id: string) {
      void guard(
        Promise.all([
          store.deleteItem('sprints', id),
          ...companies
            .filter((c) => c.sprints?.[id])
            .map((c) => store.updateItem('companies', c.id, { sprints: { [id]: null } })),
        ]),
      );
    },

    /** Puts an existing company in a sprint, starting from its current status. */
    addToSprint(companyId: string, sprintId: string) {
      const c = company(companyId);
      if (!c || c.sprints?.[sprintId]) return;
      void guard(store.updateItem('companies', c.id, joinPatch(board, c, sprintId)));
      const s = sprints.find((x) => x.id === sprintId);
      api.logEvents(c.id, [
        makeEvent('sprint', `Added to ${s?.name ?? 'a sprint'}`, 'you', { sprintId }),
      ]);
    },

    removeFromSprint(companyId: string, sprintId: string) {
      void guard(store.updateItem('companies', companyId, { sprints: { [sprintId]: null } }));
    },

    // ---------- events (M7) ----------

    /** Adds events to a company's feed. */
    logEvents(id: string, events: FeedEvent[]) {
      if (!events.length) return;
      const p = api.pageOf(id);
      api.savePage(id, { ...p, events: [...(p.events ?? []), ...events] });
    },

    /** A comment on a company, from its side panel. */
    comment(id: string, text: string, sprintId: string | null = active) {
      api.logEvents(id, [makeEvent('comment', text, 'you', { sprintId })]);
    },

    renameCompany(id: string, name: string) {
      if (name.trim()) void guard(store.updateItem('companies', id, { name: name.trim() }));
    },

    /** Deletes a company with its page and email chains. */
    async deleteCompany(id: string) {
      await guard(
        Promise.all([
          store.deleteItem('companies', id),
          pages[id] ? store.deleteItem('pages', id) : null,
          ...chains
            .filter((ch) => ch.companyId === id)
            .map((ch) => store.deleteItem('chains', ch.id)),
        ]),
      );
    },

    /**
     * Sets one column for one company (clearing dependent columns, like
     * Outcome). Status columns land in the sprint on screen (or the company's
     * newest) and in its latest status, and go in the feed.
     */
    setMeta(id: string, colId: string, value: unknown, by: FeedEvent['by'] = 'you') {
      const c = company(id);
      if (!c) return;
      if (!isStatusCol(colId)) {
        void guard(store.updateItem('companies', id, metaPatch(board, c, colId, value)));
        return;
      }
      const sid = sprintFor(c);
      const ev = statusEvent(c, sid, colId, value, by);
      void guard(store.updateItem('companies', id, statusPatch(board, c, sid, colId, value)));
      api.logEvents(id, [ev]);
    },

    /** Changes the status of several companies at once (Kitsu's multi-select), with one comment for all. */
    setStatusMany(ids: string[], colId: string, value: unknown, text = '') {
      for (const id of ids) {
        const c = company(id);
        if (!c) continue;
        const sid = sprintFor(c);
        const events = [statusEvent(c, sid, colId, value, 'you')];
        if (text.trim()) events.push(makeEvent('comment', text.trim(), 'you', { sprintId: sid }));
        void guard(store.updateItem('companies', id, statusPatch(board, c, sid, colId, value)));
        api.logEvents(id, events);
      }
    },

    /** A Board drop: new lane (status) and position, in one write. */
    moveCard(id: string, status: string | null, rank: number) {
      const c = company(id);
      if (!c) return;
      const sid = sprintFor(c);
      const current = (sid ? c.sprints?.[sid]?.meta?.status : c.meta?.status) ?? null;
      const statusChanged = current !== status;
      const patch = statusChanged
        ? { ...statusPatch(board, c, sid, 'status', status), rank }
        : { rank };
      void guard(store.updateItem('companies', id, patch));
      if (statusChanged) api.logEvents(id, [statusEvent(c, sid, 'status', status, 'you')]);
    },

    setDue(id: string, due: string | null) {
      void guard(store.updateItem('companies', id, { due }));
    },

    saveBoard(next: Board) {
      void guard(store.setDoc('board', { ...next, version: 2 }));
    },

    // ---------- email ----------

    /** Saves a template. The first save also keeps the starting set, which until now was only shown. */
    saveTemplate(t: Template) {
      const base = storedTemplates.length ? [] : DEFAULT_TEMPLATES.filter((d) => d.id !== t.id);
      void guard(Promise.all([...base, t].map((x) => store.setItem('templates', x.id, body(x)))));
    },

    deleteTemplate(id: string) {
      if (storedTemplates.length) void guard(store.deleteItem('templates', id));
      else
        void guard(
          Promise.all(
            DEFAULT_TEMPLATES.filter((d) => d.id !== id).map((x) =>
              store.setItem('templates', x.id, body(x)),
            ),
          ),
        );
    },

    /**
     * Log as sent (SPEC section 7): adds the email to the chosen chain (or a
     * new one titled by its subject), sets the follow-up, and moves the status.
     * Returns the chain id and a toast line.
     */
    logSent(c: Company, target: string, subject: string, text: string, followDays: number) {
      const today = todayISO();
      const msg = {
        id: uid('m'),
        dir: 'out' as const,
        date: today,
        text: (subject ? `Subject: ${subject}\n\n` : '') + text,
      };
      const existing = target !== 'new' ? chains.find((ch) => ch.id === target) : undefined;
      const chain: Chain = existing
        ? { ...existing, messages: [...existing.messages, msg] }
        : {
            id: uid('ch'),
            companyId: c.id,
            title: subject || `Email chain ${fmtDate(today)}`,
            started: today,
            messages: [msg],
            summary: null,
          };
      api.saveChain(chain);
      const due = addDays(today, followDays);
      const label = api.autoStatus(c.id, { kind: 'sent' }, { due }, [
        makeEvent('email', `Sent: ${subject || text.split('\n')[0]!.slice(0, 80)}`, 'you', {
          sprintId: sprintFor(c),
        }),
      ]);
      return {
        chainId: chain.id,
        toast: `Logged${label ? `. Status → ${label}` : ''}. Follow up ${fmtDate(due, true)}`,
      };
    },

    // ---------- AI ----------

    /**
     * Writes a quick update's plan (see model/quickPlan). Status changes also
     * land in each company's sprint (the one on screen, else its newest); new
     * companies join the sprint on screen. Each company's feed gets the note
     * and what the AI changed.
     */
    applyQuick(plan: QuickPlan, note: string) {
      const today = todayISO();
      const created = plan.created.map((c) =>
        active ? { ...c, ...joinPatch(board, c, active, today) } : c,
      );
      const changed = plan.companies.map((c) =>
        mirrorStatus(board, company(c.id), c, sprintFor(company(c.id) ?? c), today),
      );
      const all = [...changed, ...created];
      const byCompany = new Map<string, QuickAction[]>();
      for (const a of plan.applied) {
        const c = findCompany(all, a.company);
        if (c) byCompany.set(c.id, [...(byCompany.get(c.id) ?? []), a]);
      }
      const pagesOut: Record<string, Page> = { ...plan.pages };
      for (const [id, acts] of byCompany) {
        const c = all.find((x) => x.id === id)!;
        const sid = sprintFor(company(id) ?? c) ?? (active && c.sprints?.[active] ? active : null);
        const events = [
          makeEvent('comment', note, 'you', { sprintId: sid }),
          ...acts.map((a) => {
            if (a.type !== 'set_status')
              return makeEvent(KIND_OF[a.type], describeAction(board, a), 'ai', { sprintId: sid });
            const colId = board.columns.find((col) => col.name === a.column)?.id ?? 'status';
            const from = (company(id)?.meta ?? {})[colId] ?? null;
            return makeEvent('status', statusText(board, colId, from, c.meta[colId]), 'ai', {
              sprintId: sid,
              status: {
                col: colId,
                from: from as string | null,
                to: (c.meta[colId] as string) ?? null,
              },
            });
          }),
        ];
        const p = pagesOut[id] ?? api.pageOf(id);
        pagesOut[id] = { ...p, events: [...(p.events ?? []), ...events] };
      }
      const writes: Promise<unknown>[] = [
        ...created.map((c) => store.setItem('companies', c.id, body(c))),
        ...changed.map((c) => store.setItem('companies', c.id, body(c))),
        ...Object.entries(pagesOut).map(([id, p]) => {
          pending.set(id, { page: p, at: Date.now() });
          return store.setItem('pages', id, p as unknown as Json);
        }),
        ...plan.chains.map((ch) => store.setItem('chains', ch.id, body(ch))),
      ];
      if (plan.board) writes.push(store.setDoc('board', plan.board as unknown as Json));
      void guard(Promise.all(writes));
    },

    /** Puts back everything a quick update touched. */
    async undoQuick(undo: QuickUndo) {
      const writes: Promise<unknown>[] = undo.created.map((id) => api.deleteCompany(id));
      for (const c of undo.companies) {
        writes.push(store.setItem('companies', c.id, body(c)));
        const p = undo.pages[c.id];
        if (p) writes.push(store.setItem('pages', c.id, p as unknown as Json));
        else if (pages[c.id]) writes.push(store.deleteItem('pages', c.id));
        const keep = new Set((undo.chains[c.id] ?? []).map((ch) => ch.id));
        for (const ch of chains)
          if (ch.companyId === c.id && !keep.has(ch.id))
            writes.push(store.deleteItem('chains', ch.id));
        for (const ch of undo.chains[c.id] ?? [])
          writes.push(store.setItem('chains', ch.id, body(ch)));
      }
      if (undo.board) writes.push(store.setDoc('board', undo.board as unknown as Json));
      await guard(Promise.all(writes));
    },

    /** Fills a company from a lookup candidate; returns the names of the fields filled. */
    applyCandidate(c: Company, cand: Candidate) {
      const fillable = fillableColumns(board).map((col) => col.id);
      const { patch, filled, newOptions } = planCandidate(board, c, cand, fillable);
      if (Object.keys(newOptions).length)
        api.saveBoard({
          ...board,
          columns: board.columns.map((col) =>
            newOptions[col.id]
              ? { ...col, options: [...(col.options ?? []), ...newOptions[col.id]!] }
              : col,
          ),
        });
      void guard(store.updateItem('companies', c.id, patch));
      if (filled.length)
        api.logEvents(c.id, [makeEvent('field', `Looked up: ${filled.join(', ')}`, 'ai')]);
      return filled;
    },

    saveSummary(chain: Chain, text: string) {
      api.saveChain({ ...chain, summary: { text, at: todayISO(), count: chain.messages.length } });
    },

    // ---------- company page ----------

    /**
     * Applies the automatic status change for an event (SPEC section 3), plus
     * any other company fields in the same write. Returns the new status's
     * label for the "Status → X" toast, or null when nothing moved.
     */
    autoStatus(
      id: string,
      event: StatusEvent,
      also: Record<string, unknown> = {},
      events: FeedEvent[] = [],
      by: FeedEvent['by'] = 'you',
    ) {
      const c = company(id);
      if (!c) return null;
      const sid = sprintFor(c);
      const seen =
        sid && c.sprints?.[sid] ? { ...c, meta: { ...c.meta, ...c.sprints[sid]!.meta } } : c;
      const next = nextStatus(board, seen, event);
      const patch = next ? { ...statusPatch(board, c, sid, 'status', next), ...also } : also;
      if (Object.keys(patch).length) void guard(store.updateItem('companies', id, patch));
      api.logEvents(id, next ? [...events, statusEvent(c, sid, 'status', next, by)] : events);
      return next ? (optionOf(statusCol(board), next)?.label ?? next) : null;
    },

    pageOf(id: string): Page {
      const recent = pending.get(id);
      const p = recent && Date.now() - recent.at < PENDING_MS ? recent.page : pages[id];
      return {
        notes: p?.notes ?? [],
        applications: p?.applications ?? [],
        meetings: p?.meetings ?? [],
        events: p?.events ?? [],
      };
    },

    savePage(id: string, page: Page) {
      pending.set(id, { page, at: Date.now() });
      void guard(store.setItem('pages', id, page as unknown as Json));
    },

    addNote(id: string, note: Omit<Note, 'id'>) {
      const p = api.pageOf(id);
      api.savePage(id, { ...p, notes: [...p.notes, { id: uid('n'), ...note }] });
    },

    /** Adds an application; returns the new status label if it moved. */
    addApplication(id: string, app: Omit<Application, 'id'>) {
      const p = api.pageOf(id);
      const c = company(id);
      api.savePage(id, { ...p, applications: [...p.applications, { id: uid('a'), ...app }] });
      return api.autoStatus(id, { kind: 'applied' }, {}, [
        makeEvent('application', `Applied${app.role ? `: ${app.role}` : ''}`, 'you', {
          sprintId: c ? sprintFor(c) : null,
        }),
      ]);
    },

    /** Adds a meeting or interview; returns the new status label if it moved. */
    /** Pass `id` to know the new entry's id (to link it to a calendar event after). */
    addMeeting(id: string, meeting: Omit<Meeting, 'id'> & { id?: string }) {
      const p = api.pageOf(id);
      const c = company(id);
      api.savePage(id, {
        ...p,
        meetings: [...p.meetings, { ...meeting, id: meeting.id ?? uid('mt') }],
      });
      const what = meeting.kind === 'interview' ? 'Interview' : 'Meeting';
      return api.autoStatus(id, { kind: 'meeting', meetingKind: meeting.kind }, {}, [
        makeEvent(
          'meeting',
          `${what} on ${fmtDate(meeting.date)}${meeting.with ? ` with ${meeting.with}` : ''}`,
          'you',
          {
            sprintId: c ? sprintFor(c) : null,
          },
        ),
      ]);
    },

    /** Changes fields on one meeting (e.g. its calendar link once it's on Google Calendar). */
    patchMeeting(id: string, meetingId: string, patch: Partial<Omit<Meeting, 'id'>>) {
      const p = api.pageOf(id);
      api.savePage(id, {
        ...p,
        meetings: p.meetings.map((m) => (m.id === meetingId ? { ...m, ...patch } : m)),
      });
    },

    deleteEntry(id: string, kind: keyof Page, entryId: string) {
      const p = api.pageOf(id);
      api.savePage(id, {
        ...p,
        [kind]: (p[kind] as { id: string }[]).filter((x) => x.id !== entryId),
      });
    },

    saveChain(chain: Chain) {
      void guard(store.setItem('chains', chain.id, body(chain)));
    },

    /** Starts an empty chain; returns its id. */
    newChain(companyId: string, title: string) {
      const ch: Chain = {
        id: uid('ch'),
        companyId,
        title,
        started: todayISO(),
        messages: [],
        summary: null,
      };
      api.saveChain(ch);
      return ch.id;
    },

    /** Deletes a chain. One that follows a Gmail thread stays deleted: syncing skips that thread. */
    deleteChain(chainId: string) {
      const ch = chains.find((x) => x.id === chainId);
      const c = ch && company(ch.companyId);
      if (ch?.gmailThreadId && c)
        void guard(
          store.updateItem('companies', c.id, {
            gmailIgnore: [...(c.gmailIgnore ?? []), ch.gmailThreadId],
          }),
        );
      void guard(store.deleteItem('chains', chainId));
    },

    /**
     * Adds a pasted email. From them: Wrote back!! and the follow-up clears.
     * From me: Reached out or Replied. Returns the new status label if it moved.
     */
    addEmail(chain: Chain, msg: Omit<Message, 'id'>) {
      const started = !chain.started || msg.date < chain.started ? msg.date : chain.started;
      api.saveChain({ ...chain, started, messages: [...chain.messages, { id: uid('m'), ...msg }] });
      const c = company(chain.companyId);
      const ev = makeEvent(
        'email',
        `${msg.dir === 'in' ? 'Email from them' : 'Email from you'}: ${msg.text.split('\n')[0]!.slice(0, 80)}`,
        'you',
        { sprintId: c ? sprintFor(c) : null },
      );
      return msg.dir === 'in'
        ? api.autoStatus(chain.companyId, { kind: 'received' }, c?.due ? { due: null } : {}, [ev])
        : api.autoStatus(chain.companyId, { kind: 'sent' }, {}, [ev]);
    },

    /**
     * Writes an export into this account. Items with the same id are replaced;
     * everything else is added. Columns, templates and Your details are replaced.
     */
    async importData(data: ImportData, onProgress: (done: number, total: number) => void) {
      const writes: (() => Promise<void>)[] = [
        () => store.setDoc('board', data.board),
        ...data.sprints.map((s) => () => store.setItem('sprints', s.id, body(s))),
        ...(data.me ? [() => store.setDoc('me', data.me as Json)] : []),
        ...data.companies.map((c) => () => store.setItem('companies', c.id, body(c))),
        ...Object.entries(data.pages).map(
          ([cid, p]) =>
            () =>
              store.setItem('pages', cid, p as Json),
        ),
        ...data.chains.map((ch) => () => store.setItem('chains', ch.id, body(ch))),
        ...data.templates.map((t) => () => store.setItem('templates', t.id, body(t))),
      ];
      await runPaced(writes, onProgress);
    },
  };
  return api;
}

/** What each quick-update action is in the feed. */
const KIND_OF: Record<QuickAction['type'], FeedEvent['kind']> = {
  add_company: 'company',
  set_status: 'status',
  log_email: 'email',
  add_note: 'comment',
  add_application: 'application',
  add_meeting: 'meeting',
  set_follow_up: 'field',
  set_field: 'field',
};

/**
 * Runs many writes a few at a time, backing off and retrying when the db says
 * to slow down, so a big import doesn't trip its rate limit.
 */
async function runPaced(
  writes: (() => Promise<void>)[],
  onProgress: (done: number, total: number) => void,
  concurrency = 4,
) {
  let next = 0;
  let done = 0;
  const retryable = (e: unknown) => {
    const code = (e as { code?: string } | null)?.code;
    return code === 'resource_exhausted' || code === 'unavailable';
  };
  const worker = async () => {
    while (next < writes.length) {
      const write = writes[next++]!;
      for (let attempt = 0; ; attempt++) {
        try {
          await write();
          break;
        } catch (e) {
          if (!retryable(e) || attempt >= 5) throw e;
          await new Promise((r) => setTimeout(r, 500 * 2 ** attempt + Math.random() * 300));
        }
      }
      onProgress(++done, writes.length);
    }
  };
  onProgress(0, writes.length);
  await Promise.all(Array.from({ length: concurrency }, worker));
}
