import { useState, type ReactNode } from 'react';
import { field } from '../components/Modal';

/**
 * Text you click to rename in place: Enter or clicking away saves, Escape
 * cancels. Blank names are ignored.
 */
export function InlineText({
  value,
  onSave,
  label,
  className,
  inputClassName = '',
  children,
}: {
  value: string;
  onSave: (v: string) => void;
  label: string;
  className: string;
  inputClassName?: string;
  /** How the text looks when not editing (defaults to the value). */
  children?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <button
        type="button"
        title={label}
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className={className}
      >
        {children ?? value}
      </button>
    );
  }
  const finish = (save: boolean) => {
    setEditing(false);
    if (save && draft.trim() && draft.trim() !== value) onSave(draft.trim());
  };
  return (
    <input
      autoFocus
      value={draft}
      aria-label={label}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(true);
        if (e.key === 'Escape') {
          e.stopPropagation();
          finish(false);
        }
      }}
      className={`${field} ${inputClassName}`}
    />
  );
}
