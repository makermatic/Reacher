import { optList } from './board';
import { norm, slug, uid } from './text';
import { COLORS, type Board, type Column, type ColumnType, type StatusOption } from './types';

/** Board edits as pure functions: each returns a new board. */

export const updateColumn = (board: Board, id: string, patch: Partial<Column>): Board => ({
  ...board,
  columns: board.columns.map((c) => (c.id === id ? { ...c, ...patch } : c)),
});

export const deleteColumn = (board: Board, id: string): Board => ({
  ...board,
  columns: board.columns.filter((c) => c.id !== id || c.locked),
});

/** Move a column one step left/up (-1) or right/down (+1). Status stays first. */
export function moveColumn(board: Board, id: string, dir: -1 | 1): Board {
  const cols = [...board.columns];
  const i = cols.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= cols.length || cols[i]!.id === 'status' || cols[j]!.id === 'status')
    return board;
  [cols[i], cols[j]] = [cols[j]!, cols[i]!];
  return { ...board, columns: cols };
}

export const nameTaken = (board: Board, name: string, exceptId?: string) =>
  board.columns.some((c) => c.id !== exceptId && norm(c.name) === norm(name));

export const typeHasChoices = (t: ColumnType) => t === 'values' || t === 'tags' || t === 'status';

/** A new column from the Add Metadata Column dialog. Choices come one per line. */
export function newColumn(
  name: string,
  type: ColumnType,
  choices: string[],
  onSheet: boolean,
): Column {
  const col: Column = { id: uid('col'), name: name.trim(), type, onSheet };
  if (type === 'values' || type === 'tags') col.options = choices;
  if (type === 'status')
    col.options = choices.map((label, i) => ({
      id: slug(label) || uid('o'),
      label,
      group: '',
      color: COLORS[(i + 1) % COLORS.length]!,
      tpl: '',
    }));
  return col;
}

/** Status choices as editable rows (list choices are edited as plain labels). */
export const statusOptions = (col: Column): StatusOption[] =>
  optList(col).map((o) => ({ tpl: '', ...o }) as StatusOption);
