import type { Company } from '../model/types';
import { EditableValue } from '../sheet/MetaCell';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { useAssistant } from '../ai/Assistant';
import { btn } from '../components/Modal';

/**
 * Every column as a label and value; click a value to edit it. Columns hidden
 * from the sheet are marked "Page only" (SPEC section 6).
 */
export function DetailsBody({ company }: { company: Company }) {
  const { board } = useWorkspace();
  const { available, lookup } = useAssistant();
  // Status and its dependent chips (Outcome) live in the page header instead.
  const props = board.columns.filter(
    (col) => col.id !== 'status' && !(col.type === 'status' && col.showWhen),
  );
  return (
    <>
      <div className="grid grid-cols-[minmax(110px,170px)_minmax(0,1fr)] border-t border-line">
        {props.map((col) => (
          <div key={col.id} className="contents">
            <div className="flex min-h-9 items-center gap-1.5 border-b border-line px-2 py-1.5 text-[13px] text-muted">
              {col.name}
              {col.onSheet === false && (
                <span
                  className="font-mono text-[9px] tracking-wide text-faint"
                  title="Hidden from the sheet"
                >
                  PAGE ONLY
                </span>
              )}
            </div>
            <div className="flex min-h-9 min-w-0 items-center border-b border-line">
              <EditableValue
                company={company}
                col={col}
                full
                className="flex min-h-9 w-full flex-wrap items-center gap-0.5 px-2 py-1.5 text-left [overflow-wrap:anywhere] transition-colors hover:bg-hover"
              />
            </div>
          </div>
        ))}
      </div>
      {available && (
        <div>
          <button
            type="button"
            onClick={() => void lookup(company)}
            className={`${btn.ghost} ${btn.small}`}
          >
            Look up company details
          </button>
        </div>
      )}
    </>
  );
}
