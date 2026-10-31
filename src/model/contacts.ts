/**
 * Who a company is, by address: the web and email domains and contact
 * addresses that identify it. Calendar and Gmail use this to tell which
 * events and emails are about which company.
 */
import { asPerson, meta } from './board';
import type { Board, Company } from './types';

/** Personal mail providers: an address there says nothing about the company. */
export const SHARED_MAIL =
  /^(gmail|googlemail|yahoo|hotmail|outlook|live|icloud|me|mac|aol|proton|protonmail|pm)\./;

/** The domain of an email address, lowercased ('' if none). */
export const domainOf = (email: string) => email.split('@')[1]?.trim().toLowerCase() ?? '';

/** Its website's domain and its contacts' email domains (personal providers skipped). */
export function companyDomains(board: Board, c: Company): string[] {
  const out = new Set<string>();
  for (const col of board.columns) {
    const v = meta(c, col.id);
    if (col.type === 'link' && typeof v === 'string') {
      const host = v
        .replace(/^https?:\/\//, '')
        .split('/')[0]!
        .replace(/^www\./, '')
        .toLowerCase();
      if (host.includes('.')) out.add(host);
    }
    if (col.type === 'person') {
      const d = domainOf(asPerson(v)?.email ?? '');
      if (d && !SHARED_MAIL.test(d)) out.add(d);
    }
  }
  return [...out];
}

/** Its contacts' email addresses, lowercased. */
export function companyEmails(board: Board, c: Company): string[] {
  return board.columns
    .filter((col) => col.type === 'person')
    .map((col) => asPerson(meta(c, col.id))?.email.trim().toLowerCase() ?? '')
    .filter((e) => e.includes('@'));
}

/** Is this address from one of these domains (or a subdomain of one)? */
export const inDomains = (email: string, domains: string[]) => {
  const d = domainOf(email);
  return !!d && domains.some((x) => d === x || d.endsWith(`.${x}`));
};
