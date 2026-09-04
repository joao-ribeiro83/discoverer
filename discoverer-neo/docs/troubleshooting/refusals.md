# Why a worksheet was declined

A **refusal** is not a failure. It is the query planner saying it can build the
SQL, but cannot promise the number would be right — so it does not run it.

Discoverer refused the same shapes. A wrong number that looks right is worse
than no number.

A refusal shows as an **amber** panel with a title, a reason and a next step.
A red panel is a genuine error and means something different; see
[Executing Maps](../user-guide/executing-maps.md).

Phase 3.3 will extend this page as the query planner gains new checks.

---

## This total cannot be trusted yet, so it was not run

**Code:** `MULTI_FOLDER_AGGREGATE`

### What was asked

The worksheet totals a value — `SUM`, `AVG`, `COUNT`, `COUNT DISTINCT` — over
columns that come from more than one folder.

### Why it cannot be answered

The folders are joined one-to-many. Each row on the "one" side is repeated once
for every matching row on the "many" side. Summing after that join counts the
same value once per repeat, so the total comes out too high.

This is called a **fan trap**. Oracle's own worked example puts the inflation
at two to three times, on two measures at once. Nothing on the screen would
tell you the number was wrong.

### What to change

- Total a value from **one folder only**. Remove the columns that reach into
  the second folder, or drop the total.
- Or split the worksheet in two, one per folder.
- Or keep the detail rows and total them outside the product.

Multi-folder totals become available when the fan-trap planner ships
(Phase 3.4). Nothing about your worksheet needs to change for that — the same
worksheet will simply start returning a correct number.

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
