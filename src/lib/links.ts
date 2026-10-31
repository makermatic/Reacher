/**
 * Turn what someone typed into a link that opens: "zackzand.com" becomes
 * "https://zackzand.com". Leaves full links ("http://...", "mailto:...")
 * alone, and leaves blank blank.
 */
export function normalizeUrl(input: string): string {
  const text = input.trim();
  if (!text) return '';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text) || /^(mailto|tel):/i.test(text)) return text;
  if (text.startsWith('//')) return `https:${text}`;
  return `https://${text}`;
}
