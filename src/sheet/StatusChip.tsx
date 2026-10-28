import { useState } from 'react';
import { optionLabel, optionOf } from '../model/board';
import type { Column, Company } from '../model/types';
import { Popover } from '../components/Popover';
import { useToast } from '../components/Toast';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { OptionPicker } from './OptionPicker';

/** A company's chip for one status column; click to pick a new status. */
export function StatusChip({ company, col }: { company: Company; col: Column }) {
  const { board, actions } = useWorkspace();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const value = company.meta?.[col.id];
  const o = optionOf(col, value);

  const pick = (id: string) => {
    setOpen(false);
    actions.setMeta(company.id, col.id, id);
    // Picking Meeting or Interview unlocks Outcome; say so once.
    if (col.id === 'status') {
      const outcome = board.columns.find((c) => c.showWhen?.col === 'status');
      if (outcome?.showWhen?.values.includes(id) && company.meta?.[outcome.id] == null) {
        const label = optionOf(col, id)?.label ?? id;
        toast(`${label}: you can now set ${outcome.name}`);
      }
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label={`${col.name} for ${company.name}`}
      trigger={
        <button
          type="button"
          className={o ? `schip c-${o.color || 'grey'}` : 'schip empty'}
          aria-label={`${col.name}: ${o ? o.label : 'none'}. Change`}
        >
          {o ? optionLabel(o) : col.id === 'status' ? 'No status' : 'Set'}
        </button>
      }
    >
      <OptionPicker
        col={col}
        current={value}
        onPick={pick}
        onClear={() => {
          setOpen(false);
          actions.setMeta(company.id, col.id, null);
        }}
      />
    </Popover>
  );
}
