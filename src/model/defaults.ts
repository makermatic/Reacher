/**
 * The starting board for a new user, from docs/SPEC.md sections 2 and 3.
 * Status ids are stable; labels can be renamed by the user.
 */

export type ColorName = 'grey' | 'blue' | 'teal' | 'green' | 'amber' | 'pink' | 'red' | 'violet';

export type StatusChoice = {
  id: string;
  label: string;
  group: string;
  color: ColorName;
  /** Suggested email template id, if any. */
  tpl: string | null;
  icon?: string;
};

export const DEFAULT_STATUSES: StatusChoice[] = [
  { id: 'gathering', label: 'Gathering', group: 'Email outreach', color: 'grey', tpl: 'tpl-intro' },
  { id: 'reached', label: 'Reached out', group: 'Email outreach', color: 'blue', tpl: 'tpl-check' },
  {
    id: 'wroteback',
    label: 'Wrote back!!',
    group: 'Email outreach',
    color: 'pink',
    tpl: null,
    icon: '❗',
  },
  { id: 'replied', label: 'Replied', group: 'Email outreach', color: 'amber', tpl: 'tpl-check' },
  { id: 'meeting', label: 'Meeting', group: 'Email outreach', color: 'violet', tpl: 'tpl-thanks' },
  { id: 'applied', label: 'Applied', group: 'Job application', color: 'teal', tpl: 'tpl-app' },
  { id: 'rejected', label: 'Rejected', group: 'Job application', color: 'red', tpl: null },
  {
    id: 'interview',
    label: 'Interview',
    group: 'Job application',
    color: 'violet',
    tpl: 'tpl-thanks',
  },
];

/** Default sheet columns after Company name and Status, in order. */
export const DEFAULT_COLUMN_NAMES = [
  'Outcome',
  'Priority',
  'Role I want',
  'City',
  'Main contact',
  'Company type',
  'Website',
  'Size',
  'Why them',
  'Prep',
];
