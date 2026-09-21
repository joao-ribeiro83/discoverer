/**
 * The handful of labels an export needs, in the app's four locales.
 *
 * Mirrors `mapViewer:resultsTable.grandTotal` / `subtotalFor` in
 * `frontend/src/locales/*\/mapViewer.json`. Copied rather than loaded at
 * runtime: the export worker has no i18next runtime of its own, and a
 * backend production image does not necessarily carry frontend source to
 * read the JSON from.
 *
 * ponytail: 8 short strings, hand-kept in sync with the frontend locale
 * files. Promote to a shared source if this ever drifts.
 */

export type ExportLocale = 'en' | 'es-ES' | 'fr-FR' | 'pt-PT';

const SUPPORTED: readonly ExportLocale[] = ['en', 'es-ES', 'fr-FR', 'pt-PT'];

const LABELS: Record<
  ExportLocale,
  { grandTotal: string; subtotalFor: string; parameters: string; runAt: string }
> = {
  en: { grandTotal: 'Grand total', subtotalFor: 'Total for {{value}}', parameters: 'Parameters', runAt: 'Run at' },
  'es-ES': { grandTotal: 'Total general', subtotalFor: 'Total de {{value}}', parameters: 'Parámetros', runAt: 'Ejecutado el' },
  'fr-FR': { grandTotal: 'Total général', subtotalFor: 'Total pour {{value}}', parameters: 'Paramètres', runAt: 'Exécuté le' },
  'pt-PT': { grandTotal: 'Total geral', subtotalFor: 'Total de {{value}}', parameters: 'Parâmetros', runAt: 'Executado em' },
};

export interface TotalLabels {
  grandTotal: string;
  subtotalFor(value: string): string;
  /** Heading of the parameter list in an export's document header. */
  parameters: string;
  /** Label before the run timestamp in an export's document header. */
  runAt: string;
}

export function totalLabelsFor(locale?: string | null): TotalLabels {
  const key = SUPPORTED.includes(locale as ExportLocale) ? (locale as ExportLocale) : 'en';
  const entry = LABELS[key];
  return {
    grandTotal: entry.grandTotal,
    subtotalFor: (value: string) => entry.subtotalFor.replace('{{value}}', value),
    parameters: entry.parameters,
    runAt: entry.runAt,
  };
}
