import { AnimatePresence, motion } from 'motion/react';
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { caretRect } from '../lib/caret';
import { insertField, matchFields, mentionAt, type FieldItem } from '../model/mention';
import { popIn } from '../motion';

type Field = HTMLInputElement | HTMLTextAreaElement;
type Open = {
  start: number;
  query: string;
  caret: number;
  left: number;
  top: number;
  line: number;
};

const MENU_WIDTH = 260;
const MENU_MAX = 240;

/**
 * Type # in a text box to pick a fill-in field from a small menu above the
 * caret, like Discord channels (Zack, rounds 2 and 3). Arrows move, Enter or
 * Tab inserts #field, Escape closes. Spread `fieldProps` onto the input or textarea
 * (it supplies onChange) and render `menu` anywhere.
 */
export function useFieldPicker<T extends Field>({
  items,
  onChange,
}: {
  items: FieldItem[];
  onChange: (value: string) => void;
}): {
  fieldProps: {
    ref: React.RefObject<T | null>;
    onChange: (e: ChangeEvent<T>) => void;
    onSelect: () => void;
    onKeyDown: (e: KeyboardEvent<T>) => void;
    onBlur: () => void;
  };
  menu: ReactNode;
} {
  const ref = useRef<T>(null);
  const [open, setOpen] = useState<Open | null>(null);
  const [active, setActive] = useState(0);
  // The @ you pressed Escape on stays closed until you type a new one.
  const dismissed = useRef<number | null>(null);
  const matches = open ? matchFields(items, open.query).slice(0, 40) : [];

  const sync = () => {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart ?? 0;
    const hit = el.selectionEnd === caret ? mentionAt(el.value, caret) : null;
    if (!hit) dismissed.current = null;
    if (!hit || hit.start === dismissed.current) return setOpen(null);
    const r = caretRect(el, hit.start);
    if (hit.query !== open?.query || hit.start !== open?.start) setActive(0);
    setOpen({ ...hit, caret, left: r.left, top: r.top, line: r.height });
  };

  const pick = (item: FieldItem) => {
    const el = ref.current;
    if (!el || !open) return;
    const next = insertField(el.value, open.start, open.caret, item.key);
    onChange(next.text);
    // The inserted #field would match itself; stay closed until a new #.
    dismissed.current = open.start;
    setOpen(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
    });
  };

  const onKeyDown = (e: KeyboardEvent<T>) => {
    if (!open) return;
    if (e.key === 'Escape') {
      // Close the menu, not the screen it's on.
      e.preventDefault();
      e.stopPropagation();
      dismissed.current = open.start;
      setOpen(null);
      return;
    }
    if (!matches.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((a) => (a + step + matches.length) % matches.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      pick(matches[Math.min(active, matches.length - 1)]!);
    }
  };

  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  // A drop-up, like Discord; it drops down instead near the top of the window.
  const place = (o: Open) => {
    const left = Math.max(12, Math.min(o.left - 8, window.innerWidth - MENU_WIDTH - 12));
    return o.top > MENU_MAX + 24
      ? { left, bottom: window.innerHeight - o.top + 4 }
      : { left, top: o.top + o.line + 4 };
  };

  const menu = createPortal(
    <AnimatePresence>
      {open && matches.length > 0 && (
        <motion.div
          key="field-picker"
          ref={listRef}
          role="listbox"
          aria-label="Fill-in fields"
          variants={popIn}
          initial="initial"
          animate="enter"
          exit="exit"
          style={{ position: 'fixed', width: MENU_WIDTH, maxHeight: MENU_MAX, ...place(open) }}
          className="z-[60] grid content-start overflow-y-auto rounded-xl border border-line-strong bg-surface p-1 shadow-panel"
        >
          {matches.map((it, i) => (
            <button
              key={it.key}
              type="button"
              role="option"
              aria-selected={i === active}
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(it)}
              className="flex items-baseline justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-[13.5px] aria-selected:bg-accent-soft"
            >
              <span className="min-w-0 truncate">{it.label}</span>
              <span className="shrink-0 text-[11px] text-faint">{it.group}</span>
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );

  return {
    fieldProps: {
      ref,
      onChange: (e) => {
        onChange(e.target.value);
        sync();
      },
      onSelect: sync,
      onKeyDown,
      onBlur: () => setOpen(null),
    },
    menu,
  };
}
