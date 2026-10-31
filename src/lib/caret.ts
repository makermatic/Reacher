/** Mirrored styles that affect where text wraps. */
const COPY = [
  'boxSizing',
  'width',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'letterSpacing',
  'lineHeight',
  'textTransform',
  'wordSpacing',
  'tabSize',
] as const;

/**
 * Where a character sits on screen inside an input or textarea (viewport
 * coordinates of its top-left, plus the line height). Uses a hidden copy of
 * the field with the same text and styles.
 */
export function caretRect(
  el: HTMLInputElement | HTMLTextAreaElement,
  pos: number,
): { left: number; top: number; height: number } {
  const cs = getComputedStyle(el);
  const div = document.createElement('div');
  const s = div.style;
  for (const k of COPY) s[k] = cs[k];
  s.position = 'absolute';
  s.visibility = 'hidden';
  s.top = '0';
  s.left = '-9999px';
  s.overflow = 'hidden';
  s.whiteSpace = el instanceof HTMLTextAreaElement ? 'pre-wrap' : 'pre';
  s.overflowWrap = 'break-word';
  div.textContent = el.value.slice(0, pos);
  const mark = document.createElement('span');
  mark.textContent = el.value.slice(pos) || '.';
  div.appendChild(mark);
  document.body.appendChild(div);
  const r = el.getBoundingClientRect();
  const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
  const out = {
    left: r.left + mark.offsetLeft - el.scrollLeft,
    top: r.top + mark.offsetTop - el.scrollTop,
    height: lineHeight,
  };
  div.remove();
  return out;
}
