import { useEffect, useState } from 'react'
import { useMapBuilderStore } from '@/store/mapBuilder'
import { apiClient } from '@/lib/api'
import type { QueryPlanSummary, RefusalCode } from '@/lib/types'
import { ExecutionRefusal } from './ExecutionRefusal'

/**
 * Tell the user a query will be refused while they are still building it
 * (D-117).
 *
 * Before this, the builder guarded only "items from two business areas". A
 * fan-trap refusal — a total across a one-to-many join, a COUNT DISTINCT that
 * cannot be recalculated from partial totals — was discovered by composing the
 * worksheet, pressing Run, waiting for production Oracle, and reading an
 * explanation. The planner already returns a plan rather than a verdict, so
 * asking it up front costs one small request and no data access at all.
 *
 * Debounced, because it fires on every canvas change. A stale answer is
 * discarded rather than rendered: dragging a fourth column in must not leave
 * the refusal from three columns ago on screen.
 */
export function PlanPreflight() {
  const selectedItems = useMapBuilderStore((s) => s.selectedItems)
  const [plan, setPlan] = useState<QueryPlanSummary | null>(null)

  // The canvas signature: what the planner's answer actually depends on.
  // Re-planning on a column rename or a width change would be noise.
  const signature = selectedItems
    .map((i) => `${i.itemId}:${i.aggFunction ?? ''}:${i.axisType ?? ''}:${i.isHidden ? 'h' : ''}`)
    .join('|')

  useEffect(() => {
    if (selectedItems.length === 0) {
      setPlan(null)
      return
    }

    let cancelled = false
    const timer = setTimeout(() => {
      apiClient.maps
        .plan(
          selectedItems.map((i) => ({
            itemId: i.itemId,
            aggFunction: i.aggFunction,
            axisType: i.axisType,
            isHidden: i.isHidden,
          })),
        )
        .then((res) => {
          if (!cancelled) setPlan(res.data.data)
        })
        .catch(() => {
          // A pre-flight that cannot answer says nothing. Run still reports
          // whatever goes wrong, with the full message.
          if (!cancelled) setPlan(null)
        })
    }, 400)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // The dependency is `signature`, deliberately: `selectedItems` is a new
    // array on every store update, and re-planning on a column rename or a
    // width change would be noise. The signature carries exactly the fields
    // the planner's answer depends on.
  }, [signature])

  if (!plan || plan.kind !== 'REFUSE' || !plan.rule) return null

  return (
    <ExecutionRefusal
      code={`FAN_TRAP_${plan.rule}` as RefusalCode}
      details={{ folders: plan.folders }}
    />
  )
}
