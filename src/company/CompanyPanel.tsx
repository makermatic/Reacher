import { motion, Reorder } from 'motion/react';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { colShows, statusCol } from '../model/board';
import type { Company } from '../model/types';
import { readPref, writePref } from '../lib/prefs';
import { btn, field } from '../components/Modal';
import { duration, ease } from '../motion';
import { RowMenu } from '../sheet/RowMenu';
import { useSheetUI } from '../sheet/SheetUI';
import { StatusChip } from '../sheet/StatusChip';
import { When } from '../sheet/When';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { ChainsBody, NewChainButton } from './ChainsBody';
import { DetailsBody } from './DetailsBody';
import { ApplicationsBody, MeetingsBody, NotesBody } from './EntrySections';
import { InlineText } from './InlineText';
import { Section } from './parts';

export const MIN_PANEL = 380;
const SECTIONS = ['details', 'chains', 'notes', 'apps', 'meetings'] as const;
type SectionId = (typeof SECTIONS)[number];

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');
const isFlags = (v: unknown): v is Record<string, boolean> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/** Section order and collapsed state, remembered per device (SPEC section 6). */
function useSectionPrefs() {
  const [order, setOrder] = useState<SectionId[]>(() => {
    const saved = readPref('sections', [], isStringArray).filter((x): x is SectionId =>
      (SECTIONS as readonly string[]).includes(x),
    );
    return [...saved, ...SECTIONS.filter((s) => !saved.includes(s))];
  });
  const [collapsed, setCollapsed] = useState(() => readPref('collapsed-sections', {}, isFlags));
  return {
    order,
    reorder: (next: SectionId[]) => {
      setOrder(next);
      writePref('sections', next);
    },
    collapsed,
    toggle: (id: SectionId) => {
      const next = { ...collapsed, [id]: !collapsed[id] };
      setCollapsed(next);
      writePref('collapsed-sections', next);
    },
  };
}

/** Keeps a width between the minimum and leaving 160px of the sheet visible. */
export const clampPanel = (w: number) =>
  Math.round(Math.max(MIN_PANEL, Math.min(w, window.innerWidth - 160)));

/**
 * The company page, docked on the right like Kitsu's task panel (SPEC
 * section 6). Drag the left edge to resize; Escape or a click outside closes it.
 */
export function CompanyPanel({
  companyId,
  width,
  onResize,
  onResizeEnd,
}: {
  companyId: string;
  width: number;
  onResize: (w: number) => void;
  onResizeEnd: () => void;
}) {
  const { companies } = useWorkspace();
  const { closeCompany } = useSheetUI();
  const company = companies.find((c) => c.id === companyId);
  const ref = useRef<HTMLElement>(null);

  // The company was deleted: close.
  useEffect(() => {
    if (!company) closeCompany();
  }, [company, closeCompany]);

  // Click outside or Escape closes, unless a menu, picker or dialog is in front.
  useEffect(() => {
    const layerOpen = () =>
      !!document.querySelector('[data-radix-popper-content-wrapper], [role="dialog"]');
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t || ref.current?.contains(t)) return;
      if (
        t.closest(
          '[data-radix-popper-content-wrapper], [role="dialog"], [data-keep-panel], [aria-live]',
        )
      )
        return;
      if (layerOpen()) return;
      closeCompany();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && !layerOpen()) closeCompany();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [closeCompany]);

  const startResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    document.body.style.userSelect = 'none';
    const move = (ev: PointerEvent) => onResize(clampPanel(window.innerWidth - ev.clientX));
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      document.body.style.userSelect = '';
      onResizeEnd();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  return (
    // The wrapper only fades, so the fixed resize handle stays fixed to the screen
    // (a sliding parent would carry it along).
    <motion.div exit={{ opacity: 0, transition: { duration: duration.fast } }}>
      <div
        onPointerDown={startResize}
        data-keep-panel
        aria-hidden="true"
        title="Drag to resize"
        className="group/rz fixed top-0 bottom-0 z-30 w-2.5 cursor-col-resize touch-none max-[720px]:hidden"
        style={{ right: `calc(min(${width}px, 100%) - 5px)` }}
      >
        <span className="absolute inset-y-0 left-1 w-0.5 bg-transparent transition-colors group-hover/rz:bg-accent group-active/rz:bg-accent" />
      </div>
      <motion.aside
        ref={ref}
        aria-label="Company page"
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0, transition: { duration: duration.slow, ease: ease.out } }}
        exit={{ opacity: 0, x: 16, transition: { duration: duration.fast, ease: ease.out } }}
        style={{ width: `min(${width}px, 100%)` }}
        className="fixed top-0 right-0 bottom-0 z-20 overflow-y-auto border-l border-line bg-surface shadow-panel"
      >
        {company && <PanelContent key={company.id} company={company} />}
      </motion.aside>
    </motion.div>
  );
}

function PanelContent({ company }: { company: Company }) {
  const { board, chains, actions } = useWorkspace();
  const { closeCompany } = useSheetUI();
  const prefs = useSectionPrefs();
  const sc = statusCol(board);
  const dependents = board.columns.filter(
    (c) => c.type === 'status' && c.id !== 'status' && c.showWhen,
  );
  const page = actions.pageOf(company.id);
  const companyChains = chains.filter((ch) => ch.companyId === company.id);

  // The latest chain starts open, like the prototype.
  const [openChains, setOpenChains] = useState<Record<string, boolean>>(() => {
    const latest = [...companyChains].sort((a, b) => (a.started < b.started ? 1 : -1))[0];
    return latest ? { [latest.id]: true } : {};
  });
  const setChainOpen = (id: string, open: boolean) => setOpenChains((o) => ({ ...o, [id]: open }));

  const sections: Record<
    SectionId,
    { title: string; count?: number; action?: React.ReactNode; body: React.ReactNode }
  > = {
    details: {
      title: 'Details',
      body: <DetailsBody company={company} />,
      action: <AddPropertyButton />,
    },
    chains: {
      title: 'Email chains',
      count: companyChains.length,
      action: <NewChainButton company={company} onCreated={(id) => setChainOpen(id, true)} />,
      body: <ChainsBody company={company} open={openChains} setOpen={setChainOpen} />,
    },
    notes: { title: 'Notes', count: page.notes.length, body: <NotesBody company={company} /> },
    apps: {
      title: 'Applications',
      count: page.applications.length,
      body: <ApplicationsBody company={company} />,
    },
    meetings: {
      title: 'Meetings & interviews',
      count: page.meetings.length,
      body: <MeetingsBody company={company} />,
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: duration.base, ease: ease.out } }}
      className="grid gap-4 px-5 pt-4 pb-10"
      style={{ paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))' }}
    >
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="eyebrow text-[10.5px] font-semibold text-muted">Company</div>
          <InlineText
            value={company.name}
            label="Rename company"
            onSave={(name) => actions.renameCompany(company.id, name)}
            className="m-0 text-left font-display text-[26px] leading-tight font-bold [text-wrap:balance] decoration-line-strong underline-offset-4 hover:underline"
            inputClassName="font-display text-xl font-bold"
          />
        </div>
        <RowMenu company={company} alwaysVisible />
        <button
          type="button"
          onClick={closeCompany}
          aria-label="Close company page"
          className={`${btn.icon} text-xl`}
        >
          ×
        </button>
      </header>

      <div className="flex flex-wrap items-end gap-3.5">
        <div className="grid gap-1">
          <span className="eyebrow text-[10.5px] font-semibold text-muted">{sc.name}</span>
          <StatusChip company={company} col={sc} />
        </div>
        {dependents
          .filter((col) => colShows(col, company))
          .map((col) => (
            <div key={col.id} className="grid gap-1">
              <span className="eyebrow text-[10.5px] font-semibold text-muted">{col.name}</span>
              <StatusChip company={company} col={col} />
            </div>
          ))}
        <div className="grid gap-1">
          <label htmlFor="follow-up" className="eyebrow text-[10.5px] font-semibold text-muted">
            Follow up on
          </label>
          <div className="flex items-center gap-2">
            <input
              id="follow-up"
              type="date"
              value={company.due ?? ''}
              onChange={(e) => actions.setDue(company.id, e.target.value || null)}
              className={`${field} w-auto py-1`}
            />
            {company.due && (
              <>
                <button
                  type="button"
                  onClick={() => actions.setDue(company.id, null)}
                  className={`${btn.ghost} ${btn.small}`}
                >
                  Clear
                </button>
                <When company={company} page={undefined} />
              </>
            )}
          </div>
        </div>
      </div>

      <Reorder.Group
        axis="y"
        values={prefs.order}
        onReorder={prefs.reorder}
        className="m-0 grid list-none gap-5 p-0"
      >
        {prefs.order.map((id) => (
          <Section
            key={id}
            id={id}
            title={sections[id].title}
            count={sections[id].count}
            action={sections[id].action}
            collapsed={!!prefs.collapsed[id]}
            onToggle={() => prefs.toggle(id)}
          >
            {sections[id].body}
          </Section>
        ))}
      </Reorder.Group>
    </motion.div>
  );
}

function AddPropertyButton() {
  const { addColumn } = useSheetUI();
  return (
    <button type="button" onClick={addColumn} className={`${btn.ghost} ${btn.small}`}>
      + Property
    </button>
  );
}
