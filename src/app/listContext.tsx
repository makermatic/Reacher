/**
 * Which list a screen is working on (M11): Companies or People. Field editors,
 * column menus, stars, Display and the Board read their board and writes from
 * here, so the same pieces serve both lists (like Kitsu's shots and assets).
 * Without a provider it's Companies.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { Board } from '../model/types';
import { useWorkspace } from '../workspace/WorkspaceProvider';

/** What a row needs to be edited: companies and people both have these. */
export type Row = {
  id: string;
  name: string;
  meta: Record<string, unknown>;
  order: number;
  rank?: number;
};

export type ListApi = {
  kind: 'company' | 'person';
  board: Board;
  saveBoard: (next: Board) => void;
  setMeta: (id: string, colId: string, value: unknown) => void;
  /** Every row in the list (for suggestions like "the cities you've typed"). */
  rows: Row[];
  /** A Board drop: new status and position. */
  moveCard: (id: string, status: string | null, rank: number) => void;
};

const ListContext = createContext<ListApi | null>(null);

export function useList(): ListApi {
  const ctx = useContext(ListContext);
  const ws = useWorkspace();
  return (
    ctx ?? {
      kind: 'company',
      board: ws.board,
      saveBoard: ws.actions.saveBoard,
      setMeta: ws.actions.setMeta,
      rows: ws.companies,
      moveCard: ws.actions.moveCard,
    }
  );
}

/** Everything inside works on People. */
export function PeopleList({ children }: { children: ReactNode }) {
  const { people, peopleBoard, actions } = useWorkspace();
  return (
    <ListContext.Provider
      value={{
        kind: 'person',
        board: peopleBoard,
        saveBoard: actions.savePeopleBoard,
        setMeta: actions.setPersonMeta,
        rows: people,
        moveCard: actions.movePersonCard,
      }}
    >
      {children}
    </ListContext.Provider>
  );
}
