import {
  Building2,
  CheckSquare,
  Layers,
  Mail,
  Radio,
  Settings,
  Sparkles,
  Tags,
  UserRound,
  Users,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, type ReactNode } from 'react';
import { duration, ease, fade } from '../motion';
import { useAppUI } from './AppUI';
import type { Route } from './route';
import { BrandMark } from './Topbar';

/**
 * Kitsu's sidebar (M7): slides in over the page from the mark, closes on a
 * pick, a click outside or Escape. Workspace pages first, then settings.
 */
export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { navigate, route } = useAppUI();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  const go = (r: Route) => {
    onClose();
    navigate(r);
  };
  const item = (r: Route, icon: ReactNode, label: string, current: boolean) => (
    <button
      type="button"
      onClick={() => go(r)}
      aria-current={current ? 'page' : undefined}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-[17px] text-fg transition-colors hover:bg-hover aria-[current=page]:text-accent-text"
    >
      <span className="text-muted" aria-hidden="true">
        {icon}
      </span>
      {label}
    </button>
  );
  const group = 'mt-5 mb-1.5 px-2 text-[12px] font-bold uppercase tracking-[0.08em] text-muted';

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            variants={fade}
            initial="initial"
            animate="enter"
            exit="exit"
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/30"
          />
          <motion.nav
            key="sidebar"
            aria-label="Menu"
            initial={{ x: -260 }}
            animate={{ x: 0, transition: { duration: duration.slow, ease: ease.out } }}
            exit={{ x: -260, transition: { duration: duration.base, ease: ease.out } }}
            className="fixed inset-y-0 left-0 z-50 w-[240px] overflow-y-auto bg-sidebar px-3 pt-5 pb-6 shadow-panel"
          >
            <button
              type="button"
              onClick={() => go({ page: 'companies' })}
              className="mb-2 flex flex-col items-center gap-2 self-center px-2 py-2"
              aria-label="Reacher home"
            >
              <BrandMark size={64} />
              <span className="text-[22px] font-black tracking-[0.18em] text-strong">REACHER</span>
            </button>
            <div className={group}>Workspace</div>
            {item(
              { page: 'tasks', tab: 'list' },
              <CheckSquare size={20} />,
              'My Tasks',
              route.page === 'tasks',
            )}
            {item({ page: 'news' }, <Radio size={20} />, 'News Feed', route.page === 'news')}
            {item(
              { page: 'companies' },
              <Building2 size={20} />,
              'Companies',
              route.page === 'companies' || route.page === 'company',
            )}
            {item({ page: 'people' }, <Users size={20} />, 'People', route.page === 'people')}
            <div className={group}>Customize</div>
            {item(
              { page: 'statuses' },
              <Tags size={20} />,
              'Status types',
              route.page === 'statuses',
            )}
            {item(
              { page: 'templates' },
              <Mail size={20} />,
              'Email templates',
              route.page === 'templates',
            )}
            {item({ page: 'sprints' }, <Layers size={20} />, 'Sprints', route.page === 'sprints')}
            <div className={group}>Settings</div>
            {item(
              { page: 'settings', tab: 'details' },
              <UserRound size={20} />,
              'Your details',
              route.page === 'settings' && route.tab === 'details',
            )}
            {item(
              { page: 'settings', tab: 'ai' },
              <Sparkles size={20} />,
              'AI check',
              route.page === 'settings' && route.tab === 'ai',
            )}
            {item(
              { page: 'settings', tab: 'appearance' },
              <Settings size={20} />,
              'Settings',
              route.page === 'settings' && !['details', 'ai'].includes(route.tab),
            )}
          </motion.nav>
        </>
      )}
    </AnimatePresence>
  );
}
