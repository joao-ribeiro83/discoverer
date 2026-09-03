# PHASE 3.1 — Populate the measure set

**Model:** Opus · **Effort:** high

## Purpose

Give the fan-trap guard something to detect.

> `map_items.agg_function` is **NULL on every row**. The guard's decision procedure defines the
> measure set `M` by aggregation. With no measures, **every query classifies as `|M| = 0` and
> takes step 0's flat path.**
>
> Build the guard before this, and you ship something **present, unit-tested, and structurally
> inert.**

## Scope

Populate `map_items.agg_function` and the axis/measure split **from the workbook parser**.

The data is **given, not inferred**: the `.DIS` query request carries two literal vectors —
`0x0123` axis and `0x0124` measure. See `EUL_SCHEMA_GROUND_TRUTH.md:1009-1024` and
`workbook-parser.ts:2704-2706`.

**It comes from the parser, not the EUL.** `legacy-analysis.md` §3.2 records the EUL column as
**UNKNOWN**; Phase 0.3's Q3 may supply it as a cross-check, but the parser is the source of
truth here.

## Prerequisites

Phase 0.3 (Q3's answer, as a cross-check). Phase 1.3 (the baseline numbers to measure against).

## Required files to read first

- `docs/master-plan/research/legacy-analysis.md` §3 (all of it) and §1.11 step 0 — **the
  authoritative brief**
- `docs/master-plan/research/architecture-analysis.md` **H5**
- `docs/master-plan/DECISION_REGISTER.md` D-031
- `docs/master-plan/research/eul-probe-results.md` — Q3
- `migrate/src/services/workbook-parser.ts` around `:2704` — **grep, do not read the 3 179
  lines whole**
- `migrate/src/services/transformers/transform.ts` — the `map_items` write path
- `migrate/EUL_SCHEMA_GROUND_TRUTH.md:1009-1024`

## Required tooling

**Skills:** none. **Agents:** none.
**Plugins / MCPs:** `context-mode` (corpus counts), `typescript-lsp`.

## Implementation instructions

- Read the two vectors in the parser and carry them through the transformer into
  `map_items.agg_function` and the axis/measure classification.
- **`agg_function` currently has no enum constraint** (`varchar(64)`). Add one, or at least a
  validated set — an unconstrained free-text column feeding a correctness guard is a hazard.
- Where the parser cannot determine an aggregate, write `NULL` and **count it**. Do not default
  to `SUM` — a wrong default here produces wrong money downstream.
- This requires a **re-import** to populate existing rows. Use
  `POST /api/migration/reimport-maps`, the existing partial route, rather than a full
  re-migration.

## Tests

- A parser unit test asserting both vectors are read from a fixture workbook
- A transformer test asserting the split reaches `map_items`
- **A corpus test asserting the split is non-empty across the estate** — this is the test that
  proves the guard will not be inert
- A count of items with `agg_function IS NULL`, recorded as a tracked number

## Security checks

None specific. The re-import is admin-gated already.

## Validation

```bash
cd discoverer-neo && npm test --workspace migrate
```

```sql
SELECT agg_function, count(*) FROM map_items GROUP BY agg_function ORDER BY 2 DESC;
SELECT axis_type, count(*) FROM map_items GROUP BY axis_type;
```

Expect `axis_type` to already show `AXIS` ~20 014 / `MEASURE` ~5 920 / `PAGE` 26 — and
`agg_function` to become **non-null on the measure rows**, where today it is null everywhere.

## Acceptance criteria

- [ ] `agg_function` is non-null on the measure items of a re-imported corpus
- [ ] A measure count per map is reportable
- [ ] **The corpus test asserting a non-empty split exists and passes**
- [ ] The `agg_function IS NULL` count is recorded as a tracked number, with a reason
- [ ] `agg_function` is constrained, not free text
- [ ] No aggregate is defaulted where the source does not state one

## Documentation updates

- `migrate/EUL_SCHEMA_GROUND_TRUTH.md` — the two vectors, if not already recorded
- `docs/decisions/eul-fidelity-decisions.md` — that measures come from the parser, not the EUL

## Git checkpoint

One commit for the parser read, one for the transformer write, one for the tests. Push.

## Handover artefacts

- **The measure count across the estate.** Phase 3.3's planner depends on it, and Phase 3.4
  will compare against it.
- The null count and its explanation.

## Explicitly out of scope

- **The guard itself.** Phase 3.3.
- `join_predicates`. Phase 3.2.
- Any change to how aggregates are emitted in SQL.

## Resume instructions

Read the checkpoint, then run the two SQL counts above. If `agg_function` is non-null on
measure rows and the corpus test exists, this stage is done.

## TOKEN-BUDGET SAFE EXECUTION

1. Parser read → transformer write → re-import → verify. Commit each.
2. **No specialist agents.**
3. Use `context-mode` for corpus counts.
4. Checkpoint with the measure count as soon as you have it — Phase 3.3 needs it.
5. Commit coherently.
6. Leave tests green.
7. If interrupted, record whether the re-import has run.
