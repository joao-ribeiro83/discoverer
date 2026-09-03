# Baseline counts — Phase 0.4

Measured 2026-09-03 against the live target Postgres (`discoverer_neo`, container
`discoverer-neo-postgres`), read-only. Every number below has a query beside it. Re-running
the queries against the same database reproduces this artefact.

**Method.** All DB counts were taken with one script (`pg` client, single read-only session,
never a transaction that writes) that prints only aggregated counts — no row content left the
sandbox. The script is not checked in (throwaway measurement tooling); the SQL embedded below
is the reproducible part. Connection: `host=localhost port=5432 db=discoverer_neo
user=discoverer` (from `discoverer-neo/.env`).

Container-derived counts (marked **[SOURCE]**) were not re-measured here — they are already
established, [DUMP]-confirmed figures from `EUL_SCHEMA_GROUND_TRUTH.md` and
`research/legacy-analysis.md`, produced by the existing `.DIS` parser
(`migrate/src/services/workbook-parser.ts`) and differ (`migrate/src/scripts/diff-corpus.ts`)
against the full 552-file corpus in `d4dumps/`. They are cited, not re-derived, per this
stage's instruction to reuse existing tooling rather than write new parsers.

---

## 1. The three contradictions — resolved by measurement

### Multi-folder maps: **341 is correct, not 272**

```sql
-- folder set of a map = distinct folders reached via its map_items and map_conditions
WITH map_folders AS (
  SELECT mi.map_id, i.folder_id FROM map_items mi JOIN items i ON i.id = mi.item_id
  UNION
  SELECT mc.map_id, i.folder_id FROM map_conditions mc JOIN items i ON i.id = mc.item_id
), counts AS (
  SELECT map_id, count(DISTINCT folder_id) AS n FROM map_folders GROUP BY map_id
)
SELECT
  (SELECT count(*) FROM maps)              AS total_maps,        -- 923
  (SELECT count(*) FROM counts WHERE n=1)  AS single_folder,     -- 581
  (SELECT count(*) FROM counts WHERE n>1)  AS multi_folder,      -- 341
  (SELECT count(*) FROM maps)
    - (SELECT count(*) FROM counts)        AS no_folder_refs;    -- 1
```

| | Count |
|---|---|
| Total maps | **923** |
| Single-folder maps | **581** |
| Multi-folder maps | **341** |
| Maps with no folder references at all (neither items nor conditions resolve to a folder) | **1** |

341 matches `PHASE-03-02:11` exactly. 272 (`PHASE-01-01:9,151`) does not match anything
measured and is wrong. 581, not 651 or 582 — the 582 guess in this stage's own brief
(923 − 341) assumed every map has a folder reference; one map does not.

**Caveat — folder set does not include calculated-field cross-folder references.** A
calculated field's formula can name items in a folder other than the map's other columns, and
Discoverer's real query engine would pull in that folder too. Attributing that requires parsing
free-text formulas to resolve the item ids they reference (`0x00e4`/`source_attrs`, not a plain
FK) — out of scope for a count-only baseline. This can only ever *add* folders to a map's set,
so it can only move maps from single→multi-folder, never the reverse; the true multi-folder
count is **341 or higher**, never lower.

### Of the 341, exactly 271 are disconnected — confirming the research, not the two prompts

```sql
-- joins table: 10 rows, left_folder_id / right_folder_id
-- for each multi-folder map, restrict the 10 edges to pairs where BOTH
-- endpoints are in the map's own folder set, then union-find over that
-- induced subgraph; connected iff one component spans the whole set
```

(Computed in the same session as the query above, via union-find over each map's induced
subgraph — not a single SQL statement; see §"Method" above.)

| | Count |
|---|---|
| Multi-folder maps whose folder set is connected by the 10 known joins | **70** |
| Multi-folder maps that are NOT connected by any of the 10 joins (hit the disconnection refusal) | **271** |

**271 of 341 exactly matches `legacy-analysis.md` §1.11 step 1** ("271 of 341"). This is now
the confirmed, measured population Phase 3.2 can help (70) and cannot (271). Adding predicates
to the 10 existing joins cannot connect a map whose folders were never joined in Discoverer.

Maps declaring join usage in the container (tag `0x0127`) — **[SOURCE]**, `24`, per
`EUL_SCHEMA_GROUND_TRUTH.md:1019`/`:1157` `[DUMP] 24/0`. 24 is much smaller than 70 because the
container tag only fires when a query *request* explicitly forces a join; the other ~46 of the
70 connected maps get their join implicitly, because a BFS spanning tree over the 10 joins
happens to already connect their (disjoint, unforced) folder references.

### Conditions: **5 605 and 3 395 are both correct — different populations**

```sql
SELECT count(*) FROM map_conditions;                              -- 5605
SELECT count(*) FROM map_conditions WHERE group_id IS NULL;       -- 5605 (100%)
```

| | Count |
|---|---|
| `map_conditions` rows in the target DB | **5 605** |
| ...with `group_id IS NULL` | **5 605 (100%)** |

**5 605 is the target-DB row count** — one row per *leaf* predicate after the importer
flattens each source condition tree. **3 395 is the source-side count of condition trees**
in the corpus (`legacy-analysis.md` §7.5, container-derived via the `0x00ff` token-tree
decode) — a tree with an AND/OR of several leaves becomes several `map_conditions` rows. The
ratio (5 605 / 3 395 ≈ 1.65) is consistent with the measured depth distribution below: most
trees are single-leaf (contribute 1 row), the rest contribute 2 or more.

**D-072 is measured as NOT fixed in this live database**, contradicting its `FIXED` status in
`DECISION_REGISTER.md`: every one of the 5 605 rows has `group_id IS NULL` — 0%, not partially
populated. Either the write-path fix (commit `c58a770` era) was never re-run against this
target database, or the fix does not do what the register claims. This stage records the
discrepancy; fixing it is out of scope here.

Depth distribution — **[SOURCE]**, measured over the 3 395 source trees
(`legacy-analysis.md` §7.5, `EUL_SCHEMA_GROUND_TRUTH.md:527-540`), **not** re-derivable from
the DB because `group_id` is 100% NULL (no nesting survives import):

| Depth | Share | Instances |
|---|---|---|
| 0 | 92.6% | 3 144 |
| 1 | 7.3% | 248 |
| 2 | — | 7 |
| ≥3 | — | 0 |

D-072's claim ("a `negated` boolean covers the entire measured corpus") was measured over
3 395, which **is** the full source population of condition trees — the 5 605 figure is a
different, later-stage population (flattened target rows), not a subset that was excluded.
The "~2 210 gap" the prompts worried about is exactly the extra leaf rows the flattening
step produces; it does not mean 2 210 conditions were dropped from the depth measurement.

---

## 2. Everything else measured

### Users and grants

```sql
SELECT count(*) FROM users;                                              -- 19
SELECT count(*) FROM users WHERE role = 'ADMIN';                         -- 1
SELECT count(*) FROM users WHERE role != 'ADMIN';                        -- 18
SELECT count(*) FROM users WHERE is_role = true;                         -- 3
SELECT count(*) FROM users WHERE is_role = false AND must_change_password = true;  -- 14
SELECT count(*) FROM users WHERE is_role = false AND must_change_password = false; -- 2
SELECT count(*) FROM user_business_area_grants;                          -- 60
```

| | Count |
|---|---|
| Total users | **19** |
| Admins (`role = 'ADMIN'`) | **1** |
| Non-admins (`role != 'ADMIN'`) | **18** |
| ...of which Oracle role principals (`is_role = true`, cannot log in) | **3** |
| Real (non-role) accounts still needing first-login credential reprovisioning (`must_change_password = true`) | **14** |
| Real accounts already reprovisioned (`must_change_password = false`) | **2** |
| Grants migrated (`user_business_area_grants`) | **60** |
| Grants in source | **[SOURCE] 138** (`codebase-inventory.md:224`, D-073) |

**18 (`PHASE-06-02`) matches exactly** — non-admin by role, measured.

**17 (`PHASE-09-03`'s "17 migrated users") matches nothing measured.** There is no `source =
migration` column on `users`; the closest real populations are 18 (non-admin), 15 (non-admin
excluding the 3 role principals), and 14 (still pending first-login reprovisioning right now —
this number moves every time someone logs in for the first time, since it flips
`must_change_password` to false). The cutover runbook should say **14, measured at the time
cutover begins, not a static 17** — this is a runbook that must re-run the query, not quote a
literal.

### Formulas, hierarchies, layouts

```sql
SELECT count(*) FROM map_calculated_fields;                       -- 49819
SELECT count(*) FROM hierarchies;                                 -- 0
SELECT count(*) FROM map_layouts;                                 -- 24
SELECT count(*) FROM maps;                                        -- 923
SELECT count(*) FROM map_items WHERE agg_function IS NOT NULL;    -- 0
SELECT count(*) FROM maps m WHERE NOT EXISTS (
  SELECT 1 FROM map_items mi WHERE mi.map_id = m.id AND mi.sort_order IS NOT NULL
);                                                                  -- 186
```

| | Count |
|---|---|
| `map_calculated_fields` total (target DB) | **49 819** |
| Calculations in source, deduped per worksheet | **[SOURCE] 41 982** (`legacy-analysis.md:1436`, `[DUMP]` 41 982/41 982) |
| Hierarchies migrated | **0** |
| Hierarchies in source | **[SOURCE] 508** (D-073/D-074) |
| `map_layouts` rows | **24** |
| `maps` rows | **923** |
| `map_items.agg_function` non-null | **0** — 3.1's before-picture and 3.3's inertness check, confirmed at zero |
| Maps with no sort at all | **186** |

49 819 vs 41 982 is not a contradiction: 41 982 dedupes one calculation per *worksheet* across
the whole corpus; 49 819 is the flat `map_calculated_fields` row count, one row per
(map, calculation) — a calculation reused across N worksheets counts N times here and once in
the source figure. 49 819 > 41 982 is the expected direction for that difference.

**`map_layouts` (24) against `maps` (923) is 5.4's gate, measured now: 899 maps have no
layout row**, despite the schema comment's expectation of "one row per map, or none: a map
built in Neo that never came from a worksheet has no layout row" — nearly every migrated map
(which by definition came from a worksheet) is currently missing one. This is the gap 5.4
closes; this stage only records its current size.

---

## 3. Counts that could not be fully measured, and why

- **"17 migrated users" (D-094 population)** — no schema column marks provenance
  (migration vs. direct creation). See above; recommend the runbook query the live count at
  cutover time instead of asserting a literal.
- **Multi-folder maps including calculated-field cross-folder references** — would require a
  formula-AST resolver to attribute `0x00e4` item references to folders; not built. The 341
  figure is a floor, not necessarily the ceiling.

---

## Handover

- `docs/master-plan/research/baseline-counts.md` — this file
- Headline counts also recorded in `MASTER_PLAN_REVIEW_CHECKPOINT.md`
- Prompts updated to reference this file instead of literals: `PHASE-01-01`, `PHASE-03-02`,
  `PHASE-05-03`, `PHASE-06-02`, `PHASE-09-03`
