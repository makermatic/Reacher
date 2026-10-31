import { ArrowLeft, Building2, ChevronRight, Layers, Plus, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { QuickUpdateBar } from '../components/QuickUpdateBar';
import { useToast } from '../components/Toast';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { useAppUI } from './AppUI';
import { useSprintInfo } from './sprintLabels';
import { Avatar, Dropdown, MenuItem, ui } from './ui';

/** Reacher's mark; like Kitsu's fox, it opens the sidebar. */
export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="grid place-items-center rounded-[10px] bg-accent text-[19px] font-black text-accent-ink"
    >
      R
    </span>
  );
}

/**
 * Kitsu's top bar (M7): the mark (opens the sidebar), then a breadcrumb of
 * dropdowns (Sprint › Page) on sprint pages or the page's title elsewhere,
 * then Quick update, then you.
 */
export function Topbar() {
  const { route, navigate, openSidebar } = useAppUI();
  const { me } = useWorkspace();
  const sprintPages =
    route.page === 'companies' ||
    route.page === 'people' ||
    route.page === 'news' ||
    route.page === 'company';
  const title =
    {
      tasks: 'My Tasks',
      settings: 'Settings',
      statuses: 'Status types',
      templates: 'Email templates',
      sprints: 'Sprints',
    }[route.page as string] ?? '';

  return (
    <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-line bg-topbar px-3">
      <button
        type="button"
        onClick={openSidebar}
        aria-label="Open the menu"
        title="Menu"
        className="rounded-[10px] transition-transform hover:scale-105"
      >
        <BrandMark />
      </button>
      {sprintPages ? (
        <nav aria-label="Where you are" className="flex min-w-0 items-center gap-2">
          {route.page === 'companies' || route.page === 'people' ? (
            // "All" (or the sprint) with the two lists as icon toggles (Zack's sketch, M11).
            <div className="flex items-center">
              {/* Squared on the right so the list icons join it; a long name shortens. */}
              <SprintPicker className="max-w-[280px] !rounded-r-none" />
              <ListToggle />
            </div>
          ) : (
            <SprintPicker />
          )}
          {route.page === 'news' && (
            <>
              <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden="true" />
              <span className="text-[14px] font-semibold text-strong">News Feed</span>
            </>
          )}
        </nav>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate({ page: 'companies' })}
            aria-label="Back to companies"
            className={ui.ghostIcon}
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="m-0 text-[18px] font-bold text-strong">{title}</h1>
        </div>
      )}
      <div className="ml-auto flex min-w-0 max-w-[620px] flex-1 items-center">
        <QuickUpdateBar />
      </div>
      <button
        type="button"
        onClick={() => navigate({ page: 'settings', tab: 'details' })}
        aria-label="Your details"
        title="Your details"
        className="rounded-full"
      >
        <Avatar name={me?.name || 'You'} size={40} color="#6633aa" />
      </button>
    </header>
  );
}

/** The sprint dropdown: All, each sprint (newest first), + New sprint. */
function SprintPicker({ className = '' }: { className?: string }) {
  const { sprints, sprint, setSprint, actions } = useWorkspace();
  const info = useSprintInfo();
  const toast = useToast();
  const { navigate } = useAppUI();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const create = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const id = actions.createSprint(name);
    setSprint(id);
    setName('');
    setCreating(false);
    setOpen(false);
    toast(`New sprint: ${name.trim()}`);
  };

  const current = sprint ? info[sprint]?.label : 'All';
  return (
    <Dropdown
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setCreating(false);
      }}
      ariaLabel="Sprint"
      icon={<Layers size={16} className="text-muted" aria-hidden="true" />}
      label={current ?? 'All'}
      width={320}
      className={className || 'max-w-[340px]'}
    >
      <MenuItem
        active={!sprint}
        onSelect={() => {
          setSprint(null);
          setOpen(false);
        }}
      >
        All
      </MenuItem>
      {sprints.length > 0 && <div className="my-1 border-t border-line" />}
      {[...sprints].reverse().map((s) => (
        <MenuItem
          key={s.id}
          active={s.id === sprint}
          muted={info[s.id]?.over}
          onSelect={() => {
            setSprint(s.id);
            setOpen(false);
          }}
        >
          <span className="min-w-0 flex-1 truncate">{info[s.id]?.label ?? s.name}</span>
          {!info[s.id]?.over && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent-text">
              Current
            </span>
          )}
        </MenuItem>
      ))}
      <div className="my-1 border-t border-line" />
      {creating ? (
        <form onSubmit={create} className="grid gap-1.5 p-1.5">
          <input
            id="new-sprint-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name it, like First Light"
            aria-label="Sprint name"
            className={ui.input}
          />
          <span className="text-[12px] text-faint">
            Today’s date is added to the name. Press Enter to create.
          </span>
        </form>
      ) : (
        <MenuItem onSelect={() => setCreating(true)}>
          <Plus size={16} className="text-accent-text" aria-hidden="true" /> New sprint
        </MenuItem>
      )}
      <MenuItem
        muted
        onSelect={() => {
          setOpen(false);
          navigate({ page: 'sprints' });
        }}
      >
        Manage sprints…
      </MenuItem>
    </Dropdown>
  );
}

/**
 * The list filter (M11 round 2, Zack's sketch): Companies and People as two
 * icons next to the sprint, both on by default (companies with their people
 * under them). Click one to turn it off or on; at least one stays on.
 */
function ListToggle() {
  const { route, navigate, select, showPeople, setShowPeople } = useAppUI();
  const companiesOn = route.page === 'companies';
  const peopleOn = route.page === 'people' || showPeople;
  const toggleCompanies = () => {
    if (companiesOn && !peopleOn) return;
    select(null);
    if (companiesOn) navigate({ page: 'people' });
    else {
      setShowPeople(true);
      navigate({ page: 'companies' });
    }
  };
  const togglePeople = () => {
    if (peopleOn && !companiesOn) return;
    setShowPeople(!peopleOn);
  };
  const item = (on: boolean, label: string, Icon: typeof Users, onClick: () => void) => (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={on ? `${label}: on` : `${label}: off`}
      onClick={onClick}
      className={`grid size-7 place-items-center rounded-md transition-colors ${
        on
          ? 'bg-[color-mix(in_srgb,var(--selectable)_22%,transparent)] text-selectable'
          : 'text-faint hover:bg-hover hover:text-muted'
      }`}
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  );
  return (
    <div
      role="group"
      aria-label="Show"
      className="flex h-9 items-center gap-0.5 rounded-r-lg border border-l-0 border-line bg-surface px-1"
    >
      {item(companiesOn, 'Companies', Building2, toggleCompanies)}
      {item(peopleOn, 'People', Users, togglePeople)}
    </div>
  );
}
