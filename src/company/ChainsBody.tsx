import { AnimatePresence, motion } from 'motion/react';
import { armedDanger, ConfirmButton } from '../components/ConfirmButton';
import { useEffect, useState } from 'react';
import { fmtDate, todayISO } from '../model/dates';
import type { Chain, Company, Message } from '../model/types';
import { btn, field, fieldInline } from '../components/Modal';
import { Popover, PopoverHeader } from '../components/Popover';
import { useToast } from '../components/Toast';
import { duration, ease, itemInOut } from '../motion';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { useAssistant } from '../ai/Assistant';
import { needsOk } from '../runtime/connectors';
import { gmailErrorMessage } from '../runtime/gmail';
import { useGmail } from '../workspace/GmailProvider';
import { InlineText } from './InlineText';
import { addForm, DeleteButton } from './parts';

const byDate = (a: Message, b: Message) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

/** The "+ New chain" button under the chains. */
export function NewChainButton({
  company,
  onCreated,
}: {
  company: Company;
  onCreated: (id: string) => void;
}) {
  const { actions } = useWorkspace();
  const toast = useToast();
  return (
    <button
      type="button"
      className={`${btn.base} ${btn.small}`}
      onClick={() => {
        onCreated(actions.newChain(company.id, `Email chain ${fmtDate(todayISO())}`));
        toast('New chain started. Paste the first email, or rename it.');
      }}
    >
      + New chain
    </button>
  );
}

/**
 * A company's email chains, newest first (SPEC section 6). Each opens to its
 * emails and a form to paste the next one. AI summaries arrive in M5 and
 * "Write an email" in M6.
 */
export function ChainsBody({
  company,
  open,
  setOpen,
}: {
  company: Company;
  open: Record<string, boolean>;
  setOpen: (id: string, open: boolean) => void;
}) {
  const { chains } = useWorkspace();
  const list = chains
    .filter((ch) => ch.companyId === company.id)
    .sort((a, b) => (a.started < b.started ? 1 : a.started > b.started ? -1 : 0));

  if (!list.length)
    return (
      <>
        <GmailBar company={company} />
        <p className="m-0 text-[13px] text-muted">
          No email chains yet. Start one to paste emails into it.
        </p>
      </>
    );

  return (
    <>
      <GmailBar company={company} />
      <AnimatePresence initial={false}>
        {list.map((ch) => (
          <motion.div key={ch.id} {...itemInOut}>
            <ChainCard
              chain={ch}
              open={!!open[ch.id]}
              onToggle={() => setOpen(ch.id, !open[ch.id])}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </>
  );
}

const ago = (at: number) => {
  const min = Math.round((Date.now() - at) / 60_000);
  return min < 1 ? 'just now' : min < 60 ? `${min} min ago` : `${Math.round(min / 60)} h ago`;
};

/**
 * Gmail for this company (M9): checks its email when the page opens (once
 * Gmail is allowed), with a button to check now, and says what went wrong.
 */
function GmailBar({ company }: { company: Company }) {
  const gmail = useGmail();
  const { checkCompany } = gmail;
  const s = gmail.status[company.id];
  // Opening the page checks quietly (only once Gmail is allowed; at most every few minutes).
  useEffect(() => {
    void checkCompany(company, false);
    // Once per company page, not on every edit to the company.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id, checkCompany]);
  if (!gmail.available) return null;

  const check = (label: string) => (
    <button
      type="button"
      onClick={() => void checkCompany(company, true)}
      className={`${btn.ghost} ${btn.small}`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
      <span className="eyebrow text-[10.5px] font-semibold">Gmail</span>
      {s?.checking ? (
        <span>Checking your email with {company.name}…</span>
      ) : s?.error ? (
        <>
          <span>
            {s.error.code === 'no_address' ? s.error.message : gmailErrorMessage(s.error)}
          </span>
          {s.error.code !== 'no_address' &&
            check(needsOk(s.error.code) ? 'Allow Gmail' : 'Try again')}
        </>
      ) : s?.at ? (
        <>
          <span>Checked {ago(s.at)}</span>
          {check('Check now')}
        </>
      ) : (
        <>
          <span>Bring in your emails with {company.name}.</span>
          {check('Check Gmail')}
        </>
      )}
    </div>
  );
}

function ChainCard({
  chain,
  open,
  onToggle,
}: {
  chain: Chain;
  open: boolean;
  onToggle: () => void;
}) {
  const { actions } = useWorkspace();
  const msgs = [...chain.messages].sort(byDate);
  const first = msgs[0];
  const last = msgs.at(-1);
  const range =
    !first || !last
      ? 'No emails yet'
      : first.date === last.date
        ? fmtDate(first.date)
        : `${fmtDate(first.date)} – ${fmtDate(last.date)}`;

  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-2.5 py-2">
        <button
          type="button"
          onClick={onToggle}
          aria-label={open ? 'Collapse chain' : 'Expand chain'}
          className={btn.icon}
        >
          <motion.span
            animate={{ rotate: open ? 0 : -90 }}
            transition={{ duration: duration.base, ease: ease.out }}
          >
            ▾
          </motion.span>
        </button>
        <InlineText
          value={chain.title}
          label="Rename chain"
          onSave={(title) => actions.saveChain({ ...chain, title })}
          className="flex-1 font-semibold"
        />
        <span className="font-mono text-[11px] whitespace-nowrap text-muted">
          {msgs.length} · {range}
        </span>
        {chain.gmailLink && (
          <a
            href={chain.gmailLink}
            target="_blank"
            rel="noopener noreferrer"
            title="Open this thread in Gmail"
            className="text-xs whitespace-nowrap text-accent underline underline-offset-2"
          >
            Gmail ↗
          </a>
        )}
        <ChainMenu chain={chain} />
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: duration.base, ease: ease.out }}
            className="overflow-hidden"
          >
            <div className="grid gap-2 p-2.5">
              <ChainSummary chain={chain} />
              {msgs.map((m) => (
                <MessageCard key={m.id} chain={chain} message={m} />
              ))}
              <AddEmailForm chain={chain} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChainMenu({ chain }: { chain: Chain }) {
  const { actions } = useWorkspace();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const del = () => {
    setOpen(false);
    actions.deleteChain(chain.id);
    toast('Chain deleted');
  };
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      width={240}
      align="end"
      label="Chain options"
      trigger={
        <button type="button" aria-label="Chain options" className={btn.icon}>
          ⋯
        </button>
      }
    >
      <PopoverHeader title={chain.title} />
      <div>
        <ConfirmButton
          onConfirm={del}
          confirm="Click again to delete"
          className={`${btn.base} ${btn.small} ${btn.danger}`}
          armedClassName={armedDanger}
        >
          Delete this chain
        </ConfirmButton>
      </div>
    </Popover>
  );
}

function MessageCard({ chain, message: m }: { chain: Chain; message: Message }) {
  const { actions } = useWorkspace();
  const [expanded, setExpanded] = useState(false);
  const long = m.text.length > 320;
  return (
    <div
      className={`grid gap-1 rounded-lg border border-line border-l-[3px] px-2.5 py-2 ${
        m.dir === 'in' ? 'border-l-[var(--c-pink)]' : 'border-l-[var(--c-blue)]'
      }`}
    >
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="eyebrow text-[10.5px] font-semibold text-fg">
          {m.dir === 'in' ? 'Them' : 'You'}
        </span>
        <span>{fmtDate(m.date, true)}</span>
        <span className="ml-auto">
          <DeleteButton
            label="Delete email"
            onDelete={() =>
              actions.saveChain({
                ...chain,
                messages: chain.messages.filter((x) => x.id !== m.id),
                // Keep a Gmail email from coming back on the next check.
                ...(m.gmailId ? { gmailSkip: [...(chain.gmailSkip ?? []), m.gmailId] } : {}),
              })
            }
          />
        </span>
      </div>
      <div
        className={`text-[13px] whitespace-pre-wrap ${long && !expanded ? 'max-h-[9.5em] overflow-hidden' : ''}`}
      >
        {m.text}
      </div>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="justify-self-start text-xs text-accent"
        >
          {expanded ? 'Show less' : 'Show all'}
        </button>
      )}
    </div>
  );
}

function AddEmailForm({ chain }: { chain: Chain }) {
  const { actions } = useWorkspace();
  const toast = useToast();
  const [dir, setDir] = useState<Message['dir']>('in');
  const [date, setDate] = useState(todayISO());
  const [text, setText] = useState('');
  const add = () => {
    if (!text.trim()) return toast('Paste the email first');
    const label = actions.addEmail(chain, { dir, date: date || todayISO(), text: text.trim() });
    setText('');
    toast(label ? `Added. Status → ${label}` : 'Email added');
  };
  return (
    <div className={addForm}>
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Who sent it"
          className="flex rounded-lg border border-line-strong bg-surface p-0.5"
        >
          {(
            [
              ['in', 'From them'],
              ['out', 'From me'],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              aria-pressed={dir === k}
              onClick={() => setDir(k)}
              className="rounded-md px-2.5 py-1 text-muted transition-colors aria-pressed:bg-accent-soft aria-pressed:text-fg"
            >
              {l}
            </button>
          ))}
        </div>
        <input
          id={`email-date-${chain.id}`}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Date"
          className={fieldInline}
        />
      </div>
      <textarea
        id={`email-text-${chain.id}`}
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste an email into this chain"
        aria-label="Email text"
        className={`${field} resize-y`}
      />
      <div>
        <button type="button" onClick={add} className={`${btn.base} ${btn.small}`}>
          Add email
        </button>
      </div>
    </div>
  );
}

/** Three plain lines: Where it stands / You owe them / Next step (SPEC section 9). */
function ChainSummary({ chain }: { chain: Chain }) {
  const { available, summarize } = useAssistant();
  const [busy, setBusy] = useState(false);
  const sum = chain.summary;
  const stale = sum ? chain.messages.length - (sum.count || 0) : 0;
  const run = async () => {
    setBusy(true);
    await summarize(chain);
    setBusy(false);
  };
  if (!sum && !available) return null;
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <span className="eyebrow text-[10.5px] font-semibold text-muted">AI summary</span>
        {available && (
          <button
            type="button"
            onClick={run}
            disabled={busy || !chain.messages.length}
            className={`${btn.base} ${btn.small}`}
          >
            {busy ? 'Summarizing…' : sum ? 'Refresh' : 'Summarize'}
          </button>
        )}
      </div>
      {sum ? (
        <>
          <div
            className={`${busy ? 'ai-working ' : ''}rounded-lg bg-accent-soft px-3 py-2 text-[13.5px] whitespace-pre-wrap`}
          >
            {sum.text}
          </div>
          {stale > 0 && (
            <div className="text-xs text-[var(--c-amber)]">
              {stale} new {stale === 1 ? 'email' : 'emails'} since this summary.
            </div>
          )}
        </>
      ) : (
        <div
          className={`${busy ? 'ai-working ' : ''}rounded-lg bg-surface-2 px-3 py-2 text-[13.5px] text-muted`}
        >
          {chain.messages.length
            ? 'Summarize to see where this chain stands and what you owe them.'
            : 'Paste the first email below.'}
        </div>
      )}
    </div>
  );
}
