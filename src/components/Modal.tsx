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

/** Shared button looks. */
export const btn = {
  base: 'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-line-strong bg-surface px-3 py-1.5 font-medium transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50',
  primary:
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-accent bg-accent px-3.5 py-1.5 font-medium text-accent-ink transition-[filter] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60',
  ghost:
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 font-medium text-muted transition-colors hover:bg-hover hover:text-fg disabled:opacity-50',
  small: 'px-2 py-1 text-[12.5px]',
  danger: 'text-[var(--c-red)]',
  icon: 'inline-grid h-7 w-7 place-items-center rounded-md text-faint transition-colors hover:bg-line hover:text-fg disabled:opacity-40',
};

/** Shared text-field look. */
export const field =
  'w-full rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 outline-none transition-[border-color] duration-200 focus:border-accent';
