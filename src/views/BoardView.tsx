import { AnimatePresence, motion } from 'motion/react';
import { useMemo } from 'react';
import { asPerson, colorFor, colShows, optionOf, optList, statusCol } from '../model/board';
import { visibleCompanies } from '../model/search';
import type { Option } from '../model/types';
import { itemInOut } from '../motion';
import { useSheetUI } from '../sheet/SheetUI';
import { When } from '../sheet/When';
import { useWorkspace } from '../workspace/WorkspaceProvider';

/**
 * One lane per status (SPEC section 5). Cards show the name, Outcome, the
 * first list-of-values field (Priority), the main contact and the date.
 * Dragging between lanes and collapsing lanes come in M4.
 */
export function BoardView() {
  const { loading, board, companies, pages } = useWorkspace();
  const { openCompanyId, toggleCompany } = useSheetUI();
  const sc = statusCol(board);
  const list = useMemo(() => visibleCompanies(board, companies, '', 'all'), [board, companies]);
  const firstValues = board.columns.find((c) => c.type === 'values');
  const outcome = board.columns.find((c) => c.id === 'outcome');
  const people = board.columns.filter((c) => c.type === 'person');
  const lanes: Option[] = [
    { id: '', label: 'No status', group: '', color: 'grey' },
    ...optList(sc),
  ];
  const known = new Set(optList(sc).map((o) => o.id));

  return (
    <section aria-label="Board" className="flex h-full min-h-0 flex-col gap-2.5">
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-muted tabular-nums">{list.length} companies</span>
        <span className="text-[12.5px] text-muted">
          Dragging cards between lanes comes in a later update.
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-x-auto pb-2">
        <div className="flex h-full gap-3">
          {lanes.map((lane) => {
            const cards = list.filter((c) => {
              const s = String(c.meta?.status ?? '');
              return lane.id ? s === lane.id : !s || !known.has(s);
            });
            return (
              <div
                key={lane.id || 'none'}
                className={`c-${lane.color || 'grey'} flex w-60 shrink-0 flex-col overflow-hidden rounded-xl border border-line bg-surface-2`}
              >
                <div className="h-1 bg-[var(--c)]" />
                <div className="px-3 pt-2.5 pb-2">
                  <div className="eyebrow min-h-4 text-[10px] text-faint">{lane.group}</div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">
                      {lane.icon && <span aria-hidden="true">{lane.icon} </span>}
                      {lane.label}
                    </span>
                    <span className="font-mono text-xs text-muted tabular-nums">
                      {cards.length}
                    </span>
                  </div>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
                  <AnimatePresence initial={false}>
                    {cards.map((c) => {
                      const v = firstValues ? c.meta?.[firstValues.id] : undefined;
                      const o =
                        outcome && colShows(outcome, c)
                          ? optionOf(outcome, c.meta?.outcome)
                          : undefined;
                      const person = people
                        .map((p) => asPerson(c.meta?.[p.id]))
                        .find((p) => p?.name);
                      return (
                        <motion.div
                          key={c.id}
                          layout
                          role="button"
                          tabIndex={0}
                          data-keep-panel
                          onClick={() => toggleCompany(c.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggleCompany(c.id);
                            }
                          }}
                          {...itemInOut}
                          className={`grid cursor-pointer gap-1.5 rounded-lg border bg-surface px-3 py-2.5 shadow-xs transition-colors hover:border-line-strong ${
                            openCompanyId === c.id ? 'border-accent' : 'border-line'
                          }`}
                        >
                          <span className="font-semibold">{c.name}</span>
                          <span className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted">
                            {o && <span className={`tag c-${o.color || 'grey'}`}>{o.label}</span>}
                            {firstValues && typeof v === 'string' && v && (
                              <span className={`tag c-${colorFor(firstValues, v)}`}>{v}</span>
                            )}
                            {person && <span>{person.name}</span>}
                            <When company={c} page={pages[c.id]} />
                          </span>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  {!cards.length && (
                    <div className="grid flex-1 place-items-center rounded-lg border border-dashed border-line py-6 text-[12.5px] text-faint">
                      {loading ? '' : 'Nothing here'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
