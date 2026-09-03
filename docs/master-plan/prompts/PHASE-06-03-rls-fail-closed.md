# PHASE 6.3 — Row-level security, fail-closed

**Model:** Opus · **Effort:** max

## Purpose

Make row-level security actually secure — and **correct the premise the audit got wrong**
before writing a line of it.

## Read this before anything else

> **`EUL4_ASM_POLICIES` is Automated Summary Management, not row-level security.**
>
> Proven three ways:
> 1. `discoverer10g\sql\eulasm.sql:1-2` — *"privileges required for **Summary Management (and
>    ASM)**"* — and it grants `create any materialized view`, `analyze any`,
>    `global query rewrite`.
> 2. The ASM chapter is **chapter 13, "Managing summary folders"**: *"The minimum information
>    required for an ASM policy is a **tablespace name and an allocated amount of disc
>    space**"*.
> 3. `EUL.dtd:385-399` — `ASMPolicy` constrains **folders and summary objects**, carries **no
>    user and no predicate**, and is a **per-EUL singleton** (`EUL.dtd:83`). A singleton cannot
>    be per-user security.
>
> **`AUDIT_LEGACY_COMPATIBILITY_MATRIX.md:64` and F-27 are a misattribution.** Building an RLS
> reader against `ASM_POLICIES` would produce an empty or nonsensical policy set and — worse —
> **a false sense that RLS had been migrated** (D-077).

### What Discoverer 4.1 RLS actually was

**A mandatory advanced condition on a folder, whose predicate compares Oracle's `USER` to a
hard-coded user list** (`9.0.4\B10270_01.pdf` pp. 11-15…11-19). Four steps: load
`SYS.ALL_USERS`; create a calculated item `Username` with formula `USER`; create an item class
over it; create a **mandatory, invisible** advanced condition:

```sql
(USER IN ('ADMTEST','SMITH') AND Store.Region = 'West')
OR
(USER IN ('JONES')           AND Store.Region = 'East')
```

**That is a depth-2 `OR`-of-`AND`s — exactly the shape measured at 7 instances in this estate.
Those seven are the first place to look for surviving RLS.**

## Scope

1. **Make RLS fail CLOSED.** It currently fails **open** with no policy. This is **Neo's one
   deliberate incompatibility with Discoverer** (D-090) — Discoverer's own RLS failed open by
   construction, and reproducing that is not fidelity, it is a vulnerability.
2. **COMPLEX folders bypass predicates structurally** (SEC-06). Refuse to execute against a
   COMPLEX folder carrying a policy until the predicate can be proven injected.
3. **Investigate the 7 depth-2 conditions** for surviving `USER`-comparing RLS. Migrate what
   you find into `security_policies` / `_rules` / `_assignments`.
4. **Migrate `EUL4_ASM_POLICIES` as summary-folder input** — which folders the administrator
   excluded from summarisation. **Low priority; not security.**
5. **Document the summary/RLS bypass invariant** (D-021).

## The invariant that must be written down

> A summary or materialised view derived from an RLS-bearing folder **contains only its
> creator's rows**, and Oracle documents this as a real bypass — *"the fastest path through the
> system is also the one that leaks."*
>
> Neo has **no result caching today** (`backend/src/lib/metadata-cache.ts:16-23` states the
> rule explicitly and caches only entity metadata), so nothing leaks **yet**. The finding is
> that there is nowhere the invariant lives — **so the first person to add a result cache or a
> rollup will not know it exists.** Put it beside the query planner's plan type.

## Prerequisites

Phase 6.2. Phase 5.2 (item classes — the LOV over `ALL_USERS` is part of the legacy pattern).
Phase 1.1 (RLS already follows the derived folder set).

## Required files to read first

- `docs/master-plan/research/legacy-analysis.md` **§8 in full** — **the authoritative brief and
  the correction**
- `docs/master-plan/research/security-analysis.md` §4 Tier 3
- `docs/master-plan/DECISION_REGISTER.md` D-021, D-077, D-090
- `backend/src/lib/sql/security-predicates.ts`
- `backend/src/services/map-execution.service.ts:280-320`
- `backend/src/services/security.service.ts`
- `backend/src/__tests__/integration/rls-enforcement.test.ts` — exists, but
  `security_policies` has **0 rows** live, so fail-open vs fail-closed is **unverified**

## Required tooling

**Skills:** none. **Agents:** none.
**Plugins / MCPs:** `context-mode` (probing the 7 conditions), `typescript-lsp`.

## Implementation instructions

- **Fail-closed is a behaviour change with real consequences** — a user with no policy currently
  sees everything and will then see nothing. Make it explicit and configurable **per policy
  type**, defaulting closed, and document it loudly.
- The COMPLEX-folder refusal must name the folder and the policy.
- When probing the 7 conditions: they are **customer business rules**. Read structure, report
  shape, and **do not paste predicate values containing customer data into committed files.**
- If none of the 7 turns out to be RLS, record that as the finding. **An honest "this estate
  had no row-level security" is a valid and valuable answer** — and it means the `!migrat`
  and grant model carries the whole burden.

## Tests

- **A user with no policy sees NOTHING** — the defining test
- Removing a policy does not open access
- A COMPLEX folder with a policy **refuses**, naming both
- The existing invariant holds: **an `OR` in a user condition cannot escape a security
  predicate** — bracketing stays unconditional
- Predicates apply **per branch** under the Phase 3 planner's rewrite, not only in the outer
  query
- A migrated `USER`-comparing condition, if any, enforces correctly

## Security checks

The whole stage. Additionally:
- **Test the fail-closed default against the Phase 3 rewrite** — an inline view is a new place
  a predicate can be omitted.
- Confirm admin bypass, if any, is deliberate, minimal and audited.

## Validation

```bash
cd discoverer-neo && npm test --workspace backend
```

Seed a policy, execute as an unentitled user, assert zero rows. Then remove the policy and
assert **still** zero rows for a user with no assignment.

## Acceptance criteria

- [ ] **A user with no policy sees nothing**
- [ ] Removing a policy does not open access
- [ ] A COMPLEX folder carrying a policy refuses, naming both
- [ ] Predicates apply per branch under the planner's rewrite
- [ ] The `OR`-cannot-escape invariant still holds
- [ ] The 7 depth-2 conditions are investigated and the finding recorded either way
- [ ] **No RLS reader was built against `EUL4_ASM_POLICIES`**
- [ ] `ASM_POLICIES` is migrated as summary input only, if at all
- [ ] **The summary/RLS bypass invariant is documented beside the plan type**
- [ ] No customer predicate values were committed

## Documentation updates

- `docs/admin-guide/security.md` — the RLS model, **and that it fails closed, deliberately
  unlike Discoverer**
- `docs/developer-guide/architecture.md` — the bypass invariant
- `docs/decisions/eul-fidelity-decisions.md` — the `ASM_POLICIES` correction, so nobody
  re-attempts it
- All four locales

## Git checkpoint

Fail-closed; COMPLEX refusal; the investigation; the invariant. Push after each.

## Handover artefacts

- **The verdict on the 7 conditions** — RLS or not
- The fail-closed behaviour, documented

## Explicitly out of scope

- Summary folders themselves — D-076 says rely on Oracle's own query rewrite.
- CORS, `/metrics`, CVEs, read auditing. Phase 6.4.

## Resume instructions

Read the checkpoint, run the no-policy test. If it returns zero rows, this stage is done.

## TOKEN-BUDGET SAFE EXECUTION

1. **Read `legacy-analysis.md` §8 before writing anything.** The premise correction changes what
   you build.
2. **No specialist agents.**
3. Use `context-mode` for probing conditions; do not read customer predicates into context.
4. Checkpoint the 7-condition verdict as soon as you have it.
5. Commit coherently; leave the backend suite green.
6. If interrupted, record whether fail-closed is committed — a half-applied RLS change is a
   security risk in itself.

---

## ⟐ ADDITIONS from the plan review

### 1. Phase 1.1 already shipped the interim — this stage completes it (D-116 / R-02)

RLS **fails open** today: `map-execution.service.ts:290-291` returns zero predicates when the
user has no policy. v1.0 fixed that here, in Phase 6 — five phases after Phase 1.1 made the
estate's single-folder maps executable (**581**, per
`docs/master-plan/research/baseline-counts.md` — not the disputed `651` figure). **Phase 1.1 now ships a per-policy-bearing-folder refusal** (a no-op
against the empty policy table, correct the moment a policy exists). This stage completes it:
full fail-closed, plus the COMPLEX-folder refusal.

**Extend Phase 1.1's RLS conformance suite** with the COMPLEX cases rather than writing a second
suite.

### 2. Validate `sqlPredicate` on write — it becomes load-bearing HERE (R-15 / C-12)

`security_policy_rules.sqlPredicate` is **raw SQL spliced into every WHERE clause**
(`where-clause.ts:247-294`), with only alias substitution and a `;` check — not parsed. That is
deliberate and admin-only, so it is not a live vulnerability today.

**But this stage makes it the control the entire data-access model rests on.** The plan's
*"SQL safety — already sound — protect it"* does not distinguish the two situations.

- Reject SQL comments (`--`, `/* */`) and anything that closes the generator's unconditional
  bracketing.
- [ ] A predicate containing a `UNION` or a comment is **refused at the API**, with a test.
- **Document that admin is the trust boundary for RLS content.** The plan states this nowhere,
  and after this stage it is the most important sentence in the security model.

### 3. Accessibility (E-06)

This stage changes `/admin/security`, which currently has **no axe assertion anywhere in the
suite**. Add one while you are here — Phase 2.3's gate now requires every route in `App.tsx` to
have one.
