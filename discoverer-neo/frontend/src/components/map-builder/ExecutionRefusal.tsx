import { useTranslation } from 'react-i18next'
import { ShieldAlert } from 'lucide-react'
import type { RefusalCode } from '@/lib/types'

interface Props {
  code: RefusalCode
  /**
   * Context the backend attached: the folder names involved, or — for a
   * refusal about a join rather than a folder set — the join names.
   */
  details?: Record<string, unknown>
}

function nameList(details: Props['details'], key: 'folders' | 'joins'): string {
  const names = details?.[key]
  return Array.isArray(names) ? names.filter((n) => typeof n === 'string').join(', ') : ''
}

/**
 * A refusal is not an error, and must not look like one (D-036).
 *
 * The query planner declines requests it can build SQL for but cannot answer
 * correctly — a total across a one-to-many join being the common one; the
 * estate holds 282 COUNT DISTINCT totals, so users meet this on ordinary work,
 * not at an edge. Discoverer refused the same shapes. Rendered as a generic
 * error, the first support ticket reads "your product can't average"; rendered
 * as an explanation with a next step, it reads as the product knowing its own
 * limits.
 *
 * Deliberately not destructive-styled: amber, an explanation, and a "what to
 * change" line.
 */
export function ExecutionRefusal({ code, details }: Props) {
  const { t } = useTranslation('mapViewer')
  const folders = nameList(details, 'folders')
  const joins = nameList(details, 'joins')

  return (
    <div
      role="status"
      data-testid="execution-refusal"
      className="mx-4 mt-3 flex items-start gap-3 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm"
    >
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">{t(`refusal.${code}.title`)}</p>
        <p className="text-muted-foreground">{t(`refusal.${code}.why`)}</p>
        {folders && (
          <p className="text-muted-foreground">{t('refusal.folders', { folders })}</p>
        )}
        {joins && <p className="text-muted-foreground">{t('refusal.joins', { joins })}</p>}
        <p>{t(`refusal.${code}.whatToChange`)}</p>
      </div>
    </div>
  )
}
