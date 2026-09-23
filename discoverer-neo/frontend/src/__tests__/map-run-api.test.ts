import { describe, it, expect, vi, afterEach } from 'vitest'
import { api, apiClient } from '@/lib/api'
import type { MapRun } from '@/lib/types'

// The backend signals re-use vs. a freshly-queued run purely through the HTTP
// status of POST /maps/:id/runs (200 vs 202) — there is no field for it in the
// body. This is the one place that mapping happens, so it is the one thing
// worth a unit test here (see Spec > "same map, same conditions").

function makeRun(over: Partial<MapRun> = {}): MapRun {
  return {
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
    expiresAt: '2026-01-01T01:00:00Z',
    ...over,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('apiClient.maps.requestRun', () => {
  it('maps a 200 reply (re-used result) to reused: true', async () => {
    const run = makeRun({ status: 'COMPLETED' })
    vi.spyOn(api, 'post').mockResolvedValueOnce({ status: 200, data: { data: run } })

    const result = await apiClient.maps.requestRun('map-1', { parameters: { region: 'EAST' } })

    expect(result).toEqual({ data: run, reused: true })
  })

  it('maps a 202 reply (newly queued) to reused: false', async () => {
    const run = makeRun({ status: 'QUEUED' })
    const post = vi
      .spyOn(api, 'post')
      .mockResolvedValueOnce({ status: 202, data: { data: run } })

    const result = await apiClient.maps.requestRun('map-1', { force: true })

    expect(result).toEqual({ data: run, reused: false })
    expect(post).toHaveBeenCalledWith('/maps/map-1/runs', { force: true })
  })
})
