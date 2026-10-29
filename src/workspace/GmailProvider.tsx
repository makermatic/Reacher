import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useToast } from '../components/Toast';
import { makeEvent } from '../model/events';
import { knownCount, latestEmail, mailQuery, syncThread, threadCompany } from '../model/gmail';
import type { Chain, Company } from '../model/types';
import type { ConnectorError } from '../runtime/connectors';
import { gmailErrorMessage, type DraftInput } from '../runtime/gmail';
import { useRuntime } from '../runtime/RuntimeProvider';
import { useWorkspace, type Workspace } from './WorkspaceProvider';

/** How far back a company's own check looks, and the all-companies check. */
const COMPANY_DAYS = 365;
const ALL_DAYS = 30;
/** A company page re-checks at most this often on its own; the button always checks. */
const RECHECK_MS = 5 * 60_000;
/** While Reacher is open, the all-companies check repeats this often. */
const ALL_EVERY_MS = 10 * 60_000;

export type GmailStatus = { checking: boolean; at?: number; error?: ConnectorError };

type GmailState = {
  /** The Gmail connector can be used from this view. */
  available: boolean;
  status: Record<string, GmailStatus>;
  /**
   * Brings this company's email threads into its chains. `ask`: a click, so
   * the connector may ask for the viewer's OK; otherwise only runs once
   * they've allowed Gmail, and not more than every few minutes.
   */
  checkCompany: (company: Company, ask: boolean) => Promise<void>;
  /** Saves a draft in Gmail. Resolves its link, or an error message. */
  saveDraft: (
    chain: Chain | null,
    draft: Omit<DraftInput, 'replyToMessageId'>,
  ) => Promise<{ link: string } | { error: string }>;
};

const GmailContext = createContext<GmailState | null>(null);

export function useGmail() {
  const g = useContext(GmailContext);
  if (!g) throw new Error('useGmail needs a GmailProvider');
  return g;
}

/**
 * Gmail for the whole app (M9). Once the viewer has allowed Gmail, Reacher
 * checks recent email with every company when it opens (and every 10
 * minutes), and a company's page checks its whole last year. New emails join
 * the matching chain; a reply moves the status like a pasted one would.
 */
export function GmailProvider({ children }: { children: ReactNode }) {
  const runtime = useRuntime();
  const ws = useWorkspace();
  const toast = useToast();
  const gmail = runtime.status === 'ready' ? runtime.gmail : null;
  const [status, setStatus] = useState<Record<string, GmailStatus>>({});

  // Gmail answers arrive after a wait; write to the latest data.
  const wsRef = useRef<Workspace>(ws);
  useEffect(() => {
    wsRef.current = ws;
  }, [ws]);
  const lastRun = useRef<Record<string, number>>({});
  /** Threads that turned out to be about no company, by message count: not fetched again until they grow. */
  const strays = useRef(new Map<string, number>());

  const patch = useCallback(
    (id: string, s: GmailStatus) => setStatus((cur) => ({ ...cur, [id]: s })),
    [],
  );

  /**
   * Fetches each thread with news and files it under its company. Returns
   * one line per company that changed, for the message.
   */
  const pull = useCallback(
    async (hits: { id: string; messageCount: number }[], only: Company | null) => {
      if (!gmail) return [];
      const { board, companies } = wsRef.current;
      let chains = [...wsRef.current.chains];
      const news = new Map<string, { company: Company; count: number; before: string }>();
      for (const hit of hits) {
        if (hit.messageCount && hit.messageCount <= knownCount(chains, hit.id)) continue;
        if (strays.current.get(hit.id) === hit.messageCount) continue;
        const thread = await gmail.thread(hit.id);
        if (!thread?.messages.length) continue;
        // Even a company's own search can catch strays; keep only threads that are really theirs.
        const company = threadCompany(board, only ? [only] : companies, thread);
        if (!company || company.gmailIgnore?.includes(thread.id)) {
          strays.current.set(hit.id, hit.messageCount);
          continue;
        }
        const before = news.get(company.id)?.before ?? latestEmail(chains, company.id);
        const r = syncThread(company, chains, thread);
        if (!r) continue;
        wsRef.current.actions.saveChain(r.chain);
        chains = [...chains.filter((c) => c.id !== r.chain.id), r.chain];
        const prev = news.get(company.id);
        news.set(company.id, { company, before, count: (prev?.count ?? 0) + r.added.length });
      }
      const lines: string[] = [];
      for (const { company, count, before } of news.values()) {
        if (!count) continue;
        // Only the newest email moves the status, and only if it's newer than what was there.
        const newest = chains
          .filter((c) => c.companyId === company.id)
          .flatMap((c) => c.messages)
          .reduce(
            (a, b) => (!a || b.date >= a.date ? b : a),
            null as Chain['messages'][number] | null,
          );
        let label: string | null = null;
        const { actions } = wsRef.current;
        // The feed gets one line for what came in from Gmail.
        const event = makeEvent(
          'email',
          `${count} new ${count === 1 ? 'email' : 'emails'} from Gmail`,
          'gmail',
        );
        if (newest?.gmailId && newest.date >= before) {
          label =
            newest.dir === 'in'
              ? actions.autoStatus(
                  company.id,
                  { kind: 'received' },
                  company.due ? { due: null } : {},
                  [event],
                  'gmail',
                )
              : actions.autoStatus(company.id, { kind: 'sent' }, {}, [event], 'gmail');
        } else actions.logEvents(company.id, [event]);
        lines.push(
          `${company.name}: ${count} new ${count === 1 ? 'email' : 'emails'} from Gmail${label ? `. Status → ${label}` : ''}`,
        );
      }
      return lines;
    },
    [gmail],
  );

  const checkCompany = useCallback(
    async (company: Company, ask: boolean) => {
      if (!gmail) return;
      const now = Date.now();
      if (!ask) {
        if (now - (lastRun.current[company.id] ?? 0) < RECHECK_MS) return;
        if (!(await gmail.allowed())) return;
      }
      lastRun.current[company.id] = now;
      const query = mailQuery(wsRef.current.board, [company], COMPANY_DAYS);
      if (!query) {
        patch(company.id, {
          checking: false,
          error: {
            code: 'no_address',
            message: 'Add a website or a contact’s email so Reacher knows which emails are theirs.',
          },
        });
        return;
      }
      patch(company.id, { checking: true });
      try {
        const lines = await pull(await gmail.search(query, 20), company);
        patch(company.id, { checking: false, at: Date.now() });
        if (lines.length) toast(lines.join(' · '));
      } catch (e) {
        patch(company.id, { checking: false, error: e as ConnectorError });
      }
    },
    [gmail, pull, patch, toast],
  );

  // Every company's recent email, once Gmail is allowed: on open, then every 10 minutes.
  const loading = ws.loading;
  useEffect(() => {
    if (!gmail || loading) return;
    let stopped = false;
    const run = async () => {
      if (stopped || !(await gmail.allowed())) return;
      const query = mailQuery(wsRef.current.board, wsRef.current.companies, ALL_DAYS);
      if (!query) return;
      try {
        const lines = await pull(await gmail.search(query, 50), null);
        if (!stopped && lines.length) toast(lines.join(' · '));
      } catch {
        // Quiet: a company page shows Gmail problems when you look.
      }
    };
    void run();
    const timer = setInterval(() => void run(), ALL_EVERY_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [gmail, loading, pull, toast]);

  const saveDraft = useCallback<GmailState['saveDraft']>(
    async (chain, draft) => {
      if (!gmail) return { error: 'Gmail works when Reacher is open in Claude.' };
      const replyTo = [...(chain?.messages ?? [])].reverse().find((m) => m.gmailId)?.gmailId;
      try {
        const made = await gmail.draft({
          ...draft,
          ...(replyTo ? { replyToMessageId: replyTo } : {}),
        });
        // Follow the thread from now on, so the email joins this chain once it's sent.
        if (chain && !chain.gmailThreadId && made.threadId)
          wsRef.current.actions.saveChain({ ...chain, gmailThreadId: made.threadId });
        return { link: made.link };
      } catch (e) {
        return { error: gmailErrorMessage(e) };
      }
    },
    [gmail],
  );

  const value = useMemo<GmailState>(
    () => ({ available: !!gmail, status, checkCompany, saveDraft }),
    [gmail, status, checkCompany, saveDraft],
  );
  return <GmailContext.Provider value={value}>{children}</GmailContext.Provider>;
}
