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
import { boardOrDefault, metaPatch, optionOf, statusCol } from '../model/board';
import { todayISO } from '../model/dates';
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
  actions: Actions;
};

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

  useEffect(() => {
    if (!store) return;
    const stops = [
      store.watchDoc<Board>('board', setBoard),
      store.watchDoc<Me>('me', setMe),
      store.watchCollection('companies', (items) => setCompanies(withIds<Company>(items))),
      store.watchCollection<Page>('pages', setPages),
      store.watchCollection('chains', (items) => setChains(withIds<Chain>(items))),
      store.watchCollection('templates', (items) => setTemplates(withIds<Template>(items))),
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
  const actions = useMemo(
    () => makeActions(store ?? NOT_READY, resolvedBoard, companies ?? [], pages, chains, fail),
    [store, resolvedBoard, companies, pages, chains, fail],
  );

  const value = useMemo<Workspace>(
    () => ({
      loading: !store || companies === undefined || board === undefined,
      board: resolvedBoard,
      companies: companies ?? [],
      pages,
      chains,
      templates,
      me,
      actions,
    }),
    [store, actions, companies, board, resolvedBoard, pages, chains, templates, me],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

function makeActions(
  store: Store,
  board: Board,
  companies: Company[],
  pages: Record<string, Page>,
  chains: Chain[],
  fail: (e: unknown) => void,
) {
  const company = (id: string) => companies.find((c) => c.id === id);
  const guard = (p: Promise<unknown>) => p.catch(fail);

  const api = {
    /** An exact (by letters and digits) match on name, for duplicate checks. */
    findByName(name: string) {
      const n = norm(name);
      return n ? companies.find((c) => norm(c.name) === n) : undefined;
    },

    /** Adds a company at the bottom of the sheet; returns it. */
    addCompany(name: string): Company {
      const id = uid('co');
      const c: Company = {
        id,
        name: name.trim(),
        order: Date.now(),
        meta: {},
        auto: {},
        due: null,
      };
      void guard(store.setItem('companies', id, body(c)));
      return c;
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

    /** Sets one column for one company (clearing dependent columns, like Outcome). */
    setMeta(id: string, colId: string, value: unknown) {
      const c = company(id);
      if (c) void guard(store.updateItem('companies', id, metaPatch(board, c, colId, value)));
    },

    setDue(id: string, due: string | null) {
      void guard(store.updateItem('companies', id, { due }));
    },

    saveBoard(next: Board) {
      void guard(store.setDoc('board', { ...next, version: 2 }));
    },

    // ---------- AI ----------

    /** Writes a quick update's plan (see model/quickPlan). */
    applyQuick(plan: QuickPlan) {
      const writes: Promise<unknown>[] = [
        ...plan.created.map((c) => store.setItem('companies', c.id, body(c))),
        ...plan.companies.map((c) => store.setItem('companies', c.id, body(c))),
        ...Object.entries(plan.pages).map(([id, p]) =>
          store.setItem('pages', id, p as unknown as Json),
        ),
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
    autoStatus(id: string, event: StatusEvent, also: Record<string, unknown> = {}) {
      const c = company(id);
      if (!c) return null;
      const next = nextStatus(board, c, event);
      const patch = next ? { ...metaPatch(board, c, 'status', next), ...also } : also;
      if (Object.keys(patch).length) void guard(store.updateItem('companies', id, patch));
      return next ? (optionOf(statusCol(board), next)?.label ?? next) : null;
    },

    pageOf(id: string): Page {
      const p = pages[id];
      return {
        notes: p?.notes ?? [],
        applications: p?.applications ?? [],
        meetings: p?.meetings ?? [],
      };
    },

    savePage(id: string, page: Page) {
      void guard(store.setItem('pages', id, page as unknown as Json));
    },

    addNote(id: string, note: Omit<Note, 'id'>) {
      const p = api.pageOf(id);
      api.savePage(id, { ...p, notes: [...p.notes, { id: uid('n'), ...note }] });
    },

    /** Adds an application; returns the new status label if it moved. */
    addApplication(id: string, app: Omit<Application, 'id'>) {
      const p = api.pageOf(id);
      api.savePage(id, { ...p, applications: [...p.applications, { id: uid('a'), ...app }] });
      return api.autoStatus(id, { kind: 'applied' });
    },

    /** Adds a meeting or interview; returns the new status label if it moved. */
    addMeeting(id: string, meeting: Omit<Meeting, 'id'>) {
      const p = api.pageOf(id);
      api.savePage(id, { ...p, meetings: [...p.meetings, { id: uid('mt'), ...meeting }] });
      return api.autoStatus(id, { kind: 'meeting', meetingKind: meeting.kind });
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

    deleteChain(chainId: string) {
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
      return msg.dir === 'in'
        ? api.autoStatus(chain.companyId, { kind: 'received' }, c?.due ? { due: null } : {})
        : api.autoStatus(chain.companyId, { kind: 'sent' });
    },

    /**
     * Writes an export into this account. Items with the same id are replaced;
     * everything else is added. Columns, templates and Your details are replaced.
     */
    async importData(data: ImportData, onProgress: (done: number, total: number) => void) {
      const writes: (() => Promise<void>)[] = [
        () => store.setDoc('board', data.board),
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
