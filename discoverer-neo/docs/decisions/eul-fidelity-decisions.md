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

## Decision 2a — a hierarchy's business area is derived, in four hops

**Discoverer.** `HIERARCHIES` has no business-area column, and never had one.
A hierarchy is EUL-scoped: it is a sibling of a business area in the export
DTD, not a child. Its business area is a property of the items its levels
name.

**Neo.** `hierarchies.business_area_id` is a single `NOT NULL` column.

**Decision.** Derive it:

```
HI_NODES -> IG_EXP_LINKS (IEL_TYPE='HIL') -> EXPRESSIONS.IT_OBJ_ID -> BA_OBJ_LINKS
```

and where a hierarchy reaches more than one business area, **take the
root-most level's**, because a drill path is entered at its root. Every other
one it reaches is recorded on the read model and raised as
`HIER_SPANS_BUSINESS_AREAS` — not dropped.

**Why not many-to-many.** Decision 1 made *folders* many-to-many because a
folder genuinely is shared across business areas on this estate. A hierarchy
is not: measured across all 508, 491 reach exactly one, 17 reach none, and
**none reaches two**. A second table to model a case that does not occur is
cost without a reader. The rule exists so that an estate where it does occur
is handled by a decision rather than by whichever row Oracle returned first.

**The same four hops carry the item.** `HI_NODES` has no item column either —
no `HN_EXP_ID`, no `HN_IT_EXP_ID`. Before this, every one of the estate's
2 510 hierarchy levels read as item-less. Now all 2 510 resolve.

---

## Decision 2b — date hierarchies are regenerated, not imported

**Discoverer.** A **date hierarchy** (`HI_TYPE = 'DBH'`) is a *template*: four
levels — Year, Quarter, Month, Day — that an administrator applies to a date
item. Applying it makes Discoverer auto-generate an item hierarchy
(`HI_TYPE = 'IBH'`, `HI_SYS_GENERATED = 1`, `IBH_DBH_ID` pointing back at the
template) plus the `EUL_DATE_TRUNC` items behind it.

**What this estate actually holds.** All 508 hierarchies are date machinery:

| | Count | |
| --- | ---: | --- |
| `DBH` templates, author-made | 6 | all four levels: Year, Quarter, Month, Day |
| `IBH` instances, `HI_SYS_GENERATED = 1`, `IBH_DBH_ID` set | 502 | one per date column |
| **Hand-authored item hierarchies** | **0** | — |

**Decision.** Import none of them. Neo regenerates a date drill path from the
date item itself; importing 502 machine-stamped copies of the same four levels
would carry the mechanism rather than the meaning, and would tie every date
drill to whichever template happened to be applied in 2001.

Each skip is **counted and named** — `HIER_DATE_TEMPLATE` for the 6,
`HIER_SYSTEM_GENERATED` for the 502 — and declared in
`migrate/src/verify/expected-loss.ts`, where the reconciliation seam asserts
the resulting zero. It is a decision, not a silent drop.

**What would change this.** `HI_SYS_GENERATED = 0` on an `IBH` row: a
hand-authored drill path. The resolver above is already in place for it, so
such a hierarchy migrates with its tree, its depths and its items intact. This
estate simply has none.

**Two things the source does not record.** `DBH_NODES` has no sequence column,
so a template's level *order* is not stored — the four levels come back in
`DHN_ID` order, which on this estate is `Year, Quarter, Month, Day` for one
template and the reverse for the other five. The natural date granularity is
the only available ordering. And `DBH_DEFAULT = 1` on exactly one of the six
marks the EUL's default template; nothing says what the other five are for.

**Performance, carried forward.** Oracle's own warning (`9.0.4` admin guide
p. 12-6): a date hierarchy on an indexed fact-table date column suppresses the
index, because every level becomes `EUL_DATE_TRUNC(col, …)`. A regenerated
date drill should emit a sargable `date_trunc`/`EXTRACT` instead. Phase 7.3.

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

## Decision 6 — formulas are rendered from the token tree, never re-parsed from the display form

**Discoverer:** stores a calculation or a condition as a token tree in
`IOFormula` — `[1,95]([1,58]([5,4,"20011201000000"]),[5,2,"200"])` — and stores
what it showed the user beside it in `DisplayFormula` —
`TO_DATE('01.12.01')-200`. Conditions and calculations are one language: same
five namespaces, same grammar, same parser.

**Neo:** compiles SQL **from the tree**. `DisplayFormula` is used only as an
oracle to check the result, never as an input.

**Why.** The display language is ambiguous and cannot be parsed back. A real
corpus line reads:

```
NVL(R Com Tx Com Vig/100,0)
```

`R Com Tx Com Vig` is a bare item name containing spaces, immediately followed
by `/`. Nothing can reliably tell where the name ends and the operator begins —
not a tokeniser, not a grammar, not a heuristic. An item name may also contain
brackets and commas. So the display form is a lossy projection of the tree, and
a renderer that consumed it would be guessing on every formula that has a
multi-word item name, which is most of them in this estate.

The tree, by contrast, is unambiguous by construction. `parseFormulaTree` reads
all 22 748 distinct corpus formulas with zero parse failures and zero unknown
nodes.

**What this bought.** Because the pairing is 1:1, `DisplayFormula` becomes a
*measurable* oracle rather than a second input: render the tree under a
hypothesis and ask whether Oracle's own text could have come out of it. That is
how Phase 4.1 fitted 42 of the 56 attested `[1,n]` codes — arity, fixity and
argument order — from evidence instead of from documentation that does not
exist for a product desupported in 2012.

**And the cost.** Every infix node is parenthesised unconditionally: `((a) OP (b))`,
which nests to `(((a) - (b))) * (c)`. Uglier SQL, and worth it — precedence only
matters when re-emitting un-parenthesised infix, so this removes the entire
operator-precedence problem rather than solving it. There is no precedence table
in Neo and none is needed.

**Where it stops.** Anything the evidence does not settle is refused with a
stated reason, never approximated (D-058) — an unfitted code, an unresolvable
element, a `[5,4]` date literal carrying a time. This is the same instinct that
maps `NOT IN` to null rather than to `IN`: migrating a negated filter as its
complement inverts it, and a reviewer looking at row counts would not notice.
A quarantined formula is a visible gap. A wrongly rendered one is a wrong number
in a report whose users have fifteen years of trained trust in it.

Measured against the aligned corpus (37 971 pairs from 547 workbooks):

| | weighted | distinct |
| --- | ---: | ---: |
| exact | 93.19 % | 93.55 % |
| refused, with a reason | 4.31 % | 3.88 % |
| mismatch the anonymiser explains | 2.47 % | 2.52 % |
| **mismatch nothing explains** | **0.03 %** | **0.04 %** |

The last row is the one that matters: 12 occurrences, and all twelve are the
comparator's own strictness rather than the renderer's reading. See
`docs/master-plan/checkpoints/PHASE_4.2_CHECKPOINT.md`.

---

## Decision 7 — a calculation that names another calculation is expanded at render time

**Discoverer:** a `[6,n]` leaf usually names a plain EUL item, but `n` is
sometimes another worksheet calculation. Oracle's own dump tool substitutes
*that calculation's formula* in place of the reference, recursively, so
`d4wkdmp` prints an `IOFormula` for a two-level chain with the whole tree
already spliced in.

**Neo:** stores the token string exactly as Discoverer stored it, references
and all, and expands the chain **when something is rendered** — never at
migration time (D-056).

**Why render time.** Expansion is a function of the tree plus the worksheet's
calculation set. Both are already in the database, so nothing is lost by
deferring it — and improving the renderer then never means re-migrating an
estate. Expanding on the way in would bake today's understanding into the
stored data, which is the mistake this whole phase's ordering avoids.

**What this resolved.** The differ compared the parser's stored tokens against
the dump's expanded `IOFormula` without expanding first, so every chain counted
as a disagreement. That is all 2 536 of WB-04's "formula disagreements": they
were Oracle's design being read as our defect. The differ now expands before
comparing, and reports what expansion did — how many references were
substituted, the deepest chain it walked, and any refusals by reason.

**The bounds are part of the decision, not an implementation detail.** The
reference graph comes from customer data, so traversal is bounded in three
directions before it walks anything:

- **A cycle is refused with the chain named** — `QUARANTINED(CALCULATION_CYCLE)`,
  never a stack overflow. An unhandled recursion in a request path is an
  availability defect, and a refusal that cannot say why is not much better than
  a crash.
- **Depth is capped** (16), and the deepest chain actually walked is *reported*,
  so the cap can be checked against what an estate really contains rather than
  defended as a guess.
- **Size is capped separately** (20 000 nodes), because depth alone does not
  bound the work. An acyclic diamond — `d` names `c` twice, `c` names `b` twice,
  `b` names `a` twice — is four deep and expands to eight leaves; twenty levels
  of it expands to a million. Substitution turns a DAG into a tree, and a tree
  is exponential in the DAG.

**Expansion produces nodes, never text.** It is not a splice path: the expanded
tree goes through `renderSql` exactly as an unexpanded one does, so identifier
validation, the allowlist and the bind discipline all still apply, once, in the
one place that owns them.

## What still needs a live EUL

These are open because no offline source answers them, not because they were
deferred. §4.2 of the ground-truth document has the full list; the ones that
bear on the decisions above:

- **`AP_PRIV_LEVEL`** — every migrated business-area grant lands at `VIEW`,
  and on this estate that is correct: a Discoverer business-area grant is
  binary, and what a user may *do* comes from the separate EUL-wide privilege
  rows. `AP_PRIV_LEVEL` is `1` on 6 of the 60 and no Oracle source says what
  that means; those 6 are flagged `GRANT_PRIV_LEVEL_UNMAPPED` for review.
  Decoding it is what would let Decision 3's roles carry differentiated
  permissions. (`GP_APP_ID` is answered: it appears only on EUL-wide
  privilege rows, which are not business-area grants.)
- **Condition rows** — no confirmed `EXP_TYPE` identifies one, so conditions do
  not migrate at all.
