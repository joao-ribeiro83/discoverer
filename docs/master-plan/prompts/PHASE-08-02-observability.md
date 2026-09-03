# PHASE 8.2 — Observability and resource correctness

**Model:** Sonnet · **Effort:** medium

## Purpose

See what the system is doing, and stop it leaking resources.

## Scope

| ID | Finding | Fix |
| -- | ------- | --- |
| **INF-10** | Metrics miss **the Oracle pool, the scheduler queue and migration progress** — 39 metric families are served, none covering these | Add them |
| **BE-04** | `getConnection` **leaks a connection whenever its own timeout wins the race** | Fix the race; release on every path |
| **BE-03** | Async execution results are cached **forever in a process-local `Map`** | Bound it — TTL and size cap, or move to Redis |
| **BE-06** | Pagination has **no tiebreaker**, and **186 maps have no sort at all** — so page 2 may repeat or skip rows | Add a deterministic tiebreaker |
| **F-14** | `/api/data-sources/{id}/tables` returns **404 KB unpaginated** *(if Phase 6.4 did not already)* | Paginate |

## Prerequisites

Phase 8.1.

## Required files to read first

- `AUDIT_DETAILED_FINDINGS.md` — `INF-10`, `BE-03`, `BE-04`, `BE-06`, `F-14`
- `backend/src/plugins/metrics.ts`
- `backend/src/services/oracle-connection-pool.ts`
- `backend/src/services/map-execution.service.ts` — the result cache
- `backend/src/lib/sql/pagination.ts`
- `backend/src/services/scheduler.service.ts`, `backend/src/queues/`

## Required tooling

**Skills:** none. **Agents:** none.
**Plugins / MCPs:** `context7` (current `node-oracledb` pool behaviour — **training data will
be stale on this**), `typescript-lsp`.

## Implementation instructions

- **Metrics:** pool size, in-use, waiting, acquisition latency, and failures per data source;
  queue depth, active, failed, completed; migration phase and progress. Match the existing
  Prometheus naming conventions — 39 families already exist, so the idiom is established.
- **BE-04** is a race: the timeout fires, the caller abandons, but the connection later arrives
  and is never released. Ensure the acquisition path releases on **every** exit, including the
  abandoned one.
- **BE-03**: a process-local `Map` that grows forever is an OOM waiting to happen. A TTL plus a
  size cap is the lazy correct fix; Redis is right only if results must survive a restart —
  **decide and say which.**
- **BE-06**: the tiebreaker must be a stable unique column. **Without a sort, "page 2" is
  undefined** — 186 maps are in that state. Append the primary key.

## Tests

- Pool metrics reflect real acquisitions
- Queue metrics reflect enqueued jobs
- **A timed-out acquisition does not leak** — assert pool in-use returns to baseline
- The result cache evicts by TTL and by size
- **Paginating a map with no sort returns each row exactly once across pages**
- `/tables` paginates

## Security checks

- **Metrics must not leak business data** — no item names, no formula text, no customer
  identifiers in labels. Cardinality matters too: a label per map id is a metrics-explosion
  risk.
- Confirm `/metrics` is still off the public listener (Phase 6.4).

## Validation

```bash
cd discoverer-neo && npm test --workspace backend
curl -s http://localhost:3000/metrics | grep -E 'oracle_pool|queue_|migration_'
```

Run a paginated query over an unsorted map and assert no duplicates or gaps.

## Acceptance criteria

- [ ] Oracle pool, queue and migration metrics are served
- [ ] **A timed-out connection acquisition does not leak**
- [ ] The result cache is bounded by TTL and size
- [ ] **Pagination is deterministic on maps with no sort** — no duplicates, no gaps
- [ ] `/tables` paginates
- [ ] **No business data or high-cardinality label in metrics**
- [ ] `/metrics` remains off the public listener

## Documentation updates

- `docs/deployment/monitoring.md` — the new metrics and what they mean
- `docs/troubleshooting/` — reading pool exhaustion and queue backlog

## Git checkpoint

One commit per finding. Push after each.

## Handover artefacts

- The metric names added
- Confirmation that pagination is deterministic, with the test

## Explicitly out of scope

- Performance benchmarking — `PERFORMANCE.md` exists but has no reproducible suite. A separate
  later effort.
- Backups and Redis durability. Phase 8.3.

## Resume instructions

Read the checkpoint, curl `/metrics` and grep for the three families.

## TOKEN-BUDGET SAFE EXECUTION

1. Metrics → BE-04 → BE-03 → BE-06. Commit each.
2. **No specialist agents.**
3. Checkpoint after each commit.
4. Commit coherently; leave the backend suite green.
5. If interrupted, record which findings are closed.
