/**
 * Column headers and their menus (M7), Kitsu's way: click a header to sort,
 * rename, reorder, hide or delete. Plus Add field and Display settings.
 */
import * as Dialog from '@radix-ui/react-dialog';
import {
  ArrowDownAZ,
  ArrowUpAZ,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useToast } from '../components/Toast';
import { deleteColumn, moveColumn, nameTaken, newColumn, updateColumn } from '../model/columns';
import { TYPE_LABELS, type Column, type ColumnType } from '../model/types';
import { dialogIn, fade } from '../motion';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { MenuItem, MenuSeparator, Pop, ui } from './ui';

export type Sort = { key: string; dir: 1 | -1 } | null;

/** Two clicks to delete: the first arms it. */
export function TwoClick({
  children,
  armed,
  onConfirm,
}: {
  children: ReactNode;
  armed: ReactNode;
  onConfirm: () => void;
}) {
  const [on, setOn] = useState(false);
  return (
    <button
      type="button"
      onClick={() => (on ? onConfirm() : setOn(true))}
      onBlur={() => setOn(false)}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13.5px] transition-colors ${
        on
          ? 'bg-[color-mix(in_srgb,var(--c-red)_18%,transparent)] text-[var(--c-red)]'
          : 'text-[var(--c-red)] hover:bg-hover'
      }`}
    >
      {on ? armed : children}
    </button>
  );
}

function RenameForm({
  value,
  onSave,
  taken,
}: {
  value: string;
  onSave: (v: string) => void;
  taken: (v: string) => boolean;
}) {
  const [name, setName] = useState(value);
  const bad = !name.trim() || (name.trim() !== value && taken(name));
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (!bad && name.trim() !== value) onSave(name.trim());
      }}
      className="p-1"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => !bad && name.trim() !== value && onSave(name.trim())}
        aria-label="Name"
        className={`${ui.input} h-8 w-full`}
      />
      {name.trim() && bad && (
        <span className="px-1 text-[12px] text-[var(--c-red)]">That name is taken.</span>
      )}
    </form>
  );
}

const headButton =
  'flex h-10 w-full items-center gap-1.5 px-3 text-left text-[12px] font-semibold uppercase tracking-[0.05em] text-muted transition-colors hover:text-fg';

/** A field's header: uncolored, like Kitsu's metadata columns. */
export function FieldHeader({
  col,
  sort,
  onSort,
}: {
  col: Column;
  sort: Sort;
  onSort: (s: Sort) => void;
}) {
  const { board, actions } = useWorkspace();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState(((col.options ?? []) as unknown[]).map(String).join('\n'));
  const sorted = sort?.key === col.id ? sort.dir : 0;
  const hasChoices = col.type === 'values' || col.type === 'tags';
  return (
    <Pop
      open={open}
      onOpenChange={setOpen}
      width={250}
      label={`${col.name} field`}
      trigger={
        <button type="button" className={headButton} title={TYPE_LABELS[col.type]}>
          <span className="truncate">{col.name}</span>
          {sorted !== 0 && (sorted === 1 ? <ArrowDownAZ size={13} /> : <ArrowUpAZ size={13} />)}
        </button>
      }
    >
      <RenameForm
        value={col.name}
        taken={(n) => nameTaken(board, n, col.id)}
        onSave={(name) => actions.saveBoard(updateColumn(board, col.id, { name }))}
      />
      <MenuItem onSelect={() => (onSort({ key: col.id, dir: 1 }), setOpen(false))}>
        <ArrowDownAZ size={15} /> {col.type === 'status' ? 'Sort in status order' : 'Sort A → Z'}
      </MenuItem>
      <MenuItem onSelect={() => (onSort({ key: col.id, dir: -1 }), setOpen(false))}>
        <ArrowUpAZ size={15} /> {col.type === 'status' ? 'Sort in reverse order' : 'Sort Z → A'}
      </MenuItem>
      <MenuItem onSelect={() => actions.saveBoard(moveColumn(board, col.id, -1))}>
        <ChevronLeft size={15} /> Move left
      </MenuItem>
      <MenuItem onSelect={() => actions.saveBoard(moveColumn(board, col.id, 1))}>
        <ChevronRight size={15} /> Move right
      </MenuItem>
      {!col.locked && (
        <MenuItem
          onSelect={() => {
            actions.saveBoard(updateColumn(board, col.id, { onSheet: false }));
            toast(`${col.name} is off the sheet. Star it in a company's Details to bring it back.`);
          }}
        >
          <EyeOff size={15} /> Hide from the sheet
        </MenuItem>
      )}
      {hasChoices && (
        <>
          <MenuSeparator />
          <label className="grid gap-1 px-1.5 pb-1">
            <span className={ui.label}>Choices, one per line</span>
            <textarea
              rows={4}
              value={options}
              onChange={(e) => setOptions(e.target.value)}
              onBlur={() =>
                actions.saveBoard(
                  updateColumn(board, col.id, {
                    options: options
                      .split('\n')
                      .map((x) => x.trim())
                      .filter(Boolean),
                  }),
                )
              }
              className={`${ui.input} h-auto py-1.5`}
            />
          </label>
        </>
      )}
      {!col.locked && (
        <>
          <MenuSeparator />
          <TwoClick
            armed="Click again to delete this field"
            onConfirm={() => {
              actions.saveBoard(deleteColumn(board, col.id));
              toast(`Deleted ${col.name}`);
            }}
          >
            <Trash2 size={15} /> Delete field
          </TwoClick>
        </>
      )}
    </Pop>
  );
}

/** Display settings: which fields the sheet shows (the same as starring them). */
export function DisplaySettings() {
  const { board, actions } = useWorkspace();
  const [open, setOpen] = useState(false);
  const row = (label: ReactNode, on: boolean, toggle: () => void, key: string) => (
    <label
      key={key}
      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-hover"
    >
      <input type="checkbox" checked={on} onChange={toggle} className="accent-[var(--accent)]" />
      <span className="text-[13.5px]">{label}</span>
    </label>
  );
  return (
    <Pop
      open={open}
      onOpenChange={setOpen}
      width={260}
      align="end"
      label="Display settings"
      trigger={
        <button type="button" className={ui.button}>
          <SlidersHorizontal size={15} /> Display
        </button>
      }
    >
      <div className={`${ui.label} px-2.5 pt-1 pb-1`}>Fields on the sheet</div>
      {board.columns
        .filter((c) => !c.locked)
        .map((c) =>
          row(
            c.name,
            c.onSheet !== false,
            () => actions.saveBoard(updateColumn(board, c.id, { onSheet: c.onSheet === false })),
            c.id,
          ),
        )}
    </Pop>
  );
}

const FIELD_TYPES: ColumnType[] = [
  'text',
  'longtext',
  'number',
  'checkbox',
  'date',
  'link',
  'person',
  'values',
  'tags',
  'checklist',
];

/** Add a field (Kitsu's "+" next to NAME). */
export function AddFieldDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { board, actions } = useWorkspace();
  const toast = useToast();
  const [name, setName] = useState('');
  const [type, setType] = useState<ColumnType>('text');
  const [choices, setChoices] = useState('');
  const taken = !!name.trim() && nameTaken(board, name);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || taken) return;
    const col = newColumn(
      name,
      type,
      choices
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean),
      true,
    );
    actions.saveBoard({ ...board, columns: [...board.columns, col] });
    toast(`Added ${col.name}`);
    setName('');
    setChoices('');
    onOpenChange(false);
  };
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
                className="fixed inset-0 z-40 bg-black/50"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.form
                onSubmit={submit}
                variants={dialogIn}
                initial="initial"
                animate="enter"
                exit="exit"
                className="fixed top-[12vh] left-1/2 z-50 grid w-[420px] max-w-[calc(100vw-32px)] -translate-x-1/2 gap-4 rounded-2xl border border-line bg-surface p-5 shadow-panel"
              >
                <Dialog.Title className={ui.sectionTitle}>Add a field</Dialog.Title>
                <label className="grid gap-1.5">
                  <span className={ui.label}>Name</span>
                  <input
                    id="field-name"
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Like Salary range"
                    className={ui.input}
                  />
                  {taken && (
                    <span className="text-[12px] text-[var(--c-red)]">
                      You already have a field with that name.
                    </span>
                  )}
                </label>
                <label className="grid gap-1.5">
                  <span className={ui.label}>Type</span>
                  <select
                    id="field-type"
                    value={type}
                    onChange={(e) => setType(e.target.value as ColumnType)}
                    className={ui.input}
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </label>
                {(type === 'values' || type === 'tags') && (
                  <label className="grid gap-1.5">
                    <span className={ui.label}>Choices, one per line</span>
                    <textarea
                      id="field-choices"
                      rows={4}
                      value={choices}
                      onChange={(e) => setChoices(e.target.value)}
                      className={`${ui.input} h-auto py-2`}
                    />
                  </label>
                )}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => onOpenChange(false)} className={ui.button}>
                    Cancel
                  </button>
                  <button type="submit" disabled={!name.trim() || taken} className={ui.primary}>
                    Add field
                  </button>
                </div>
              </motion.form>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
