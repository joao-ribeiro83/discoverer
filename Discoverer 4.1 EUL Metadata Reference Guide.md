# Oracle Discoverer 4.1 — End User Layer (EUL) Metadata Reference Guide

**Scope:** Oracle Discoverer Release 4.1 (Desktop / 4i Plus) End User Layer, schema prefix `EUL4_`.
**Purpose:** Help administrators understand the EUL metadata structure — which tables store business areas, folders, items, joins, hierarchies, workbooks and query definitions, how those tables relate, and how Discoverer assembles SQL from them at report run time.

> **Version caveat (read first).** Discoverer EUL schemas use a version prefix that is the single most reliable discriminator: **`EUL4_` = Discoverer 4.1 / 4i**, **`EUL5_` = Discoverer 9i / 10g / 11g**. The two are structurally similar but not identical — EUL5 adds tables and columns. This guide targets `EUL4_`. If your schema owner reads `EUL5_`/`EUL_US` you are on a later release; the concepts still apply but the exact table/column set differs. Always confirm against your own installation with the introspection SQL in [Section 7](#7-administrator-introspection-queries). ([Oracle — EUL Status Workbooks](https://docs.oracle.com/html/A86730_01/eul_stat.htm))

---

## 1. What the EUL Is

The End User Layer is a **metadata layer** — data about the database tables — that presents business users with a simple, business-friendly view (business areas, folders, items) while insulating them from physical table names, joins, and SQL. It preserves data integrity (users cannot write arbitrary SQL) and lets administrators control exactly what each user can see. ([Oracle — Creating and Maintaining End User Layers](https://docs.oracle.com/cd/E23943_01/bi.1111/b32519/maintain_eul.htm))

An EUL is owned by a dedicated database user (the *EUL owner*). For a 4.1 EUL the owner is conventionally named `EUL4_US` (or a custom name); all `EUL4_` tables live in that schema. ([Discoverer Info](https://sivakandigatla.blogspot.com/2010/08/discoverer-info.html))

### About the "≈50 tables" figure

Public Oracle documentation does not publish a complete authoritative DDL/table list for the EUL4 schema, and the local object count varies by installation. The commonly quoted "≈50" typically reflects the *whole object set* in a given EUL schema — base metadata tables plus Oracle Applications-mode extension tables, EUL gateway/journal objects, summary-folder helper objects, the `EUL4_GET_*` PL/SQL functions, sequences, and the views that wrap the base tables. The exact count depends on patch level, whether the EUL is Standard or Oracle Applications mode, and whether summary management / auditing is enabled. Treat "≈50" as the size of that whole object set, not a fixed table count, and produce the definitive list for your own EUL with the introspection SQL in [Section 7](#7-administrator-introspection-queries). ([Oracle — Using SQL files and trace files](https://docs.oracle.com/html/B10270_01/file_lis.htm))

---

## 2. Conceptual Model

Discoverer organises metadata in a strict hierarchy. Every report (workbook) is assembled at run time by walking this tree:

```
EUL
└── Business Area            (EUL4_BAS)
    └── Folder / Object       (EUL4_OBJS)            ← "table" the user sees
        ├── Item              (EUL4_EXPRESSIONS)      ← "column" the user sees
        ├── Join              (EUL4_KEY_CONS)         ← links folders
        ├── Condition         (EUL4_EXPRESSIONS)      ← filter predicates
        ├── Calculation       (EUL4_EXPRESSIONS)      ← derived columns
        └── Hierarchy         (EUL4_HIERARCHIES)      ← drill paths
    └── Item Class / LOV     (EUL4_ITEM_CLASSES)      ← pick lists
└── Workbook / Document      (EUL4_DOCUMENTS)
    └── Worksheet / Sheet     (EUL4_SHEETS)
        └── Element cross-ref (EUL4_ELEM_XREFS)       ← which items each sheet uses
└── Summary folders           (EUL4_SUMMARIES)         ← pre-aggregated tables
└── Security: Users (EUL4_EUL_USERS), Privileges (EUL4_ACCESS_PRIVS)
└── Stats: Query prediction (EUL4_QPP_STATS)
```

Key idea: **Items, Conditions, and Calculations are all the same physical thing** — a row in `EUL4_EXPRESSIONS` — distinguished by `EXP_TYPE`. A "folder item" is simply an expression whose `IT_OBJ_ID` points to a folder in `EUL4_OBJS`. This is the single most important concept for reading the schema. ([Oracle Discoverer EUL Tables & Description](http://appselangovan.blogspot.com/2012/07/oracle-discoverer-eul-tables.html))

---

## 3. Table Catalog by Domain

> **Legend for confidence:**
> - ✅ = table name and columns confirmed from cited EUL4/EUL5 sources.
> - ✅* = columns confirmed from EUL5 examples; the EUL4 analogue is expected to be the same but should be verified locally.
> - ◻️ = **candidate** table name. Oracle's EUL Status Workbooks confirm these *metadata domains* are reported on (Hierarchies, Item Classes, Summary Mappings, Workbook Management, Conditions, etc.), but Oracle does not publish the exact underlying EUL4 table/column names. The names below follow Discoverer's naming conventions and are the most likely candidates — **verify against your own EUL with `ALL_TABLES`** before relying on them. ([Oracle — EUL Status Workbooks](https://docs.oracle.com/html/A86730_01/eul_stat.htm))

> **Important — constraints are mostly logical.** Discoverer enforces most parent/child relationships in the application layer, not as physical database foreign keys. Primary keys usually *are* defined, but **`ALL_CONSTRAINTS` will frequently return few or no foreign keys** for an EUL schema. The FK columns below are the *logical* relationships the product joins on (verified from the SQL Discoverer itself issues, e.g. `DOC_ID = GD_DOC_ID`, `EU_ID = AP_EU_ID`). Use [Section 7](#7-administrator-introspection-queries) to confirm on your DB. ([Retrieve shared Discoverer workbooks](https://oracleebsapps.blogspot.com/2011/08/retrieve-which-oracle-discoverer.html))

### 3.1 Business Areas

| Table | Role | PK | Key FK / logical joins | Confidence |
|---|---|---|---|---|
| ✅ `EUL4_BAS` | One row per **Business Area**. Holds the BA name, description, and audit (created/updated by/date). | `BA_ID` | — | ✅ |
| ✅ `EUL4_BA_OBJ_LINKS` | Resolves the many-to-many between Business Areas and Folders: which folders appear in which BA. A folder can belong to several BAs. | (`BOL_BA_ID`, `BOL_OBJ_ID`) | `BOL_BA_ID` → `EUL4_BAS.BA_ID`; `BOL_OBJ_ID` → `EUL4_OBJS.OBJ_ID` | ✅ |

Confirmed columns: `EUL4_BAS(BA_ID, BA_NAME, BA_DESCRIPTION, BA_CREATED_BY, BA_CREATED_DATE, BA_UPDATED_BY, BA_UPDATED_DATE)`; `EUL4_BA_OBJ_LINKS(BOL_BA_ID, BOL_OBJ_ID)`. ([Key EUL tables](https://arunrathod.blogspot.com/2008/09/key-eul-tables-for-different-discoverer.html))

### 3.2 Folders / Objects

| Table | Role | PK | Key FK / logical joins | Confidence |
|---|---|---|---|---|
| ✅ `EUL4_OBJS` | One row per **Folder** (the "table" the user sees). `OBJ_TYPE` distinguishes **Simple folders** (`SOBJ` — based on a base table/view) from **Complex folders** (`COBJ` — based on a SQL join of other folders). `SOBJ_EXT_TABLE` holds the underlying physical table/view name. | `OBJ_ID` | `OBJ_EXT_OWNER` → owning schema of the base object | ✅ |

Confirmed columns: `EUL4_OBJS(OBJ_ID, OBJ_NAME, OBJ_DESCRIPTION, OBJ_TYPE, SOBJ_EXT_TABLE, OBJ_EXT_OWNER)`. ([Oracle Discoverer EUL Tables & Description](http://appselangovan.blogspot.com/2012/07/oracle-discoverer-eul-tables.html), [Key EUL tables](https://arunrathod.blogspot.com/2008/09/key-eul-tables-for-different-discoverer.html))

### 3.3 Items, Expressions, Conditions, Calculations

| Table | Role | PK | Key FK / logical joins | Confidence |
|---|---|---|---|---|
| ✅ `EUL4_EXPRESSIONS` | The **expression engine** — the heart of the EUL. One row per item, calculation, or condition. `EXP_TYPE` discriminates them: **`CO` = database (base) item** mapped to a real column, **`CI` = created item** (calculation, date-hierarchy item, complex-folder item). When `IT_OBJ_ID` is not null it points to the folder the item belongs to → the expression is a *Folder Item*. `IT_EXT_COLUMN` holds the physical column name for `CO` items. | `EXP_ID` | `IT_OBJ_ID` → `EUL4_OBJS.OBJ_ID` (the owning folder) | ✅ |

Confirmed columns: `EUL4_EXPRESSIONS(EXP_ID, EXP_NAME, EXP_DESCRIPTION, EXP_DATA_TYPE, IT_HEADING, IT_FORMAT_MASK, IT_OBJ_ID, IT_EXT_COLUMN, EXP_TYPE)`. ([Oracle Discoverer EUL Tables & Description](http://appselangovan.blogspot.com/2012/07/oracle-discoverer-eul-tables.html), [Generate EUL overview](https://oracleebsapps.blogspot.com/2011/08/generate-overview-of-your-end-user.html))

> **Why this matters:** a single table stores what looks, in the UI, like three different things — *Items* (columns), *Conditions* (WHERE predicates), and *Calculations* (derived columns). To list "items only" you filter `IT_OBJ_ID IS NOT NULL`; to list calculations you look at `CI` expressions; conditions are expressions used in a sheet's filter list.

### 3.4 Joins

| Table | Role | PK | Key FK / logical joins | Confidence |
|---|---|---|---|---|
| ✅ `EUL4_KEY_CONS` | One row per **join** between two folders. `KEY_OBJ_ID` → the parent (detail) folder; `FK_OBJ_ID_REMOTE` → the remote/child folder; `KEY_DESCRIPTION` is the join's display text. | `KEY_ID` (probable) | `KEY_OBJ_ID` → `EUL4_OBJS.OBJ_ID`; `FK_OBJ_ID_REMOTE` → `EUL4_OBJS.OBJ_ID` | ✅* |
| ◻️ `EUL4_KEY_USAGES` | **Candidate.** Usage records recording how each join/key is used within join paths and item-class joins. | — | references `KEY_ID` / `OBJ_ID` | ◻️ |

Confirmed join columns for `EUL4_KEY_CONS`: `KEY_OBJ_ID, FK_OBJ_ID_REMOTE, KEY_DESCRIPTION` (confirmed from cited source). `KEY_ID` as the PK is plausible but **not confirmed from the sources fetched** — verify locally. ([Oracle Discoverer EUL Tables & Description](http://appselangovan.blogspot.com/2012/07/oracle-discoverer-eul-tables.html))

### 3.5 Hierarchies, Item Classes (LOVs), Functions

| Table | Role | PK | Key FK / logical joins | Confidence |
|---|---|---|---|---|
| ◻️ `EUL4_HIERARCHIES` | **Candidate.** Item hierarchies — drill paths (e.g. Year → Quarter → Month). The EUL Status *Hierarchies* worksheet reports on this domain. | — | references items via `EXP_ID` (probable) | ◻️ |
| ◻️ `EUL4_ITEM_CLASSES` | **Candidate.** Item classes / Lists of Values (LOVs) — pick-list definitions behind items. The *Item Classes – LOVs* worksheet reports on this domain. | — | references `EXP_ID` (probable) | ◻️ |
| ◻️ `EUL4_FUNCTS` (candidate) | **Candidate.** Registered PL/SQL functions available in calculations/conditions. Note: the `EUL4_GET_*` helper functions (`EUL4_GET_ITEM`, `EUL4_GET_OBJECT`, `EUL4_GET_COMPLEX_FOLDER`, …) are PL/SQL functions created/registered by the `eul4.sql` script — they are *code objects*, not rows in a metadata table. Whether function *metadata* is also stored relationally should be verified locally. | — | — | ◻️ |

Oracle confirms these *metadata domains* are reported by the EUL Status Workbooks; the exact underlying EUL4 table and column names are not published and should be verified in the local EUL schema via `ALL_TABLES`. ([Oracle — EUL Status Workbooks](https://docs.oracle.com/html/A86730_01/eul_stat.htm), [Oracle — Using SQL files](https://docs.oracle.com/html/B10270_01/file_lis.htm))

### 3.6 Workbooks, Worksheets, Element Cross-References

| Table | Role | PK | Key FK / logical joins | Confidence |
|---|---|---|---|---|
| ✅ `EUL4_DOCUMENTS` | One row per **workbook** (report). `DOC_CONTENT_TYPE = 'application/vnd.oracle-disco.wb'` identifies a workbook row. Holds name, developer key, description, and audit. | `DOC_ID` | `DOC_EU_ID` → `EUL4_EUL_USERS.EU_ID` (owner, EUL5-confirmed) | ✅* |
| ◻️ `EUL4_SHEETS` (candidate) | **Candidate.** Worksheets within a workbook. Worksheet layout, sort, totals and the set of items/conditions used are stored either here or serialized within the document definition — Discoverer's workbook metadata is a mix of relational cross-references and serialized structure; the relational xref queries are useful for discovery but may not reconstruct every worksheet detail. | — | `→ EUL4_DOCUMENTS.DOC_ID` (probable) | ◻️ |
| ✅* `EUL4_ELEM_XREFS` | **Element cross-references** — the glue between a worksheet/document and the items it uses. `EX_FROM_ID` is the document/sheet element, `EX_TO_ID` points to the expression/item, `EX_TO_PAR_NAME` holds the parameter name where relevant. (Confirmed from EUL5 examples; EUL4 analogue expected to match.) | — | `EX_FROM_ID` → worksheet/doc; `EX_TO_ID` → `EUL4_EXPRESSIONS.EXP_ID` | ✅* |

Confirmed columns: `EUL4_DOCUMENTS(DOC_ID, DOC_NAME, DOC_DEVELOPER_KEY, DOC_DESCRIPTION, DOC_CONTENT_TYPE, DOC_CREATED_BY, DOC_CREATED_DATE, DOC_UPDATED_BY, DOC_UPDATED_DATE)` (EUL5-confirmed, EUL4 expected to match). `DOC_EU_ID`, `DOC_FOLDER_ID` and `EUL4_ELEM_XREFS(EX_FROM_ID, EX_TO_ID, EX_TO_PAR_NAME)` are confirmed from EUL5 examples and are the likely EUL4 analogue — verify locally. ([Database Query for Discoverer](https://imdjkoch.wordpress.com/2011/04/12/database-query-for-discoverer/), [Discoverer Queries to find Report Details](https://oracleappsessentials.blogspot.com/2017/08/discoverer-queries-to-find-report.html))

### 3.7 Security: Users & Privileges

| Table | Role | PK | Key FK / logical joins | Confidence |
|---|---|---|---|---|
| ✅* `EUL4_EUL_USERS` (also referenced as `EUL_USERS`) | One row per **end user / responsibility / role** registered to the EUL. `EU_USERNAME` may be a plain DB user or an Oracle Applications responsibility encoded as `#<responsibility_id>`. `EU_ROLE_FLAG` marks admin vs ordinary users. (EUL5-confirmed; EUL4 analogue expected to match.) | `EU_ID` | — | ✅* |
| ✅* `EUL4_ACCESS_PRIVS` | **Privilege grants** — one row per privilege. `AP_EU_ID` → the user; `GP_APP_ID` → the privilege type; `GD_DOC_ID` → the workbook being shared (for workbook-sharing grants). (EUL5-confirmed; EUL4 analogue expected to match.) | — | `AP_EU_ID` → `EUL4_EUL_USERS.EU_ID`; `GD_DOC_ID` → `EUL4_DOCUMENTS.DOC_ID` | ✅* |
| ◻️ `EUL4_EUL_PRIVS` (candidate) | **Candidate.** EUL-level access — which users may connect to / use the EUL at all (the "Grant access to PUBLIC" toggle maps here). | — | `→ EUL4_EUL_USERS.EU_ID` (probable) | ◻️ |
| ◻️ `EUL4_ADMIN_PRIVS` (candidate) | **Candidate.** Which users are Discoverer Administrators (can edit the EUL). | — | `→ EUL4_EUL_USERS.EU_ID` (probable) | ◻️ |

Confirmed columns: `EUL4_EUL_USERS(EU_ID, EU_USERNAME, EU_ROLE_FLAG)`; `EUL4_ACCESS_PRIVS(AP_EU_ID, GP_APP_ID, GD_DOC_ID, AP_CREATED_DATE, AP_UPDATED_DATE)`. ([Oracle Discoverer EUL Tables & Description](http://appselangovan.blogspot.com/2012/07/oracle-discoverer-eul-tables.html), [Retrieve shared Discoverer workbooks](https://oracleebsapps.blogspot.com/2011/08/retrieve-which-oracle-discoverer.html))

### 3.8 Summary Folders (Aggregate Tables) & Query Statistics

| Table | Role | PK | Key FK / logical joins | Confidence |
|---|---|---|---|---|
| ◻️ `EUL4_SUMMARIES` (candidate) | **Candidate.** Summary folders — pre-aggregated tables Discoverer builds (manually or via Automated Summary Management) to speed up queries. The *Summary Mappings* status worksheet reports the mapping of summary tables to folders. | — | `→ EUL4_OBJS.OBJ_ID` (probable) | ◻️ |
| ✅ `EUL4_QPP_STATS` | **Query statistics / query prediction** — one row per query run by end users: workbook name, owner, run date, elapsed time, row counts. Drives the *Query Statistics* status workbook and the query governor. | — | `QS_DOC_NAME` / `QS_DOC_OWNER` match workbook name/owner | ✅ |
| ◻️ `EUL4_QSP_STATS` (candidate) | **Candidate.** Aggregate query-statistics / summary-refresh statistics (companion to `EUL4_QPP_STATS`). | — | — | ◻️ |

Confirmed columns for `EUL4_QPP_STATS`: `QS_CREATED_DATE, QS_DOC_NAME, QS_DOC_OWNER, QS_ACT_ELAP_TIME`. ([Database Query for Discoverer](https://imdjkoch.wordpress.com/2011/04/12/database-query-for-discoverer/))

### 3.9 Version, Sessions, Properties, Journal

| Table | Role | Confidence |
|---|---|---|
| ◻️ `EUL4_VERSION` (candidate) | **Candidate.** EUL structure version — a single row recording the metadata version Discoverer checks on connect. The *EUL Version* worksheet reads this. | ◻️ |
| ◻️ `EUL4_SES` (candidate) | **Candidate.** Sessions — active/recorded end-user sessions. | ◻️ |
| ◻️ `EUL4_PROPERTIES` (candidate) | **Candidate.** Extended/custom properties attached to EUL objects. | ◻️ |
| ◻️ `EUL4_JOURNAL` (candidate) | **Candidate.** Optional audit journal of EUL changes (enabled in Administrator). | ◻️ |

---

## 4. Relationship / Schema Map

The diagram below shows the logical join graph Discoverer walks. Solid arrows are confirmed joins (from the SQL Discoverer itself issues); dashed are conventional/standard.

```
EUL4_VERSION  (1 row: EUL version)
        │
   EUL4_EUL_USERS (EU_ID)  ───────────────┐  (owner)
        │                                 │
        ├──< EUL4_ACCESS_PRIVS (AP_EU_ID) ├──< EUL4_DOCUMENTS (DOC_EU_ID)
        │        │  (GD_DOC_ID) ──────────>│         │
        │        │                         │   EUL4_SHEETS ──< EUL4_ELEM_XREFS
        │        │                         │        │ EX_TO_ID
        │        │                         │        ▼
        │        │                         │   EUL4_EXPRESSIONS (EXP_ID)
        │        │                         │        │  IT_OBJ_ID
        │        │                         │        ▼
        │        │                         │   EUL4_OBJS (OBJ_ID)
        │        │                         │     ▲      ▲
        │        │                         │     │      │ KEY_OBJ_ID / FK_OBJ_ID_REMOTE
        │        │                         │     │      └──< EUL4_KEY_CONS (KEY_ID)
        │        │                         │     │
        │        │                         │  EUL4_BA_OBJ_LINKS (BOL_OBJ_ID, BOL_BA_ID)
        │        │                         │     │      │
        │        │                         │     │      └──> EUL4_BAS (BA_ID)
        │        │                         │
        │        │                         └── (workbook sharing via GD_DOC_ID)
        │
        └──< EUL4_EUL_PRIVS / EUL4_ADMIN_PRIVS  (EUL-level + admin grants)

   EUL4_SUMMARIES ──(maps to)──> EUL4_OBJS
   EUL4_HIERARCHIES / EUL4_ITEM_CLASSES / EUL4_FUNCTS ──> EUL4_EXPRESSIONS (EXP_ID)
   EUL4_QPP_STATS / EUL4_QSP_STATS  (stand-alone statistics, keyed by doc name/owner)
```

**Tracing path (workbook → physical SQL):** `EUL4_DOCUMENTS → EUL4_ELEM_XREFS → EUL4_EXPRESSIONS → EUL4_OBJS` (→ `SOBJ_EXT_TABLE` for the base table) and `EUL4_KEY_CONS` for the joins between folders. (`EUL4_SHEETS`, if present in your EUL, sits between DOCUMENTS and ELEM_XREFS; because worksheet structure is partly serialized, the relational xref is reliable for *which items a workbook uses* but may not reconstruct every layout detail or the exact final SQL text.)

---

## 5. How Generated SQL Is Assembled

Discoverer does **not** store a finished SQL string for each report. At run time the Discoverer query engine reads the metadata and composes a `SELECT … FROM … WHERE … GROUP BY … ORDER BY` dynamically. Each SQL clause maps to specific EUL tables:

| SQL clause | Where it comes from in the EUL | Tables |
|---|---|---|
| `SELECT` list (columns returned) | The **items** placed on the worksheet, each resolved to its physical column or calculation expression. | `EUL4_ELEM_XREFS` → `EUL4_EXPRESSIONS` (`IT_EXT_COLUMN`, `EXP_TYPE=CI` for calculations) |
| `FROM` (tables/views) | The **folders** referenced, resolved to their underlying physical object. | `EUL4_OBJS.SOBJ_EXT_TABLE` (Simple folders); `EUL4_OBJS` `COBJ` definition (Complex folders — a derived SQL) |
| `JOIN … ON` (multi-folder) | The **joins** between folders along the path from the selected items. | `EUL4_KEY_CONS` (`KEY_OBJ_ID`, `FK_OBJ_ID_REMOTE`) |
| `WHERE` (filters) | **Conditions** applied to the sheet, plus join predicates and item-class/LOV selections. | `EUL4_EXPRESSIONS` (condition rows) + `EUL4_ITEM_CLASSES` for LOV-driven predicates |
| `GROUP BY` / aggregate functions | **Item aggregation flags** (sum, count, avg) and summary-folder redirection. | `EUL4_EXPRESSIONS` aggregation flags; `EUL4_SUMMARIES` (when a summary folder can satisfy the query) |
| `ORDER BY` / sort | **Worksheet layout** — sort order and item placement. | `EUL4_SHEETS` |
| Parameters / prompts | Bind variables supplied at run time; default values stored against the sheet element. | `EUL4_ELEM_XREFS.EX_TO_PAR_NAME` |

**Summary-folder redirection (ASM):** when a query matches a pre-built summary, the query engine rewrites `FROM <base table>` to `FROM <summary table>` and adjusts the SELECT/JOINs — all driven by `EUL4_SUMMARIES` mappings. ([Oracle — Creating summary folders manually](https://docs.oracle.com/html/A90881_02/creating.htm))

**Trace it yourself:** enable SQL trace (`ALTER SESSION SET SQL_TRACE=TRUE`) or Discoverer's command-line trace, run a worksheet, then inspect the generated statement — you will see the column names from `IT_EXT_COLUMN`, the base table from `SOBJ_EXT_TABLE`, and the join keys from `EUL4_KEY_CONS`. Note that Discoverer composes the final SQL from serialized workbook metadata *plus* the relational EUL metadata, so the relational queries above are an accurate guide to *what is selected and joined* but may not reproduce the exact emitted SQL string verbatim. ([Oracle — Using SQL files and trace files](https://docs.oracle.com/html/B10270_01/file_lis.htm))

---

## 6. Where Report Definitions Live

- **EUL metadata** (business areas, folders, items, joins, hierarchies, item classes, summaries, security) lives in the `EUL4_` tables above. This is the *shared, reusable* layer maintained in Discoverer Administrator.
- **Workbook / worksheet definitions** (which items a report uses, its layout, conditions, parameters) live in `EUL4_DOCUMENTS` + `EUL4_SHEETS` + `EUL4_ELEM_XREFS`. The worksheet structure itself is stored as a serialized definition; `EUL4_ELEM_XREFS` is the relational index that lets you query *which items a given worksheet uses* without parsing the serialized blob.
- **The final SQL is not stored** as a reusable object — it is generated on each run. The only place finished-query text appears is transiently in trace files, and statistically in `EUL4_QPP_STATS` (which records doc name, owner, elapsed time, rows — not the full SQL).
- **Sharing / access** to a workbook is stored in `EUL4_ACCESS_PRIVS` (`GD_DOC_ID` → the workbook, `AP_EU_ID` → the user/responsibility).

So: a "report" = a `DOC_ID` in `EUL4_DOCUMENTS`; its columns = `EUL4_ELEM_XREFS`/`EUL4_EXPRESSIONS` rows pointing back to folders in `EUL4_OBJS`; the folders' base tables = `SOBJ_EXT_TABLE`; the joins between them = `EUL4_KEY_CONS`; and usage history = `EUL4_QPP_STATS`. ([Database Query for Discoverer](https://imdjkoch.wordpress.com/2011/04/12/database-query-for-discoverer/))

---

## 7. Administrator Introspection Queries

Run these as the EUL owner (e.g. `EUL4_US`) or as a DBA with access to the EUL schema.

### 7.1 List every EUL table and its primary key

```sql
-- All EUL4 tables
SELECT table_name
FROM   all_tables
WHERE  owner = 'EUL4_US'           -- your EUL owner
  AND  table_name LIKE 'EUL4\_%' ESCAPE '\'
ORDER BY table_name;

-- Primary keys per EUL table
SELECT uc.table_name,
       uc.constraint_name AS pk_constraint,
       LISTAGG(ucc.column_name, ', ')
         WITHIN GROUP (ORDER BY ucc.position) AS pk_columns
FROM   all_constraints uc
JOIN   all_cons_columns ucc
       ON uc.owner = ucc.owner AND uc.constraint_name = ucc.constraint_name
WHERE  uc.owner = 'EUL4_US'
  AND  uc.constraint_type = 'P'
  AND  uc.table_name LIKE 'EUL4\_%' ESCAPE '\'
GROUP  BY uc.table_name, uc.constraint_name
ORDER  BY uc.table_name;
```

### 7.2 List logical foreign keys (and the reality check)

```sql
-- Physical FKs that DO exist in the EUL schema (often very few)
SELECT uc.table_name AS child_table,
       ucc.column_name AS fk_column,
       uc.constraint_name AS fk_constraint,
       uc.r_constraint_name AS references_pk,
       rc.table_name AS parent_table
FROM   all_constraints uc
JOIN   all_cons_columns ucc
       ON uc.owner = ucc.owner AND uc.constraint_name = ucc.constraint_name
JOIN   all_constraints rc
       ON uc.r_owner = rc.owner AND uc.r_constraint_name = rc.constraint_name
WHERE  uc.owner = 'EUL4_US'
  AND  uc.constraint_type = 'R'
ORDER  BY uc.table_name, ucc.position;
```

> If this returns almost nothing, that is expected — Discoverer enforces joins in the application. The *logical* foreign keys are the join columns Discoverer itself uses; see the worked examples below.

### 7.3 Trace a workbook → its folders, items, and base tables

```sql
SELECT d.doc_name         AS workbook,
       o.obj_name         AS folder,
       e.exp_name         AS item,
       e.exp_type         AS item_type,   -- CO = base column, CI = created/calculation
       o.sobj_ext_table   AS base_table,
       e.it_ext_column    AS base_column
FROM   eul4_us.eul4_documents      d
JOIN   eul4_us.eul4_elem_xrefs     x  ON x.ex_from_id = d.doc_id
JOIN   eul4_us.eul4_expressions   e  ON e.exp_id     = x.ex_to_id
JOIN   eul4_us.eul4_objs          o  ON o.obj_id     = e.it_obj_id
WHERE  d.doc_content_type = 'application/vnd.oracle-disco.wb'
  AND  d.doc_name = '&YOUR_WORKBOOK_NAME'
ORDER  BY o.obj_name, e.exp_name;
```

([Discoverer Queries to find Report Details](https://oracleappsessentials.blogspot.com/2017/08/discoverer-queries-to-find-report.html))

### 7.4 Trace a Business Area → its folders and items

```sql
SELECT b.ba_name,
       o.obj_name AS folder,
       e.exp_name AS item,
       e.it_heading,
       e.exp_data_type,
       e.it_format_mask
FROM   eul4_us.eul4_bas            b
JOIN   eul4_us.eul4_ba_obj_links   bol ON bol.bol_ba_id  = b.ba_id
JOIN   eul4_us.eul4_objs           o   ON o.obj_id        = bol.bol_obj_id
JOIN   eul4_us.eul4_expressions   e   ON e.it_obj_id     = o.obj_id
WHERE  b.ba_name = '&YOUR_BUSINESS_AREA'
ORDER  BY o.obj_name, e.exp_name;
```

([Key EUL tables](https://arunrathod.blogspot.com/2008/09/key-eul-tables-for-different-discoverer.html), [Generate EUL overview](https://oracleebsapps.blogspot.com/2011/08/generate-overview-of-your-end-user.html))

### 7.5 List joins (folder-to-folder)

```sql
SELECT p.obj_name AS parent_folder,
       c.obj_name AS child_folder,
       k.key_description AS join_description
FROM   eul4_us.eul4_key_cons k
JOIN   eul4_us.eul4_objs    p ON p.obj_id = k.key_obj_id
JOIN   eul4_us.eul4_objs    c ON c.obj_id = k.fk_obj_id_remote
ORDER  BY p.obj_name;
```

([Oracle Discoverer EUL Tables & Description](http://appselangovan.blogspot.com/2012/07/oracle-discoverer-eul-tables.html))

### 7.6 Workbook sharing (who can access)

```sql
SELECT d.doc_name AS workbook,
       u.eu_username AS shared_with,
       a.ap_updated_date AS last_updated
FROM   eul4_us.eul4_documents     d
JOIN   eul4_us.eul4_access_privs  a ON a.gd_doc_id = d.doc_id
JOIN   eul4_us.eul4_eul_users    u ON u.eu_id     = a.ap_eu_id
WHERE  d.doc_content_type = 'application/vnd.oracle-disco.wb'
ORDER  BY d.doc_name;
```

([Retrieve shared Discoverer workbooks](https://oracleebsapps.blogspot.com/2011/08/retrieve-which-oracle-discoverer.html))

---

## 8. Summary Table (quick reference)

| Domain | Table(s) | Confirmed columns |
|---|---|---|
| Business Areas | `EUL4_BAS`, `EUL4_BA_OBJ_LINKS` | `BA_ID, BA_NAME, BA_DESCRIPTION`; `BOL_BA_ID, BOL_OBJ_ID` |
| Folders | `EUL4_OBJS` | `OBJ_ID, OBJ_NAME, OBJ_TYPE(SOBJ/COBJ), SOBJ_EXT_TABLE, OBJ_EXT_OWNER` |
| Items / Conditions / Calculations | `EUL4_EXPRESSIONS` | `EXP_ID, EXP_NAME, EXP_TYPE(CO/CI), IT_OBJ_ID, IT_EXT_COLUMN, IT_HEADING, IT_FORMAT_MASK, EXP_DATA_TYPE` |
| Joins | `EUL4_KEY_CONS` (`EUL4_KEY_USAGES`) | `KEY_ID, KEY_OBJ_ID, FK_OBJ_ID_REMOTE, KEY_DESCRIPTION` |
| Hierarchies | `EUL4_HIERARCHIES` | (introspect) |
| Item Classes / LOVs | `EUL4_ITEM_CLASSES` | (introspect) |
| Functions | `EUL4_FUNCTS` (candidate) | `EUL4_GET_*` are PL/SQL functions created by `eul4.sql`; relational function-metadata table, if any, verify locally |
| Workbooks | `EUL4_DOCUMENTS` | `DOC_ID, DOC_NAME, DOC_DEVELOPER_KEY, DOC_CONTENT_TYPE, DOC_EU_ID, DOC_FOLDER_ID` |
| Worksheets | `EUL4_SHEETS` | (introspect) |
| Element cross-refs | `EUL4_ELEM_XREFS` | `EX_FROM_ID, EX_TO_ID, EX_TO_PAR_NAME` |
| Users | `EUL4_EUL_USERS` | `EU_ID, EU_USERNAME, EU_ROLE_FLAG` |
| Privileges | `EUL4_ACCESS_PRIVS` (`EUL4_EUL_PRIVS`, `EUL4_ADMIN_PRIVS`) | `AP_EU_ID, GP_APP_ID, GD_DOC_ID, AP_CREATED_DATE, AP_UPDATED_DATE` |
| Summaries | `EUL4_SUMMARIES` | (introspect) |
| Query stats | `EUL4_QPP_STATS` (`EUL4_QSP_STATS`) | `QS_DOC_NAME, QS_DOC_OWNER, QS_CREATED_DATE, QS_ACT_ELAP_TIME` |
| Version / Sessions / Props / Audit | `EUL4_VERSION`, `EUL4_SES`, `EUL4_PROPERTIES`, `EUL4_JOURNAL` | (introspect) |

---

## 9. Verification Notes & Gaps

- **No published authoritative EUL4 DDL list.** Public Oracle documentation does not expose a complete table/PK/FK catalog for the EUL4 schema; local object counts vary. Run [7.1](#71-list-every-eul-table-and-its-primary-key) to produce the definitive table/PK/FK list for your own EUL.
- **Foreign keys are mostly logical, not physical.** Do not expect `ALL_CONSTRAINTS` to return a rich FK graph. The relationships in this guide are the *logical* joins the Discoverer engine uses, confirmed from the SQL the product itself issues. Verify column names with [7.1](#71-list-every-eul-table-and-its-primary-key)–[7.2](#72-list-logical-foreign-keys-and-the-reality-check).
- **EUL4 vs EUL5.** Every `EUL4_` table here has an `EUL5_` counterpart on later releases, usually with extra columns. If your schema is `EUL5_`/`EUL_US`, the concepts and join paths are the same but introspect before trusting exact column names.
- **Tables marked ◻️ are candidates, not confirmed.** Oracle's EUL Status Workbooks confirm these *metadata domains* are reported on (Hierarchies, Item Classes, Summary Mappings, Workbook Management, Conditions, etc.), but Oracle does not publish the exact underlying EUL4 table or column names. The names follow Discoverer's naming conventions and are the most likely candidates — verify each against your local EUL via `ALL_TABLES` before relying on it.

---

## Sources

- [Oracle — Oracle Discoverer 4.1 Administration Guide: EUL Status Workbooks](https://docs.oracle.com/html/A86730_01/eul_stat.htm)
- [Oracle — Using SQL files and trace files (eul4.sql, eul4del.sql, eulasm.sql)](https://docs.oracle.com/html/B10270_01/file_lis.htm)
- [Oracle — Creating summary folders manually (ASM)](https://docs.oracle.com/html/A90881_02/creating.htm)
- [Oracle — Creating and Maintaining End User Layers](https://docs.oracle.com/cd/E23943_01/bi.1111/b32519/maintain_eul.htm)
- [Oracle Discoverer EUL Tables & Description (EUL4_BAS, EUL4_OBJS, EUL4_KEY_CONS, EUL4_EXPRESSIONS, EUL4_ACCESS_PRIVS)](http://appselangovan.blogspot.com/2012/07/oracle-discoverer-eul-tables.html)
- [Key EUL tables for the different Discoverer components (folders, items, joins, workbooks queries)](https://arunrathod.blogspot.com/2008/09/key-eul-tables-for-different-discoverer.html)
- [Generate an overview of your End User Layer (EUL5_OBJS/BAS/EXPRESSIONS columns)](https://oracleebsapps.blogspot.com/2011/08/generate-overview-of-your-end-user.html)
- [Discoverer Queries to find Report Details (EUL5_DOCUMENTS/ELEM_XREFS/EXPRESSIONS)](https://oracleappsessentials.blogspot.com/2017/08/discoverer-queries-to-find-report.html)
- [Database Query for Discoverer (EUL5_DOCUMENTS/QPP_STATS/ELEM_XREFS columns)](https://imdjkoch.wordpress.com/2011/04/12/database-query-for-discoverer/)
- [Retrieve which Oracle Discoverer workbooks are shared (EUL5_DOCUMENTS/ACCESS_PRIVS/EUL_USERS)](https://oracleebsapps.blogspot.com/2011/08/retrieve-which-oracle-discoverer.html)
- [Discoverer Info — EUL4_US schema / EUL4_DOCUMENTS](https://sivakandigatla.blogspot.com/2010/08/discoverer-info.html)
- [Useful Discoverer Queries (EUL5_DOCUMENTS/ACCESS_PRIVS/EUL_USERS)](https://doyensys.com/blogs/useful-discoverer-queries-2/)
