import { DEFAULT_STATUSES, type ColorName } from '../model/defaults';

type Lane = { id: string; label: string; group: string; color: ColorName; icon?: string };

const LANES: Lane[] = [
  { id: '', label: 'No status', group: '', color: 'grey' },
  ...DEFAULT_STATUSES,
];

/** One lane per status; drag a card between lanes to change its status (M4). */
export function BoardView() {
  return (
    <section aria-label="Board" className="h-full min-h-0 overflow-x-auto pb-2">
      <div className="flex h-full gap-3">
        {LANES.map((lane) => (
          <div
            key={lane.id || 'none'}
            className={`c-${lane.color} flex w-60 shrink-0 flex-col overflow-hidden rounded-xl border border-line bg-surface-2`}
          >
            <div className="h-1 bg-[var(--c)]" />
            <div className="px-3 pt-2.5 pb-2">
              <div className="eyebrow min-h-4 text-faint">{lane.group}</div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">
                  {lane.icon && <span aria-hidden="true">{lane.icon} </span>}
                  {lane.label}
                </span>
                <span className="font-mono text-xs text-muted tabular-nums">0</span>
              </div>
            </div>
            <div className="mx-2 mb-2 flex-1 rounded-lg border border-dashed border-line" />
          </div>
        ))}
      </div>
    </section>
  );
}
