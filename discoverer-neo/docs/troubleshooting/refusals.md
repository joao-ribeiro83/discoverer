# Why a worksheet was declined

A **refusal** is not a failure. It is the query planner saying it can build the
SQL, but cannot promise the number would be right — so it does not run it.

Discoverer refused the same shapes. A wrong number that looks right is worse
than no number.

This page is about a **worksheet** that was not run. A single migrated
calculation can also be declined while the worksheet around it runs normally —
those reasons are on
[Why a calculation was declined](formula-refusals.md).

A refusal shows as an **amber** panel with a title, a reason and a next step.
A red panel is a genuine error and means something different; see
[Executing Maps](../user-guide/executing-maps.md).

Neo tells you **before you press Run**: the builder classifies the worksheet as
you compose it, so a refusal appears on the canvas rather than after a round
trip to the database.

---

## These folders are not connected, so the worksheet was not run

**Code:** `NO_JOIN_PATH`

### What was asked

The worksheet uses columns from two or more folders, and no chain of joins
links them together.

### Why it cannot be answered

Without a join the database has no rule for pairing the rows. It would pair
every row of one folder with every row of the other — a **cross join** — and
return a row count that is the product of the two, with no meaning.

### What to change

- Remove the columns from the unconnected folder. The panel names which
  folders are involved.
- Or ask an administrator to define a join between them, under
  **Data Modeling → Joins**.

An administrator can check whether the join exists but was not migrated: some
Discoverer joins do not survive an EUL import if their folders were not both
in scope.

---

## These totals are measured against different things

**Code:** `FAN_TRAP_R1` · Discoverer's rule: *the detail folders use different
keys from the master for the join*

### What was asked

The worksheet totals values from two sets of detail rows, but each set is
joined to the main folder on a **different column**.

### Why it cannot be answered

Each total is worked out per value of the column its own join matches on. One
is counted per account id, the other per region. There is no shared column to
line the two totals up against, so putting them in the same row would place two
figures side by side that are not measured against the same thing.

### What to change

- Total values from **one** set of detail rows.
- Or ask an administrator whether both joins should match on the same column.
  The panel names the folders involved.

---

## These folders are joined in a circle

**Code:** `FAN_TRAP_R2` · Discoverer's rule: *there is a direct join
relationship between the detail folders*

### What was asked

Two detail folders are joined to each other **as well as** to the main folder.

### Why it cannot be answered

To total across a one-to-many join, each set of detail rows is summarised on
its own and the parts are then combined. When the two sets are also joined to
each other, there is more than one way to group the rows — and each way gives a
different number. Nothing in the worksheet says which one you meant.

### What to change

- Use columns from **one** of the two detail folders.
- Or ask an administrator which join the worksheet should follow. It may be
  that one of the three joins is not meant to be used together with the others.

---

## This worksheet lists individual values from two sets of detail rows

**Code:** `FAN_TRAP_R3` · Discoverer's rule: *non-aggregated values are chosen
from more than one of the detail folders*

### What was asked

The worksheet shows individual (non-totalled) columns from **two different**
sets of detail rows at once — a sales rep from one, a budget owner from the
other.

### Why it cannot be answered

This is the one refusal where the "wrong" answer is arguably the right one, and
that is exactly the problem. Totals across a one-to-many join can be repaired
because the detail rows are only ever *summarised*. The moment you list them
individually from two sets, the honest answer **is** every combination of the
two — six rows where you expected five. No rewrite can undo that, because
nothing was lost; there genuinely is no single list.

Discoverer stopped here rather than inventing one, and so does Neo.

### What to change

- **Total** the values instead of listing them. A total across the same two
  folders is answerable, and is what the planner will produce.
- Or show individual values from **one** set of detail rows, and totals from
  the other.
- Or split it into two worksheets.

---

## This worksheet fans out from more than one folder

**Code:** `FAN_TRAP_R4` · Discoverer's rule: *more than one detail folder has a
separate join relationship to a different master folder*

### What was asked

The worksheet has **two** folders that each act as the main one, each with its
own detail rows hanging off it.

### Why it cannot be answered

Detail rows are summarised against a single main folder, and the summaries are
then joined back together on that folder's key. With two main folders there are
two keys, and no single set of rows to measure either total against.

### What to change

- Split this into two worksheets, one per main folder.
- Or remove the columns that reach into the second one. The panel names both
  main folders.

---

## This kind of total cannot be worked out across a join

**Code:** `FAN_TRAP_REAGG`

### What was asked

The worksheet uses `AVG`, `COUNT DISTINCT`, `STDDEV`, `VARIANCE` or `MEDIAN` on
a value that has to be totalled across a one-to-many join.

### Why it cannot be answered

Each set of detail rows is summarised first, and the parts are combined
afterwards. That works for some totals and not others:

| Total | Works? | Why |
| --- | --- | --- |
| `SUM` | yes | sums of parts add up to the sum |
| `COUNT` | yes | counts of parts add up to the count |
| `MIN` / `MAX` | yes | the smallest of the smallests is the smallest |
| `AVG` | **no** | an average of averages is not the average |
| `COUNT DISTINCT` | **no** | the same value can appear in two parts and would be counted twice |
| `STDDEV`, `VARIANCE` | **no** | same reason as the average, with more arithmetic |

Oracle's documentation does not record how Discoverer handled these across a
fan. Neo refuses rather than guessing: a guessed answer here is a wrong number
that looks right.

This is **ordinary**, not an edge case — the migrated estate carries 282
`COUNT DISTINCT` totals.

### What to change

- Use `SUM`, `COUNT`, `MIN` or `MAX`.
- Or put this total on a worksheet that uses **one folder only**, where the
  aggregate is computed directly and every one of the above works.
- For a distinct count across folders, an administrator can add a calculated
  item in the folder itself that already carries the distinct value.

---

## Not a refusal: what changes on a worksheet that was rewritten

A worksheet that summarises detail rows from a one-to-many join is **rewritten**
rather than refused. Each set of detail rows is summarised on its own first, and
the parts are combined afterwards, so nothing is counted twice.

The rows you get back are correct. Two smaller things behave differently, and
neither is an error:

- **Totals are left blank.** A total re-runs the worksheet's own join without
  its grouping, and that join is the one that would inflate the answer. See
  [Executing maps](../user-guide/executing-maps.md#why-some-totals-come-out-blank).
- **A sort on a column you have hidden is dropped.** The rewritten worksheet can
  only sort on columns it actually shows. Show the column to sort by it.

If you need a total, put it on a worksheet that uses one folder.
