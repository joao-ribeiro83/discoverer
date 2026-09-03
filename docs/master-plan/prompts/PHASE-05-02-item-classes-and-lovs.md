# PHASE 5.2 — Item classes and lists of values

**Model:** Opus · **Effort:** high

## Purpose

Give 7 521 parameters and 5 605 conditions real pick-lists instead of free-text boxes — and
supply the dependency that migrating any surviving row-level security needs.

> `EUL4_DOMAINS` (20 columns) has **no Neo table and no code path.** Parameter pick-lists and
> item validation are impossible today.

## Scope

Model `EUL4_DOMAINS` as `item_classes`, bind it to items and parameters, and surface pick-lists
in the UI.

## Two constraints that decide the design

### 1. An item class is a shared property bundle with THREE orthogonal capabilities

**LOV · alternative sort · drill-to-detail.** A boolean `has_lov` loses two of them.

### 2. LOV values are LIVE, not stored

> *"A target that migrates LOVs as static enums is wrong on day one."*

An LOV is `SELECT DISTINCT <column> FROM <table>` against the customer's live Oracle, plus a
**cache flag** and a **cardinality hint**. Migrating the values would freeze data that changes
daily.

## What this is NOT for

`AUDIT_LEGACY_COMPATIBILITY_MATRIX.md` implies item classes matter chiefly for RLS. **That is a
misread.** Discoverer used the item class only so the *administrator* could pick usernames from
a dropdown **while authoring** a mandatory condition in Administrator — and
`legacy-analysis.md` §8.5 says **do not port that mechanism at all** (D-077).

**Keep the feature; delete the rationale.** Its real payload is the 7 521 parameters and 5 605
conditions currently rendering as free text.

## Prerequisites

Phase 5.1. Phase 2.2 (the parameter prompt exists to hang pick-lists on).

## Required files to read first

- `docs/master-plan/research/legacy-analysis.md` §5 (all of it) — **the authoritative brief**
- `docs/master-plan/research/architecture-analysis.md` **M2**
- `docs/master-plan/DECISION_REGISTER.md` D-077, and Open decision on `EUL4_DOMAINS`' columns
- `migrate/EUL_SCHEMA_GROUND_TRUTH.md`
- `backend/src/services/oracle-introspection.ts` — how live Oracle reads are already done
- `frontend/src/components/parameters/`

## Required tooling

**Skills:** none. **Agents:** none.
**Plugins / MCPs:** `context-mode`, `Claude_Browser` (verify the pick-list renders),
`typescript-lsp`.

## Implementation instructions

- **`EUL4_DOMAINS`' 20 columns are not fully understood** — `legacy-analysis.md` §5.3 records
  whether the three capabilities are separate booleans or one type code as **UNKNOWN**. Read
  `ALL_TAB_COLUMNS` and `SELECT *` first. **Model what you find; do not guess.**
- The LOV query must go through the **existing identifier validation** — the table and column
  names come from metadata and must be rejected, not escaped, if they contain quotes.
- **Cap and paginate.** An LOV over a high-cardinality column must not return a million rows to
  a dropdown. Use the cardinality hint; fall back to a search-as-you-type endpoint.
- Cache LOV results in Redis with a short TTL, keyed by data source and column.

## Tests

- An item class binds to items and parameters
- An LOV returns live values from Oracle, capped
- A high-cardinality LOV degrades to search rather than dumping rows
- A hostile table or column name is **rejected**
- The pick-list renders in the parameter prompt
- Alternative sort and drill-to-detail are modelled, even if not yet consumed

## Security checks

- **LOV queries run against the customer's live database with metadata-supplied identifiers.**
  This is a new SQL surface — validate identifiers, bind every value, and add a test with a
  hostile name.
- **An LOV must respect the user's entitlement.** Do not let a pick-list reveal values from a
  folder the user cannot query — route it through `assertDataEntitlement`.
- Do not cache LOV values across users if the underlying folder carries a security policy.

## Validation

```bash
cd discoverer-neo && npm test --workspace backend && npm test --workspace migrate
```

Then `Claude_Browser`: open a parameterised worksheet, confirm the prompt shows a pick-list.

## Acceptance criteria

- [ ] `EUL4_DOMAINS`' columns are read from the live EUL and the model matches what was found
- [ ] All **three** capabilities are modelled — LOV, alternative sort, drill-to-detail
- [ ] **LOV values are fetched live**, not migrated as static enums
- [ ] LOVs are capped, paginated and cached with a TTL
- [ ] A hostile identifier is rejected, with a test
- [ ] **LOV results respect entitlement**
- [ ] Parameter prompts render pick-lists
- [ ] All four locales carry the new keys

## Documentation updates

- `migrate/EUL_SCHEMA_GROUND_TRUTH.md` — `EUL4_DOMAINS`' real columns
- `docs/admin-guide/metadata-management.md` — item classes
- `docs/user-guide/executing-maps.md` — pick-lists
- All four locales

## Git checkpoint

Schema; reader; LOV service; UI. Push after each.

## Handover artefacts

- `EUL4_DOMAINS`' confirmed column semantics
- The count of items and parameters now carrying an item class

## Explicitly out of scope

- **Row-level security.** Phase 6.3. Do not build an RLS reader here.
- Drill UI. Phase 7.3.
- Alternative-sort consumption in the query engine — model it now, use it later.

## Resume instructions

Read the checkpoint, open a parameterised worksheet in the browser. If the prompt shows a
pick-list, this stage is done.

## TOKEN-BUDGET SAFE EXECUTION

1. Probe `EUL4_DOMAINS` first and record the columns before writing schema.
2. **No specialist agents.**
3. Use `context-mode` for the probe.
4. Checkpoint the column findings immediately — they are durable value.
5. Commit coherently.
6. Leave both suites green.
7. If interrupted, record whether the schema is settled and whether LOVs fetch live.
