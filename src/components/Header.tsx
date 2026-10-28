import { useRuntime } from '../runtime/RuntimeProvider';
import { ViewSwitcher, type View } from './ViewSwitcher';

const button =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-line-strong bg-surface px-3 py-1.5 font-medium transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50';

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
    <header className="flex flex-wrap items-center gap-3">
      <div className="flex min-w-0 items-baseline gap-2.5">
        <h1 className="m-0 font-display text-[22px] font-bold tracking-[-0.01em]">Reacher</h1>
        <SyncBadge />
      </div>
      <ViewSwitcher view={view} onChange={onViewChange} />
      <div className="flex-1" />
      <button type="button" className={button} onClick={onOpenTemplates}>
        Email templates
      </button>
      <button type="button" className={button} onClick={onOpenDetails}>
        Your details
      </button>
    </header>
  );
}
