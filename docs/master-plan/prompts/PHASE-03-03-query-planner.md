# PHASE 3.3 — The query planner

**Model:** Opus · **Effort:** max

## Purpose

Build the fan-trap guard. **This is the highest-stakes code in the project.**

> Discoverer detected when an aggregate would be computed across a one-to-many join expansion
> and aggregated the detail side in an inline view before joining. **Neo has no such guard —
> no cardinality awareness, no duplicate-aggregation handling anywhere in `lib/sql/`.**
>
> Oracle's own worked example puts the inflation at **2×–3× on two measures simultaneously**.
> In this estate, `M M67 1 → M M67` (header to lines) would return every order total
> multiplied by its line count: **a £2.4M quarter reporting as £9.6M, silently.**

**Good news: this is a specification exercise, not a research one.** The rewrite is documented
verbatim by Oracle across four vendor releases, and
`docs/master-plan/research/legacy-analysis.md` §1.11 is already an implementable numbered
decision procedure.

## Scope

Implement `legacy-analysis.md` §1.11 steps 0–10 as a planner sitting between
`loadMapDefinition()` and `generateSql()`.

### FIRST TASK — make the folder set a value, not a side effect

> **The seam this stage is supposed to sit in does not exist yet.**
>
> `context.ts:62` — `usedFolderIds() { return [...this.aliases.keys()] }`. That is an
> **accumulator populated as a side effect of generation**, not a property of `MapDefinition`.
> `from-clause.ts:67` reads it, and `:72` takes `rootId = required[0]` — so **the FROM root
> folder is whichever folder some earlier clause builder happened to alias first.**
>
> A planner placed before `generateSql()` therefore has no folder set to plan over, and would
> have to re-derive one by its own means — which is how the two derivations in
> `map-execution.service.ts:293-295` and `context.ts` came to disagree in the first place
> (the RLS bypass Phase 1.1 fixed).

**Use `effectiveFolderSet(def)` — the pure function Phase 1.1 introduced (D-115).** Compute it
once; pass it to the planner and to `GenerationContext`. `aliasFor` must stop deciding
membership and only assign a name to a folder the plan already contains.

Without this, D-018's *"the emitter never decides FLAT for itself"* is unachievable: the emitter
still decides the input that FLAT is computed from.

### Write the plan type SECOND

> **It is the design artefact of this whole replan.** A `{kind: 'FLAT'|'REWRITE'|'REFUSE',
> branches: number}` enum is the ceremony version and **will not survive contact with the
> rewrite.**

The type must carry:

- branches
- each branch's folders
- its join predicate
- its **branch-local** conditions and parameters
- its group keys
- its **per-measure aggregate AND re-aggregate function**
- the outer key set

**Why arity, not tidiness, justifies this boundary:**
- `legacy-analysis.md:342-348` puts conditions and parameters **inside each branch's inline
  view**; `:269` states the arithmetic — a branch filter placed in the outer query **silently
  drops master rows from the other branch**. `buildWhereClause` is called once today and its
  binds are reused by the totals queries (`sql-generator.ts:57,:89`). WHERE goes from 1 clause
  to **n+1**.
- `GenerationContext` assigns one alias per folder. The rewrite **repeats the master folder
  inside every branch**, so aliases stop being 1:1. That is a change to `lib/sql/context.ts`.
- `group-by-clause.ts` is 11 lines and takes `(hasAggregates, nonAggregateExprs)`. Per-branch
  group keys have nowhere to go.

### Then

1. **Invert FLAT.** `from-clause.ts:73-76` short-circuits on `required.length === 1` **before
   anything else** — FLAT is the emitter's default today. Oracle's model requires *"a
   deliberate fast path with an explicit predicate, not a default that fan-trap detection has
   to remember to override."* **The planner decides FLAT; the emitter never decides it for
   itself.**
2. **Assume fanning by default** — `one_to_one = false` or unknown ⇒ FANNING (D-033).
3. **Detect the single-branch trap** (§1.11 step 5a, D-034): a master-side measure selected
   alongside one live fanning branch repeats once per detail row. **This is exactly the
   £2.4M → £9.6M case and it has ONE branch.** A guard keyed on "≥ 2 branches" misses it.
4. **The four refusal rules** R1–R4 (§1.11 step 6), each naming its folders.
5. **Re-aggregation:** `SUM→SUM`, `COUNT→SUM`, `MIN→MIN`, `MAX→MAX`.
   **REFUSE `AVG`, `COUNT DISTINCT`, `STDDEV`, `VARIANCE`** (D-035).
6. **Totals spanning differing branches render NULL, not a number** (§1.11 step 9).
7. **Record the decision on every execution** (§1.11 step 10) — `query_execution_log` exists
   (`schema.ts:1173`, written at `map-execution.service.ts:497`); a column is all it needs.

## Prerequisites

> ### ⚠ STOP — VERIFY THIS BEFORE WRITING ANY CODE
>
> **Phase 3.1 must be complete, and `map_items.agg_function` must be non-null on the measure
> items of the re-imported corpus. Check it with a query. Do not take it on trust.**
>
> With `agg_function` NULL, every query classifies `|M| = 0`, takes step 0's flat path, and
> **this entire stage ships present, unit-tested and structurally inert** (D-031). You will
> pass every unit test in this prompt — because every SQL test in this repository runs against
> a hand-built `MapDefinition` fixture, not a migrated one — and deliver a guard that has never
> executed. **That is this project's signature failure mode.**
>
> If `agg_function` is NULL across the estate: **stop and complete Phase 3.1.**

**Phase 3.1** — the measure set, per the check above.

**Phase 3.2** — the planner cannot run without flags and predicates, and its characterisation
tests are what prove this stage's rewrite changed nothing it did not intend to.

**Phase 0.3 Q2** — if the probe found **no cardinality flag columns anywhere**, D-118 applies and
the flags were collected by hand. Confirm they are populated before relying on them; an absent
flag means FANNING (D-033), and a table of all-FANNING joins turns this planner into a refusal
machine.

## Required files to read first

- `docs/master-plan/research/legacy-analysis.md` **§1 in full**, especially §1.4 (the SQL
  shapes), §1.5 (refusals), §1.6 (totals), §1.9 (what the sources do not settle), §1.11 — **the
  authoritative brief**
- `docs/master-plan/research/architecture-analysis.md` **H3, H8, M3**
- `docs/master-plan/DECISION_REGISTER.md` D-017, D-018, D-021, D-030, D-033–D-036
- `backend/src/services/sql-generator.ts` (266 lines — read whole)
- `backend/src/lib/sql/{context,from-clause,where-clause,group-by-clause,select-clause,totals}.ts`

## Required tooling

**Skills:** none. **Agents:** none — this is single-context work.
**Plugins / MCPs:** `context-mode`, and **`code-review` or `coderabbit` on the finished diff —
this stage warrants a review gate.**

## Implementation instructions

- **Write the plan type, get it reviewed, then implement.** Everything else follows from it.
- Where `legacy-analysis.md` §1.9 records an unsettled question — how `AVG` re-aggregates,
  whether branch filters are branch-local or outer — **refuse loudly rather than approximate**.
  §1.9 lists five such gaps; each becomes a named refusal, not a guess.
- Record the summary/RLS bypass invariant **next to the plan type** (D-021): a materialised
  view derived from an RLS-bearing folder contains only its creator's rows — *"the fastest path
  through the system is also the one that leaks."* Nothing leaks today because there is no
  result cache; the note exists so the first person to add one finds it.
- Keep the security folder-set invariant recorded in Phase 1.1: `usedFolderIds` comes from
  `def.items` + `def.conditions`. **The planner will add folders to FROM that carry no selected
  item. Do not extend the security set to match the join path.**

## Tests

- **Reproduce Oracle's documented worked example**, including the inflation the guard prevents.
  Assert both the wrong number (unguarded) and the right one (guarded).
- One test per refusal rule R1–R4, each asserting the folders are named
- The single-branch master-measure trap (step 5a)
- Each re-aggregation mapping; and a refusal for each of `AVG`, `COUNT DISTINCT`, `STDDEV`,
  `VARIANCE`
- Branch-local conditions and parameters land inside the inline view, not the outer query
- FLAT is chosen explicitly, and a one-folder query still takes it
- Totals spanning branches render NULL
- The decision is recorded on every execution

## Security checks

- The rewrite emits more SQL surface. **Every identifier still comes from metadata, validated
  and quoted; every runtime value is still a bind.**
- `explainSql` (`sql-generator.ts:139-149`) is the *one* documented exception to "every value
  is a bind", behind a `^[A-Za-z0-9_]{1,30}$` guard. **The planner must not add a second.**
- Security predicates must still be bracketed unconditionally, and must apply **per branch** —
  a predicate applied only in the outer query would leak rows through an inline view.

## Validation

```bash
cd discoverer-neo && npm run typecheck --workspaces && npm test --workspace backend
```

## Acceptance criteria

- [ ] **`effectiveFolderSet(def)` is the single source of the folder set** — `aliasFor` no
      longer decides membership, only naming
- [ ] **The plan type exists, is reviewed, and carries all seven elements**
- [ ] **A test asserts the planner classifies `|M| ≥ 1` on a REAL migrated map, loaded from the
      database — not on a hand-built fixture.** Without this, an inert guard passes every other
      criterion on this list
- [ ] **`POST /api/maps/plan` returns a plan without executing** (D-117), and the builder calls
      it on canvas change so a refusal is reported *before* Run, naming the rule
- [ ] Oracle's worked example is reproduced, with the inflation asserted and prevented
- [ ] Every refusal names its rule and its folders
- [ ] The single-branch master-measure trap is detected
- [ ] `AVG`, `COUNT DISTINCT`, `STDDEV`, `VARIANCE` refuse
- [ ] FLAT is an explicit planner decision; `from-clause.ts:73-76`'s short-circuit is gone
- [ ] Assume-fanning is the default
- [ ] Branch-local conditions and parameters are inside the inline view
- [ ] Every execution records its decision
- [ ] The summary/RLS invariant is documented beside the plan type

## Documentation updates

- `docs/developer-guide/architecture.md` — the planner, the plan type, the invariant
- **`docs/troubleshooting/` — every refusal rule, in user-facing language.** Phase 2.2's
  refusal UI renders these.
- `docs/user-guide/` — why some worksheets refuse to total

## Git checkpoint

Plan type; planner; emitter changes; each test group. Push after each.

## Handover artefacts

- The plan type, as the phase's central artefact
- The refusal-rule list, for the troubleshooting docs and the refusal UI

## Explicitly out of scope

- **Enabling multi-folder generation.** Phase 3.4. **Phase 1.1's interim refusal stays in
  place through this stage.**
- Chasm traps beyond what §1.10 covers.
- Summary-folder redirection — D-076 says rely on Oracle's own query rewrite.

## Resume instructions

Read the checkpoint. If the plan type exists and Oracle's worked example test passes, resume at
the first unchecked criterion. **If the plan type does not exist, start there.**

## TOKEN-BUDGET SAFE EXECUTION

1. Plan type → planner → emitter → tests. Commit each.
2. **No specialist agents in parallel.** None are needed; §1.11 is already a specification.
3. Checkpoint after the plan type is settled — it is the artefact everything else depends on.
4. Commit coherently. **Never commit a half-implemented decision procedure** — a partial guard
   is more dangerous than none, because it looks present.
5. Leave typecheck and the backend suite green.
6. If interrupted, record exactly which of §1.11's steps 0–10 are implemented, and confirm in
   the checkpoint that **the Phase 1.1 interim refusal is still in place.**
7. Summarise incomplete work before the session ends.
