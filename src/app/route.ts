import { useCallback, useEffect, useState } from 'react';

/**
 * Pages, kept in the address (#/companies, #/company/<id>/emails...) so a
 * reload or the back button lands where you were, like Kitsu's routes.
 */
export type Route =
  | { page: 'companies' }
  /** People (M11): the second list, like Kitsu's assets next to shots. */
  | { page: 'people' }
  /** Every job application, across companies (Zack, round 5). */
  | { page: 'applications' }
  | { page: 'company'; id: string; tab: CompanyTab }
  | { page: 'tasks'; tab: TasksTab }
  | { page: 'news' }
  /** Statuses, Email templates and Sprints have their own pages (Zack, M7 round 2). */
  | { page: 'statuses' }
  | { page: 'templates' }
  | { page: 'sprints' }
  | { page: 'settings'; tab: SettingsTab };

export const COMPANY_TABS = ['info', 'emails', 'meetings', 'applications'] as const;
export type CompanyTab = (typeof COMPANY_TABS)[number];
export const TASKS_TABS = ['list', 'board', 'calendar'] as const;
export type TasksTab = (typeof TASKS_TABS)[number];
export const SETTINGS_TABS = ['details', 'appearance', 'connections', 'data', 'ai'] as const;
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
    case 'people':
    case 'applications':
    case 'statuses':
    case 'templates':
    case 'sprints':
      return { page };
    case 'settings':
      // Old links to the tabs that became pages still land on them.
      if (a === 'statuses' || a === 'templates' || a === 'sprints') return { page: a };
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
    case 'people':
    case 'applications':
    case 'statuses':
    case 'templates':
    case 'sprints':
      return `#/${r.page}`;
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
