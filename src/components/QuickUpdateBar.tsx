import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAssistant, type Notice } from '../ai/Assistant';
import { popIn } from '../motion';
import { btn } from './Modal';

/**
 * Tell Reacher what happened ("Interview with New York Life on 11/6 at
 * 12:30") and the AI fills it in (SPEC section 9). Results show in a card
 * under the bar, with Undo.
 */
export function QuickUpdateBar() {
  const assistant = useAssistant();
  const [text, setText] = useState('');
  const busy = assistant.notice?.kind === 'busy' && assistant.notice.text.startsWith('Reading');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const note = text.trim();
    if (!note || busy) return;
    if (await assistant.quickUpdate(note)) setText('');
  };

  return (
    <div className="relative z-15" data-keep-panel>
      <form
        onSubmit={submit}
        className={`${busy ? 'ai-working ' : ''}flex items-stretch gap-2 rounded-xl border border-line bg-surface py-1.5 pr-1.5 pl-3.5 shadow-xs transition-[border-color,box-shadow] duration-200 ease-standard focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)]`}
      >
        <label
          htmlFor="quick-input"
          className="eyebrow self-center whitespace-nowrap text-accent max-sm:sr-only"
        >
          Quick update
        </label>
        <input
          id="quick-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Tell Reacher what happened, like “Interview with New York Life on 11/6 at 12:30”"
          autoComplete="off"
          className="min-w-0 flex-1 border-0 bg-transparent px-1 py-1.5 text-[14.5px] outline-none placeholder:text-faint"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="rounded-lg bg-accent px-3.5 font-medium text-accent-ink transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Thinking…' : 'Update'}
        </button>
      </form>
      <NoticeCard onApplied={() => setText('')} />
    </div>
  );
}

/** How long each kind of card stays before fading, in ms (paused while hovered). */
function hideAfter(n: Notice): number | null {
  switch (n.kind) {
    case 'done':
      return 7000;
    case 'error':
      return 4000;
    case 'message':
      return 6000;
    default:
      return null;
  }
}

function NoticeCard({ onApplied }: { onApplied: () => void }) {
  const { notice, dismiss, undo, applyConfirmed } = useAssistant();
  const hovered = useRef(false);

  useEffect(() => {
    if (!notice) return;
    const ms = hideAfter(notice);
    if (ms == null) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = (wait: number) => {
      timer = setTimeout(() => (hovered.current ? tick(1500) : dismiss()), wait);
    };
    tick(ms);
    return () => clearTimeout(timer);
  }, [notice, dismiss]);

  return (
    <AnimatePresence>
      {notice && (
        <motion.div
          key={notice.kind === 'busy' ? 'busy' : 'card'}
          variants={popIn}
          initial="initial"
          animate="enter"
          exit="exit"
          role="status"
          onMouseEnter={() => (hovered.current = true)}
          onMouseLeave={() => (hovered.current = false)}
          className={`absolute inset-x-0 top-[calc(100%+6px)] grid gap-2 rounded-xl border border-line-strong bg-surface px-3.5 py-3 shadow-panel ${
            notice.kind === 'done' ? 'border-l-[3px] border-l-accent' : ''
          }`}
        >
          <NoticeBody
            notice={notice}
            onDismiss={dismiss}
            onUndo={undo}
            onApply={() => {
              applyConfirmed();
              onApplied();
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function NoticeBody({
  notice: n,
  onDismiss,
  onUndo,
  onApply,
}: {
  notice: Notice;
  onDismiss: () => void;
  onUndo: () => void;
  onApply: () => void;
}) {
  const close = (
    <button type="button" onClick={onDismiss} aria-label="Close" className={btn.icon}>
      ×
    </button>
  );
  const list = (lines: string[]) => (
    <ul className="m-0 grid gap-1 pl-5 text-[13.5px]">
      {lines.map((l, i) => (
        <li key={i}>{l}</li>
      ))}
    </ul>
  );

  switch (n.kind) {
    case 'busy':
      return <div className="text-muted">{n.text}…</div>;
    case 'error':
    case 'message':
      return (
        <div className="flex items-start justify-between gap-3">
          <span>{n.text}</span>
          {close}
        </div>
      );
    case 'done':
      return (
        <>
          <div className="flex items-center justify-between gap-3">
            <b>Updated</b>
            <span className="flex items-center gap-1.5">
              <button type="button" onClick={onUndo} className={`${btn.base} ${btn.small}`}>
                Undo
              </button>
              {close}
            </span>
          </div>
          {list(n.lines)}
          {n.skipped.length > 0 && (
            <>
              <div className="text-[12.5px] text-muted">Already there, skipped:</div>
              <div className="text-muted">{list(n.skipped)}</div>
            </>
          )}
        </>
      );
    case 'confirm':
      return (
        <>
          {n.reply && <div>{n.reply}</div>}
          {list(n.lines)}
          <div className="flex gap-1.5">
            <button type="button" onClick={onApply} className={`${btn.primary} ${btn.small}`}>
              Apply
            </button>
            <button type="button" onClick={onDismiss} className={`${btn.ghost} ${btn.small}`}>
              Discard
            </button>
          </div>
        </>
      );
  }
}
