# PHASE 5.1 — The EUL4 object-link resolver

**Model:** Opus · **Effort:** high

## Purpose

One fix recovers **both** the 508 lost hierarchies and the 78 lost grants.

> **508 hierarchies → 0**, every one flagged *"no business area"*. **138 grants → 60.** Both
> share a root cause: **EUL4 binds objects to business areas via `EUL4_BA_OBJ_LINKS`, not via a
> column** — and the reader probes a column that does not exist.

## Scope

1. Fix the object-link resolution in the EUL4 reader so business-area binding goes through
   `EUL4_BA_OBJ_LINKS`.
2. Migrate **user-authored** hierarchies (`EUL4_HIERARCHIES`, `EUL4_HI_NODES`,
   `EUL4_HI_SEGMENTS`, `EUL4_DBH_NODES`).
3. Recover the 78 lost grants (`EUL4_ACCESS_PRIVS`); investigate why all 60 survivors collapsed
   to `VIEW` (MIG-06).
4. **Regenerate date hierarchies natively rather than importing them** (D-074).
5. Remove the dead grant branch (MIG-07).

## The scope question that must be answered first

The estate has **502 `IBH` + 6 `DBH`** hierarchies, and most are named
`… Default Date Hierarchy<n>` — **auto-generated boilerplate.**

**Phase 0.3's Q4 tells you how many.** *"One query, and it may shrink the hierarchy work by two
orders of magnitude."*

> Reproducing *user-defined* hierarchies faithfully while regenerating date hierarchies
> natively is the right call — **but it must be a decision, not the current accident.**

## Prerequisites

Phase 1.3 (the reconciliation test). Phase 0.3's Q4.

## Required files to read first

- `docs/master-plan/research/legacy-analysis.md` §4 (all of it), especially §4.2 and §4.3 —
  **the authoritative brief**
- `docs/master-plan/research/eul-probe-results.md` — Q4
- `docs/master-plan/DECISION_REGISTER.md` D-073, D-074
- `migrate/src/services/eul-reader.ts`, `eul-schema-adapter.ts`
- `migrate/src/services/transformers/transform.ts` — the hierarchy and grant paths
- `backend/src/db/schema.ts` — `hierarchies`, `hierarchy_levels`, `user_business_area_grants`
- `migrate/EUL_SCHEMA_GROUND_TRUTH.md`

## Required tooling

**Skills:** none. **Agents:** none.
**Plugins / MCPs:** `context-mode`, `typescript-lsp`.

## Implementation instructions

- Fix the resolver **once**, in the reader, and confirm both hierarchies and grants recover
  from the same change. If only one recovers, the diagnosis was incomplete.
- Hierarchies are **parent/child trees with derived depth**. Model the tree; do not flatten.
- **Do not import date-hierarchy boilerplate.** Record how many were skipped and why — this is
  a declared expected loss in Phase 1.3's reconciliation, not a silent drop.
- Investigate the `VIEW` collapse before re-migrating grants; migrating 138 grants that all say
  `VIEW` would be a different bug wearing the same clothes.

## Tests

- A reader test proving business-area binding resolves through `EUL4_BA_OBJ_LINKS`
- User-authored hierarchies migrate with correct parent/child structure and depth
- Date-hierarchy boilerplate is skipped, **counted, and declared**
- Grants reconcile to 138 minus a **declared, justified** allowance
- Permission levels are preserved, not collapsed to `VIEW`
- Phase 1.3's reconciliation test passes **without an exception entry** for hierarchies and
  grants

## Security checks

- **Grants are authorisation data.** A migration that widens a permission is a privilege
  escalation. Assert that no migrated grant is broader than its source.
- The `VIEW` collapse may have been *narrowing* — confirm the fix does not swing it to widening.

## Validation

```bash
cd discoverer-neo && npm test --workspace migrate
npx dn-migrate verify --target <connection>
```

```sql
SELECT count(*) FROM hierarchies;
SELECT permission_level, count(*) FROM user_business_area_grants GROUP BY 1;
```

## Acceptance criteria

- [ ] Business-area binding resolves through `EUL4_BA_OBJ_LINKS`
- [ ] User-authored hierarchies migrate with correct structure
- [ ] Date-hierarchy boilerplate is skipped, counted and **declared as an expected loss**
- [ ] Grants reconcile to 138 minus a justified allowance
- [ ] Permission levels are preserved; **no grant is broader than its source**
- [ ] The reconciliation test passes without a hierarchy or grant exception
- [ ] The dead grant branch is removed

## Documentation updates

- `migrate/EUL_SCHEMA_GROUND_TRUTH.md` — the object-link binding
- `docs/decisions/eul-fidelity-decisions.md` — **the date-hierarchy regeneration decision**
- `docs/admin-guide/metadata-management.md` — hierarchies

## Git checkpoint

Resolver; hierarchies; grants; the boilerplate decision. Push after each.

## Handover artefacts

- The hierarchy count, split user-authored vs skipped boilerplate
- The grant reconciliation, with the allowance and its justification

## Explicitly out of scope

- **Drill UI.** Phase 7.3.
- Drill's effect on generated SQL — record what `legacy-analysis.md` §4.4 says; implement in
  7.3.
- Item classes. Phase 5.2.
- Row-level security. Phase 6.3.

## Resume instructions

Read the checkpoint, run the two SQL counts. Resume at the first unchecked criterion.

## TOKEN-BUDGET SAFE EXECUTION

1. Resolver first; confirm **both** recoveries from the one fix before continuing.
2. **No specialist agents.**
3. Use `context-mode` for migration output.
4. Checkpoint the counts after each re-import.
5. Commit coherently.
6. Leave the migrate suite green.
7. If interrupted, record which of the five scope items are complete.

---

## ⟐ CORRECTION — this is two fixes, not one (B-05 / R-05)

D-073 says *"**One fix** … recovers **both** hierarchies (508 → 0) and grants (138 → 60)."*
**Grants are the one-liner. Hierarchies are not.**

`EUL_SCHEMA_GROUND_TRUTH.md:281-288`:

> ***"`HIERARCHIES.BA_ID` does not exist.*** The live EUL4 `HIERARCHIES` has
> `HI_ID, HI_TYPE, HI_NAME, HI_DEVELOPER_KEY, HI_DESCRIPTION, HI_SYS_GENERATED, HI_EXT_HIERARCHY,
> DBH_DEFAULT, IBH_DBH_ID` plus audit columns — and **no business-area column**. … The link runs
> hierarchy → `HI_NODES` → `IG_EXP_LINKS` (`IEL_TYPE='HIL'`, `HIL_HN_ID` → `HIL_EXP_ID`) →
> `EXPRESSIONS.IT_OBJ_ID` → `BA_OBJ_LINKS`."*

That is **four joins through three tables** the migration does not read for this purpose, and a
hierarchy spanning items in two business areas has no defined answer.

**Split the stage:**

- **5.1a Grants** (`Opus · medium`) — the genuine `BA_OBJ_LINKS` fix. Gate: grants reconcile to
  Phase 0.4's baseline minus a **declared, justified** allowance.
- **5.1b Hierarchies** (`Opus · high`) — the four-hop resolver. **State a rule for a
  multi-business-area hierarchy** before writing it.

### Two facts to carry in from Phase 0.3

- **`HI_SYS_GENERATED` is a real column**, and Q4 now reads it first. It likely answers D-112
  (how many of the `IBH` rows are date-template boilerplate) **directly** — far more reliably
  than the naming-pattern `GROUP BY` v1.0 proposed, and it may shrink 5.1b by two orders of
  magnitude (D-074).
- **`DBH_DEFAULT` and `IBH_DBH_ID`** name the date-hierarchy relationship D-074 depends on.
