import { useRuntime } from '../runtime/RuntimeProvider';
import { ViewSwitcher, type View } from './ViewSwitcher';

/** Small square icon buttons, so the header never wraps when the page is wide (Zack, round 3). */
const iconButton =
  'grid size-8 place-items-center rounded-lg border border-line-strong bg-surface text-[15px] leading-none transition-colors hover:bg-hover';

/** Where this visit's data is saved, in a word. */
function SyncBadge() {
  const runtime = useRuntime();
  const [label, title] =
    runtime.status !== 'ready'
      ? ['Connecting', 'Connecting to your Claude account']
      : runtime.kind === 'claude'
        ? ['Synced', 'Saved to your Claude account and synced across your devices']
        : ['This browser', 'Saved in this browser only. Open Reacher in Claude to sync.'];
  return (
    <span
      title={title}
      className="eyebrow rounded-full border border-line-strong px-2 py-0.5 text-muted"
    >
      {label}
    </span>
  );
}

export function Header({
  view,
  onViewChange,
  onOpenDetails,
  onOpenTemplates,
}: {
  view: View;
  onViewChange: (v: View) => void;
  onOpenDetails: () => void;
  onOpenTemplates: () => void;
}) {
  return (
    <header className="flex items-center gap-3">
      <div className="flex min-w-0 items-baseline gap-2.5">
        <h1 className="m-0 font-display text-[22px] font-bold tracking-[-0.01em]">Reacher</h1>
        <SyncBadge />
      </div>
      <ViewSwitcher view={view} onChange={onViewChange} />
      <div className="flex-1" />
      <button
        type="button"
        className={iconButton}
        onClick={onOpenTemplates}
        aria-label="Email templates"
        title="Email templates"
      >
        <span aria-hidden="true">✉️</span>
      </button>
      <button
        type="button"
        className={iconButton}
        onClick={onOpenDetails}
        aria-label="Your details"
        title="Your details"
      >
        <span aria-hidden="true">⚙️</span>
      </button>
    </header>
  );
}
