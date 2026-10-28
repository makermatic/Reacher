import * as Tooltip from '@radix-ui/react-tooltip';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useState } from 'react';
import { Header } from './components/Header';
import { ImportDialog } from './components/ImportDialog';
import { QuickUpdateBar } from './components/QuickUpdateBar';
import { ToastProvider } from './components/Toast';
import type { View } from './components/ViewSwitcher';
import { YourDetailsDialog } from './components/YourDetailsDialog';
import { readPref, writePref } from './lib/prefs';
import { hoverDelay, viewTransition } from './motion';
import { RuntimeProvider, useRuntime } from './runtime/RuntimeProvider';
import { BoardView } from './views/BoardView';
import { SheetView } from './views/SheetView';
import { WorkspaceProvider } from './workspace/WorkspaceProvider';

const isView = (v: unknown): v is View => v === 'sheet' || v === 'board';

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <RuntimeProvider>
        <ToastProvider>
          <WorkspaceProvider>
            <Tooltip.Provider delayDuration={hoverDelay}>
              <Shell />
            </Tooltip.Provider>
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

  const changeView = (v: View) => {
    setView(v);
    writePref('view', v);
  };

  return (
    <div className="gutter flex h-full flex-col gap-2.5 pt-3 pb-3.5">
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
            {view === 'sheet' ? <SheetView onImport={() => setImportOpen(true)} /> : <BoardView />}
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
    </div>
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
