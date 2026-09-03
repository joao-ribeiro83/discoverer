# PHASE 1.2 — Visibility, schema unification and the write-path fixes

**Model:** Opus · **Effort:** high

## Purpose

Make the migrated estate visible, stop the API destroying data on save, and collapse the two
drifting Drizzle schemas into one so that drift becomes a **compile error**.

## Scope

1. **F-07** — `GET /api/maps` returns only owned and shared maps, so `{"mine":[],"shared":[]}`
   hides all 923. Add an `all` scope, admin-visible by default.
2. **F-32** — `GET /api/maps/{id}` omits totals, layout and page setup. Return them.
3. **BE-02** — saving a map through the API **permanently destroys its totals** (19 632 rows
   exposed).
4. **BE-10 / D-011** — unify the schema. The 19 shared tables move to
   `migrate/src/db/schema.ts` as the single definition; `backend/src/db/schema.ts`
   **re-exports** them and adds its 11 runtime-only tables. Rename the package to
   `@discoverer-neo/core`, migration pipeline as a subpath.
5. **D-012** — add a `no-restricted-imports` ESLint rule in `migrate/` forbidding any import
   from `backend/`. Five lines.
6. **D-072 / M1b** — `migrate/src/db/schema.ts:285-296` has **no `group_id` column**, so all
   5 605 migrated conditions import with `group_id = NULL` and **parenthesisation is discarded
   at import**. Add the column and fix the write path.
7. **BE-12** — `loadMapDefinition` ignores `folder_business_areas`. Union it in.

## Why item 6 is in this stage and not later

Phase 1.3's seam tests would otherwise pin conditions whose structure was lost at import.

> Note: nothing on this corpus is *currently* wrong, because SQL's `AND`-binds-tighter
> precedence accidentally reproduces the only depth-2 shape measured (7 instances). It is a
> latent landmine for any `AND`-of-`OR`s. **The drift BE-10 predicts has already silently
> dropped structure on import.**

## Prerequisites

Phase 1.1 committed and pushed.

## Required files to read first

- `docs/master-plan/research/architecture-analysis.md` **H1, H2, M1b** — the authoritative brief
- `docs/master-plan/DECISION_REGISTER.md` D-011, D-012, D-072
- `docs/master-plan/research/codebase-inventory.md` §3 — the measured schema diff
- `backend/src/routes/maps.ts`, `backend/src/services/map.service.ts`
- `backend/src/db/schema.ts` (1 748 lines — **grep, do not read whole**)
- `migrate/src/db/schema.ts` (539 lines)
- `backend/src/lib/sql/where-clause.ts:194-219`

## Required tooling

**Skills:** none. **Agents:** none.
**Plugins / MCPs:** `typescript-lsp` — **essential**; the schema move touches every import in
both workspaces. `context-mode` for psql verification.

## Implementation instructions

- **The measured diff is small.** Of the 20 tables `migrate` declares, only **2 differ from
  backend, by 4 columns**: `users` (backend-only `locale`, `theme`, `color_palette`) and
  `map_conditions` (backend-only `group_id`). Neither TS file is the DDL —
  `backend/drizzle/*.sql` is. Both are typed views over one physical schema.
- **Do not create a fourth npm workspace.** `migrate` is already the smaller, dependency-free
  package and `backend` already depends on it (`backend/package.json:31`). The edge points the
  right way.
- After the move, **verify the drift guard works**: deliberately change a column type in
  `core`'s schema and confirm `npm run typecheck --workspaces` fails. Then revert.
- The `group_id` column needs a Drizzle migration **and** a transformer change so a re-import
  writes it.

## Tests

- `GET /api/maps?scope=all` returns 923 for an admin
- A round-trip `GET` → `PUT` on a map with totals **preserves every total row**
- `GET /api/maps/{id}` includes totals, layout and page setup
- A folder shared into a second BA is visible through `loadMapDefinition`
- A re-imported condition carries a non-null `group_id`

## Security checks

- **The `all` scope must not bypass `assertDataEntitlement`.** Listing a map is not
  entitlement to its data — Phase 1.1's second gate still governs execution.
- Confirm a non-admin's `scope=all` returns only maps they may see.

## Validation

```bash
cd discoverer-neo && npm run typecheck --workspaces && npm run lint --workspaces
npm test --workspace backend && npm test --workspace migrate
```

## Acceptance criteria

- [ ] `GET /api/maps?scope=all` returns 923 for an admin, and a correctly filtered set for a
      non-admin
- [ ] A save round-trip preserves totals
- [ ] Map detail returns totals, layout and page setup
- [ ] **A deliberate column mismatch between the two schema files fails `typecheck`**
- [ ] The ESLint rule rejects a `backend/` import from inside `migrate/`
- [ ] Re-imported conditions carry non-null `group_id`
- [ ] The package is renamed and every consumer updated

## Documentation updates

- `docs/developer-guide/architecture.md` — the single-schema arrangement and the dependency
  direction rule
- `docs/developer-guide/backend.md` — the new package name

## Git checkpoint

One commit per scope item; the schema move and the rename together. Push after each.

## Handover artefacts

- The confirmed drift-guard behaviour, recorded in the checkpoint
- The map count returned by `scope=all`

## Explicitly out of scope

- The condition **expression tree**. Phase 5.3 adds a `negated` boolean; the `parent_id` tree
  waits for `EUL4_SUB_QUERIES` to have a reader (D-072).
- The frontend Maps list. Phase 2.1.
- Re-running the full migration.

## Resume instructions

Read the checkpoint, then run the typecheck drift test. Resume at the first unchecked
acceptance criterion.

## TOKEN-BUDGET SAFE EXECUTION

1. Do the schema move **first and alone** — it is the largest mechanical change and the
   riskiest to leave half-done.
2. **No specialist agents.** Route bulk import-path rewriting to a **Haiku** sub-agent if it
   exceeds a few files, per the repository's token-guard rule — one agent, not several.
3. Checkpoint after each commit.
4. Use `typescript-lsp` rather than grepping for every import site.
5. Commit coherent changes.
6. Leave typecheck green before stopping.
7. If interrupted mid-move, record which files still import the old path.

---

## ⟐ CORRECTIONS from the plan review

### 1. The schema counts are wrong, and `custom_functions` breaks the re-export (R-11 / A-03)

D-011 says *"the **19** shared tables … backend re-exports them and adds its **11** runtime-only
tables"*, and *"only 2 of 20 differ, by 4 columns."* Measured against the tree:

| | Plan | Actual |
| - | - | - |
| Shared tables | 19 | **18** |
| Backend runtime-only | 11 | **10** |
| Migrate-only | 0 (implied) | **1 — `custom_functions`** |

Backend-only, verified: `audit_log`, `data_sources`, `export_jobs`, `map_shares`,
`query_execution_log`, `schedule_parameters`, `scheduled_results`, `schedules`,
`security_policy_assignments`, `security_policy_rules`.

**The consequence is `custom_functions`, not the arithmetic.** It exists **only in
`migrate/src/db/schema.ts`**, and **Phase 4.3 (D-057) requires the *backend* to resolve `[2,n]`
against it at query time.** Add to this stage's scope: *`core` exports `custom_functions`;
backend re-exports it.* No phase in v1.0 does this.

### 2. The drift gate cannot be built as written (R-12 / A-04)

v1.0's acceptance is *"a deliberate column mismatch **between the two schema files** now fails
typecheck."* Under a re-export there are no longer two definitions to mismatch. Under parallel
definitions, two `pgTable` calls with different columns are simply two valid values — TypeScript
raises nothing.

**Choose the re-export, and make the gate grep-checkable:**

- [ ] **`backend/src/db/schema.ts` contains no `pgTable` call for any of the 18 shared tables.**
      The ESLint rule enforces it thereafter.

### 3. Add the reciprocal ESLint rule (R-12)

D-012 places `no-restricted-imports` in `migrate/` to stop `migrate → backend` — **the direction
that is already clean**. Nothing constrains `backend → core/migration/`, so the backend can pull
the migration pipeline into the request path. **Add the reciprocal rule:** backend may import
from `core`'s schema and semantics subpaths only.

### 4. Entity scoping moves here from Phase 6.2 (R-14 / C-11)

**Five** `GET`-by-id routes return entities with no grant check — v1.0's 6.2 lists four entity
*types* and misses one route:

| Route | File:line |
| ----- | --------- |
| `GET /api/folders/:id` | `routes/folders.ts:196` |
| `GET /api/items/:id` | `routes/items.ts:175` |
| **`GET /api/items/:id/descendants`** | **`routes/items.ts:531`** |
| `GET /api/joins/:id` | `routes/joins.ts:151` |
| `GET /api/hierarchies/:id` | `routes/hierarchies.ts:142` |

All five carry `preHandler: [fastify.authenticate]` and nothing else, so any authenticated user
reads folder table names, item column names and data types, and join column pairs for business
areas they hold no grant on — the schema of the warehouse.

**It moves here for two reasons.** This stage is already editing route files; and **Phase 2 ships
the first UI that surfaces these ids**, so leaving it until Phase 6 increases discoverability
before closing the door. `GET /api/business-areas/:id` and `GET /api/data-sources/:id` are
already correctly gated — do not touch them.

**This is not new code.** `requireOwnedEntityAccess`, `requireFolderAccess` and their siblings
already exist and are exported at `middleware/business-area-auth.ts:141-190`. Five call sites.

- [ ] A non-admin cannot read a folder, item, item-descendant, join or hierarchy outside their
      granted business areas.

### 5. Counts

`GET /api/maps` returns **Phase 0.4's recorded map count** for an admin. Do not assert a literal.
