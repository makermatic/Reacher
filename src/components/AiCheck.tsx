import { useState } from 'react';
import { CHECK_CASES, checkPrompt, grade, type CheckResult } from '../ai/aiCheck';
import { describeAction, type QuickReply } from '../model/aiActions';
import { DEFAULT_BOARD } from '../model/defaults';
import { aiErrorMessage } from '../runtime/ai';
import { useRuntime } from '../runtime/RuntimeProvider';
import { btn } from './Modal';

/**
 * Runs the AI check (src/ai/aiCheck.ts) against the real AI: each sample note
 * through the quick update prompt, with a ✓ or ✗ per expectation. Nothing is
 * saved; it uses its own made-up tracker.
 */
export function AiCheck() {
  const runtime = useRuntime();
  const ai = runtime.status === 'ready' ? runtime.ai : null;
  const [results, setResults] = useState<(CheckResult | { note: string; error: string })[]>([]);
  const [running, setRunning] = useState(false);
  if (!ai) return null;

  const run = async () => {
    setRunning(true);
    setResults([]);
    for (const c of CHECK_CASES) {
      try {
        const reply = await ai.json<QuickReply>(checkPrompt(c));
        setResults((r) => [...r, grade(c, reply)]);
      } catch (e) {
        setResults((r) => [...r, { note: c.note, error: aiErrorMessage(e) ?? 'No answer.' }]);
      }
    }
    setRunning(false);
  };

  const done = results.filter((r) => 'results' in r) as CheckResult[];
  const passed = done.filter((r) => r.results.every((x) => x.ok)).length;

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          AI check: runs {CHECK_CASES.length} sample quick updates and checks the answers. Nothing
          is saved.
        </span>
        <button
          type="button"
          className={`${btn.base} ${btn.small}`}
          onClick={run}
          disabled={running}
        >
          {running ? `Checking ${results.length + 1} of ${CHECK_CASES.length}…` : 'Run AI check'}
        </button>
      </div>
      {results.length > 0 && (
        <div
          className={`grid gap-2 rounded-xl border border-line p-3 ${running ? 'ai-working' : ''}`}
        >
          {!running && (
            <b className="text-fg">
              {passed} of {CHECK_CASES.length} passed
            </b>
          )}
          {results.map((r) => (
            <div key={r.note} className="grid gap-0.5">
              <span className="text-fg">“{r.note}”</span>
              {'error' in r ? (
                <span className="text-[var(--c-red)]">✗ {r.error}</span>
              ) : (
                <>
                  {r.results.map((x) => (
                    <span
                      key={x.label}
                      className={x.ok ? 'text-[var(--c-green)]' : 'text-[var(--c-red)]'}
                    >
                      {x.ok ? '✓' : '✗'} {x.label}
                    </span>
                  ))}
                  {r.results.some((x) => !x.ok) && (
                    <span className="text-faint">
                      It did:{' '}
                      {r.actions.length
                        ? r.actions.map((a) => describeAction(DEFAULT_BOARD, a)).join(' · ')
                        : 'nothing'}
                    </span>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
