import type { Board, Template } from './types';

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

/**
 * Starting templates for a new account (SPEC section 8). Zack's own come over
 * with his import; these are the prototype's, minus his personal details.
 */
export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'tpl-intro',
    name: 'First outreach',
    subject: 'Motion designer interested in {{company}}',
    body: "Hi {{first_name}},\n\n{{my_intro}}\n\n{{why_them}}\n\nI'd love to be considered for {{role_i_want}} work at {{company}}, whether that's a staff role or freelance. My reel and portfolio are at {{my_portfolio}}.\n\nWould you have 15 minutes in the next couple of weeks to talk about how your team is staffing up?\n\nThanks,\n{{my_name}}",
  },
  {
    id: 'tpl-check',
    name: 'Check-in (no reply yet)',
    subject: 'Re: Motion designer interested in {{company}}',
    body: "Hi {{first_name}},\n\nJust floating this back to the top of your inbox. I'm still very interested in {{role_i_want}} work at {{company}}.\n\nReel and portfolio: {{my_portfolio}}\n\nThanks again,\n{{my_name}}",
  },
  {
    id: 'tpl-app',
    name: 'Application follow-up',
    subject: 'Following up on my {{role_i_want}} application',
    body: 'Hi {{first_name}},\n\nI applied for the {{role_i_want}} role at {{company}} recently and wanted to follow up directly. {{why_them}}\n\nMy portfolio is at {{my_portfolio}}. Happy to send anything else you need.\n\nBest,\n{{my_name}}',
  },
  {
    id: 'tpl-thanks',
    name: 'Thank you after interview',
    subject: 'Thank you, {{first_name}}',
    body: "Hi {{first_name}},\n\nThanks for taking the time to talk today. I enjoyed learning more about the team at {{company}}, and I'm even more excited about the {{role_i_want}} role.\n\nLet me know if there's anything else I can send your way.\n\nBest,\n{{my_name}}",
  },
  {
    id: 'tpl-referral',
    name: 'Ask a friend for a referral',
    subject: 'Quick favor about {{company}}',
    body: "Hey {{first_name}},\n\nHope you're doing well! I'm going after {{role_i_want}} roles at {{company}} and wanted to ask if you'd be open to passing my name along, or pointing me to the right person on the production side.\n\nHere's my portfolio: {{my_portfolio}}\n\nNo pressure at all, and thanks either way.\n{{my_name}}",
  },
];
