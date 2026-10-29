import { useState } from 'react';

/**
 * Text that is its own editor: click it and the caret lands where you clicked,
 * no box, outline or hover tint (Zack, rounds 2 and 3). Enter or clicking away saves, Escape puts it back.
 * Blank names are ignored.
 */
export function InlineText({
  value,
  onSave,
  label,
  className,
}: {
  value: string;
  onSave: (v: string) => void;
  label: string;
  /** The text's own look (font, size, weight); the input adds nothing visible. */
  className: string;
}) {
  const [draft, setDraft] = useState(value);
  const [shown, setShown] = useState(value);
  // Follow renames made elsewhere (another device, a quick update).
  if (value !== shown) {
    setShown(value);
    setDraft(value);
  }

  const commit = () => {
    const v = draft.trim();
    if (v && v !== value) onSave(v);
    else setDraft(value);
  };

  return (
    <input
      value={draft}
      aria-label={label}
      title={label}
      spellCheck={false}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          // Undo the edit without also closing the company page.
          e.preventDefault();
          e.stopPropagation();
          setDraft(value);
          requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
        }
      }}
      className={`block w-full min-w-0 cursor-text truncate border-0 bg-transparent p-0 outline-none ${className}`}
    />
  );
}
