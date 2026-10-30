import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { dialogIn, fade } from '../motion';

/** A centered dialog that rises in and fades out. Escape and clicking outside close it. */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  wide = false,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                variants={fade}
                initial="initial"
                animate="enter"
                exit="exit"
                className="fixed inset-0 z-40 bg-black/30"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                variants={dialogIn}
                initial="initial"
                animate="enter"
                exit="exit"
                className={`fixed inset-x-4 top-[8vh] z-50 mx-auto max-h-[84vh] overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-panel ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
              >
                <Dialog.Title className="m-0 font-display text-xl font-bold">{title}</Dialog.Title>
                {description && <div className="mt-1 text-muted">{description}</div>}
                <div className="mt-5">{children}</div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

/** Shared button looks, matching the app's kit (src/app/ui.tsx, M7g). */
export const btn = {
  base: 'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-surface px-3 py-1.5 text-[13.5px] font-medium text-fg transition-colors hover:border-line-strong hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50',
  primary:
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-accent bg-accent px-3.5 py-1.5 text-[13.5px] font-semibold text-accent-ink transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50',
  ghost:
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13.5px] font-medium text-muted transition-colors hover:bg-hover hover:text-fg disabled:opacity-50',
  small: 'px-2.5 py-1 text-[12.5px]',
  danger: 'text-[var(--c-red)]',
  icon: 'inline-grid h-7 w-7 place-items-center rounded-md text-faint transition-colors hover:bg-hover hover:text-fg disabled:opacity-40',
};

/** Shared text-field look (full width). */
export const field =
  'w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-[13.5px] text-fg outline-none transition-colors placeholder:text-faint focus:border-selectable';

/** The same look, sized to its content: selects, dates and times inside a row. */
export const fieldInline = field.replace('w-full ', 'w-auto max-w-full ');
