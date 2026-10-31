/**
 * When something last happened with a company or a person (after M11), for
 * "Recently active" sorting: their feed (notes, status changes, emails,
 * meetings...) and the newest email in their chains. A company counts its
 * people's activity too. ISO strings compare in time order; '' = never.
 */
import { chainsOf } from './people';
import type { Chain, Contact, Page } from './types';

const latestEvent = (page: Page | undefined) =>
  (page?.events ?? []).reduce((a, e) => (e.at > a ? e.at : a), '');

const latestMessage = (chains: Chain[]) =>
  chains.flatMap((ch) => ch.messages.map((m) => m.date)).reduce((a, d) => (d > a ? d : a), '');

const max = (...xs: string[]) => xs.reduce((a, b) => (b > a ? b : a), '');

export function companyActivity(
  companyId: string,
  pages: Record<string, Page>,
  chains: Chain[],
  people: Contact[],
): string {
  return max(
    latestEvent(pages[companyId]),
    latestMessage(chains.filter((ch) => ch.companyId === companyId)),
    ...people.filter((p) => p.companyId === companyId).map((p) => latestEvent(pages[p.id])),
  );
}

export const personActivity = (p: Contact, pages: Record<string, Page>, chains: Chain[]) =>
  max(latestEvent(pages[p.id]), latestMessage(chainsOf(p, chains)));
