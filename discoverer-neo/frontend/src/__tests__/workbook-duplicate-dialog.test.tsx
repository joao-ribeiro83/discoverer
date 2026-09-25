import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { WorkbookDuplicateDialog } from '@/components/maps/WorkbookDuplicateDialog'
import { apiClient } from '@/lib/api'

vi.mock('@/lib/api', () => ({
  apiClient: { workbooks: { duplicate: vi.fn() } },
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : 'error'),
}))

const toastMock = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}))

const mockedApi = vi.mocked(apiClient, true)

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const onOpenChange = vi.fn()
  render(
    <WorkbookDuplicateDialog open onOpenChange={onOpenChange} workbookId="wb-1" workbookName="Sales" />,
    { wrapper },
  )
  return { onOpenChange }
}

beforeEach(() => vi.clearAllMocks())

describe('WorkbookDuplicateDialog', () => {
  it('copies under the typed name and closes', async () => {
    mockedApi.workbooks.duplicate.mockResolvedValue({ data: { data: { name: 'Sales 2027' } } } as never)
    const { onOpenChange } = renderDialog()

    const input = screen.getByLabelText('Name of the new workbook')
    expect(input).toHaveValue('Sales (copy)')
    fireEvent.change(input, { target: { value: '  Sales 2027 ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(mockedApi.workbooks.duplicate).toHaveBeenCalledWith('wb-1', 'Sales 2027')
    expect(toastMock).toHaveBeenCalledWith({ title: 'Created "Sales 2027"' })
  })

  it('stays open and shows the server reason when the copy is refused', async () => {
    mockedApi.workbooks.duplicate.mockRejectedValue(new Error('Refused: Sheet 1'))
    const { onOpenChange } = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Refused: Sheet 1', variant: 'destructive' }),
      ),
    )
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('will not submit an empty name', () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText('Name of the new workbook'), { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: 'Copy' })).toBeDisabled()
  })
})
