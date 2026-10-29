/**
 * Reacher's data model. Shapes match the prototype (docs/SPEC.md section 11)
 * so its Export file imports as-is.
 */

export const COLORS = ['grey', 'blue', 'teal', 'green', 'amber', 'pink', 'red', 'violet'] as const;
export type ColorName = (typeof COLORS)[number];

export type ColumnType =
  | 'status'
  | 'text'
  | 'longtext'
  | 'number'
  | 'checkbox'
  | 'date'
  | 'link'
  | 'person'
  | 'values'
  | 'tags'
  | 'checklist';

export const TYPE_LABELS: Record<ColumnType, string> = {
  status: 'Status',
  text: 'Text',
  longtext: 'Long text',
  number: 'Number',
  checkbox: 'Checkbox',
  date: 'Date',
  link: 'Link',
  person: 'Person',
  values: 'List of values',
  tags: 'List of tags',
  checklist: 'Checklist',
};

/** One choice in a status column. `id` is stable; the label can be renamed. */
export type StatusOption = {
  id: string;
  label: string;
  /** Category, e.g. "Email outreach". */
  group: string;
  color: ColorName | '';
  /** Suggested email template id, or ''. */
  tpl: string;
  icon?: string;
};

/** A choice as the UI uses it: status options as-is, list choices wrapped. */
export type Option = {
  id: string;
  label: string;
  group: string;
  color: ColorName | '';
  icon?: string;
};

export type ShowWhen = { col: string; values: string[] };

export type Column = {
  id: string;
  name: string;
  type: ColumnType;
  /** Shown on the sheet. Hidden columns still show on the company page. */
  onSheet?: boolean;
  locked?: boolean;
  /** Status columns: StatusOption[]. List of values / tags: plain strings. */
  options?: (StatusOption | string)[];
  /** Only show this column when another (status) column has one of these values. */
  showWhen?: ShowWhen | null;
};

export type Board = { version: 2; columns: Column[] };

export type Person = { name: string; role: string; email: string };
export type ChecklistItem = { t: string; done: boolean };

export type Company = {
  id: string;
  name: string;
  /** Sort key: creation time in ms. */
  order: number;
  /** Column values by column id. */
  meta: Record<string, unknown>;
  /** Follow-up date, YYYY-MM-DD. */
  due: string | null;
  /** Position within its Board lane (see model/ranking). Absent until moved on the Board. */
  rank?: number;
  /** Gmail threads whose chain was deleted, so syncing doesn't bring them back (M9). */
  gmailIgnore?: string[];
  /** Fields filled by company lookup (true) rather than typed. */
  auto?: Record<string, boolean | null>;
  example?: boolean;
};

export type Message = {
  id: string;
  dir: 'in' | 'out';
  date: string;
  text: string;
  /** The Gmail message it came from (M9), so it's never added twice. */
  gmailId?: string;
};

export type Chain = {
  id: string;
  companyId: string;
  title: string;
  started: string;
  messages: Message[];
  summary: { text: string; at: string; count: number } | null;
  /** The Gmail thread it follows (M9) and a link to open it. */
  gmailThreadId?: string;
  gmailLink?: string;
  /** Gmail messages deleted from this chain, so syncing doesn't bring them back. */
  gmailSkip?: string[];
};

export type Note = { id: string; date: string; text: string };
export type Application = { id: string; date: string; role: string; link: string; result: string };
export type Meeting = {
  id: string;
  date: string;
  /** 24-hour "HH:MM" or ''. */
  start: string;
  end: string;
  kind: 'meeting' | 'interview';
  with: string;
  notes: string;
  /** Set once it's on Google Calendar (M8): the event's id and link. */
  calendarEventId?: string;
  calendarLink?: string;
};

/** The company page's dated entries, stored per company id. */
export type Page = { notes: Note[]; applications: Application[]; meetings: Meeting[] };

export type Template = { id: string; name: string; subject: string; body: string };

/** "Your details": fills the my_* email template fields. */
export type Me = { name: string; portfolio: string; reel: string; phone: string; intro: string };
