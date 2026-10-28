import { createContext, useContext } from 'react';

/** App-wide panels and dialogs that deep components (pickers, menus, rows) can open. */
export type SheetUI = {
  /** Open the Edit choices dialog for a column. */
  editChoices: (colId: string) => void;
  /** Open the Add Metadata Column dialog. */
  addColumn: () => void;
  /** The company whose page is open, if any. */
  openCompanyId: string | null;
  /** Open a company's page; opening the one already open closes it (SPEC section 4). */
  toggleCompany: (id: string) => void;
  closeCompany: () => void;
};

export const SheetUIContext = createContext<SheetUI>({
  editChoices: () => {},
  addColumn: () => {},
  openCompanyId: null,
  toggleCompany: () => {},
  closeCompany: () => {},
});
export const useSheetUI = () => useContext(SheetUIContext);
