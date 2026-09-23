# Map Runs, Retention and the Sweeper

Learn how map executions are queued, how long their results stay valid, and
how the background sweeper cleans them up.

## What is a Map Run?

Every map execution — a user clicking **Run**, and every scheduled run — goes
through one background queue (`map-runs`) and lands its rows in Postgres.
Nothing queries Oracle twice for the same map, user and parameters while a
valid result already exists: the second request returns the stored result
instantly instead of re-running the query.

Only the map builder's own preview (`POST /api/maps/:id/execute`, capped at
1,000 rows) bypasses the queue — it is a quick, unsaved check while composing
a map, not a run.

## Per-User Ordering

Runs for the same user execute strictly one at a time, in the order they were
requested. Runs from different users are not ordered against each other —
the worker just runs one user's turn, then moves on. `MAP_RUN_WORKER_CONCURRENCY`
sets how many different users' runs can be executing at once.

## Retention

| Kind | Result stays valid until |
|---|---|
| **Live** (a user clicked Run) | completion + `MAP_RUN_LIVE_TTL_HOURS`, **clamped to 24 hours no matter what the setting says** |
| **Scheduled** | completion + that schedule's own retention, in days (see below) |
| Any failed run | completion + 24 hours — kept as history, not as data |
| Queued or running for longer than `MAP_RUN_STALE_HOURS` | marked **Failed** by the sweeper — a safety net after a worker crash |

A live run is never usable for more than a day, whatever an administrator
sets `MAP_RUN_LIVE_TTL_HOURS` to. This is a hard limit, not a default.

### Scheduled Retention (`BR_EXPIRY`)

A schedule's retention comes from its own `result_retention_days` field
(default 30 days; set it through `resultRetentionDays` on
`POST`/`PUT /api/schedules` — there is no schedule-form field for it yet).
Schedules imported from a
legacy Discoverer EUL bring this value in automatically from
`EUL4_BATCH_REPORTS.BR_EXPIRY` — the retention-in-days column Discoverer
itself used for batch report results (values 1, 4, 10 and 30 have been seen
in real estates). A missing `BR_EXPIRY` imports as 30 days, the same default
as a schedule created directly in Neo.

## The Sweeper

The map-run worker also runs a periodic sweep, on the same in-process
`setInterval` pattern as the export cleanup:

- Every `MAP_RUN_CLEANUP_INTERVAL_MINUTES`, it deletes every run whose
  `expires_at` has passed, cascading to its stored row batches.
- In the same pass, it fails any run still **Queued** or **Running** after
  `MAP_RUN_STALE_HOURS` — this only fires if a worker crashed mid-run and
  never reaches a terminal state on its own.

There is no manual purge command. To force an early cleanup, restart the
backend (or the standalone worker) with a shorter
`MAP_RUN_CLEANUP_INTERVAL_MINUTES`, or delete the run from the
[Runs page](../user-guide/executing-maps.md#the-runs-page) / `DELETE /api/runs/:id`.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `MAP_RUN_WORKER_ENABLED` | on in every environment except `test` | Run the map-run worker in this process |
| `MAP_RUN_WORKER_CONCURRENCY` | 3 (max 8) | How many different users' runs execute at once |
| `MAP_RUN_LIVE_TTL_HOURS` | 24 | Live result validity — clamped to 24 regardless of this value |
| `MAP_RUN_MAX_ROWS` | 100000 | Rows captured per run before it is marked truncated |
| `MAP_RUN_BATCH_SIZE` | 1000 | Rows per stored batch (Postgres JSONB) |
| `MAP_RUN_CLEANUP_INTERVAL_MINUTES` | 15 | How often the sweeper runs |
| `MAP_RUN_STALE_HOURS` | 24 | A Queued/Running run older than this is marked Failed |

See [Configuration](../deployment/configuration.md#map-runs-queue-retention-sweeper)
for how to set these in `.env` or the compose files, and
[Docker Deployment](../deployment/docker.md) for running the map-run worker
as its own container.

## Monitoring

Queue depth for `map-runs` is exported alongside the export and scheduler
queue gauges — see [Monitoring](../deployment/monitoring.md).

## What's Next?

- **[Scheduling Maps](../user-guide/scheduling.md)** — how a schedule's own run is queued
- **[Data Sources](data-sources.md)** — the Oracle connection map runs execute against
- **[Configuration](../deployment/configuration.md)** — the full environment variable reference

---

**See Also:** [Executing Maps](../user-guide/executing-maps.md), [Admin Guide](../admin-guide/)
