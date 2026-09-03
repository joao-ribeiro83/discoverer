# Review B — Legacy / Migration Challenge

**Method:** inline, against `EUL_SCHEMA_GROUND_TRUTH.md` (the repository's designated authority
per `CLAUDE.md`), `docs/master-plan/research/legacy-analysis.md`, Oracle's shipped SQL in
`discoverer10g/sql/`, and the working tree. Broad agents were not dispatched — Review A
established they do not return on this repository.

**The finding that matters most:** Phase 3's entire programme rests on four EUL columns that
**nobody has ever seen**, and the plan has no branch for the answer "they are not there."

---

## B-01 · The four join flags may not exist as columns, and the plan has no branch for that

- **Severity:** CRITICAL
- **Phase/Stage:** 0.3 Q2 · 3.2 · 3.3 · 3.4 · D-033 · D-110
- **Type:** MISSING (an unhandled branch, not a wrong fact)

**Finding.** D-110 asks *"**Which** `EUL4_KEY_CONS` columns carry `OneToOne`,
`AllowDetailNoMaster`, `AllowMasterNoDetail`, `Mandatory`?"* The question presupposes they
exist. The plan's own research says otherwise, in plain terms:

> `research/legacy-analysis.md:112` — *"**Which EUL4 column carries `OneToOne`: UNKNOWN.** …
> its flag columns are **not attested offline** … so the four flags have **never been read from
> this estate**."*

And the repository's authoritative schema document lists **four** real `KEY_CONS` columns and no
flags at all:

> `discoverer-neo/migrate/EUL_SCHEMA_GROUND_TRUTH.md:161-172` — `KEY_OBJ_ID`,
> `FK_OBJ_ID_REMOTE`, `KEY_DESCRIPTION`, `KEY_ID` **[?]**. Section header:
> **"[GUIDE; columns need live confirmation]"**. Probed optional columns (`:258`) are only
> `KEY_ID`, `KEY_NAME`, `KEY_TYPE`.

The flags are attested only in `discoverer10g/sql/EUL.dtd:191-201` — which is the **EEX export
DTD**, not the database schema. An attribute that exists in the export format is not evidence
of a column in `EUL4_KEY_CONS`.

**What happens if 0.3 Q2 returns "not present".** D-033 and §1.11 step 3 both say *"Unknown or
absent flag ⇒ FANNING."* Then **all 10 joins in the estate are FANNING**, unconditionally and
permanently. Combine that with §1.11 step 5a (D-034's single-branch master-side measure check)
and the guard fires on essentially every multi-folder aggregate query in the estate. The
product ships as a refusal machine.

**And Phase 3.4's gate would still pass.** Its acceptance is `REFUSE > 0 && FLAT < 923`
(D-037). An estate where *everything* refuses satisfies that inequality perfectly. The gate
designed to prove the guard is live cannot distinguish "the guard works" from "the guard has
no cardinality data and refuses everything."

**Recommendation.**
1. **Rewrite D-110 as a yes/no question first:** *"Does `EUL4_KEY_CONS` carry any cardinality
   or outer-join flag column at all?"* Then, only if yes, "which".
2. **Add the fallback search to Phase 0.3 Q2's scope.** If the columns are absent, the flags
   must live somewhere: `EUL4_IHS_FK_LINKS` and `EUL4_OBJ_JOIN_USGS` are named in
   `EUL_SCHEMA_GROUND_TRUTH.md:170` as carrying join usage/keys, and the `.DIS` container
   records join usage at tag `0x0127`. Probe `ALL_TAB_COLUMNS` for all three, not just
   `KEY_CONS`.
3. **Add an explicit decision point to the plan between 0.3 and 3.2**, with both outcomes
   written down now:
   - *Flags found* → proceed as planned.
   - *Flags absent* → **the fan-trap guard has no input.** The honest options are (a) keep the
     interim refusal from 1.1 permanently for multi-folder aggregates, (b) derive cardinality
     by measuring the source data once at migration time and storing it as a **declared,
     dated, reviewable** value — explicitly not the live-statistics approach
     `legacy-analysis.md:1031` rules out — or (c) collect the flags by hand from a live
     Discoverer Administrator over 10 joins, which is a MANUAL cutover item.
     **Ten joins is small enough that (c) is realistic and should be the default.**
4. **Fix D-037's gate** (see B-03).

---

## B-02 · Phase 0.3's Q1 cannot settle D-040

- **Severity:** HIGH
- **Phase/Stage:** 0.3 Q1 · D-040
- **Type:** INCORRECT (the probe does not answer its question)

**Finding.** D-040 is the gating decision for all of Phase 3 — an inversion yields
*correct-looking wrong numbers*. The probe designed to settle it is
`research/legacy-analysis.md:404-412`, reproduced in the Phase 0.3 prompt:

```sql
SELECT k.key_id, k.key_name,
       d.obj_name AS key_obj,      -- KEY_OBJ_ID side
       m.obj_name AS remote_obj    -- FK_OBJ_ID_REMOTE side
FROM eul4_key_cons k
     JOIN eul4_objs d ON d.obj_id = k.key_obj_id
     JOIN eul4_objs m ON m.obj_id = k.fk_obj_id_remote;
```

This returns **folder names**. The current belief is graded `[INFER]` from *"dump naming + FK
semantics"* (`legacy-analysis.md:396`). The query therefore returns **more evidence of exactly
the kind already in hand** — naming — and settles nothing that was not already settled to the
same confidence. A reviewer would still be reading `M M67 1` against `M M67` and judging which
sounds like lines and which sounds like header.

**Worse, the evidence base is weaker than D-040 states.** D-040 says *"two artefacts in this
repository disagree."* There are **three**, and the third is the designated authority and is
internally ambiguous:

| Artefact | Says `KEY_OBJ_ID` is |
| -------- | -------------------- |
| `eul-schema-adapter.ts:129` | **master** (`mapsTo: 'masterFolderId'`) — verified |
| `AUDIT_DETAILED_FINDINGS.md:891-892` | **detail** |
| `EUL_SCHEMA_GROUND_TRUTH.md:165` | *"the **parent/detail** folder"* — **two opposed roles in one phrase**, in a section tagged *"columns need live confirmation"* |

**Recommendation.** Replace Q1 with a **cardinality probe**, which is decisive and independent
of naming and of FK convention. For each of the 10 joins, resolve both folders to their
underlying tables and columns, then compare key uniqueness:

```sql
-- per join, for each side:
SELECT COUNT(*) AS rows, COUNT(DISTINCT <join column>) AS distinct_keys
FROM   <folder's underlying table>;
```

The side where `distinct_keys < rows` is the **detail** (many). The side where
`distinct_keys = rows` is the **master** (one). This is a measurement, not an inference, and it
is the same 10 joins. Keep the name query as a **sanity cross-check**, not as the answer.

Note this probe needs the join *predicate* columns, which come from `EXPRESSIONS.EXP_TYPE='JP'`
— already in 0.3's scope as a supplementary query. **Promote it from supplementary to
required**, and run it before Q1.

---

## B-03 · D-037's histogram cannot distinguish the guard from the pre-existing failure

- **Severity:** HIGH
- **Phase/Stage:** 3.4 · D-037 · D-039
- **Type:** INCORRECT

**Finding.** §1.11 step 1 keeps Neo's existing disconnection refusal:

> *"If G is disconnected: refuse — 'No join path connects <folders>'. (Pre-existing Neo
> behaviour; **271 of 341 multi-folder maps in this estate hit this today**.) **Keep it.**"*

And §1.11 step 10 requires every query to record *"FLAT, REWRITE(n), or REFUSE(R1|R2|R3|R4|
REAGG)"* — note that this enumeration **omits the disconnection refusal**, which is the one that
fires 271 times today.

Phase 3.4's gate is `REFUSE > 0 && FLAT < 923`. If Phase 3.2's predicate work does not repair
every disconnected graph, those 271 maps keep refusing for the **old** reason, `REFUSE` is
comfortably `> 0`, `FLAT` is comfortably `< 923`, and the gate passes **with the fan-trap guard
never having fired once**. That is precisely the failure mode D-037 was written to prevent —
*"a guard that never fires is indistinguishable from one that is not wired in"* — reproduced
inside the mechanism meant to prevent it.

**Recommendation.** Make the histogram **per-rule, not per-outcome**, and gate on the rules that
matter:

```
FLAT · REWRITE(n) · REFUSE(DISCONNECTED) · REFUSE(NO_PREDICATE) ·
REFUSE(R1) · REFUSE(R2) · REFUSE(R3) · REFUSE(R4) · REFUSE(REAGG)
```

Restate 3.4's acceptance as **three** assertions:
- `REWRITE(n) > 0` — the rewrite path is reachable at all. *This is the assertion the current
  gate is missing, and it is the important one.*
- `REFUSE(DISCONNECTED)` has **fallen** against the baseline 3.2 recorded — otherwise 3.2 did
  not fix what it claimed.
- At least one fan-trap rule (`R1`–`R4`, `REAGG`, or the 5a single-branch case) fired, **or**
  the run explicitly records that no map in the estate meets the trigger condition.

Add `REFUSE(DISCONNECTED)` and `REFUSE(NO_PREDICATE)` to §1.11 step 10's enumeration.

---

## B-04 · "272 multi-folder maps" and "24 sheets declare joins" are not reconciled

- **Severity:** MEDIUM
- **Phase/Stage:** 1.1 · 3.4
- **Type:** UNVERIFIABLE / MISSING

**Finding.** The plan expects *"~651 single-folder maps generate SQL; ~272 multi-folder maps
refuse"* (1.1 acceptance). But the workbook container records join usage on only **24**
worksheets:

> `EUL_SCHEMA_GROUND_TRUTH.md:1019` — tag `0x0127` *"Joins — Join Usage, pointing at `0x0118`"*
> — confidence **[DUMP] 24 / 0**.

So ~272 maps span more than one folder while only 24 declare a join. The other ~248 are
multi-folder **by item spread**, with no declared join path — which is exactly the population
that hits the disconnection refusal (271, per §1.11 step 1; the arithmetic lines up closely).

This matters because it changes what Phase 3.2 can achieve. Adding `join_predicates` to the 10
existing joins does **not** connect a map whose folders were never joined in Discoverer either.
Those maps were presumably run in Discoverer as separate sheets, or they use folders reachable
through joins the workbook does not name.

**Recommendation.** Add to Phase 3.2's deliverables a **reconciliation of the three counts**:
maps spanning >1 folder, maps whose folder set is connected by the 10 known joins, and maps
declaring join usage in the container. Record it in the checkpoint before 3.3 starts. Phase
3.4's expected histogram should be predicted from that reconciliation, not from `923 − 651`.

---

## B-05 · Phase 5.1 is not "one fix" — hierarchy binding is a four-hop chain

- **Severity:** MEDIUM
- **Phase/Stage:** 5.1 · D-073
- **Type:** UNDER-ENGINEERING

**Finding.** D-073 and Phase 5.1 say *"**One fix** — EUL4 binds via `EUL4_BA_OBJ_LINKS`, not a
column — recovers **both** hierarchies (508 → 0) and grants (138 → 60)."* The ground truth
gives the actual hierarchy path, and it is not one hop:

> `EUL_SCHEMA_GROUND_TRUTH.md:281-288` — *"**`HIERARCHIES.BA_ID` does not exist.** … the live
> EUL4 `HIERARCHIES` has `HI_ID, HI_TYPE, HI_NAME, HI_DEVELOPER_KEY, HI_DESCRIPTION,
> HI_SYS_GENERATED, HI_EXT_HIERARCHY, DBH_DEFAULT, IBH_DBH_ID` plus audit columns — and **no
> business-area column**. … The link runs hierarchy → `HI_NODES` → `IG_EXP_LINKS`
> (`IEL_TYPE = 'HIL'`, `HIL_HN_ID` → `HIL_EXP_ID`) → `EXPRESSIONS.IT_OBJ_ID` →
> `BA_OBJ_LINKS`.*"

That is four joins through three tables the migration does not currently read for this purpose,
and a hierarchy spanning items in two business areas has no defined answer. Grants, by
contrast, genuinely are a `BA_OBJ_LINKS` fix. Bundling them as "one fix" understates 5.1 and
risks a session declaring it done when only grants recovered.

**Two useful facts the plan should carry into 5.1:** `HI_SYS_GENERATED` is a column on
`HIERARCHIES`, which likely answers D-112 (how many of the 502 `IBH` are date-template
boilerplate) **directly** — cheaper and more reliable than the naming-pattern `GROUP BY` that
0.3 Q4 proposes. And `DBH_DEFAULT` / `IBH_DBH_ID` name the date-hierarchy relationship D-074
depends on.

**Recommendation.** Split 5.1 into **5.1a grants** (the genuine one-line `BA_OBJ_LINKS` fix,
with the 138 → 60 reconciliation as its gate) and **5.1b hierarchies** (the four-hop resolver,
with a stated rule for multi-BA hierarchies). Change 0.3 Q4 to read `HI_SYS_GENERATED` first
and fall back to the naming pattern.

---

## B-06 · The 0.3 probe budget is partly spent on questions the repository already answers

- **Severity:** LOW
- **Phase/Stage:** 0.3
- **Type:** OVER-ENGINEERING

**Finding.** 0.3's supplementary query asks *"whether multi-column joins are one row or n"* in
`EUL4_EXPRESSIONS WHERE EXP_TYPE='JP'`. The ground truth already reports the live distribution:

> `EUL_SCHEMA_GROUND_TRUTH.md:272-274` — *"`EXP_TYPE` holds only `CO` (6 967 rows), `CI`
> (2 830) and **`JP` (10, a join predicate)**."*

Ten `JP` rows for ten joins is **one row per join**. Either every join in this estate is
single-column, or a multi-column predicate is encoded inside one row. Both readings make the
`join_predicates` table a `1..n` model with `n = 1` throughout this estate — worth knowing
before 3.2 designs against a multi-row assumption.

The same section also settles a question the plan does not ask but 5.3 depends on: **worksheet
conditions are not `EXPRESSIONS` rows at all** — they live in the workbook body. Phase 5.3's
condition work therefore has no EUL-side source to reconcile against, only the parser.

**Recommendation.** Restate the supplementary query as a **confirmation** ("confirm 10 `JP`
rows, inspect their column structure") rather than an open question, and spend the freed probe
budget on B-01's fallback search across `IHS_FK_LINKS` and `OBJ_JOIN_USGS`.

---

## B-07 · "Crosstab absent in source" should cite its evidence, or a future estate is blocked

- **Severity:** LOW
- **Phase/Stage:** §4 compatibility matrix · D-002 · 7.3
- **Type:** INFORMATIONAL

**Finding.** D-002 rejects the crosstab "loss" finding because *"`crosstabs: 0` is true of this
estate"*, and the matrix places crosstab axis edge under **UNSUPPORTED — ABSENT IN SOURCE**.
The container does distinguish the two layouts:

> `EUL_SCHEMA_GROUND_TRUTH.md:1006` — `0x01f8 → [0x0384] table | [0x0385] crosstab`

So the claim is sound and *measurable*: every worksheet in this estate carries `0x0384`. But
the plan records the conclusion without the tag, and D-002 says findings there *"must not be
funded."* A future estate containing `0x0385` worksheets would meet a rejected finding and a
rule against reopening it.

**Recommendation.** One line in the matrix: *"Evidence: container tag `0x01f8`; all 923
worksheets are `0x0384` (table). An estate containing `0x0385` reopens this."* This is what
D-002's own "new evidence" escape clause needs in order to be usable.

---

## Verified correct

- **D-031 / §1.11's "the axis/measure split is given, not inferred" — fully verified.**
  `workbook-parser.ts:2705-2706` reads `axisItemRefs` and `measureItemRefs` from
  `TAG.QUERY_AXIS_ITEMS` / `TAG.QUERY_MEASURE_ITEMS`, and
  `EUL_SCHEMA_GROUND_TRUTH.md:1016-1017` grades tags `0x0123`/`0x0124` **[DUMP]** at 872/2 and
  856/2 agreement against Oracle's own decoder. The two disagreements are the same known
  workbook (`GD_M.M65_V13`). **D-031's ordering ahead of the guard is correct and well
  evidenced.**
- **§1.11 is genuinely a coded decision procedure**, not research. Steps 0–10 are implementable
  as written, with inputs, refusal rules and a re-aggregation table.
- **D-034's single-branch case is arithmetically forced**, correctly graded `[INFER]`, and
  correctly noted as *wider* than Oracle's documented two-detail case.
- **D-035's re-aggregation table** (`SUM→SUM`, `COUNT→SUM`, `MIN→MIN`, `MAX→MAX`; refuse `AVG`,
  `COUNT DISTINCT`, `STDDEV`, `VARIANCE`) matches §1.11 step 8 exactly.
- **D-032's "four flags cannot fit a 4-value enum"** — verified; `joins.joinType` is a single
  `joinTypeEnum`, `NOT NULL`, at `backend/src/db/schema.ts`.
- **`KEY_TYPE` defaults to `INNER` when absent** — verified at `eul-schema-adapter.ts:134-135`
  (`JOIN_OPTIONAL_COLUMNS = ['KEY_ID','KEY_NAME','KEY_TYPE']`). *"All 10 joins are INNER"* is
  indeed a default, not a reading.
- **D-077 — do not build a reader against `EUL4_ASM_POLICIES`.** Sound, and independently
  supported: the ground truth's live column inventory shows no policy content there.
- **The depth statistics behind D-072/5.3** — `legacy-analysis.md:906-912`: depth 0 = 92.6 %,
  depth 2 = seven instances, nothing deeper in 558 workbooks. *"The `negated` boolean covers
  the entire measured corpus"* is a fair reading, and the observation that the seven depth-2
  `OR`-of-`AND` conditions are exactly the RLS shape is a genuinely good catch.
- **D-076 — summaries are Oracle materialised views under query rewrite.** Consistent with
  `eulasm.sql`.
- **The joins-bind-folders fact** — `EUL_SCHEMA_GROUND_TRUTH.md:172`: *"note joins bind **folder
  to folder**, not item to item."* This corroborates Review A's **A-05**: Neo's schema already
  has NOT NULL folder endpoints, so 3.2's work is the predicate, not the shape.
