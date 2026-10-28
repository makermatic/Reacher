import { DEFAULT_COLUMN_NAMES } from '../model/defaults';

const COLUMNS = ['Status', ...DEFAULT_COLUMN_NAMES];

/** The Kitsu-style sheet: one row per company. Empty until M2 adds companies. */
export function SheetView() {
  return (
    <section
      aria-label="Sheet"
      className="flex h-full min-h-0 flex-col rounded-xl border border-line bg-surface"
    >
      <div className="flex items-center gap-3 border-b border-line px-3 py-2">
        <input
          type="search"
          disabled
          placeholder="Search companies"
          className="w-56 max-w-full rounded-lg border border-line-strong bg-surface-2 px-3 py-1.5 disabled:opacity-60"
        />
        <span className="eyebrow text-faint">0 companies</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-max min-w-full border-separate border-spacing-0 text-left">
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-20 w-56 border-r border-b border-line bg-surface-2 px-3 py-2 font-medium text-muted">
                Company
              </th>
              {COLUMNS.map((name) => (
                <th
                  key={name}
                  className="sticky top-0 z-10 min-w-36 border-b border-line bg-surface-2 px-3 py-2 font-medium whitespace-nowrap text-muted"
                >
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="sticky left-0 border-r border-b border-line bg-surface px-3 py-2">
                <input
                  disabled
                  placeholder="+ Add a company"
                  className="w-full bg-transparent placeholder:text-faint disabled:cursor-not-allowed"
                />
              </td>
              <td colSpan={COLUMNS.length} className="border-b border-line" />
            </tr>
          </tbody>
        </table>
        <div className="mx-auto max-w-sm px-4 py-14 text-center">
          <p className="m-0 font-display text-lg font-semibold">Your companies show up here</p>
          <p className="mt-1.5 text-muted">
            One row per studio, network or agency, with its status, contact and follow-up date.
            Adding companies and importing your prototype data come in the next update.
          </p>
        </div>
      </div>
    </section>
  );
}
