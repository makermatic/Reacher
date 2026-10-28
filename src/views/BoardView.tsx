import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'motion/react';
import { useState } from 'react';
import { asPerson, colorFor, colShows, optionOf, optList, statusCol } from '../model/board';
import { byRank, rankBetween, rankOf } from '../model/ranking';
import { visibleCompanies } from '../model/search';
import type { Company, Option } from '../model/types';
import { readPref, writePref } from '../lib/prefs';
import { useToast } from '../components/Toast';
import { duration, ease } from '../motion';
import { useSheetUI } from '../sheet/SheetUI';
import { When } from '../sheet/When';
import { useWorkspace } from '../workspace/WorkspaceProvider';

const NO_STATUS = '_none';
const isFlags = (v: unknown): v is Record<string, boolean> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/** Company ids per lane, in card order. */
type Lanes = Record<string, string[]>;

/**
 * One lane per status (SPEC section 5). Drag a card to another lane to change
 * its status, or up and down to reorder it: the other cards make room as you
 * drag, like Trello (Zack, round 2). Click a card to open its page; click a
 * lane header to collapse it (remembered per device).
 */
export function BoardView() {
  const { loading, board, companies, actions } = useWorkspace();
  const toast = useToast();
  const sc = statusCol(board);
  const list = visibleCompanies(board, companies, '', 'all');
  const byId = new Map(list.map((c) => [c.id, c]));
  const lanes: Option[] = [
    { id: '', label: 'No status', group: '', color: 'grey' },
    ...optList(sc),
  ];
  const known = new Set(optList(sc).map((o) => o.id));
  const laneOf = (c: Company) => {
    const s = String(c.meta?.status ?? '');
    return s && known.has(s) ? s : NO_STATUS;
  };
  const stored: Lanes = Object.fromEntries(
    lanes.map((l) => {
      const key = l.id || NO_STATUS;
      return [key, byRank(list.filter((c) => laneOf(c) === key)).map((c) => c.id)];
    }),
  );

  const [collapsed, setCollapsed] = useState(() => readPref('collapsed-lanes', {}, isFlags));
  // While dragging, the lanes as they'll look if dropped now.
  const [preview, setPreview] = useState<Lanes | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const shown = preview ?? stored;

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

  const laneContaining = (lanesNow: Lanes, id: UniqueIdentifier) => {
    const key = String(id);
    return key in lanesNow ? key : Object.keys(lanesNow).find((k) => lanesNow[k]!.includes(key));
  };

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    setPreview(stored);
  };

  // Moving over another lane: the card joins it at the hovered position.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || !preview) return;
    const from = laneContaining(preview, active.id);
    const to = laneContaining(preview, over.id);
    if (!from || !to || from === to) return;
    const id = String(active.id);
    const target = preview[to]!.filter((x) => x !== id);
    const at = target.indexOf(String(over.id));
    target.splice(at >= 0 ? at : target.length, 0, id);
    setPreview({ ...preview, [from]: preview[from]!.filter((x) => x !== id), [to]: target });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const lanesNow = preview ?? stored;
    setActiveId(null);
    setPreview(null);
    const id = String(active.id);
    const c = byId.get(id);
    const lane = laneContaining(lanesNow, id);
    if (!c || !lane || !over) return;

    // Within one lane, move to the hovered card's spot.
    let order = lanesNow[lane]!;
    const overIdx = order.indexOf(String(over.id));
    const curIdx = order.indexOf(id);
    if (overIdx >= 0 && overIdx !== curIdx) order = arrayMove(order, curIdx, overIdx);

    const idx = order.indexOf(id);
    const prev = order[idx - 1];
    const next = order[idx + 1];
    const status = lane === NO_STATUS ? null : lane;
    const statusChanged = laneOf(c) !== lane;
    const unchanged = !statusChanged && stored[lane]!.indexOf(id) === idx;
    if (unchanged) return;
    const rank = rankBetween(
      prev ? rankOf(byId.get(prev)!) : undefined,
      next ? rankOf(byId.get(next)!) : undefined,
    );
    actions.moveCard(id, status, rank);
    if (statusChanged)
      toast(`${c.name} → ${status ? (optionOf(sc, status)?.label ?? status) : 'No status'}`);
  };

  const active = activeId ? byId.get(activeId) : undefined;

  return (
    <section aria-label="Board" className="flex h-full min-h-0 flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-xs text-muted tabular-nums">{list.length} companies</span>
        <span className="text-[12.5px] text-muted">
          Drag a card to change its status or its place in the lane. Click a card to open it.
        </span>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setPreview(null);
        }}
      >
        <div className="min-h-0 flex-1 overflow-x-auto pb-2">
          <div className="flex h-full gap-3">
            {lanes.map((lane) => {
              const key = lane.id || NO_STATUS;
              const ids = shown[key] ?? [];
              return (
                <Lane
                  key={key}
                  laneKey={key}
                  lane={lane}
                  cards={ids.map((id) => byId.get(id)!).filter(Boolean)}
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
          {active && <CardFace company={active} lifted />}
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
  // The lane itself is a drop target, so empty and collapsed lanes accept cards.
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
          <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="flex min-h-0 w-60 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
              {cards.map((c) => (
                <BoardCard key={c.id} company={c} />
              ))}
              {!cards.length && (
                <div className="grid flex-1 place-items-center rounded-lg border border-dashed border-line py-6 text-[12.5px] text-faint">
                  {loading ? '' : 'Nothing here'}
                </div>
              )}
            </div>
          </SortableContext>
        </>
      )}
    </motion.div>
  );
}

function BoardCard({ company }: { company: Company }) {
  const { openCompanyId, toggleCompany } = useSheetUI();
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: company.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      data-keep-panel
      aria-label={`${company.name}. Open, or drag to change status or order`}
      onClick={() => toggleCompany(company.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          toggleCompany(company.id);
        }
      }}
      className={`cursor-grab touch-manipulation rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        isDragging ? 'opacity-30' : ''
      }`}
    >
      <CardFace company={company} selected={openCompanyId === company.id} />
    </div>
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
