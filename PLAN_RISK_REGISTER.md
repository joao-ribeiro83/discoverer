# Plan Risk Register

Strategic and execution risks to `MASTER_IMPLEMENTATION_PLAN_FINAL.md`, from the independent
adversarial review of 2026-09-02. Evidence in `review/` and `MASTER_PLAN_REVIEW.md`.

**Probability** — how likely the risk materialises if the *final* plan is followed as written.
**Impact** — consequence if it does.
Rows marked **RESIDUAL** remain after the review's corrections are applied; the rest are risks
the corrections address, retained so a future session knows why the correction exists.

---

## A. Correctness of numbers — the risks that produce wrong money

| ID | Risk | Prob | Impact | Evidence | Mitigation | Phase |
| -- | ---- | ---- | ------ | -------- | ---------- | ----- |
| **PR-01** | **The four join cardinality flags do not exist in EUL4.** `OneToOne` is attested only in `EUL.dtd` — the *export* DTD. `KEY_CONS`'s real columns are four, none a flag. D-033 then makes every join FANNING permanently, and the product refuses most multi-folder aggregates | **Medium-High** | **Critical** — Phase 3 delivers a refusal machine, and 3.4's original gate would still pass | `legacy-analysis.md:112` *"never been read from this estate"*; `EUL_SCHEMA_GROUND_TRUTH.md:161-172` | 0.3 Q2 rewritten as **yes/no first**, extended to `IHS_FK_LINKS` + `OBJ_JOIN_USGS`. **Both outcomes written into the plan now.** If absent: collect 10 joins' flags by hand from a live Administrator (MANUAL), fallback = keep 1.1's refusal permanently | 0.3 → 3.2 |
| **PR-02** | **Master/detail orientation is inverted.** Three artefacts disagree; the authority says *"parent/detail"* — opposed roles in one phrase. Orientation decides which side enters the inline view, so an inversion yields *correct-looking wrong numbers*, not an error | Medium | **Critical** | `EUL_SCHEMA_GROUND_TRUTH.md:165`; `eul-schema-adapter.ts:129`; `AUDIT_DETAILED_FINDINGS.md:891` | 0.3 Q1 replaced by a **cardinality probe** (`COUNT(*)` vs `COUNT(DISTINCT key)` per side) — a measurement, not an inference. Names kept as cross-check only | 0.3 |
| **PR-03** | **The fan-trap guard ships inert.** `agg_function` NULL ⇒ `\|M\| = 0` ⇒ flat path always. Unit tests against hand-built fixtures pass regardless | **High** if 3.3's prompt is followed as written in v1.0 | **Critical** — the plan's own signature failure, reproduced | D-031; `PHASE-03-03` Prerequisites named only 3.2 | 3.3's prompt rewritten to lead with 3.1 and the inertness warning; acceptance now asserts `\|M\| ≥ 1` **on a real migrated map** | 3.1 → 3.3 |
| **PR-04** | **The guard is wired but never exercised, and nobody notices.** `REFUSE > 0 && FLAT < 923` is satisfied by 271 pre-existing `DISCONNECTED` refusals | High | High | `legacy-analysis.md` §1.11 steps 1, 10 | Histogram made **per-rule**; gate becomes **`REWRITE(n) > 0`** plus a fall in `REFUSE(DISCONNECTED)` against 3.2's baseline | 3.4 |
| **PR-05** | **RESIDUAL — Oracle type marshalling silently corrupts totals.** NUMBER precision loss or DATE coercion returns a wrong figure that no test can see; `oracledb` is never reached in any test or in CI | Low-Medium | High | No Oracle service in `ci.yml`; fakes are hand-built `Connection` objects | Type-marshalling conformance test added to 9.1 — one row, one column per Oracle type in use. **Does not eliminate the risk before 9.1** | 9.1 |
| **PR-06** | **RESIDUAL — every estate count in the plan is unverified.** 272 vs 341 multi-folder; 5 605 vs 3 395 conditions; 18 vs 17 users. D-072's *"covers the entire measured corpus"* may rest on 61 % of it | **High** (the contradictions are confirmed) | Medium | `PHASE-01-01:9,151` vs `PHASE-03-02:11`; `PHASE-05-03` vs `PHASE-01-02` | New **Phase 0.4 baseline measurement**; every count-quoting gate now references the recorded baseline, not a literal | **0.4** |

---

## B. Security — the risks that leak data

| ID | Risk | Prob | Impact | Evidence | Mitigation | Phase |
| -- | ---- | ---- | ------ | -------- | ---------- | ----- |
| **PR-10** | **A calculated field reads a folder the user has no policy for.** RLS resolves over items ∪ conditions; `def.formulaItems` puts an unselected folder's **column value into SELECT** | **High** once policies exist | **Critical** | `map-execution.service.ts:293-295` vs `context.ts:24-33,126-129`, `sql-generator.ts:252-255` | One **pure function of `MapDefinition`** returns the effective folder set; RLS and the planner both use it. Gate test added to 1.1 | 1.1 |
| **PR-11** | **A join-bridge folder's policy never fires.** BFS spans `def.joins` = *all joins in the business area*; an `INNER`-joined bridge filters the result set | Medium-High | **Critical** | `from-clause.ts:104-126`; `types/sql.ts:34` | Same function as PR-10. Rule: *any folder that can change the rows the user sees must resolve its policies or the query refuses* | 1.1 |
| **PR-12** | **Five phases of unfiltered live data.** 1.1 makes 651 maps executable; fail-closed RLS lands in 6.3 | **Certain** under v1.0 | **Critical** | `map-execution.service.ts:290-291` | **Per-policy-bearing-folder fail-closed** shipped in 1.1 — a **no-op against today's empty policy table**, correct the moment the first policy is written. Full treatment stays in 6.3 | 1.1 → 6.3 |
| **PR-13** | **Logout does not revoke.** `/api/auth/refresh` has no `preHandler`, so the blacklist is unreachable; role copied from the token; the 7-day window self-renews | **Certain** (present now) | High | `routes/auth.ts:143-200`; `plugins/auth.ts:67-78` | 6.1's scope names all three defects; two new gates, including *a blacklisted token is rejected by refresh* | 6.1 |
| **PR-14** | **Warehouse schema disclosure to any authenticated user** via five ungated `GET`-by-id routes, through Phases 2–5 — while Phase 2 ships the UI that surfaces the ids | **Certain** under v1.0 | High | `folders.ts:196`, `items.ts:175`, `items.ts:531`, `joins.ts:151`, `hierarchies.ts:142` | Entity scoping moved to **1.2**; the middleware already exists and is exported. Five call sites | 6.2 → **1.2** |
| **PR-15** | **RESIDUAL — a compromised admin owns the data model.** `sqlPredicate` is raw SQL spliced into every WHERE. Harmless while RLS is inert; **6.3 makes it the load-bearing control** | Low | High | `where-clause.ts:247-294`; `routes/security.ts` admin-gated | 6.3 adds write-time validation (reject comments, reject bracket escapes) and documents **admin as the RLS trust boundary** — which the plan states nowhere today | 6.3 |
| **PR-16** | **RESIDUAL — a scheduled export delivers unfiltered data on a timer.** 7.3 asserts only *"export matches on-screen rows"*, which passes if both are equally unfiltered | Low-Medium | High | 7.3 acceptance; RLS suite gaps | Added to the **RLS conformance suite**: *an export carries the same predicates as the on-screen query*, with two users and one policy | 1.1, 7.2, 7.3 |

---

## C. Verification — the risks that let a failure look like success

| ID | Risk | Prob | Impact | Evidence | Mitigation | Phase |
| -- | ---- | ---- | ------ | -------- | ---------- | ----- |
| **PR-20** | **The formula gates cannot run.** 4.2's `≥93 %` and 4.3's `≥99 %` compare against a corpus the codebase forbids committing, created three phases after it is first consumed | **High** | **Critical** — the two largest quality gates in the plan become local and unreproducible | `d4wkdmp-differ.test.ts:18-19`; `git ls-files` empty; 0.1 gitignores the dumps | New Decision Register entry **D-114** settled in Phase 0; **anonymised corpus** recommended; **fixture creation moved to Phase 0.5** | **0.5** → 1.3, 4.x |
| **PR-21** | **The 3.3 rewrite breaks something silently.** `backend/src/lib/sql/` has no dedicated tests; the emitter is covered only through one hand-built fixture | Medium-High | High | no test files under `lib/sql/`; `sql-generator.test.ts:285-295` | **Characterisation tests added to 3.2, before the rewrite** — short-circuit, BFS, disconnection refusal, null-endpoint drop | 3.2 |
| **PR-22** | **RESIDUAL — Phase 1's defining gate is a manual step.** *"Executes against the live Oracle"* cannot run in CI; no Oracle service exists anywhere | **Certain** | Medium | `ci.yml` provisions postgres + redis only | Criterion marked **MANUAL**, and required to leave evidence: map id, generated SQL, row count, timestamp, in the checkpoint | 1.1, 3.4, 9.1 |
| **PR-23** | **`scoreReadiness` cannot be fixed as described.** It takes `(eul, orphans, warnings)` — all source-side. *"Inspect its own output"* requires a signature change | High | Medium | `assessment.ts:571`; `assessment.test.ts:284-312` | 1.3 states it explicitly: the verifier becomes the gate, `scoreReadiness` demoted to a source-side pre-check | 1.3 |
| **PR-24** | **RESIDUAL — coverage is unmeasured.** No `coverageThreshold` in any workspace; CI never passes `--coverage`; the committed artefact is a stale local run | Certain | Low-Medium | all three configs; `ci.yml:73,99,125` | `--coverage` added to CI, **branch** thresholds set at the measured baseline (56.1 %) and ratcheted per phase, committed `coverage/` deleted | 1.3 → onward |

---

## D. Usability and delivery

| ID | Risk | Prob | Impact | Evidence | Mitigation | Phase |
| -- | ---- | ---- | ------ | -------- | ---------- | ----- |
| **PR-30** | **The delivered product excludes keyboard-only users from its core task.** Adding a field is drag-only; `axe` cannot detect it, so the a11y gate passes | **Certain** (present now, in no phase) | **Critical** for enterprise procurement | `BusinessAreaTree.tsx:346-373` | New stage **2.4**; gate is a Playwright spec that builds a map **using only the keyboard** | **2.4** |
| **PR-31** | **Users build queries the system then refuses.** The builder guards only `cross-business-area`; no validate or preview before Run. Compounds with PR-01 — if all joins fan, refusal is the common case | High | High | `store/mapBuilder.ts:338-347,199` | 3.3 exposes the planner as a **validate-only** call; the builder surfaces refusals inline, naming the rule | 3.3 |
| **PR-32** | **A scheduled workbook that used to run starts failing overnight, unattended.** Refusals are a UI state; a schedule has no UI when it runs | Medium-High | High | 7.2 acceptance; D-035's 282 `COUNT DISTINCT` totals | 7.2 runs a **pre-flight planner pass at import**; refusing schedules import `DISABLED` with the reason. Model raised to Opus | 7.2 |
| **PR-33** | **Silent route failures.** No `ErrorBoundary` anywhere, and every route is `<Suspense fallback={null}>` — a slow or failed chunk load shows *nothing at all* | Medium | High | `App.tsx:67`; grep for `ErrorBoundary` → empty | 2.2 gains the boundary **and** a route skeleton; gate: *a forced chunk-load failure renders a retry, not a blank page* | 2.2 |
| **PR-34** | **A Portuguese user drops into English on exactly the failures that matter.** `getErrorMessage`'s fallback is a hard-coded literal across 28 files; locale parity cannot catch it | **Certain** | Medium | `lib/api.ts:54` | 2.2: required translated fallback; §9 gains a lint for user-facing literals outside `t()` | 2.2 |

---

## E. Programme and execution

| ID | Risk | Prob | Impact | Evidence | Mitigation | Phase |
| -- | ---- | ---- | ------ | -------- | ---------- | ----- |
| **PR-40** | **RESIDUAL — Phase 0.3 cannot reach the live EUL**, and Phase 3 has no foundation | Low-Medium | **Critical** — Phase 3 cannot start | Plan 0.3's own stated risk | Escalate immediately; do not proceed on assumption. PR-01's manual-collection fallback is the only path that does not require the probe | 0.3 |
| **PR-41** | **Irreversible loss in the first commit.** 74 untracked paths **and 2 705 staged deletions**, no remote, and `CLAUDE.md` still describes `.claude/skills/` as a live asset while the manifest says delete | Medium | High | `git status --porcelain`; `CLAUDE.md` vs manifest | 0.1 **split into two commits**: additions first (durability is not blocked on a policy question), then the `.claude/` deletion with the `CLAUDE.md` correction in the same commit | 0.1 |
| **PR-42** | **A session switches model mid-stage**, discarding the prompt cache and re-billing at write price — because three stages instruct exactly that | **Certain** under v1.0 | Medium | plan `:329,:519,:866`; three prompts | Each split into two single-model stages. New §10 rule: **no stage may name two models** | 2.1, 5.3, 7.1 |
| **PR-43** | **An agent dispatch burns six figures of tokens and returns nothing** | Medium | Medium | This session: 117 739 tokens, zero output, on the least-constrained brief | D-005 restated as the measured pattern — file list, closed questions, output table, tool budget, *"return the table even if unfinished"*. Without all five, do it inline | all |
| **PR-44** | **A data-heavy stage pipes its corpus through context and cannot finish.** 37 971 pairs, 49 819 formulas, 923-map reconciliation — four stages name `context-mode` but none says *how* | Medium-High | Medium | 4.1, 4.5, 9.1, 1.3 | One line added to each: *never read the corpus into context; script it, emit only aggregates and a file path* | 1.3, 4.1, 4.5, 9.1 |
| **PR-45** | **A 5-hour limit lands mid-stage and the checkpoint still says "not started."** Worst in 1.1, where a partial commit is explicitly worse than none | **High** | Medium | This review was itself interrupted this way | Every prompt's execution block gains: *checkpoint on progress, not only on completion* — one line per discrete change. 1.1 records which of its five changes are written | all |
| **PR-46** | **Facts drift between three documents that each restate them.** Confirmed four times already: 272/341, 5 605/3 395, 18/17, and the model contradictions | **Certain** (already happened) | Medium | `MASTER_PLAN_REVIEW.md` R-10, F-05, R-19 | Single-home rule: decisions → register; scope, gates and counts → prompts; ordering and narrative → plan. §11 matrix keeps only phase, stage, dependency, model | all |
| **PR-47** | **RESIDUAL — an incremental re-import corrupts a map a user is editing.** No lock, no policy; `importFromOracle` gets a transaction only in 8.3 | Low-Medium | High | D-079; BE-08 | 9.2 gains a **migration lock** and a stated policy — re-import is offline-only, consistent with D-078's fresh-database posture | 9.2 |

---

## Top five, ranked by expected loss

1. **PR-01** — the join flags may not exist. Gates all of Phase 3 and has no branch in v1.0.
2. **PR-10 / PR-11 / PR-12** — three routes to serving rows a user is not entitled to, one of
   which v1.0 instructs a session to preserve.
3. **PR-20** — the two largest quality gates in the plan cannot run.
4. **PR-03 / PR-04** — the guard ships inert, and the gate designed to detect that cannot.
5. **PR-30** — the delivered product cannot be operated by keyboard alone.
