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
import {
  cleanActions,
  describeAction,
  type QuickAction,
  type QuickReply,
} from '../model/aiActions';
import { cleanCandidates, planQuick, type Candidate, type QuickUndo } from '../model/quickPlan';
import type { Chain, Company } from '../model/types';
import { aiErrorMessage, type AI } from '../runtime/ai';
import { useRuntime } from '../runtime/RuntimeProvider';
import { useToast } from '../components/Toast';
import { useWorkspace, type Workspace } from '../workspace/WorkspaceProvider';
import { calendarAuto, useCalendar } from '../workspace/CalendarProvider';
import { todayISO } from '../model/dates';
import {
  draftPrompt,
  lookupPrompt,
  namePrompt,
  quickUpdatePrompt,
  summaryPrompt,
  type DraftReply,
  type LookupReply,
} from './prompts';

/** The card under the Quick update bar (SPEC section 9). */
export type Notice =
  | { kind: 'busy'; text: string }
  | { kind: 'error'; text: string }
  | { kind: 'message'; text: string }
  | { kind: 'confirm'; reply: string; actions: QuickAction[]; lines: string[]; note: string }
  /** `skipped`: things the note mentioned that the tracker already had. */
  | { kind: 'done'; lines: string[]; skipped: string[]; undo: QuickUndo };

/**
 * A company lookup's state, shown on that company's page rather than under
 * Quick update (Zack, round 2).
 */
export type LookupState =
  | { busy: true }
  | {
      busy: false;
      company: Company;
      msg: string;
      candidates: Candidate[];
      /** Not sure which company: the candidates are the question. */
      ask: boolean;
    };

type LookupOptions = {
  /** Only speak up when it fills something (lookups after a quick update). */
  quiet?: boolean;
  /** What the person wrote about the company, to tell similar names apart. */
  context?: string;
  /** Called when it needs the person to pick: open the company's page. */
  onAsk?: () => void;
  /** Also toast the result (the lookup started away from the company's page). */
  announce?: boolean;
};

/** Finished results that nobody saw clear on their own after this long. */
const STALE_LOOKUP_MS = 20000;

type Assistant = {
  /** AI is available on this view (inside Claude, allowed). */
  available: boolean;
  notice: Notice | null;
  dismiss: () => void;
  /**
   * Runs a quick update. `about`: posted from that company's panel, so the
   * note needn't name it (M7). Resolves true when it was applied (so the box can clear).
   */
  quickUpdate: (note: string, about?: Company) => Promise<boolean>;
  applyConfirmed: () => void;
  undo: () => void;
  /** Look up a company's details; results show on its page. */
  lookup: (company: Company, opts?: LookupOptions) => Promise<void>;
  lookups: Record<string, LookupState>;
  pickCandidate: (companyId: string, cand: Candidate) => void;
  clearLookup: (companyId: string) => void;
  /** Summarize an email chain into three lines; saves it on the chain. */
  summarize: (chain: Chain) => Promise<void>;
  /** Draft with AI: the next email for a company, new or as a reply in a chain. */
  draft: (
    company: Company,
    recipient: { name: string; role: string } | null,
    chain: Chain | null,
  ) => Promise<{ subject: string; body: string } | null>;
  /** A quick AI guess at a name from an email address; '' when it can't tell. */
  guessName: (email: string) => Promise<string>;
};

const AssistantContext = createContext<Assistant | null>(null);

export function useAssistant() {
  const a = useContext(AssistantContext);
  if (!a) throw new Error('useAssistant needs an AssistantProvider');
  return a;
}

const NO_AI =
  'AI works when Reacher is open in Claude. This copy runs on its own, so it’s off here.';

export function AssistantProvider({ children }: { children: ReactNode }) {
  const runtime = useRuntime();
  const ws = useWorkspace();
  const toast = useToast();
  const calendar = useCalendar();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [lookups, setLookups] = useState<Record<string, LookupState>>({});
  const [off, setOff] = useState(false);
  const setLookup = useCallback((id: string, state: LookupState | null) => {
    setLookups((cur) => {
      const next = { ...cur };
      if (state) next[id] = state;
      else delete next[id];
      return next;
    });
    // So a result doesn't greet you next time you open the page.
    if (state && !state.busy && !state.ask)
      setTimeout(
        () =>
          setLookups((cur) => {
            if (cur[id] !== state) return cur;
            const next = { ...cur };
            delete next[id];
            return next;
          }),
        STALE_LOOKUP_MS,
      );
  }, []);
  const ai: AI | null = runtime.status === 'ready' && !off ? runtime.ai : null;

  // AI answers arrive after a wait; always act on the latest data, not what was there when asked.
  const wsRef = useRef<Workspace>(ws);
  useEffect(() => {
    wsRef.current = ws;
  }, [ws]);

  const fail = useCallback((e: unknown) => {
    const code = (e as { code?: string } | null)?.code;
    if (code === 'not_granted' || code === 'sampling_disabled' || code === 'not_declared')
      setOff(true);
    const text = aiErrorMessage(e);
    return text;
  }, []);

  const lookup = useCallback(
    async (company: Company, opts: LookupOptions = {}) => {
      if (!ai) {
        if (!opts.quiet) toast(NO_AI);
        return;
      }
      if (!opts.quiet) setLookup(company.id, { busy: true });
      try {
        const reply = await ai.json<LookupReply>(
          lookupPrompt(wsRef.current.board, company.name, opts.context),
        );
        const cands = cleanCandidates(reply);
        const sure = !!reply?.sure;
        const { actions } = wsRef.current;
        const filledMsg = (name: string, filled: string[]) =>
          `Filled in ${name}${filled.length ? `: ${filled.join(', ')}` : ''}.`;
        if (opts.quiet) {
          if (cands.length && sure) {
            actions.applyCandidate(company, cands[0]!);
            toast(`Filled in details for ${cands[0]!.name}`);
          }
          return;
        }
        if (!cands.length)
          setLookup(company.id, {
            busy: false,
            company,
            msg: `Couldn't find a media company called “${company.name}”. Check the spelling, or fill the details in yourself.`,
            candidates: [],
            ask: false,
          });
        else if (sure) {
          const filled = actions.applyCandidate(company, cands[0]!);
          const msg = filledMsg(cands[0]!.name, filled);
          if (opts.announce) toast(msg);
          setLookup(company.id, {
            busy: false,
            company: { ...company, name: cands[0]!.name },
            msg,
            candidates: cands.slice(1),
            ask: false,
          });
        } else {
          setLookup(company.id, {
            busy: false,
            company,
            msg: `Which “${company.name}” did you mean?`,
            candidates: cands,
            ask: true,
          });
          opts.onAsk?.();
        }
      } catch (e) {
        const text = fail(e);
        if (opts.quiet) return;
        setLookup(company.id, null);
        if (text) toast(`Couldn't look up ${company.name}. ${text}`);
      }
    },
    [ai, fail, toast, setLookup],
  );

  const apply = useCallback(
    (actions: QuickAction[], note: string) => {
      const { board, companies, pages, chains, actions: write } = wsRef.current;
      const plan = planQuick({ board, companies, pages, chains }, actions);
      if (!plan.applied.length) {
        setNotice({ kind: 'message', text: 'Nothing new: your tracker already has all of that.' });
        return;
      }
      write.applyQuick(plan, note);
      setNotice({
        kind: 'done',
        lines: plan.applied.map((a) => describeAction(board, a)),
        skipped: plan.skipped
          .filter((a) => a.type !== 'add_company' && a.type !== 'set_status')
          .map((a) => describeAction(board, a)),
        undo: plan.undo,
      });
      // Upcoming meetings go on Google Calendar too, if that's switched on (M8).
      if (calendar.available && calendarAuto.get())
        for (const { companyId, meeting } of plan.newMeetings) {
          const company = plan.companies.find((c) => c.id === companyId);
          if (!company || meeting.date < todayISO()) continue;
          void calendar
            .addToCalendar(company, meeting)
            .then((problem) => toast(problem ?? `Added to Google Calendar: ${company.name}`));
        }
      // New companies get a quiet lookup, using the note as context.
      const first = plan.created[0];
      if (first) setTimeout(() => void lookup(first, { quiet: true, context: note }), 500);
    },
    [lookup, calendar, toast],
  );

  const quickUpdate = useCallback(
    async (note: string, about?: Company) => {
      if (!ai) {
        setNotice({ kind: 'error', text: NO_AI });
        return false;
      }
      setNotice({ kind: 'busy', text: `Reading “${note}”` });
      try {
        const { board, companies, chains, pages } = wsRef.current;
        const reply = await ai.json<QuickReply>(
          quickUpdatePrompt(board, companies, chains, note, undefined, pages, about?.name),
        );
        const actions = cleanActions(wsRef.current.board, reply?.actions);
        const lines = actions.map((a) => describeAction(wsRef.current.board, a));
        if (actions.length && reply?.confirm !== true) {
          apply(actions, note);
          return true;
        }
        setNotice(
          actions.length
            ? { kind: 'confirm', reply: String(reply?.reply ?? ''), actions, lines, note }
            : { kind: 'message', text: String(reply?.reply ?? '') || 'Nothing to change.' },
        );
        return false;
      } catch (e) {
        setNotice({
          kind: 'error',
          text: fail(e) ?? "Couldn't read that update. Try rephrasing it.",
        });
        return false;
      }
    },
    [ai, apply, fail],
  );

  const value = useMemo<Assistant>(
    () => ({
      available: !!ai,
      notice,
      dismiss: () => setNotice(null),
      quickUpdate,
      applyConfirmed: () => {
        if (notice?.kind === 'confirm') apply(notice.actions, notice.note);
      },
      undo: () => {
        if (notice?.kind !== 'done') return;
        void wsRef.current.actions.undoQuick(notice.undo);
        setNotice(null);
        toast('Undone');
      },
      lookup,
      lookups,
      pickCandidate: (companyId, cand) => {
        const cur = lookups[companyId];
        if (!cur || cur.busy) return;
        const filled = wsRef.current.actions.applyCandidate(cur.company, cand);
        setLookup(companyId, {
          busy: false,
          company: { ...cur.company, name: cand.name },
          msg: `Filled in ${cand.name}${filled.length ? `: ${filled.join(', ')}` : ''}.`,
          candidates: [],
          ask: false,
        });
      },
      clearLookup: (companyId) => setLookup(companyId, null),
      summarize: async (chain) => {
        if (!ai) {
          toast('Summaries use AI, which works when Reacher is open in Claude.');
          return;
        }
        const { board, companies, actions } = wsRef.current;
        const c = companies.find((x) => x.id === chain.companyId);
        if (!c) return;
        try {
          const text = await ai.text(summaryPrompt(board, c, actions.pageOf(c.id), chain), 'quick');
          const latest = wsRef.current.chains.find((x) => x.id === chain.id) ?? chain;
          wsRef.current.actions.saveSummary(latest, text.trim());
        } catch (e) {
          const text = fail(e);
          if (text) toast(text);
        }
      },
      draft: async (company, recipient, chain) => {
        if (!ai) {
          toast('Drafting uses AI, which works when Reacher is open in Claude.');
          return null;
        }
        const { board, me, actions } = wsRef.current;
        try {
          const r = await ai.json<DraftReply>(
            draftPrompt(board, company, actions.pageOf(company.id), me, recipient, chain),
          );
          if (typeof r?.body !== 'string' || !r.body.trim()) {
            toast("The AI's answer was empty. Try again.");
            return null;
          }
          return { subject: String(r.subject ?? ''), body: r.body };
        } catch (e) {
          const text = fail(e);
          if (text) toast(text);
          return null;
        }
      },
      guessName: async (email) => {
        if (!ai) return '';
        try {
          const r = await ai.json<{ name?: unknown }>(namePrompt(email), 'quick');
          return String(r?.name ?? '').trim();
        } catch {
          return '';
        }
      },
    }),
    [ai, notice, lookups, quickUpdate, apply, lookup, toast, fail, setLookup],
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}
