import { useEffect, useId, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { apiClient } from '@/lib/api'
import type { ItemValues } from '@/lib/types'

/**
 * A value box backed by the item's live list of values.
 *
 * This is the control a Discoverer user is asking for when they say their
 * cost-centre prompt "used to be a dropdown". The values come from the
 * customer's own database at prompt time — nothing is stored — so this is a
 * text box with a suggestion list attached rather than a closed `<select>`:
 *
 *  - the list can be capped, so a value outside it may still be legitimate;
 *  - a wide column (hundreds of thousands of policy numbers) degrades to
 *    type-to-search, and typing has to be possible for that to work;
 *  - an item with no pick-list at all (a calculation, a folder with no data
 *    source) must still accept a typed value.
 *
 * `<datalist>` gives all three for free, and it is the browser's own control:
 * no popover, no focus trap, no keyboard handling to get wrong.
 */

/** Wait this long after a keystroke before asking the server again. */
const SEARCH_DEBOUNCE_MS = 250

interface ItemValuePickerProps {
  /** The item whose values to offer. */
  itemId: string
  id: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'number' | 'date'
  placeholder?: string
  'aria-invalid'?: boolean
}

export function ItemValuePicker({
  itemId,
  id,
  value,
  onChange,
  type = 'text',
  placeholder,
}: ItemValuePickerProps) {
  const { t } = useTranslation(['mapViewer'])
  const listId = useId()
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [value])

  // A 422 means "this item has no pick-list", which is a fact about the
  // metadata and not a failure — the box simply stays free text. React Query
  // would otherwise retry it three times per prompt.
  const query = useQuery({
    queryKey: ['item-values', itemId, debounced],
    queryFn: async () => {
      const res = await apiClient.items.values(itemId, debounced ? { search: debounced } : {})
      return res.data.data
    },
    retry: false,
    staleTime: 60_000,
  })

  const data: ItemValues | undefined = query.data
  const suggestions = useMemo(() => data?.values ?? [], [data])

  const hint = (() => {
    if (query.isError) return null
    if (data?.mode === 'search' && suggestions.length === 0) {
      return t('mapViewer:parameters.typeToSearch')
    }
    if (data?.truncated) {
      return t('mapViewer:parameters.moreValues', { count: suggestions.length })
    }
    return null
  })()

  return (
    <>
      <Input
        id={id}
        type={type}
        list={suggestions.length > 0 ? listId : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {suggestions.length > 0 && (
        <datalist id={listId} data-testid={`values-${itemId}`}>
          {suggestions.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </>
  )
}
