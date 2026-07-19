# Performance — Session 6.2

Optimizations applied, with measurements. Every number below was measured on
this machine (Windows 11, backend and Postgres/Redis on localhost via Docker)
rather than estimated. Absolute values are therefore optimistic — there is no
network between tiers — but the before/after comparisons are like-for-like.

**Benchmark dataset:** 20 business areas x 25 folders x 20 items (500 folders,
10,000 items), plus one deliberately pathological folder of 2,020 items to
stand in for a wide Oracle fact table. Seeded and torn down for the session; it
is not in the repo.

---

## Results against the session's targets

| Target | Measured | Status |
| --- | --- | --- |
| Health check < 50ms | 6–8ms | ✅ |
| Metadata API p95 < 200ms | 127ms @ 25 concurrent users | ✅ |
| SQL generation < 100ms | 0.30ms p95 (500 cols, 25 folders, 50 conditions) | ✅ |
| Frontend initial load < 3s | FCP 372ms, load 340ms | ✅ |
| Frontend TTI < 5s | ~0.4s (interactive at first paint) | ✅ |
| Initial bundle < 500 KB | **220 KB transferred (gzip); 707 KB decoded** | ⚠️ see below |
| Map execution, export | not measured — no Oracle source available | ⛔ |

### The two caveats

**Bundle size depends on which number you mean.** Compressed transfer — what
determines load time — is ~220 KB, comfortably under target. Uncompressed
(decoded) JS is 707 KB, over it. Splitting chunks improved caching and removed
382 KB from the login path, but it does not reduce total initial bytes. Getting
decoded size under 500 KB needs code *removed* from the initial graph; the one
remaining lever is described under "Not done" below.

**Map execution and export were not benchmarked.** Both require a live Oracle
data source, and none is configured. The targets for map execution (<2s/1000
rows, <10s/10,000 rows), 100k-row export (<30s), export streaming memory, and
Oracle pool behaviour under 10+ concurrent executions are therefore **unverified**.
The Oracle pool was made tunable (below), but its sizing is reasoned, not measured.

---

## Backend

### 1. Redis metadata caching — the largest win

`backend/src/lib/metadata-cache.ts` adds read-through caching for the three
hottest metadata reads: the business-area list, folders by business area, and
items by folder. The map-builder tree issues one request per expanded folder,
so these dominate request volume.

Measured with 5 trials per concurrency level, reporting the median trial:

| Concurrency | p95 before | p95 after | Throughput before | after |
| --- | --- | --- | --- | --- |
| 1 | 15.5ms | 12.7ms | 352 req/s | 470 req/s |
| 10 | 92.6ms | 64.7ms | 935 req/s | 1,170 req/s |
| 25 | 203.6ms | **126.9ms** | 1,046 req/s | **1,624 req/s** |
| 50 | 374.9ms | 258.7ms | 1,124 req/s | 1,556 req/s |

Two invariants make this safe:

- **Only permission-independent data is cached.** Keys are scoped by entity,
  never by user. Authorization runs in route preHandlers *before* the handler
  consults the cache, so a hit cannot bypass a grant check. The per-user
  filtered business-area list (the non-admin branch) is deliberately **not**
  cached.
- **A cache failure is never a request failure.** Every path falls back to the
  database if Redis is unreachable or returns malformed data.

Mutations invalidate the affected keys immediately — verified end-to-end: key
present → create → key dropped → next read reflects the write with no stale
window. The 5-minute TTL is only a backstop for writers that bypass the API.
The migration runner writes metadata directly and asynchronously, so it
invalidates the whole namespace via an `onSettled` hook (on the failure path
too — a partly-committed migration leaves the cache just as suspect).

Toggle with `METADATA_CACHE_ENABLED=false` to rule the cache out when
diagnosing metadata that looks stale.

Covered by 14 unit tests in `backend/src/__tests__/metadata-cache.test.ts`,
including the degradation paths and the date round-trip described below.

> **Date round-trip.** Values pass through JSON, turning `Date` into an ISO
> string. This is invariant *for these routes*: their response schemas type
> timestamps as `string`, and fast-json-stringify serialises a `Date` to the
> same ISO form, so cached and uncached responses are byte-identical. A caller
> that needs real `Date` objects back must revive them.

### 2. Connection pools — made tunable, defaults deliberately unchanged

Both pools are now environment-configurable (`DATABASE_POOL_MAX`,
`ORACLE_POOL_MIN`/`MAX`/`INCREMENT`/timeouts) instead of hardcoded. A
misconfigured Oracle min/max now fails at startup rather than at first query.

**The Postgres pool default stays at 10, against the initial hypothesis.** An
early one-shot benchmark suggested pool exhaustion (p95 515ms at 25 concurrent)
and raising it to 25 appeared to help. Repeating with warmup and 5 trials showed
that number was cold-start noise: the real steady-state p95 was 229ms, and
raising the pool to 25 moved it to 203ms — and with caching enabled, a pool of
10 and a pool of 25 were indistinguishable (121.5ms vs 126.9ms p95, within
noise). The cache removes the reads that were competing for connections, so the
larger pool buys nothing while consuming a shared, limited resource.

Raise it only for cache-miss-heavy workloads, and raise Postgres'
`max_connections` alongside it.

### 3. Postgres indexes — already complete

No indexes were added. The schema already covers every foreign key and lookup
column used by the metadata queries (`folders_ba_idx`, `items_folder_idx`,
`map_items_map_idx`, and ~40 others). Metadata reads were 7–10ms p95 at 10,000
items before any change; the queries were never the bottleneck.

### 4. SQL generation — already fast

No changes. Generation is pure and stays under 1ms even for a pathological map:

| Map | Columns | p50 | p95 |
| --- | --- | --- | --- |
| Simple (1 folder) | 5 | 0.01ms | 0.03ms |
| Typical (3 folders, 3 conditions) | 15 | 0.02ms | 0.03ms |
| Complex (10 folders, 20 conditions) | 100 | 0.07ms | 0.17ms |
| Pathological (25 folders, 50 conditions) | 500 | 0.23ms | 0.30ms |

---

## Frontend

### 5. Chunk splitting — fixed a silent near-miss

`manualChunks` used the object form, which matches whole module *specifiers*.
It listed `'react-dom'`, but `main.tsx` imports `react-dom/client` — a different
specifier — so the ~540 kB renderer never matched and fell into the entry chunk.
Rewritten as a function matching resolved paths.

A second, subtler problem surfaced only by inspecting the built HTML: `clsx`
(used by `cn()` in every component) was being hoisted into the recharts chunk,
so the entry imported one clsx-sized symbol and **dragged all 382 kB of recharts
onto the login page**. Pinning the small styling utilities to their own chunk
fixed it.

| Chunk | Before | After |
| --- | --- | --- |
| `index` (entry) | 507.6 kB | **151.0 kB** |
| `AuditLogPage` | 390.3 kB | **8.9 kB** |
| `vendor-react` | 50.2 kB (renderer missing) | 232.7 kB (correct) |
| `vendor-charts` | — | 381.6 kB (lazy, audit log only) |
| Largest chunk | 507.6 kB (warned) | 381.6 kB (no warning) |

Initial load is now 6 assets and 707 kB decoded / ~220 kB gzipped, with
framework, query, forms, HTTP, and styling split so an app-code change no longer
invalidates the framework chunk.

Monaco is not bundled at all — `@monaco-editor/react` fetches it from a CDN at
runtime. Worth knowing for offline or strict-CSP deployments.

### 6. Business-area tree — virtualized

The tree mounted every item of every expanded folder. Against a 2,020-item
folder that meant 2,020 draggable rows in the DOM and ~695ms to become
interactive.

Rewritten to flatten the BA → folder → item hierarchy into a single row array
driven by one `useVirtualizer`. Expansion state moved to the parent (the flat
list must be derivable in one pass) and per-node queries became `useQueries`.

| | Before | After |
| --- | --- | --- |
| Mounted item rows | 2,020 | **20** |
| Time to stable render | 695ms | 502ms (now dominated by the fetch, not render) |

Unmounting rows is safe mid-drag because the page renders a dnd-kit
`<DragOverlay>` — the element following the cursor is not the source node.

Filtering was already fine and was left alone: `useDeferredValue` kept keystroke
handling off the long-task threshold even with 2,020 rows mounted.

### 7. Preview proxy

`vite preview` did not inherit the dev server's `/api` proxy, so the production
build could not be exercised end-to-end. Added `preview.proxy` plus a
`discoverer-neo-frontend-preview` launch config. **Bundle work must be verified
against `preview`, not `dev`** — `dev` serves unbundled, unminified modules and
its network waterfall says nothing about what ships.

---

## Not done

- **Map execution, export streaming, and Oracle pool behaviour under load** —
  need a live Oracle source. The highest-value follow-up.
- **Lazy-loading `LoginPage`** would move `vendor-forms` (99 kB) off the initial
  path, since `zod`/`react-hook-form` are otherwise reached only from lazy
  pages. Not taken unilaterally: it adds a render waterfall to the app's
  cold-entry page, and the compressed-size target is already met. A judgement
  call worth making deliberately.
- **`vendor-charts` (382 kB) for one bar chart.** Now correctly lazy and off the
  initial path, so it costs only audit-log visitors. Replacing recharts with an
  inline SVG chart would remove it outright.
- **Image/asset optimization** — nothing to do; the app ships one SVG favicon.

## Reproducing

Benchmark scripts were scratch tooling and are not committed. To redo this work:
seed a representative dataset, drive the metadata endpoints at several
concurrency levels with **warmup and repeated trials**, and take medians. A
single cold run overstated p95 by more than 2x here and pointed at the wrong
bottleneck — that mistake is the main thing worth not repeating.
