import { useCallback, useEffect, useState } from 'react';

/**
 * Pages, kept in the address (#/companies, #/company/<id>/emails...) so a
 * reload or the back button lands where you were, like Kitsu's routes.
 */
export type Route =
  | { page: 'companies' }
  | { page: 'company'; id: string; tab: CompanyTab }
  | { page: 'tasks'; tab: TasksTab }
  | { page: 'news' }
  | { page: 'settings'; tab: SettingsTab };

export const COMPANY_TABS = ['info', 'emails', 'meetings', 'applications'] as const;
export type CompanyTab = (typeof COMPANY_TABS)[number];
export const TASKS_TABS = ['list', 'board', 'calendar'] as const;
export type TasksTab = (typeof TASKS_TABS)[number];
export const SETTINGS_TABS = [
  'details',
  'statuses',
  'templates',
  'sprints',
  'appearance',
  'connections',
  'data',
  'ai',
] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

const oneOf = <T extends string>(list: readonly T[], v: string | undefined, fallback: T): T =>
  list.includes(v as T) ? (v as T) : fallback;

export function parseRoute(hash: string): Route {
  const [page, a, b] = hash.replace(/^#\/?/, '').split('/');
  switch (page) {
    case 'company':
      return a
        ? { page: 'company', id: decodeURIComponent(a), tab: oneOf(COMPANY_TABS, b, 'info') }
        : { page: 'companies' };
    case 'tasks':
      return { page: 'tasks', tab: oneOf(TASKS_TABS, a, 'list') };
    case 'news':
      return { page: 'news' };
    case 'settings':
      return { page: 'settings', tab: oneOf(SETTINGS_TABS, a, 'details') };
    default:
      return { page: 'companies' };
  }
}

export function formatRoute(r: Route): string {
  switch (r.page) {
    case 'company':
      return `#/company/${encodeURIComponent(r.id)}/${r.tab}`;
    case 'tasks':
      return `#/tasks/${r.tab}`;
    case 'news':
      return '#/news';
    case 'settings':
      return `#/settings/${r.tab}`;
    default:
      return '#/companies';
  }
}

export function useRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onHash = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const navigate = useCallback((r: Route) => {
    const hash = formatRoute(r);
    if (window.location.hash !== hash) window.location.hash = hash;
    setRoute(r);
  }, []);
  return [route, navigate];
}
