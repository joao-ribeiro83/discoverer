import type { ResultTotal, ResultTotalsGroup } from '@/lib/types'
import { stringifyCell } from '@/lib/worksheet-format'

/**
 * The row model a Discoverer worksheet draws: data rows, with repeated values
 * in the group columns suppressed, a subtotal line at each change in a break
 * column, and grand totals at the end.
 *
 * **Why this can be a linear scan.** The SQL generator emits every group/break
 * sort ahead of every plain sort, so rows arrive already clustered by break
 * column, outermost first (`groupBreakAliases` names them in that order). A
 * break therefore ends exactly where the value changes — no grouping pass, no
 * sorting, and the result stays streamable.
 *
 * **Why totals are matched by value, not by position.** Subtotals come back
 * from their own statement, one row per distinct break value over the whole
 * filtered set. Matching on the value means a subtotal is still the true total
 * for its group even when only the first page of rows has been fetched.
 */

export type TotalEntry = { total: ResultTotal; value: unknown }

export type DisplayRow =
  | {
      kind: 'data'
      /** Index into the (unsorted, unfiltered) result rows. */
      index: number
      /**
       * Break columns whose value repeats the row above and should be drawn
       * blank. Discoverer suppresses these; a column of the same word repeated
       * forty times is what the group sort exists to remove.
       */
      suppressed: string[]
    }
  | {
      kind: 'subtotal'
      breakAlias: string
      breakLabel: string
      breakValue: unknown
      /** 0 = outermost break. Used to indent nested subtotals. */
      level: number
      entries: TotalEntry[]
    }
  | { kind: 'grand'; entries: TotalEntry[] }

/** Compare two cell values for "did the group change". */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  if (a === null || a === undefined || b === null || b === undefined) return false
  return stringifyCell(a) === stringifyCell(b)
}

/** Index a totals group's rows by the break value they belong to. */
function indexByBreakValue(
  group: ResultTotalsGroup,
): globalThis.Map<string, Record<string, unknown>> {
  const byValue = new globalThis.Map<string, Record<string, unknown>>()
  if (!group.breakAlias) return byValue
  for (const row of group.rows) {
    byValue.set(stringifyCell(row[group.breakAlias]), row)
  }
  return byValue
}

function entriesFrom(
  totals: ResultTotal[],
  row: Record<string, unknown> | undefined,
): TotalEntry[] {
  if (!row) return []
  return [...totals]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((total) => ({ total, value: row[total.alias] }))
}

export interface BuildWorksheetRowsInput {
  rows: Record<string, unknown>[]
  /** Break columns, outermost first, as the query sorted them. */
  groupBreakAliases: string[]
  totals: ResultTotalsGroup[]
}

/**
 * Build the display rows for a result set.
 *
 * Only breaks that the *result* actually carries are honoured: a break column
 * the query sorted on but did not select cannot be drawn, and a totals group
 * whose break column is not among `groupBreakAliases` is emitted at the end
 * with the grand totals rather than being dropped.
 */
export function buildWorksheetRows({
  rows,
  groupBreakAliases,
  totals,
}: BuildWorksheetRowsInput): DisplayRow[] {
  const grandGroups = totals.filter((g) => g.breakAlias === null)
  // A subtotal group is drawable only where its break column is one the rows
  // are actually clustered by.
  const breakGroups = totals.filter(
    (g) => g.breakAlias !== null && groupBreakAliases.includes(g.breakTargetAlias ?? ''),
  )
  const orphanGroups = totals.filter(
    (g) => g.breakAlias !== null && !groupBreakAliases.includes(g.breakTargetAlias ?? ''),
  )

  const groupByColumn = new globalThis.Map<
    string,
    { group: ResultTotalsGroup; byValue: globalThis.Map<string, Record<string, unknown>> }
  >()
  for (const group of breakGroups) {
    groupByColumn.set(group.breakTargetAlias!, {
      group,
      byValue: indexByBreakValue(group),
    })
  }

  const out: DisplayRow[] = []
  // Value of each break column on the previous row, so a change is visible
  // without looking back into `rows`.
  const previous: unknown[] = new Array(groupBreakAliases.length).fill(undefined)
  let started = false

  /** Emit subtotals for break levels `from`..last, innermost first. */
  function closeBreaks(from: number): void {
    for (let level = groupBreakAliases.length - 1; level >= from; level--) {
      const alias = groupBreakAliases[level]
      const entry = groupByColumn.get(alias)
      if (!entry || !entry.group.breakAlias) continue
      const breakValue = previous[level]
      const totalsRow = entry.byValue.get(stringifyCell(breakValue))
      const totalEntries = entriesFrom(entry.group.totals, totalsRow)
      if (totalEntries.length === 0) continue
      out.push({
        kind: 'subtotal',
        breakAlias: alias,
        breakLabel: entry.group.breakLabel ?? alias,
        breakValue,
        level,
        entries: totalEntries,
      })
    }
  }

  rows.forEach((row, index) => {
    // The outermost level whose value changed; every level inside it changes
    // with it, which is what makes nested breaks fall out of one comparison.
    let changedAt = groupBreakAliases.length
    if (!started) {
      changedAt = 0
    } else {
      for (let level = 0; level < groupBreakAliases.length; level++) {
        if (!sameValue(previous[level], row[groupBreakAliases[level]])) {
          changedAt = level
          break
        }
      }
    }

    if (started && changedAt < groupBreakAliases.length) closeBreaks(changedAt)

    const suppressed: string[] = []
    for (let level = 0; level < groupBreakAliases.length; level++) {
      if (started && level < changedAt) suppressed.push(groupBreakAliases[level])
      previous[level] = row[groupBreakAliases[level]]
    }

    out.push({ kind: 'data', index, suppressed })
    started = true
  })

  if (started) closeBreaks(0)

  const grandEntries = [
    ...grandGroups.flatMap((g) => entriesFrom(g.totals, g.rows[0])),
    // A subtotal whose break column is not drawn still computed something; it
    // is shown at the foot, labelled by its own break, rather than discarded.
    ...orphanGroups.flatMap((g) =>
      g.rows.flatMap((row) => entriesFrom(g.totals, row)),
    ),
  ]
  if (grandEntries.length > 0) out.push({ kind: 'grand', entries: grandEntries })

  return out
}
