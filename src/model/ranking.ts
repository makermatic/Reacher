import type { Company } from './types';

/**
 * Board card order within a lane (Zack, round 2: Trello-style). A card's
 * position is a number; dropping between two cards gives it one halfway
 * between theirs, so nothing else has to be renumbered. Cards never moved on
 * the Board fall back to the order they were added.
 */
export const rankOf = (c: Pick<Company, 'rank' | 'order'>) => c.rank ?? c.order ?? 0;

export function rankBetween(prev: number | undefined, next: number | undefined): number {
  if (prev === undefined && next === undefined) return Date.now();
  if (prev === undefined) return next! - 1024;
  if (next === undefined) return prev + 1024;
  return (prev + next) / 2;
}

/** Cards in lane order. */
export const byRank = <T extends Pick<Company, 'rank' | 'order'>>(list: T[]) =>
  [...list].sort((a, b) => rankOf(a) - rankOf(b));
