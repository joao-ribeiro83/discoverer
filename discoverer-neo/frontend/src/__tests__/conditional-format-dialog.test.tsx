import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { ConditionalFormatDialog } from '@/components/map-builder/ConditionalFormatDialog'
import { apiClient } from '@/lib/api'
import type { ConditionalFormatRule, MapItem, MapWithDetails } from '@/lib/types'

vi.mock('@/lib/api', () => ({
  apiClient: {
    maps: {
      get: vi.fn(),
      listConditionalFormats: vi.fn(),
      createConditionalFormat: vi.fn(),
      deleteConditionalFormat: vi.fn(),
    },
  },
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : 'error'),
}))

const toastMock = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}))

const mockedApi = vi.mocked(apiClient, true)

function envelope<T>(data: T) {
  return { data: { data } }
}

function mapItem(over: Partial<MapItem> = {}): MapItem {
  return {
    id: 'item-1',
    mapId: 'map-1',
    itemId: 'i1',
    displayOrder: 0,
    displayName: 'Amount',
    formatMask: null,
    aggFunction: null,
    sortDirection: null,
    sortOrder: null,
    columnWidth: null,
    axisType: null,
    axisEdge: null,
    axisOrder: null,
    isHidden: false,
    sortGroup: false,
    dataType: 'NUMBER',
    headingFormatMask: null,
    alignment: null,
    wordWrap: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

function mapWithDetails(over: Partial<MapWithDetails> = {}): MapWithDetails {
  return {
    id: 'map-1',
    name: 'Sales',
    description: null,
    mapType: 'TABLE',
    businessAreaId: 'ba1',
    createdBy: 'u1',
    isPublic: false,
    isActive: true,
    workbookId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    items: [mapItem()],
    conditions: [],
    parameters: [],
    calculatedFields: [],
    ...over,
  }
}

function rule(over: Partial<ConditionalFormatRule> = {}): ConditionalFormatRule {
  return {
    id: 'rule-1',
    mapId: 'map-1',
    name: null,
    mapItemId: 'item-1',
    target: 'CELL',
    operator: '>',
    value: '100',
    backgroundColor: '#fde68a',
    textColor: null,
    isBold: false,
    isItalic: false,
    isUnderline: false,
    displayOrder: 0,
    ...over,
  }
}

/** Waits for the map/columns query to resolve, then clicks "Add rule". */
async function openDraft() {
  const button = await screen.findByRole('button', { name: 'Add rule' })
  await waitFor(() => expect(button).toBeEnabled())
  fireEvent.click(button)
}

function renderDialog(over: Partial<React.ComponentProps<typeof ConditionalFormatDialog>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const onOpenChange = vi.fn()
  const utils = render(
    <ConditionalFormatDialog open onOpenChange={onOpenChange} mapId="map-1" {...over} />,
    { wrapper },
  )
  return { onOpenChange, ...utils }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedApi.maps.get.mockResolvedValue(envelope(mapWithDetails()) as never)
  mockedApi.maps.listConditionalFormats.mockResolvedValue(envelope([]) as never)
})

describe('ConditionalFormatDialog', () => {
  it('shows the empty state, then lists existing rules with their summary', async () => {
    mockedApi.maps.listConditionalFormats.mockResolvedValue(envelope([rule()]) as never)
    renderDialog()

    expect(await screen.findByText('Amount > 100')).toBeInTheDocument()
    expect(screen.queryByText('No conditional formats yet.')).not.toBeInTheDocument()
  })

  it('shows the no-rules message when the map has none', async () => {
    renderDialog()
    expect(await screen.findByText('No conditional formats yet.')).toBeInTheDocument()
  })

  it('disables Add rule when the map has no visible columns', async () => {
    mockedApi.maps.get.mockResolvedValue(envelope(mapWithDetails({ items: [] })) as never)
    renderDialog()
    expect(await screen.findByRole('button', { name: 'Add rule' })).toBeDisabled()
  })

  it('opens the draft editor, hides the value input for Is empty, and creates a rule', async () => {
    mockedApi.maps.createConditionalFormat.mockResolvedValue(envelope(rule()) as never)
    renderDialog()

    await openDraft()
    expect(screen.getByRole('textbox')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '42' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(mockedApi.maps.createConditionalFormat).toHaveBeenCalledTimes(1))
    expect(mockedApi.maps.createConditionalFormat).toHaveBeenCalledWith(
      'map-1',
      expect.objectContaining({ mapItemId: 'item-1', operator: '>', value: '42', displayOrder: 0 }),
    )
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Rule added' })))
  })

  it('sends a null value for Is empty even if a value was typed before switching operators', async () => {
    mockedApi.maps.createConditionalFormat.mockResolvedValue(envelope(rule()) as never)
    renderDialog()

    await openDraft()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '42' } })

    // Switch the operator to "Is empty" (native select semantics: Radix
    // renders a listbox, but the underlying select value changes via the
    // trigger's onValueChange callback — simulate by changing the select).
    const operatorTrigger = screen.getByLabelText('Operator')
    fireEvent.click(operatorTrigger)
    const isEmptyOption = await screen.findByText('Is empty')
    fireEvent.click(isEmptyOption)

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mockedApi.maps.createConditionalFormat).toHaveBeenCalledTimes(1))
    expect(mockedApi.maps.createConditionalFormat).toHaveBeenCalledWith(
      'map-1',
      expect.objectContaining({ operator: 'IS_NULL', value: null }),
    )
  })

  it('cancel discards the draft without creating a rule', async () => {
    renderDialog()
    await openDraft()
    expect(screen.getByRole('textbox')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(mockedApi.maps.createConditionalFormat).not.toHaveBeenCalled()
  })

  it('shows an error toast when creating a rule fails', async () => {
    mockedApi.maps.createConditionalFormat.mockRejectedValue(new Error('boom'))
    renderDialog()

    await openDraft()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Could not add rule', variant: 'destructive' }),
      ),
    )
  })

  it('deletes a rule and shows a confirmation toast', async () => {
    mockedApi.maps.listConditionalFormats.mockResolvedValue(envelope([rule()]) as never)
    mockedApi.maps.deleteConditionalFormat.mockResolvedValue(envelope(undefined) as never)
    renderDialog()

    fireEvent.click(await screen.findByRole('button', { name: 'Delete this rule' }))
    await waitFor(() => expect(mockedApi.maps.deleteConditionalFormat).toHaveBeenCalledWith('map-1', 'rule-1'))
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Rule deleted' })))
  })

  it('falls back to "Unknown column", "?" and a transparent dot for a rule with no matching column/operator/value/color', async () => {
    mockedApi.maps.listConditionalFormats.mockResolvedValue(
      envelope([rule({ mapItemId: 'ghost-item', operator: null, value: null, backgroundColor: null })]) as never,
    )
    renderDialog()

    const summary = await screen.findByText('Unknown column ?')
    const dot = summary.closest('li')!.querySelector('span[aria-hidden="true"]') as HTMLElement
    expect(dot.style.backgroundColor).toBe('transparent')
  })

  it('falls back to the column id in the picker when a column has no display name', async () => {
    mockedApi.maps.get.mockResolvedValue(
      envelope(
        mapWithDetails({ items: [mapItem(), mapItem({ id: 'item-2', itemId: 'i2', displayName: null })] }),
      ) as never,
    )
    renderDialog()
    await openDraft()

    fireEvent.click(screen.getByLabelText('Column'))
    expect(await screen.findByText('item-2')).toBeInTheDocument()
  })

  it('shows the BETWEEN and IN placeholders once those operators are picked', async () => {
    renderDialog()
    await openDraft()

    fireEvent.click(screen.getByLabelText('Operator'))
    fireEvent.click(await screen.findByText('Between'))
    expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'low,high')

    fireEvent.click(screen.getByLabelText('Operator'))
    fireEvent.click(await screen.findByText('In list'))
    expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'value1,value2,…')
  })

  it('clearing the background color falls back to white in the picker and sends null on save', async () => {
    mockedApi.maps.createConditionalFormat.mockResolvedValue(envelope(rule()) as never)
    renderDialog()
    await openDraft()

    fireEvent.click(screen.getAllByRole('button', { name: 'Clear' })[0])
    expect(screen.getByLabelText('Background color')).toHaveValue('#ffffff')

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(mockedApi.maps.createConditionalFormat).toHaveBeenCalledWith(
        'map-1',
        expect.objectContaining({ backgroundColor: null }),
      ),
    )
  })

  it('shows a spinner on Save while the create mutation is pending', async () => {
    let resolveCreate!: (v: unknown) => void
    mockedApi.maps.createConditionalFormat.mockImplementation(
      () => new Promise((res) => { resolveCreate = res }) as never,
    )
    renderDialog()
    await openDraft()

    const saveButton = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(saveButton)
    await waitFor(() => expect(saveButton.querySelector('svg.animate-spin')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()

    resolveCreate(envelope(rule()))
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Rule added' })))
  })
})
