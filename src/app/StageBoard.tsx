import {
  DndContext,
  DragOverlay,
  pointerWithin,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { useToast } from '../components/Toast';
import { readPref, writePref } from '../lib/prefs';
import { rankBetween, rankOf, byRank } from '../model/ranking';
import { statusLabel } from '../model/stages';
import type { Company } from '../model/types';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { sameCell, useAppUI } from './AppUI';
import { colorVar, Dropdown, MenuItem, StageName, StatusTag } from './ui';

const NONE = '_none';
type Lanes = Record<string, string[]>;
const isString = (v: unknown): v is string => typeof v === 'string';

/**
 * The Board (M7): one stage at a time, a lane per status. Drag a card to
 * another lane to change that stage's status, or within a lane to reorder;
 * the others make room as you drag. Click a card to select it (side panel).
 */
export function StageBoard({ list }: { list: Company[] }) {
  const { board, actions } = useWorkspace();
  const { selected, select } = useAppUI();
  const toast = useToast();
  const [stageId, setStageId] = useState(() =>
    readPref('board-stage', board.stages[0]?.id ?? '', isString),
  );
  const [picking, setPicking] = useState(false);
  const stage = board.stages.find((s) => s.id === stageId) ?? board.stages[0];
  const [preview, setPreview] = useState<Lanes | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );
  if (!stage)
    return <p className="text-muted">Add a stage in Settings → Stages to use the Board.</p>;

  const byId = new Map(list.map((c) => [c.id, c]));
  const laneKeys = [NONE, ...board.statuses.map((s) => s.id)];
  const stored: Lanes = Object.fromEntries(
    laneKeys.map((k) => [
      k,
      byRank(
        list.filter(
          (c) =>
            (c.stages?.[stage.id] ?? NONE) === k ||
            (k === NONE && !board.statuses.some((s) => s.id === c.stages?.[stage.id])),
        ),
      ).map((c) => c.id),
    ]),
  );
  const shown = preview ?? stored;
  const laneOf = (lanes: Lanes, id: string) =>
    id in lanes ? id : Object.keys(lanes).find((k) => lanes[k]!.includes(id));

  const collide: CollisionDetection = (args) => {
    const hits = pointerWithin(args);
    const cards = hits.filter((h) => !(String(h.id) in stored));
    return cards.length ? cards : hits;
  };
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || !preview) return;
    const from = laneOf(preview, String(active.id));
    const to = laneOf(preview, String(over.id));
    if (!from || !to || from === to) return;
    const id = String(active.id);
    const target = preview[to]!.filter((x) => x !== id);
    const at = target.indexOf(String(over.id));
    const dragged = active.rect.current.translated;
    const below =
      !!dragged && dragged.top + dragged.height / 2 > over.rect.top + over.rect.height / 2;
    target.splice(at >= 0 ? at + (below ? 1 : 0) : target.length, 0, id);
    setPreview({ ...preview, [from]: preview[from]!.filter((x) => x !== id), [to]: target });
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const lanes = preview ?? stored;
    setPreview(null);
    setActiveId(null);
    const id = String(active.id);
    const lane = laneOf(lanes, id);
    if (!lane || !over) return;
    let order = lanes[lane]!;
    const overIdx = order.indexOf(String(over.id));
    const curIdx = order.indexOf(id);
    if (overIdx >= 0 && overIdx !== curIdx) order = arrayMove(order, curIdx, overIdx);
    const idx = order.indexOf(id);
    const status = lane === NONE ? null : lane;
    const c = byId.get(id)!;
    const moved = (c.stages?.[stage.id] ?? null) !== status;
    if (!moved && stored[lane]!.indexOf(id) === idx) return;
    const prev = order[idx - 1];
    const next = order[idx + 1];
    actions.moveCard(
      id,
      stage.id,
      status,
      rankBetween(
        prev ? rankOf(byId.get(prev)!) : undefined,
        next ? rankOf(byId.get(next)!) : undefined,
      ),
    );
    if (moved) toast(`${c.name} · ${stage.name} → ${statusLabel(board, status) || 'No status'}`);
  };
  const active = activeId ? byId.get(activeId) : undefined;

  return (
    <section aria-label="Board" className="flex h-full min-h-0 flex-col gap-3">
      <div>
        <Dropdown
          open={picking}
          onOpenChange={setPicking}
          ariaLabel="Stage"
          label={<StageName name={stage.name} color={stage.color} />}
          width={220}
        >
          {board.stages.map((s) => (
            <MenuItem
              key={s.id}
              active={s.id === stage.id}
              onSelect={() => {
                setStageId(s.id);
                writePref('board-stage', s.id);
                setPicking(false);
              }}
            >
              <StageName name={s.name} color={s.color} />
            </MenuItem>
          ))}
        </Dropdown>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={collide}
        onDragStart={(e) => {
          setActiveId(String(e.active.id));
          setPreview(stored);
        }}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setPreview(null);
          setActiveId(null);
        }}
      >
        <div className="min-h-0 flex-1 overflow-x-auto pb-2">
          <div className="flex h-full gap-3">
            {laneKeys.map((k) => (
              <Lane
                key={k}
                laneKey={k}
                label={k === NONE ? 'No status' : statusLabel(board, k)}
                color={
                  k === NONE ? 'grey' : (board.statuses.find((s) => s.id === k)?.color ?? 'grey')
                }
                cards={(shown[k] ?? []).map((id) => byId.get(id)!).filter(Boolean)}
                stageId={stage.id}
                isSelected={(id) => selected.some((x) => sameCell(x, { id, stage: stage.id }))}
                onPick={(id) => select({ id, stage: stage.id })}
              />
            ))}
          </div>
        </div>
        <DragOverlay>
          {active && <CardFace company={active} stageId={stage.id} lifted />}
        </DragOverlay>
      </DndContext>
    </section>
  );
}

function Lane({
  laneKey,
  label,
  color,
  cards,
  stageId,
  isSelected,
  onPick,
}: {
  laneKey: string;
  label: string;
  color: string;
  cards: Company[];
  stageId: string;
  isSelected: (id: string) => boolean;
  onPick: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: laneKey });
  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label={label}
      className={`flex w-64 shrink-0 flex-col rounded-xl border bg-surface transition-colors ${isOver ? 'border-selectable' : 'border-line'}`}
    >
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="flex items-center gap-2 text-[13.5px] font-semibold text-strong">
          <span className="size-2 rounded-full" style={{ background: colorVar(color as never) }} />
          {label}
        </span>
        <span className="text-[12px] text-faint">{cards.length}</span>
      </div>
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
          {cards.map((c) => (
            <Card
              key={c.id}
              company={c}
              stageId={stageId}
              selected={isSelected(c.id)}
              onPick={() => onPick(c.id)}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function Card({
  company,
  stageId,
  selected,
  onPick,
}: {
  company: Company;
  stageId: string;
  selected: boolean;
  onPick: () => void;
}) {
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
      aria-label={`${company.name}. Select, or drag to change status or order`}
      onClick={onPick}
      onKeyDown={(e) => e.key === 'Enter' && onPick()}
      className={`cursor-grab rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-selectable ${isDragging ? 'opacity-30' : ''}`}
    >
      <CardFace company={company} stageId={stageId} selected={selected} />
    </div>
  );
}

function CardFace({
  company,
  stageId,
  selected = false,
  lifted = false,
}: {
  company: Company;
  stageId: string;
  selected?: boolean;
  lifted?: boolean;
}) {
  const { board } = useWorkspace();
  const others = board.stages.filter((s) => s.id !== stageId && company.stages?.[s.id]);
  return (
    <div
      className={`grid gap-1.5 rounded-lg border px-3 py-2.5 ${
        selected ? 'border-selectable bg-selected' : 'border-line bg-surface-2'
      } ${lifted ? 'rotate-1 shadow-panel' : ''}`}
    >
      <b className="truncate text-[14px] text-strong">{company.name}</b>
      {others.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {others.map((s) => (
            <span key={s.id} className="flex items-center gap-1 text-[11.5px] text-muted">
              {s.name}
              <StatusTag board={board} value={company.stages?.[s.id]} className="text-[11px]" />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
