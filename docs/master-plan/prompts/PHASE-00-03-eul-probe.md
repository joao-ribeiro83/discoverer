# PHASE 0.3 — The read-only EUL probe

**Model:** Opus · **Effort:** high

## Purpose

Answer the open questions that gate Phase 3 entirely.

**THREE artefacts in this repository disagree about which end of a join is the master** - not
two. The third is the designated authority and is internally ambiguous:

| Artefact | Says `KEY_OBJ_ID` is |
| -------- | -------------------- |
| `eul-schema-adapter.ts:129` | **master** (`mapsTo: 'masterFolderId'`) |
| `AUDIT_DETAILED_FINDINGS.md:891-892` | **detail** |
| `EUL_SCHEMA_GROUND_TRUTH.md:165` | *"the **parent/detail** folder"* - **two opposed roles in one phrase**, in a section headed *"[GUIDE; columns need live confirmation]"* |

Orientation decides which side is pushed into the fan-trap inline view, so an inversion produces
**correct-looking wrong numbers rather than an error**.

**A larger question sits behind it.** The four join cardinality flags have **never been read from
this estate**. `legacy-analysis.md:112` - *"Which EUL4 column carries `OneToOne`: UNKNOWN... its
flag columns are not attested offline."* They are attested only in `EUL.dtd:191-201`, which is
the **EEX export DTD, not the database schema**. If they do not exist, D-033 makes every join
FANNING permanently and Phase 3 becomes a refusal machine. **Q2 must be able to return "they are
not there."**

## Scope

Read-only queries against the live EUL. **No writes. No migration run. No schema change except
the one-line orientation fix if Q1 demands it.**

**Run them in this order - Q0 supplies Q1's columns.**

| Q | Query | Settles |
| - | ----- | ------- |
| **Q0** | `SELECT * FROM eul4_expressions WHERE exp_type='JP'` | The predicate columns. **A confirmation, not an open question:** `EUL_SCHEMA_GROUND_TRUTH.md:272-274` already records the live distribution as `CO` 6 967, `CI` 2 830, **`JP` 10** - one row per join. So either every join is single-column, or a multi-column predicate is encoded inside one row. **Inspect the column structure and say which.** |
| **Q1** | **A CARDINALITY PROBE.** For each of the 10 joins, resolve both folders to their underlying tables and, using Q0's predicate columns, run per side: `SELECT COUNT(*) AS rows, COUNT(DISTINCT <join column>) AS keys FROM <table>`. **The side where `keys < rows` is the DETAIL.** | **D-040 - by measurement** |
| **Q2** | **Two parts, in order.** (a) *Does `EUL4_KEY_CONS` carry **any** cardinality or outer-join flag column?* `ALL_TAB_COLUMNS` + `SELECT *` on 10 rows. (b) **If not, probe `EUL4_IHS_FK_LINKS` and `EUL4_OBJ_JOIN_USGS` as well** - `EUL_SCHEMA_GROUND_TRUTH.md:170` names both as carrying join usage and keys. **Report absence explicitly if that is the answer.** | **D-110**, including the "not there" outcome |
| Q3 | `ALL_TAB_COLUMNS` for `EUL4_EXPRESSIONS`, then a `GROUP BY` on each candidate column | **D-111** - which column carries the default aggregate |
| **Q4** | **Read `HIERARCHIES.HI_SYS_GENERATED` first.** `EUL_SCHEMA_GROUND_TRUTH.md:282-284` confirms the column exists - it likely answers this **directly**, and more reliably than a naming pattern. Fall back to the naming `GROUP BY` over the `IBH` rows only if it does not | **D-112** |
| Q5 | `ALL_TAB_COLUMNS` for `EUL4_QPP_STATS` | **D-113** - does it record returned **row counts**? |

## Prerequisites

Phase 0.1a. The live Oracle EUL must be reachable.

**If it is not reachable, stop and escalate immediately.** Phase 3 cannot start without Q1 and
Q2, and proceeding on assumption is how an inverted orientation reaches production as
correct-looking wrong numbers. Do not substitute inference for the probe.

## Required files to read first

- `docs/master-plan/research/legacy-analysis.md` §2.2 (the orientation question and its exact
  SQL), §2.3 (the four flags), §3.2, §4.3 — **the authoritative brief**
- `docs/master-plan/DECISION_REGISTER.md` — Open decisions table
- `discoverer-neo/migrate/src/services/eul-schema-adapter.ts:120-145`
- `discoverer-neo/migrate/EUL_SCHEMA_GROUND_TRUTH.md`

**Poisoned sources — never read for facts:** `oracle_discoverer_complete_reference.md` §8 and
`EUL_VERSION_REFERENCE.md`. Both contain fabricated table and column names.

## Required tooling

**Skills:** none. **Agents:** none.
**Plugins / MCPs:** `context-mode` — essential. `ALL_TAB_COLUMNS` output is large; process it
in the sandbox and surface only the answer.

## Implementation instructions

- Connect through the existing Oracle data source. Thick mode is **mandatory** — the pre-11g
  password verifier means thin mode cannot authenticate.
- Reuse `backend/src/scripts/dump-eul-columns.ts` and `dump-eul-functions.ts` rather than
  writing new tooling.
- **Q1 must be a measurement, not an inference.** The v1.0 version of this probe returned folder
  **names**, and asked you to judge which side sounds like "lines" and which sounds like
  "header". That is the **same kind of evidence** the current `[INFER]` belief already rests on
  (`legacy-analysis.md:396` - *"dump naming + FK semantics"*), so it settles nothing at the
  confidence this decision needs. **Count the keys.** The many side is the detail; that is
  arithmetic, not judgement.

  Run the name query too, and record it - as a **cross-check** on the measurement, not as the
  answer. Per `legacy-analysis.md` 2.2 the expected shape is `key_obj` = `M M27 1`,
  `remote_obj` = `M M27`, which would make `KEY_OBJ_ID` the DETAIL and
  `eul-schema-adapter.ts:129-130` **inverted**. If measurement and naming disagree, **the
  measurement wins, and the disagreement is itself a finding to record.**

- **Q2 has a branch, and you must take it before leaving this stage.** If no flag columns exist
  in `KEY_CONS`, `IHS_FK_LINKS` or `OBJ_JOIN_USGS`:

  > D-033 says an unknown or absent flag means **FANNING**. With no flags anywhere, **all 10
  > joins fan permanently**, and Phase 3's guard - combined with the single-branch master-measure
  > check (D-034) - refuses most multi-folder aggregates in the estate. The product ships as a
  > refusal machine, and **Phase 3.4's gate would not detect it**: an estate where everything
  > refuses satisfies `REFUSE > 0` perfectly.
  >
  > **Apply D-118.** The default is to collect the four flags for the 10 joins **by hand from a
  > live Discoverer Administrator**, recorded as a MANUAL cutover item - ten joins makes this
  > realistic. The fallback, if no SME is available, is that Phase 1.1's multi-folder aggregate
  > refusal becomes **permanent** and Phase 3.3 is descoped to the single-branch case.
  >
  > **Escalate to the user. This is a scope decision, not an engineering one.**

- **Q3: probe, never guess.** Read the column list, then `GROUP BY` each candidate to see
  which holds `SUM`/`AVG`/`COUNT`/`MIN`/`MAX`/`DETAIL`-shaped values. If none does, record
  **UNKNOWN** — the axis/measure split comes from the parser anyway (D-031).
- Record the **raw output** of each query, not just your conclusion. A future session must be
  able to re-derive the verdict.

## Tests

If Q1's cardinality measurement confirms the inversion, fix `eul-schema-adapter.ts:129-130`
**and add a regression test asserting the orientation**, using the observed folder names *and the
measured key counts* as the fixture - so a future session sees the evidence, not just the
conclusion.

## Security checks

- **Read-only.** No `INSERT`, `UPDATE`, `DELETE`, or DDL against the EUL. This is a live
  customer production database.
- Do not write EUL contents containing business data into a committed file. Record structure
  and counts; redact sample values where they are customer data.

## Validation

Each of the six questions has an answer, or an explicit **UNKNOWN** with the reason it could
not be settled.

## Acceptance criteria

- [ ] All five questions answered from live data, or recorded as unanswerable with a reason
- [ ] `docs/master-plan/research/eul-probe-results.md` exists with raw output and a verdict
      each
- [ ] **`DECISION_REGISTER.md` updated** — D-040 and D-110–D-113 move from `OPEN` to `FIXED`
- [ ] **`eul-schema-adapter.ts`'s master/detail orientation is proven correct, or corrected
      with a regression test**
- [ ] The `JP` predicate shape is recorded — one row per join, or *n* rows for *n* columns

## Documentation updates

- `discoverer-neo/migrate/EUL_SCHEMA_GROUND_TRUTH.md` — add every column name confirmed here.
  This is the repository's only trustworthy EUL reference; extending it is durable value.

## Git checkpoint

One commit for the results document and the register update; a second for the adapter fix and
its test, if needed.

## Handover artefacts

- `docs/master-plan/research/eul-probe-results.md`
- An updated `DECISION_REGISTER.md`
- An extended `EUL_SCHEMA_GROUND_TRUTH.md`

## Explicitly out of scope

- **Any implementation of the fan-trap guard.** That is Phase 3.
- Schema changes to `joins` or `join_predicates` — Phase 3.2.
- Re-running the migration.
- The nine legacy questions needing a live Discoverer 4.1 Plus or an SME
  (`legacy-analysis.md`, Open list #4–8, #11–14). Record them as still open.

## Resume instructions

Read the checkpoint, then `docs/master-plan/research/eul-probe-results.md` if it exists. Each
answered question is done; resume at the first unanswered one.

## TOKEN-BUDGET SAFE EXECUTION

1. One question at a time. Write its answer to the results file **before** starting the next.
2. **No specialist agents.** These are six SQL queries.
3. Use `context-mode` for every query — `ALL_TAB_COLUMNS` output must not enter context.
4. Checkpoint after each answer.
5. Commit the results file incrementally.
6. If the EUL is unreachable, **stop and escalate.** Do not proceed on assumption — Phase 3
   cannot start without Q1, and guessing produces silently wrong money.
7. If interrupted, the results file must say which questions remain.
