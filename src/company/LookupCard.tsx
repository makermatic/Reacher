import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { useAssistant } from '../ai/Assistant';
import { btn } from '../components/Modal';
import type { Company } from '../model/types';
import { popIn } from '../motion';

/**
 * A company lookup's result, on the company's own page (Zack, round 2): the
 * "looking up" state, what got filled in, and "Which one did you mean?" when
 * the AI isn't sure. Results that need no answer fade after a few seconds
 * (paused while hovered); a question stays until it's answered.
 */
export function LookupCard({ company }: { company: Company }) {
  const { lookups, pickCandidate, clearLookup } = useAssistant();
  const state = lookups[company.id];
  const hovered = useRef(false);

  useEffect(() => {
    if (!state || state.busy || state.ask) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = (wait: number) => {
      timer = setTimeout(() => (hovered.current ? tick(1500) : clearLookup(company.id)), wait);
    };
    tick(state.candidates.length ? 8000 : 5000);
    return () => clearTimeout(timer);
  }, [state, company.id, clearLookup]);

  return (
    <AnimatePresence initial={false}>
      {state && (
        <motion.div
          key="lookup"
          variants={popIn}
          initial="initial"
          animate="enter"
          exit="exit"
          role="status"
          onMouseEnter={() => (hovered.current = true)}
          onMouseLeave={() => (hovered.current = false)}
          className={`grid gap-2 rounded-xl border border-line-strong bg-surface px-3.5 py-3 text-[13.5px] ${
            state.busy ? 'ai-working' : ''
          }`}
        >
          {state.busy ? (
            <div className="text-muted">Looking up {company.name}…</div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <span>{state.msg}</span>
                {!state.ask && (
                  <button
                    type="button"
                    onClick={() => clearLookup(company.id)}
                    aria-label="Close"
                    className={btn.icon}
                  >
                    ×
                  </button>
                )}
              </div>
              {state.candidates.length > 0 && (
                <>
                  {!state.ask && (
                    <div className="text-[12.5px] text-muted">Not it? Did you mean:</div>
                  )}
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {state.candidates.map((c, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => pickCandidate(company.id, c)}
                        className="grid gap-0.5 rounded-lg border border-line px-3 py-2 text-left transition-colors hover:border-accent hover:bg-accent-soft"
                      >
                        <b className="font-semibold">{c.name}</b>
                        <small className="text-[12px] text-muted">{c.about}</small>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {state.ask && (
                <div>
                  <button
                    type="button"
                    onClick={() => clearLookup(company.id)}
                    className={`${btn.ghost} ${btn.small}`}
                  >
                    None of these
                  </button>
                </div>
              )}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
