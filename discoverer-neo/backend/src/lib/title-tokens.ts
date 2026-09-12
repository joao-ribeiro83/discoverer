/**
 * Worksheet title tokens (`&Date`, `&Time`, `&<ParamName>`) substitute at
 * render time, not migration time — the values are per-execution, and
 * `&Date`/`&Time` are meaningless until there is a "now" to print. See
 * AUDIT_LEGACY_COMPATIBILITY_MATRIX.md §C: the live UI showed
 * `&Date (&Time) &Dt Início &Dt Fim` literally because nothing ever replaced
 * them; `map_layouts.title`/`.title_rtf`/`.title_html` migrate the source text
 * verbatim, tokens included.
 *
 * A parameter name is free text — spaces, accents, punctuation — with no
 * delimiter marking where the token ends (`&Dt Fim Vigência >=`), so the
 * token can't be found with a fixed `\w+` pattern. It only resolves against
 * the map's own parameter names, longest first so `&Dt Fim Vigência` doesn't
 * short-match before `&Dt Fim Vigência >=`.
 */

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace `&Date`, `&Time` and `&<paramName>` tokens in a worksheet title.
 *
 * An unrecognized `&Something` is left exactly as written — Discoverer itself
 * never substituted a token it didn't know either. `paramValues` keys are
 * matched case-insensitively against the token text; pass each parameter's
 * current or default value.
 */
export function substituteTitleTokens<T extends string | null>(
  text: T,
  paramValues: ReadonlyMap<string, string>,
  now: Date = new Date(),
): T {
  if (text === null || text === '') return text;

  const byLowerName = new Map<string, string>();
  for (const [name, value] of paramValues) {
    byLowerName.set(name.trim().toLowerCase(), value);
  }
  byLowerName.set('date', now.toLocaleDateString());
  byLowerName.set('time', now.toLocaleTimeString());

  const names = [...byLowerName.keys()]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);
  const pattern = new RegExp(`&(${names.join('|')})\\b`, 'gi');

  return text.replace(pattern, (match, name: string) => byLowerName.get(name.toLowerCase()) ?? match) as T;
}
