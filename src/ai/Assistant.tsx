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
import { lookupPrompt, quickUpdatePrompt, summaryPrompt, type LookupReply } from './prompts';

/** The card under the Quick update bar (SPEC section 9). */
export type Notice =
  | { kind: 'busy'; text: string }
  | { kind: 'error'; text: string }
  | { kind: 'message'; text: string }
  | { kind: 'confirm'; reply: string; actions: QuickAction[]; lines: string[]; note: string }
  | { kind: 'done'; lines: string[]; undo: QuickUndo }
  | {
      kind: 'lookup';
      company: Company;
      msg: string;
      candidates: Candidate[];
      /** Not sure which company: the candidates are the question. */
      ask: boolean;
    };

type Assistant = {
  /** AI is available on this view (inside Claude, allowed). */
  available: boolean;
  notice: Notice | null;
  dismiss: () => void;
  /** Runs a quick update. Resolves true when it was applied (so the bar can clear). */
  quickUpdate: (note: string) => Promise<boolean>;
  applyConfirmed: () => void;
  undo: () => void;
  /** Look up a company's details. Quiet: only speak up when it fills something. */
  lookup: (company: Company, opts?: { quiet?: boolean; context?: string }) => Promise<void>;
  pickCandidate: (cand: Candidate) => void;
  /** Summarize an email chain into three lines; saves it on the chain. */
  summarize: (chain: Chain) => Promise<void>;
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
  const [notice, setNotice] = useState<Notice | null>(null);
  const [off, setOff] = useState(false);
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
    async (company: Company, opts: { quiet?: boolean; context?: string } = {}) => {
      if (!ai) {
        if (!opts.quiet) setNotice({ kind: 'error', text: NO_AI });
        return;
      }
      if (!opts.quiet) setNotice({ kind: 'busy', text: `Looking up “${company.name}”` });
      try {
        const reply = await ai.json<LookupReply>(
          lookupPrompt(wsRef.current.board, company.name, opts.context),
        );
        const cands = cleanCandidates(reply);
        const sure = !!reply?.sure;
        const { actions } = wsRef.current;
        if (opts.quiet) {
          if (cands.length && sure) {
            actions.applyCandidate(company, cands[0]!);
            toast(`Filled in details for ${cands[0]!.name}`);
          }
          return;
        }
        if (!cands.length)
          setNotice({
            kind: 'lookup',
            company,
            msg: `Couldn't find a media company called “${company.name}”. Check the spelling, or fill the details in yourself.`,
            candidates: [],
            ask: false,
          });
        else if (sure) {
          const filled = actions.applyCandidate(company, cands[0]!);
          setNotice({
            kind: 'lookup',
            company: { ...company, name: cands[0]!.name },
            msg: `Filled in ${cands[0]!.name}${filled.length ? `: ${filled.join(', ')}` : ''}.`,
            candidates: cands.slice(1),
            ask: false,
          });
        } else
          setNotice({
            kind: 'lookup',
            company,
            msg: `Which “${company.name}” did you mean?`,
            candidates: cands,
            ask: true,
          });
      } catch (e) {
        const text = fail(e);
        if (!opts.quiet && text)
          setNotice({ kind: 'error', text: `Couldn't look up ${company.name}. ${text}` });
      }
    },
    [ai, fail, toast],
  );

  const apply = useCallback(
    (actions: QuickAction[], note: string) => {
      const { board, companies, pages, chains, actions: write } = wsRef.current;
      const plan = planQuick({ board, companies, pages, chains }, actions);
      write.applyQuick(plan);
      setNotice({
        kind: 'done',
        lines: actions.map((a) => describeAction(board, a)),
        undo: plan.undo,
      });
      // New companies get a quiet lookup, using the note as context.
      const first = plan.created[0];
      if (first) setTimeout(() => void lookup(first, { quiet: true, context: note }), 500);
    },
    [lookup],
  );

  const quickUpdate = useCallback(
    async (note: string) => {
      if (!ai) {
        setNotice({ kind: 'error', text: NO_AI });
        return false;
      }
      setNotice({ kind: 'busy', text: `Reading “${note}”` });
      try {
        const { board, companies, chains } = wsRef.current;
        const reply = await ai.json<QuickReply>(quickUpdatePrompt(board, companies, chains, note));
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
      pickCandidate: (cand) => {
        if (notice?.kind !== 'lookup') return;
        const filled = wsRef.current.actions.applyCandidate(notice.company, cand);
        setNotice({
          kind: 'lookup',
          company: { ...notice.company, name: cand.name },
          msg: `Filled in ${cand.name}${filled.length ? `: ${filled.join(', ')}` : ''}.`,
          candidates: [],
          ask: false,
        });
      },
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
    }),
    [ai, notice, quickUpdate, apply, lookup, toast, fail],
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}
