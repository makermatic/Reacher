import * as Tooltip from '@radix-ui/react-tooltip';
import { AssistantProvider } from './ai/Assistant';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { clampPanel, CompanyPanel } from './company/CompanyPanel';
import { Header } from './components/Header';
import { ImportDialog } from './components/ImportDialog';
import { QuickUpdateBar } from './components/QuickUpdateBar';
import { ToastProvider } from './components/Toast';
import type { View } from './components/ViewSwitcher';
import { YourDetailsDialog } from './components/YourDetailsDialog';
import { readPref, writePref } from './lib/prefs';
import { hoverDelay, viewTransition } from './motion';
import { RuntimeProvider, useRuntime } from './runtime/RuntimeProvider';
import { AddColumnDialog } from './sheet/AddColumnDialog';
import { ChoicesDialog } from './sheet/ChoicesDialog';
import { SheetUIContext, type SheetUI } from './sheet/SheetUI';
import { BoardView } from './views/BoardView';
import { SheetView } from './views/SheetView';
import { WorkspaceProvider } from './workspace/WorkspaceProvider';

const isView = (v: unknown): v is View => v === 'sheet' || v === 'board';
const isNumber = (v: unknown): v is number => typeof v === 'number' && v > 0;

/** On screens with room for both, the sheet shifts left instead of hiding under the panel. */
const SHEET_MIN = 560;

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <RuntimeProvider>
        <ToastProvider>
          <WorkspaceProvider>
            <AssistantProvider>
              <Tooltip.Provider delayDuration={hoverDelay}>
                <Shell />
              </Tooltip.Provider>
            </AssistantProvider>
          </WorkspaceProvider>
        </ToastProvider>
      </RuntimeProvider>
    </MotionConfig>
  );
}

function Shell() {
  const [view, setView] = useState<View>(() => readPref('view', 'sheet', isView));
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [choicesFor, setChoicesFor] = useState<string | null>(null);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [openCompanyId, setOpenCompanyId] = useState<string | null>(null);
  const [panelWidth, setPanelWidth] = useState(() => readPref('panel-width', 640, isNumber));
  const [viewport, setViewport] = useState(() => window.innerWidth);

  useEffect(() => {
    const onResize = () => setViewport(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const closeCompany = useCallback(() => {
    setOpenCompanyId(null);
    writePref('panel-width', panelWidth);
  }, [panelWidth]);

  const ui = useMemo<SheetUI>(
    () => ({
      editChoices: setChoicesFor,
      addColumn: () => setAddColumnOpen(true),
      openCompanyId,
      toggleCompany: (id) => setOpenCompanyId((cur) => (cur === id ? null : id)),
      closeCompany,
    }),
    [openCompanyId, closeCompany],
  );

  const changeView = (v: View) => {
    setView(v);
    writePref('view', v);
  };

  // Phones: the page covers the whole screen.
  const width = viewport < 720 ? viewport : Math.min(clampPanel(panelWidth), viewport);
  const pushed = !!openCompanyId && viewport - width >= SHEET_MIN;

  return (
    <SheetUIContext.Provider value={ui}>
      <div
        className="gutter flex h-full flex-col gap-2.5 pt-3 pb-3.5 transition-[padding] duration-200 ease-out"
        style={pushed ? { paddingRight: width + 16 } : undefined}
      >
        <Header view={view} onViewChange={changeView} onOpenDetails={() => setDetailsOpen(true)} />
        <QuickUpdateBar />
        <NoAccessNotice />
        <main className="min-h-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              variants={viewTransition}
              initial="initial"
              animate="enter"
              exit="exit"
              className="h-full"
            >
              {view === 'sheet' ? (
                <SheetView onImport={() => setImportOpen(true)} />
              ) : (
                <BoardView />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
        <YourDetailsDialog
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          onImport={() => {
            setDetailsOpen(false);
            setImportOpen(true);
          }}
        />
        <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
        <AddColumnDialog open={addColumnOpen} onOpenChange={setAddColumnOpen} />
        <ChoicesDialog colId={choicesFor} onClose={() => setChoicesFor(null)} />
      </div>
      <AnimatePresence>
        {openCompanyId && (
          <CompanyPanel
            key="panel"
            companyId={openCompanyId}
            width={width}
            onResize={setPanelWidth}
            onResizeEnd={() => writePref('panel-width', clampPanel(panelWidth))}
          />
        )}
      </AnimatePresence>
    </SheetUIContext.Provider>
  );
}

/** Shown inside Claude when this viewer can't have a private space of their own. */
function NoAccessNotice() {
  const runtime = useRuntime();
  if (runtime.status !== 'ready' || runtime.kind !== 'no-access') return null;
  return (
    <p
      role="status"
      className="m-0 rounded-lg border border-line-strong bg-surface-2 px-3.5 py-2.5 text-muted"
    >
      Reacher can't save your data from this link. Ask whoever shared it to give you Contributor
      access, then reopen it.
    </p>
  );
}
