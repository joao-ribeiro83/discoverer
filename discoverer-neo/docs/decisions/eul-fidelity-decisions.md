# Fidelity decisions: where Neo follows Discoverer, and where it doesn't

**Date:** 2026-08-20 · **Status:** implemented
**Context:** [`migrate/EUL_SCHEMA_GROUND_TRUTH.md`](../../migrate/EUL_SCHEMA_GROUND_TRUTH.md)

Correcting the EUL schema exposed places where Neo's own model disagreed with
Oracle Discoverer. Each is recorded here as a decision — what Discoverer does,
what Neo did, what Neo does now, and why.

The governing principle: **be faithful where fidelity carries user-visible
meaning or the migration would otherwise lose data; diverge deliberately, and
say so, where Neo can do better.**

---

## Decision 0 — item type labels were inverted (bug, not a design choice)

**Discoverer.** `EXPRESSIONS.EXP_TYPE` distinguishes `CO` — a *database item*
bound to a physical column via `IT_EXT_COLUMN` — from `CI`, a *created item*
(a calculation, date-hierarchy item, or complex-folder item).

**Neo, before.** Exactly backwards, in three places at once:

| Where | Said | Actually |
| --- | --- | --- |
| `admin.json` (×4 locales) | `co` = "Condition", `ci` = "Column Item" | `CO` = database item, `CI` = created item |
| `schema.ts` enum comments | `CO` = "calculated item" | ditto |
| `ItemsPage.tsx` form logic | `itemType === 'CI'` → show **column name** | `CI` is the calculation; it wants a **formula** |

The third was functional, not cosmetic: creating a calculation offered a column
field, and creating a column-backed item offered a formula box.

**Decision.** Fixed all three. `CO` now leads the type list and is the default
for a new item — it is the overwhelmingly common case in a real EUL. The form
branches on a named `COLUMN_BACKED_ITEM_TYPES` set rather than a bare string
comparison, so the next type that needs a column can be added in one place.

`CU`/`JI`/`HI`/`AG`/`FU` are kept but marked in the schema as **Neo-only**: no
confirmed `EXP_TYPE` produces them, and they exist for items authored in Neo.

---

## Decision 1 — folder ↔ business area is many-to-many

**Discoverer.** `BA_OBJ_LINKS` is a link table. Sharing one folder — a Time or
Organisation dimension — across several business areas is ordinary practice.

**Neo, before.** `folders.business_area_id`, a single `NOT NULL` column. The
migration kept the first link and discarded the rest **silently**.

**Options considered.**

1. *Leave it, document the limitation.* Cheapest; still loses data on every
   migration of a normal EUL, and loses it without saying so.
2. *Replace the column with a link table.* Most faithful. But
   `folders.business_area_id` is load-bearing across the SQL generator, grant
   checks, metadata cache keys and every admin route — a wide, risky change to
   a working query engine for a benefit most installs would not notice.
3. *Owning area + shares.* Keep `business_area_id` as the **owning** area, add
   `folder_business_areas` for additional memberships.

**Decision: option 3.** It eliminates the data loss, keeps every existing
query, cache key and permission check working untouched, and is reversible —
dropping the table degrades to today's behaviour rather than breaking.

The asymmetry is deliberate and has a real justification: Neo needs one
unambiguous owner for cascade-delete, permission inheritance and cache keying.
Discoverer has no such requirement because its folders are not owned at all.

**Implemented.**
- `folder_business_areas` (composite PK, both FKs cascade).
- `listByBusinessArea()` returns owned ∪ shared, each row flagged `isShared`.
- `shareWithBusinessArea()` refuses the owning area — that membership already
  exists, and duplicating it would list the folder twice.
- Routes: `GET`/`POST /api/folders/:id/business-areas`,
  `DELETE /api/folders/:id/business-areas/:baId`. The delete refuses the owning
  area (409) rather than orphaning a `NOT NULL` column.
- UI: a **Shared** badge in the folder table, and a sharing dialog where the
  owning area is shown but not removable.
- Migration: every `BA_OBJ_LINKS` row is preserved; a genuinely shared folder
  also raises `FOLDER_SHARED_ACROSS_BUSINESS_AREAS` so the operator sees it.

**Known limit.** A shared folder is still *edited* only from its owning area.
Discoverer has no owner concept, so this is a real divergence, not a bug.

---

## Decision 2 — hierarchies are a tree, not numbered levels

**Discoverer.** `HI_NODES` holds the nodes; `HI_SEGMENTS` holds parent/child
edges. Depth is a property of the walk, not a stored column, and the structure
can branch into alternate drill paths.

**Neo, before.** `hierarchy_levels` with `level_number NOT NULL`,
`item_id NOT NULL`, and `unique(hierarchy_id, level_number)`. Three
consequences: branching hierarchies were **impossible to represent** (two
siblings collide on the unique index); a node whose item didn't migrate was
**dropped**, silently shortening someone's drill path; and the tree shape was
lost even when it round-tripped.

**Decision.** Keep `level_number` — a linear drill path is what users actually
see, and every existing consumer reads it — but stop pretending it is the
source of truth:

- `parent_level_id` (self-referencing, nullable) records the real edge.
- `item_id` becomes **nullable**; an item-less level is kept and flagged
  (`HIER_LEVEL_ITEM_UNRESOLVED`) rather than dropped.
- The unique index becomes a plain index, so siblings can share a depth.

`level_number` is now *derived* by walking from the root and stored for
convenience. Unreachable nodes keep `depth: null` and are still emitted —
a cyclic or orphaned segment can never make a node disappear.

**Why not drop `level_number`.** A pure adjacency list would force every
consumer — the map builder's drill UI included — to walk the tree to render an
ordered path. Storing the derived depth alongside the edge costs one column and
keeps both readings cheap.

---

## Decision 3 — grantees can be database roles

**Discoverer.** `EUL_USERS.EU_ROLE_FLAG` marks a grantee as an Oracle **role**.
Granting to roles rather than individuals is the normal way to administer a
large EUL.

**Neo, before.** A role migrated into an ordinary `users` row with a synthesized
`@migrated.local` email. Two problems: it implies a person can sign in as
`SALES_ROLE`, and it makes the grant list read as if a user holds access that
is really held by a role.

**Decision.** Add `users.is_role`. A role is a **principal that holds grants and
cannot authenticate** — it keeps the login-disabled password hash all migrated
users get, plus an explicit marker so the UI and any future auth path can tell
the difference.

`GRANTEE_IS_DB_ROLE` is raised per role so the operator knows to assign real
users to it in Neo.

**Deliberately not done.** Real role *membership* (users belonging to roles,
with grants inheriting) is a larger identity-model change. Today a migrated
role carries its own grants and is visibly a role; who belongs to it must be
re-established in Neo.

---

## Decision 4 — folder types: Neo keeps a richer vocabulary

**Discoverer.** `OBJS.OBJ_TYPE` is only ever `SOBJ` (simple, over a base
table/view) or `COBJ` (complex, a join of others).

**Neo.** Offers `TABLE`, `VIEW`, `DERIVED`, `COMPLEX`, `JOIN`, `SUMMARY`.

**Decision: keep the richer set, but make it a choice rather than an accident.**
It was previously inherited from the fabricated reference, which claimed these
were EUL folder types. They are not. They are still useful — TABLE vs VIEW is
meaningful to a user even though the EUL never recorded it, and summary folders
are a genuine Discoverer concept (stored separately, in `SUMMARY_OBJS`).

The reader normalizes `SOBJ → TABLE` and `COBJ → COMPLEX`; anything else is
flagged as an unrecognised `OBJ_TYPE`. Assessment compares against the
*normalized* vocabulary — comparing against the raw codes flagged every folder
as anomalous.

---

## Decision 5 — a measure is named by the workbook, its aggregate by the EUL

**Date:** 2026-09-05 · Phase 3.1

**Discoverer.** Two facts, in two places, and neither file holds both.

The `.DIS` workbook says which items are measures. Its query request carries the
split as two literal vectors — `0x0123` axis, `0x0124` measure
(`EUL_SCHEMA_GROUND_TRUTH.md` §7.8.3). It is **given, not inferred** (D-031),
which is why nothing tries to guess it from a datatype.

The EUL says what to aggregate a measure with. `EXPRESSIONS.IT_FUN_ID` is the
item's **Default aggregate**, a foreign key to `FUNCTIONS` (§3.2). The `.DIS`
holds no per-item aggregate function at all; its one aggregate code (`0x0c1d`)
belongs to a *total*, which is a different and richer channel and lands in
`map_totals.agg_function`.

**Decision: read both, and write the aggregate only where the workbook says the
item is a measure.** That is legacy-analysis §3.4's precedence — the default
aggregate applies when the item is on the measure axis — so an axis column
projects its raw value and carries no aggregate even when its item names one.

Two consequences worth stating plainly, because both look like bugs and are not:

- **Most measures have no aggregate, and that is the source's answer.** `Detail`
  is Oracle's marker for *do not aggregate*, and 8 152 of the estate's items
  carry it; 353 more carry no default. 4 161 of 5 920 measure columns are
  therefore null. Defaulting them to `SUM` would replace a tracked gap with a
  wrong number — quietly, and in money.
- **The vocabulary is Neo's, not Discoverer's.** `agg_function` is constrained to
  `SUM|COUNT|AVG|MIN|MAX` or NULL, the set `lib/sql/formula-parser.ts` accepts.
  Oracle's `/aggregate` grammar has six values and `EDCBAggregateType` sixteen
  members. A name outside the five is not a label Neo displays; it is one
  `select-clause.ts` throws on, and one the fan-trap guard would read as a
  measure it cannot re-aggregate. Free text feeding a correctness guard is the
  hazard the CHECK closes.

**Why it mattered enough to be a phase.** The fan-trap guard's first step is
`if |M| = 0: flat plan, STOP`, and `M` is defined by aggregation. With
`agg_function` null on all 25 964 map items, every query classified as `|M| = 0`
and the guard would have shipped present, unit-tested and structurally inert.
`migration-verify`'s seam 5 now fails on that state rather than staying green.

---

## What still needs a live EUL

These are open because no offline source answers them, not because they were
deferred. §4.2 of the ground-truth document has the full list; the ones that
bear on the decisions above:

- **`GP_APP_ID` privilege codes** — every migrated grant currently lands at
  `VIEW`. Decoding the codes is what would let Decision 3's roles carry
  differentiated permissions.
- **`HI_NODES` item link** — probed as `HN_EXP_ID`/`HN_IT_EXP_ID`. If a real
  EUL spells it differently, Decision 2's levels arrive without items until the
  name is added.
- **Condition rows** — no confirmed `EXP_TYPE` identifies one, so conditions do
  not migrate at all.
