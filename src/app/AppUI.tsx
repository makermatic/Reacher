import { createContext, useContext } from 'react';
import type { Route } from './route';

/**
 * What any screen can ask of the app frame (M7): go to a page, and the
 * company selection that drives the side panel, like Kitsu's selected tasks.
 */
export type AppUI = {
  route: Route;
  navigate: (r: Route) => void;
  /** Selected company ids; the side panel shows them. */
  selected: string[];
  /**
   * Click: just this one (`only`); Ctrl/Cmd-click: add or remove (`toggle`);
   * Shift-click: everything between the last pick and this one in `order`.
   */
  select: (id: string, how?: 'only' | 'toggle' | 'range', order?: string[]) => void;
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
  current: string[],
  id: string,
  how: 'only' | 'toggle' | 'range',
  order: string[] = [],
  anchor: string | null = null,
): string[] {
  if (how === 'toggle')
    return current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
  if (how === 'range' && anchor && order.includes(anchor) && order.includes(id)) {
    const [a, b] = [order.indexOf(anchor), order.indexOf(id)].sort((x, y) => x - y) as [
      number,
      number,
    ];
    return [...new Set([...current, ...order.slice(a, b + 1)])];
  }
  return [id];
}
