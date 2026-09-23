// Regression: ISSUE-003 — the viewer had no way to cancel a queued run
// Found by /qa on 2026-09-23
// Report: .gstack/qa-reports/qa-report-localhost-5174-2026-09-23.md
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { MapViewerPage } from '@/pages/MapViewerPage'
import { apiClient } from '@/lib/api'
import type { MapRun, MapWithDetails } from '@/lib/types'

vi.mock('@/lib/api', () => ({
  apiClient: {
    maps: { get: vi.fn(), requestRun: vi.fn(), createExport: vi.fn() },
    runs: { get: vi.fn(), rows: vi.fn(), cancel: vi.fn() },
    exports: { list: vi.fn(), getStatus: vi.fn(), download: vi.fn() },
  },
  getErrorMessage: () => 'error',
  getErrorKind: () => undefined,
  getRefusalCode: () => undefined,
  getRefusalDetails: () => undefined,
}))

const mockedApi = vi.mocked(apiClient, true)

const queuedRun: MapRun = {
  id: 'run-1',
  mapId: 'map-1',
  mapName: 'Sales by Region',
  kind: 'LIVE',
  scheduleId: null,
  status: 'QUEUED',
  parameters: {},
  calculatedFields: [],
  columns: null,
  decoration: null,
  rowCount: null,
  truncated: false,
  executionTimeMs: null,
  errorMessage: null,
  createdAt: '2026-01-01T00:00:00Z',
  startedAt: null,
  completedAt: null,
  expiresAt: '2099-01-01T00:00:00Z',
}

const map = {
  id: 'map-1',
  name: 'Sales by Region',
  description: null,
  mapType: 'TABLE',
  businessAreaId: 'ba-1',
  createdBy: 'user-1',
  isPublic: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  items: [{ id: 'mi-1', mapId: 'map-1', itemId: 'item-1', displayOrder: 0, createdAt: '2026-01-01T00:00:00Z' }],
  conditions: [],
  parameters: [],
  calculatedFields: [],
} as unknown as MapWithDetails

describe('MapViewerPage — cancel a queued run', () => {
  it('shows Cancel while queued and cancels that run', async () => {
    mockedApi.maps.get.mockResolvedValue({ data: { data: map } } as never)
    mockedApi.maps.requestRun.mockResolvedValue({ data: queuedRun, reused: false })
    mockedApi.runs.get.mockResolvedValue({ data: { data: queuedRun } } as never)
    mockedApi.runs.cancel.mockResolvedValue({ data: { data: { cancelled: true } } } as never)

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/maps/map-1/view']}>
          <Routes>
            <Route path="/maps/:id/view" element={<MapViewerPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /^run$/i }))
    fireEvent.click(await screen.findByRole('button', { name: /^cancel$/i }))

    await waitFor(() => expect(mockedApi.runs.cancel).toHaveBeenCalledWith('run-1'))
    await waitFor(() => expect(screen.queryByRole('button', { name: /^cancel$/i })).toBeNull())
  })
})
