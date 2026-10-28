import * as Tooltip from '@radix-ui/react-tooltip';
import { daysUntil, fmtDate, fmtTime, monthDay, todayISO } from '../model/dates';
import type { Company, Meeting, Page } from '../model/types';

/** The next meeting or interview today or later, earliest first. */
export function nextMeeting(page: Page | undefined, today = todayISO()): Meeting | undefined {
  return (page?.meetings ?? [])
    .filter((m) => m.date >= today)
    .sort((a, b) =>
      a.date === b.date
        ? (a.start || '').localeCompare(b.start || '')
        : a.date.localeCompare(b.date),
    )[0];
}

/**
 * Next to the status chip: an upcoming meeting's date (hover for the time and
 * who it's with), otherwise the follow-up countdown (SPEC section 4).
 */
export function When({ company, page }: { company: Company; page: Page | undefined }) {
  const m = nextMeeting(page);
  if (m) {
    const time = m.start ? ` at ${fmtTime(m.start)}${m.end ? `–${fmtTime(m.end)}` : ''}` : '';
    const what = `${m.kind === 'interview' ? 'Interview' : 'Meeting'}${m.with ? ` with ${m.with}` : ''}`;
    return (
      <Tooltip.Root delayDuration={350}>
        <Tooltip.Trigger asChild>
          <span className="due when" tabIndex={0}>
            {monthDay(m.date)}
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={6}
            className="z-50 grid gap-0.5 rounded-lg bg-fg px-3 py-2 text-[12.5px] text-bg shadow-panel"
          >
            <b>
              {monthDay(m.date)}
              {time}
            </b>
            <span className="opacity-80">{what}</span>
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    );
  }
  if (!company.due) return null;
  const d = daysUntil(company.due);
  if (d < 0)
    return (
      <span className="due late" title={`Follow up was due ${fmtDate(company.due, true)}`}>
        {-d}d late
      </span>
    );
  if (d === 0) return <span className="due today">follow up today</span>;
  return (
    <span className="due" title={`Follow up ${fmtDate(company.due, true)}`}>
      {d}d
    </span>
  );
}
