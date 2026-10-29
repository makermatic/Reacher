/**
 * The app's building blocks, in Kitsu's look (M7): rounded 10px controls on
 * the page background, uppercase status tags, initials avatars, underlined
 * tabs. Screens use these instead of their own class strings, so a restyle
 * happens here.
 */
import * as RadixPopover from '@radix-ui/react-popover';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { optionLabel, optionOf } from '../model/board';
import type { Column } from '../model/types';
import { popIn } from '../motion';

export const ui = {
  /** Kitsu's bordered button (Display Settings, Create shots). */
  button:
    'inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-[10px] border border-line-strong/60 bg-bg px-3 text-[14px] text-fg transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50',
  /** Same, square with an icon. */
  iconButton:
    'inline-grid size-10 place-items-center rounded-[10px] border border-line-strong/60 bg-bg text-muted transition-colors hover:bg-hover hover:text-fg',
  /** Borderless icon (panel header actions). */
  ghostIcon:
    'inline-grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-fg',
  /** The primary action (Post). */
  primary:
    'inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-[10px] bg-accent px-3.5 font-bold text-accent-ink transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50',
  /** Uppercase grey label over a block (SHOT TASKS, INFORMATION). */
  sectionTitle: 'm-0 text-[20px] font-normal uppercase tracking-[0.08em] text-muted',
  /** Kitsu's filter label (EPISODE, TASK STATUS). */
  label: 'text-[11px] font-bold uppercase tracking-[0.08em] text-muted',
  /** A raised block (Kitsu's white/grey card). */
  block: 'rounded-[10px] bg-surface',
  input:
    'h-10 rounded-[10px] border border-line-strong/60 bg-bg px-3 text-fg outline-none transition-colors placeholder:text-faint focus:border-accent',
};

/** A status as Kitsu shows it: an uppercase colored tag. */
export function StatusTag({
  col,
  value,
  className = '',
}: {
  col: Column;
  value: unknown;
  className?: string;
}) {
  const o = optionOf(col, value);
  if (!o) return <span className={`schip empty ${className}`}>—</span>;
  return <span className={`schip c-${o.color || 'grey'} ${className}`}>{optionLabel(o)}</span>;
}

const AVATAR_COLORS = ['#3273dc', '#00a8a8', '#22b35e', '#a74ef0', '#e8459a', '#e0a01e', '#7375bc'];

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** A round initials badge (people, and AI, Gmail, Calendar in the feed). */
export function Avatar({
  name,
  size = 28,
  color,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  const hue =
    color ??
    AVATAR_COLORS[[...name].reduce((n, ch) => n + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, background: hue, fontSize: size * 0.4 }}
      className="inline-grid shrink-0 place-items-center rounded-full font-bold text-white"
    >
      {initials(name)}
    </span>
  );
}

/** Kitsu's tab row: plain words, the current one underlined. */
export function Tabs<T extends string>({
  tabs,
  current,
  onChange,
  label,
}: {
  tabs: readonly { id: T; label: ReactNode }[];
  current: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-6 border-b border-line-strong/40">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={t.id === current}
          onClick={() => onChange(t.id)}
          className="-mb-px border-b-2 border-transparent pb-2.5 text-[15px] text-muted transition-colors hover:text-fg aria-selected:border-selectable aria-selected:font-bold aria-selected:text-strong"
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/**
 * A dropdown button (Kitsu's comboboxes in the top bar and toolbars): shows
 * the current value and a chevron; opens a list under it.
 */
export function Dropdown({
  open,
  onOpenChange,
  label,
  children,
  icon,
  width = 260,
  className = '',
  ariaLabel,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  label: ReactNode;
  children: ReactNode;
  icon?: ReactNode;
  width?: number;
  className?: string;
  ariaLabel: string;
}) {
  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      <RadixPopover.Trigger asChild>
        <button type="button" aria-label={ariaLabel} className={`${ui.button} ${className}`}>
          {icon}
          <span className="min-w-0 truncate">{label}</span>
          <ChevronDown size={16} className="shrink-0 text-accent" aria-hidden="true" />
        </button>
      </RadixPopover.Trigger>
      <AnimatePresence>
        {open && (
          <RadixPopover.Portal forceMount>
            <RadixPopover.Content
              asChild
              forceMount
              align="start"
              sideOffset={6}
              collisionPadding={12}
            >
              <motion.div
                variants={popIn}
                initial="initial"
                animate="enter"
                exit="exit"
                style={{ width }}
                className="z-50 grid max-h-[70vh] gap-0.5 overflow-auto rounded-[10px] border border-line bg-surface p-1.5 shadow-panel"
              >
                {children}
              </motion.div>
            </RadixPopover.Content>
          </RadixPopover.Portal>
        )}
      </AnimatePresence>
    </RadixPopover.Root>
  );
}

/** One choice in a Dropdown. */
export function MenuItem({
  children,
  onSelect,
  active = false,
  muted = false,
}: {
  children: ReactNode;
  onSelect: () => void;
  active?: boolean;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onSelect}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-hover aria-checked:bg-selected aria-checked:text-white ${
        muted ? 'text-muted' : 'text-fg'
      }`}
    >
      {children}
    </button>
  );
}
