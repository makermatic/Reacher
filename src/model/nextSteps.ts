/**
 * Suggested next steps on a company's panel (Zack, M7 round 2): only when
 * there's something you owe. They wrote back (reply), a follow-up is due
 * (check in), or a meeting or interview just happened and nothing went out
 * since (thank-you). Each one opens the email writer, set up for it.
 */
import { meta } from './board';
import { addDays, fmtDate, todayISO } from './dates';
import type { Chain, Company, Page, Template } from './types';

export type NextStep = {
  id: 'reply' | 'follow-up' | 'thanks';
  text: string;
  /** The template to start from ('' = the writer's own pick). */
  template: string;
  /** Reply in this chain, or 'new'. */
  target: string;
};

/** A thank-you is suggested this many days after a meeting or interview. */
const THANKS_DAYS = 7;

export function nextSteps(
  c: Company,
  page: Page | undefined,
  chains: Chain[],
  templates: Template[],
  today = todayISO(),
): NextStep[] {
  const mine = chains
    .filter((ch) => ch.companyId === c.id)
    .sort((a, b) => (a.started < b.started ? 1 : -1));
  const latest = mine[0]?.id ?? 'new';
  const has = (id: string) => (templates.some((t) => t.id === id) ? id : '');
  const status = String(meta(c, 'status') ?? '');
  const steps: NextStep[] = [];

  if (status === 'wroteback')
    steps.push({
      id: 'reply',
      text: 'They wrote back. Reply to them',
      template: '',
      target: latest,
    });
  else if (c.due && c.due <= today && (status === 'reached' || status === 'replied'))
    steps.push({
      id: 'follow-up',
      text:
        c.due === today
          ? 'Your follow-up is due today. Write a check-in'
          : `Your follow-up was due ${fmtDate(c.due)}. Write a check-in`,
      template: has('tpl-check'),
      target: latest,
    });

  const lastOut = mine
    .flatMap((ch) => ch.messages.filter((m) => m.dir === 'out').map((m) => m.date))
    .sort()
    .at(-1);
  const met = [...(page?.meetings ?? [])]
    .filter((m) => m.date < today && m.date >= addDays(today, -THANKS_DAYS))
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  if (met && !(lastOut && lastOut >= met.date))
    steps.push({
      id: 'thanks',
      text: `Send a thank-you after your ${met.kind} on ${fmtDate(met.date)}`,
      template: has('tpl-thanks'),
      target: latest,
    });
  return steps;
}
