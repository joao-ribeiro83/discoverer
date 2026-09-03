**The `Write` tool is disabled in this session, so I could not create `E:\claude\discoverer\docs\master-plan\research\legacy-analysis.md`.** Per the read-only boundary, I'm returning the specification as output for you to write to that path. Summary first, then the document.

## Summary (top findings)

1. **Cardinality was declared, not measured.** `ForeignKey/@OneToOne` in `discoverer10g\sql\EUL.dtd:191-201` is the fan-trap input, and Oracle states its *only* effect is fan-trap detection. Default `False` = one-to-many. **Every join is dangerous unless flagged otherwise.** `EUL4_OBJ_JOIN_USGS` is ruled out — it is complex-folder join *usage* (`EUL.dtd:143,153-157`).
2. **The rewrite is fully documented, with SQL.** One inline view per master–detail branch, GROUP BY pushed below the branch join, detail side outer-joined, branches joined on the master key, outer query re-aggregating. Verbatim in 9.0.4/10.1.2/10.1.2.1/11.1.1. Four refusal conditions, verbatim. §1.11 is a coded decision procedure.
3. **A repo-internal contradiction blocks all of it.** `eul-schema-adapter.ts:129-130` maps `KEY_OBJ_ID→master`; `AUDIT_DETAILED_FINDINGS.md:891` maps it `→detail`. Oracle's own `d4wkdmp` dumps (25 records in `d4dumps\`) plus FK semantics say the audit is right. Orientation decides which side enters the inline view — an inversion is silent and wrong. **Settle before coding §1.**
4. **`EUL4_ASM_POLICIES` is not row-level security.** `eulasm.sql:1-2` and `EUL.dtd:385-399` prove ASM = *Automated Summary Management*. Real 4.1 RLS was a mandatory condition comparing Oracle's `USER` (`9.0.4\B10270_01.pdf` pp. 11-15…11-19). Building an RLS reader against `ASM_POLICIES` yields a false sense of migrated security.
5. Also: `OBJ_TYPE` has a third value `CUO` (`Lineage.sql:333`); `EXP_TYPE='JP'` confirmed at 10 rows for 10 joins; summaries were already materialized views under `global query rewrite` in 4.1.

**Could not settle:** whether the rewrite decomposes `AVG`/`COUNT DISTINCT` (§1.9.1) — no vendor text, no surviving install. My recommendation is to **refuse** them across a fan rather than guess a decomposition. Five other gaps close with read-only `ALL_TAB_COLUMNS` queries listed in the footer.

---

# Oracle Discoverer 4.1 — Legacy Behavioural Specification

**Purpose.** What Discoverer 4.1 *does*, at implementation detail, for the Discoverer Neo Master Implementation Plan. Not an audit. Not a gap list. A specification of the legacy behaviour a replacement must reproduce, refuse, or deliberately replace.

**Estate under specification.** EUL4 (`EUL4_` prefix), Discoverer 4.1.11.0.0, schema `SIID_TESTES`, `PORTUGUESE_PORTUGAL.WE8ISO8859P1`. 7 business areas, 212 folders, 9 626 items, 10 joins, 508 hierarchies, 564 workbooks / 923 worksheets, 7 316 recorded query executions.

---

## 0. Evidence grades and sources

Every claim below carries one of five grades. **Do not implement an `[ASSUMED]` claim without settling it first.**

| Grade | Meaning |
| --- | --- |
| **[SQL]** | Proven from Oracle's own shipped SQL or DTD in `E:\claude\discoverer\discoverer10g\sql\`. Highest trust. |
| **[BINARY]** | Proven from Oracle's own shipped binaries in `E:\claude\discoverer\DISCVR4\` (DLL string tables, `d4wkdmp.exe` output). |
| **[DOC]** | Stated by an Oracle vendor manual. Behavioural, not structural — tells you what the product does, never what column it lives in. |
| **[INFER]** | Derived from the validated parser's behaviour over the live corpus, or from a correlation over the live EUL. Reproducible, not vendor-stated. |
| **[ASSUMED]** | A reading I could not close. Flagged as **UNKNOWN** with the evidence that would settle it. |

### 0.1 Primary sources actually used

| Source | Path | What it proves |
| --- | --- | --- |
| Discoverer 4.1 export DTD | `E:\claude\discoverer\discoverer10g\sql\EUL.dtd` | **The single most load-bearing file in this analysis.** Line 3 reads *"DTD file to define the syntax of Discoverer 4.1 export files"* — it is a 4.1 artefact, not a 10g one. It is Oracle's own declaration of the complete EUL object model and every semantic flag on it. |
| EUL4 table inventory | `E:\claude\discoverer\discoverer10g\sql\eul4del.sql:1-529` | The canonical, exhaustive EUL4 table list (63 objects). Every EUL4 table name in this document is `grep`-confirmed against it. |
| EUL PL/SQL helpers | `E:\claude\discoverer\discoverer10g\sql\Lineage.sql` | `EXP_TYPE` and `OBJ_TYPE` code values; the hierarchy tree walk, verbatim from Oracle. |
| ASM privilege script | `E:\claude\discoverer\discoverer10g\sql\eulasm.sql:1-25` | Explicitly *"…required for Summary Management (and ASM) in Discoverer Administration Edition 4.1"*. Proves 4.1 summaries are materialized views under `global query rewrite`. |
| `.DIS` decoder | `E:\claude\discoverer\discoverer-neo\migrate\src\services\workbook-parser.ts` | The worksheet-side model, validated against `d4wkdmp.exe` across 544 workbooks. |
| Schema ground truth | `E:\claude\discoverer\discoverer-neo\migrate\EUL_SCHEMA_GROUND_TRUTH.md` | Live-EUL column readings and the `.DIS` container spec. |
| Reference dumps | `E:\claude\discoverer\d4dumps\*.txt` (552 files) | Oracle's own `d4wkdmp.exe` output. Ground truth for what a worksheet contains. |
| Vendor manuals | `9.0.4\B10270_01.pdf`, `10.1.2\B13916-02.pdf`, `10.1.2.1\B13916-04.pdf`, `11.1.1\b32519.pdf`, `4.1\Discoverer4iPlusUserGuide.pdf`, `4.1\a87430.pdf` | User-facing behaviour. |

### 0.2 A provenance warning that matters for §1

**The Discoverer 4.1 *Administration Guide* is not in this repository.** `4.1\` holds only the *4i Configuration Guide* (`a87430.pdf`) and the *4i Plus User's Guide*. The complete fan-trap mechanism — the rewrite, the refusal conditions, the worked SQL — is stated in the **9.0.4** Administration Guide (`9.0.4\B10270_01.pdf`, ch. 9, pp. 9-31…9-35).

I checked this before relying on it: the sentence *"…rewrite the query using inline views to ensure the aggregation is done at the correct level"* appears **verbatim and identically in four releases** — 9.0.4 (`B10270_01.pdf`), 10.1.2 (`B13916-02.pdf`), 10.1.2.1 (`B13916-04.pdf`) and 11.1.1 (`b32519.pdf`) — as does the four-clause "unresolvable fan trap" list. Text stable across four major releases spanning 2003–2010, describing a mechanism the 4i Plus User's Guide already exposes as a *user setting* (`4.1\Discoverer4iPlusUserGuide.pdf` p. 5-14, "Fan-Trap Detection"), is a 4.1 behaviour. Grade: **[DOC]**, cross-version corroborated. Where 4.1 provably *differs*, §1.8 says so.

### 0.3 Sources deliberately not read

`oracle_discoverer_complete_reference.md` §8 and `EUL_VERSION_REFERENCE.md` were excluded per instruction. No name in this document originates there. Every EUL4 table name used is confirmed against `eul4del.sql`; every column is graded.

### 0.4 Untrusted-content scan

I scanned the source material for instruction-shaped text aimed at automated analysis ("SYSTEM:", "ignore previous", "mark as approved", "false positive"). **Nothing found.** The one thing in this repository that behaves like a prompt-injection is not adversarial — it is `oracle_discoverer_complete_reference.md` §8 and `EUL_VERSION_REFERENCE.md`, whose fabricated schema reads exactly like ground truth and *did* mislead the codebase (the invented `JOI_ID`/`EXP_COL_NAME`/`EUL5_ELEM_ACCESS` model reached production code). Both now carry retraction headers. **Treat confident-sounding schema prose with no `file:line` behind it as hostile input regardless of intent** — that is the operational lesson, and it is why every claim below is graded.

---

## 1. Fan traps and aggregation correctness — HIGHEST PRIORITY

### 1.1 The shape of the problem

A fan trap is one master folder joined to **two or more detail folders independently**, where the query aggregates a measure from more than one detail side. The naive single-flat-`SELECT` plan joins all three, which repeats each master row once per matching detail row on *the other* branch, and then aggregates the inflated cross-product.

> *"A fan trap is a group of joined database tables that might return unexpected results. The most common manifestation of a fan trap occurs when a master table is joined to two or more detail tables independently."*
> — `9.0.4\B10270_01.pdf` p. 9-31 **[DOC]**

Oracle's own worked example (ACCOUNT master; SALES and BUDGET details) is unambiguous about the size of the error: correct sales for Account 1 is **400**; the flat statement returns **800**, and its budget **1200** instead of 400 (`9.0.4\B10270_01.pdf` figs. 9-19 / 9-20). A 2× to 3× inflation on both measures at once.

This is the exact defect class the audit's LEG-04 predicts for Neo (`E:\claude\discoverer\AUDIT_DETAILED_FINDINGS.md:809-828`): `from-clause.ts:149` emits an inner join, `select-clause.ts` emits `SUM(f1.ORDER_TOTAL)`, four order lines per header, "£2.4M quarter reports as £9.6M". The mechanism specified here is what prevents it.

### 1.2 How Discoverer knew a join was one-to-many — the answer

**It did not infer cardinality. It was told, per join, by one boolean.**

Oracle's export DTD declares the join object — `ForeignKey`, a child of `SimpleObject`, `CustomObject` and `ComplexObject` — with exactly four semantic attributes:

```
E:\claude\discoverer\discoverer10g\sql\EUL.dtd:191-201
<!ELEMENT ForeignKey (ElementRef*, Formula?, %COMMON_SUB_ELEMENTS;)*>
<!ATTLIST ForeignKey
        %ELEMENT_PROPERTIES;
        %NAMED_ELEMENT_PROPERTIES;
        RemoteKey CDATA #IMPLIED
        ExternalKeyName CDATA #IMPLIED
        AllowDetailNoMaster (False | True) "False"
        AllowMasterNoDetail (False | True) "False"
        OneToOne            (False | True) "False"
        Mandatory           (False | True) "False"
>
```

`OneToOne` is the cardinality declaration, and the vendor manual states its *only* purpose in a sentence that could not be more useful:

> *"One to one join relationship between master and detail — Select this check box to create a one-to-one relationship instead of a one-to-many relationship between the master and detail tables. … **This setting has no effect on the SQL that Discoverer generates, because SQL does not know about the cardinality of joins. It only affects the fan trap detection.**"*
> — `9.0.4\B10270_01.pdf` "Join Wizard: Step 2 dialog", p. 24-94 **[DOC]**

So:

- **`OneToOne = False` (the DTD default) ⇒ the join is one-to-many, master → detail.**
- `OneToOne = True` ⇒ one row either side; the branch cannot fan.

**Every join is one-to-many unless explicitly marked otherwise.** The default is the dangerous case. An implementer who treats a missing/unknown flag as "safe" inverts Discoverer's own bias and will under-detect.

Cardinality is **declared, not measured**. There is no row-count sampling, no `NUM_DISTINCT` probe, no unique-index check anywhere in the model. This is important and freeing: Neo does not need statistics to reproduce the guard, it needs one column.

**Which EUL4 column carries `OneToOne`: UNKNOWN.** `EUL4_KEY_CONS` is the join table (`eul4del.sql:471`), and its flag columns are not attested offline. The migration reads `KEY_OBJ_ID`, `FK_OBJ_ID_REMOTE`, `KEY_DESCRIPTION` and probes only `KEY_ID` / `KEY_NAME` / `KEY_TYPE` (`E:\claude\discoverer\discoverer-neo\migrate\src\services\eul-schema-adapter.ts:128-135`) — so the four flags have **never been read from this estate**.

**Evidence that settles it, in one query, read-only:**

```sql
SELECT column_name, data_type, nullable
FROM   all_tab_columns
WHERE  owner = 'SIID_TESTES' AND table_name = 'EUL4_KEY_CONS'
ORDER  BY column_id;
```

with 10 rows of `SELECT *` beside it. Ten joins; the whole table fits on a screen. Until that runs, the *column names* are UNKNOWN; the *semantics* above are not.

### 1.3 `EUL4_OBJ_JOIN_USGS` is not the cardinality source — it is join *usage*

The brief names `EUL4_OBJ_JOIN_USGS` as a candidate. The DTD rules it out:

```
E:\claude\discoverer\discoverer10g\sql\EUL.dtd:143   ComplexObject (…, ForeignKey*, ObjectDependency*, ObjectJoinUsage*, …)
E:\claude\discoverer\discoverer10g\sql\EUL.dtd:153-157
<!ELEMENT ObjectJoinUsage (ElementRef+, %COMMON_SUB_ELEMENTS;)*>
<!ATTLIST ObjectJoinUsage %ELEMENT_PROPERTIES; JoinModified (True | False) "False">
```

`ObjectJoinUsage` occurs **only** under `ComplexObject`, holds only element references and a staleness flag. It answers *"which joins does this complex folder consume?"* — needed for complex-folder expansion (§2.6), irrelevant to cardinality. **[SQL]**

### 1.4 The exact rewrite — SQL shapes

Oracle prints the generated SQL for its ACCOUNT/SALES/BUDGET example. Reproduced verbatim from `9.0.4\B10270_01.pdf` pp. 9-33…9-34 (typos are Oracle's; the doubled comma and `BUDGET_ _SUM` are in the manual):

```sql
SELECT inACC as Name, SUM(inSalesSum) as SALES_SUM, ,SUM(inBudgetSum) as BUDGET_ _SUM,
FROM
 (SELECT masterID AS OutMasterIDSales, SUM(SalesDetailsSales) AS inSalesSum
  FROM (SELECT ID AS masterID, NAME AS masterName FROM ACCOUNT)          INLineAccount,
       (SELECT ID AS SalesDetailId, ACCID AS SalesDetailAccID,
               SALES AS SalesDetailsSales FROM SALES)                    INLineSales
  WHERE (masterID = SalesDetailAccID(+))
  GROUP BY masterID)                                                     inner1,
 (SELECT masterID AS OutMasterIDBudget, SUM(BudgetDetailBudget) AS inBudgetSum,
         masterName AS inACC
  FROM (SELECT ID AS masterID, NAME AS masterName FROM ACCOUNT)          INLineAccount,
       (SELECT ID AS BudgetDetailId, ACCID AS BudgetDetailAccID,
               BUDGET AS BudgetDetailsSales FROM BUDGET)                 INLineBudget
  WHERE (masterID = BudgetDetailAccID(+))
  GROUP BY masterName, masterID)                                         inner2
WHERE ((OutMasterIDBudget = OutMasterIDSales))
GROUP BY inACC
```

Read structurally, the rewrite is **one inline view per master–detail aggregation branch, joined back on the master key**:

```
For each detail branch D_i carrying an aggregated measure:
    B_i := SELECT  <master key columns>,
                   <axis columns needed from master, on exactly one branch>,
                   AGG_i(<measure of D_i>)
           FROM    <master>  M
                   <detail D_i>  ON <join predicate>   -- outer, detail side
           GROUP BY <master key columns> [, <axis columns on that branch>]

Outer:  SELECT   <axis columns>, SUM(B_1.agg), SUM(B_2.agg), …
        FROM     B_1, B_2, …
        WHERE    B_1.<master key> = B_2.<master key> = …
        GROUP BY <axis columns>
```

Five properties of the shape are load-bearing and each is visible in Oracle's own text:

1. **Aggregation is pushed *below* the branch join, one GROUP BY per branch.** Each `inner_i` groups by the master key before anything else sees it. *"each sale and each budget is summed individually (one for each master-detail aggregation) and is then combined with a join based on the master key(s)"* — p. 9-34. **[DOC]**
2. **The master is itself an inline view** (`INLineAccount`), repeated inside every branch. Not a shared CTE. Discoverer emitted this in 2000; a modern target should use a CTE and is free to — §9 grades that SEMANTIC.
3. **The detail side is outer-joined**: `masterID = SalesDetailAccID(+)`. A master row with sales but no budget still appears, with a NULL branch aggregate. This is *not* the join's `AllowMasterNoDetail` flag showing through — the flag is `False` by default and the example sets nothing; the outer join is **structural to the rewrite**, because inner-joining the branches would drop master rows that are absent from any one detail. **[DOC]**, from the emitted SQL.
4. **The outer aggregate re-aggregates**: `SUM(inSalesSum)`, not a bare projection. Because a branch may group finer than the outer query (e.g. by master key when the outer only wants account name), the outer `SUM` collapses the residue. **A re-aggregation function must be chosen for each measure, and it is not always the inner one** — see §1.9.
5. **The axis (grouping) columns ride on exactly one branch.** Note `masterName AS inACC` appears only in `inner2`, and only `inner2` groups by it. Duplicating a master descriptive column on every branch is harmless for correctness but wasteful; Discoverer picks one.

**And this shape is not exceptional.** The 9.0.4 guide, discussing the SQL Inspector:

> *"**Discoverer always sends SQL that contains inline views to the RDBMS.** Because inline views can be difficult for end users to read, you can configure Discoverer to reformat SQL to make it easier to read. Reformatted SQL is also known as 'flattened' SQL."*
> — `9.0.4\B10270_01.pdf` p. 15-4, `SQLType` registry setting **[DOC]**

Implementation consequence: the inline-view generator is the **only** generator. There is no "simple path" that a fan-trap path is grafted onto. Neo choosing to keep a flat path for the single-folder case is fine (581 of 923 maps are single-folder, `AUDIT_DETAILED_FINDINGS.md:960-975`) but it must be a *deliberate* fast path with an explicit predicate, not a default that fan-trap detection has to remember to override.

### 1.5 When Discoverer refused instead of rewriting

Four conditions. Verbatim, `9.0.4\B10270_01.pdf` p. 9-31 **[DOC]**:

> *"In some circumstances, Discoverer will detect a query that involves an unresolvable fan trap schema, as follows:*
> - *if the detail folders use different keys from the master for the join*
> - *if there is a direct join relationship between the detail folders (thereby creating an ambiguous circular relationship)*
> - *if non-aggregated values are chosen from more than one of the detail folders*
> - *if more than one detail folder has a separate join relationship to a different master folder"*
>
> *"In the above circumstances, Discoverer disallows the query and displays an error message."* (p. 9-32)

Restated as testable predicates over the query's join subgraph:

| # | Refusal condition | Test |
| --- | --- | --- |
| R1 | Detail branches join the master on **different key sets** | The column sets of the master-side predicates of branch *i* and branch *j* differ. The branch aggregates are then not on a common grain and the outer join key does not exist. |
| R2 | A **direct join between two detail folders** | Any edge in the query subgraph directly connecting two detail folders of the same master. Creates a cycle; branch decomposition is ambiguous. |
| R3 | **Non-aggregated values from more than one detail** | ≥ 2 detail folders each contributing at least one *axis* (non-measure) item. Two independent detail grains on the axis is a genuine cross-product; no rewrite can restore it. |
| R4 | Two detail folders each attached to a **different master** | The subgraph has ≥ 2 master nodes with detail branches. Not a single fan; branch identity is undefined. |

**R3 is the one to internalise.** Fan-trap resolution works because the details are only ever *summarised*. The instant the user drags a detail-level attribute from two branches onto the axis, the correct answer *is* a cross-product and Discoverer stops rather than inventing one.

**Refusing is a feature, and it is the behaviour to copy.** Discoverer refuses a query it cannot make correct. It does not return a plausible number. Neo must do the same, with a message that names the folders and the reason — see §9 (EXACT) and §10.

### 1.6 The second guard: totals across the fan are suppressed, not computed

> *"In addition, Discoverer controls which columns can be totalled. If a worksheet displays values of items from both the master folder and the detail folder, **Discoverer will not total the values together. Instead, Discoverer will display a null** to prevent incorrect or unexpected results."*
> — `9.0.4\B10270_01.pdf` p. 9-32 **[DOC]**

A distinct, second-line defence at the *presentation* layer: a grand total over a column whose rows come from mixed grains renders **NULL**, not a wrong number. Neo has a totals pipeline already (`map_totals`, `backend/src/lib/sql/totals.ts`) which is exactly where this belongs.

### 1.7 Complex folders: Discoverer *warns* and delegates to the modeller

Inside a complex folder, Discoverer does **not** rewrite:

> *"Discoverer warns about fan trap join configurations in complex folders by displaying a message indicating that an invalid join configuration exists. To make sure that Discoverer returns correct results for complex folders, you can edit the Formula property of the detail item and explicitly specify the aggregate formula. For example, you might set the Formula property of a Sales item in a complex folder from `Sales Fact.Sales` to `SUM(Sales Facts.Sales)`."*
> — `9.0.4\B10270_01.pdf` p. 9-35 **[DOC]**

So an *aggregate calculated item* (§3.4) inside a complex folder is the administrator's manual fan-trap resolution — it forces the aggregation to happen at the folder's own grain. This has a direct consequence for migration: **an item whose formula already contains an aggregate function is a pre-resolved fan trap and must not be aggregated again.** §3.4.

### 1.8 The one place 4.1 provably differs from 9.0.4+ — and how to read it

`4.1\Discoverer4iPlusUserGuide.pdf` p. 5-14 contains two statements that do not agree with each other:

- The *Advanced Options dialog* description: *"When this check box is NOT selected, Discoverer automatically detects **and resolves** fan trap **and chasm trap** queries **into multiple SQL statements** to obtain normal expected results."*
- The *About Fan-Traps* narrative two paragraphs later: *"Discoverer **merely warns** of a potential for a fan-trap and **does not automatically prevent** a fan-trap situation from occurring."*

Two readings, and I cannot choose between them from documents alone:

- **(a) The narrative describes Plus's *authoring-time* warning** ("As you're creating a new worksheet, Discoverer automatically detects and warns if the data items selected … can possibly lead to a fan-trap"), while the dialog text describes *query-time* resolution. Under this reading there is no contradiction: warn while building, rewrite while running.
- **(b) 4i Plus genuinely warned only**, and full rewrite arrived later.

Reading (a) is the stronger one — the sentences are about different moments, and the Administration Guide of the very next release describes rewrite as long-standing, not new. But grade it **[ASSUMED]**.

**It does not change what to build**, because both readings are satisfied by implementing the rewrite *and* the warning, and because refusing-or-rewriting is strictly safer than whatever 4.1 did. **What it does change is the acceptance test**: do not assert that Neo's SQL matches a 4.1 trace byte-for-byte. Assert that the *numbers* match, and derive the expected numbers from the semantics (§10.1).

Also from the same page, and unambiguous: `4.1\Discoverer4iPlusUserGuide.pdf` treats **fan traps and chasm traps as one feature under one switch**. See §1.10.

**The 4.1 switch and its default**, from Oracle's own 4i configuration reference (`4.1\a87430.pdf` App. C, "Registry settings in pref.txt", key list at extract line 2561, descriptions at 2579):

| `pref.txt` key | Description (verbatim) | Default |
| --- | --- | --- |
| `DisableFanTrapDetection` | *"Disables detection for fan trap in user queries."* | **`0` (detection ON)** |
| `DisableMultiJoinDetection` | *"Disables multiple join detection."* | **`1` (detection OFF)** |
| `DisableAutoOuterJoinsOnFilters` | *"Turn off Automatic Outer Joins on filters."* | `0` (ON) |

**Fan-trap detection was on by default in 4.1 and users were told not to turn it off** (*"We recommend that you DO NOT select this check box unless advised to do so by your Discoverer Administrator"*). Multiple-join-path detection was off by default. **[DOC]**

### 1.9 What the sources do *not* settle about the rewrite

Stated plainly, because guessing here produces silently wrong money:

1. **Re-aggregation function for non-SUM measures — UNKNOWN.** `SUM` over branch `SUM` is trivially correct. `MIN`/`MAX` re-aggregate as themselves. But `COUNT` must re-aggregate as `SUM`, and **`AVG` cannot re-aggregate at all** without carrying `SUM` and `COUNT` separately — a fact Oracle states in a different context (*"AVG requires the inclusion of SUM and COUNT, which Discoverer uses to calculate the average"*, `9.0.4\B10270_01.pdf` p. 14-8 **[DOC]**), which is strong evidence Discoverer decomposed `AVG` internally, but is not a statement about the fan-trap rewrite. `COUNT DISTINCT` (282 totals in this estate, §3.3) is **not** re-aggregatable at all.
   *Settled by:* running an `AVG` and a `COUNT DISTINCT` fan-trap query in a live 4.1 Plus with SQL Inspector open. If no 4.1 install survives — **refuse `AVG` and `COUNT DISTINCT` across a fan and say why.** That is a correct-and-loud answer; a guessed decomposition is an incorrect-and-quiet one.
2. **Where a worksheet-level condition lands.** A filter on the *master* is safe in either place. A filter on **detail branch *i* must go inside branch *i*'s inline view**, before its GROUP BY, or it filters post-aggregation and changes the answer. A filter on branch *i* placed in the *outer* query silently drops master rows from branch *j* too. Oracle's example has no conditions. **[ASSUMED]** — but the correct placement is forced by arithmetic, not by taste, so implement branch-local placement and test it.
3. **Parameters.** Same question as (2), same answer, and this estate has **7 521 parameters** across 923 worksheets. Not optional.
4. **`DisableAutoOuterJoinsOnFilters` interaction.** 4.1 has a documented behaviour where applying a condition changes outer-join treatment (`9.0.4\B10270_01.pdf` §"About outer joins and the DisableAutoOuterJoinsOnFilters registry setting", pp. 11-12…11-15), default ON. Its interaction with the fan-trap rewrite's structural `(+)` is **UNKNOWN** and is a real risk of an off-by-a-few-rows difference. *Settled by:* reading pp. 11-13…11-15 of `9.0.4\B10270_01.pdf` in full during implementation — the three worked examples are there; I have not traced them against the rewrite.

### 1.10 Chasm traps

**Covered, but thinly, and 4.1 folds them into the same switch.**

- `4.1\Discoverer4iPlusUserGuide.pdf` p. 5-14 — one control resolves *"fan trap **and chasm trap** queries"*. **[DOC]** — the only explicit chasm-trap mention in the 4.1 material.
- The *"About Fan-Traps"* worked example on that same page is, in classical data-modelling vocabulary, **a chasm trap**: Departments (shared parent) with Employees and Locations hanging off it; counting employees by location yields 8 for a real 4 because *"Clark, Miller, and Scott are counted for both London and Tokyo"*. Oracle calls it a fan trap.
- The 9.0.4+ Administration Guides never use the word "chasm".

**Reading:** Oracle's "fan trap" is the union of both classical traps — one master, ≥ 2 independent detail branches — which is precisely the condition the inline-view rewrite resolves, and it resolves both identically. **A separate chasm-trap detector is not required.** The detection predicate in §1.11 covers both, because both are "a master node with ≥ 2 aggregating detail branches".

*If an SME insists on the textbook distinction:* the difference is whether the two details share a key with each other. That is refusal condition **R2** (direct detail–detail join), already handled.

### 1.11 Decision procedure — implementable, numbered

Inputs, all available at query-build time:

- `F` — folders reachable from the selected items.
- `E` — join edges among `F`, each with `(detailFolder, masterFolder, predicate[], oneToOne, allowDetailNoMaster, allowMasterNoDetail, mandatory)`.
- `A` — axis items (grouping), `M` — measure items with an aggregate function. In `.DIS` these are literally two separate vectors on the query request: `0x0123` axis / `0x0124` measure (`EUL_SCHEMA_GROUND_TRUTH.md:1009-1024`, `workbook-parser.ts:2704-2706`). **The axis/measure split is given, not inferred.** **[BINARY]**

```
 0. If |M| = 0 (a pure detail listing, no aggregation): emit the flat plan. STOP.
    No aggregate exists, so nothing can be inflated. Fan traps are an
    aggregation defect only.

 1. Build the undirected join subgraph G over the folders actually used.
    If G is disconnected: refuse — "No join path connects <folders>".
    (Pre-existing Neo behaviour; 271 of 341 multi-folder maps in this estate hit
     this today, AUDIT_DETAILED_FINDINGS.md:960-975. Keep it.)

 2. Orient every edge master -> detail using KEY_CONS (§2.2). Orientation is
    metadata, never inferred from traversal order, and never flipped by BFS.

 3. Mark each edge FANNING := (oneToOne = FALSE).
    A one-to-one edge cannot multiply rows; it is transparent to this analysis.
    Unknown/absent flag => FANNING. Discoverer's own default is False on OneToOne.

 4. For every folder f in G, collect
        branches(f) := { e in E : e.master = f AND e.FANNING }
    Consider only branches that are LIVE — the subtree beyond e contributes at
    least one selected item. A join present but contributing nothing is trimmed
    (§2.7) and cannot fan.

 5. FAN CANDIDATE  <=>  exists f with |live branches(f)| >= 2
                        AND >= 2 of those branches contribute a measure in M.
    If no candidate: emit the flat plan (with §2 join types). STOP.
        - one branch with measures cannot double-count: the master repeats but
          only one measure column exists, and SUM over the repeats is the same
          arithmetic Discoverer's single-branch inline view performs.
          (Guard: this holds for SUM/MIN/MAX/COUNT. It does NOT hold if a
           MASTER-side measure is also selected — see step 5a.)
    5a. MASTER-SIDE MEASURE CHECK. If any measure in M belongs to f itself
        (the master) and at least one live FANNING branch exists, the master's
        measure is repeated once per detail row. This is the single-branch
        £2.4M -> £9.6M case in AUDIT_DETAILED_FINDINGS.md:809-828 and it is a
        fan trap with ONE branch. Treat as a fan candidate with the master's
        own measures forming their own branch (aggregate at master grain,
        i.e. GROUP BY master key with no detail joined).
        [INFER] — arithmetically forced; Oracle's text only ever describes the
        two-detail case, because a master measure and a detail measure in one
        worksheet is the same defect wearing a different hat.

 6. REFUSAL TESTS (§1.5). Any true => refuse, name the folders and the rule:
        R1  master-side key columns differ between two branches
        R2  a direct join edge exists between two detail branch subtrees of f
        R3  >= 2 branches contribute an AXIS item (A), not just measures
        R4  >= 2 distinct folders in G satisfy step 5's branch test
            (two masters => not one fan)

 7. REWRITE. For each live branch i of f:
        B_i := SELECT  <f's join key columns>            -- the outer join key
                     [, <axis columns from f or branch i, on one branch only>]
                     , AGG_i(measure) for every measure of branch i
               FROM    f  JOIN branch_i subtree ON <predicate>, DETAIL SIDE OUTER
               WHERE   <conditions and parameters scoped to f or branch i>
               GROUP BY <f's join key columns> [, <axis columns present>]
    Master-only measures (5a) form branch B_0 over f alone.

 8. OUTER. Join B_1..B_n on f's key columns (equi, all branches).
        SELECT   <axis columns>, REAGG_i(B_i.agg_i) …
        GROUP BY <axis columns>
    REAGG: SUM->SUM, COUNT->SUM, MIN->MIN, MAX->MAX.
           AVG, COUNT DISTINCT, STDDEV, VARIANCE => REFUSE (§1.9.1).

 9. TOTALS. Any grand total or subtotal spanning columns whose branches differ
    renders NULL, not a number (§1.6).

10. Record the decision. Every query records which rule fired: FLAT,
    REWRITE(n branches), or REFUSE(R1|R2|R3|R4|REAGG). This is not logging —
    it is the only way §10 can prove the guard is live.
```

**Sequencing, and it is not negotiable.** Steps 3–8 depend on `OneToOne` and on master/detail orientation, neither of which Neo currently reads (§2.2). Re-enabling multi-folder joins before this exists converts today's loud `No join path connects…` failure into a silent wrong number. **The loud failure is the safer state.** Ship the guard first.

---

## 2. Join semantics

### 2.1 A join binds folders, carries a predicate, and is owned by one side

`EUL4_KEY_CONS` (`eul4del.sql:471`) is a **folder-to-folder** relation: `KEY_OBJ_ID` and `FK_OBJ_ID_REMOTE` both reference `EUL4_OBJS.OBJ_ID` (`discoverer_4_1_eul_migration_reference.md:407-426`). It is not an item pair. The DTD makes the ownership explicit by *placement*: `ForeignKey` is a **child element of a folder** (`EUL.dtd:129`, `:136`, `:143`) with a `RemoteKey` attribute (`EUL.dtd:195`) naming the far side. A join is a property of one folder that points at another. **[SQL]**

`KEY_ID` is real. Oracle's own `d4wkdmp.exe` resolves a workbook's join reference against the live EUL by numeric id and prints `*** Found in EUL by id ***` (`E:\claude\discoverer\d4dumps\120505.txt`, `Id = 109818`). **[BINARY]** — it is currently only *probed* by the migration (`eul-schema-adapter.ts:135`); it can be relied on.

### 2.2 Which end is master — and a live inversion to check first

From five `EUL Join Reference` records across the reference dumps (`E:\claude\discoverer\d4dumps\120505.txt`, `120516.txt`, `120538.txt`, `121014.txt`, `124116.txt`), the pattern is perfectly regular:

| `Name` | `Owning Folder Name` |
| --- | --- |
| `M M27 -> M M27 1` | `M M27 1` |
| `M M12 -> M M12 1` | `M M12 1` |
| `M M111 -> M M111 1` | `M M111 1` |
| `M M166 -> M M166 Coseg` | `M M166 Coseg` |
| `M M167 -> M M167 Coseg` | `M M167 Coseg` |

The owning folder is always the **right** side of the arrow, and always the *subordinate* table by naming (`X 1`, `X Coseg` hanging off `X`). Combined with `FK_OBJ_ID_REMOTE` meaning *the remote folder the foreign key points at*, and with the DTD placing `ForeignKey` **on the folder that owns the key**:

- **`KEY_OBJ_ID` = the DETAIL folder** (owns the FK — the many side)
- **`FK_OBJ_ID_REMOTE` = the MASTER folder** (the referenced — the one side)

Grade **[INFER]**, from two independent signals agreeing (dump naming + FK semantics).

**This is inverted in the current code.** `eul-schema-adapter.ts:129-130` maps `KEY_OBJ_ID → masterFolderId` and `FK_OBJ_ID_REMOTE → detailFolderId`. The audit's own proposed schema patch (`AUDIT_DETAILED_FINDINGS.md:891-892`) maps them the other way — `detail_folder_id ← KEY_OBJ_ID`, `master_folder_id ← FK_OBJ_ID_REMOTE` — matching the reading above.

**Two artefacts in this repository disagree about which end is master.** Since orientation decides which side gets pushed into the inline view (§1.11 step 7), an inversion produces *correct-looking, wrong* numbers rather than an error. **This is the first thing to settle, before any of §1 is coded.**

*Settled in one read-only query:*

```sql
SELECT k.key_id,
       k.key_name,
       d.obj_name AS key_obj,        -- KEY_OBJ_ID side
       m.obj_name AS remote_obj      -- FK_OBJ_ID_REMOTE side
FROM   eul4_key_cons k
       JOIN eul4_objs d ON d.obj_id = k.key_obj_id
       JOIN eul4_objs m ON m.obj_id = k.fk_obj_id_remote;
```

Ten rows. If `key_obj` is `M M27 1` and `remote_obj` is `M M27`, the reading above is confirmed and `eul-schema-adapter.ts` is inverted.

### 2.3 The four flags → emitted SQL

Discoverer's Join Wizard Step 2 offers exactly four settings (`9.0.4\B10270_01.pdf` pp. 24-93…24-94), and the DTD carries exactly four attributes (`EUL.dtd:197-200`). **The mapping below is [INFER] on the flag↔control pairing, [DOC] on each control's SQL effect.**

| DTD attribute | Administrator control | SQL effect | Grade |
| --- | --- | --- | --- |
| `AllowMasterNoDetail` | ☑ **Outer join on detail** | *"returns all master rows that have no corresponding detail items, as well as all matching master and detail rows"* → `master LEFT OUTER JOIN detail`, Oracle 8 syntax `dept.deptno = emp.deptno(+)` (worked example, p. 9-21) | control→SQL **[DOC]**; attribute→control **[INFER]** |
| `AllowDetailNoMaster` | ☑ **Outer join on master** | *"returns all detail rows that have no corresponding master items"* → `detail LEFT OUTER JOIN master` (= `master RIGHT JOIN detail`). *"This construct is rare in real business scenarios."* Requires the "might not exist" radio (p. 24-94). | as above |
| `Mandatory` | ◉ **Detail item values always exist in the master folder (Typical)** / ○ **…might not exist** | **No join-type effect.** It is a referential-integrity *assertion* that unlocks two optimisations: join trimming (§2.7) and summary-folder eligibility (§6.3). | **[INFER]** on which attribute; effects **[DOC]** |
| `OneToOne` | ☑ **One to one join relationship** | **None.** *"This setting has no effect on the SQL that Discoverer generates… It only affects the fan trap detection."* (p. 24-94) | **[DOC]**, explicit |

Derived join type — and note only three of four are reachable:

| `AllowMasterNoDetail` | `AllowDetailNoMaster` | Emitted | Frequency |
| --- | --- | --- | --- |
| False | False | `INNER JOIN` | the norm |
| **True** | False | `LEFT JOIN` from master (detail side `(+)`) | common |
| False | **True** | `RIGHT JOIN` from master (master side `(+)`) | *"rare in real business scenarios"* |
| True | True | `FULL OUTER` — **no vendor text describes this** | **[ASSUMED]**; 4.1 targets Oracle 8 `(+)`, which cannot express a full outer join in one predicate. Treat as unsupported and warn until an SME confirms the combination is even settable. |

**Store the two booleans, derive `join_type`.** Neo's single 4-value enum (`backend/src/db/schema.ts:511`) cannot carry two independent outer switches plus `OneToOne` plus `Mandatory` — and worse, `KEY_TYPE` is a *probed* column that **defaults to `INNER` when absent** (`eul-schema-adapter.ts:134-135`), so "all 10 live joins are INNER" is a default, not a reading (`AUDIT_DETAILED_FINDINGS.md:900-908`).

### 2.4 Multi-column join predicates

Supported and first-class. The Join Wizard has an explicit **Add** button: *"Use this button to add a join item to the join. Here, you can create multi-item joins by selecting another master folder, operator, and detail folder"* (`9.0.4\B10270_01.pdf` p. 24-92) **[DOC]**. The Administration Guide devotes a section to *"What are multi-item joins?"* (p. 9-5) and the index records *"composite join key, 9-5"*.

Predicate components are **ANDed**, pair by position. Neo's proposed `join_predicates` child table with `seq` (`AUDIT_DETAILED_FINDINGS.md:880-889`) is the right shape.

**Operators** (`9.0.4\B10270_01.pdf` p. 24-91, verbatim table): `=` (equi) and `<`, `>`, `<=`, `>=`, `<>` (non-equi). **Non-equi joins are supported by the product.** This matters for §1: a non-equi branch cannot be outer-joined and grouped on a key the way step 7 assumes. **Refuse fan-trap rewrite over a non-equi branch** rather than rewrite it wrongly. **[INFER]**, from arithmetic.

### 2.5 Where the predicate lives — `EXP_TYPE = 'JP'`, confirmed on the live EUL

**Confirmed, and the count is exact.** On this estate `EUL4_EXPRESSIONS.EXP_TYPE` holds only three values (`EUL_SCHEMA_GROUND_TRUTH.md:273-277`):

| `EXP_TYPE` | Meaning | Rows |
| --- | --- | ---: |
| `CO` | base item, mapped to a real column (`IT_EXT_COLUMN`) | 6 967 |
| `CI` | created item — a calculation | 2 830 |
| **`JP`** | **join predicate** | **10** |

**Ten `JP` expressions, ten `EUL4_KEY_CONS` rows.** One predicate expression per join. **[INFER]**, but a 10:10 correspondence in a 9 807-row table is not coincidence.

`CO`/`CI` are proven from Oracle's own PL/SQL: `Lineage.sql:305` tests `IF EXPTYPE <> 'CO' THEN … 'This item is not based on a database column'`, and `Lineage.sql:321-323` recurses when `EXPTYPE = 'CI'`. **[SQL]** — and note this is the *inverse* of what the migration reader originally assumed (`EUL_SCHEMA_GROUND_TRUTH.md:137-146`).

**Open:** whether a multi-column join is one `JP` row with a compound formula or *n* `JP` rows. Ten joins and ten rows means **at most one is multi-column, or all are single-column**. *Settled by:* `SELECT exp_id, exp_name, exp_type FROM eul4_expressions WHERE exp_type='JP'` plus whichever `KEY_CONS` column links them. Keep `raw_formula` as the escape hatch: store verbatim, refuse to generate from what you cannot decompose, warn.

### 2.6 Complex folders

A **complex folder** (`OBJ_TYPE = 'COBJ'`) is a pre-joined view over simple folders. Its DTD content model (`EUL.dtd:143`) is `ComplexItem*, Filter*, Parameter*, ForeignKey*, ObjectDependency*, ObjectJoinUsage*` — dependencies name the constituent folders, `ObjectJoinUsage` names the joins used. `Lineage.sql:38-41` walks `EUL4_OBJ_DEPS` (`OD_OBJ_ID_FROM` / `OD_OBJ_ID_TO`) to find the complex folders a simple folder feeds. **[SQL]**

Two consequences an implementer must not miss:

1. **Two folders may be joined by *more than one* join**, and a complex folder pins which one it uses. Oracle's example builds four complex folders over the same `emp.deptno = dept.deptno` pair, differing only in join options (`9.0.4\B10270_01.pdf` pp. 9-12…9-13). Hence the *Choose Joins* dialog.
2. `OBJ_TYPE` has a **third** value beyond `SOBJ`/`COBJ`: `Lineage.sql:333` tests `IF OBJTYPE='CUO' THEN DB_ITEM:='Custom SQL Item - '||OBJITM`. **`CUO` = custom-SQL folder** (DTD `CustomObject` with `CustomSQL`, `EUL.dtd:136-142`). **[SQL]** — this refines `EUL_SCHEMA_GROUND_TRUTH.md:117`, which lists only two values.

### 2.7 Join trimming

> *"If you combine two or more folders in a complex folder (i.e. using a join), Discoverer can improve query performance by detecting and removing joins that are not required (a process known as **join trimming**). If the `SQLJoinTrim` Discoverer registry setting is enabled (i.e. if it is set to the default value of 1), Discoverer will remove joins from a query when **both** of the following conditions are met: if Discoverer can return the requested rows without using the join; **and** if you select the *Detail item values always exist in master folder* option for the join."*
> — `9.0.4\B10270_01.pdf` p. 9-13 **[DOC]**

Both conditions. Trimming a join whose master is *not* asserted mandatory would change the row set (Oracle's Scenario Two, p. 9-15: employee ALLEN in a department that no longer exists). Trimming is also **why step 4 of §1.11 counts only live branches** — a trimmed join cannot fan.

`SQLJoinTrim` default 1. **[DOC]**

### 2.8 Forced joins from the worksheet

A `.DIS` worksheet can pin the joins its query uses. The chain is query request `0x0122` → `0x0127` (`Join Usage`) → `0x0118` (`EUL Join Reference`) (`EUL_SCHEMA_GROUND_TRUTH.md:1009-1024`, `:1232-1243`; `workbook-parser.ts:220-221`, `:367`, `:2405-2415`, `:2736-2746`). Fields:

| Tag | Field | Note |
| --- | --- | --- |
| `0x0119` | EUL join id | `EUL4_KEY_CONS.KEY_ID` — `workbook-parser.ts:539` |
| `0x0fa7` | Identifier | developer key |
| `0x011a` | Name | `M M27 -> M M27 1` |
| `0x0fa8` / `0x011b` | Owning folder identifier / name | the detail folder (§2.2) |

**24 across the whole 923-worksheet corpus; 6 in Oracle's own `VIDAF4.DIS`. 24/24 matched against `d4wkdmp` on all four fields.** **[BINARY]**

Semantics **[INFER]**: this is the persisted answer to the *Join Folders* / *Choose Join* dialog — the user resolved an ambiguity once and it was saved. Discoverer's runtime rule (`9.0.4\B10270_01.pdf` p. 9-13):

- `DisableMultiJoinDetection = 1` (**4.1 default**, §1.8) → *"Discoverer uses **all** of the available joins."*
- `= 0` → prompt the user with the *Join Folders* dialog.

**Implementation:** if a worksheet carries `0x0118` refs, treat them as the authoritative join set for that query — do not re-run path selection. If it carries none (899 of 923 worksheets), fall back to normal traversal. Rare, cheap, and the alternative is silently picking a different path than the report's author did.

### 2.9 Multiple join paths (ambiguity), distinct from fan traps

A different defect: two folders reachable by more than one route. Discoverer *warns* — it never resolves.

> *"The warning that a multiple join path situation exists is not an error message; the warning merely advises you that the database contains relationships among data items that you might not know exist."*
> — `4.1\Discoverer4iPlusUserGuide.pdf` p. 5-16 **[DOC]**

Off by default in 4.1 (`DisableMultiJoinDetection = 1`). With detection off, **all** available joins are used. This is a distinct rule from §1 and should be a distinct diagnostic.

---

## 3. Default per-item aggregation

### 3.1 The property exists, its values are known, its column is not

An item carries a **Default aggregate** — *"Use this field to change the aggregate type for the item (if numeric)"* — alongside **Default position** (*"Side, Page, Top, Datapoint"*) (`10.1.2\B13916-02.pdf` "Item Properties dialog: General tab", p. 24-82 ff.) **[DOC]**.

The value set is fixed by Oracle's own command-line grammar:

```
9.0.4\B10270_01.pdf, "/aggregate", p. 5-171 (extract line 5177)
    Details   /aggregate <SUM|MAX|MIN|COUNT|AVG|DETAIL>
```

**Six values: `SUM`, `MAX`, `MIN`, `COUNT`, `AVG`, `DETAIL`.** **[DOC]** `DETAIL` means *do not aggregate* — project the raw value.

Bulk load assigns it automatically: *"create default aggregates for datapoint items"* (`9.0.4\B10270_01.pdf` p. 4-8, Load Wizard Step 4), and *"The default aggregate is SUM"* (`10.1.2\B13916-02.pdf` "Load Wizard: Step 4 dialog", extract line 8449). **[DOC]**

### 3.2 Which `EUL4_EXPRESSIONS` column — **UNKNOWN**

Three independent searches came up empty:

- **The DTD does not carry it.** `%ITEM_PROPERTIES;` (`EUL.dtd:21-36`) declares `Sequence`, `DataType`, `MaxDisplayWidth`, `MaxDataWidth`, `FormatMask`, `Alignment`, `WordWrap`, `Placement`, `Hidden`, `CaseStorage`, `CaseDisplay`, `DisplayNullValue`, `Heading`, `UserDefinedFormat`, `ExternalColumnName` — **and no aggregate**. `Placement (Unknown | Measure | Axis | XAxis | YAxis | ZAxis)` is *Default position*, mapping to the attested `IT_PLACEMENT` (`discoverer_4_1_eul_migration_reference.md:251`). Default aggregate is absent from the 4.1 export format entirely. **[SQL]**
- **The shipped SQL never selects it.** `Lineage.sql` reads `IT_OBJ_ID`, `IT_EXT_COLUMN`; `batchusr.sql` only grants.
- **The migration never selects it.** `ITEM_COLUMNS` (`eul-schema-adapter.ts:109-119`) has no aggregation column, which is why `agg_function` is NULL on all 9 626 items and all 25 960 map items (`AUDIT_DETAILED_FINDINGS.md:917-943`).

Candidates named by the audit and **not** to be guessed into a `SELECT` (one wrong column is an `ORA-00904` that kills the whole read): `IT_SUM_FLAG`, `IT_AGGREGATE`, `IT_DEFAULT_POSITION`.

*Settled by:*

```sql
SELECT column_name, data_type
FROM   all_tab_columns
WHERE  owner = 'SIID_TESTES' AND table_name = 'EUL4_EXPRESSIONS'
ORDER  BY column_id;
```

then `SELECT <candidate>, COUNT(*) … GROUP BY` to see whether the domain is `SUM/AVG/…` strings or a small integer code. **Use `probeColumns()`, not a literal.**

**Cost of not doing this:** 552 of 19 632 migrated totals already carry a NULL `agg_function`, and `backend/src/lib/sql/totals.ts:197` emits *"A total on 'X' was skipped: its Discoverer aggregate did not migrate"* (`AUDIT_DETAILED_FINDINGS.md:935-940`). Whether the missing default is *also* silently mis-defaulting the 25 960 map items is unverified.

### 3.3 Worksheet-level aggregation *is* decoded — a separate, richer channel

Distinct from the EUL default, a worksheet's totals carry their own function in `0x0c1c` / `0x0c1d` (`EDCBAggregateType`). **19 639 summaries across 923 worksheets**, four codes established by correlating each total against `EXPRESSIONS.EXP_DATA_TYPE` and against Oracle's own Portuguese message file `DISCVR4\DCMRESPT.MSB` (`EUL_SCHEMA_GROUND_TRUTH.md:1866-1924`):

| Code | Function | n | Grade |
| --- | --- | ---: | --- |
| `1` | `SUM` | 19 085 | **[INFER]** |
| `2` | `AVG` | 35 | **[INFER]** |
| `3` | `COUNT` | 215 | **[INFER]** |
| `4` | `COUNT DISTINCT` | 282 | **[INFER]** |
| `5`, `6`, `9` | — | 22 | **[ASSUMED]** — three authoring decisions total; sample size, not evidence |

Two plausible orderings (message-id order, dialog order) were **refuted** by the data (`EUL_SCHEMA_GROUND_TRUTH.md:1908-1918`). Do not re-derive them from a label table.

`COUNT DISTINCT` is decoded but **inexpressible** in Neo — `AGGREGATE_FUNCTIONS` in `backend/src/lib/sql/formula-parser.ts` is `SUM/COUNT/AVG/MIN/MAX` and `select-clause.ts` throws on anything else. Those 282 migrate with `agg_function` NULL and `source_attrs.functionName = 'COUNT DISTINCT'`. **Teaching the generator `COUNT(DISTINCT x)` closes the largest single remaining gap in one change** and is a query-engine change, not a migration one.

### 3.4 No default, and the interaction with §1

**Precedence order** (**[INFER]**, from the product's structure):

1. **The item's formula already contains an aggregate.** An *aggregate calculated item* — `SUM(Sal)*12`, `SUM(Comm)/SUM(Sal)` (`9.0.4\B10270_01.pdf` p. 10-4). Oracle's own rule: such items *"must have their Default Position property set to data point"* and **"must have their Default Aggregate property set to detail"** (p. 10-4) — i.e. **do not aggregate an already-aggregated item.** Also: *"cannot be used in a join"*, *"cannot be used in a mandatory condition"*, *"cannot be used in a hierarchy"*, *"cannot have an item class"*, *"cannot be dragged into a complex folder"*, *"cannot have further aggregation functions applied to them in Discoverer Plus"*. **[DOC]** Six hard constraints a validator can check.
2. **A worksheet total (§3.3)** overrides the EUL default for that total.
3. **The EUL default aggregate**, when the item is on the measure axis.
4. **`DETAIL`, or no default** → project raw; the item is not a measure.

**Interaction with §1** — three ways this feeds the fan-trap decision:

- **`M` in §1.11 is defined by aggregation.** An item that resolves to `DETAIL` is an axis item, not a measure. Get the default wrong and step 5 mis-classifies the query: too few measures → the guard never fires (silent inflation); too many → spurious refusals.
- **Case 1 items are pre-resolved fan traps** (§1.7: *"edit the Formula property of the detail item and explicitly specify the aggregate formula"*). They must not be re-wrapped in step 7, and they carry their own grain.
- **The re-aggregation table in §1.11 step 8 is keyed on the default.** `AVG` and `COUNT DISTINCT` force a refusal (§1.9.1). Right now Neo cannot even tell which items those are, because `agg_function` is NULL everywhere.

**So §3.2's unread column is not a cosmetic gap — it is an input to the §1 guard.**

Also note (`9.0.4\B10270_01.pdf` p. 10-4): *"to calculate a margin, you would use `SUM(Profit)/SUM(Sales)` rather than `Profit/Sales`. Used in a query, the latter would result in `SUM(Profit/Sales)`, which produces a different result."* **The default aggregate wraps the whole formula, not its leaves.** That is a code-level rule, cheap to get wrong.

---

## 4. Hierarchies and drill

### 4.1 Object model

| Table | Role | Grade |
| --- | --- | --- |
| `EUL4_HIERARCHIES` | the hierarchy. PK `HI_ID` | **[SQL]** `Lineage.sql:485-489` |
| `EUL4_HI_NODES` | one row per node. `HN_ID` PK, `HN_HI_ID` → `HI_ID` | **[SQL]** same |
| `EUL4_HI_SEGMENTS` | **parent/child edge list**: `IHS_HI_ID`, `IHS_HN_ID_PARENT`, `IHS_HN_ID_CHILD` | **[SQL]** `Lineage.sql:495-497`, `:597-600` |
| `EUL4_IG_EXP_LINKS` | node → item. `IEL_TYPE='HIL'`, `HIL_HN_ID` → `HIL_EXP_ID` | **[INFER]**, live EUL |
| `EUL4_IHS_FK_LINKS` | segment → the join it crosses (`IHSFKLink`, `EUL.dtd:213-216`) | **[SQL]** |
| `EUL4_DBH_NODES` | date-hierarchy **template** nodes | **[SQL]** `eul4del.sql` |

**A hierarchy is a tree, not a numbered level list.** Oracle's own root-finding cursor:

```sql
-- Lineage.sql:483-490  (EUL5_ names; EUL4_ is identical in shape)
CURSOR GET_HIERTOP IS
  SELECT B.HN_ID
  FROM   EUL5_HIERARCHIES A, EUL5_HI_NODES B, EUL5_HI_SEGMENTS C
  WHERE  A.HI_ID = B.HN_HI_ID
  AND    B.HN_ID = C.IHS_HN_ID_CHILD(+)
  AND    A.HI_ID = HIID
  AND    C.IHS_HI_ID IS NULL;          -- the node that is nobody's child
```

and depth is computed by **recursion up the parent chain**, not read (`EUL5_GET_HIERLVL`, `Lineage.sql:590-615`). **[SQL]** Any target model with a `levelNumber` column must *derive* it.

Levels can be **grouped**: *"To group two or more items so that they appear on the same level of the hierarchy, select the items and click Group"* (`9.0.4\B10270_01.pdf` p. 12-8) **[DOC]** — so a node may bind more than one item. `EUL.dtd:221` (`HierNode (ElementRef*, HNITLink*)`) allows exactly that: many `HNITLink`s per node. A one-item-per-level target model **loses this**.

A hierarchy may **span folders**: *"You can select items from multiple folders but the folders must be joined. If the folders are joined with more than one join, Discoverer will prompt you with the Choose Join dialog"* (p. 12-8) **[DOC]** — which is what `EUL4_IHS_FK_LINKS` records.

### 4.2 Business-area binding — the audit is right, and it is worse than "no column"

**Confirmed. `EUL4_HIERARCHIES` has no business-area column at all.** The live table is `HI_ID, HI_TYPE, HI_NAME, HI_DEVELOPER_KEY, HI_DESCRIPTION, HI_SYS_GENERATED, HI_EXT_HIERARCHY, DBH_DEFAULT, IBH_DBH_ID` plus audit columns (`EUL_SCHEMA_GROUND_TRUTH.md:283-289`). Corroborated structurally: the DTD's `BusinessArea` content model is `(GrantedBusinessArea*, BAOBJLink*, …)` (`EUL.dtd:108-113`) — a business area contains **folder links only**. `ItemHierarchy` and `DateHierarchy` are **top-level children of `EndUserLayerExport`** (`EUL.dtd:83`), siblings of `BusinessArea`, not children. **[SQL]**

**A hierarchy is EUL-scoped, not business-area-scoped.** Its business area is *derived*, and a hierarchy spanning two folders in two business areas has **two**. The link:

```
HIERARCHIES.HI_ID
  → HI_NODES.HN_HI_ID
  → IG_EXP_LINKS (IEL_TYPE = 'HIL', HIL_HN_ID → HIL_EXP_ID)
  → EXPRESSIONS.IT_OBJ_ID
  → BA_OBJ_LINKS → BAS.BA_ID
```

(`EUL_SCHEMA_GROUND_TRUTH.md:283-290`) **[INFER]**, live EUL.

**Consequence:** requiring a single non-null `business_area_id` on a hierarchy is not a migration bug, it is a **model mismatch with the source**. All 508 hierarchies currently migrate as zero. A faithful target makes the association many-to-many, or scopes hierarchies to the EUL and derives visibility.

### 4.3 Date vs item hierarchies, and telling the 508 apart programmatically

**Two different things wearing one table.**

- **Item hierarchy (`IBH`)** — relationships between non-date items, authored by dragging items into an ordered list (`9.0.4\B10270_01.pdf` p. 12-2). Real per-hierarchy authoring.
- **Date hierarchy (`DBH`)** — a **template**. *"Date hierarchy templates enable you to define a date hierarchy that you can apply to date items… A date hierarchy template automatically creates items based on a date item"* (p. 12-5). Applying it to a date item auto-generates `Year`/`Quarter`/`Month`/`Day` items via `EUL_DATE_TRUNC` (p. 12-6). **[DOC]**

The DTD keeps them as distinct top-level elements — `ItemHierarchy` (`EUL.dtd:202-208`) and `DateHierarchy` (`EUL.dtd:227-234`), the latter with `DefaultHierarchy (False|True)` — and both carry `SystemGenerated`. **[SQL]**

**The live split: 502 `IBH` + 6 `DBH` = 508** (`EUL_SCHEMA_GROUND_TRUTH.md:287-289`).

Read that shape: **six date-hierarchy templates, 502 item-based hierarchies.** The overwhelmingly likely structure — **[INFER]** — is that most of the 502 are the auto-generated per-date-item instantiations of those 6 templates, which is exactly what `IBH_DBH_ID` (an item-hierarchy's pointer at its parent date template) is for. That would mean the great majority of this estate's "hierarchies" are boilerplate.

**Three programmatic discriminators, in order of directness:**

```sql
SELECT hi_type,                            -- 'IBH' | 'DBH'
       hi_sys_generated,                   -- Oracle's own flag
       CASE WHEN ibh_dbh_id IS NULL THEN 'authored'
            ELSE 'from date template' END  AS provenance,
       dbh_default,
       COUNT(*)
FROM   eul4_hierarchies
GROUP  BY hi_type, hi_sys_generated,
          CASE WHEN ibh_dbh_id IS NULL THEN 'authored' ELSE 'from date template' END,
          dbh_default
ORDER  BY 5 DESC;
```

1. **`HI_TYPE`** — `DBH` = date template, `IBH` = item-based. **[INFER]**, live column list.
2. **`HI_SYS_GENERATED`** — Oracle's own "I made this, a human did not" flag; the DTD's `SystemGenerated` on both hierarchy elements. **[SQL]** on existence, **[ASSUMED]** on whether it is `'Y'/'N'` or `1/0`.
3. **`IBH_DBH_ID` non-null** — this item hierarchy was instantiated from date template `DBH_DEFAULT`. **[INFER]**.

**This is one read-only query and it is worth running before any hierarchy work is scheduled.** If 496 of 502 are template instantiations, "migrate 508 hierarchies" is really "migrate 6 templates and ~6 authored hierarchies, then regenerate" — a completely different piece of work, and a far smaller one.

**Performance note worth carrying to design** (`9.0.4\B10270_01.pdf` p. 12-6): applying a date hierarchy to an indexed fact-table date column **suppresses index use**, because every level becomes `EUL_DATE_TRUNC(col, …)`. Oracle's own recommendation is to put date hierarchies on a dimension table. A modern target should emit `date_trunc`/`EXTRACT` in a sargable form or provide generated columns — see §9 (MODERN EQUIVALENT).

### 4.4 What drill does to the SQL

**Drill changes the SELECT/GROUP BY level. It is not a new query type.**

Oracle's glossary, `4.1\Discoverer4iPlusUserGuide.pdf` p. G-3 **[DOC]**:

- **drill** — *"To **expand** an item to include items related to it. Oracle Discoverer **may re-query** the database."*
- **drill down** — *"To expand an item to include related items **lower** than it in the hierarchy."*
- **drill up** — *"To expand an item to include the next related item **above** it."*
- **collapse** — *"To remove all levels of related items from below a selected item. In effect, to undo a drilldown."*

Three things follow, and the first is the one implementers get wrong:

1. **Drill *expands*, it does not *replace*.** Drilling Country → Region **adds** Region beside Country. In SQL: append the child level's item to the select list and the GROUP BY, keep the parent. Collapse removes it and everything below.
2. **Out-of-sequence drilling is allowed.** *"you might want to drill into the data from Region directly to Store Name while skipping the drill to City"* (`4.1\Discoverer4iPlusUserGuide.pdf` p. 3-18) **[DOC]**. A drill target is any node in the path, not just the immediate child. Do not hard-code adjacency.
3. **"may re-query"** — a drill *up* to a coarser level over already-fetched data can be satisfied from the client cache. Not a correctness requirement; explains why 4.1 felt fast. A server-side implementation simply re-queries. **SEMANTIC**, §9.

**Drill to detail is a different feature entirely** and must not be conflated. It is an **item class** property (`9.0.4\B10270_01.pdf` §"What is drill to detail?", p. 8-8; §"How to create a drill to detail item class", p. 8-24) — a *link* from an item to related rows, configured on `EUL4_DOMAINS`, not a hierarchy level. §5.

**UNKNOWN:** the emitted SQL for a *drill on a grouped node* (§4.1, multi-item levels) — whether all the level's items enter the GROUP BY together or only the labelled one. No source addresses it. *Settled by:* one grouped hierarchy in a live 4.1 Plus with SQL Inspector open.

---

## 5. Item classes / lists of values

`EUL4_DOMAINS` (`eul4del.sql`; the audit records **20 columns** on the live table, `AUDIT_LEGACY_COMPATIBILITY_MATRIX.md`). Bound to items by `EUL4_EXPRESSIONS.IT_DOM_ID → EUL4_DOMAINS.DOM_ID` (`discoverer_4_1_eul_migration_reference.md:325-331`) **[INFER]**.

### 5.1 What it models — three features, one table

> *"Discoverer uses item classes to implement the following features: **lists of values**; **alternative sorts**; **drill to detail links**. … You can create a different item class for each feature or you can specify that Discoverer uses the same item class for more than one feature. Note that an item class to support an alternative sort must also support a list of values."*
> — `9.0.4\B10270_01.pdf` p. 8-2 **[DOC]**

`EUL4_DOMAINS` is therefore **not** "a list of values table". It is a **shared property bundle** attachable to many items, carrying up to three orthogonal capabilities. A target model with a boolean `has_lov` loses two of them.

The DTD gives the attribute set (`EUL.dtd:253-263`) **[SQL]**:

```
<!ELEMENT Domain (ElementRef*, %COMMON_SUB_ELEMENTS;)*>
<!ATTLIST Domain
        %ELEMENT_PROPERTIES; %NAMED_ELEMENT_PROPERTIES;
        Cached            CDATA #IMPLIED   -- LOV values cached vs re-queried
        Cardinality       CDATA #IMPLIED   -- distinct-value estimate; drives long-LOV UI
        DataType          CDATA #IMPLIED
        LastExecuteTime   CDATA #IMPLIED   -- when the LOV query last ran
        LogicalItemFlag   CDATA #IMPLIED
        SystemGenerated   CDATA #IMPLIED   -- bulk-load generated vs authored
>
```

`ElementRef*` is the crucial part: **a domain points at the item(s) that source it**, and that is how an alternative sort binds *two* items (the sort-order item and the LOV item, which *"must be in the same folder"*, p. 8-4).

### 5.2 How it binds, and to what

- **Item → class:** `EXPRESSIONS.IT_DOM_ID`. Many items share one class — the whole point (*"you only have to define the properties once"*, p. 8-2).
- **Class → source item:** the `Domain`'s `ElementRef`(s).
- **Parameters:** a `Parameter` is an item-flavoured element (`EUL.dtd:158-165`, carrying `%ITEM_PROPERTIES;`) with `AllowMultipleValues`. It picks up its LOV through the item it is defined over, which is why *"A LOV used to specify worksheet parameters"* is a documented case (`10.1.2.1\b13915.pdf` ToC).
- **Where LOVs surface:** *"parameters; conditions; the Discoverer item navigator; the Export dialog"* (`9.0.4\B10270_01.pdf` p. 8-3) **[DOC]**.
- **Values are live, not stored:** *"The values are those values in the database column on which the item is based"* (p. 8-3). An LOV is `SELECT DISTINCT col FROM table` with a cache flag — **not a stored value list.** A target that migrates LOVs as static enums is wrong on day one.
- **LOVs can come from a custom folder:** *"How to create a list of values using a custom folder"* (p. 8-26) — arbitrary SQL behind a dropdown.

### 5.3 What a faithful target needs

```
item_classes (id, name, description,
              source_item_id,          -- the ElementRef; the LOV query's column
              provides_lov  boolean,
              provides_alt_sort boolean, sort_item_id,   -- second item, same folder
              provides_drill_detail boolean,
              cached boolean, cardinality int,
              system_generated boolean, data_type)
items.item_class_id  -> item_classes.id      -- IT_DOM_ID
```

Resolve a LOV as `SELECT DISTINCT <source item> FROM <its folder> ORDER BY <sort item or source>`, honouring `cached` and using `cardinality` to switch to the "long LOV" search UI Oracle documents (`10.1.2.1\b13915.pdf`, *"About using long LOVs"*).

**Current state:** no target table, no code path — `grep -ril 'itemClass|item_class|listOfValues|DOMAINS'` over `backend/src` and `migrate/src` returns nothing (`AUDIT_DETAILED_FINDINGS.md:946-953`). *"A user who had a dropdown of valid cost centres now gets a free-text box."*

**Not settled:** the 20 live column names, and whether the three capabilities are separate boolean columns or one type code. One `ALL_TAB_COLUMNS` query.

---

## 6. Summary folders

### 6.1 What they are — and 4.1 already used materialized views

`EUL4_SUMMARY_OBJS`, `EUL4_SUMO_EXP_USGS`, `EUL4_SUM_BITMAPS`, `EUL4_SUM_RFSH_SETS` (all in `eul4del.sql`). The DTD models a `SummaryRefreshSet` → `SummaryBaseObject` → {`SummaryAxisItem`, `SummaryMeasureItem`, `EulMaterialisedSDO` | `NonMaterialisedView`} (`EUL.dtd:287-358`) **[SQL]**.

`EulMaterialisedSDO` carries `TableName`, `TableOwner`, `DatabaseLink`, `ObjectSQL1..3`, `NumRows`, `NumTimesUsed`, `BitmapPosition`, `JoinState (Valid|Modified|Deleted)`, `RefreshRequired`, and a 19-value `State` enum (`EUL.dtd:328-358`). A summary folder is a **physical object with a lifecycle** — build, refresh, invalidate — not a metadata view.

**The decisive evidence for §6.3** is Oracle's own 4.1 privilege script:

```
E:\claude\discoverer\discoverer10g\sql\eulasm.sql:1-2
  REM This script sets up privileges required for Summary Management (and ASM) in
  REM Discoverer Administration Edition 4.1
...:14-20
  grant CREATE TABLE / CREATE VIEW / CREATE PROCEDURE to &Username;
  REM These privs are only required if using Oracle 8.1.6 and above
  grant analyze any                    to &Username;
  grant create any materialized view   to &Username;
  grant drop  any materialized view    to &Username;
  grant alter any materialized view    to &Username;
  grant global query rewrite           to &Username;
```

**[SQL]** — Discoverer 4.1, on Oracle 8.1.6+, **created real materialized views and relied on the database's own `QUERY REWRITE`**. On older servers it fell back to its own summary tables and did the redirection itself.

**ASM = Automated Summary Management**, not Application Security Manager. Confirmed by `eulasm.sql:1-2` and by the Administration Guide's chapter 13, *"What is Automated Summary Management (ASM)"*, *"What is the ASM policy?"* (`9.0.4\B10270_01.pdf` pp. 13-5…13-8). **This matters for §8** — see there.

### 6.2 How the redirect was decided

> *"Discoverer rewrites a query to use a summary table instead of the detail data when **all** of the following conditions are met:*
> - *All the items specified in a query must either exist in a single summary combination, or be able to be joined to a summary table via foreign keys that exist in a summary combination*
> - *Where derived items are used, you must include in the summary combination the derived items and the components used to create the derived items*
> - *Where items are from complex folders, create another summary folder using the same combination of items, but from the source (simple) folders*
> - ***Join paths specified in the query must match those specified in the summary combination that satisfies the query.** This ensures that the summary result set data matches that in the detail data tables. However, you can define queries using fewer joins than specified in the summary table, provided that you select the **Detail item values always exist in the master folder** radio button*
> - *The summary folder must have the **Available for Queries** property set to Yes*
> - *The conditions specified on the Query Governor tab … must be met*
> - *The Discoverer end user running the query must have database SELECT access to the summary table"*
> — `9.0.4\B10270_01.pdf` §"What are the conditions for query rewrite by Discoverer?", pp. 15-2…15-3 **[DOC]**

Plus a **relational-equivalence** test on expressions (p. 14-9) **[DOC]** — given a summary holding `SUM(Salary)` and `SUM(Comm)`:

| Expression | Uses summary? | Why |
| --- | --- | --- |
| `SUM(Salary) * 12` | **Yes** | outer arithmetic over a summarised aggregate |
| `NVL(SUM(Comm),0)` | **Yes** | same |
| `SUM(Salary + Comm)` | **No** | *"not relationally equal to `SUM(Salary) + SUM(Comm)`… Because the results could be wrong, the expression will not be used"* |
| `SUM(NVL(Comm,0))` | **No** | same |

**Refusing to redirect when equivalence cannot be proven is the same instinct as §1.5.** Discoverer would rather be slow than wrong. That is the behaviour to carry forward, whatever the mechanism.

Two more rules worth keeping:

- **Hierarchy roll-up:** *"You do not have to include items at all levels of a hierarchy… If you include items at the bottom level, queries that use items higher up in the hierarchy can still use the summary table. However, for this to work the summary folder must contain a foreign key to the folder that contains the hierarchy"* (p. 14-8) **[DOC]**.
- **Never across a nullable join:** *"Discoverer will **never** use a summary folder to satisfy a query that uses a join with the **Detail item values might not exist in master folder** option selected"* (p. 9-13) **[DOC]**. §2.3's `Mandatory` flag has teeth.

### 6.3 Reproduce, or replace? — **Replace. MODERN EQUIVALENT.**

**Recommendation: do not port Discoverer's summary engine. Use materialized views with database query rewrite. This is not a compromise — it is what Discoverer 4.1 itself did on any server from 8.1.6 onward (`eulasm.sql:14-20`).**

Reasons, in order of weight:

1. **It is the same mechanism.** Porting a hand-rolled redirector would be reimplementing, in application code, a thing Oracle had already delegated to the database by 4.1.
2. **The rewrite rules are the database's job and it is better at them.** Every rule in §6.2 — item coverage, join-path matching, expression equivalence — is standard MV query-rewrite eligibility. Postgres has no automatic MV rewrite, so this becomes an explicit candidate-matching step; but the *rule set* is textbook and well-specified, not Discoverer-specific.
3. **The lifecycle is already someone else's problem.** `State`'s 19 values, `RefreshRequired`, `JoinState`, `NumTimesUsed`, `SUM_RFSH_SETS`, `SUM_BITMAPS` — all of it is build/refresh/invalidate bookkeeping that a scheduled `REFRESH MATERIALIZED VIEW` plus a metadata row subsumes.
4. **ASM's *recommendation* engine is genuinely obsolete.** ASM sized summaries from table analysis, query statistics and a space budget (`9.0.4\B10270_01.pdf` p. 13-5). Modern equivalents (query-store-driven advisors) or simply not doing it are both fine. Neo *does* have the raw material — `EUL4_QPP_STATS`, 7 316 recorded executions — but as a **migration-time input to sizing**, not as a runtime engine.

**What must carry over, though, is the refusal.** The equivalence test (§6.2) is the part with correctness weight. A redirector that fires on `SUM(Salary + Comm)` returns a wrong number. Any Neo MV-matching must have the same conservative bias, and the same "never across a nullable join" rule.

**What to migrate:** the summary *definitions* (which items at which grain), as MV DDL proposals plus an inventory, and `SUM_RFSH_SETS` schedules as refresh jobs. **MANUAL** at cutover — a DBA reviews the DDL. Not **UNSUPPORTED**: the definitions encode real, hard-won knowledge of what this estate queries.

---

## 7. Conditions

### 7.1 Two homes, and the EUL one is empty here

- **Folder-level conditions** live in the EUL as `Filter` elements on a folder (`EUL.dtd:180-190`).
- **Worksheet conditions** live in the `.DIS` body.

**On this estate the EUL holds none.** `EXP_TYPE` is `CO` / `CI` / `JP` only (§2.5). All **5 605** migrated conditions come from workbook bodies (`EUL_SCHEMA_GROUND_TRUTH.md:273-277`) **[INFER]**. Both paths still need building — the next EUL may differ — but the volume is in the workbooks.

### 7.2 The EUL `Filter` model

```
E:\claude\discoverer\discoverer10g\sql\EUL.dtd:180-190
<!ELEMENT Filter (ElementRef*, Formula*, %COMMON_SUB_ELEMENTS;)*>
<!ATTLIST Filter
        %ELEMENT_PROPERTIES; %NAMED_ELEMENT_PROPERTIES;
        DataType CDATA #IMPLIED
        ExternalFilterName CDATA #IMPLIED
        Sequence CDATA #IMPLIED
        ApplicationType (Unselected | Selected | AlwaysSelected) "Unselected"
        RuntimeFilter (False | True) "False"
        CaseSensitive (False | True) "False"
>
```

**[SQL]**, and three attributes carry real behaviour:

- **`ApplicationType`** — the condition *type*:
  - `AlwaysSelected` = **mandatory**. *"mandatory conditions are always applied to a worksheet that contains one or more items from the folder that contains the condition. Discoverer Plus users are not notified of mandatory conditions and can not turn them off"* (`9.0.4\B10270_01.pdf` p. 11-3) **[DOC]**. This is the RLS mechanism — §8.
  - `Selected` = optional, on by default. `Unselected` = offered, off.
- **`CaseSensitive`** — **explicit, per condition, default `False`.** So Discoverer's default string comparison is **case-insensitive**, which Oracle implemented via the item's `CaseStorage (Unknown|Upper|Lower|Mixed)` property (`EUL.dtd:31`): *"Setting this value can improve the user's performance when running queries with conditions. If the data is always stored in uppercase in the database, set the value to uppercase"* (`10.1.2\B13916-02.pdf` Item Properties, "Case Storage") **[DOC]**. **A target on a case-sensitive collation that ignores this silently returns fewer rows.**
- **`RuntimeFilter`** — prompts at run time; a parameter in condition clothing.

Mandatory conditions **propagate through complex folders**: *"A complex folder built using this folder will reflect the restricted set of data of the source folder. If you later remove the mandatory condition from the source folder, the change is reflected in the complex folder"* (`9.0.4\B10270_01.pdf` p. 5-6) **[DOC]**. Dynamic inheritance, not a copy.

### 7.3 The workbook condition tree — fully decoded

Every workbook condition is stored **twice**: display text (`0x00fc`) and a token tree (`0x00ff`). **Only the tree is authoritative** — the display string is cut at 100 characters and **272 of 3 395** conditions are truncated mid-expression (`EUL_SCHEMA_GROUND_TRUTH.md:455-460`) **[INFER]**. Never parse the string.

```
[1,92]([6,28],[8,65],[8,29])              Dt Provisao BETWEEN :Dt Inicio AND :Dt Fim
[1,88]([6,85],[5,2,"15"],[5,2,"16"])      Cdestado IN (15,16)
[1,98]([1,86]([6,30],[8,51]),             DT_ANULACAO >= :"Dt Cancelamento >=" AND
       [1,85]([6,30],[8,52]))             DT_ANULACAO <= :"Dt Cancelamento <="
```

| Node | Meaning |
| --- | --- |
| `[1,n]` | built-in operator/function — `n` is `EUL4_FUNCTIONS.FUN_ID` |
| `[2,n]` | custom PL/SQL function, `n` an element id in this workbook |
| `[5,k,"…"]` | literal; `k` = 1 string, 2 number, 4 date |
| `[6,n]` | item element |
| `[8,n]` | parameter element |

**The function table is recovered, not guessed.** `DISCVR4\DCESQRES.DLL` carries the EUL seed script as literal `insert into EUL4_FUNCTIONS (…) VALUES (…)` text; extracting it gives **222 built-ins, identical row for row to the live `EUL4_FUNCTIONS`** (`EUL_SCHEMA_GROUND_TRUTH.md:484-492`). **[BINARY]** Ids above 222 are customer-defined (this estate's start at 112 777) and are reached through `[2,n]`.

`FUN_FUNCTION_TYPE` decides a node's role: **1** comparison predicate, **3** logical connective, anything else a value function — *which is what makes a boolean position in the tree decidable rather than guessed*. Types 1 and 3 in full:

| | | | | | |
| --- | --- | --- | --- | --- | --- |
| 81 `=` | 89 `IS NULL` | 99 `OR` | 82 `<>` | 90 `IS NOT NULL` | 100 `NOT LIKE` |
| 83 `>` | 91 `NOT IN` | 101 `NOT` | 84 `<` | 92 `BETWEEN` | 104 `!=` |
| 85 `<=` | 93 `NOT BETWEEN` | 105 `^=` | 86 `>=` | 98 `AND` | 123 `EXISTS` |
| 87 `LIKE` | 88 `IN` | 124 `ANY` | | | 125 `ALL` |

### 7.4 `NOT`

**`[1,101]` is the negation**, and it is the token-language spelling of a per-node flag in Oracle's own object model: `DCBImportedFilterNode::IsNot` in `DISCVR4\DCBIMPB.DLL`, set via `SetNot`, read by `BuildFilterString` (`EUL_SCHEMA_GROUND_TRUTH.md:513-518`) **[BINARY]**. The other negated forms fold negation into the operator name (`NOT IN`, `NOT LIKE`, `NOT BETWEEN`, `IS NOT NULL`).

So the source model is **`NOT` as a node flag, not a node**. A faithful target needs a `negated` boolean on every tree node, which is strictly more expressive than a `logic_operator ∈ {AND, OR}` enum.

Current behaviour is to **refuse** a `NOT` rather than migrate what it negates (`workbook-parser.test.ts:325,331`). That is right — *"dropping a negation replaces a filter with its complement, and a reviewer looking at row counts would not notice."* Refusal is correct; it is also a hard ceiling until the flag exists.

### 7.5 Nesting — measured, and shallower than anyone assumes

All 3 395 conditions of the live source (`EUL_SCHEMA_GROUND_TRUTH.md:527-540`) **[INFER]**:

| Boolean depth | Shape | Definitions | Instances | |
| --- | --- | ---: | ---: | ---: |
| 0 | a single test | 2 931 | 6 798 | 92.6 % |
| 1 | flat `AND` | 361 | 430 | 5.9 % |
| 1 | flat `OR` | 101 | 103 | 1.4 % |
| 2 | `OR` of `AND`s | 2 | 7 | 0.1 % |
| ≥ 3 | — | 0 | 0 | 0 % |

**The deepest thing in a 558-workbook EUL is two levels**, and depth 2 is seven instances. This is why a flat `group_id` + `logic_operator` model works today. It is *also* why the **§8 RLS pattern is exactly the depth-2 shape** — an `OR` of `(user AND data)` pairs — so those seven are worth looking at individually.

**Build the real tree anyway.** The parser already produces one; storing it flat is the lossy step. A `parent_id` plus a `negated` flag closes §7.4 and depth ≥ 3 at once, and the data says the migration cost is seven rows.

### 7.6 Conditions on calculations

Supported, with one carve-out: an **aggregate** calculated item *"cannot be used in a mandatory condition"* (`9.0.4\B10270_01.pdf` p. 10-4) **[DOC]** — a folder-level filter cannot reference something whose value depends on the worksheet's grouping. Non-aggregate derived items are fine, and `[6,n]` addresses any item, `CO` or `CI`, uniformly.

Discoverer also has a documented interaction between conditions on **truncated date items** and correctness (`9.0.4\B10270_01.pdf` §"About applying conditions to truncated date items", p. 8-11) — relevant because every date-hierarchy level is a `EUL_DATE_TRUNC` call (§4.3). **Read that section before implementing date-level filters.** I have not traced it.

### 7.7 Correlated subqueries — `EUL4_SUB_QUERIES` / `EUL4_SQ_CRRLTNS`

Both tables exist (`eul4del.sql`). The audit records **15** and **10** columns respectively (`AUDIT_LEGACY_COMPATIBILITY_MATRIX.md:59`), and the operators `EXISTS` (123), `ANY` (124), `ALL` (125) in the function table (§7.3) are exactly the subquery operators. **[BINARY]** on the operators; the tables' contents are **UNKNOWN** — no reader exists and nothing offline describes their columns.

Shape a faithful target needs, **[INFER]** from the operator set and the names:

```
condition_node
  ├ kind: PREDICATE | LOGICAL | SUBQUERY
  ├ negated: boolean                        -- DCBImportedFilterNode::IsNot
  ├ function_id: int                         -- EUL4_FUNCTIONS.FUN_ID
  ├ children: condition_node[]               -- ordered
  └ operand: ITEM(exp_id) | PARAM(id) | LITERAL(type, value) | SUBQUERY(ref)

subquery
  ├ source: folder / SQL
  ├ projected item
  └ correlations[]:  outer item  <op>  inner item   -- EUL4_SQ_CRRLTNS
```

*Settled by:* `ALL_TAB_COLUMNS` on both tables plus `SELECT *` — 15 rows in `SUB_QUERIES` per the audit's column count is a table small enough to read whole. Until then, **refuse and report**, do not approximate: a subquery flattened to a join changes the row count.

---

## 8. Security Manager conditions — **the premise needs correcting first**

### 8.1 `EUL4_ASM_POLICIES` is Automated Summary Management, not row-level security

The brief asks how `EUL4_ASM_POLICIES` / `EUL4_ASMP_CONS` implemented row-level security. **They did not.** Three independent proofs:

1. **`eulasm.sql:1-2`** — *"This script sets up privileges required for **Summary Management (and ASM)** in Discoverer Administration Edition 4.1"* — and it grants `create any materialized view`, `analyze any`, `global query rewrite`. **[SQL]**
2. **The Administration Guide's ASM chapter is chapter 13, "Managing summary folders"** — *"What is Automated Summary Management (ASM)"*, *"How does ASM work?"*, *"What is the ASM policy?"*: *"The ASM policy is a set of user defined constraints and options that enable you to control how ASM behaves and **what summary folders it produces**… divided into space options and advanced settings… The minimum information required for an ASM policy is a **tablespace name and an allocated amount of disc space**"* (`9.0.4\B10270_01.pdf` pp. 13-5, 13-8). **[DOC]**
3. **The DTD's `ASMPolicy` content model has no user or predicate:**
   ```
   E:\claude\discoverer\discoverer10g\sql\EUL.dtd:385-399
   <!ELEMENT ASMPolicy (ASMPSummaryObjectConstraint*, ASMPObjectConstraint*, %COMMON_SUB_ELEMENTS;)*>
   <!ELEMENT ASMPObjectConstraint (ElementRef*, …)>        <!-- ConstraintType + refs -->
   <!ELEMENT ASMPSummaryObjectConstraint (ElementRef*, …)> <!-- ConstraintType + refs -->
   ```
   Constraints on **folders** and **summary objects** — *"include/exclude this folder from summarisation"*. There is exactly **one** `ASMPolicy` per EUL (`ASMPolicy?`, singular optional, `EUL.dtd:83`). A per-EUL singleton cannot be per-user security. **[SQL]**

   (`ASMPUserConstraint` is *declared* at `EUL.dtd:400-403` but referenced by no content model — a dangling element, and even it carries only `%ELEMENT_PROPERTIES;`, no predicate.)

**Therefore: the audit's F-27 line — `EUL4_ASM_POLICIES` as unmigrated "Security Manager conditions", MUST/P1 (`AUDIT_LEGACY_COMPATIBILITY_MATRIX.md:64`) — is a misattribution.** Building an RLS reader against `ASM_POLICIES` would produce an empty or nonsensical policy set and, worse, a **false sense that RLS had been migrated**. The audit itself half-caught this: it found the *"8 Security Manager condition(s)"* warning was a seeded test artefact (`AUDIT_DETAILED_FINDINGS.md:1698-1706`). The remaining error is the table attribution.

Migrating `ASM_POLICIES` is still worth doing — as **§6 input**, capturing which folders the administrator excluded from summarisation. Low priority.

### 8.2 What Discoverer 4.1 row-level security actually was

**A mandatory advanced condition on a folder, whose predicate compares Oracle's `USER` to a hard-coded user list.** Oracle documents the whole construction: `9.0.4\B10270_01.pdf` §*"How to create row level security using a mandatory condition"*, pp. 11-15…11-19 **[DOC]**. Four steps:

1. **Load `SYS.ALL_USERS`** into the business area (*"contains the names of all database user accounts"*), then set the folder's *Visible to user* = No so end users never see it.
2. **Create a calculated item** in the folder to be secured: name `Username`, formula **`USER`** — Oracle's built-in session-user function.
3. **Create an item class (LOV)** over `ALL_USERS.Username` and apply it to that calculated item, so the administrator picks users from a dropdown. (§5 — item classes are a *dependency* of RLS.)
4. **Create a Mandatory advanced condition** pairing users with data:
   > *"The Username and Region condition statements **must be grouped together using the AND clause**… Pairs of Username/data condition statements **must group together with other pairs using the OR clause**."*

   Then set the condition's *Visible to user* = No: *"This ensures that Discoverer does not display the condition to end users, but it is always enforced."*

Predicate shape:

```sql
(USER IN ('ADMTEST','SMITH')   AND Store.Region = 'West')
OR
(USER IN ('JONES')             AND Store.Region = 'East')
```

**This is exactly the depth-2 `OR`-of-`AND`s shape §7.5 measured at seven instances in this estate.** Those seven are the first place to look for surviving RLS.

### 8.3 How the predicate was injected

- **Binding is folder-scoped, not user-scoped.** The condition lives on the folder (`Filter` under `SimpleObject`/`ComplexObject`, `EUL.dtd:129`, `:143`). The *user* appears only inside the predicate.
- **Trigger:** *"mandatory conditions are always applied to a worksheet that contains one or more items from the folder that contains the condition"* (p. 11-3). **Item presence from the folder is the trigger**, not folder selection.
- **Not suppressible:** *"Discoverer Plus users are not notified of mandatory conditions and can not turn them off"* (p. 11-3).
- **Inherited by complex folders**, dynamically (§7.2).
- **Evaluated by the database**, because the predicate is literally Oracle's `USER`. The application never resolves identity — it emits `USER` and the server binds it.
- **`ApplicationType = AlwaysSelected`** is the storage (`EUL.dtd:187`).

### 8.4 The two failure modes, both documented

1. **Summary folders bypass RLS.** *"When you create a mandatory condition in a folder, database user queries **must not** use a summary folder that is based upon the folder that contains the mandatory condition. This is because the data in the summary table will be only for the database user that created the summary folder"* (p. 11-20) **[DOC]**. Oracle's own workaround is to build the summary, set *Available for Queries* = No, wrap it in a database view carrying the predicate, and re-register that view as an external summary.

   **This is a real, exploitable interaction and it must be a hard rule in Neo: a cache, materialized view, or summary derived from an RLS-bearing folder is not queryable by anyone but its creator unless the predicate is inside it.** Get this wrong and the fastest path through the system is also the one that leaks.
2. **Fails open by construction.** No mandatory condition ⇒ no predicate ⇒ all rows. There is no deny-by-default. The audit flags Neo's equivalent as *"unverified and important"* (`AUDIT_LEGACY_COMPATIBILITY_MATRIX.md:111`).

### 8.5 What this means for Neo's RLS design

**Do not port the mechanism. Port the intent, and improve it — deliberately.**

Discoverer's RLS is a hard-coded username↔value list inside a filter expression. It has no roles, no groups, no inheritance; adding a user means editing a condition in Administrator; and it fails open. Rebuilding that in 2026 would be reproducing an anti-pattern.

- **Migration (MANUAL):** detect folders with `ApplicationType = AlwaysSelected` whose predicate references `USER` or an item whose formula is `USER`; extract the (user set → data predicate) pairs into `security_policies` / `security_policy_rules` / `security_policy_assignments` (all three exist and are empty, `AUDIT_LEGACY_COMPATIBILITY_MATRIX.md:111`). **Report every one for human review** — these are security rules and an inferred one is worse than an absent one.
- **Runtime (MODERN EQUIVALENT):** policies bound to *roles*, resolved from the session principal, injected as a predicate on the folder — same folder-scoped, non-suppressible, item-presence-triggered semantics as §8.3, different identity model.
- **Fail closed, and test it.** A folder marked RLS-governed with no applicable policy must return **zero rows**, not all rows. This is the one place to deliberately break compatibility. Say so in the migration report.
- **Carry rule 8.4.1 forward as an invariant**, tested.

---

## 9. Compatibility classification

**EXACT** = reproduce bit-for-bit · **SEMANTIC** = same result, different mechanism · **MODERN EQUIVALENT** = deliberately different, better · **UNSUPPORTED** = will not do · **MANUAL** = human intervention at cutover.

### 9.1 Fan traps and aggregation

| Behaviour | Class | Justification |
| --- | --- | --- |
| Fan-trap **detection** (§1.11 steps 1–5a) | **EXACT** | The trigger condition is arithmetic; any variation silently changes numbers. |
| Four **refusal** conditions R1–R4 (§1.5) | **EXACT** | Refusing where Discoverer refused is the only way to guarantee no query returns a number Discoverer would not have. |
| Inline-view **rewrite shape** (§1.4) | **SEMANTIC** | Same decomposition; CTEs and ANSI `LEFT JOIN` instead of nested inline views and `(+)`. Result identical, plan better, SQL readable. |
| `OneToOne` as the sole cardinality source (§1.2) | **EXACT** | Declared, not measured. Substituting statistics changes behaviour as data changes — non-determinism in a correctness guard. |
| Master-side measure with one fanning branch (§1.11 5a) | **SEMANTIC** | Oracle never documents it; the arithmetic is identical and the audit's £2.4M→£9.6M case is exactly this. Guard is strictly wider than the documented one. |
| Totals across mixed grain render NULL (§1.6) | **EXACT** | The alternative is a wrong number in the most-read cell of the report. |
| `AVG` / `COUNT DISTINCT` across a fan | **UNSUPPORTED** *(interim)* | Not re-aggregatable without decomposition Oracle does not document (§1.9.1). Refuse loudly; promote to SEMANTIC once §1.9.1 is settled. |
| Non-equi join inside a fan branch | **UNSUPPORTED** | No groupable key; no correct rewrite exists. |
| `DisableFanTrapDetection` user switch | **UNSUPPORTED** | A user-facing toggle for "return wrong numbers faster" has no place in a new product. Default-on is the only mode. |
| Chasm traps as a separate concept | **SEMANTIC** | 4.1 folds them into fan traps under one switch (§1.10); the §1.11 predicate covers both. |

### 9.2 Joins

| Behaviour | Class | Justification |
| --- | --- | --- |
| Folder-to-folder binding, `KEY_ID` identity | **EXACT** | The source model; item-pair joins are the fabrication that caused the original defect. |
| Master/detail **orientation** (§2.2) | **EXACT** | Decides which side enters the inline view. An inversion is silent and wrong. **Resolve the repo's internal disagreement first.** |
| Four flags stored independently (§2.3) | **EXACT** | Two outer switches + `OneToOne` + `Mandatory` cannot fit a 4-value enum, and `OneToOne` is a §1 input. |
| `join_type` derived, not stored | **SEMANTIC** | One source of truth; today's `INNER` is a probe default, not a reading. |
| `(+)` outer-join syntax | **SEMANTIC** | ANSI `LEFT`/`RIGHT JOIN`. Same rows. |
| `FULL OUTER` from both flags true | **UNSUPPORTED** *(pending)* | No vendor text; Oracle 8 `(+)` cannot express it. Warn until an SME confirms it is settable. |
| Multi-column predicates, ANDed by `seq` | **EXACT** | Dropping a component changes the row set. |
| Non-equi operators `<`,`>`,`<=`,`>=`,`<>` | **EXACT** | Documented product feature (p. 24-91). |
| Join trimming under `Mandatory` + `SQLJoinTrim` | **SEMANTIC** | Same rows via the planner, or replicate the rule. Both conditions required. |
| Worksheet forced joins (`0x0118`) | **EXACT** | 24 instances; a persisted human decision. Overriding it changes the report. |
| Multiple-join-path detection | **MODERN EQUIVALENT** | 4.1 default was *off* (all paths used). Make ambiguity an explicit, surfaced choice. |
| `raw_formula` escape hatch for undecodable `JP` | **MANUAL** | Store verbatim, refuse to generate, report. |

### 9.3 Aggregation, hierarchies, item classes

| Behaviour | Class | Justification |
| --- | --- | --- |
| Default aggregate `SUM/MAX/MIN/COUNT/AVG/DETAIL` | **EXACT** | Determines measure-vs-axis, hence §1's trigger. |
| Default aggregate wraps whole formula (§3.4) | **EXACT** | `SUM(P)/SUM(S)` ≠ `SUM(P/S)`. Oracle says so explicitly. |
| Aggregate calculated items not re-aggregated | **EXACT** | Oracle's own six restrictions (p. 10-4); double aggregation is a wrong number. |
| Worksheet `EDCBAggregateType` 1/2/3/4 | **EXACT** | Established from the live corpus; 19 335 of 19 639 totals. |
| Codes 5, 6, 9 (22 totals) | **MANUAL** | Three authoring decisions; carry raw code + label, ask a human. |
| `COUNT DISTINCT` in the generator | **SEMANTIC** *(to build)* | Decoded but inexpressible; `COUNT(DISTINCT x)` closes 282 totals in one change. |
| Hierarchy as parent/child tree, depth derived | **EXACT** | Oracle's own `GET_HIERTOP`/`GET_HIERLVL` recursion. A `levelNumber` column is an invention. |
| Multi-item grouped levels | **EXACT** | `HierNode` allows many `HNITLink`s; one-item-per-level loses data. |
| Hierarchy↔BA many-to-many, derived | **SEMANTIC** | The source has no BA column; requiring one skips all 508. |
| Date hierarchy as reusable template + `IBH_DBH_ID` | **EXACT** | 6 templates and 502 instantiations is the estate's actual shape; flattening loses the generator. |
| `SystemGenerated` boilerplate distinguishable | **EXACT** | Determines whether 502 hierarchies are migrated or regenerated. |
| Drill = expand (not replace), out-of-sequence allowed | **EXACT** | User-visible semantics; replace-instead-of-expand changes every drilled report. |
| Client-side drill-up from cache | **SEMANTIC** | Re-query. Same numbers. |
| `EUL_DATE_TRUNC` per level | **MODERN EQUIVALENT** | Emit sargable `date_trunc`/generated columns; fixes Oracle's own documented index-suppression problem (p. 12-6). |
| Drill to detail (item-class link) | **SEMANTIC** | Same navigation, modern link model. |
| Item class = shared bundle of LOV + alt-sort + drill | **EXACT** | Three orthogonal capabilities; a `has_lov` boolean loses two. |
| LOV = live `SELECT DISTINCT`, not stored values | **EXACT** | Migrating as a static enum is stale on day one. |
| Long-LOV switch on `Cardinality` | **SEMANTIC** | Same UX intent, modern search-as-you-type. |
| Alternative sort via paired items | **EXACT** | Loses the author's intended ordering otherwise. |

### 9.4 Summaries, conditions, security

| Behaviour | Class | Justification |
| --- | --- | --- |
| Summary redirection engine | **MODERN EQUIVALENT** | MVs + query rewrite is what 4.1 itself used on 8.1.6+ (`eulasm.sql:14-20`). |
| Expression-equivalence refusal (§6.2) | **EXACT** | `SUM(a+b)` ≠ `SUM(a)+SUM(b)`. Correctness, not optimisation. |
| Never summarise across a nullable join | **EXACT** | Documented absolute; the summary's row set differs from detail. |
| Hierarchy roll-up from bottom-level summary + FK | **SEMANTIC** | Same eligibility rule, planner's job. |
| ASM recommendation engine | **UNSUPPORTED** | Obsolete. Use `QPP_STATS` (7 316 executions) as a *sizing input* at migration time. |
| Summary definitions → MV DDL | **MANUAL** | DBA reviews; the definitions encode real workload knowledge. |
| `SUM_RFSH_SETS` schedules | **SEMANTIC** | Refresh jobs. |
| Condition token tree (222 functions, `FUN_FUNCTION_TYPE`) | **EXACT** | Recovered from Oracle's own DLL; row-for-row identical to the live table. |
| `NOT` as per-node flag (`IsNot`) | **EXACT** | Oracle's own object model; dropping a negation inverts a filter invisibly. |
| Refusing `NOT` until the flag exists | **MANUAL** *(interim)* | Correct today, a ceiling. Promote to EXACT once `negated` is stored. |
| Nested trees to arbitrary depth | **EXACT** | Source is depth ≤ 2 (7 instances), so the cost is tiny and the ceiling disappears. |
| `CaseSensitive` default False + `CaseStorage` | **EXACT** | Ignoring it on a case-sensitive collation silently returns fewer rows. |
| Mandatory conditions: always-on, invisible, inherited | **EXACT** | It is the security mechanism (§8). |
| Aggregate calc items barred from mandatory conditions | **EXACT** | Oracle's restriction; a validator rule. |
| Correlated subqueries | **UNSUPPORTED** *(interim)* | 15/10 columns, no reader, no offline spec. Refuse and report; flattening to a join changes row counts. |
| `EUL4_ASM_POLICIES` as RLS | **UNSUPPORTED** | **It is not RLS** (§8.1). Do not build it. Migrate as §6 summarisation constraints, low priority. |
| RLS via `USER`-comparing mandatory condition | **MANUAL** | Detect, extract, **report every one for human review**. An inferred security rule is worse than an absent one. |
| Role-based policy runtime | **MODERN EQUIVALENT** | Same folder-scoped, non-suppressible, item-triggered semantics; roles instead of hard-coded usernames. |
| Fail-open with no policy | **UNSUPPORTED** — deliberately | Fail closed. The one place to break compatibility on purpose. Document it. |
| Summary-bypasses-RLS interaction (§8.4.1) | **EXACT** — as an invariant | A cache derived from an RLS folder must carry the predicate or be unqueryable. Tested. |
| Query governor (`QPP_STATS` cost estimate, row cap) | **MODERN EQUIVALENT** | Statement timeouts + row limits. |

---

## 10. Validation hooks

Every hook below uses evidence **already in this repository** or a read-only query against the live EUL. None requires a running Discoverer 4.1.

### 10.1 Fan traps — the one that must not be skipped

**H1 — Golden-number fixture from Oracle's own worked example.** `9.0.4\B10270_01.pdf` figs. 9-19 / 9-20 give both answers for the same data: correct (Account 1 = 400 sales / 400 budget) and naive (800 / 1200). Build ACCOUNT/SALES/BUDGET as a test fixture. **Two assertions: Neo returns the correct numbers, *and* a detection-disabled control path returns Oracle's exact wrong numbers.** The second matters — it proves the fixture actually contains a fan trap and the test is not passing vacuously. This is the single highest-value test in the whole plan.

**H2 — The four refusals, one fixture each.** R1 different keys, R2 detail–detail join, R3 axis items from two details, R4 two masters. Assert refusal *and* the rule name.

**H3 — The £2.4M case, from this estate's real metadata.** `M M67 / M M67 1` and `M M27 / M M27 1` are real joins here. Header measure + detail filter must not multiply. Assert against a `GROUP BY` over the header alone.

**H4 — `EDCBAggregateType` census as a regression baseline.** A read-only pass over every `DOC_DOCUMENT` must find **19 639** summaries with the distribution `1`×19 085, `4`×282, `3`×215, `2`×35, `6`×17, `5`×4, `9`×1 (`EUL_SCHEMA_GROUND_TRUTH.md:1868-1871`). Any drift means the parser moved.

**H5 — Decision-log invariant.** Every executed query records FLAT / REWRITE(n) / REFUSE(rule) (§1.11 step 10). Over all 923 maps, assert **zero** queries reach FLAT while satisfying the step-5 predicate. This catches the guard silently ceasing to fire — the failure mode a golden-number test cannot see.

**H6 — Aggregate monotonicity.** For any query, the sum of a measure must not exceed the sum of that measure over its own folder alone. A cheap, universal, always-on inflation detector that needs no reference values. **Run it over all 923 maps as a smoke test.**

### 10.2 Joins

**H7 — Orientation, from Oracle's own dump tool.** 25 `EUL Join Reference` records across `E:\claude\discoverer\d4dumps\*.txt` give join name (`M M27 -> M M27 1`) and owning folder. Assert Neo's stored master/detail matches for all 25, *and* matches the `KEY_CONS` query in §2.2. **This is the test that catches the inversion.**

**H8 — Forced joins.** 24 `0x0118` refs, 6 in `DISCVR4\VIDAF4.DIS`. Parse-and-compare against `d4wkdmp -f` output; all four fields already agree 24/24. Assert the *query planner* honours them, not merely that the parser reads them.

**H9 — Flag round-trip.** After the §1.2 `ALL_TAB_COLUMNS` probe, assert all four flags are non-null on all 10 joins and that `join_type` derives correctly from the two outer booleans. `INNER` on all 10 is currently a **probe default**, not a reading — the test must distinguish "read as INNER" from "defaulted to INNER".

### 10.3 Everything else

**H10 — Item aggregation coverage.** After adding the probed column, assert `COUNT(*) FILTER (WHERE agg_function IS NOT NULL)` on `items` is materially > 0 (today 0 of 9 626), and that the 552 NULL `map_totals` rows shrink.

**H11 — Hierarchy census.** Run the §4.3 query. Assert 502 `IBH` + 6 `DBH` = 508, and record the authored-vs-generated split. **Then assert Neo migrates a non-zero number** — today it is 0 of 508.

**H12 — Hierarchy tree shape against Oracle's own algorithm.** Port `GET_HIERTOP` (`Lineage.sql:483-490`) and `EUL5_GET_HIERLVL` (`Lineage.sql:590-615`) as test oracles; assert Neo's derived roots and depths match for all 508.

**H13 — Condition tree parity.** All 3 395 conditions parse with no failures and no trailing input; the depth histogram matches §7.5 exactly (2 931 / 361 / 101 / 2). Any change is a parser regression.

**H14 — Function table.** Extract `EUL4_FUNCTIONS` inserts from `DISCVR4\DCESQRES.DLL` and assert row-for-row equality with the live table's first 222 rows. Already done once; make it a test.

**H15 — Corpus round-trip.** `d4wkdmp-differ.ts` against the 552 reference dumps in `E:\claude\discoverer\d4dumps\` plus `DISCVR4\VIDSTR4.DIS` and `VIDAF4.DIS`. `VIDSTR4.DIS` is the **only** artefact carrying a shared EUL filter reference (`0x00f9`) — absent from all 564 live workbooks — so it is the only regression test that path will ever have. **Guard it.**

**H16 — RLS fail-closed.** A folder marked RLS-governed, principal with no applicable policy, **zero rows**. And the §8.4.1 invariant: a summary/MV/cache derived from an RLS-bearing folder must either carry the predicate or be unqueryable.

**H17 — Workload replay from `EUL4_QPP_STATS`.** 7 316 recorded executions with workbook name, owner, elapsed time and row counts (`QS_DOC_NAME`, `QS_DOC_OWNER`, `QS_CREATED_DATE`, `QS_ACT_ELAP_TIME`). Two uses:
- **Coverage** — replay the most-executed workbooks first; they are where a wrong number costs most.
- **Row-count corroboration** — where a `QPP_STATS` row records the rows a worksheet returned, Neo's row count for the same worksheet on unchanged data should match. **This is the closest thing to a live 4.1 oracle that exists in this repository**, and it is the only hook that can independently corroborate the §1 rewrite against real historical results. Whether the row-count column survives in this estate is UNKNOWN — 47 columns, and only four names are attested. **Check it early; if it is there, it is worth more than any fixture.**

---

## Confidence & Gaps

### Established beyond reasonable doubt

- **Fan-trap resolution is inline views with per-branch GROUP BY pushdown**, joined on the master key, detail side outer-joined, outer query re-aggregating. Verbatim SQL in four vendor releases.
- **`OneToOne` is the cardinality flag, its only effect is fan-trap detection, and its default is `False` (= one-to-many).** Oracle states this in one sentence.
- **The four refusal conditions**, verbatim and cross-version stable.
- **`EUL.dtd` is a Discoverer 4.1 artefact** (line 3) and is the authoritative object model.
- **`EUL4_OBJ_JOIN_USGS` is complex-folder join *usage*, not cardinality.**
- **`EUL4_ASM_POLICIES` is Automated Summary Management, not row-level security.** RLS was a mandatory condition comparing Oracle's `USER`.
- **`EXP_TYPE`: `CO` base, `CI` created, `JP` join predicate** — with 10 `JP` rows for 10 joins. `OBJ_TYPE` has a third value, `CUO`.
- **Hierarchies are parent/child trees with derived depth**, no business-area column, and this estate is 502 `IBH` + 6 `DBH`.
- **The `.DIS` condition token language**, its 222-function table recovered from Oracle's own DLL, and its measured depth distribution.

### Open, in priority order

| # | Question | Evidence that settles it | Blocks |
| --- | --- | --- | --- |
| **1** | **Is `KEY_OBJ_ID` the detail or the master?** Two artefacts in this repo disagree (`eul-schema-adapter.ts:129-130` vs `AUDIT_DETAILED_FINDINGS.md:891-892`). | The 10-row join in §2.2, plus the 25 dump records in `d4dumps\`. Read-only. | **All of §1.** An inversion is silent and wrong. |
| **2** | Which `EUL4_KEY_CONS` columns carry `OneToOne`, `AllowDetailNoMaster`, `AllowMasterNoDetail`, `Mandatory`? | `ALL_TAB_COLUMNS` + `SELECT *` on 10 rows. | §1.11 steps 3–5; §2.3. |
| **3** | Which `EUL4_EXPRESSIONS` column carries the default aggregate? | `ALL_TAB_COLUMNS` + a `GROUP BY` on each candidate. Probe, never guess. | §3; the measure/axis split that triggers §1. |
| **4** | How does the rewrite re-aggregate `AVG` and `COUNT DISTINCT`? | A live 4.1 Plus with SQL Inspector. **If none survives: refuse them.** | §1.11 step 8. |
| **5** | Where do conditions and parameters land in the rewrite — branch-local or outer? | Same. Branch-local is arithmetically forced; get it wrong and 7 521 parameters filter at the wrong level. | §1.9.2/3. |
| **6** | Does `DisableAutoOuterJoinsOnFilters` interact with the rewrite's structural `(+)`? | `9.0.4\B10270_01.pdf` pp. 11-12…11-15, three worked examples. **I have not traced them.** | §1.9.4. |
| **7** | What are `EUL4_SUB_QUERIES` (15 cols) and `EUL4_SQ_CRRLTNS` (10 cols)? | `ALL_TAB_COLUMNS` + `SELECT *`. Small enough to read whole. | §7.7. |
| **8** | `EUL4_DOMAINS`' 20 columns — three capability booleans or one type code? | Same. | §5.3. |
| **9** | How many of the 502 `IBH` hierarchies are date-template instantiations? | The §4.3 `GROUP BY`. **One query, and it may shrink the hierarchy work by two orders of magnitude.** | §4 scope. |
| **10** | Does `EUL4_QPP_STATS` (47 cols) record returned **row counts**? | `ALL_TAB_COLUMNS`. | **H17** — the only independent oracle for §1 in this repository. |
| **11** | Did 4.1 rewrite, or only warn? (§1.8 self-contradiction) | An SME who ran 4.1, or a surviving install. | Acceptance-test framing only, **not** what to build. |
| **12** | Is `AllowMasterNoDetail` + `AllowDetailNoMaster` both-true settable, and what does it emit? | The Join Wizard in a live Administrator. | §2.3 edge case. |
| **13** | Multi-column joins: one `JP` row with a compound formula, or *n* rows? | `SELECT … WHERE exp_type='JP'` — 10 rows. | §2.5. |
| **14** | Grouped hierarchy levels: do all items enter the GROUP BY? | Live 4.1 Plus with SQL Inspector. | §4.4. |

**Questions 1, 2, 3, 9 and 10 are all answered by read-only `ALL_TAB_COLUMNS` and small `SELECT`s against the live EUL — no migration run, no writes, and they close the five gaps that most constrain §1.** They should precede any implementation work.

### For an SME who ran Discoverer 4.1

1. When a fan-trap query used `AVG` or `COUNT DISTINCT`, did it return a number or an error?
2. Did a *worksheet* condition on one detail branch filter before or after that branch's aggregation?
3. Did 4.1 actually rewrite, or only warn? (§1.8)
4. Was the "Outer join on detail" + "Outer join on master" combination selectable at all?
5. Was `USER`-comparing mandatory-condition RLS used in this estate, or was security done in database views? **The seven depth-2 `OR`-of-`AND` conditions (§7.5) are the first place to look.**

### One thing this document deliberately does not do

It does not guess a single EUL4 column name. Where a name is not attested in Oracle's shipped SQL, in a validated parser, or in a live read, it says **UNKNOWN** and names the query. The fabricated-schema episode recorded in `EUL_SCHEMA_GROUND_TRUTH.md:2037` — an invented join and item model that reached production code and made the migration read calculations instead of columns — is what that discipline is for.

agentId: a82694ea618eaeb45 (use SendMessage with to: 'a82694ea618eaeb45', summary: '<5-10 word recap>' to continue this agent)
<usage>subagent_tokens: 259954
tool_uses: 74
duration_ms: 1578035</usage>