/**
 * Reacher's building blocks (M7). Kitsu shapes how things work; this file is
 * how they look: calm dark surfaces, soft tinted status tags with a dot,
 * 8px corners, IBM Plex. Screens use these, so a restyle happens here.
 */
import * as RadixPopover from '@radix-ui/react-popover';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { colorFor, optionLabel, optionOf, optList } from '../model/board';
import type { Column, ColorName } from '../model/types';
import { popIn } from '../motion';

export const ui = {
  button:
    'inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-surface px-3 text-[13.5px] font-medium text-fg transition-colors hover:border-line-strong hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50',
  iconButton:
    'inline-grid size-9 place-items-center rounded-lg border border-line bg-surface text-muted transition-colors hover:border-line-strong hover:bg-hover hover:text-fg',
  ghostIcon:
    'inline-grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-fg',
  primary:
    'inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg bg-accent px-3.5 text-[13.5px] font-semibold text-accent-ink transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50',
  label: 'text-[11.5px] font-semibold uppercase tracking-[0.06em] text-faint',
  sectionTitle: 'm-0 font-display text-[17px] font-bold text-strong',
  block: 'rounded-xl border border-line bg-surface',
  input:
    'h-9 rounded-lg border border-line bg-bg px-3 text-[13.5px] text-fg outline-none transition-colors placeholder:text-faint focus:border-selectable',
  menu: 'z-50 grid max-h-[70vh] gap-0.5 overflow-auto rounded-xl border border-line bg-surface-2 p-1.5 shadow-panel',
};

export const colorVar = (c: ColorName | '' | undefined) => `var(--c-${c || 'grey'})`;

/** A status choice: a soft tag in its color with a dot. Empty shows a faint dash. */
export function StatusTag({
  col,
  value,
  className = '',
}: {
  col: Column | undefined;
  value: unknown;
  className?: string;
}) {
  const o = col && value ? optionOf(col, value) : undefined;
  if (!o) return <span className={`text-[13px] text-faint ${className}`}>—</span>;
  const color = colorVar(o.color || colorFor(col!, o.id));
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12.5px] font-semibold whitespace-nowrap ${className}`}
      style={{ color, background: `color-mix(in srgb, ${color} 16%, transparent)` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {optionLabel(o)}
    </span>
  );
}

const AVATAR_COLORS = ['#4c8dff', '#2cc5c5', '#3ddc84', '#a78bfa', '#ff6fb1', '#f0b03c'];

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

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
      className="inline-grid shrink-0 place-items-center rounded-full font-semibold text-[#0d0f12]"
    >
      {initials(name)}
    </span>
  );
}

/** Tabs: plain words, the current one underlined. */
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
    <div role="tablist" aria-label={label} className="flex gap-5 border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={t.id === current}
          onClick={() => onChange(t.id)}
          className="-mb-px border-b-2 border-transparent pb-2 text-[14px] text-muted transition-colors hover:text-fg aria-selected:border-accent aria-selected:font-semibold aria-selected:text-strong"
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** A floating panel on a trigger (menus, editors). The trigger is rendered as-is. */
export function Pop({
  open,
  onOpenChange,
  trigger,
  children,
  width = 240,
  align = 'start',
  label,
  className = ui.menu,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  trigger: ReactNode;
  children: ReactNode;
  width?: number;
  align?: 'start' | 'center' | 'end';
  label?: string;
  className?: string;
}) {
  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <AnimatePresence>
        {open && (
          <RadixPopover.Portal forceMount>
            <RadixPopover.Content
              asChild
              forceMount
              align={align}
              sideOffset={6}
              collisionPadding={12}
              aria-label={label}
            >
              <motion.div
                variants={popIn}
                initial="initial"
                animate="enter"
                exit="exit"
                style={{ width }}
                className={className}
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

/** A dropdown button showing its current value. */
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
    <Pop
      open={open}
      onOpenChange={onOpenChange}
      width={width}
      label={ariaLabel}
      trigger={
        <button type="button" aria-label={ariaLabel} className={`${ui.button} ${className}`}>
          {icon}
          <span className="min-w-0 truncate">{label}</span>
          <ChevronDown size={15} className="shrink-0 text-faint" aria-hidden="true" />
        </button>
      }
    >
      {children}
    </Pop>
  );
}

export function MenuItem({
  children,
  onSelect,
  active = false,
  muted = false,
  danger = false,
}: {
  children: ReactNode;
  onSelect: () => void;
  active?: boolean;
  muted?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onSelect}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13.5px] transition-colors hover:bg-hover aria-checked:bg-selected ${
        danger ? 'text-[var(--c-red)]' : muted ? 'text-muted' : 'text-fg'
      }`}
    >
      {children}
    </button>
  );
}

export const MenuSeparator = () => <div className="my-1 border-t border-line" />;

/** Pick a status choice: the tag, then the list grouped like the prototype's picker. */
export function StatusPicker({
  col,
  value,
  onPick,
  label,
  className = '',
}: {
  col: Column;
  value: unknown;
  onPick: (id: string | null) => void;
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const opts = optList(col);
  const groups = [...new Set(opts.map((o) => o.group))];
  const pick = (id: string | null) => {
    onPick(id);
    setOpen(false);
  };
  return (
    <Pop
      open={open}
      onOpenChange={setOpen}
      width={230}
      label={label}
      trigger={
        <button
          type="button"
          aria-label={label}
          className={`flex h-9 items-center gap-2 rounded-lg border border-line bg-bg px-2.5 hover:border-line-strong ${className}`}
        >
          <StatusTag col={col} value={value} />
          <ChevronDown size={15} className="text-faint" />
        </button>
      }
    >
      {groups.map((g, i) => (
        <div key={g || i} className="grid gap-0.5">
          {i > 0 && <MenuSeparator />}
          {g && <div className={`${ui.label} px-2.5 pt-1 pb-0.5`}>{g}</div>}
          {opts
            .filter((o) => o.group === g)
            .map((o) => (
              <MenuItem key={o.id} active={o.id === value} onSelect={() => pick(o.id)}>
                <StatusTag col={col} value={o.id} />
              </MenuItem>
            ))}
        </div>
      ))}
      <MenuSeparator />
      <MenuItem muted active={!value} onSelect={() => pick(null)}>
        No status
      </MenuItem>
    </Pop>
  );
}
