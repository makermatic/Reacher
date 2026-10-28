import * as RadixPopover from '@radix-ui/react-popover';
import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { popIn } from '../motion';

/**
 * A small floating panel anchored to its trigger (cell editors, pickers,
 * menus). Opens under the trigger, flips above when there's no room, closes on
 * Escape or a click outside.
 */
export function Popover({
  open,
  onOpenChange,
  trigger,
  children,
  width = 300,
  align = 'start',
  label,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The element it anchors to; rendered as-is. */
  trigger: ReactNode;
  children: ReactNode;
  width?: number;
  align?: 'start' | 'center' | 'end';
  label?: string;
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
                className="z-30 grid max-h-[min(72vh,var(--radix-popover-content-available-height))] max-w-[calc(100vw-32px)] gap-2.5 overflow-auto rounded-xl border border-line-strong bg-surface p-3 shadow-panel"
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

/** The bold title row at the top of a popover, with an optional small caption. */
export function PopoverHeader({ title, caption }: { title: string; caption?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 font-semibold">
      <span className="min-w-0 truncate">{title}</span>
      {caption && <span className="eyebrow shrink-0 text-[10px] text-faint">{caption}</span>}
    </div>
  );
}
