import { createContext, useContext } from 'react';

/** Sheet-wide dialogs that deep components (pickers, menus) can open. */
export type SheetUI = {
  /** Open the Edit choices dialog for a column. */
  editChoices: (colId: string) => void;
};

export const SheetUIContext = createContext<SheetUI>({ editChoices: () => {} });
export const useSheetUI = () => useContext(SheetUIContext);
