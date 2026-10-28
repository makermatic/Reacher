import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { asPerson, colorFor, colShows, optionOf, optList, statusCol } from '../model/board';
import { visibleCompanies } from '../model/search';
import type { Company, Option } from '../model/types';
import { readPref, writePref } from '../lib/prefs';
import { useToast } from '../components/Toast';
import { duration, ease, itemInOut } from '../motion';
import { useSheetUI } from '../sheet/SheetUI';
import { When } from '../sheet/When';
import { useWorkspace } from '../workspace/WorkspaceProvider';

const NO_STATUS = '_none';
const isFlags = (v: unknown): v is Record<string, boolean> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * One lane per status (SPEC section 5). Drag a card to another lane to change
 * its status; click a card to open its page; click a lane header to collapse
 * it to a thin strip (remembered per device).
 */
export function BoardView() {
  const { loading, board, companies, actions } = useWorkspace();
  const toast = useToast();
  const sc = statusCol(board);
  const list = visibleCompanies(board, companies, '', 'all');
  const lanes: Option[] = [
    { id: '', label: 'No status', group: '', color: 'grey' },
    ...optList(sc),
  ];
  const known = new Set(optList(sc).map((o) => o.id));
  const [collapsed, setCollapsed] = useState(() => readPref('collapsed-lanes', {}, isFlags));
  const [dragging, setDragging] = useState<Company | null>(null);

  // A short move starts a drag, so a plain click still opens the card. On touch, press and hold.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  const toggleLane = (key: string) => {
    const next = { ...collapsed, [key]: !collapsed[key] };
    setCollapsed(next);
    writePref('collapsed-lanes', next);
  };

  const onDragStart = (e: DragStartEvent) =>
    setDragging(list.find((c) => c.id === e.active.id) ?? null);

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const c = list.find((x) => x.id === e.active.id);
    if (!c || !e.over) return;
    const to = e.over.id === NO_STATUS ? null : String(e.over.id);
    if ((c.meta?.status ?? null) === to) return;
    actions.setMeta(c.id, 'status', to);
    toast(`${c.name} → ${to ? (optionOf(sc, to)?.label ?? to) : 'No status'}`);
  };

  return (
    <section aria-label="Board" className="flex h-full min-h-0 flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-xs text-muted tabular-nums">{list.length} companies</span>
        <span className="text-[12.5px] text-muted">
          Drag a card to change its status. Click a card to open it.
        </span>
      </div>
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragging(null)}
      >
        <div className="min-h-0 flex-1 overflow-x-auto pb-2">
          <div className="flex h-full gap-3">
            {lanes.map((lane) => {
              const key = lane.id || NO_STATUS;
              const cards = list.filter((c) => {
                const s = String(c.meta?.status ?? '');
                return lane.id ? s === lane.id : !s || !known.has(s);
              });
              return (
                <Lane
                  key={key}
                  laneKey={key}
                  lane={lane}
                  cards={cards}
                  loading={loading}
                  collapsed={!!collapsed[key]}
                  onToggle={() => toggleLane(key)}
                />
              );
            })}
          </div>
        </div>
        <DragOverlay
          dropAnimation={{
            duration: duration.slow * 1000,
            easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}
        >
          {dragging && <CardFace company={dragging} lifted />}
        </DragOverlay>
      </DndContext>
    </section>
  );
}

function Lane({
  laneKey,
  lane,
  cards,
  loading,
  collapsed,
  onToggle,
}: {
  laneKey: string;
  lane: Option;
  cards: Company[];
  loading: boolean;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: laneKey });
  const ring = isOver ? 'border-accent ring-2 ring-accent/30' : 'border-line';

  return (
    <motion.div
      ref={setNodeRef}
      initial={false}
      animate={{ width: collapsed ? 44 : 240 }}
      transition={{ duration: duration.slow, ease: ease.out }}
      className={`c-${lane.color || 'grey'} flex shrink-0 flex-col overflow-hidden rounded-xl border bg-surface-2 transition-[border-color,box-shadow] ${ring}`}
    >
      <div className="h-1 shrink-0 bg-[var(--c)]" />
      {collapsed ? (
        <button
          type="button"
          onClick={onToggle}
          title={`Show ${lane.label}`}
          className="flex flex-1 flex-col items-center gap-2 py-2.5 transition-colors hover:bg-hover"
        >
          <span className="font-mono text-xs text-muted tabular-nums">{cards.length}</span>
          <span className="font-semibold whitespace-nowrap [writing-mode:vertical-rl]">
            {lane.icon && <span aria-hidden="true">{lane.icon} </span>}
            {lane.label}
          </span>
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={onToggle}
            title={`Collapse ${lane.label}`}
            className="px-3 pt-2.5 pb-2 text-left transition-colors hover:bg-hover"
          >
            <span className="eyebrow block min-h-4 text-[10px] text-faint">{lane.group}</span>
            <span className="flex items-center justify-between gap-2">
              <span className="truncate font-semibold">
                {lane.icon && <span aria-hidden="true">{lane.icon} </span>}
                {lane.label}
              </span>
              <span className="font-mono text-xs text-muted tabular-nums">{cards.length}</span>
            </span>
          </button>
          <div className="flex min-h-0 w-60 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
            <AnimatePresence initial={false}>
              {cards.map((c) => (
                <BoardCard key={c.id} company={c} />
              ))}
            </AnimatePresence>
            {!cards.length && (
              <div className="grid flex-1 place-items-center rounded-lg border border-dashed border-line py-6 text-[12.5px] text-faint">
                {loading ? '' : 'Nothing here'}
              </div>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}

function BoardCard({ company }: { company: Company }) {
  const { openCompanyId, toggleCompany } = useSheetUI();
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: company.id });
  return (
    <motion.div
      ref={setNodeRef}
      layout
      {...itemInOut}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      data-keep-panel
      aria-label={`${company.name}. Open, or drag to change status`}
      onClick={() => toggleCompany(company.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          toggleCompany(company.id);
        }
      }}
      className={`cursor-grab touch-manipulation rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        isDragging ? 'opacity-35' : ''
      }`}
    >
      <CardFace company={company} selected={openCompanyId === company.id} />
    </motion.div>
  );
}

/** What a card shows: name, Outcome, the first list-of-values field, main contact, date. */
function CardFace({
  company: c,
  selected = false,
  lifted = false,
}: {
  company: Company;
  selected?: boolean;
  lifted?: boolean;
}) {
  const { board, pages } = useWorkspace();
  const firstValues = board.columns.find((col) => col.type === 'values');
  const outcome = board.columns.find((col) => col.id === 'outcome');
  const people = board.columns.filter((col) => col.type === 'person');
  const v = firstValues ? c.meta?.[firstValues.id] : undefined;
  const o = outcome && colShows(outcome, c) ? optionOf(outcome, c.meta?.outcome) : undefined;
  const person = people.map((p) => asPerson(c.meta?.[p.id])).find((p) => p?.name);
  return (
    <div
      className={`grid gap-1.5 rounded-lg border bg-surface px-3 py-2.5 transition-colors ${
        selected ? 'border-accent' : 'border-line hover:border-line-strong'
      } ${lifted ? 'w-56 rotate-1 cursor-grabbing shadow-panel' : 'shadow-xs'}`}
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
    </div>
  );
}
