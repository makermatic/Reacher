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
          <SprintPicker />
          {(route.page === 'companies' || route.page === 'people') && (
            <>
              <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden="true" />
              <ListPicker />
            </>
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
        <Avatar name={me?.name || 'You'} size={40} color="#a7d930" />
      </button>
    </header>
  );
}

/** The sprint dropdown: All companies, each sprint (newest first), + New sprint. */
function SprintPicker() {
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

  const current = sprint ? info[sprint]?.label : 'All companies';
  return (
    <Dropdown
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setCreating(false);
      }}
      ariaLabel="Sprint"
      icon={<Layers size={16} className="text-muted" aria-hidden="true" />}
      label={current ?? 'All companies'}
      width={320}
      className="max-w-[340px]"
    >
      <MenuItem
        active={!sprint}
        onSelect={() => {
          setSprint(null);
          setOpen(false);
        }}
      >
        All companies
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
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
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
          <Plus size={16} className="text-accent" aria-hidden="true" /> New sprint
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

/** Companies or People (M11): the two lists, like Kitsu's shots and assets. */
function ListPicker() {
  const { route, navigate, select } = useAppUI();
  const [open, setOpen] = useState(false);
  const people = route.page === 'people';
  const go = (page: 'companies' | 'people') => {
    setOpen(false);
    if (route.page !== page) select(null);
    navigate({ page });
  };
  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      ariaLabel="List"
      icon={
        people ? (
          <Users size={16} className="text-muted" aria-hidden="true" />
        ) : (
          <Building2 size={16} className="text-muted" aria-hidden="true" />
        )
      }
      label={people ? 'People' : 'Companies'}
      width={200}
    >
      <MenuItem active={!people} onSelect={() => go('companies')}>
        <Building2 size={16} aria-hidden="true" /> Companies
      </MenuItem>
      <MenuItem active={people} onSelect={() => go('people')}>
        <Users size={16} aria-hidden="true" /> People
      </MenuItem>
    </Dropdown>
  );
}
