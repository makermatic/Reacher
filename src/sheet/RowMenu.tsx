import { useState, type FormEvent } from 'react';
import type { Company } from '../model/types';
import { useArm } from '../lib/useArm';
import { btn, field } from '../components/Modal';
import { Popover, PopoverHeader } from '../components/Popover';
import { useToast } from '../components/Toast';
import { useWorkspace } from '../workspace/WorkspaceProvider';

/** The ⋯ menu at the end of a company's name cell. */
export function RowMenu({ company }: { company: Company }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      width={260}
      label={`${company.name} options`}
      trigger={
        <button
          type="button"
          aria-label={`Options for ${company.name}`}
          className={`${btn.icon} opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100`}
        >
          ⋯
        </button>
      }
    >
      <RowMenuBody company={company} onDone={() => setOpen(false)} />
    </Popover>
  );
}

function RowMenuBody({ company, onDone }: { company: Company; onDone: () => void }) {
  const { actions } = useWorkspace();
  const toast = useToast();
  const [name, setName] = useState(company.name);
  const [armed, del] = useArm(() => {
    onDone();
    void actions.deleteCompany(company.id);
    toast(`Deleted ${company.name}`);
  });
  const rename = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim() && name.trim() !== company.name) {
      actions.renameCompany(company.id, name);
      toast('Renamed');
    }
    onDone();
  };
  return (
    <>
      <PopoverHeader title={company.name} />
      <form onSubmit={rename} className="flex gap-1.5">
        <input
          id="row-rename"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Company name"
          className={`${field} min-w-0 flex-1`}
        />
        <button type="submit" className={`${btn.base} ${btn.small}`}>
          Rename
        </button>
      </form>
      <div>
        <button type="button" className={`${btn.base} ${btn.small} ${btn.danger}`} onClick={del}>
          {armed ? 'Click again to delete' : 'Delete company'}
        </button>
      </div>
      <p className="m-0 text-xs text-muted">Deleting also removes its emails and notes.</p>
    </>
  );
}
