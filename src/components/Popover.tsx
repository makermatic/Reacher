import * as RadixPopover from '@radix-ui/react-popover';
import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState, type ReactNode } from 'react';
import { fade, popIn } from '../motion';

/** Inside a popover: 12px padding + 1px border, then a field's 1px border, 10px side and 6px top padding. */
const FIELD_TEXT_LEFT = 12 + 1 + 1 + 10;
const FIELD_TEXT_TOP = 12 + 1 + 1 + 6;

type Geometry = { sideOffset: number; alignOffset: number; width: number };

/**
 * A small floating panel anchored to its trigger (cell editors, pickers,
 * menus). Opens under the trigger, flips above when there's no room, closes on
 * Escape or a click outside.
 *
 * `cover`: the panel opens on top of the trigger with its first field's text
 * exactly over the value being edited (Zack, round 2), so editing happens in
 * place rather than in a box beside it.
 */
export function Popover({
  open,
  onOpenChange,
  trigger,
  children,
  width = 300,
  align = 'start',
  label,
  cover = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The element it anchors to; rendered as-is. */
  trigger: ReactNode;
  children: ReactNode;
  width?: number;
  align?: 'start' | 'center' | 'end';
  label?: string;
  cover?: boolean;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [geometry, setGeometry] = useState<Geometry | null>(null);

  const change = (next: boolean) => {
    const el = triggerRef.current;
    if (next && cover && el) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const padTop = parseFloat(cs.paddingTop) || 0;
      const padLeft = parseFloat(cs.paddingLeft) || 0;
      setGeometry({
        sideOffset: -r.height + padTop - FIELD_TEXT_TOP,
        alignOffset: padLeft - FIELD_TEXT_LEFT,
        width: Math.max(width, Math.min(r.width + FIELD_TEXT_LEFT * 2, 420)),
      });
    }
    onOpenChange(next);
  };

  const g = cover ? geometry : null;
  return (
    <RadixPopover.Root open={open} onOpenChange={change}>
      <RadixPopover.Trigger asChild ref={triggerRef}>
        {trigger}
      </RadixPopover.Trigger>
      <AnimatePresence>
        {open && (
          <RadixPopover.Portal forceMount>
            <RadixPopover.Content
              asChild
              forceMount
              align={align}
              sideOffset={g ? g.sideOffset : 6}
              alignOffset={g ? g.alignOffset : 0}
              collisionPadding={12}
              aria-label={label}
            >
              <motion.div
                variants={g ? fade : popIn}
                initial="initial"
                animate="enter"
                exit="exit"
                style={{ width: g ? g.width : width }}
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
