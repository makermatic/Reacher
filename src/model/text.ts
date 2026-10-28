/** Lowercase letters and digits only: how names are compared ("Big Star" = "bigstar"). */
export const norm = (s: unknown) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/** A template-field name from a column name: "Role I want" → "role_i_want". */
export const slug = (s: unknown) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

/** A short unique id with a readable prefix, like the prototype's ("co-k3j9x2ab1c"). */
export const uid = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

export const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
