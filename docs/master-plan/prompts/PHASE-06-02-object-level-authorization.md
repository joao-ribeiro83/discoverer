# PHASE 6.2 — Object-level authorisation

**Model:** Opus · **Effort:** high

## Purpose

Close the IDOR that lets any of the 18 non-admin accounts read the entire metadata layer.

> **`GET` by id on folders, items, joins and hierarchies attaches only `authenticate`** — no
> entity scoping. Any authenticated user can read the whole metadata layer, **including
> `custom_sql` and join topology**, across business areas they were never granted.

## Scope

1. **SEC-03** — attach entity scoping to the `GET`-by-id routes for folders, items, joins and
   hierarchies. **The pattern already exists in the maps routes** — reuse it, do not invent a
   second one.
2. **SEC-04** — `folders.custom_sql` validation is **skipped entirely on UPDATE**. Apply the
   create-path validator to the update path.

## Prerequisites

Phase 6.1. Phase 1.1 (`resolveBusinessAreaId` already returns `string[]`).

## Required files to read first

- `docs/master-plan/research/security-analysis.md` §4 Tier 1 — **the authoritative brief**
- `AUDIT_DETAILED_FINDINGS.md` — `SEC-03`, `SEC-04`
- `backend/src/middleware/business-area-auth.ts` — including the Phase 1.1 changes
- `backend/src/routes/{folders,items,joins,hierarchies}.ts`
- `backend/src/routes/maps.ts` — **the correct pattern**
- `backend/src/services/folder.service.ts` — the create-path `custom_sql` validator

## Required tooling

**Skills:** none. **Agents:** none.
**Plugins / MCPs:** `typescript-lsp` — the middleware change touches four route groups.

## Implementation instructions

- **Audit every route, not only the four named.** SEC-03 lists what the audit found; grep for
  every `GET /:id` handler and check each attaches scoping. The audit's coverage was explicitly
  stated as varying by domain.
- `custom_sql` is a **SQL-injection surface** — the update path must run the identical
  validator, not a similar one. Extract it to one function called from both paths.
- Entity scoping must use the **all-of** semantics from Phase 1.1: entitlement to every
  business area the entity belongs to.

## Tests

- A non-admin **cannot** read a folder outside their granted business areas
- The same for items, joins and hierarchies
- An admin can
- **A `custom_sql` UPDATE with a hostile payload is rejected**, identically to create
- A grep-driven test or lint rule asserting every `GET /:id` route attaches scoping

## Security checks

This stage **is** a security check. Additionally:
- **SEC-11** notes reads are never audited, so IDOR exfiltration leaves no trail. Read
  auditing is Phase 6.4 — **do not add it here**, because it must land after Phase 0.2's
  redaction is proven (D-093). Record the dependency.
- Confirm the scoping does not accidentally break the migration service account.

## Validation

```bash
cd discoverer-neo && npm test --workspace backend
```

Manually: authenticate as a non-admin and attempt each `GET`-by-id — expect 403, not 200.

## Acceptance criteria

- [ ] **A non-admin cannot read a folder, item, join or hierarchy outside their granted
      business areas**
- [ ] Every `GET /:id` route across the API attaches scoping, verified by a test or lint rule
- [ ] `custom_sql` validation runs on UPDATE, using the **same** function as create
- [ ] The migration service account still works
- [ ] All-of entitlement semantics are used

## Documentation updates

- `docs/admin-guide/security.md` — object-level access
- `docs/api/endpoints.md` — the 403 behaviour *(note: this file is 51 % accurate; Phase 8.4
  regenerates it — record the change, do not rewrite the file here)*

## Git checkpoint

One commit for scoping, one for `custom_sql`. Push after each.

## Handover artefacts

- The list of routes audited and the ones that needed fixing

## Explicitly out of scope

- **Read auditing (SEC-11).** Phase 6.4, **after** the redaction is proven.
- RLS. Phase 6.3.
- Regenerating the API docs. Phase 8.4.

## Resume instructions

Read the checkpoint, attempt a cross-BA `GET` as a non-admin. If it 403s, this stage is done.

## TOKEN-BUDGET SAFE EXECUTION

1. Grep every `GET /:id` route first and record the list — that scopes the work.
2. **No specialist agents.** A route sweep is exactly the case where one *could* help, but the
   API is 19 route files; do it inline.
3. Checkpoint after each commit.
4. Commit coherently; leave the backend suite green.
5. If interrupted, record which routes are fixed and which remain.

---

## ⟐ CORRECTION — entity scoping moved to Phase 1.2 (R-14 / C-11)

The five ungated `GET`-by-id routes (folders, items, **item descendants**, joins, hierarchies)
are now closed in **Phase 1.2**, which is already editing route files — and, more importantly,
*before* Phase 2 ships the UI that makes those ids discoverable.

**This stage retains:** `custom_sql` validation on **UPDATE**, not just create (SEC-04), and any
entity route added after 1.2. **Confirm 1.2's five are still gated** before closing this stage —
a regression here is invisible without a test.

**Effort drops from `high` to `medium`.**

Note for the record: v1.0's list named four entity **types** and so omitted
`GET /api/items/:id/descendants` (`routes/items.ts:531`), which is a fifth route.
`GET /api/business-areas/:id` and `GET /api/data-sources/:id` were already correctly gated.
