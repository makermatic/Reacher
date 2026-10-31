import { createContext, useContext } from 'react';
import type { Route } from './route';

/** What any screen can ask of the app frame: go to a page, and the company open in the side panel. */
export type AppUI = {
  route: Route;
  navigate: (r: Route) => void;
  /** The company open in the side panel (clicking its name or its status), if any. */
  selected: string | null;
  select: (id: string | null) => void;
  openSidebar: () => void;
  /** The full company page. */
  openPage: (id: string) => void;
  /** The companies list with this company open in the side panel. */
  showCompany: (id: string) => void;
  /**
   * The list filter (M11 round 2), both on by default: on the Companies page,
   * each company's people are listed under it. Companies off = the People page.
   */
  showPeople: boolean;
  setShowPeople: (on: boolean) => void;
};

export const AppUIContext = createContext<AppUI | null>(null);

export function useAppUI() {
  const ui = useContext(AppUIContext);
  if (!ui) throw new Error('useAppUI needs the app shell');
  return ui;
}
