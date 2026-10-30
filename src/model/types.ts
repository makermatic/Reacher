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

/**
 * A stage (M7): a colored column like Kitsu's task types (Outreach, Meeting,
 * Application, Interview). Each company has a status in each stage.
 */
export type Stage = {
  id: string;
  name: string;
  color: ColorName;
  /** Shown on the list (Display settings); hidden stages keep their statuses. */
  onSheet?: boolean;
};

/** A status any stage can be in (shared, like Kitsu's task statuses). */
export type StageStatus = {
  id: string;
  label: string;
  color: ColorName | '';
  /** What it means, for the AI and for people (e.g. "they answered; your move"). */
  meaning: string;
};

/** Which email template to suggest when a stage is at a status. */
export type Suggest = { stage: string; status: string; tpl: string };

/**
 * Version 3 (M7): stages and their statuses are separate from the fields.
 * `columns` are the fields only (City, Priority...), shown uncolored.
 */
export type Board = {
  version: 3;
  columns: Column[];
  stages: Stage[];
  statuses: StageStatus[];
  suggest: Suggest[];
};

/** The board before M7: Status and Outcome were status-type columns. */
export type LegacyBoard = { version: 2; columns: Column[] };

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
  /** Its status in each stage (M7): stage id → status id. The latest from any sprint. */
  stages?: Record<string, string | null>;
  /**
   * The sprints it's in (M7), by sprint id. Each keeps its own stage statuses:
   * a company can be at Interview in one sprint and turned down in an earlier
   * one. `stages` above holds the latest, which "All companies" shows.
   * null = taken out of that sprint.
   */
  sprints?: Record<string, SprintEntry | null>;
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
export type Page = {
  /** Before M7. Shown as comments; new comments go in `events`. */
  notes: Note[];
  applications: Application[];
  meetings: Meeting[];
  /** The company's feed (M7): comments, status changes, emails, meetings... newest last. */
  events?: FeedEvent[];
};

/**
 * A sprint (M7): a block of time to organize the hunt, like a sequence in
 * Kitsu. Named "First Light 10/29/26"; once it's over, "First Light 10/29/26 -
 * 11/15/26" (see model/sprints). Being over never stops you working in it.
 */
export type Sprint = {
  id: string;
  name: string;
  /** YYYY-MM-DD, the day it was made (editable). */
  start: string;
  /** Set by hand to end it on a given day; otherwise worked out from activity. */
  end?: string | null;
  order: number;
};

/** A company's place in one sprint. */
export type SprintEntry = {
  /** Its status in each stage, in this sprint. */
  stages: Record<string, string | null>;
  /** YYYY-MM-DD it joined the sprint, and its latest change there. */
  added: string;
  updated: string;
};

export type EventKind =
  'comment' | 'status' | 'email' | 'meeting' | 'application' | 'field' | 'company' | 'sprint';

/** Who made a change: you, the AI, or a connector. */
export type EventBy = 'you' | 'ai' | 'gmail' | 'calendar';

/** One line of a company's feed, the News Feed and the timeline. */
export type FeedEvent = {
  id: string;
  /** ISO date and time. */
  at: string;
  kind: EventKind;
  text: string;
  by: EventBy;
  /** The sprint it happened in, if any. */
  sprintId?: string | null;
  /** For status changes: which stage, from and to (status ids). */
  status?: { stage: string; from: string | null; to: string | null };
};

export type Template = { id: string; name: string; subject: string; body: string };

/** "Your details": fills the my_* email template fields. */
export type Me = { name: string; portfolio: string; reel: string; phone: string; intro: string };
