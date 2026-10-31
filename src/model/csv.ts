/**
 * Reads CSV text (a file, or a paste from a spreadsheet) into rows of cells.
 * Handles quoted cells with commas, quotes ("") and line breaks inside, and
 * finds the separator on its own: comma, tab (spreadsheet paste) or semicolon.
 */
export function detectSeparator(text: string): string {
  const firstLine = text.split(/\r\n|\r|\n/).find((l) => l.trim()) ?? '';
  const outside = firstLine.replace(/"[^"]*"/g, '');
  const count = (ch: string) => outside.split(ch).length - 1;
  const best = [',', '\t', ';']
    .map((ch) => [ch, count(ch)] as const)
    .sort((a, b) => b[1] - a[1])[0]!;
  return best[1] > 0 ? best[0] : ',';
}

export function parseCsv(text: string, sep = detectSeparator(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell.trim() === '') {
      quoted = true;
      cell = '';
    } else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  // Trim cells and drop blank lines.
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''));
}
