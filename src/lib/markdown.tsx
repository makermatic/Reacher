/**
 * A small Markdown reader for comments (Zack, M7 round 2): **bold**,
 * *italic*, ~~strike~~, `code`, [links](https://…), bare links, lists
 * (- or 1.), > quotes and # headings. It builds React elements, never HTML
 * strings, so typed text can't inject anything.
 */
import { Fragment, type ReactNode } from 'react';
import { normalizeUrl } from './links';

type Block =
  | { kind: 'p'; lines: string[] }
  | { kind: 'ul' | 'ol'; items: string[] }
  | { kind: 'quote'; lines: string[] }
  | { kind: 'h'; text: string };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBER = /^\s*\d+[.)]\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;

/** Lines into blocks: a blank line ends a paragraph; list and quote lines group. */
export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const last = blocks.at(-1);
    let m: RegExpMatchArray | null;
    if (!line.trim()) {
      blocks.push({ kind: 'p', lines: [] });
    } else if ((m = line.match(HEADING))) {
      blocks.push({ kind: 'h', text: m[1]! });
    } else if ((m = line.match(BULLET))) {
      if (last?.kind === 'ul') last.items.push(m[1]!);
      else blocks.push({ kind: 'ul', items: [m[1]!] });
    } else if ((m = line.match(NUMBER))) {
      if (last?.kind === 'ol') last.items.push(m[1]!);
      else blocks.push({ kind: 'ol', items: [m[1]!] });
    } else if ((m = line.match(QUOTE))) {
      if (last?.kind === 'quote') last.lines.push(m[1]!);
      else blocks.push({ kind: 'quote', lines: [m[1]!] });
    } else if (last?.kind === 'p') {
      last.lines.push(line);
    } else {
      blocks.push({ kind: 'p', lines: [line] });
    }
  }
  return blocks.filter((b) => b.kind !== 'p' || b.lines.length);
}

// Order matters: code first (nothing inside it is read), then links, then emphasis.
const INLINE =
  /(`[^`\n]+`)|\[([^\]\n]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])|(\*\*[^*\n]+\*\*|__[^_\n]+__)|(~~[^~\n]+~~)|(\*[^*\n]+\*|(?<![\w])_[^_\n]+_(?![\w]))/g;

/** One line's inline marks as React nodes. */
export function inline(text: string, key = 'i'): ReactNode[] {
  const out: ReactNode[] = [];
  let at = 0;
  let n = 0;
  for (const m of text.matchAll(INLINE)) {
    const i = m.index ?? 0;
    if (i > at) out.push(text.slice(at, i));
    const k = `${key}-${n++}`;
    const [whole, code, label, href, bare, bold, strike, em] = m;
    if (code) out.push(<code key={k}>{code.slice(1, -1)}</code>);
    else if (label && href)
      out.push(
        <SafeLink key={k} href={href}>
          {inline(label, k)}
        </SafeLink>,
      );
    else if (bare)
      out.push(
        <SafeLink key={k} href={bare}>
          {bare}
        </SafeLink>,
      );
    else if (bold) out.push(<strong key={k}>{inline(bold.slice(2, -2), k)}</strong>);
    else if (strike) out.push(<s key={k}>{inline(strike.slice(2, -2), k)}</s>);
    else if (em) out.push(<em key={k}>{inline(em.slice(1, -1), k)}</em>);
    else out.push(whole);
    at = i + whole.length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

function SafeLink({ href, children }: { href: string; children: ReactNode }) {
  const url = normalizeUrl(href);
  // Only web links; anything else (javascript:, data:...) stays plain text.
  if (!/^https?:\/\//i.test(url)) return <>{children}</>;
  return (
    <a href={url} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  );
}

const lines = (list: string[], key: string) =>
  list.map((l, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {inline(l, `${key}-${i}`)}
    </Fragment>
  ));

/** Markdown text as elements, styled by the `.md` rules in index.css. */
export function Markdown({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={`md ${className}`}>
      {parseBlocks(text).map((b, i) => {
        const k = `b${i}`;
        switch (b.kind) {
          case 'h':
            return (
              <p key={k} className="md-h">
                {inline(b.text, k)}
              </p>
            );
          case 'ul':
            return (
              <ul key={k}>
                {b.items.map((t, j) => (
                  <li key={j}>{inline(t, `${k}-${j}`)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={k}>
                {b.items.map((t, j) => (
                  <li key={j}>{inline(t, `${k}-${j}`)}</li>
                ))}
              </ol>
            );
          case 'quote':
            return <blockquote key={k}>{lines(b.lines, k)}</blockquote>;
          default:
            return <p key={k}>{lines(b.lines, k)}</p>;
        }
      })}
    </div>
  );
}
