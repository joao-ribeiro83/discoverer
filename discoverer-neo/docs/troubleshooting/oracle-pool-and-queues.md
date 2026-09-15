# Reading Oracle pool exhaustion and queue backlog

Metric names below are documented in full in
[Monitoring](../deployment/monitoring.md#key-metrics).

## The Oracle pool has "lost" connections (BE-04)

Symptom: map executions against one data source start timing out with
`Timed out acquiring an Oracle connection after <N>ms`, but
`oracle_pool_connections{state="in_use"}` never reaches
`oracle_pool_connections{state="max"}`.

That gap is the tell. A pool that is genuinely busy shows `in_use` pinned at
`max`; a pool that has leaked slots (a bug in `getConnection`'s
acquire-timeout race — see BE-04, fixed in
`backend/src/services/oracle-connection-pool.ts`) shows `in_use` climbing to
some number below `max` and staying there while `waiting` grows and
`oracle_pool_acquisition_timeouts_total` keeps climbing. Only a process
restart recovers a pool that has actually lost slots; if the fix regresses,
that restart-to-recover pattern is the signal to check first.

Read all four together:

```promql
oracle_pool_connections{data_source_id="<id>", state="in_use"}
oracle_pool_connections{data_source_id="<id>", state="max"}
oracle_pool_connections{data_source_id="<id>", state="waiting"}
oracle_pool_acquisition_timeouts_total
```

`oracle_pool_acquisition_failures_total` and
`oracle_pool_acquisition_duration_avg_milliseconds` (per data source)
distinguish a slow database (latency climbing, few failures) from a
misconfigured one (failures climbing regardless of latency).

## Export or scheduler queue backlog

`export_queue_jobs{state="waiting"}` or `scheduler_queue_jobs{state="waiting"}`
holding above single digits for more than a few minutes means jobs are being
enqueued faster than workers drain them:

1. Check `export_jobs_total{outcome="failed"}` / `schedule_runs_total{outcome="failed"}`
   — a rising failure rate alongside the backlog usually means jobs are
   retrying (BullMQ's exponential backoff) rather than draining, not that more
   capacity is needed.
2. If failures are flat and `waiting` still grows, scale worker concurrency
   (`EXPORT_WORKER_CONCURRENCY`) or run `workers/export.standalone.ts` /
   `scheduler.standalone.ts` in their own container instead of in-process.
3. Both queue-depth gauges are read every 15s from BullMQ's own
   `getJobCounts()` inside the worker process (`export.worker.ts`,
   `scheduler.worker.ts`) — a gauge stuck at its last value while jobs are
   visibly running means the worker process itself is wedged, not that the
   queue is actually idle.

## Migration stalled

`migration_running` stuck at `1` with `migration_progress_percent` flat for
longer than the estate normally takes: the migration job is hung, most likely
on a single slow Oracle read. `migration_progress_percent`'s `phase` label
names the target table (or `read`/`plan`/`write` for a maps-only re-import)
it last reported progress on — check that table's row count in the source EUL
schema for anything unusually large.
