import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  ParameterPromptDialog,
  itemIdForParameter,
  type PromptableParameter,
} from '@/components/parameters/ParameterPromptDialog'

const values = vi.fn<(id: string, params?: unknown) => Promise<unknown>>()

vi.mock('@/lib/api', () => ({
  apiClient: {
    items: {
      values: (id: string, params?: unknown) => values(id, params),
    },
  },
}))

function param(over: Partial<PromptableParameter> = {}): PromptableParameter {
  return {
    id: 'p1',
    name: 'Cost Centre',
    paramType: 'STRING',
    defaultValue: null,
    isRequired: false,
    ...over,
  }
}

function renderPrompt(parameters: PromptableParameter[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ParameterPromptDialog
        parameters={parameters}
        open
        onOpenChange={() => {}}
        onSubmit={() => {}}
      />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  values.mockReset()
})

/**
 * A `map_parameters` row carries no item. The item comes from the condition
 * written over the parameter, which is the only place the workbook records it.
 */
describe('itemIdForParameter', () => {
  it('finds the item through the condition that reads the parameter', () => {
    const conditions = [
      { itemId: 'item-1', paramName: 'COST_CENTRE' },
      { itemId: 'item-2', paramName: null },
    ]
    expect(itemIdForParameter({ name: 'Cost Centre', bindName: 'COST_CENTRE' }, conditions)).toBe(
      'item-1',
    )
  })

  // Migrated rows predating bind-safe names still hold the prompt itself.
  it('matches on the prompt when there is no bind name', () => {
    const conditions = [{ itemId: 'item-9', paramName: 'Cost Centre' }]
    expect(itemIdForParameter({ name: 'Cost Centre' }, conditions)).toBe('item-9')
  })

  // A parameter used only inside a calculation has no condition, so no item,
  // so no pick-list. It stays a free-text box rather than erroring.
  it('returns null when no condition references the parameter', () => {
    expect(itemIdForParameter({ name: 'Unused' }, [{ itemId: 'i', paramName: 'Other' }])).toBeNull()
  })
})

describe('the prompt pick-list', () => {
  it('offers the item\'s live values as suggestions', async () => {
    values.mockResolvedValue({
      data: { data: { mode: 'values', values: ['1000', '2000'], truncated: false, itemClassId: null, cardinality: null } },
    })

    renderPrompt([param({ itemId: 'item-1' })])

    // The dialog renders into a Radix portal, so the datalist is in
    // document.body and NOT under the render container.
    await waitFor(() => {
      expect(document.querySelector('datalist')).not.toBeNull()
    })
    const options = [...document.querySelectorAll('datalist option')].map((o) =>
      o.getAttribute('value'),
    )
    expect(options).toEqual(['1000', '2000'])
    // Still a text box: the list can be capped, so a value outside it may be
    // perfectly legitimate.
    expect(screen.getByLabelText('Cost Centre')).toHaveAttribute('list')
  })

  it('asks nothing when the parameter has no item', () => {
    renderPrompt([param({ itemId: null })])

    expect(values).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Cost Centre')).not.toHaveAttribute('list')
  })

  // Oracle's "long LOV": past a point the dropdown becomes a search box.
  it('tells the user to type when the column is too wide to list', async () => {
    values.mockResolvedValue({
      data: { data: { mode: 'search', values: [], truncated: true, itemClassId: 'c1', cardinality: 900000 } },
    })

    renderPrompt([param({ itemId: 'item-1' })])

    await waitFor(() => {
      expect(screen.getByText(/type to search/i)).toBeInTheDocument()
    })
  })

  // 422 means "this item has no pick-list" — a calculation, or a folder with
  // no data source. The box must still accept a typed value.
  it('falls back to free text when the item has no list of values', async () => {
    values.mockRejectedValue({ response: { status: 422 } })

    renderPrompt([param({ itemId: 'item-1' })])

    await waitFor(() => expect(values).toHaveBeenCalled())
    expect(screen.getByLabelText('Cost Centre')).not.toHaveAttribute('list')
  })
})
