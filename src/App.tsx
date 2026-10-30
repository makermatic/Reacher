import * as Tooltip from '@radix-ui/react-tooltip';
import { MotionConfig } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { AssistantProvider } from './ai/Assistant';
import { AppUIContext, type AppUI } from './app/AppUI';
import { CompaniesPage } from './app/CompaniesPage';
import { CompanyPage } from './app/CompanyPage';
import { MyTasksPage } from './app/MyTasksPage';
import { NewsFeedPage } from './app/NewsFeedPage';
import { useRoute } from './app/route';
import { applyTheme, readTheme, SettingsPage } from './app/SettingsPage';
import { clampPanel, SidePanel } from './app/SidePanel';
import { Sidebar } from './app/Sidebar';
import { Topbar } from './app/Topbar';
import { ImportDialog } from './components/ImportDialog';
import { ToastProvider } from './components/Toast';
import { readPref, writePref } from './lib/prefs';
import { hoverDelay } from './motion';
import { RuntimeProvider, useRuntime } from './runtime/RuntimeProvider';
import { CalendarProvider } from './workspace/CalendarProvider';
import { GmailProvider } from './workspace/GmailProvider';
import { WorkspaceProvider } from './workspace/WorkspaceProvider';

const isNumber = (v: unknown): v is number => typeof v === 'number' && v > 0;

// Dark by default; light from Settings → Appearance (Zack, M7).
applyTheme(readTheme());

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <RuntimeProvider>
        <ToastProvider>
          <WorkspaceProvider>
            <CalendarProvider>
              <GmailProvider>
                <AssistantProvider>
                  <Tooltip.Provider delayDuration={hoverDelay}>
                    <Shell />
                  </Tooltip.Provider>
                </AssistantProvider>
              </GmailProvider>
            </CalendarProvider>
          </WorkspaceProvider>
        </ToastProvider>
      </RuntimeProvider>
    </MotionConfig>
  );
}

/**
 * The frame, after Kitsu (M7): top bar, the page, the side panel for the
 * selected company, and the sidebar that slides in from the mark.
 */
function Shell() {
  const [route, navigate] = useRoute();
  const [selected, select] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(() => readPref('panel-width', 520, isNumber));

  // Escape closes the side panel, unless a menu, picker or dialog is in front,
  // or you're halfway through typing something.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector('[data-radix-popper-content-wrapper], [role="dialog"]')) return;
      const t = e.target as HTMLInputElement | null;
      if ((t?.tagName === 'TEXTAREA' || t?.tagName === 'INPUT') && t.value) return;
      select(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const app = useMemo<AppUI>(
    () => ({
      route,
      navigate,
      selected,
      select,
      openSidebar: () => setSidebarOpen(true),
      openPage: (id) => navigate({ page: 'company', id, tab: 'info' }),
    }),
    [route, navigate, selected],
  );

  const resize = (w: number) => {
    setPanelWidth(w);
    writePref('panel-width', w);
  };

  return (
    <AppUIContext.Provider value={app}>
      <div className="flex h-full flex-col bg-bg text-fg">
        <Topbar />
        <NoAccessNotice />
        <div className="flex min-h-0 flex-1">
          <main className="min-h-0 min-w-0 flex-1">
            {route.page === 'companies' && <CompaniesPage onImport={() => setImportOpen(true)} />}
            {route.page === 'company' && <CompanyPage id={route.id} tab={route.tab} />}
            {route.page === 'tasks' && <MyTasksPage tab={route.tab} />}
            {route.page === 'news' && <NewsFeedPage />}
            {route.page === 'settings' && (
              <SettingsPage tab={route.tab} onImport={() => setImportOpen(true)} />
            )}
          </main>
          <SidePanel width={clampPanel(panelWidth)} onResize={resize} />
        </div>
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      </div>
    </AppUIContext.Provider>
  );
}

/** Shown inside Claude when this viewer can't have a private space of their own. */
function NoAccessNotice() {
  const runtime = useRuntime();
  if (runtime.status !== 'ready' || runtime.kind !== 'no-access') return null;
  return (
    <p role="status" className="m-0 border-b border-line bg-surface-2 px-4 py-2.5 text-muted">
      Reacher can't save your data from this link. Ask whoever shared it to give you Contributor
      access, then reopen it.
    </p>
  );
}
