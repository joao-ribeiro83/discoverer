# EUL Version Reference — EUL3 / EUL4 / EUL5 Schema Comparison

> # ⚠️ RETRACTED — DO NOT USE FOR TABLE OR COLUMN NAMES
>
> **The EUL schema described below does not exist.** Verified 2026-08-20
> against Oracle's own shipped scripts in `discoverer10g/sql/`
> (`euldrop.sql`, `eul4del.sql`, `Lineage.sql`, `eulver.sql`, `batchusr.sql`).
>
> Fabricated here: `EUL5_JOINS`, `EUL5_JOI_COMP`, `EUL5_HIER_LEVELS`,
> `EUL5_ELEM_ACCESS`, `EUL5_EUL`, `EUL5_OPTIONS`, `EUL5_TRANSLATIONS`,
> `OBJ_TABLE_NAME`, `OBJ_TABLE_OWNER`, `EXP_COL_NAME`, `HIER_ID`, and the
> `BA`/`USERS`/`ROLES`/`*_ROLES` table names. The real equivalents are
> `KEY_CONS`, `HI_NODES` + `HI_SEGMENTS`, `ACCESS_PRIVS`, `VERSIONS`,
> `SOBJ_EXT_TABLE`, `OBJ_EXT_OWNER`, `IT_EXT_COLUMN`, `HI_ID`, `BAS`,
> `EUL_USERS`.
>
> This document was the origin of a fabricated schema throughout the
> `migrate` workspace, since corrected.
>
> **Authoritative replacement:**
> [`discoverer-neo/migrate/EUL_SCHEMA_GROUND_TRUTH.md`](discoverer-neo/migrate/EUL_SCHEMA_GROUND_TRUTH.md)
>
> Kept only as a record of what was believed. **No identifier in it should be
> trusted.**

> **Purpose:** ~~The authoritative reference for the Discoverer Neo migration tool's version detection and schema adapter layer.~~ (retracted — see above)
> **Last Updated:** 2026-06-23 · **Retracted:** 2026-08-20

---

## 1. Version Mapping

| Discoverer Release | EUL Version | Table Prefix | Status |
|---|---|---|---|
| 3.1.x / 3.3.x | 3.1.x | `EUL_` (no number) | Very old, rarely encountered |
| 4.1.x / 4.x | 4.1.x | `EUL4_` | EOL — legacy installations |
| 9.0.2.52 and earlier | 5.0.0.x | `EUL5_` | EOL |
| 9.0.2.53 / 9.0.4.x | 5.0.2.x | `EUL5_` | EOL |
| 10.1.x / 11.1.x | 5.1.x.x | `EUL5_` | Most common in EBS environments |

The EUL version is stored in `EUL5_EUL.EU_VERSION` (VARCHAR2) and validated by Discoverer at connection time.

---

## 2. Table Inventory by Version

### Core Metadata Tables

| Base Name | EUL3 | EUL4 | EUL5 | Notes |
|---|---|---|---|---|
| BA (Business Areas) | EUL_BA | EUL4_BA | EUL5_BA | |
| OBJS (Folders) | EUL_OBJS | EUL4_OBJS | EUL5_OBJS | |
| EXPRESSIONS (Items) | EUL_EXPRESSIONS | EUL4_EXPRESSIONS | EUL5_EXPRESSIONS | Central polymorphic table |
| JOINS | EUL_JOINS | EUL4_JOINS | EUL5_JOINS | |
| JOI_COMP (Join Components) | EUL_JOI_COMP | EUL4_JOI_COMP | EUL5_JOI_COMP | |
| HIERARCHIES | EUL_HIERARCHIES | EUL4_HIERARCHIES | EUL5_HIERARCHIES | |
| HIER_LEVELS | EUL_HIER_LEVELS | EUL4_HIER_LEVELS | EUL5_HIER_LEVELS | |
| SUMMARIES | EUL_SUMMARIES | EUL4_SUMMARIES | EUL5_SUMMARIES | |
| FUNCTIONS | EUL_FUNCTIONS | EUL4_FUNCTIONS | EUL5_FUNCTIONS | |
| ELEM_ACCESS (Grants) | EUL_ELEM_ACCESS | EUL4_ELEM_ACCESS | EUL5_ELEM_ACCESS | |
| DOCUMENTS (Workbooks) | EUL_DOCUMENTS | EUL4_DOCUMENTS | EUL5_DOCUMENTS | |
| QPP_STATS (Query Log) | EUL_QPP_STATS | EUL4_QPP_STATS | EUL5_QPP_STATS | |
| QPP_QUERY | — | — | EUL5_QPP_QUERY | New in EUL5 |
| EUL (Version Identity) | EUL_EUL | EUL4_EUL | EUL5_EUL | |
| OPTIONS | EUL_OPTIONS | EUL4_OPTIONS | EUL5_OPTIONS | |
| LOCK | — | — | EUL5_LOCK | New in EUL5 |
| TRANSLATIONS | — | — | EUL5_TRANSLATIONS | New in EUL5 |

### Security Tables

| Base Name | EUL3 | EUL4 | EUL5 | Notes |
|---|---|---|---|---|
| USERS | EUL_USERS | EUL4_USERS | — | Absorbed into EUL5 security model |
| ROLES | EUL_ROLES | EUL4_ROLES | — | Absorbed into EUL5 security model |
| BA_ROLES | — | EUL4_BA_ROLES | EUL5_BA_ROLES | May have existed in EUL4 |
| OBJ_ROLES | — | EUL4_OBJ_ROLES | EUL5_OBJ_ROLES | May have existed in EUL4 |
| APP_ROLES | — | EUL4_APP_ROLES | EUL5_APP_ROLES | May have existed in EUL4 |

---

## 3. Column-Level Differences

### 3.1 BA (Business Areas)

| Column | EUL4 | EUL5 | Migration Handling |
|---|---|---|---|
| BA_ID | NUMBER | NUMBER | Direct map |
| BA_NAME | VARCHAR2(200) | VARCHAR2(200) | Direct map |
| BA_DESCRIPTION | VARCHAR2(2000) | VARCHAR2(2000) | Direct map |
| BA_CREATED_BY | VARCHAR2(100) | VARCHAR2(100) | Direct map |
| BA_CREATED_DATE | DATE | DATE | Direct map |
| BA_UPDATED_BY | VARCHAR2(100) | VARCHAR2(100) | Direct map |
| BA_UPDATED_DATE | DATE | DATE | Direct map |
| BA_LANGUAGE | — | VARCHAR2(30) | Default: 'US' |
| BA_DEVELOPER_KEY | — | VARCHAR2(200) | Default: NULL |

### 3.2 OBJS (Folders)

| Column | EUL4 | EUL5 | Migration Handling |
|---|---|---|---|
| OBJ_ID | NUMBER | NUMBER | Direct map |
| OBJ_NAME | VARCHAR2(200) | VARCHAR2(200) | Direct map |
| OBJ_DESCRIPTION | — | VARCHAR2(2000) | Default: NULL |
| OBJ_TYPE | VARCHAR2(18) | VARCHAR2(18) | See folder type mapping |
| OBJ_TABLE_NAME | VARCHAR2(200) | VARCHAR2(200) | Direct map |
| OBJ_TABLE_OWNER | VARCHAR2(200) | VARCHAR2(200) | Direct map |
| OBJ_SEQUENCE | NUMBER | NUMBER | Direct map |
| BA_ID | NUMBER | NUMBER | Direct map |
| OBJ_CREATED_BY | VARCHAR2(100) | VARCHAR2(100) | Direct map |
| OBJ_CREATED_DATE | DATE | DATE | Direct map |
| OBJ_UPDATED_BY | — | VARCHAR2(100) | Default: OBJ_CREATED_BY |
| OBJ_UPDATED_DATE | — | DATE | Default: OBJ_CREATED_DATE |

**Folder Type Mapping:**

| EUL4 | EUL5 | Discoverer Neo |
|---|---|---|
| TABLE | TABLE | TABLE |
| VIEW | VIEW | VIEW |
| COMPLEX | COMPLEX | COMPLEX |
| JOIN | JOIN | JOIN |
| — | DERIVED | DERIVED |
| — | SUMMARY | SUMMARY |

### 3.3 EXPRESSIONS (Items)

| Column | EUL4 | EUL5 | Migration Handling |
|---|---|---|---|
| EXP_ID | NUMBER | NUMBER | Direct map |
| EXP_NAME | VARCHAR2(200) | VARCHAR2(200) | Direct map |
| EXP_DESCRIPTION | — | VARCHAR2(2000) | Default: NULL |
| EXP_TYPE | VARCHAR2(18) | VARCHAR2(18) | See type mapping |
| EXP_FORMULA | VARCHAR2(4000) | VARCHAR2(4000) | Direct map |
| EXP_COL_NAME | VARCHAR2(200) | VARCHAR2(200) | Direct map |
| OBJ_ID | NUMBER | NUMBER | Direct map |
| EXP_DATA_TYPE | VARCHAR2(30) | VARCHAR2(30) | Direct map |
| EXP_FORMAT_MASK | VARCHAR2(80) | VARCHAR2(80) | Direct map |
| EXP_AGGR_FUNC | VARCHAR2(30) | VARCHAR2(30) | Direct map |
| EXP_SEQUENCE | NUMBER | NUMBER | Direct map |
| EXP_NULLS_ALLOWED | — | VARCHAR2(1) | Default: 'Y' |
| IT_EXP_ID | — | NUMBER | Default: NULL (hierarchy levels in EUL4 are in separate table) |
| EXP_CREATED_BY | VARCHAR2(100) | VARCHAR2(100) | Direct map |
| EXP_CREATED_DATE | DATE | DATE | Direct map |
| EXP_UPDATED_BY | — | VARCHAR2(100) | Default: EXP_CREATED_BY |
| EXP_UPDATED_DATE | — | DATE | Default: EXP_CREATED_DATE |

**EXP_TYPE Mapping:**

| Value | EUL4 | EUL5 | Discoverer Neo | Description |
|---|---|---|---|---|
| CI | Yes | Yes | CI | Column Item |
| CU | Yes | Yes | CU | Calculated Item |
| CO | Yes | Yes | CO | Condition |
| JI | Yes | Yes | JI | Join Item |
| HI | Yes | Yes | HI | Hierarchy Item |
| AG | — | Yes | AG | Aggregate |
| SM | — | Yes | SM | Security Manager |
| FU | Yes | Yes | FU | Function reference |

### 3.4 JOINS

| Column | EUL4 | EUL5 | Migration Handling |
|---|---|---|---|
| JOI_ID | NUMBER | NUMBER | Direct map |
| JOI_NAME | VARCHAR2(200) | VARCHAR2(200) | Direct map |
| JOI_DESCRIPTION | — | VARCHAR2(2000) | Default: NULL |
| JOI_TYPE | VARCHAR2(10) | VARCHAR2(10) | See join type mapping |
| JOI_CREATED_BY | VARCHAR2(100) | VARCHAR2(100) | Direct map |
| JOI_CREATED_DATE | DATE | DATE | Direct map |

**Join Type Mapping:**

| EUL4 | EUL5 | Discoverer Neo |
|---|---|---|
| INNER | INNER | INNER |
| OUTER | — | LEFT (default outer) |
| — | LEFT | LEFT |
| — | RIGHT | RIGHT |
| — | FULL | FULL |

### 3.5 HIERARCHIES

| Column | EUL4 | EUL5 | Migration Handling |
|---|---|---|---|
| HIER_ID | NUMBER | NUMBER | Direct map |
| HIER_NAME | VARCHAR2(200) | VARCHAR2(200) | Direct map |
| HIER_DESCRIPTION | — | VARCHAR2(2000) | Default: NULL |
| BA_ID | NUMBER | NUMBER | Direct map |
| HIER_CREATED_BY | VARCHAR2(100) | VARCHAR2(100) | Direct map |
| HIER_CREATED_DATE | DATE | DATE | Direct map |
| HIER_UPDATED_BY | — | VARCHAR2(100) | Default: HIER_CREATED_BY |
| HIER_UPDATED_DATE | — | DATE | Default: HIER_CREATED_DATE |

### 3.6 HIER_LEVELS

| Column | EUL4 | EUL5 | Migration Handling |
|---|---|---|---|
| HIER_LEVEL_ID | NUMBER | NUMBER | Direct map |
| HIER_ID | NUMBER | NUMBER | Direct map |
| ITEM_ID | NUMBER | NUMBER | Direct map |
| HIER_LEVEL_NAME | VARCHAR2(200) | VARCHAR2(200) | Direct map |
| HIER_LEVEL_NUM | NUMBER | NUMBER | Direct map |

> **Note:** In EUL5, hierarchy levels are also accessible via `EUL5_EXPRESSIONS.IT_EXP_ID` which self-references `EXP_ID`. The migration tool should use `EUL4_HIER_LEVELS` for EUL4 and `EUL5_HIER_LEVELS` for EUL5 (or fall back to `IT_EXP_ID` if `EUL5_HIER_LEVELS` is empty).

### 3.7 DOCUMENTS (Workbooks)

| Column | EUL4 | EUL5 | Migration Handling |
|---|---|---|---|
| DOC_ID | NUMBER | NUMBER | Direct map |
| DOC_NAME | VARCHAR2(200) | VARCHAR2(200) | Direct map |
| DOC_DESCRIPTION | — | VARCHAR2(2000) | Default: NULL |
| DOC_CREATED_BY | VARCHAR2(100) | VARCHAR2(100) | Direct map |
| DOC_CREATED_DATE | DATE | DATE | Direct map |
| DOC_UPDATED_BY | VARCHAR2(100) | VARCHAR2(100) | Direct map |
| DOC_UPDATED_DATE | DATE | DATE | Direct map |
| DOC_CONTENT | LONG | LONG | Direct map (XML) |
| DOC_EU_ID | NUMBER | NUMBER | Direct map |
| DOC_DEVELOPER_KEY | — | VARCHAR2(200) | Default: NULL |
| DOC_WORKBOOK_OWNER | — | VARCHAR2(100) | Default: DOC_CREATED_BY |

### 3.8 QPP_STATS (Query Execution Log)

| Column | EUL4 | EUL5 | Migration Handling |
|---|---|---|---|
| ES_ID | NUMBER | NUMBER | Direct map |
| DOC_NAME | VARCHAR2(200) | VARCHAR2(200) | Direct map |
| ES_CREATED_DATE | DATE | DATE | Direct map |
| ES_CREATED_BY | VARCHAR2(100) | VARCHAR2(100) | Direct map |
| ES_ELAPSED_TIME | NUMBER | NUMBER | Direct map |
| ES_CPU_TIME | NUMBER | NUMBER | Direct map |
| ES_ROWS_RETURNED | NUMBER | NUMBER | Direct map |
| ES_QUERY_TEXT | LONG | LONG | Direct map |
| ES_STATEMENT_ID | — | VARCHAR2(50) | Default: NULL |
| ES_SESSION_ID | — | NUMBER | Default: NULL |
| EU_ID | NUMBER | NUMBER | Direct map |

### 3.9 EUL (Version Identity)

| Column | EUL4 | EUL5 | Migration Handling |
|---|---|---|---|
| EU_ID | NUMBER | NUMBER | Direct map |
| EU_NAME | VARCHAR2(200) | VARCHAR2(200) | Direct map |
| EU_CREATED_DATE | DATE | DATE | Direct map |
| EU_LANGUAGE | VARCHAR2(30) | VARCHAR2(30) | Direct map |
| EU_VERSION | VARCHAR2(30) | VARCHAR2(30) | Direct map |
| EU_DISC_VERSION | — | VARCHAR2(30) | Default: 'unknown' |

---

## 4. Security Model Differences

### EUL4 Security Model
- Users defined in `EUL4_USERS`
- Roles defined in `EUL4_ROLES`
- Grants in `EUL4_BA_ROLES`, `EUL4_OBJ_ROLES`, `EUL4_APP_ROLES`
- Security Manager conditions may be stored differently (not in EXPRESSIONS)

### EUL5 Security Model
- Users managed via Oracle DB roles and Discoverer privilege system
- Grants in `EUL5_BA_ROLES`, `EUL5_OBJ_ROLES`, `EUL5_APP_ROLES`
- Security Manager conditions stored in `EUL5_EXPRESSIONS` with `EXP_TYPE = 'SM'`
- Row-level security via VPD policies or Security Manager conditions

### Migration Strategy
1. Read users from EUL4_USERS or EUL5 security tables
2. Map EUL4 roles to Discoverer Neo roles (ADMIN, MANAGER, USER, VIEWER)
3. Migrate grants to `user_business_area_grants`
4. Migrate Security Manager conditions (EXP_TYPE='SM') as row-level security policies

---

## 5. Detection Algorithm

```
1. Query ALL_TABLES for tables matching 'EUL%_BA' pattern
2. If EUL5_BA exists → version = EUL5
3. Else if EUL4_BA exists → version = EUL4
4. Else if EUL_BA exists → version = EUL3
5. Else → unsupported (no EUL detected)
6. Read EUL*_EUL table to get EU_VERSION
7. Scan for version-specific tables to confirm version
8. Build table name list for the detected version
```

---

## 6. Upgrade Path Reference

Oracle's official upgrade from EUL4 to EUL5 (documented in Discoverer 10g/11g Administrator Guide):
1. **Non-destructive**: EUL4_ tables remain intact, EUL5_ tables are created as copies
2. Old EUL4_ tables can still be used by Discoverer 4.1 clients during transition
3. After validation, EUL4_ tables can be dropped via `eul4del.sql`
4. This means a migration tool may encounter:
   - Pure EUL4 (no EUL5 tables) — migrate from EUL4
   - Pure EUL5 (no EUL4 tables) — migrate from EUL5
   - Mixed (both exist) — prefer EUL5 (upgraded), but allow EUL4 override

---

*This document is used by the Discoverer Neo migration tool's version detector and schema adapter.*
