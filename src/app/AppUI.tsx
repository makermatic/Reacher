import { createContext, useContext } from 'react';
import type { Route } from './route';

/**
 * A selected cell (M7), like a selected task in Kitsu: one company in one
 * stage. `stage` is null when a whole company was picked (from My Tasks, the
 * News Feed): the panel then shows its active stage.
 */
export type Cell = { id: string; stage: string | null };
export const cellKey = (c: Cell) => `${c.id}::${c.stage ?? ''}`;
export const sameCell = (a: Cell, b: Cell) => a.id === b.id && a.stage === b.stage;

/** What any screen can ask of the app frame: go to a page, and the selection that drives the side panel. */
export type AppUI = {
  route: Route;
  navigate: (r: Route) => void;
  selected: Cell[];
  /**
   * Click: just this one (`only`); Ctrl/Cmd-click: add or remove (`toggle`);
   * Shift-click: from the last pick to this one, along `order`.
   */
  select: (cell: Cell, how?: 'only' | 'toggle' | 'range', order?: Cell[]) => void;
  setSelection: (cells: Cell[]) => void;
  clearSelection: () => void;
  openSidebar: () => void;
  /** The company page. */
  openPage: (id: string) => void;
};

export const AppUIContext = createContext<AppUI | null>(null);

export function useAppUI() {
  const ui = useContext(AppUIContext);
  if (!ui) throw new Error('useAppUI needs the app shell');
  return ui;
}

/** The selection a click makes (pure, for the shell and tests). */
export function nextSelection(
  current: Cell[],
  cell: Cell,
  how: 'only' | 'toggle' | 'range',
  order: Cell[] = [],
  anchor: Cell | null = null,
): Cell[] {
  if (how === 'toggle')
    return current.some((c) => sameCell(c, cell))
      ? current.filter((c) => !sameCell(c, cell))
      : [...current, cell];
  const at = (c: Cell | null) => (c ? order.findIndex((x) => sameCell(x, c)) : -1);
  if (how === 'range' && at(anchor) >= 0 && at(cell) >= 0) {
    const [a, b] = [at(anchor), at(cell)].sort((x, y) => x - y) as [number, number];
    const out = [...current];
    for (const c of order.slice(a, b + 1)) if (!out.some((x) => sameCell(x, c))) out.push(c);
    return out;
  }
  return [cell];
}
