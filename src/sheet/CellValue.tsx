import { asChecklist, asPerson, asTags, colorFor, optionLabel, optionOf } from '../model/board';
import { fmtDate } from '../model/dates';
import type { Column } from '../model/types';

const Empty = () => <span className="text-faint">—</span>;

const hostOf = (url: string) => {
  try {
    return new URL(/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(
      /^www\./,
      '',
    );
  } catch {
    return url;
  }
};

/** How a column's value reads in a sheet cell (SPEC section 2's 11 types). */
export function CellValue({ col, value }: { col: Column; value: unknown }) {
  switch (col.type) {
    case 'status': {
      const o = optionOf(col, value);
      return o ? <span className={`tag c-${o.color || 'grey'}`}>{optionLabel(o)}</span> : <Empty />;
    }
    case 'checkbox':
      return (
        <span className={`cb ${value ? 'on' : ''}`} aria-label={value ? 'Yes' : 'No'}>
          {!!value && (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path
                d="M1.5 5.2 4 7.6 8.6 2.4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
          )}
        </span>
      );
    case 'date':
      return value ? (
        <span className="font-mono text-[12.5px]">{fmtDate(String(value))}</span>
      ) : (
        <Empty />
      );
    case 'link':
      return value ? (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
        >
          {hostOf(String(value))}
        </a>
      ) : (
        <Empty />
      );
    case 'person': {
      const p = asPerson(value);
      if (!p || !(p.name || p.email)) return <Empty />;
      return (
        <span className="inline-flex flex-col leading-tight">
          <span>{p.name || p.email}</span>
          {p.role && <small className="text-[11.5px] text-muted">{p.role}</small>}
        </span>
      );
    }
    case 'values':
      return value ? (
        <span className={`tag c-${colorFor(col, String(value))}`}>{String(value)}</span>
      ) : (
        <Empty />
      );
    case 'tags': {
      const tags = asTags(value);
      return tags.length ? (
        <>
          {tags.map((t) => (
            <span key={t} className={`tag c-${colorFor(col, t)}`}>
              {t}
            </span>
          ))}
        </>
      ) : (
        <Empty />
      );
    }
    case 'checklist': {
      const items = asChecklist(value);
      if (!items.length) return <Empty />;
      const done = items.filter((i) => i.done).length;
      return (
        <span className="inline-flex items-center gap-1.5 font-mono text-xs">
          <span className="h-1 w-11 overflow-hidden rounded-sm bg-line">
            <span
              className="block h-full bg-accent transition-[width] duration-300"
              style={{ width: `${Math.round((done / items.length) * 100)}%` }}
            />
          </span>
          {done}/{items.length}
        </span>
      );
    }
    case 'longtext':
      return value ? <>{String(value).split('\n')[0]}</> : <Empty />;
    case 'number':
      return value != null && value !== '' ? (
        <span className="font-mono text-[12.5px] tabular-nums">{String(value)}</span>
      ) : (
        <Empty />
      );
    default:
      return value != null && value !== '' ? <>{String(value)}</> : <Empty />;
  }
}
