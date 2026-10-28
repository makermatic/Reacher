import type { Board } from './types';

/**
 * The starting board for a new user, exactly as in the prototype
 * (docs/SPEC.md sections 2 and 3). Status ids are stable; labels can be renamed.
 */
export const DEFAULT_BOARD: Board = {
  version: 2,
  columns: [
    {
      id: 'status',
      name: 'Status',
      type: 'status',
      locked: true,
      onSheet: true,
      options: [
        {
          id: 'gathering',
          label: 'Gathering',
          group: 'Email outreach',
          color: 'grey',
          tpl: 'tpl-intro',
        },
        {
          id: 'reached',
          label: 'Reached out',
          group: 'Email outreach',
          color: 'blue',
          tpl: 'tpl-check',
        },
        {
          id: 'wroteback',
          label: 'Wrote back!!',
          group: 'Email outreach',
          color: 'pink',
          tpl: '',
          icon: '❗',
        },
        {
          id: 'replied',
          label: 'Replied',
          group: 'Email outreach',
          color: 'amber',
          tpl: 'tpl-check',
        },
        {
          id: 'meeting',
          label: 'Meeting',
          group: 'Email outreach',
          color: 'violet',
          tpl: 'tpl-thanks',
        },
        {
          id: 'applied',
          label: 'Applied',
          group: 'Job application',
          color: 'teal',
          tpl: 'tpl-app',
        },
        { id: 'rejected', label: 'Rejected', group: 'Job application', color: 'red', tpl: '' },
        {
          id: 'interview',
          label: 'Interview',
          group: 'Job application',
          color: 'violet',
          tpl: 'tpl-thanks',
        },
      ],
    },
    {
      id: 'outcome',
      name: 'Outcome',
      type: 'status',
      onSheet: true,
      showWhen: { col: 'status', values: ['meeting', 'interview'] },
      options: [
        { id: 'hopeful', label: 'Hopeful', group: '', color: 'green', tpl: '' },
        { id: 'offer', label: 'Offer!', group: '', color: 'teal', tpl: '' },
        { id: 'badfit', label: 'Bad fit', group: '', color: 'grey', tpl: '' },
        { id: 'rejected', label: 'Rejected', group: '', color: 'red', tpl: '' },
      ],
    },
    {
      id: 'priority',
      name: 'Priority',
      type: 'values',
      onSheet: true,
      options: ['Dream', 'Strong', 'Backup'],
    },
    { id: 'role', name: 'Role I want', type: 'text', onSheet: true },
    { id: 'city', name: 'City', type: 'text', onSheet: true },
    { id: 'contact', name: 'Main contact', type: 'person', onSheet: true },
    {
      id: 'tags',
      name: 'Company type',
      type: 'tags',
      onSheet: true,
      options: ['Studio', 'Broadcast', 'Agency', 'In-house'],
    },
    { id: 'website', name: 'Website', type: 'link', onSheet: false },
    {
      id: 'size',
      name: 'Size',
      type: 'values',
      onSheet: false,
      options: ['Small (under 50)', 'Mid (50–200)', 'Large (200+)'],
    },
    { id: 'why', name: 'Why them', type: 'longtext', onSheet: false },
    { id: 'prep', name: 'Prep', type: 'checklist', onSheet: false },
  ],
};
