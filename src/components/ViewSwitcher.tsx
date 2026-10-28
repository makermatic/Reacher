import { motion } from 'motion/react';
import { glide } from '../motion';

export type View = 'sheet' | 'board';

const VIEWS: { id: View; label: string }[] = [
  { id: 'sheet', label: 'Sheet' },
  { id: 'board', label: 'Board' },
];

/** Sheet / Board segmented control; the highlight glides between the two. */
export function ViewSwitcher({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div
      role="group"
      aria-label="View"
      className="flex rounded-lg border border-line-strong bg-surface p-0.5"
    >
      {VIEWS.map((v) => (
        <button
          key={v.id}
          type="button"
          aria-pressed={view === v.id}
          onClick={() => onChange(v.id)}
          className="relative rounded-md px-3 py-1 text-muted transition-colors aria-pressed:text-fg"
        >
          {view === v.id && (
            <motion.span
              layoutId="view-highlight"
              transition={glide}
              className="absolute inset-0 rounded-md bg-accent-soft"
            />
          )}
          <span className="relative font-medium">{v.label}</span>
        </button>
      ))}
    </div>
  );
}
