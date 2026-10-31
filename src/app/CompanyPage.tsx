import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { ApplicationsBody } from '../company/EntrySections';
import { InlineText } from '../company/InlineText';
import { MeetingsBody } from '../company/MeetingsBody';
import { eventsOf } from '../model/events';
import { inSprint, inView } from '../model/sprints';
import type { Company } from '../model/types';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { useAppUI } from './AppUI';
import { EmailsSection, FieldRows, SprintStatuses } from './CompanySections';
import { EventTag, when } from './Feed';
import { COMPANY_TABS, type CompanyTab } from './route';
import { useSprintInfo } from './sprintLabels';
import { Tabs, ui } from './ui';

const TAB_LABEL: Record<CompanyTab, string> = {
  info: 'Info',
  emails: 'Emails',
  meetings: 'Meetings',
  applications: 'Applications',
};

/**
 * Kitsu's shot page, for a company (M7): its name with the sprint in front
 * and arrows to the previous and next company, tabs for its info, emails,
 * meetings and applications, and its whole timeline on the right.
 */
export function CompanyPage({ id, tab }: { id: string; tab: CompanyTab }) {
  const { companies, sprint, actions, loading } = useWorkspace();
  const { navigate } = useAppUI();
  const info = useSprintInfo();
  const company = companies.find((c) => c.id === id);
  if (!company)
    return (
      <p className="p-8 text-muted">
        {loading ? 'Loading…' : 'That company isn’t on your list any more.'}
      </p>
    );

  // Arrows step through the companies on screen (this sprint, or all).
  const scope = [...companies]
    .filter((c) => !sprint || inSprint(c, sprint))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const at = scope.findIndex((c) => c.id === id);
  const step = (d: number) => {
    const next = scope[(at + d + scope.length) % scope.length];
    if (next) navigate({ page: 'company', id: next.id, tab });
  };

  return (
    <div className="flex h-full min-h-0">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-5 pb-10">
        <header className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate({ page: 'companies' })}
            aria-label="Back to companies"
            className={ui.ghostIcon}
          >
            <ArrowLeft size={20} />
          </button>
          <span className="grid size-[60px] shrink-0 place-items-center rounded-[10px] bg-surface text-[26px] font-black text-muted">
            {company.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="flex min-w-0 flex-1 items-baseline gap-2 text-[28px] text-muted">
            {sprint && info[sprint] && inSprint(company, sprint) && (
              <span className="shrink-0 whitespace-nowrap">{info[sprint]!.label} /</span>
            )}
            <InlineText
              value={company.name}
              label="Rename company"
              onSave={(name) => actions.renameCompany(company.id, name)}
              className="text-[28px] text-strong"
            />
          </div>
          {scope.length > 1 && at >= 0 && (
            <>
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Previous company"
                className={ui.ghostIcon}
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Next company"
                className={ui.ghostIcon}
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </header>

        <div className={`${ui.block} px-5 pt-4 pb-6`}>
          <Tabs
            label="Company page"
            tabs={COMPANY_TABS.map((t) => ({ id: t, label: TAB_LABEL[t] }))}
            current={tab}
            onChange={(t) => navigate({ page: 'company', id, tab: t })}
          />
          <div className="mt-5 grid gap-6">
            {tab === 'info' && <InfoTab company={inView(company, sprint)} />}
            {tab === 'emails' && <EmailsSection company={company} />}
            {tab === 'meetings' && <MeetingsBody company={company} />}
            {tab === 'applications' && <ApplicationsBody company={company} />}
          </div>
        </div>
      </div>
      <Timeline company={company} />
    </div>
  );
}

/** Its status (latest, then in every sprint it's in), then its fields. */
function InfoTab({ company }: { company: Company }) {
  return (
    <>
      <section className="grid gap-3">
        <h2 className={ui.sectionTitle}>Status by sprint</h2>
        <SprintStatuses company={company} />
      </section>
      <section className="grid gap-3">
        <h2 className={ui.sectionTitle}>Details</h2>
        <p className="m-0 -mt-1 text-[13px] text-muted">Star a field to show it on the sheet.</p>
        <FieldRows company={company} />
      </section>
    </>
  );
}

/** The right-hand timeline (like Kitsu's): every event, newest first, on a line. */
function Timeline({ company }: { company: Company }) {
  const { pages } = useWorkspace();
  const events = eventsOf(pages[company.id]);
  return (
    <aside
      aria-label="Timeline"
      className="hidden w-[380px] shrink-0 overflow-y-auto border-l border-line bg-panel px-4 pt-5 pb-10 lg:block"
    >
      <h2 className={`${ui.sectionTitle} mb-4 text-[16px]`}>Timeline</h2>
      {events.length ? (
        <ol className="relative m-0 grid list-none gap-3.5 border-l-2 border-selectable pl-5">
          {events.map((ev) => {
            return (
              <li key={ev.id} className="relative grid gap-1">
                <span className="absolute top-1.5 -left-[27px] size-3 rounded-full border-2 border-panel bg-selectable" />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] text-muted">{when(ev)}</span>
                  <EventTag event={ev} />
                </div>
                <p className="m-0 line-clamp-3 text-[13.5px] text-fg">{ev.text}</p>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="m-0 text-muted">Nothing yet.</p>
      )}
    </aside>
  );
}
