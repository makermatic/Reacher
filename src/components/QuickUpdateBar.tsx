import { useState } from 'react';

/**
 * Where you tell Reacher what happened ("Interview with New York Life on
 * 11/6 at 12:30"). The AI behind it arrives in M5; for now it only looks the part.
 */
export function QuickUpdateBar() {
  const [text, setText] = useState('');
  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="flex items-stretch gap-2 rounded-xl border border-line bg-surface py-1.5 pr-1.5 pl-3.5 shadow-xs transition-[border-color,box-shadow] duration-200 ease-standard focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)]"
    >
      <label
        htmlFor="quick-input"
        className="eyebrow self-center whitespace-nowrap text-accent max-sm:sr-only"
      >
        Quick update
      </label>
      <input
        id="quick-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Tell Reacher what happened, like “Interview with New York Life on 11/6 at 12:30”"
        autoComplete="off"
        className="min-w-0 flex-1 border-0 bg-transparent px-1 py-1.5 text-[14.5px] outline-none placeholder:text-faint"
      />
      <button
        type="submit"
        disabled
        title="Quick update arrives in a later update"
        className="rounded-lg bg-accent px-3.5 font-medium text-accent-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        Update
      </button>
    </form>
  );
}
