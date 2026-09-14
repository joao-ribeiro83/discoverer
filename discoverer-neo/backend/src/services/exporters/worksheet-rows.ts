import type { GeneratedTotal } from '../../types/sql.js';
import type { ResultColumn, ResultTotalsGroup } from '../map-execution.service.js';
import { cellText } from './types.js';

/**
 * Streaming counterpart of the frontend's row-placement rules
 * (`frontend/src/components/data-table/worksheet-rows.ts`): repeated group
 * values suppressed, a subtotal line at each change in a break column, grand
 * totals at the foot. Pushed one detail row at a time instead of over a
 * materialized array, so an export of millions of rows never holds them all
 * in memory — only the (small, one-row-per-break-value) totals do.
 *
 * ponytail: this duplicates the frontend's placement algorithm rather than
 * sharing it through @discoverer-neo/core, because the frontend workspace
 * doesn't currently depend on that package and wiring a new browser-safe
 * export in for one file is more plumbing than this phase's scope justifies.
 * If the two ever drift, promote both copies into @discoverer-neo/core/worksheet.
 */

export type TotalEntry = { total: GeneratedTotal; value: unknown };

export type DisplayRow =
  | { kind: 'data'; row: Record<string, unknown>; suppressed: string[] }
  | {
      kind: 'subtotal';
      breakAlias: string;
      breakLabel: string;
      breakValue: unknown;
      level: number;
      entries: TotalEntry[];
    }
  | { kind: 'grand'; entries: TotalEntry[] };

/** Compare two cell values for "did the group change". */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a === null || a === undefined || b === null || b === undefined) return false;
  return cellText(a) === cellText(b);
}

/** Index a totals group's rows by the break value they belong to. */
function indexByBreakValue(
  group: ResultTotalsGroup,
): globalThis.Map<string, Record<string, unknown>> {
  const byValue = new globalThis.Map<string, Record<string, unknown>>();
  if (!group.breakAlias) return byValue;
  for (const row of group.rows) byValue.set(cellText(row[group.breakAlias]), row);
  return byValue;
}

function entriesFrom(
  totals: GeneratedTotal[],
  row: Record<string, unknown> | undefined,
): TotalEntry[] {
  if (!row) return [];
  return [...totals]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((total) => ({ total, value: row[total.alias] }));
}

/**
 * Build a fresh row-placement state machine for one export.
 *
 * `pushRow` is called once per detail row, in the query's own order, and
 * returns the display rows (closed subtotals, then the data row) that fall
 * out of pushing it. `finish` closes the outstanding breaks and appends the
 * grand total once the last row has been pushed.
 */
export function createWorksheetRowBuilder(
  groupBreakAliases: string[],
  totals: ResultTotalsGroup[],
) {
  const grandGroups = totals.filter((g) => g.breakAlias === null);
  // A subtotal group is drawable only where its break column is one the rows
  // are actually clustered by.
  const breakGroups = totals.filter(
    (g) => g.breakAlias !== null && groupBreakAliases.includes(g.breakTargetAlias ?? ''),
  );
  const orphanGroups = totals.filter(
    (g) => g.breakAlias !== null && !groupBreakAliases.includes(g.breakTargetAlias ?? ''),
  );

  const groupByColumn = new globalThis.Map<
    string,
    { group: ResultTotalsGroup; byValue: globalThis.Map<string, Record<string, unknown>> }
  >();
  for (const group of breakGroups) {
    groupByColumn.set(group.breakTargetAlias!, {
      group,
      byValue: indexByBreakValue(group),
    });
  }

  const previous: unknown[] = new Array(groupBreakAliases.length).fill(undefined);
  let started = false;

  function closeBreaks(from: number): DisplayRow[] {
    const out: DisplayRow[] = [];
    for (let level = groupBreakAliases.length - 1; level >= from; level--) {
      const alias = groupBreakAliases[level]!;
      const entry = groupByColumn.get(alias);
      if (!entry || !entry.group.breakAlias) continue;
      const breakValue = previous[level];
      const totalsRow = entry.byValue.get(cellText(breakValue));
      const totalEntries = entriesFrom(entry.group.totals, totalsRow);
      if (totalEntries.length === 0) continue;
      out.push({
        kind: 'subtotal',
        breakAlias: alias,
        breakLabel: entry.group.breakLabel ?? alias,
        breakValue,
        level,
        entries: totalEntries,
      });
    }
    return out;
  }

  return {
    pushRow(row: Record<string, unknown>): DisplayRow[] {
      const out: DisplayRow[] = [];
      // The outermost level whose value changed; every level inside it
      // changes with it, which is what makes nested breaks fall out of one
      // comparison.
      let changedAt = groupBreakAliases.length;
      if (!started) {
        changedAt = 0;
      } else {
        for (let level = 0; level < groupBreakAliases.length; level++) {
          if (!sameValue(previous[level], row[groupBreakAliases[level]!])) {
            changedAt = level;
            break;
          }
        }
      }

      if (started && changedAt < groupBreakAliases.length) out.push(...closeBreaks(changedAt));

      const suppressed: string[] = [];
      for (let level = 0; level < groupBreakAliases.length; level++) {
        if (started && level < changedAt) suppressed.push(groupBreakAliases[level]!);
        previous[level] = row[groupBreakAliases[level]!];
      }

      out.push({ kind: 'data', row, suppressed });
      started = true;
      return out;
    },

    finish(): DisplayRow[] {
      const out: DisplayRow[] = [];
      if (started) out.push(...closeBreaks(0));

      const grandEntries = [
        ...grandGroups.flatMap((g) => entriesFrom(g.totals, g.rows[0])),
        // A subtotal whose break column is not drawn still computed
        // something; it is shown at the foot, labelled by its own break,
        // rather than discarded.
        ...orphanGroups.flatMap((g) => g.rows.flatMap((row) => entriesFrom(g.totals, row))),
      ];
      if (grandEntries.length > 0) out.push({ kind: 'grand', entries: grandEntries });

      return out;
    },
  };
}

/** Discoverer's `&value` / `&item` label template, substituted once the value is known. */
export function interpolateTotalLabel(
  template: string | undefined | null,
  parts: { value?: string; item?: string },
  fallback: string,
): string {
  if (!template || template.trim() === '') return fallback;
  return template
    .replace(/&value/gi, parts.value ?? '')
    .replace(/&item/gi, parts.item ?? '')
    .trim();
}

/**
 * Render a subtotal/grand `DisplayRow` as a plain row object keyed by column
 * name, so the CSV/XLSX writers need no special case for it.
 *
 * Mirrors `ResultsTable.renderTotalsRow`: the label sits in the first
 * column, each total's value sits under the column it targets, and a total
 * with no column of its own (a hidden item, or a break Neo cannot draw)
 * rides in the last column as "label: value" text instead of vanishing.
 */
export function formatTotalsRowRecord(
  columns: ResultColumn[],
  entries: TotalEntry[],
  label: string,
): Record<string, unknown> {
  const byTarget = new globalThis.Map<string, TotalEntry>();
  const unplaced: TotalEntry[] = [];
  const columnNames = new Set(columns.map((c) => c.name));
  for (const entry of entries) {
    if (entry.total.targetAlias && columnNames.has(entry.total.targetAlias)) {
      byTarget.set(entry.total.targetAlias, entry);
    } else {
      unplaced.push(entry);
    }
  }
  const unplacedText = unplaced
    .map((u) => `${u.total.targetLabel}: ${cellText(u.value)}`)
    .join('; ');

  const record: Record<string, unknown> = {};
  columns.forEach((column, i) => {
    const entry = byTarget.get(column.name);
    let value: unknown = entry ? entry.value : null;
    if (i === 0) {
      value = entry != null ? `${label}: ${cellText(entry.value)}` : label;
    }
    if (i === columns.length - 1 && unplacedText) {
      value = value != null && value !== '' ? `${cellText(value)}; ${unplacedText}` : unplacedText;
    }
    record[column.name] = value;
  });
  return record;
}

/** Blank a data row's suppressed (repeated) group-break cells, matching the on-screen grid. */
export function applySuppression(
  row: Record<string, unknown>,
  suppressed: string[],
): Record<string, unknown> {
  if (suppressed.length === 0) return row;
  const out = { ...row };
  for (const alias of suppressed) out[alias] = null;
  return out;
}
