import { DEFAULT_BOARD } from './defaults';
import { isStagesBoard, unstageBoard } from './unstage';
import { fmtDate } from './dates';
import { isPlainObject, norm } from './text';
import {
  COLORS,
  type Board,
  type ChecklistItem,
  type ColorName,
  type Column,
  type Company,
  type Option,
  type Person,
} from './types';

/** A stored board, or the default when the user hasn't changed anything yet. */
export const boardOrDefault = (b: unknown): Board =>
  isStagesBoard(b)
    ? unstageBoard(b)
    : isPlainObject(b) && b.version === 2 && Array.isArray(b.columns)
      ? (b as Board)
      : DEFAULT_BOARD;

export const colById = (board: Board, id: string) => board.columns.find((c) => c.id === id);
export const colByName = (board: Board, name: string) =>
  board.columns.find((c) => norm(c.name) === norm(name));
export const statusCol = (board: Board) => colById(board, 'status') ?? DEFAULT_BOARD.columns[0]!;

/** Every choice of a column as an Option (list choices are plain strings in storage). */
export const optList = (col: Column): Option[] =>
  (col.options ?? []).map((o) =>
    typeof o === 'string' ? { id: o, label: o, group: '', color: '' } : o,
  );

export const optionOf = (col: Column, id: unknown) => optList(col).find((o) => o.id === id);

/** A status choice's label, with its icon when it has one. */
export const optionLabel = (o: Option) => (o.icon ? `${o.icon} ${o.label}` : o.label);

/**
 * The color for a choice: its own for status choices, otherwise picked from
 * its position so each list choice keeps a steady color (never grey).
 */
export function colorFor(col: Column, value: string): ColorName {
  const o = optionOf(col, value);
  if (o?.color) return o.color;
  const idx = (col.options ?? []).indexOf(value);
  const n = idx < 0 ? norm(value).length : idx;
  return COLORS[(n % (COLORS.length - 1)) + 1]!;
}

export const meta = (c: Company | undefined, colId: string): unknown => c?.meta?.[colId];

/** Whether a column applies to this company (Outcome only shows at Meeting or Interview). */
export function colShows(col: Column, c: Company) {
  if (!col.showWhen) return true;
  return (col.showWhen.values ?? []).includes(meta(c, col.showWhen.col) as string);
}

/** Columns on the sheet after Company and Status, in board order. */
export const sheetColumns = (board: Board, companies: Company[]) =>
  board.columns.filter(
    (col) =>
      col.id !== 'status' &&
      col.onSheet !== false &&
      (!col.showWhen || companies.some((c) => colShows(col, c) || meta(c, col.id) != null)),
  );

/**
 * The meta patch for setting one column. Dependent columns (showWhen) whose
 * condition no longer holds are cleared, and the value is no longer marked as
 * filled by lookup.
 */
export function metaPatch(board: Board, c: Company, colId: string, value: unknown) {
  const m: Record<string, unknown> = { [colId]: value };
  for (const col of board.columns) {
    if (
      col.showWhen?.col === colId &&
      !(col.showWhen.values ?? []).includes(value as string) &&
      meta(c, col.id) != null
    )
      m[col.id] = null;
  }
  return { meta: m, auto: { [colId]: null } };
}

export const asPerson = (v: unknown): Person | null =>
  isPlainObject(v)
    ? { name: String(v.name ?? ''), role: String(v.role ?? ''), email: String(v.email ?? '') }
    : null;

export const asTags = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

export const asChecklist = (v: unknown): ChecklistItem[] =>
  Array.isArray(v)
    ? v.filter(isPlainObject).map((i) => ({ t: String(i.t ?? ''), done: !!i.done }))
    : [];

/** A value as plain text, for search and AI prompts. */
export function valueText(col: Column, v: unknown): string {
  if (v == null || v === '') return '';
  switch (col.type) {
    case 'status':
      return optionOf(col, v)?.label ?? '';
    case 'checkbox':
      return v ? 'Yes' : 'No';
    case 'date':
      return fmtDate(String(v), true);
    case 'person':
      return asPerson(v)?.name ?? '';
    case 'tags':
      return asTags(v).join(', ');
    case 'checklist':
      return '';
    default:
      return String(v);
  }
}

/** True when a value counts as empty (blank text, empty list, no person). */
export function isEmptyValue(v: unknown) {
  if (v == null || v === '') return true;
  if (Array.isArray(v)) return v.length === 0;
  if (isPlainObject(v)) return Object.values(v).every((x) => x == null || x === '');
  return false;
}
