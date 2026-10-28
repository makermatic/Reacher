/** Dates are stored as local "YYYY-MM-DD" strings, times as 24-hour "HH:MM". */

const pad = (n: number) => String(n).padStart(2, '0');
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
};

export const isISODate = (d: unknown): d is string =>
  typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

export const todayISO = (now = new Date()) => toISO(now);

export const addDays = (iso: string, n: number) => {
  const d = parse(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

/** Whole days from today until `iso`: 0 today, negative when past. */
export function daysUntil(iso: string, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((parse(iso).getTime() - today.getTime()) / 864e5);
}

/** "Nov 6" (with the year when it isn't this year), or "November 6, 2026" when long. */
export function fmtDate(iso: string, long = false, now = new Date()) {
  if (!isISODate(iso)) return iso || '';
  const d = parse(iso);
  const opts: Intl.DateTimeFormatOptions = long
    ? { month: 'long', day: 'numeric', year: 'numeric' }
    : { month: 'short', day: 'numeric' };
  if (!long && d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(undefined, opts);
}

/** "11/6" */
export const monthDay = (iso: string) => {
  const d = parse(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

/** "13:30" → "1:30 pm" */
export function fmtTime(hhmm: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const h = Number(m[1]);
  const suffix = h >= 12 ? 'pm' : 'am';
  return `${h % 12 || 12}:${m[2]} ${suffix}`;
}
