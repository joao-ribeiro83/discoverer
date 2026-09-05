# EUL Schema — Ground Truth

**Status:** authoritative. Supersedes `EUL_VERSION_REFERENCE.md` and §8 of
`oracle_discoverer_complete_reference.md`, **both of which describe a schema that
does not exist** (see "Provenance" at the bottom).

Every name in the "Real" columns below is taken from one of:

| Source | What it is | Why it is authoritative |
| --- | --- | --- |
| `discoverer10g/sql/euldrop.sql` | Oracle's EUL5 drop script | Enumerates every EUL5 table by name |
| `discoverer10g/sql/eul4del.sql` | Oracle's EUL4 delete script | Enumerates every EUL4 table by name |
| `discoverer10g/sql/Lineage.sql` | Oracle's shipped lineage PL/SQL | Real cursors selecting real columns |
| `discoverer10g/sql/eulver.sql` | Oracle's version-stamp script | Real DML on the version table |
| `discoverer10g/sql/batchusr.sql` | Oracle's batch-user package | Real DML on the security tables |
| `DISCVR4/DCESQRES.DLL` | Oracle's 4.1 client | Carries the EUL seed script verbatim; its 222 `EUL4_FUNCTIONS` rows match a live EUL4 exactly (§7.5) |
| `DISCVR4/DCBIMPB.DLL` | Oracle's 4.1 client | Exports the workbook object model, including `DCBImportedFilterNode::IsNot` (§7.5) |
| `Discoverer 4.1 EUL Metadata Reference Guide{,2}.md` | User-supplied research | Independently agrees with all of the above |

Confidence is marked per row: **[SQL]** = read directly out of Oracle's shipped
scripts. **[GUIDE]** = from the user-supplied guides only, consistent with but not
directly present in the shipped SQL. **[?]** = still unverified — resolve against
a live EUL before relying on it.

---

## 1. Table inventory

The prefix is `EUL5_` / `EUL4_` / `EUL_` (3.x). Table *base names* below are the
part after the prefix.

### 1.1 Tables the migration needs — real names

| Purpose | Real base name | Code previously assumed | Status |
| --- | --- | --- | --- |
| Business areas | `BAS` | `BA` | ✅ fixed |
| Folders | `OBJS` | `OBJS` | ✅ correct |
| Items / calculations / conditions | `EXPRESSIONS` | `EXPRESSIONS` | ✅ correct |
| Joins | `KEY_CONS` | `JOINS` | ❌ **fabricated** |
| Join components | *(columns of `KEY_CONS`; see §3.4)* | `JOI_COMP` | ❌ **fabricated** |
| Hierarchies | `HIERARCHIES` | `HIERARCHIES` | ✅ correct |
| Hierarchy nodes | `HI_NODES` | `HIER_LEVELS` | ❌ **fabricated** |
| Hierarchy node tree | `HI_SEGMENTS` | *(none)* | ❌ **missing** |
| Summary folders | `SUMMARY_OBJS` | `SUMMARIES` | ❌ **fabricated** |
| Custom functions | `FUNCTIONS` | `FUNCTIONS` | ✅ correct |
| Privileges / grants | `ACCESS_PRIVS` | `ELEM_ACCESS` | ❌ **fabricated** |
| Users | `EUL_USERS` | `USERS` | ❌ **fabricated** |
| Workbooks | `DOCUMENTS` | `DOCUMENTS` | ✅ correct |
| Workbook→item xref | `ELEM_XREFS` | *(none)* | ❌ **missing** |
| Query statistics | `QPP_STATS` | `QPP_STATS` | ✅ correct |
| EUL version stamp | `VERSIONS` | `EUL` | ❌ **fabricated** |
| Folder dependencies | `OBJ_DEPS` | *(none)* | ❌ **missing** |
| Item dependencies | `EXP_DEPS` | *(none)* | ❌ **missing** |
| Join usage per folder | `OBJ_JOIN_USGS` | *(none)* | ❌ **missing** |

### 1.2 Base names the code invented that exist in **no** Discoverer release

`JOINS`, `JOI_COMP`, `HIER_LEVELS`, `SUMMARIES`, `ELEM_ACCESS`, `EUL`,
`OPTIONS`, `QPP_QUERY`, `LOCK`, `TRANSLATIONS`, `USERS`, `ROLES`, `BA_ROLES`,
`OBJ_ROLES`, `APP_ROLES`.

This matters beyond the reads: `QPP_QUERY`/`LOCK`/`TRANSLATIONS` were the
EUL5-only *detection markers*, and `BA_ROLES` was the EUL4 role-grant probe. All
of them always miss, so those feature flags never fire correctly.

### 1.3 Full EUL5 table list (from `euldrop.sql`) **[SQL]**

```
ACCESS_PRIVS   APP_PARAMS      ASMP_CONS      ASMP_LOGS      ASM_POLICIES
BAS            BATCH_PARAMS    BATCH_QUERIES  BATCH_REPORTS  BATCH_SHEETS
BA_OBJ_LINKS   BQ_DEPS         BQ_TABLES      BR_RUNS        DBH_NODES
DOCUMENTS      DOMAINS         ELEM_XREFS     EUL_USERS      EXPRESSIONS
EXP_DEPS       FREQ_UNITS      FUNCTIONS      FUN_ARGUMENTS  FUN_CTGS
FUN_FC_LINKS   GATEWAYS        HIERARCHIES    HI_NODES       HI_SEGMENTS
IG_EXP_LINKS   IHS_FK_LINKS    KEY_CONS       OBJS           OBJ_DEPS
OBJ_JOIN_USGS  PLAN_TABLE      QPP_STATS      SEGMENTS       SEQUENCES
SQ_CRRLTNS     SUB_QUERIES     SUMMARY_OBJS   SUMO_EXP_USGS  SUM_BITMAPS
SUM_RFSH_SETS  VERSIONS
```

EUL4 (from `eul4del.sql`) is the same set, minus nothing relevant, plus
`NAMED_ELEMS`, `ODBC_CATALOGS`, `ODBC_SCHEMAS`, `ID_SEQ`, and the batch tables.
**The EUL4 and EUL5 table inventories are effectively identical** — which
invalidates the code's whole "EUL5 added these tables" premise.

---

## 2. Version detection

The detector must key off `<prefix>BAS`, and read the version from
`<prefix>VERSIONS`, **not** `<prefix>EUL`.

`EUL5_VERSIONS` columns **[SQL — `eulver.sql`]**:

| Column | Meaning | Example |
| --- | --- | --- |
| `VER_RELEASE` | EUL release | `5.0.2.0.0.0` |
| `VER_MIN_CODE_VER` | Minimum client version | `5.0.0.0.0.0` |
| `VER_EUL_TIMESTAMP` | EUL identity stamp | `YYYYMMDDHH24MISS` |

There is **no** `EU_VERSION` and **no** `EU_DISC_VERSION` anywhere. The mapping
from `VER_RELEASE` to a Discoverer marketing release still holds
(`5.1.x` → 10.1.2/11.1.1, `5.0.2` → 9.0.4, `4.1.x` → 4.1), but it must read
`VER_RELEASE`.

---

## 3. Column-level truth for the entities we migrate

### 3.1 `OBJS` — folders **[SQL — `Lineage.sql`]**

| Real column | Meaning | Code assumed |
| --- | --- | --- |
| `OBJ_ID` | PK | `OBJ_ID` ✅ |
| `OBJ_NAME` | Folder name | `OBJ_NAME` ✅ |
| `OBJ_TYPE` | `SOBJ` = simple, `COBJ` = complex | `OBJ_TABLE`/`VIEW`/… ❌ |
| `OBJ_EXT_OWNER` | Schema owning the base table | `OBJ_TABLE_OWNER` ❌ |
| `SOBJ_EXT_TABLE` | Base table/view name | `OBJ_TABLE_NAME` ❌ |

`OBJ_TYPE` values are **`SOBJ`/`COBJ`** — confirmed by
`where obj_id = COBJ_ID and obj_type = 'SOBJ'` in `Lineage.sql`. The code's
`TABLE`/`VIEW`/`COMPLEX`/`JOIN`/`DERIVED`/`SUMMARY` enum matches nothing, so
every folder-type branch is dead.

The folder→business-area link is **`BA_OBJ_LINKS`** (a link table), not a
`BA_ID` column on `OBJS`. **[SQL — table exists; column names [?]]**

### 3.2 `EXPRESSIONS` — items, calculations, conditions **[SQL + GUIDE]**

| Real column | Meaning | Code assumed |
| --- | --- | --- |
| `EXP_ID` | PK | `EXP_ID` ✅ |
| `EXP_NAME` | Item name | `EXP_NAME` ✅ |
| `EXP_TYPE` | `CO` = base DB item, `CI` = created item | `CI`/`CU`/… ❌ |
| `IT_OBJ_ID` | → owning folder `OBJS.OBJ_ID` | `OBJ_ID` ❌ |
| `IT_EXT_COLUMN` | Physical column name (for `CO`) | `EXP_COL_NAME` ❌ |
| `EXP_DESCRIPTION` | Description | `EXP_DESCRIPTION` ✅ |
| `EXP_DATA_TYPE` | Data type | `EXP_DATA_TYPE` ✅ |
| `IT_FORMAT_MASK` | Format mask | `EXP_FORMAT_MASK` ❌ |
| `IT_HEADING` | Column heading | *(none)* ❌ |
| `IT_FUN_ID` | **Default aggregate** → `FUNCTIONS.FUN_ID` **[LIVE EUL4]** | *(none)* ❌ |
| `JP_KEY_ID` | **Join predicate → `KEY_CONS.KEY_ID`** (only on `EXP_TYPE='JP'`) **[LIVE EUL4]** | *(none)* ❌ |
| `EXP_FORMULA1` | VARCHAR2(250) — the token tree for `CI` and `JP` rows **[LIVE EUL4]** | *(none)* ❌ |
| `EXP_SEQUENCE` | Ordinal; `1` on every `JP` row **[LIVE EUL4]** | *(none)* ❌ |

**The `EXP_TYPE` semantics are inverted in the code.** Oracle: `CO` is the
database (base) item mapped to a real column; `CI` is a *created* item
(calculation). `readItems` currently selects `CI`/`CU` — i.e. it reads
calculations and skips every real column-backed item.

`EXP_TYPE` holds exactly three values on the live EUL4: `CO` 6 967, `CI` 2 830,
`JP` 10 (one join predicate per join).

**Full live column list (44), read from `ALL_TAB_COLUMNS` on the live EUL4**
(Phase 0.3 probe — see `docs/master-plan/research/eul-probe-results.md`):

```
EXP_ID, EXP_TYPE, EXP_NAME, EXP_DEVELOPER_KEY, EXP_DESCRIPTION, EXP_FORMULA1,
EXP_DATA_TYPE, EXP_SEQUENCE, IT_DOM_ID, IT_OBJ_ID, IT_DOC_ID, IT_FORMAT_MASK,
IT_MAX_DATA_WIDTH, IT_MAX_DISP_WIDTH, IT_ALIGNMENT, IT_WORD_WRAP,
IT_DISP_NULL_VAL, IT_FUN_ID, IT_HEADING, IT_HIDDEN, IT_PLACEMENT,
IT_USER_DEF_FMT, IT_CASE_STORAGE, IT_CASE_DISPLAY, IT_EXT_COLUMN, CI_IT_ID,
CI_RUNTIME_ITEM, PAR_MULTIPLE_VALS, CO_NULLABLE, P_CASE_SENSITIVE, JP_KEY_ID,
FIL_OBJ_ID, FIL_DOC_ID, FIL_RUNTIME_FILTER, FIL_APP_TYPE, FIL_EXT_FILTER,
EXP_USER_PROP2, EXP_USER_PROP1, EXP_ELEMENT_STATE, EXP_CREATED_BY,
EXP_CREATED_DATE, EXP_UPDATED_BY, EXP_UPDATED_DATE, NOTM
```

#### The default aggregate lives in `IT_FUN_ID` **[LIVE EUL4]**

It is a foreign key to `EUL4_FUNCTIONS`, not a code. Live distribution over
`CO` + `CI` rows:

| `IT_FUN_ID` | `FUN_NAME` | `FUN_FUNCTION_TYPE` | rows |
| ---: | --- | ---: | ---: |
| 110 | `Detail` | 7 | 8 152 |
| 1 | `SUM` | 4 | 1 292 |
| null | — | — | 353 |

`Detail` is the marker for *no aggregation*, not an aggregate function.
`IT_PLACEMENT` was ruled out as the carrier — it groups `3`/`1`/`2`, a display
placement code.

**Read since Phase 3.1.** `readItems` selects it — probed, not listed, because a
column that is absent turns the whole item read into an `ORA-00904` and no
offline source confirms the spelling on EUL5 — and resolves it through
`FUNCTIONS` rather than storing the id. `Detail` reaches the transform layer as
`Detail` and becomes null there, alongside every name outside Neo's five
(`normalizeAggregation`). The column it lands in is described in §7.9.1.

### 3.3 Hierarchies — a node tree, not numbered levels **[SQL — `Lineage.sql`]**

| Table | Real columns |
| --- | --- |
| `HIERARCHIES` | `HI_ID` (PK — **not** `HIER_ID`) |
| `HI_NODES` | `HN_ID` (PK), `HN_HI_ID` → `HIERARCHIES.HI_ID` |
| `HI_SEGMENTS` | `IHS_HI_ID`, `IHS_HN_ID_PARENT`, `IHS_HN_ID_CHILD` |

Hierarchy structure is a **parent/child edge list** in `HI_SEGMENTS`, walked
recursively (the root is the node with no parent segment — see
`GET_HIERTOP` in `Lineage.sql`). It is **not** a flat list of numbered levels.
The `HierarchyLevel.levelNumber` field has no source column; depth must be
derived by walking the tree.

**`HIERARCHIES` full live column list (17) — and there is no business-area
column** **[LIVE EUL4]**:

```
HI_ID, HI_TYPE, HI_NAME, HI_DEVELOPER_KEY, HI_DESCRIPTION, HI_SYS_GENERATED,
HI_EXT_HIERARCHY, DBH_DEFAULT, IBH_DBH_ID, HI_USER_PROP2, HI_USER_PROP1,
HI_ELEMENT_STATE, HI_CREATED_BY, HI_CREATED_DATE, HI_UPDATED_BY,
HI_UPDATED_DATE, NOTM
```

**`HI_SYS_GENERATED` separates author-made from generated hierarchies**, and on
the live EUL4 the split is perfectly clean:

| `HI_TYPE` | `HI_SYS_GENERATED` | rows |
| --- | ---: | ---: |
| `DBH` (date) | 0 | 6 |
| `IBH` (item-based) | 1 | **502** |

Every `IBH` row is system-generated — an instantiation of a `DBH` template,
linked back through `IBH_DBH_ID`. **Not one hand-authored item hierarchy exists
on this estate.** So the real hierarchy scope is 6 author-made date hierarchies
plus one generated-instance rule, not 508 hand-modelled trees.

### 3.4 Joins — `KEY_CONS` **[LIVE EUL4 — every column confirmed]**

Full live column list (22), from `ALL_TAB_COLUMNS` on the live EUL4:

| Real column | Type | Meaning |
| --- | --- | --- |
| `KEY_ID` | NUMBER (not null) | PK |
| `KEY_TYPE` | VARCHAR2(10) (not null) | **`FK` / `UK` — the constraint kind, NOT a join type.** `FK` on all ten live rows |
| `KEY_NAME` | VARCHAR2(100) (not null) | `A -> B`, always **`master -> detail`** |
| `KEY_DEVELOPER_KEY` | VARCHAR2(100) (not null) | Developer key |
| `KEY_DESCRIPTION` | VARCHAR2(240) | Join display text |
| `KEY_EXT_KEY` | VARCHAR2(64) | External key name |
| **`KEY_OBJ_ID`** | NUMBER (not null) | → the **DETAIL** folder `OBJS.OBJ_ID` |
| `UK_PRIMARY` | NUMBER | null on every live row |
| `FK_KEY_ID_REMOTE` | NUMBER | → a remote `KEY_CONS.KEY_ID`; null on every live row |
| **`FK_OBJ_ID_REMOTE`** | NUMBER | → the **MASTER** folder `OBJS.OBJ_ID` |
| **`FK_ONE_TO_ONE`** | NUMBER | DTD `OneToOne` — fan-trap detection only |
| **`FK_MSTR_NO_DETAIL`** | NUMBER | DTD `AllowMasterNoDetail` — `master LEFT OUTER JOIN detail` |
| **`FK_DTL_NO_MASTER`** | NUMBER | DTD `AllowDetailNoMaster` — the rare right-outer |
| **`FK_MANDATORY`** | NUMBER | DTD `Mandatory` — referential-integrity assertion; unlocks join trimming and summary eligibility |
| `KEY_USER_PROP1`, `KEY_USER_PROP2` | VARCHAR2(100) | User properties |
| `KEY_ELEMENT_STATE` | NUMBER (not null) | Element state |
| `KEY_CREATED_BY`, `KEY_CREATED_DATE`, `KEY_UPDATED_BY`, `KEY_UPDATED_DATE` | — | Audit |
| `NOTM` | NUMBER | Present on every EUL4 table |

**The four cardinality flags are real columns and are populated.** They were
never read from this estate before Phase 0.3; `legacy-analysis.md:112` recorded
them as UNKNOWN and attested only in the EEX export DTD. They are here. Live
values across the ten joins: `FK_ONE_TO_ONE = 0` everywhere,
`FK_MSTR_NO_DETAIL = 1` on `109828` only, `FK_DTL_NO_MASTER = 0` everywhere,
`FK_MANDATORY = 1` on nine of ten (`109818` is `0`).

**Orientation — measured, not inferred.** `KEY_OBJ_ID` is the **detail**;
`FK_OBJ_ID_REMOTE` is the **master**. The proof is `108451
M M111 -> M M111 1`: `M_M111` (on `FK_OBJ_ID_REMOTE`) returns 1 830 rows and
exactly 1 830 distinct join-key tuples — the only provably unique key on either
side of any join in this estate — while `M_M111_1` (on `KEY_OBJ_ID`) has 216
rows over 94 keys. Full table of counts in
`docs/master-plan/research/eul-probe-results.md` Q1.

**Do not use `KEY_TYPE` as the join type.** Its domain is `FK`/`UK`. Derive the
join type from `FK_MSTR_NO_DETAIL` and `FK_DTL_NO_MASTER` instead.

**The join predicate is one `EXPRESSIONS` row, linked by `JP_KEY_ID`.**
`EXP_TYPE = 'JP'`, exactly one row per join, and a multi-column predicate is a
token tree inside that single row's `EXP_FORMULA1` — `[1,98]` (`AND`) wrapping
n `[1,81]` (`=`) nodes, each taking two `[6,EXP_ID]` item references. Live
widths: 5 single-column, 4 three-column, 1 four-column; **every operator is
`=`**. So `join_predicates` must be filled by *parsing the formula*, not by
reading rows.

Related: `IHS_FK_LINKS` (`IFL_ID, IFL_IHS_ID, IFL_KEY_ID, IFL_ELEMENT_STATE`
+ audit) and `OBJ_JOIN_USGS` (`OJU_ID, OJU_OBJ_ID, OJU_JOIN_MODIFIED,
OJU_KEY_ID, OJU_SUMO_ID, OJU_ELEMENT_STATE` + audit) are link tables carrying
**no** cardinality or outer-join flag — and both hold **0 rows** on the live
EUL4. The code's `JOI_ID`/`JOI_NAME`/`JOI_TYPE`/`EXP_ID_1`/`EXP_ID_2`/`JOI_OP`
model is entirely invented — note joins bind **folder to folder**, not item to
item.

**A caution for anyone measuring cardinality again:** on this estate the
folders are Oracle **VIEWS**, not tables, and `ALL_TABLES.NUM_ROWS` is null
(never analysed). Every `COUNT(*)` re-executes the view — the ten joins took
hours, and one side reached 6 660 408 rows. Budget accordingly, and note that
**nine of the ten joins have duplicate keys on both sides**: orientation in
this EUL is an author's declaration, not something the data can be counted back
out of.

### 3.5 Security — `ACCESS_PRIVS` + `EUL_USERS` **[SQL — `batchusr.sql`]**

| Table | Real columns |
| --- | --- |
| `EUL_USERS` | `EU_ID` (PK), `EU_USERNAME` |
| `ACCESS_PRIVS` | `AP_EU_ID` → `EUL_USERS.EU_ID`, `GP_APP_ID` (privilege/app code), `GD_DOC_ID` → workbook **[GUIDE]** |

Grants join through `EU_ID`; the grantee name is **not** a column on the privilege
table. `GP_APP_ID` is a numeric privilege code (`1006`, `1015`, … appear in
`batchusr.sql`) — the code table for these still needs mapping **[?]**.

The code's `ELEM_ACCESS(EA_ID, BA_ID, OBJ_ID, EU_USERNAME, EA_PRIV_TYPE)` is
fabricated end to end.

### 3.6 `DOCUMENTS` — workbooks **[LIVE EUL4]**

Full column list, read from `ALL_TAB_COLUMNS` on a live 4.1 EUL
(`EUL4_DOCUMENTS`, 17 columns):

| Real column | Type | Meaning |
| --- | --- | --- |
| `DOC_ID` | NUMBER | PK |
| `DOC_NAME` | VARCHAR2 | Workbook name, e.g. `GD_M.M27_V07.DIS` |
| `DOC_DEVELOPER_KEY` | VARCHAR2 | Developer key |
| `DOC_DESCRIPTION` | VARCHAR2 | Description (null on every row of the live source) |
| `DOC_EU_ID` | NUMBER | Owner → `EUL_USERS.EU_ID` |
| `DOC_LENGTH` | NUMBER | Byte length of the body |
| `DOC_BATCH` | NUMBER | Non-zero for a workbook scheduled as a batch report |
| `DOC_CONTENT_TYPE` | VARCHAR2 | `application/vnd.oracle-disco.wb` |
| **`DOC_DOCUMENT`** | **LONG RAW** | **The workbook body** |
| `DOC_USER_PROP1/2` | VARCHAR2 | User properties |
| `DOC_ELEMENT_STATE` | NUMBER | Element state |
| `DOC_CREATED_BY/DATE`, `DOC_UPDATED_BY/DATE` | | Audit columns |
| `NOTM` | NUMBER | Internal |

There is **no `DOC_FOLDER_ID`** and no `DOC_CONTENT`; the migrator probes for
both spellings and takes whichever exists (`DOC_DOCUMENT` on 4.x).

**`DOC_DOCUMENT` is not XML.** It is the proprietary Discoverer container — the
same bytes a `.DIS` file on disk holds. §7 below documents the format, which
`migrate/src/services/workbook-parser.ts` decodes.

**There is no relational fallback.** On the live EUL4:

- `EXPRESSIONS.IT_DOC_ID` is null on all 9 807 rows;
- `EXPRESSIONS.FIL_DOC_ID` is null on all 9 807 rows;
- `ELEM_XREFS` is **empty** (0 rows), and its real columns are
  `EX_ID, EX_TYPE, EX_REF1, EX_EL_TYPE, EX_EL_ID, EX_REF2` — *not* the
  `EX_FROM_ID`/`EX_TO_ID` the code once assumed.

So a worksheet's columns, conditions, parameters and calculations exist **only**
inside `DOC_DOCUMENT`. Parse the blob or migrate nothing but names.

Run `backend/src/scripts/probe-eul-workbooks.ts` against a new source to check
all of the above before migrating it.

### 3.7 `QPP_STATS` — the query performance predictor's history **[LIVE EUL4]**

47 columns; **7 316 rows** on the live EUL4. Nothing migrates it today, but it
is the only independent record in this estate of what a real Discoverer query
returned — which makes it the natural oracle for validating the fan-trap guard.

| Column | Type | Meaning |
| --- | --- | --- |
| `QS_ID` | NUMBER (not null) | PK |
| **`QS_NUM_ROWS`** | NUMBER | **rows the query returned** |
| `QS_COST` | NUMBER | optimiser cost |
| `QS_ACT_CPU_TIME` | NUMBER | measured CPU time |
| `QS_ACT_ELAP_TIME` | NUMBER (not null) | measured elapsed time |
| `QS_EST_ELAP_TIME` | NUMBER (not null) | predicted elapsed time |
| `QS_OBJECT_USE_KEY` | VARCHAR2 (not null) | folder/item/join fingerprint of the query |
| `QS_SUMMARY_FIT` | NUMBER | whether a summary folder satisfied it |
| `QS_STATE` | NUMBER | row state |
| `QS_SDO_ID` | NUMBER | summary object used |
| `QS_DOC_OWNER`, `QS_DOC_NAME`, `QS_DOC_DETAILS` | VARCHAR2 | the workbook that ran it |
| `QS_DBMP0..7`, `QS_MBMP0..7`, `QS_JBMP0..7`, `QS_FBMP0..7` | RAW ×32 | four 8-slot bitmap families — folder / measure / join / filter participation. **Not decoded.** |
| `QS_CREATED_BY`, `QS_CREATED_DATE` | — | audit |

---

## 4. Status — rebuild completed

The read layer has been rebuilt against this document. What changed:

| File | Change |
| --- | --- |
| `types/eul-versions.ts` | Real `CORE_TABLES`; `EUL4_ONLY_TABLES` replaces the invented EUL5 markers; `EXP_TYPE`/`OBJ_TYPE` constants; `Join` is folder-to-folder; `HierarchyLevel` → `HierarchyNode` (tree + derived depth); `BusinessArea` loses `language`/`developerKey` |
| `eul-version-detector.ts` | Marker is `<prefix>BAS`; identity reads `VERSIONS.VER_RELEASE`; the EUL5-marker warning became a retired-table check |
| `eul-schema-adapter.ts` | Every `*_COLUMNS` spec re-derived; `readFolders` resolves the BA through `BA_OBJ_LINKS` and normalizes SOBJ/COBJ; `readItems` defaults to `CO`+`CI`; `readJoins` reads `KEY_CONS` plus the four cardinality flags and parses the `JP` predicate; `readHierarchies` walks `HI_SEGMENTS`; `readGrants`/`readUsers` use `ACCESS_PRIVS` + `EUL_USERS`; new `probeColumns()` |
| `eul-reader.ts` | `CONDITION_EXP_TYPES`/`SECURITY_MANAGER_EXP_TYPES` emptied — `CO` was being read a second time and mislabelled as a condition |
| `assessment.ts` | Orphan joins keyed to folders; calculated items count `CI`; folder types compared post-normalization |
| `transform.ts` / `migration-runner.ts` | Joins carry folder ids; hierarchy levels come from node depth; workbook/EUL-wide grants reported and skipped |
| `testing/mock-eul.ts` | Fixtures rewritten against the real schema |

**224 tests pass, typecheck and lint clean.** Note the earlier 214 passing
tests proved only that the code agreed with its own invented fixtures — green
here means the same thing until a live EUL is attached.

### 4.1 Unconfirmed columns, and how they are handled

Rather than guess a name into a SELECT (one wrong column = ORA-00904 kills the
whole read), unconfirmed columns go through `probeColumns()`, which asks
`ALL_TAB_COLUMNS` what exists and simply omits the rest.

| Table | Probed | If absent |
| --- | --- | --- |
| `KEY_CONS` | `KEY_ID`, `KEY_NAME`, `FK_ONE_TO_ONE`, `FK_MSTR_NO_DETAIL`, `FK_DTL_NO_MASTER`, `FK_MANDATORY` | source id falls back to row index; every absent flag reads **false**, which is fanning + INNER + not-mandatory — the safe direction in all four cases |
| `EXPRESSIONS` (for `JP`) | `JP_KEY_ID`, `EXP_FORMULA1` | no predicates are read at all, and every join then refuses **by name** at query time rather than being silently dropped |
| `HIERARCHIES` | `HI_NAME`, `HI_DESCRIPTION`, `BA_ID` | synthesized name; hierarchy skipped if it has no BA (Neo requires one) |
| `HI_NODES` | `HN_EXP_ID` / `HN_IT_EXP_ID`, `HN_NAME` | node keeps a null item; Neo skips that level with a warning |
| `ACCESS_PRIVS` | `AP_ID`, `GD_DOC_ID`, `GBA_BA_ID`, `GO_OBJ_ID` | grant reported at level `EUL` |
| `DOCUMENTS` | `DOC_DOCUMENT`, `DOC_CONTENT`, `DOC_LENGTH`, `DOC_BATCH`, `DOC_EU_ID`, `DOC_FOLDER_ID` | owner falls back to `DOC_CREATED_BY`; with no body column the workbook migrates as an empty map |

### 4.2 What to verify first against a live EUL

1. **The probe list above** — run the migration and read the warnings; every
   probed column that turns out to exist under a different name is a
   one-line addition.
2. **`GP_APP_ID` privilege codes.** Carried through verbatim; the map from
   code to Neo permission level is a guess until decoded. `1006` and `1015`
   appear in Oracle's `batchusr.sql`.
3. **Condition rows in `EXPRESSIONS`.** Answered on the live EUL4: there are
   none. `EXP_TYPE` holds only `CO` (6 967 rows), `CI` (2 830) and `JP` (10, a
   join predicate). Worksheet conditions are not `EXPRESSIONS` rows at all —
   they live in the workbook body, and that is where the migrator reads them.
4. **The workbook body.** Answered: `DOC_DOCUMENT`, a `LONG RAW` holding the
   Discoverer container. See §3.6 and §7.
5. ~~**Item-level join keys.**~~ **Closed at Phase 3.2.** `KEY_CONS` has no
   item columns and never will — the columns a join matches on live in its one
   `EXPRESSIONS` row (`EXP_TYPE = 'JP'`, bound by `JP_KEY_ID`), as a token tree
   in `EXP_FORMULA1`. `readJoins` parses that tree into `join_predicates`, one
   row per column pair, and orients each pair by looking up each item's
   `IT_OBJ_ID` against the join's two folders rather than trusting operand
   order. A tree that is not an ANDed set of column comparisons yields no
   components: the raw formula is kept verbatim on `joins.predicate_formula`
   and the join refuses by name at query time. Half a predicate would be a
   *wider* join than the source had.
6. **`HIERARCHIES.BA_ID` does not exist.** Still open. The live EUL4
   `HIERARCHIES` has `HI_ID, HI_TYPE, HI_NAME, HI_DEVELOPER_KEY,
   HI_DESCRIPTION, HI_SYS_GENERATED, HI_EXT_HIERARCHY, DBH_DEFAULT,
   IBH_DBH_ID` plus audit columns — and **no business-area column**. Because
   Discoverer Neo requires a business area, every hierarchy is currently
   skipped. The link runs hierarchy → `HI_NODES` → `IG_EXP_LINKS`
   (`IEL_TYPE = 'HIL'`, `HIL_HN_ID` → `HIL_EXP_ID`) → `EXPRESSIONS.IT_OBJ_ID`
   → `BA_OBJ_LINKS`.

---

## 7. The workbook body — the `.DIS` container

Oracle never documented this format. What follows was derived by inspecting
558 workbooks from a live 4.1 EUL and holds for every one of them. The decoder
is `migrate/src/services/workbook-parser.ts`; the matching encoder its tests
use is `migrate/src/testing/workbook-fixture.ts`.

### 7.1 Records

A flat stream. Every record begins with 4 bytes —
`[type:u8][tag:u16 LE][flags:u8]` — followed by a type-dependent payload:

| type | payload |
| --- | --- |
| `0x00` | a structural marker, or a 4-byte object reference — **§7.8.1** |
| `0x01`, `0x02` | 4-byte scalar (int32, colour, element reference) |
| `0x03`, `0x04` | 2-byte scalar |
| `0x05`, `0x07` | 1-byte scalar |
| `0x06` | 4-byte IEEE float |
| `0x08` | `[len][len bytes]`, latin-1 text — counted length, **§7.8.1** |
| `0x0a` | `[subtype:u32 LE][len:u32 LE][len bytes]` — raw (Oracle dates, GUIDs) |

Marker tags carry the structure:

```
00 01 00 00 | 00 <class:u16 LE> 00 | <elementId:u32 LE>     BEGIN
00 02 00 00 | 00 <class:u16 LE> 00                          END
00 0a 00 00 … 00 0b 00 00                                   a counted vector
00 0c 00 00 … 00 0d 00 00                                   a counted vector of records
```

Element ids are assigned **strictly sequentially from 1** across the whole
workbook. That is the parser's integrity check: a BEGIN is honoured only when
its id is the next one expected, which rejects the byte sequences inside
undecoded payloads that occasionally look like markers.

> **Superseded in part by §7.8.1.** This section used to say the format is
> *schema-driven* — that the same type byte means different widths under
> different classes, so a total parse would need Oracle's class schema. It does
> not. Which shape a `0x02` record takes is written into the stream by the
> vector brackets above, and with those read, **490 942 of 490 942 element
> bodies parse completely**. Two consequences matter: type `0x00` under a
> non-structural tag is an object *reference*, not a marker (that is the whole
> worksheet model), and a string's length escapes past one byte, without which
> a formula over 254 characters was silently dropped. The parser still
> resynchronizes — see §7.8.1 for exactly when.

END markers name the element's *base* class, not its own (a `0x0104` parameter
closes with `0x00dc` — the only class that does, §7.8.1), and an END closes the
element's body. Elements are a flat sequence: an element owns the records
between its BEGIN and its END.

### 7.2 Element classes

| Class | Meaning |
| --- | --- |
| `0x0064` | EUL identity — owner schema, EUL name |
| `0x012c` | Workbook header — name, Discoverer version, NLS |
| `0x00d2` | Custom (PL/SQL) function reference |
| `0x00db` | Reference to a real EUL item, by folder + item name |
| `0x00dc` | Calculation defined inside the workbook |
| `0x00fa` | Condition |
| `0x0104` | Parameter |
| `0x02bc` | A displayed worksheet column |
| `0x0640` | Format masks (display + storage) |
| `0x07d0` | Font |
| `0x0c1c` | Total / summary row |
| `0x01f4` | Worksheet |

Every other class the container uses — the query request, the worksheet layout,
sorts, joins, page setup, the view type and the style chain — is decoded in
**§7.8**.

### 7.3 String tags

| Tag | Meaning |
| --- | --- |
| `0x0066` / `0x0067` | EUL owner schema / EUL name |
| `0x0132` | Workbook name |
| `0x012e` / `0x0137` | Discoverer version / NLS stamp |
| `0x0fa0` / `0x00de` | Item identifier (`DT_EMISSAO`) / item label (`Dt Emissao`) |
| `0x0fa1` / `0x00e5` | Folder identifier (`M_M27`) / folder label (`M M27`) |
| `0x00e0` | Calculation formula, token form |
| `0x064a` / `0x064c` | Display / storage format mask |
| `0x02c2` / `0x0fab` | Column heading / element reference |
| `0x00fc` / `0x00fd` / `0x00ff` | Condition SQL text / name / token form |
| `0x0106` / `0x0107` / `0x0109` / `0x010a` | Parameter name / description / prompt / default |
| `0x01f6` / `0x01f9` / `0x0200` | Worksheet name / printed title / GUID |
| `0x0c21` | Total label |

Note the direction of the item pair: `0x0fa0` is the EUL *identifier* and
`0x00de` the *label*. Discoverer Neo stores the label in `items.name`, so the
label is the fallback for resolving a column to a migrated item — but see the
integer fields below, which resolve it exactly.

### 7.3b Integer fields — how a column identifies its item

Two 4-byte fields decide whether a workbook is merely readable or actually
resolvable. Both are written as `<type> <tag:u16 LE> 00 <value:u32 LE>`:

| Type | Tag | On | Meaning |
| --- | --- | --- | --- |
| `0x01` | `0x00dd` | item element (`0x00db`/`0x00dc`) | The EUL **`EXPRESSIONS.EXP_ID`** |
| `0x02` | `0x02bf` | column element (`0x02bc`) | The **element id** of the item the column shows |

`0x00dd` was confirmed against the live source: the value `109075` on a
`NIPC_ER` element is exactly that item's `EXP_ID` in `EUL4_EXPRESSIONS`, and
across the corpus the field's range (100 172 – 268 831) matches the table's
(100 170 – 268 831). It means a workbook column resolves to a migrated item by
the same key every other foreign key in the migration uses, instead of by
matching display names that may since have been renamed.

`0x02bf` matters just as much. **A column carries its own item element only the
first time that item appears in the worksheet's layout**; every later use
carries just this reference. Reading only the preceding element leaves 46 % of
the columns in the source EUL with no item at all — and silently attributes
some of them to the wrong one.

Two neighbouring fields on a column, `0x02c0` and `0x02c1`, point at its data
and heading style elements. They are not read.

Those two were, for a while, the only integers decoded at all — on the belief
that a general integer decode was unsafe because widths were class-dependent.
**§7.8 supersedes that**: widths come from the record, every field of the
worksheet model is now read, and `NUMERIC_TAGS` survives only as the allowlist
for the resynchronizing fallback, where widths genuinely are unknown.

### 7.4 Document layout

```
[0x0064] EUL identity
[0x012c] workbook header
...      shared definitions: items, calculations, conditions, parameters
...      worksheet 1 layout: column groups
[0x01f4] worksheet 1        <- name, GUID, printed title
...      worksheet 2 layout
[0x01f4] worksheet 2
```

A worksheet element comes **after** the layout it describes, so worksheets
partition the stream into sections and section *k* belongs to worksheet *k*.

A displayed column is a fixed group ending in a `0x02bc`:

```
[0x00db] item reference        <- or [0x00dc] for a calculation; omitted when
                                  the item is already defined elsewhere
[0x0640] format masks (data)
[0x07d0] font
[0x0320] cell style
[0x0640] [0x07d0] [0x0320]     heading style
[0x02bc] the column            <- heading text + item reference (0x02bf)
```

The item a column shows is the element its `0x02bf` field names — not simply
the preceding element, which is absent on most columns (see §7.3b). The mask
used to be taken positionally, as the **first** `0x0640` of the pair; it is now
resolved through the column's own style chain
(`0x02c0` → `0x0320` → `0x07d0` → `0x0640`, §7.8.8), which agrees with the
positional rule on all 21 978 columns it resolves and finds one more. The
positional rule remains the fallback for an element that could not be framed.

### 7.5 The condition token language

Every condition is stored twice: as the text Discoverer displays (`0x00fc`) and
as a token tree (`0x00ff`).

**Only the tree is authoritative.** `0x00fc` is a display string Discoverer cuts
at 100 characters — 272 of the source EUL's 3 395 conditions are truncated
mid-expression — so it can be shown to a person but never parsed.

```
[1,92]([6,28],[8,65],[8,29])              Dt Provisao BETWEEN :Dt Inicio AND :Dt Fim
[1,88]([6,85],[5,2,"15"],[5,2,"16"])      Cdestado IN (15,16)
[1,98]([1,86]([6,30],[8,51]),             DT_ANULACAO >= :"Dt Cancelamento >=" AND
       [1,85]([6,30],[8,52]))             DT_ANULACAO <= :"Dt Cancelamento <="
```

A node is `[kind,…]`, optionally followed by a parenthesised argument list:

| Node | Meaning |
| --- | --- |
| `[1,n]` | built-in operator or function — `n` is `EUL_FUNCTIONS.FUN_ID` |
| `[2,n]` | custom (PL/SQL) function, `n` an element id in this workbook |
| `[5,k,"…"]` | literal; `k` is 1 string, 2 number, 4 date |
| `[6,n]` | item element `n` |
| `[8,n]` | parameter element `n` |

`parseConditionTree` reads this as a real tree and **fails rather than
half-reading**: a malformed token string is reported, not scanned for whatever
can be recognized. All 3 395 conditions of the live source parse with no
failures and no trailing input.

#### The function table — recovered, not guessed

`[1,n]` is `EUL_FUNCTIONS.FUN_ID`. The whole table is in
`DISCVR4/DCESQRES.DLL`, which carries the EUL seed script as literal
`insert into EUL4_FUNCTIONS (…) VALUES (…)` text. Extracting it gives 222
built-ins, **identical row for row** to the live source's own
`EUL4_FUNCTIONS`. Ids above 222 are customer-defined (on the live source they
start at 112 777) and the token language reaches those through `[2,n]` instead.

`FUN_FUNCTION_TYPE` says what a code is: **1** a comparison predicate, **3** a
logical connective, anything else a value function. That is what makes a
boolean position in the tree decidable rather than guessed. The complete set of
types 1 and 3:

| Code | | Code | | Code | |
| --- | --- | --- | --- | --- | --- |
| 81 | `=` | 89 | `IS NULL` | 99 | `OR` |
| 82 | `<>` | 90 | `IS NOT NULL` | 100 | `NOT LIKE` |
| 83 | `>` | 91 | `NOT IN` | 101 | `NOT` |
| 84 | `<` | 92 | `BETWEEN` | 104 | `!=` |
| 85 | `<=` | 93 | `NOT BETWEEN` | 105 | `^=` |
| 86 | `>=` | 98 | `AND` | 123 | `EXISTS` |
| 87 | `LIKE` | | | 124 | `ANY` |
| 88 | `IN` | | | 125 | `ALL` |

**`[1,101]` = `NOT` is the negation.** It is the token-language spelling of the
per-node flag in Oracle's own workbook object model —
`DCBImportedFilterNode::IsNot` in `DISCVR4/DCBIMPB.DLL`, set through `SetNot`
and read by `BuildFilterString`. The other negated forms fold the negation into
the operator's name (`NOT IN`, `NOT LIKE`, `NOT BETWEEN`, `IS NOT NULL`). None
of them migrates, ever: dropping a negation replaces a filter with its
complement, and a reviewer looking at row counts would not notice.

The value-function codes are named too, now that the table is known — `[1,49]`
is `TRUNC`, `[1,68]` `NVL`, `[1,102]` `DECODE` — which is what lets the
migration say *why* a condition was not migrated instead of printing a code.
Calculation formulas still migrate with their function codes as written: half
the codes are infix operators (`[1,94]` is `+`, `[1,106]` a bracket) and
rendering only the prefix ones would produce something that reads like SQL and
is not.

#### How deep the trees actually go

Measured over all 3 395 conditions in the live source. A condition attaches to
every worksheet of its workbook (§7.6), so it is counted both as a definition
and as the instances it produces:

| Boolean depth | Shape | Definitions | Instances | |
| --- | --- | ---: | ---: | ---: |
| 0 | a single test | 2 931 | 6 798 | 92.6 % |
| 1 | a flat `AND` | 361 | 430 | 5.9 % |
| 1 | a flat `OR` | 101 | 103 | 1.4 % |
| 2 | an `OR` of `AND`s | 2 | 7 | 0.1 % |
| ≥3 | — | 0 | 0 | 0 % |

So conjunctions are 92.6 % + 5.9 % of it, nesting is all but absent, and the
deepest thing in a 558-workbook EUL is two levels.

#### Which is why `map_conditions` did not need a `parent_id`

Neo stores conditions flat, with a `group_id` and a `logic_operator`
(`backend/src/db/schema.ts`). Rows sharing a group are parenthesized and joined
by their own operators; the groups are joined to each other. A group's *first*
row therefore says how that group joins the previous one, and the rest say how
they join inside it — one column doing two jobs by position
(`backend/src/lib/sql/where-clause.ts`).

That expresses any boolean tree **two levels deep**, which is every condition
that exists in the source:

```
[1,99]( [1,98](a, b), [1,98](c, d) )     ->  (a AND b) OR (c AND d)
        group 1        group 2               join=AND       join=OR
                                             inner=AND      inner=AND
```

A self-referencing `parent_id` would express arbitrary depth, but nothing in
the corpus needs it and it would have to be honoured by the WHERE-clause
builder, the query engine, the map editor and the API. The flat model stays;
`planCondition` reports anything deeper instead of reshaping it into something
that reads the same and filters differently.

Two consequences of the flat model are load-bearing rather than incidental:

- **An `OR` at the top must be bracketed before anything is ANDed after it.**
  `a OR b AND <security predicate>` parses as `a OR (b AND <security>)`, which
  returns every row matching `a` regardless of the security rule. Now that `OR`
  conditions migrate, `buildWhereClause` brackets the whole condition block
  whenever any group is ORed on.
- **A group joins its rows with one operator**, so a test that needs two rows
  ANDed cannot sit inside a group that is ORing. That case is reported.

#### What migrates, and what is reported

A condition is **all or nothing**. Migrating the expressible part of a
conjunction widens the filter and of a disjunction narrows it; either way the
map returns a different set of rows while looking like it migrated cleanly.

Neo's condition is `item OPERATOR value`, so a test migrates only when the left
side is the item itself and the right side is literals or one parameter.

One rewrite is applied, and it is an identity rather than an approximation:
**`x BETWEEN a AND b` becomes `x >= a AND x <= b`** when the two bounds are not
something Neo can hold in one row — Discoverer prompts for the two ends of a
range with two separate parameters (`:"Dt Fim Vigência >="` and
`:"Dt Fim Vigência <="`) while a Neo condition binds one. That is Oracle's own
definition of `BETWEEN`, unknown-on-NULL behaviour included, so the two rows
are the same filter and both prompts survive. It is worth 613 instances — the
largest single bucket. `NOT BETWEEN` has an equivalent expansion
(`x < a OR x > b`) which is deliberately *not* applied: it is negation, it
occurs zero times in the corpus, and the rule against migrating anything
negated is worth more than the untested code.

#### Parameter names are labels, not identifiers

Discoverer quoted a parameter wherever it appeared in SQL — `:"Dt Fim Vigência
>="`, not `:Dt Fim Vigência >=` — which let an author name a prompt anything at
all, and they did. Of the 7 466 parameters in the source EUL, only 2 536 are
spellable as an Oracle bind variable; the rest carry spaces, accents, or the
comparison operator the prompt is for: `Dt Fim Vigência >=`, `Apólice nº`,
`DATA FIM`, `VALOR SUPERIOR A`.

Neo therefore gives a parameter **two** names. `map_parameters.name` keeps the
prompt exactly as Discoverer had it, because that is what a person is asked at
run time. `map_parameters.bind_name` is an Oracle identifier derived from it
(uppercased, everything outside `[A-Z0-9_]` collapsed to `_`, capped at 26
characters so the SQL generator's own `_lo`/`_hi`/`_0…n` suffixes still fit
Oracle's 30) and uniquified within the map — `Dt Anulação <=` and
`Dt Anulação >=` reduce to the same base and become `DT_ANULA_O` and
`DT_ANULA_O_2` rather than collapsing into one filter.

`map_conditions.param_name` stores the **bind name**, not the prompt. A
condition's parameter reference is matched to a declaration case-insensitively,
the way Discoverer resolved it: a condition on `RAMO` against a prompt declared
`Ramo` is the same parameter.

The derivation lives in `backend/src/lib/sql/identifiers.ts` (`makeBindName`),
is mirrored in `migrate/src/services/transformers/transform.ts` because the two
packages share no code, and again in the backfill
`backend/drizzle/0008_bind_safe_parameter_names.sql`. All three must move
together; a shared table of cases in `backend/src/__tests__/identifiers.test.ts`
and `migrate/src/__tests__/transformers.test.ts` is what catches it if they do
not.

Result over the 7 338 condition instances:

| | Definitions | Instances | |
| --- | ---: | ---: | ---: |
| Migrates, exactly | 2 446 | 5 127 | 69.9 % |
| Reported | 949 | 2 211 | 30.1 % |

producing **6 101 `map_conditions` rows**, 1 097 of them inside a group.

Everything reported is genuinely inexpressible, not merely unimplemented:

| Reason | Definitions | Instances |
| --- | ---: | ---: |
| a function wraps the item on the left — `TRUNC(Dt Cobro) <= :DT FIM`, `NVL(Cdtipcom,'a') LIKE :p` | 647 | 1 476 |
| an expression on the right — `… <= TO_DATE(:Dt,'DD-MON-RRRR')+0.99999`, `Feocurre Year = Feapertu Year` | 284 | 710 |
| negation — `NOT IN`, `IS NOT NULL` | 18 | 25 |

The first two are the same shape of problem: Neo can only filter a column, not
an expression over one. Storing `TRUNC(Dt Cobro) <= :DT FIM` against `Dt Cobro`
would compare a timestamp where Discoverer compared a date and quietly drop
rows — which is precisely what the migration used to do.

### 7.6 Scope

Measured over the live source's 558 workbooks, as it stood before W2. The
corpus is now 564 workbooks and the calculation counts have changed — see
§7.8.15 for the current figures and why the calculation numbers here undercount.



| | Count |
| --- | --- |
| Workbooks decoded | 558 / 558 |
| Worksheets | 916 |
| Displayed columns | 32 841 (8 487 over workbook calculations) |
| Columns carrying an EUL `EXP_ID` | 24 353 of 24 354 |
| Conditions | 3 395 (all parse; 0 with an unrecognized operator) |
| Parameters | 3 859 |
| Calculations | 9 616 distinct per workbook, 11 801 per worksheet |

Migrated into the live target, those 916 worksheets produce 916 maps with
24 244 columns, **5 583 conditions**, 7 466 parameters and 11 801 calculated
fields. 110 columns (0.45 %) name an item no longer in the EUL and are dropped.
Of the 7 338 condition instances, 2 211 (30.1 %) cannot be expressed as a Neo
filter and are reported one by one with their reason (§7.5), and 309 more
filter an item that has since left the EUL. Exactly one worksheet comes out
empty, because every item it displayed has been deleted from the EUL.

The first run to read the workbook bodies wrote 6 501 conditions instead, but
that number was not what it looked like. Its scan took the first `[6,n]` in a
tree as the filtered item and every `[5,…]` anywhere in it as the value, so
1 463 instances migrated with an operand quietly dropped (`TRUNC(Dt Cobro) <=
:DT FIM` stored as a filter on `Dt Cobro`; a `TO_DATE` format mask stored as a
range bound) and 876 more became rows that cannot generate SQL at all — 469 of
them `STATIC` with a null value, which raises `SqlGenerationError` the first
time anyone runs the map. Fewer conditions now, and each one is the filter
Discoverer had.

Conditions and parameters are **workbook-scoped**: all 3 395 conditions and
3 859 parameters sit in the shared section before the first worksheet, and
nothing in a worksheet's own section references them. Which worksheet activates
which condition is therefore not recoverable, so every condition is attached to
every map the workbook produces and multi-worksheet workbooks get an explicit
warning. Calculations, by contrast, are written into each worksheet's own
section and are scoped there.

### 7.7 Verified against Oracle's own dump tool

`DISCVR4/d4wkdmp.exe -f` — Oracle's own workbook dumper — runs (see
`DISCOVERER_NEO_WORKSHEET_FIDELITY_PLAN.md` §2 for the recipe) and gives a
reference to check this parser against instead of trusting it on inspection.
The harness is `migrate/src/services/d4wkdmp-dump-parser.ts` +
`d4wkdmp-differ.ts`, driven by `migrate/src/scripts/diff-corpus.ts`; see
`migrate/src/scripts/README.md` for how to run it and the full per-field
tallies. **544 of 558 workbooks dumped** (97.5% — the 14 failures are a live
Oracle-side `InvalidID` error on orphaned alternate-named copies, not an
environment problem) and diffed, 2026-08-25:

- **Items agree 99.9%** (29 591/29 611) and **custom functions 100% matched /
  99.7% name-agree**, correlated exactly via `IoId` (= the raw element's own
  sequential id — the dump prints `IoId` only on `EUL Item Reference` and
  `EUL Function Reference`, the two classes the token language addresses by
  numeric id). The rare exceptions: one workbook where every `IoId` runs
  consistently one less than the parser's element id; one workbook with zero
  `EUL Item Reference` entries in the dump despite 60+ in the parser (every
  item it shows looks to have been deleted from the EUL); two function-name
  mismatches shaped like the calculation finding below (workbook-local name
  carries a disambiguating suffix the EUL catalog name lacks). Full detail in
  `migrate/src/scripts/README.md`.
- **A calculation can reference another calculation, and the dump silently
  resolves it while the parser does not.** — **WITHDRAWN by W2, §7.8.16.** The
  dump does *not* expand it: 25 216 calculations in the corpus reference another
  calculation and every one has a byte-identical `IOFormula` in the dump. The
  disagreements this was inferred from came from calculations whose formula was
  over 254 bytes and so was dropped entirely (§7.8.1), leaving the differ's
  name-based fallback to match the wrong element. Left below as first written.
  `[6,n]` inside a calculation's
  `IOFormula` usually names a plain EUL item, but sometimes `n` is itself
  another `0x00dc` (`EUL Private Item`) element — Oracle's dump recursively
  substitutes that referenced calculation's own formula in place; the parser's
  `tokens` field is the literal, unexpanded byte content, confirmed correct by
  reading the referenced element directly. Anything that consumes a
  calculation's *fully resolved* formula (W2/W6) needs to walk this chain.
  Measured impact: only 24.7% of 41 263 name-matched calculations agree on
  `ioFormula`.
- **Calculation names are not unique within a workbook, and
  `collectCalculation`'s dedup-by-name silently drops the rest.** Across all
  544 dumped workbooks, 41 982 `EUL Private Item` entries exist but only
  41 263 (98.3%) even found a name-matched parser calculation to compare
  against — every match absorbs however many same-named siblings existed. A
  95-workbook sub-sample measured the true collision rate directly: 79% of
  entries share a name with another in the same workbook (5 293 of 6 697),
  98% of those (5 205) with a genuinely different formula — typically the
  same named calculation redefined once per month/period column with a
  different embedded literal date (e.g. `TO_DATE('31-JAN-2005', ...)` vs
  `TO_DATE('04-ABR-2008', ...)` under an identical display name,
  `RESSEGURO CEDIDO TOTAL1` in `GD_M.M78B_V05.DIS`). 23 of that 95 (24%) are
  affected. **This means the "9 616 distinct / 11 801 per worksheet"
  calculation counts above already undercount** — `worksheet.calculations`
  keeps only the first occurrence per name, so every later same-named
  redefinition is silently discarded, not merely unmigrated.
  **Fixed 2026-08-27.** `collectCalculation` now dedupes by element id, not
  name — every calculation with its own formula survives regardless of how
  many worksheet siblings share its display name. A name that collides is
  disambiguated by appending the colliding element's own id (`"NAME #123"`);
  the first occurrence keeps its bare name, so the non-colliding common case
  is unchanged. Chosen over an ordinal suffix (`"NAME (2)"`, the pattern
  `map-reimport.ts`'s `uniquify()` already uses for colliding *map* names)
  specifically for traceability: the id is exactly what a reviewer can
  cross-check against `d4wkdmp -f`'s own `IoId` when auditing a specific
  calculation later. `humanizeFormula`'s `[6,n]` substitution was updated to
  match — a formula referencing another calculation now resolves to *that*
  calculation's own disambiguated name rather than an arbitrary same-named
  sibling's, which matters once duplicates stop being silently dropped.
  Deliberately NOT addressed by this fix: the separate finding above (a
  `[6,n]` reference to a calculation is a *name*, not that calculation's own
  formula recursively inlined the way Oracle's dump renders it) — `formula`
  is already documentation-grade text a person must rewrite as SQL before a
  map runs (see `transform.ts`'s `MAP_CALCULATION_COLUMNS` warning), not
  executable output, so getting the *name* right is what this fix needed;
  full recursive inlining remains W2/W6 scope. Tests:
  `workbook-parser.test.ts`'s `keeps every same-named calculation...` and
  `resolves a cross-calculation reference to the specific, disambiguated
  calculation...`.

  **Confirmed against the live 544-workbook corpus, 2026-08-27.** The differ's
  calculation correlation was upgraded alongside this verification: it now
  matches on the calculation's own negative synthetic id (the same `0x00dd`
  field an item uses for its `EXP_ID`, just negative — exact and unique per
  calculation, the same idea as `IoId` for items) rather than name alone,
  since post-fix a name can legitimately belong to several distinct
  calculations. Result: **`ioFormula` agreement jumped from 24.7% to 93.9%**
  (38 727 agree / 2 536 disagree of 41 263 matched) — and every one of those
  38 727 exact-id matches agrees, with zero exceptions. The residual 2 536
  disagreements are, sampled and confirmed, **entirely** the separate,
  still-open nested-calculation-reference finding above (dump expands `[6,n]`
  recursively, parser does not) — not a regression, not a new gap. Every
  other section (items, functions, private filters, parameters, sheets) is
  numerically identical to the pre-fix run, confirming the fix's blast radius
  stayed exactly where intended. **Still open: re-importing the maps already
  migrated under the old dedup** (`node migrate/src/services/map-reimport.ts`
  / `POST /api/migration/reimport-maps`) — a live decision for whoever owns
  that migration, not run automatically here.
- **Private filters: 99.0% matched (3 299/3 331), 99.9% formula agreement
  among matches.** Nearly every unmatched parser-side condition carries
  neither `CONDITION_SQL` nor `CONDITION_NAME` — suspected to be a
  workbook-local placeholder for a shared `EUL Filter Reference` the differ
  does not yet cross-check, not a decode failure. Unconfirmed.
  **Resolved by W2, §7.8.16:** they are simply conditions with no name to match
  on. Correlating on `0x00fb`, the condition's own negative synthetic id,
  matches **3 331 of 3 331**. Shared EUL filters do exist as their own class
  (`0x00f9`) and appear in none of the 564 live workbooks.
- **Parameters: 100% matched (3 784/3 784), 99.6% prompt agreement.** All 17
  disagreements are the same collision shape as calculations, in miniature:
  two parameters in one workbook whose `Name` is identical only *after*
  trimming trailing whitespace (`"DATA FIM"` vs `"DATA FIM "`, confirmed in
  `GD_M.M59_V04`) — both the parser and the differ trim before comparing, so
  the pair collapses onto one. Far rarer than the calculation case; not
  filed as its own task.
- **Sheets**: 896/896 matched, names agree 100%; of 33 290 displayed items
  compared, 1 137 (3.4%) were dump-only and 48 (0.14%) parser-only — a real,
  smaller gap worth explaining before W4.
  **Explained by W2, §7.8.4:** the dump's `Items :-` list is the sheet's
  *query* items, not its displayed columns, and an item a calculation needs but
  no column shows belongs to the first and not the second. Compared against
  `ParsedWorksheet.queryItemRefs`, the same corpus is 33 242 matched with **zero
  dump-only**.

---

## 7.8 The worksheet model

Task W2. Everything in this section was decoded from the same 544 dumped
workbooks §7.7 uses, and each field is labelled with how it was established:

| Label | Means |
| --- | --- |
| **[DUMP]** | Compared field-for-field against `d4wkdmp -f` over the whole corpus; the counts are quoted per field. |
| **[STRUCT]** | Not printed by the dump, but every value resolves to an element of exactly one class across the corpus, or the field is load-bearing for the byte stream to parse at all. |
| **[INFER]** | Not printed by the dump; a cross-tabulation against something that *is* fixes the meaning. Stated with the correlation that fixes it. |
| **[UNCONFIRMED]** | Read and exposed, meaning not established. Deliberately **not** guessed. |
| **[BINARY]** | Read out of Discoverer 4.1's own shipped binaries in `DISCVR4\` — an exported C++ symbol, or a message in an Oracle `.MSB`. Added by §7.12; nothing before it uses this label. |

The corpus is now **564 workbooks** in `EUL4_DOCUMENTS` (six more than when §7.6
was measured), of which 544 have a `d4wkdmp -f` dump. Oracle's own three shipped
samples — `DISCVR4/VIDSTR4.DIS`, `DISCVR4/VIDAF4.DIS` and
`DISCVR4/DEMO/OLEAUTO/VIDEO.DIS` — are used as well, because they contain
constructs the customer corpus has none of (a crosstab worksheet, a shared EUL
filter reference, a chart). `d4dumps/_VIDSTR4.sample.txt` is Oracle's dump of
the first of them, so those constructs are checkable too.

### 7.8.1 The container is self-describing — §7.1 was wrong about widths

§7.1 said the format is *schema-driven*: "under one class, type `0x02` is a
4-byte colour; under another it is `[count:u16][count x int32]`", and concluded
that a total parse needs Oracle's class schema. **That is not so.** Both shapes
occur, but which one applies is written into the stream, not into a schema: an
array is bracketed by two marker records that say "the next record is a counted
vector". With those brackets read, every record's width follows from its own
type byte and nothing else.

The complete record grammar:

```
record   [type:u8][tag:u16 LE][flags:u8] payload
```

| type | payload | notes |
| --- | --- | --- |
| `0x00` | see below | structural marker, or a 4-byte object reference |
| `0x01` | int32 | |
| `0x02` | int32 | also carries `COLORREF`s and element references |
| `0x03` | int16 | |
| `0x04` | int16 | one instance corpus-wide, in `VIDAF4.DIS` (`0x08fc`/`0x0927`) |
| `0x05` | uint8 | |
| `0x06` | IEEE float32 | |
| `0x07` | uint8 | |
| `0x08` | `[len][len bytes]`, latin-1 | counted length, see below |
| `0x0a` | `[subtype:u32][len:u32][len bytes]` | Oracle dates, typed literals |

Type `0x00` is the structural type. Four tags are reserved:

```
00 01 00 00 | 00 <class:u16 LE> 00 | <elementId:u32 LE>   BEGIN  (payload 8)
00 02 00 00 | 00 <class:u16 LE> 00                        END    (payload 4)
00 0a 00 00                                               vector of values, open
00 0b 00 00                                               vector of values, close
00 0c 00 00                                               vector of records, open
00 0d 00 00                                               vector of records, close
```

Under **any other tag**, type `0x00` is a 4-byte **object reference** — the
element id of another element. That is the single fact that turns a flat
sequence of elements into a graph, and it is what §7.1's "none — a marker"
row was hiding. **[STRUCT]** — §7.8.2 tabulates where every one of them points.

Two things were also wrong about strings. The length is not a plain `u8`: it is
`DCWArchive`'s counted form, the same convention MFC's `CArchive` uses — one
byte, escaping to a `u16` when that byte is `0xff` and to a `u32` when the `u16`
is `0xffff`. **A formula longer than 254 bytes was therefore unreadable**, and
`readCalculation` dropped every calculation carrying one. Measured directly by
running the same parser with and without record framing over all 564 workbooks:
**43 992 → 47 548 calculations per workbook (+3 556), 46 184 → 49 819 per
worksheet (+3 635), with nothing lost and no existing token string changed.**
That is a migration-affecting correctness fix, not only a decoding one:
`map_calculated_fields` was missing those rows.

**Vectors.** Between a `0x000a`/`0x000c` marker and its closing partner sits
exactly one record, and that record's payload is preceded by a `u16` count and
repeats that many times. `0x000a` repeats bare payloads; `0x000c` repeats
complete records, header included. Only saved parameter values (`0x0898`,
tag `0x089a`, 3 033 instances) use the second form. **[STRUCT]**

**Evidence.** With this grammar, **490 942 of 490 942 element bodies across all
564 live workbooks, and 667 of 667 across Oracle's three shipped samples, parse
as a complete record sequence that accounts for every byte from the element's
BEGIN to its END** — no leftovers, no unknown type bytes, nothing skipped. A
grammar that is wrong anywhere does not close half a million bodies exactly.

**An END record closes the body**; whatever follows belongs to the next element
or, after the last one, to a short document trailer (a bare `00 fb 01 00`
record). §7.1's observation that an END names the element's *base* class rather
than its own holds, and is narrower than it looked: across a 60-workbook sample
the only class whose END names something else is `0x0104` (parameter), which
closes with `0x00dc`. Every other class closes with itself.

**The parser still resynchronizes.** `readWorkbookElements` opens an element on
a BEGIN whose id is exactly the next expected — unchanged, and still what
rejects marker-shaped bytes inside a payload — then reads the body as a record
sequence. If the body does not frame, it falls back to skipping a byte at a
time, recognizing only strings and the `NUMERIC_TAGS` allowlist, until the next
valid BEGIN. So a body that cannot be decoded still costs that body and nothing
else, and no width is ever assumed. `RawElement.framed` says which path was
taken and `ParsedWorkbookDocument.unframedElements` counts the fallbacks —
**zero on all 567 workbooks**.

`NUMERIC_TAGS` now applies **only** to that fallback, and lists only tags whose
record type is `0x01`/`0x02` (4-byte). Reading four bytes where the real record
is one or two wide would invent a value, so the one-byte fields of this
section (`Hidden`, `Distinct`, `Case Sensitive`, …) are simply **absent** from
an unframed element rather than guessed.

### 7.8.2 The reference graph

Every reference field, and what its values resolve to across the 564 workbooks.
`resolves` counts values that name an existing element; `zero` counts the
explicit null (`0`) Discoverer writes for an absent optional reference.

| From | Tag | Type | To | n | resolves |
| --- | --- | --- | --- | ---: | --- |
| `0x00dc` calculation | `0x00e4` | `0x02` vec | `0x00db` / `0x00dc` | 139 939 | 100 % |
| `0x00f0` sort | `0x00f1` | `0x02` | `0x00db` / `0x00dc` | 3 864 | 100 % |
| `0x00fa` condition | `0x00e4` | `0x02` vec | `0x00db` / `0x00dc` | 4 430 | 100 % |
| `0x00fa` condition | `0x010c` | `0x02` vec | `0x0104` | 8 488 | 100 % |
| `0x0104` parameter | `0x010b` | `0x01` | `0x00db` / `0x00dc` | 2 580 | 100 % |
| `0x0122` query | `0x0123` | `0x00` vec | `0x00db` / `0x00dc` | 21 665 | 100 % |
| `0x0122` query | `0x0124` | `0x00` vec | `0x00db` / `0x00dc` | 13 046 | 100 % |
| `0x0122` query | `0x0125` | `0x00` vec | `0x00f0` | 3 864 | 100 % |
| `0x0122` query | `0x0126` | `0x00` vec | `0x00fa` (`0x00f9` in the samples) | 2 582 | 100 % |
| `0x0122` query | `0x0127` | `0x00` vec | `0x0118` | 24 | 100 % |
| `0x0190` document | `0x0192` | `0x02` | `0x012c` | 564 | 100 % |
| `0x0190` document | `0x0194` | `0x02` | `0x0834` | 564 | 100 % |
| `0x0190` document | `0x01f4` | `0x00` vec | `0x01f4` | 923 | 100 % |
| `0x01f4` worksheet | `0x01f7` | `0x02` | `0x0258` | 923 | 100 % |
| `0x01f4` worksheet | `0x01f8` | `0x02` | `0x0384` / `0x0385` | 923 | 100 % |
| `0x01f4` worksheet | `0x01fa` | `0x02` | `0x07d0` | 923 | 100 % |
| `0x0258` layout | `0x025d` | `0x00` vec | `0x02bc` | 33 482 | 100 % |
| `0x0258` layout | `0x025f` | `0x00` vec | `0x02bc` | 27 | 100 % |
| `0x0258` layout | `0x0264` | `0x02` | `0x04b0` | 923 | 100 % |
| `0x0258` layout | `0x0265` | `0x00` vec | `0x00fa` | 2 582 | 100 % |
| `0x0258` layout | `0x0266` | `0x02` | `0x079e` | 923 | 9 % (840 zero) |
| `0x0258` layout | `0x0268` | `0x00` vec | `0x0c1c` | 19 637 | 100 % |
| `0x0258` layout | `0x026a` | `0x00` vec | `0x0898` | 3 035 | 100 % |
| `0x0258` layout | `0x026b` | `0x02` vec | `0x0d48` | 923 | 100 % |
| `0x0258` layout | `0x026d` | `0x02` | `0x0272` | 917 | 100 % |
| `0x02bc` column | `0x02bf` | `0x02` | `0x00db` / `0x00dc` | 33 508 | 100 % |
| `0x02bc` column | `0x02c0` | `0x02` | `0x0320` | 33 509 | 100 % |
| `0x02bc` column | `0x02c1` | `0x02` | `0x0320` | 33 509 | 100 % |
| `0x0320` style | `0x0322` | `0x02` | `0x07d0` | 106 296 | 100 % |
| `0x04b0` sort list | `0x04b2` | `0x00` vec | `0x0514` | 3 865 | 100 % |
| `0x0514` sort entry | `0x0517` | `0x02` | `0x00db` / `0x00dc` | 3 865 | 100 % |
| `0x0514` sort entry | `0x0518` | `0x02` | `0x05dc` | 3 865 | 53 % (1 836 zero) |
| `0x05dc` | `0x05dd` | `0x02` | `0x0578` | 2 029 | 100 % |
| `0x076c` item value | `0x076e` | `0x02` | `0x00db` / `0x00dc` | 125 | 100 % |
| `0x079e` | `0x07a0` | `0x00` vec | `0x076c` | 125 | 100 % |
| `0x07d0` font | `0x07e8` | `0x02` | `0x0640` | 110 621 | 100 % |
| `0x0834` page setup | `0x083a`–`0x083f` | `0x02` | `0x07d0` | 6 × 564 | 100 % |
| `0x0898` param value | `0x0899` | `0x02` | `0x0104` | 3 035 | 100 % |
| `0x0c1c` total | `0x0c1e` | `0x02` | `0x0320` | 19 639 | 100 % |
| `0x0c1c` total | `0x0c1f` | `0x02` | `0x0320` | 19 639 | 100 % |
| `0x0c1c` total | `0x0c22` | `0x02` | `0x02bc` | 19 639 | 100 % (2 zero) |
| `0x0c1c` total | `0x0c23` | `0x02` | `0x02bc` | 19 639 | 48 % (10 282 zero) |
| `0x0d48` query link | `0x0d49` | `0x00` | `0x0122` | 923 | 100 % |

Not references, despite being type `0x02`: `0x0640`/`0x0649` and
`0x07d0`/`0x07e0`,`0x07e1` are `COLORREF`s — they resolve to nothing, which is
itself the check that they are not ids.

The whole worksheet model hangs off one chain:

```
[0x0190] document
   └─ 0x01f4 → [0x01f4] worksheet (in display order)
                 ├─ 0x01f7 → [0x0258] layout
                 │              ├─ 0x025d → [0x02bc] columns
                 │              │              ├─ 0x02bf → [0x00db]/[0x00dc] the item shown
                 │              │              ├─ 0x02c0 → [0x0320] → [0x07d0] → [0x0640] data style
                 │              │              └─ 0x02c1 → [0x0320] → [0x07d0] → [0x0640] heading style
                 │              ├─ 0x0264 → [0x04b0] → [0x0514] sort entries
                 │              ├─ 0x0265 → [0x00fa] filters
                 │              ├─ 0x0268 → [0x0c1c] totals
                 │              ├─ 0x026a → [0x0898] saved parameter values
                 │              └─ 0x026b → [0x0d48] → [0x0122] query request
                 │                                        ├─ 0x0123 axis items
                 │                                        ├─ 0x0124 measure items
                 │                                        ├─ 0x0125 → [0x00f0] sorts
                 │                                        ├─ 0x0126 filters
                 │                                        └─ 0x0127 → [0x0118] joins
                 └─ 0x01f8 → [0x0384] table | [0x0385] crosstab
```

### 7.8.3 `0x0122` — the query request (`Query Request QRn`)

One per worksheet on the live corpus (923); `VIDSTR4.DIS` has two, one per
sheet. `d4wkdmp -f` numbers them `QR1`, `QR2`, … **in document order**, which is
how they were correlated. **[DUMP]** 896/896 matched.

| Tag | Type | Field | Confidence |
| --- | --- | --- | --- |
| `0x0123` | `0x00` vec | Axis items — `Axis Item Usage`, in the dump's own order | **[DUMP]** 872 agree / 2 disagree |
| `0x0124` | `0x00` vec | Measure items — `Measure Item Usage` | **[DUMP]** 856 / 2 |
| `0x0125` | `0x00` vec | Sorts — `Sort Item Usage`, pointing at `0x00f0` elements | **[DUMP]** 716 / 2 |
| `0x0126` | `0x00` vec | Filters — `Filter Usage` | **[DUMP]** 876 / 2 |
| `0x0127` | `0x00` vec | Joins — `Join Usage`, pointing at `0x0118` | **[DUMP]** 24 / 0 |
| `0x0128` | `0x07` u8 | `Distinct` | **[DUMP]** 896 / 0 |
| `0x0129` | `0x08` str | A GUID with a digit appended (`{…}0`). 33 instances | **[UNCONFIRMED]** |

Every one of the 2-disagreement counts above is the *same* two sheets, both in
`GD_M.M65_V13` — the one workbook §7.7 already records as having every `IoId`
running exactly one less than the parser's element id. No other workbook
disagrees on any query-request field.

**`0x0d48` — the sheet↔query link.** A single reference (`0x0d49`) to the
`0x0122` the layout runs; the layout reaches it through `0x026b`. This is
`d4wkdmp`'s `Query(s) used` / `Query n` lines. **[DUMP]** 894/894 agree.

### 7.8.4 `0x0258` — the worksheet layout

One per worksheet. Holds what is drawn, as opposed to what is queried.

| Tag | Type | Field | Confidence |
| --- | --- | --- | --- |
| `0x025d` | `0x00` vec | Displayed columns, in display order | **[STRUCT]** all 33 482 resolve to `0x02bc` |
| `0x025f` | `0x00` vec | Further columns — 27 instances corpus-wide | **[STRUCT]** all resolve to `0x02bc`; why they are a separate list is **[UNCONFIRMED]** |
| `0x0263` | `0x00` vec | 30 values, 27 of them `0`; the 3 non-zero name `0x03e8` elements | **[UNCONFIRMED]** |
| `0x0264` | `0x02` | The sort list (`0x04b0`) | **[STRUCT]** |
| `0x0265` | `0x00` vec | Filters — the sheet's `Filters :-` list | **[DUMP]** 876/876 agree |
| `0x0266` | `0x02` | Item-value list (`0x079e`), or `0` | **[STRUCT]** |
| `0x0268` | `0x00` vec | Totals (`0x0c1c`) | **[STRUCT]** |
| `0x026a` | `0x00` vec | Saved parameter values (`0x0898`) | **[STRUCT]** |
| `0x026b` | `0x02` vec | Query links (`0x0d48`) | **[DUMP]**, via `Query(s) used` |
| `0x026d` | `0x02` | Graph container (`0x0272`) | **[STRUCT]** |
| `0x025a` | `0x01` | `1` on every worksheet | **[UNCONFIRMED]** |
| `0x025b` | `0x01` | `0` on every worksheet | **[UNCONFIRMED]** |
| `0x025c` | `0x03` | `0` on every worksheet | **[UNCONFIRMED]** |
| `0x0269` | `0x07` | `0` (711) / `1` (212) | **[UNCONFIRMED]** |

**The sheet's `Items :-` list is the query's items, not the layout's columns.**
That is what §7.7's "1 137 (3.4 %) dump-only items" turns out to be: the dump
prints `DCBImportedSheet::GetItemVector()`, which is the union of the query
request's axis and measure lists, and an item a calculation needs but no column
displays is in it with no column of its own. Compared against
`ParsedWorksheet.queryItemRefs` instead, the corpus goes from **32 105 matched
/ 1 137 dump-only / 48 parser-only to 33 242 matched / 0 dump-only / 42
parser-only**. Counted from the parser's side: 1 176 of the corpus's 34 683
query items are displayed by no column.

### 7.8.5 `0x0384` / `0x0385` — the view type (`EDCBViewType`)

The worksheet's `0x01f8` reference names one of two classes, and the class *is*
the view type. Both are otherwise a handful of `0x07` flags and a `0x038d`
colour.

| Class | View |
| --- | --- |
| `0x0384` | Table |
| `0x0385` | Crosstab |

**[INFER]**, strongly: the customer corpus is 923/923 `0x0384`, and Oracle's
samples pair `0x0385` with exactly the sheets whose own names are
`Crosstab Layout` (`VIDSTR4.DIS`, whose dump confirms the name) and `Sheet 2`
of `VIDAF4.DIS`, while every other sample sheet is `0x0384`. The dump prints no
view type, so this is not **[DUMP]**.

### 7.8.6 Sorting — `0x00f0`, `0x04b0`, `0x0514`, `0x05dc`, `0x0578`

Discoverer stores a sort twice: once query-side, once layout-side.

**`0x00f0` — the query-side sort.** This is exactly `d4wkdmp -f`'s
`EUL Sort Item Reference`, printed in document order.

| Tag | Type | Field | Confidence |
| --- | --- | --- | --- |
| `0x00f1` | `0x02` | The item sorted on | **[DUMP]** `Item`, 3 767 agree / 0 disagree |
| `0x00f2` | `0x01` | `Direction` | **[DUMP]** 3 775 agree / 0 disagree |

`Direction` takes only `1` (3 834) and `2` (30) corpus-wide.
**`1` = ascending, `2` = descending — [INFER]**, on two independent grounds:
the layout-side entry carries a boolean (`0x0516`) that is set on *exactly* the
30 sorts whose direction is `2` — across the 3 850 of 3 864 pairs whose two
halves name the same item — and clear on every other, and a boolean whose
default (`0`) is the overwhelmingly common case is the non-descending one, since
Discoverer sorts ascending by default. The dump prints the number, never the
word, so this stops short of **[DUMP]**.

**`0x04b0` — the sort list**, one per worksheet: `0x04b2` is a vector of
`0x0514` entries **[STRUCT]**; `0x04b3` (`0x03`, 0–22) does not track the entry
count and is **[UNCONFIRMED]**.

**`0x0514` — the layout-side sort entry.** Positionally 1:1 with the `0x00f0`
list: over the corpus 3 850 of 3 864 pairs name the same item.

| Tag | Type | Field | Confidence |
| --- | --- | --- | --- |
| `0x0516` | `0x01` | Descending — set on exactly the 30 sorts whose `Direction` is `2` | **[INFER]** |
| `0x0517` | `0x02` | The item sorted on | **[STRUCT]** |
| `0x0518` | `0x02` | Group/break block (`0x05dc`), or `0` (1 836 of 3 865) | **[STRUCT]** |
| `0x0519` | `0x07` | Set on 1 453 of 3 865; correlates loosely with `0x0518` being present | **[UNCONFIRMED]** |
| `0x051a` | `0x01` | Set on 136 of 3 865 | **[UNCONFIRMED]** |

Oracle's `DCBImportedItemSort` has `GetRank()` and `IsABreak()` alongside the
item and direction, so `0x0519`/`0x051a`/`0x04b3` are where those must live —
but the dump prints neither, and nothing in the corpus separates them, so they
are **[UNCONFIRMED]** rather than assigned. **`Rank` is not recoverable from
`d4wkdmp` at all**: it does not print it.

**`0x05dc` / `0x0578`** are the group block and the style it points at; their
own fields (`0x05de`, `0x05df`, `0x05e0` all `0`; `0x057a` the constant 66 048)
are **[UNCONFIRMED]**.

### 7.8.7 `0x0c1c` — totals (`DCBImportedSummary`)

19 639 across the corpus. **`d4wkdmp -f` prints nothing about summaries**, so
none of this is **[DUMP]** — the strongest available evidence is the reference
graph and cross-tabulation against the column being totalled.

| Tag | Type | Field | Confidence |
| --- | --- | --- | --- |
| `0x0c21` | `0x08` | Label template; `&value` / `&item` interpolate the broken-on value | **[STRUCT]** (`Total for &value`, `SubTotal por &Value`) |
| `0x0c22` | `0x02` | The column totalled | **[STRUCT]** 19 637/19 639 resolve to `0x02bc` |
| `0x0c23` | `0x02` | The column whose change breaks a subtotal, or `0` | **[INFER]** — non-zero on 9 357, and non-zero *iff* `0x0c20` is `1` |
| `0x0c1d` | `0x01` | Aggregate function (`EDCBAggregateType`) | see below |
| `0x0c20` | `0x01` | Placement (`EDCBAggregateLocation`) | see below |
| `0x0c1e` | `0x02` | Data style (`0x0320`) | **[STRUCT]** |
| `0x0c1f` | `0x02` | Heading style (`0x0320`) | **[STRUCT]** |
| `0x0c24` | `0x07` | Set on 16 982 of 19 639 | **[UNCONFIRMED]** |
| `0x0c25` | `0x07` | Set on 149 | **[UNCONFIRMED]** |
| `0x0c26` | `0x07` | Set on 282 | **[UNCONFIRMED]** |
| `0x0c27`, `0x0c28` | `0x07` | `0` on every total | **[UNCONFIRMED]** |

**Aggregate function `0x0c1d`.** Observed: `1` ×19 085, `4` ×282, `3` ×215,
`2` ×35, `6` ×17, `5` ×4, `9` ×1. Only **`1` = SUM** is established
(**[INFER]**): it is the only code that appears exclusively over numeric
columns — 19 084 of its 19 085 totals sit on a column whose format datatype is
`2` (number), the remaining one on a column with no format at all — and its
labels are `Total` / `Soma` / `SubTotal por …`. Codes `3`, `4` and `6` do occur
over *text* columns (51, 194 and 17 times), so they include a counting function,
and 13 of the 35 `2`s carry an average-shaped label — but none of that separates
`3` from `4`, and a total's function is something the migration would have to
generate SQL from. **The rest of the table is [UNCONFIRMED].**

> **§7.12 supersedes this paragraph.** Oracle's own binaries give the class its
> five accessors and the aggregate enum its sixteen members, and settle that a
> percentage is one of those members rather than an element class of its own.
> A pass over the live EUL then established **four** codes, not one:
> `1` SUM, `2` AVG, `3` COUNT, `4` COUNT DISTINCT. Only `5`, `6` and `9` — 22
> summaries between them — are still unnamed.

**Placement `0x0c20`.** Observed: `1` ×9 357, `3` ×6 870, `6` ×3 412.
**`1` = "at each change in `0x0c23`"** is **[INFER]** and solid: `0x0c23` is
non-zero on exactly the totals whose placement is `1`, and zero on every `3`
and every `6`. What separates `3` from `6` — both grand totals with no break
column — is **[UNCONFIRMED]**.

### 7.8.8 The column, and the style chain — `0x02bc`, `0x0320`, `0x07d0`, `0x0640`

New fields on the column element:

| Tag | Type | Field | Confidence |
| --- | --- | --- | --- |
| `0x02be` | `0x01` | Axis type (`EDCBAxisType`): `0` axis, `1` measure, `2` page | **[INFER]**, below |
| `0x02c0` | `0x02` | Data cell style (`0x0320`) | **[STRUCT]** |
| `0x02c1` | `0x02` | Heading cell style (`0x0320`) | **[STRUCT]** |
| `0x02c5` | `0x00` | One instance corpus-wide, naming a `0x0ce4` | **[UNCONFIRMED]** |
| `0x02c6` | `0x01` | `1` on all 33 509 columns | **[UNCONFIRMED]** |
| `0x02c7` | `0x07` | Set on 6 of 33 509 | **[UNCONFIRMED]** |

**`0x02be` is the axis** because it agrees with the query request, which the
dump *does* print: of 33 509 columns, `0x02be = 0` on 21 490 whose item is in
`Axis Item Usage`, `= 1` on 11 982 whose item is in `Measure Item Usage`, and
`= 2` on 26 more that are also axis-listed (a page item is an axis item to the
query) — **11 exceptions in all**. Cross-checked a second way against the
calculation's own `Placement`, which the dump also prints: every column with
`0x02be = 1` over a calculation has `Placement = 1` (7 081 of 7 081), and every
column whose calculation has `Placement = 2` has `0x02be = 0` (1 415 of 1 415).
The converse is not tight — 97 columns pair `Placement = 1` with `0x02be = 0` —
so `Placement` and `EDCBAxisType` are related encodings, not the same one.

**The style chain.** A column names a cell style, the style names a font block,
and the font block names the format block that holds the mask:

```
[0x02bc] --0x02c0--> [0x0320] --0x0322--> [0x07d0] --0x07e8--> [0x0640]
```

This resolves a column's format mask *exactly*, where the older rule — "the
first `0x0640` element after the item" — resolved it by position. The two agree
on all 21 978 columns the positional rule finds and the chain finds one more, so
the parser now walks the chain and keeps the positional rule as the fallback for
an unframed element. **[STRUCT]**

**`0x0640` — the format block.**

| Tag | Type | Field | Confidence |
| --- | --- | --- | --- |
| `0x064a` / `0x064c` | `0x08` | Display / storage mask (already in §7.3) | |
| `0x0642` | `0x01` | Value type: `0` unformatted, `1` text, `2` number, `4` date | **[INFER]** — `0` exactly when there is no mask (57 318), `2` with numeric masks, `4` with date masks; two counter-examples in 110 621. Same code space as `DataType` below |
| `0x0643` | `0x01` | Alignment. Observed `0,1,2,3,4,6` with `8` behaving as an independent bit | **[UNCONFIRMED]** |
| `0x0644` | `0x03` | Non-zero only when `0x0642` is `2` (number): `2`, `3`, `4` | **[UNCONFIRMED]** |
| `0x0645` | `0x07` | Set on 17 399 of 110 621 — `WordWrap` is the only `DCBImportedItemFormat` boolean of that shape | **[UNCONFIRMED]** |
| `0x0646`–`0x0648` | `0x07` | Set on 217 / 13 / 7 of 110 621 | **[UNCONFIRMED]** |
| `0x0649` | `0x02` | `COLORREF` | **[INFER]** — does not resolve as an element id, and takes `0xFF000000`-style values |

**`0x07d0` — the font block.** A `LOGFONT` (`0x07d2` height, negative;
`0x07d6` weight, 400/700; `0x07da`–`0x07de` charset/pitch bytes; `0x07df` face
name) plus two `COLORREF`s (`0x07e0`, `0x07e1`) and:

| Tag | Type | Field | Confidence |
| --- | --- | --- | --- |
| `0x07e4` | `0x01` | **Display width** (`DCBImportedItemFormat::GetDisplayWidth`) | **[INFER]** — non-zero on 22 311 columns, equal on a column's data and heading blocks in 30 037 of 33 509, and larger than the heading's character count on all but 4 of the 23 662 columns whose heading block carries one. **Unit unconfirmed.** |
| `0x07e7` | `0x01` | What the block styles: `1` on all 33 509 column-data blocks, `2` on all 33 509 column-heading blocks, `9` ×19 639 / `10` ×19 622 against 19 639 totals, `4` ×923 against 923 worksheets | **[INFER]** — the counts match those populations |
| `0x07e8` | `0x02` | The format block this font belongs to | **[STRUCT]** |
| `0x07e2`, `0x07e3`, `0x07eb` | `0x01` | | **[UNCONFIRMED]** |

### 7.8.9 `0x0118` — joins (`EUL Join Reference`)

24 across the corpus, 6 in `VIDAF4.DIS`. Reached from a query request's
`0x0127`. **[DUMP]** 24/24 matched, all four fields 24/24 agree.

| Tag | Type | Field |
| --- | --- | --- |
| `0x0119` | `0x01` | EUL join id — the dump's `Id` |
| `0x0fa7` | `0x08` | `Identifier` |
| `0x011a` | `0x08` | `Name` |
| `0x0fa8` | `0x08` | `Owning Folder Identifier` |
| `0x011b` | `0x08` | `Owning Folder Name` |

### 7.8.10 `0x00f9` — a reference to a *shared* EUL filter

**Absent from all 564 live workbooks**, which define every filter privately;
present once in `VIDSTR4.DIS`, where every field below matches its dump line for
line. **[DUMP]**, on that one workbook.

| Tag | Type | Field |
| --- | --- | --- |
| `0x00fb` | `0x01` | EUL `EXPRESSIONS.EXP_ID` — positive, unlike a private filter's |
| `0x0fa2` | `0x08` | `Identifier` |
| `0x00fc` | `0x08` | `Name` |
| `0x0fa3` | `0x08` | `Folder Identifier` |
| `0x00fe` | `0x08` | `Folder Name` |

A private filter (`0x00fa`) uses the same `0x00fb`/`0x0fa2` tags, with a
*negative* synthetic id — which is what §7.8.13 uses to correlate them.

### 7.8.11 `0x0898` — saved parameter values

3 035 across the corpus, reached from the layout's `0x026a`. `0x0899` names a
`0x0104` parameter (**[STRUCT]**, 3 035/3 035) and `0x089a` is a `0x000c`
record-vector of `0x0a` blobs holding the value the workbook was last saved
with, NUL-terminated (`04-ABR-2008`, `25`, `%`). **[INFER]** — the reference is
structural; that the blob is the *saved value* rather than, say, a default is
not something the dump prints. The plan's guess that `0x0898` was exception or
conditional-format ranges is wrong.

### 7.8.12 `0x0834` — page setup, and `0x0190` — the document root

**`0x0834`**, one per workbook, in the shared prefix. Oracle's
`DCBImportedDisplaySettings` has exactly six header/footer slots
(left/centre/right × header/footer) each with a style, and the element carries
exactly six texts, six font references and six margins:

| Tags | Type | Field | Confidence |
| --- | --- | --- | --- |
| `0x0840`–`0x0845` | `0x08` | Six header/footer texts | **[STRUCT]** they exist and pair 1:1 with the fonts; **which slot is which is [UNCONFIRMED]** |
| `0x083a`–`0x083f` | `0x02` | Six fonts (`0x07d0`), always elements 4, 6, 8, 10, 12, 14 | **[STRUCT]** |
| `0x0846`–`0x084b` | `0x06` | Six margins, in inches (0.5 / 0.75 / 1.0 dominate) | **[INFER]** for "margins"; **the order is [UNCONFIRMED]** |
| `0x0835`, `0x0836` | `0x07` | Portrait / landscape | **[UNCONFIRMED]** |
| `0x0837` | `0x03` | `100` on every workbook — a scale percentage | **[UNCONFIRMED]** |
| `0x0838`, `0x0839`, `0x084e`–`0x0850` | | Grid-line and heading toggles, by elimination against `DCBImportedDisplaySettings` | **[UNCONFIRMED]** |

The one text that names itself is `&Page / &Pages`, which appears under
`0x0845` — consistent with header-then-footer, left/centre/right ordering, but
one workbook is not evidence and the dump prints none of it.

**`0x0190`**, the last element of every workbook: `0x0192` → the workbook
header, `0x0194` → page setup, and `0x01f4` → **the worksheet elements in
display order** (**[STRUCT]**, 923/923). `0x0193` (0–4) and `0x0195` (which
resolves to elements of a dozen different classes) are **[UNCONFIRMED]**.

### 7.8.13 New fields on classes §7.2 already listed

**`0x00dc` — calculations.** The first six below are the fields
`EUL Private Item` prints, and every one is **[DUMP]**-confirmed at
**41 982/41 982**. The last two the dump does not print at all.

| Tag | Type | Field | Values | Confidence |
| --- | --- | --- | --- | --- |
| `0x0fa0` | `0x08` | `Identifier` — a small integer, unique in the workbook | | **[DUMP]** |
| `0x00df` | `0x08` | `Desc` | empty on the whole corpus; carries text in `VIDSTR4.DIS`, where it matches | **[DUMP]** |
| `0x00e3` | `0x01` | `DataType` | `1` text, `2` number, `4` date | **[DUMP]** |
| `0x00e2` | `0x01` | `Placement` | `0` not placed on this sheet (38 418), `1` measure (7 323), `2` axis (1 807) | **[DUMP]** |
| `0x00e6` | `0x07` | `Hidden` | set on 38 436 of 47 548 | **[DUMP]** |
| `0x00e7` | `0x07` | `IsACalc` | set on 47 271 of 47 548, clear on 277 — see below | **[DUMP]** value, **[UNCONFIRMED]** meaning |
| `0x00e8` | `0x08` | Format mask carried on the calculation itself | populated on a minority; masks are the same vocabulary as `0x064a` | **[UNCONFIRMED]** |
| `0x00e4` | `0x02` vec | Element ids of the items the formula references, in first-use order | | **[STRUCT]** — on all **45 340** calculations that carry it, the vector is exactly the distinct `[6,n]` of `0x00e0` in first-appearance order, no exceptions; 2 208 carry neither |

`Hidden` being set on four calculations in five is not a surprise once
`Placement` is read next to it: the two are near-complements (38 436 hidden,
38 418 with `Placement = 0`). A workbook writes a calculation element into
every worksheet section that offers it, and most of those instances are not
placed on that sheet's layout at all.

`IsACalc` is **not** simply "this element is a calculation" — every `0x00dc`
element is one, and the flag is clear on 277 of them, Oracle's own `Profit SUM`
sample (a `SUM` over an existing item rather than a new expression) among them.
That reading fits, but 277 cases and one named sample are not enough to call it,
so the field is decoded, **[DUMP]**-matched value for value, and its meaning
left **[UNCONFIRMED]**.

`DataType`'s `1`/`2`/`4` is the same code space `0x0640`'s `0x0642` uses, which
is the cross-check that pins both: `DataType = 4` calculations carry date masks
and date functions, `= 2` numeric ones.

**`0x00fa` — conditions.** `0x0102` is `Case Sensitive`: **[DUMP]**
3 331/3 331 agree. `0x0fa2` is `Identifier`: 3 331/3 331. `0x00fb` is the
condition's own negative synthetic id — **not** printed as such, but it is
exactly what the dump prints as `EUL Private Filter`'s `Id`, and correlating on
it matches **3 331 of 3 331** filters where name matching found 3 299.
`0x00e4` and `0x010c` are the items and parameters the condition references
(**[STRUCT]**, 100 %).

**`0x0104` — parameters.** `0x0fa4` is `Identifier` (**[DUMP]**, 3 736 agree /
47 disagree — every disagreement is the name-collision shape §7.7 already
describes, not a decode problem); `0x0105` is the parameter's own negative
synthetic id (**[STRUCT]**); `0x010b` names the item the parameter is bound to
(**[STRUCT]**, 2 580 of 3 907 carry one). `0x010d` (0/1) and `0x04f6`
(`941`/`942`) are **[UNCONFIRMED]**.

**`0x01f4` — worksheets.** Beyond name/title/GUID: `0x01f7` → layout,
`0x01f8` → view, `0x01fa` → title font (all **[STRUCT]**); `0x0201` is the
printed title as RTF and `0x0205` the same as an HTML fragment; `0x0fa9` is the
worksheet's own element id written as a string. `0x01fb`, `0x01fc`, `0x0202`,
`0x0203` (`4` always), `0x0204` (a colour), `0x01fd`, `0x0386` are
**[UNCONFIRMED]**.

**`0x0272` / `0x026f` — the graph.** `0x0272` is a container reached from the
layout's `0x026d`, and it is **empty on all 917 worksheets that have one** — no
workbook in the corpus has a chart. `VIDAF4.DIS` shows what it holds: references
to `0x026f` elements, each a `name` (`0x0270`) / `value` (`0x0271`) pair such as
`graphLayout` = `graphPosition="rightofdata" widthPixels="335" …`. **[STRUCT]**

**`0x076c` / `0x079e`.** `0x076c` pairs an item reference (`0x076e`) with a
typed `0x0a` value (`0x076f` — subtype 1 a NUL-terminated string, 2 a number,
4 an Oracle date), and `0x079e` is a list of them, reached from the layout's
`0x0266` on 83 of 923 worksheets. Most consistent with a page item's selected
value. **[UNCONFIRMED]** — the dump prints nothing for it.

**Classes read but not modelled**, all rare and none of them named by the dump:
`0x03e8` (3), `0x06a4` (18), `0x0708` (18), `0x0ce4` (1), and `0x08fc` (chart
series, `VIDAF4.DIS` only). Their records are available on `RawElement.records`.

### 7.8.14 What `d4wkdmp -f` cannot confirm

The verification harness is only as good as what Oracle's tool prints, and it
prints nothing at all about:

- **totals** — no summary block exists in the dump, so the aggregate function
  and placement enums above rest on cross-tabulation alone;
- **sort rank and group/break** — `DCBImportedItemSort::GetRank` and
  `IsABreak` exist in Oracle's class model, the dump prints neither;
- **item display width, alignment and word wrap**;
- **page setup** of any kind;
- **the view type** (table vs crosstab);
- **`Placement`, `Hidden` and `DataType` for a plain EUL item** — those three
  are printed for `EUL Private Item` only, so the calculation side is
  **[DUMP]**-confirmed and the plain-item side has no counterpart at all. A
  plain item's `0x00db` element carries no such fields; the axis it sits on
  comes from the column (`0x02be`) and the query request instead.

Everything in that list is labelled **[INFER]** or **[UNCONFIRMED]** above, and
none of it should be treated as settled by a later task without new evidence.

### 7.8.15 Differ agreement, before and after

Both runs are the full 544-workbook dumped corpus. "Before" is the report §7.7
records (`d4dumps/_report-after-fix.json`, 2026-08-27); "after" is the same
harness against the W2 parser, run offline through the new
`diff-corpus.ts --bytes-dir`.

| Section | Before | After |
| --- | --- | --- |
| Items matched | 29 591 / 29 611 | 29 591 / 29 611 (unchanged) |
| Custom functions | 719 / 719, name 99.7 % | unchanged |
| **Calculations matched** | **41 263 / 41 982** | **41 982 / 41 982** |
| **Calculation `IOFormula`** | **93.9 %** (38 727 / 2 536) | **100 %** (41 982 / 0) |
| Calculation `Name` | not compared | 41 982 / 0 |
| Calculation `Identifier` | not produced | 41 982 / 0 |
| Calculation `DataType` | not produced | 41 982 / 0 |
| Calculation `Placement` | not produced | 41 982 / 0 |
| Calculation `Hidden` | not produced | 41 982 / 0 |
| Calculation `IsACalc` | not produced | 41 982 / 0 |
| **Private filters matched** | **3 299 / 3 331** | **3 331 / 3 331** |
| Private filter `IOFormula` | 3 297 agree / 1 disagree | 3 329 / 1 |
| Private filter `Identifier` | not produced | 3 331 / 0 |
| Private filter `Case Sensitive` | not produced | 3 331 / 0 |
| Parameters matched | 3 784 / 3 784, prompt 99.6 % | unchanged |
| Parameter `Identifier` | not produced | 3 736 / 47 |
| **Sorts** | **not compared** | 3 775 / 3 775 matched; `Item` 3 767 / 0, `Direction` 3 775 / 0 |
| **Query requests** | **not compared** | 896 / 896 matched; `Distinct` 896 / 0, axis 872 / 2, measure 856 / 2, sorts 716 / 2, filters 876 / 2, joins 24 / 0 |
| **Joins** | **not compared** | 24 / 24 matched, all four fields 24 / 0 |
| Sheets matched, names | 896 / 896, 100 % | unchanged |
| **Sheet `Items :-`** | **32 105 matched / 1 137 dump-only** | **33 242 matched / 0 dump-only** (compared against query items) |
| Sheet `Query(s) used` | not compared | 894 / 0 |
| Sheet `Filters :-` | not compared | 876 / 0 |
| Sheet `Joins :-` | not compared | 24 / 0 |
| Element framing | not measured | **470 281 / 470 281 bodies (100 %)**, 0 fallbacks |

Every residual disagreement above is one of three already-documented shapes:
the single workbook `GD_M.M65_V13` whose `IoId`s run one low (all the `/ 2`s
and the 2 function-name cases), the parameter- and filter-name collisions §7.7
describes, and one private filter in that same workbook. **No new class of
disagreement appeared.**

Corpus scope after W2, over all 564 workbooks:

| | |
| --- | --- |
| Worksheets | 923 (923 table, 0 crosstab) |
| Displayed columns | 33 509 — 21 499 axis, 11 983 measure, 26 page |
| Columns carrying an EUL `EXP_ID` | 24 915 |
| Columns with a format mask / a display width | 21 979 / 22 311 |
| Query items (the dump's `Items :-`) | 34 683, of which **1 176 are displayed by no column** |
| Calculations | **47 548** per workbook, **49 819** per worksheet (was 43 992 / 46 184) |
| Conditions / parameters | 3 427 / 3 907 |
| Totals | 19 639 |
| Sorts | 3 864 |
| Saved parameter values | 3 035 |
| Joins | 24 |

### 7.8.16 Two findings from §7.7 that W2 withdraws

**A calculation that references another calculation is *not* expanded by the
dump.** §7.7 recorded that Oracle's `d4wkdmp` "recursively substitutes that
referenced calculation's own formula in place", and attributed the residual
2 536 `ioFormula` disagreements to it. That is wrong. Checked directly:
**25 216 calculations in the corpus contain a `[6,n]` whose `n` is itself a
`0x00dc` element, and in every single one the dump's `IOFormula` is
byte-identical to the parser's unexpanded token text.** The 2 536 disagreements
were an artifact: a calculation whose formula exceeded 254 bytes was dropped
entirely (§7.8.1), so the dump entry fell through to the differ's name-based
fallback and matched a *different* calculation that happened to share its name.
With the long formulas readable and the correlation on the synthetic id,
`ioFormula` agreement is 41 982/41 982. W2/W6 do **not** need to walk a chain
the dump never walked.

**The unmatched private filters were not a placeholder for a shared filter.**
§7.7 flagged 32 conditions that name neither `CONDITION_SQL` nor
`CONDITION_NAME` as "suspected to be workbook-local placeholders for a shared
`EUL Filter Reference`", unconfirmed. They are simply conditions with no name
to match on: correlating on `0x00fb`, the negative synthetic id, matches all
3 331. Shared EUL filters do exist as their own class (`0x00f9`, §7.8.10) and
appear in none of the 564 live workbooks.

---

## 7.9 The Neo side — where §7.8 lands in the schema

Task W3. §7.8 says what a Discoverer 4 worksheet contains; this says which
Discoverer Neo column holds it. Nothing here changes the parser or the
migration — it is the schema those will write into
(`backend/drizzle/0009_worksheet_layout_model.sql`).

Every column below is nullable or defaulted to the behaviour that existed
before it. A worksheet that uses none of §7.8 migrates exactly as it did.

### 7.9.1 Field → column

| §7.8 | Neo |
| --- | --- |
| `0x0384` / `0x0385` view type | `maps.map_type` — `TABLE` / `CROSSTAB` |
| `0x0128` `Distinct` | `maps.select_distinct` |
| `0x0258` layout, `0x01f4` worksheet | `map_layouts` (one row per map) |
| `0x0201` / `0x0205` printed title | `map_layouts.title_rtf` / `.title_html` |
| `0x026b` query links | `map_layouts.query_count` |
| `0x0272` → `0x026f` graph | `map_layouts.graph` (jsonb) |
| `0x02bc` column | `map_items` (already existed) |
| `0x02be` `EDCBAxisType` | `map_items.axis_type` |
| crosstab row/column edge | `map_items.axis_edge` — **no source field**, see below |
| `0x0123` / `0x0124` axis & measure order | `map_items.axis_order` |
| `0x0123` / `0x0124` measure vector + `IT_FUN_ID` | `map_items.agg_function` — see below |
| query item with no column | `map_items.is_hidden` |
| `0x0642` value type | `map_items.data_type` |
| `0x064a` display mask | `map_items.format_mask` (already existed) |
| heading mask | `map_items.heading_format_mask` |
| `0x07e4` display width | `map_items.column_width` (already existed) |
| `0x0643` alignment | `map_items.alignment`, raw code in `source_attrs` |
| `0x0645` word wrap | `map_items.word_wrap` |
| `0x00f0` / `0x0514` sort | `map_items.sort_direction` / `.sort_order` (already existed) |
| `GetRank` | `map_items.sort_rank` |
| `IsABreak` / `0x0518` group block | `map_items.sort_group` |
| `0x0c1c` summary | `map_totals` |
| `0x0c1d` aggregate function | `map_totals.agg_function` (only `1` = `SUM` is safe) |
| `0x0c20` placement | `map_totals.placement`, raw code in `source_attrs` |
| `0x0c21` label template | `map_totals.label` |
| `0x0c22` / `0x0c23` | `map_totals.map_item_id` / `.break_map_item_id` |
| `0x0834` display settings | `map_page_setup` |
| `0x00dc` calculation fields | `map_calculated_fields.data_type`, `.axis_type` (`Placement`), `.is_hidden`, `.format_mask`, `.description`, `.source_identifier` |
| `0x0127` → `0x0118` join usage | `map_layouts.source_attrs.joins` — no dedicated column, see §7.9.2 |
| every element's own id | `source_element_id` on each of the above |
| `[UNCONFIRMED]` flags, style chain | `source_attrs` jsonb on each of the above |

**`map_items.agg_function` is the one column with two sources, and it needs
both.** The workbook says *which* items are measures — `0x0124`, a literal
vector, and the only place that answer exists. It says nothing about *what to
aggregate them with*: the `.DIS` carries no per-item aggregate function at all,
and its one aggregate code (`0x0c1d`) belongs to a total, not an item. That half
comes from the EUL's Default aggregate, `EXPRESSIONS.IT_FUN_ID` (§3.2).
legacy-analysis §3.4's precedence puts them together: the default aggregate
applies **when the item is on the measure axis**, so an axis column projects raw
and gets nothing here.

Where the pair yields no function the column stays null — 4 161 of the estate's
5 920 measure columns, because 8 152 items carry Oracle's `Detail` marker and
353 carry no default. Defaulting those to `SUM` would turn a tracked gap into a
wrong number. Live after Phase 3.1: **1 760 columns carry `SUM`, across 402 of
923 maps.** `agg_function` is constrained to `SUM|COUNT|AVG|MIN|MAX` or NULL by
`0012_constrain_agg_function.sql`.

### 7.9.2 The four judgement calls, and why

**`maps.map_type` is the home for `EDCBViewType`; there is no second
`view_type` column.** The enum's `TABLE` / `CROSSTAB` are exactly the two
classes `0x01f8` names. Its other two values are Neo-only and no migration
writes them: Discoverer models a page item as an *axis* (`0x02be = 2`) and a
chart as a graph block on the layout, not as alternatives to being a table.
A `map_layouts.view_type` alongside `maps.map_type` would be two columns
answering one question.

**Axis and placement go on `map_items`, not into a layout table.** Discoverer
carries `EDCBAxisType` on the column element itself, and `map_items` already
*is* the column: display order, heading override, format mask, width. A
layout-items table would be an indirection over a 1:1 and would fork the query
engine's column list in two. The same reasoning keeps sorting there — a
Discoverer sort is 1:1 with a column, and `sort_direction` / `sort_order`
already drive `backend/src/lib/sql/order-by-clause.ts`, so a `map_sorts` table
would give `ORDER BY` two sources of truth. `sort_rank` and `sort_group` are
new columns on the same row.

The one thing `map_items` cannot do is hold a column that shows a *workbook
calculation* rather than an EUL item: `item_id` is `NOT NULL`, and a
calculation column becomes a `map_calculated_fields` row instead. That
mismatch predates this work and is left alone; `map_calculated_fields` carries
the same presentation columns because the `0x00dc` element carries them itself
(`DataType`, `Placement`, `Hidden`, `0x00e8`), each **[DUMP]**-confirmed on all
41 982 corpus calculations.

The crosstab edge is the honest gap. `EDCBAxisType` says axis / measure / page
and nothing more, and the layout's second column list (`0x025f`, 27 instances)
is **[UNCONFIRMED]** as the row/column split. `map_items.axis_edge` exists so
Neo can express a crosstab; the migration leaves it null rather than guessing.

**Totals and percentages are one table with a `kind` discriminator.** They are
the same shape — an aggregate over one column, optionally broken at each change
in another, with a label template and a placement — and Discoverer presents
them as sibling tabs of one dialog. Two tables would duplicate six columns and
make every reader union them. Discoverer has no percentage class at all — §7.12
reads the whole import model out of `DCBIMPB.DLL` and it holds one summary
class — so `kind` splits one Discoverer enum in two rather than mirroring two
Discoverer structures, and no migrated row is `PERCENTAGE` until the two
percentage codes are known.

**Neo does not model the Query Request.** Its job is to group the items, sorts,
filters and joins one query uses, and Neo already has one query per map: the
corpus's 923 worksheets link 923 query requests, one each, and the only
workbook with two (`VIDSTR4.DIS`) has one per sheet. `0x026b` is a vector, so
sharing is *representable*, but it has never been observed — a `map_queries`
table would add a join to every read path to model a 1:1. What flattening would
lose is which query an item belonged to on a two-query sheet;
`map_layouts.query_count` records the count so such a sheet is visible instead
of silently merged.

**A worksheet's forced joins have no table of their own, for the same reason.**
Neo's query engine already derives a map's `FROM`/`JOIN` clauses from the
folders its items touch (`backend/src/lib/sql/from-clause.ts`) — it does not
consult anything a map names explicitly — so `Join Usage` is provenance, not
something the query engine reads. A `map_joins` junction table would exist
only to be displayed, for a fact `map_layouts.source_attrs` can already hold
the same way it holds the graph block and the unattributed layout fields; a
dedicated table would be schema for a feature Neo does not have (comparing
Discoverer's join path against the one Neo's folder graph computes).

### 7.9.3 What the schema can hold that nothing decodes yet

- **Conditional formatting** (`map_conditional_formats`). Discoverer 4 calls it
  an Exception. No element class for it is decoded: §7.8.11 withdraws the guess
  that `0x0898` held conditional-format ranges, and the read-but-unmodelled
  classes (`0x03e8`, `0x06a4`, `0x0708`, `0x0ce4`) are 40 elements corpus-wide
  with no dump output to check against. The table is Neo-native and a migration
  writes no rows into it.
- **Percentages**, as above. *Closed by §7.12*: there is no percentage element
  class to find. Discoverer carries a percentage as a value of the same
  `EDCBAggregateType` a summary already holds, so the parser finds them
  already — it is the two codes that are unknown, and no corpus total can be
  shown to be one. Every migrated row is `kind = 'TOTAL'`.
- **Page-setup slot order.** `map_page_setup` names six header/footer slots and
  six margins the way Neo models them. §7.8.12 leaves the source's tag order
  unattributed, so a migration must write the raw arrays to `source_attrs`
  rather than assume this order is theirs.

---

## 7.10 What the migration carries today

Task W4. §7.9 described the schema; this says which of it the migration
actually writes, and how each field was confirmed. Everything here is written
by both paths — `migration-runner.ts` (a full run) and `map-reimport.ts` (a
maps-only re-import) — from the same `transformWorkbook` output.

| Neo column | Source | Confirmed by |
| --- | --- | --- |
| `maps.map_type` | `0x01f8` → `0x0384` / `0x0385` (§7.8.5) | **[INFER]** — the dump prints no view type (§7.8.14) |
| `maps.select_distinct` | `0x0128` `Distinct` (§7.8.3) | **[DUMP]** — the differ's per-sheet `Distinct` tally |
| `map_items.axis_type` | `0x02be` `EDCBAxisType` (§7.8.8), falling back to the query list that names the item | **[DUMP]** — the differ rebuilds `Axis Item Usage` / `Measure Item Usage` from this field and compares |
| `map_items.axis_order` | index within `0x0123` / `0x0124` | **[DUMP]** — same tally; the lists are ordered |
| `map_items.agg_function` | `EXPRESSIONS.IT_FUN_ID` (§3.2), on `0x0124` measures only | **[LIVE EUL4]** — the probe that named the column; the dump prints no aggregate for an item |
| `map_items.is_hidden` | a query item no column displays (§7.8.4) | **[DUMP]** — the differ's `Items :-` minus the sheet's columns |
| `map_calculated_fields.axis_type` | `0x00e2` `Placement` (§7.8.13) | **[DUMP]** 41 982/41 982 |
| `map_calculated_fields.is_hidden` | `0x00e6` `Hidden` (§7.8.13) | **[DUMP]** 41 982/41 982 |
| `map_items.sort_direction` | `0x00f2` `Direction` (§7.8.6) | **[DUMP]** the differ's `Direction` tally, 3 775/3 775 |
| `map_items.sort_order` | index within the worksheet's sort list | **[DUMP]** — the differ rebuilds the sheet's `Sort On` list from it and compares |
| `map_items.sort_group` | `0x0518` group block on the layout entry (§7.8.6) | **[INFER]** — `IsABreak` exists in Oracle's class model, the dump prints nothing about it |

Four things are worth stating plainly about the shape this takes.

**`axis_order` numbers the two lists separately.** A measure's position is its
index among the measures, not among the sheet's columns — which is how the
dump prints them, one `Axis Item Usage` sequence and one `Measure Item Usage`
sequence. A page item (`0x02be = 2`) is numbered in the *axis* list, because it
is an axis item to the query request; Neo still records it as `PAGE`, which is
what Discoverer drew.

**A hidden item becomes a `map_items` row, not a dropped one.** It carries
`is_hidden`, no heading and no format mask, and a `display_order` after the last
column so the map's ordering stays unique. Discoverer Neo's SQL generator
leaves such a row out of the SELECT list and out of the GROUP BY the list
feeds, and out of the ORDER BY positions computed over it — so a migrated map
generates exactly the SQL it did before these rows existed, and the row records
what the Discoverer query asked for rather than adding a column nobody drew.

**`0x02be` decides the axis; the query list is the fallback, not the other way
round.** Only the column's own field can say `PAGE`. Where a column carries no
`0x02be` — possible only on an element that did not frame — the list that names
the item answers instead, which is evidence Discoverer wrote and not an
inference. Where neither answers, `axis_type` and `axis_order` are null.

**A worksheet whose layout does not decode migrates exactly as it did before.**
`ParsedWorksheet.layoutDecoded` is false when the worksheet names no layout
element, no view class, or no query request. Such a map is a `TABLE` with
`select_distinct` false, every column's `axis_type` and `axis_order` null and no
hidden items, and it carries a `WORKSHEET_LAYOUT_UNDECODED` warning naming what
to review. No axis is ever guessed from what is left.

**Item format, page setup and join usage are now written too.**
`map_items.column_width` / `.data_type` / `.heading_format_mask` /
`.word_wrap` / `.source_element_id` come straight off the style chain §7.8.8
already resolves; `.alignment` stays null on every row — `0x0643` still has no
confirmed code → value mapping — with the raw code in
`.source_attrs.alignmentCode` instead. `map_page_setup` gets one row per map,
copied from the workbook's single `0x0834` element; every named column but
`source_element_id` is null (§7.8.12's slot order and orientation/scale/grid
flags are still unconfirmed) and the six texts/fonts/margins live in
`source_attrs` verbatim. A worksheet's `Join Usage` (§7.8.9) has no column of
its own — there is no `map_joins` table — so it is resolved against the joins
this same run migrated and recorded as `map_layouts.source_attrs.joins`, each
entry carrying the raw workbook fields plus `joinIds` (the matching `joins.id`
row(s), or null when the referenced EUL join did not migrate). The maps-only
re-import writes the same `map_page_setup` row but always leaves `joinIds`
null: it does not rebuild `joins`, and nothing in the target lets a re-import
resolve a workbook's EUL join id back to a row there.

**Still unwritten**, though §7.9 has columns for it: `map_items.axis_edge`
(the crosstab row/column split, which no source field carries — §7.9.2) and
`sort_rank`. `maps.select_distinct` is written but Neo's SQL generator does
not yet emit `SELECT DISTINCT` from it.

---

## 7.11 Sorting, as the migration writes it

Task W7. §7.8.6 decoded the two halves of a sort; this says what reaches
`map_items` and what does not. Written by both paths — `migration-runner.ts`
and `map-reimport.ts` — from the same `transformWorkbook` output, as everything
in §7.10 is.

**A sort lands on the column it sorts.** `0x00f0`'s `Item` is the element id of
the item sorted on, which is the same id a column carries as its source and a
hidden item carries as its own; matching on it needs no name comparison and
cannot cross-match. `sort_direction` is `Direction` named, `sort_order` is the
index in the worksheet's sort list, and `sort_group` is `IsABreak` — the layout
entry carrying a group block. `sort_rank` stays null.

**The query half wins, the layout half contributes only the break.**
`Direction` (`0x00f2`) is the field `d4wkdmp` prints and is 3 775/3 775 against
it; the layout entry's own descending flag (`0x0516`) is not read, and the two
halves name a different item on 14 of the corpus's 3 864 sorts (§7.8.6), so
they are never merged.

**`sort_order` is confirmed against Oracle, at full corpus scale.** Oracle
prints the sort list in two independent places — `Sort Item Usage` inside
`Query Request QRn`, and `Sort On …` lines inside the sheet's `Items :-`.
`SheetDiff.sortItems` rebuilds the second from the order the migration numbers
and compares. Over the full 544-workbook dumped corpus, against the live
workbook bytes:

```
Sort On (vs sort_direction/sort_order): agree=716 disagree=0 onlyInDump=0 onlyInParser=2
```

**716 of 716 sheets that sort anything agree, in order, with zero
disagreements.** The 2 `onlyInParser` are both sheets of `GD_M.M65_V13` — the
one workbook whose `IoId`s run exactly one low, already behind every other
`/ 2` in this report (§7.7, §7.8.15). No new class of disagreement appeared,
and every other section came back numerically identical to the W2 run.

The `EUL Sort Item Reference` section, unchanged by this task, stays at
3 775/3 775 matched with `Direction` 3 775/0.

Corpus counts, from the **real transformer** over all 558 live workbook bodies
(916 maps). Not a dump reading — this is `transformWorkbook`'s own output, so
it is what a migration writes:

| | |
| --- | --- |
| Maps carrying at least one sort | **737 of 916** |
| Sorted `map_items` produced | **3 840** |
| … `ASC` / `DESC` / no direction named | 3 810 / 30 / **0** |
| … group (break) sorts — `sort_group` | **2 017 (52.5 %)** |
| … on a workbook calculation — reported, not written | **187**, across 143 maps |
| … on a hidden item | **0** |
| Rows that reach `map_items` | **3 653** |
| Most sorts on one sheet | 28 |
| `MAP_SORT_DIRECTION_UNKNOWN` / `MAP_SORT_ITEM_UNRESOLVED` | 0 / 0 |

Group sorting is not a corner case: **more than half** of every sort in the
corpus is a break. The dump-side counts (3 775 sorts over the 544 workbooks
`d4wkdmp` could dump, 183 on a calculation, 3 747/28 by direction) agree with
these; the difference is the 14 workbooks the dump tool itself failed on.

### What sorting cannot carry, and why

**A sort on a workbook calculation is lost.** `map_items.item_id` is `NOT NULL`,
so a calculation column becomes a `map_calculated_fields` row instead — and that
table has no sort columns, because adding them would be a column Neo's
`buildOrderByClause` does not read. 183 corpus sorts are in this state and each
produces a `MAP_SORT_ON_CALCULATION` warning naming the map.

**`sort_rank` has no source.** `DCBImportedItemSort::GetRank` exists in Oracle's
class model and `d4wkdmp` never prints it (§7.8.14); `0x0519` / `0x051a` /
`0x04b3` are where it must live, and nothing in the corpus separates them. The
column stays null rather than being fed one of the three unconfirmed flags.
`sort_order` is the precedence the migration writes, and it is the list
position, not `Rank`.

**A sort on a hidden item is recorded but generates no `ORDER BY`.** Neo's
`buildOrderByClause` orders by SELECT-list position and leaves hidden rows out
of the SELECT list, so such a row keeps its `sort_direction` and `sort_order` as
a record of what Discoverer asked for and changes no SQL.

### The live target has not had migration 0009 applied

Checked 2026-08-28 against the running `discoverer-neo-postgres`. Its
`map_items` has **11 columns** — `id`, `map_id`, `item_id`, `display_order`,
`display_name`, `format_mask`, `agg_function`, `sort_direction`, `sort_order`,
`column_width`, `created_at` — and nothing from
`backend/drizzle/0009_worksheet_layout_model.sql`: no `sort_group`,
`sort_rank`, `axis_type`, `axis_order`, `is_hidden`, `data_type`,
`source_element_id`, no `maps.select_distinct`, no `map_layouts` and no
`map_totals`. `drizzle.__drizzle_migrations` is empty, so this database was
built by an earlier `db:push` and has never been migrated.

This is **not** specific to sorting — it blocks every §7.9/§7.10 column,
including the axis/hidden work that already merged. A live re-import against
this database needs `npm run db:migrate` in the backend first; until then a
write of these columns would fail on the insert, which no test using the
in-memory `MigrationWriter` can catch (the fake writer stores whatever object
it is handed).

A dry-run re-import against the live EUL and this target completes cleanly in
29 s — 564 workbooks, 923 worksheets, 25 960 columns planned — so the read and
transform halves are fine. Only the write is gated.

### Crosstab sorting — `DCBViewMatrixSort` is not decodable, and not observed

Oracle models a crosstab sort as a different class from a table sort. Nothing
in any evidence available here contains one:

- The live corpus is **923 worksheets, 923 table, 0 crosstab** (§7.8.15), so no
  customer report exercises it.
- Oracle's own shipped samples hold exactly **one** crosstab sheet —
  `VIDSTR4.DIS` sheet 2, `Crosstab Layout` — and it sorts nothing. Its layout's
  sort-list reference (`0x0264`) is **`0`**, the workbook holds a single
  `0x00f0` / `0x04b0` / `0x0514` set and all three belong to the *table* sheet,
  and Oracle's own dump of that workbook prints **no `Sort Item Usage` line for
  `QR2` and no `Sort On` line under `Sheet Number 2`**.

So there is no `DCBViewMatrixSort` byte to decode, not a decoding that failed.
Table sorting migrates; crosstab sorting is unimplemented and would need a
crosstab workbook that actually sorts before anything could be written about it.
`map_items.axis_edge` — the crosstab row/column split — is the neighbouring gap,
open for the same reason (§7.9.2).

---

## 7.12 Totals and percentages, as the migration writes them

Task W6. §7.8.7 read the summary element's tags off the bytes; this says what
the class actually is, settles whether a percentage is a class of its own, and
records what reaches `map_totals`. Written by both paths —
`migration-runner.ts` and `map-reimport.ts` — from the same `transformWorkbook`
output, as everything in §7.10 and §7.11 is.

### The class, from Oracle's own binaries

`DCBIMPB.DLL` (Discoverer 4.1, `DISCVR4\`) exports C++ symbols with MSVC name
decoration intact, so the import/export model's class list and each class's
accessors can be read directly rather than inferred. `DCBImportedSummary` has
exactly five:

| Accessor | Tag | Neo |
| --- | --- | --- |
| `GetFunction() → EDCBAggregateType` | `0x0c1d` | `map_totals.agg_function` |
| `GetLabel() → DCEString` | `0x0c21` | `map_totals.label` |
| `GetMeasureItem() → DCBImportedItem*` | `0x0c22` | `map_totals.map_item_id` / `.map_calculated_field_id` |
| `GetPlacement() → EDCBAggregateLocation` | `0x0c20` | `map_totals.placement` |
| `GetPlacementItem() → DCBImportedItem*` | `0x0c23` | `map_totals.break_map_item_id` |

`DCBImportedSheet::GetSummaries()` returns
`vector<DCBImportedSummary*>` — one list per worksheet, which is why the parser
hangs totals off `ParsedWorksheet` and not off the document.

### Percentages are an aggregate type, not an element class **[BINARY]**

The question §7.9.3 left open. Three independent facts answer it:

1. **`DCBIMPB.DLL` defines thirteen `DCBImported*` classes and none is a
   percentage** — `DisplaySettings`, `Sheet`, `Item`, `ItemFormat`, `Filter`,
   `FilterNode`, `Document`, `DocumentInfo`, `Summary`, `ItemSort`,
   `Parameter`, `DataSource`, `Join`. That is the whole of the model the `.DIS`
   body serializes, so there is no percentage element to look for.
2. **Discoverer's percentage lives in the query layer, keyed by the aggregate
   enum.** `DCB.DLL` has `DCBPercentageRequest` (a `DCBTwoPassRequest`), whose
   accessor is
   `GetAggregate(EDCBAggregateType) → DCBResultsAggregate*`. A percentage is
   computed from a value of the same enum a summary already stores.
3. **The label family is shared.** `DCMRESUS.MSB` carries sixteen aggregate
   labels for `AggregateTypeToLabel`: `Average` `Sum` `Count` `Minimum`
   `Maximum` `Standard Deviation` `Variance` (messages 283–289),
   `Percentage of Grand` and `Count Distinct` (933, 934), and
   `Average Distinct` `Sum Distinct` `Min Distinct` `Max Distinct`
   `Standard Deviation Distinct` `Variance Distinct`
   `Percentage of Grand Distinct` (1056–1062). The 4i Plus User Guide lists the
   two percentages in the *Totals* dialog's own function drop-down, alongside
   Sum and Count.

So a percentage is a `0x0c1c` whose `0x0c1d` is one of two particular codes,
and `map_totals.kind` is Neo splitting one Discoverer enum into two, not
mirroring two Discoverer structures. `Tools | Percentages` is a second dialog
over the same element — its placement choices (grand total of all values, of
each column, of each row, subtotal at each change in) are `EDCBAggregateLocation`
values, the same ones the Totals dialog offers.

**Every migrated row is therefore `kind = 'TOTAL'`.** Neither percentage code
is known (below), and none of the corpus's seven codes can be shown to be one.
Writing `PERCENTAGE` would be a guess about which report computes a share of a
total — visible to every reader of the map and wrong in one direction or the
other.

### `EDCBAggregateType` — sixteen members, four established values

Corpus (the live `SIID_TESTES` EUL, 564 workbooks, 923 worksheets, **19 639
summaries** — the same population §7.8.7 measured): `1` ×19 085, `4` ×282,
`3` ×215, `2` ×35, `6` ×17, `5` ×4, `9` ×1.

§7.8.7 could name only `1`. Four are now established, because two correlations
that need a **live** EUL were run over every summary in it (`d4wkdmp` prints
nothing about summaries, so this is the only evidence there is):

- **the label its author typed**, matched against Oracle's own Portuguese
  function names in `DISCVR4\DCMRESPT.MSB` — the source is a Portuguese
  Discoverer, and its message ids are the same as the US file's, so
  `Média` = 283 = Average, `Contagem` = 285 = Count,
  `Contar Valores Distintos` = 934 = Count Distinct;
- **the totalled item's real datatype**, joined `0x0c22` → column → `EXP_ID` →
  `EXPRESSIONS.EXP_DATA_TYPE`. §7.8.7 used the column's *display format* type,
  which is a formatting hint, not the item's type. The two agree here, but the
  join also yields the **item name**, which is what separated `3` from `4`.

| Code | Function | n | Evidence |
| --- | --- | --- | --- |
| `1` | `SUM` | 19 085 | **[INFER]** every one on a numeric column; labels `Total` / `Total Geral` / `SubTotal por …` |
| `2` | `AVG` | 35 | **[INFER]** 13 labelled exactly `Média` (message 283), the rest `Valor Médio …`; all 35 numeric; shares a column with a `1` twice — sum and average of one measure |
| `3` | `COUNT` | 215 | **[INFER]** the only code whose labels use Oracle's word for Count (`Contagem`, `Contagem Todos os Valores`, `Contagem por &Item`); applied to per-row identifiers (`N Processo`, `N Garantia`) |
| `4` | `COUNT DISTINCT` | 282 | **[INFER]** the other half of the pair — shares a column with a `3` **13 times**, never uses `Contagem`, and sits on repeating entity keys (`Entidade Risco`, `Tomador`, `Nipc Devedor`) under labels like `Nº Entidades por País` |
| `5` | — | 4 | **[UNCONFIRMED]** one workbook, all labelled `Subtotal` |
| `6` | — | 17 | **[UNCONFIRMED]** one report template copied 17 times: same item (`Pais`), same label (`Total`), same placement |
| `9` | — | 1 | **[UNCONFIRMED]** no label, no column — degenerate |

**The `3` / `4` pair is the load-bearing finding.** Two counting functions over
the *same column of the same worksheet*, thirteen times, is Count beside Count
Distinct and nothing else. Which is which follows from the vocabulary: only
`3` ever carries Discoverer's own word for Count, and only `4` is applied to
columns where counting rows would answer the wrong question — a report headed
`Nº Entidades por País` over a policyholder column wants distinct entities.
The same test rules the remaining codes *out* of the pair.

**`5`, `6` and `9` stay unnamed, and the reason is sample size, not evidence.**
Between them they are 22 summaries and **three authoring decisions**: `5` is
one workbook, `6` is one report copied seventeen times, `9` is a single
labelless orphan. The 4i Plus User Guide restricts a non-numeric data point to
Count, Count Distinct, Maximum and Minimum; `6` is 17/17 on a text item, so it
is Minimum or Maximum — and nothing in one report separates them.

**Two orderings that looked plausible are refuted**, which is why none of the
above was guessed from a table:

| Candidate | Source | Refuted by |
| --- | --- | --- |
| `0`-based message order — Average, Sum, Count, Min, Max, StdDev, Variance | `DCMRESUS.MSB` 283–289; puts `SUM` at 1 correctly | it puts Count at `2`, and `2` is labelled `Média` |
| `1`-based dialog order — Sum, Average, Average Distinct, Count, Count Distinct, Min, Max, … | the User Guide's drop-down; puts `SUM` at 1 and Average at `2`, both correct | it puts Average Distinct at `3`, and `3` is Count |

The established values are `1` Sum, `2` Average, `3` Count, `4` Count Distinct
— an order no label table in the product exhibits. The toolbar tooltips
(messages 274–277, 294–296) are a third order again, and the handler at
`DIS4USR.EXE+0xb5786` shows why they prove nothing: it switches on **command
ids** (`0x807b`, `0x807d`, …), not on `EDCBAggregateType`.

### What Neo can and cannot run

Neo's SQL generator accepts exactly `SUM`, `COUNT`, `AVG`, `MIN`, `MAX`
(`backend/src/lib/sql/formula-parser.ts`), and `select-clause.ts` throws on
anything else. So the four established codes split in two:

- `1`, `2` and `3` are written to `map_totals.agg_function` — **19 335 of
  19 639 totals (98.5 %)**, up from 19 085 (97.2 %) when only `SUM` was known.
- `4` is **not**. `COUNT DISTINCT` is decoded but inexpressible, and writing
  `COUNT` for it would not fail — it would count duplicates and show a
  different number. Those 282 totals migrate with their label and placement,
  `agg_function` null, and `source_attrs.functionName = 'COUNT DISTINCT'`,
  reported as `MAP_TOTAL_AGG_UNSUPPORTED`.
- `5`, `6`, `9` — 22 totals — are reported as `MAP_TOTAL_FUNCTION_UNKNOWN`.

Teaching `AGGREGATE_FUNCTIONS` a `COUNT DISTINCT` that emits
`COUNT(DISTINCT x)` would close the largest remaining gap in one change. It is
a query-engine change, not a migration one, so it is not made here.

### `EDCBAggregateLocation`

Corpus: `1` ×9 357, `3` ×6 870, `6` ×3 412.

`1` = `AT_CHANGE` is solid **[INFER]**: `0x0c23` is non-zero on exactly the
totals whose placement is `1`, and zero on every `3` and every `6`. `3` and `6`
are both grand totals with no break column; the User Guide's two grand-total
placements (*at bottom* and *on right*, crosstab only) and its per-page /
all-pages choice are three candidates for two codes, and nothing in the corpus
separates them — the source's 923 worksheets are all tables, so *on right*
should not occur at all. Both map to `GRAND_TOTAL`, with the raw code in
`source_attrs`.

### Verified against the live source

The whole of the above was produced by one read-only pass over
`SIID_TESTES` — every `DOC_DOCUMENT` parsed in place inside the backend
container, joined to `EXPRESSIONS`, nothing written to disk. It reproduces
§7.8.7's population exactly (564 workbooks → 923 worksheets → **19 639**
summaries, 2 of which name no column), which is the check that the parser
reads the same bytes W2 measured.

A dry-run `reimport-maps` over the same source then plans **19 632
`map_totals` rows** — the 19 639 less the 2 unresolved columns and 5 whose
item has since left the EUL — alongside 25 960 columns and 923 maps, in 27 s.
That is the end-to-end number: totals reach the target at full corpus scale.

### What reaches `map_totals`

| Neo column | Source | Confirmed by |
| --- | --- | --- |
| `map_totals.label` | `0x0c21` `GetLabel` | **[STRUCT]** — `&value` / `&item` left intact, as Discoverer stores them |
| `map_totals.map_item_id` | `0x0c22` `GetMeasureItem` → the column's `display_order` | **[STRUCT]** 19 637/19 639 resolve to a `0x02bc` |
| `map_totals.map_calculated_field_id` | the same, when that column shows a workbook calculation | **[STRUCT]** |
| `map_totals.break_map_item_id` | `0x0c23` `GetPlacementItem` | **[INFER]** — non-zero *iff* placement is `1` |
| `map_totals.agg_function` | `0x0c1d`, codes `1`/`2`/`3` | **[INFER]**, above — `4` is decoded but inexpressible, `5`/`6`/`9` undecoded |
| `map_totals.placement` | `0x0c20`, `1`/`3`/`6` | **[INFER]**, above |
| `map_totals.kind` | always `TOTAL` | see above |
| `map_totals.display_order` | position among the sheet's summaries | **[STRUCT]** — document order |
| `map_totals.source_element_id` | the summary's own element id | **[STRUCT]** |
| `map_totals.source_attrs` | both raw codes, both column refs, `0x0c1e`/`0x0c1f` style refs, `0x0c24`–`0x0c28` | **[UNCONFIRMED]** by construction |

None of this is **[DUMP]**: `d4wkdmp -f` prints nothing whatever about
summaries (§7.8.14), so the differ has no total to compare and gains no section
from this task. That is the reason `source_attrs` carries every raw field
rather than the unconfirmed ones only.

Three things are worth stating plainly.

**A total resolves through the column list, not through item identities.**
`0x0c22` and `0x0c23` name `0x02bc` *column* elements, so a total is placed by
matching the column's own element id — the same id space `0x0c22` writes into,
which cannot cross-match. What the writers index by is then the column's
`display_order`, because `map_totals` references `map_items` and
`map_calculated_fields` **rows**, not EUL items. It is the one map table whose
foreign keys point at other map rows, which is why both writers build that
index as they push and share one `buildMapTotalRow`.

**A total on a workbook calculation migrates in full.** `map_totals` has
`map_calculated_field_id` beside `map_item_id`, so the `NOT NULL`
`map_items.item_id` that costs sorting its 183 calculation sorts (§7.11) costs
totalling nothing. The one place it still bites is the *break* column: a
subtotal that breaks at each change in a calculation keeps its function and
label and loses only its break, reported as
`MAP_TOTAL_BREAK_ON_CALCULATION`.

**A total whose column did not migrate is dropped, not written empty.** A
`map_totals` row with neither reference aggregates nothing and would show in
Neo as a total of no column. Both writers count it — `skipped` in the runner,
`unresolvedTotals` in the re-import — and `transformWorkbook` reports
`MAP_TOTAL_COLUMN_UNRESOLVED` for the two corpus summaries whose `0x0c22`
resolves to no column at all. A worksheet whose layout did not decode
(§7.10) migrates with no totals, for the same reason it migrates with no axis:
the column list Neo writes is not the one Discoverer drew.

### What totals cannot carry, and why

- **The aggregate function, on 1.5 % of totals** — 282 `COUNT DISTINCT` that
  Neo cannot express, and 22 whose code is undecoded. The first is a
  query-engine gap with a known fix (above); the second needs a live
  Discoverer 4 client opened on `Pais` in any of the seventeen workbooks that
  use code `6`, which would settle Minimum versus Maximum in a minute.
- **The grand-total *position*.** `3` versus `6`. Both are grand totals and Neo
  draws one kind, so nothing is currently lost by collapsing them — the
  distinction would matter only once Neo can put a total on the right of a
  crosstab, which is the same gap as `map_items.axis_edge` (§7.9.2).
- **The two style references** (`0x0c1e`, `0x0c1f`). Neo has no per-total
  formatting, so they stay in `source_attrs`.
- **`0x0c24`–`0x0c28`.** Set on 16 982 / 149 / 282 / 0 / 0 of the corpus's
  summaries and unread by anything. Carried verbatim.

---

## Provenance — how the fabricated schema got in

`oracle_discoverer_complete_reference.md` and `EUL_VERSION_REFERENCE.md` contain
`OBJ_TABLE_NAME`, `EXP_COL_NAME`, `EUL5_JOINS`, `EUL5_JOI_COMP`,
`EUL5_ELEM_ACCESS`, `EUL5_EUL`, `EUL5_OPTIONS`, `EUL5_HIER_LEVELS` — and **zero**
occurrences of the real `OBJ_EXT_OWNER`, `SOBJ_EXT_TABLE`, `IT_EXT_COLUMN`,
`EUL5_ACCESS_PRIVS`, `EUL5_VERSIONS`. The migration layer was written faithfully
against those documents, so the error is inherited wholesale rather than
introduced independently. Treat both documents as unreliable for EUL table and
column detail until they are corrected against the shipped SQL.
