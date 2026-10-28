import { useState, type KeyboardEvent } from 'react';
import { colorFor } from '../model/board';
import { rankOptions, splitMatch } from '../model/picker';
import type { Column } from '../model/types';
import { btn, field } from '../components/Modal';
import { PopoverHeader } from '../components/Popover';
import { useSheetUI } from './SheetUI';

/**
 * The picker for status and list-of-values columns (SPEC section 3): type to
 * search, matches underlined, arrows move, Enter picks, plus Clear and Edit choices.
 */
export function OptionPicker({
  col,
  current,
  onPick,
  onClear,
}: {
  col: Column;
  current: unknown;
  onPick: (id: string) => void;
  onClear: () => void;
}) {
  const { editChoices } = useSheetUI();
  const [query, setQuery] = useState('');
  const [hi, setHi] = useState(0);
  const items = rankOptions(col, query);
  const active = Math.min(hi, Math.max(0, items.length - 1));
  const q = query.trim();

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHi(Math.min(items.length - 1, active + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHi(Math.max(0, active - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = items[active];
      if (o) onPick(o.id);
    }
  };

  return (
    <>
      <PopoverHeader title={col.name} caption="type, then Enter" />
      <input
        autoFocus
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setHi(0);
        }}
        onKeyDown={onKeyDown}
        placeholder="Search…"
        aria-label={`Search ${col.name} choices`}
        autoComplete="off"
        className={field}
      />
      <div role="listbox" aria-label={`${col.name} choices`} className="grid gap-px">
        {items.map((o, i) => {
          const showGroup = !q && (i === 0 || items[i - 1]!.group !== o.group);
          const [before, match, after] = splitMatch(o.label, q);
          const color = o.color || colorFor(col, o.id);
          return (
            <div key={o.id} className="contents">
              {showGroup && o.group && (
                <div className="eyebrow px-1.5 pt-2 pb-0.5 text-[10px] text-faint">{o.group}</div>
              )}
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                onClick={() => onPick(o.id)}
                onMouseEnter={() => setHi(i)}
                className={`c-${color} flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                  i === active ? 'bg-accent-soft shadow-[inset_2px_0_0_var(--accent)]' : ''
                }`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--c)]" />
                <span className="min-w-0 truncate">
                  {o.icon && `${o.icon} `}
                  {before}
                  {match && (
                    <mark className="bg-transparent font-bold text-inherit underline decoration-accent underline-offset-2">
                      {match}
                    </mark>
                  )}
                  {after}
                </span>
                <span className="ml-auto flex shrink-0 items-center gap-1.5">
                  {o.id === current && <span className="text-[11px] text-muted">current</span>}
                  {q && o.group && (
                    <span className="eyebrow text-[10px] text-faint">{o.group}</span>
                  )}
                  {i === active && (
                    <span className="rounded-sm border border-line-strong px-1 font-mono text-[10px] text-muted">
                      ↵
                    </span>
                  )}
                </span>
              </button>
            </div>
          );
        })}
        {!items.length && (
          <div className="p-1.5 text-[12.5px] text-muted">No match. Edit choices to add one.</div>
        )}
      </div>
      <div className="flex gap-1">
        <button type="button" className={`${btn.ghost} ${btn.small}`} onClick={onClear}>
          Clear
        </button>
        <button
          type="button"
          className={`${btn.ghost} ${btn.small}`}
          onClick={() => editChoices(col.id)}
        >
          Edit choices
        </button>
      </div>
    </>
  );
}
