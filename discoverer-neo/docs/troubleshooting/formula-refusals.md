# Why a calculation was declined

A worksheet can run while one of its calculations does not. This page is about
that second kind of refusal: a single formula that came across from Discoverer
and could not be compiled.

For a whole worksheet that was not run, see
[Why a worksheet was declined](refusals.md).

A Discoverer calculation was not stored as text. It was stored as a tree of
numbered tokens, and Neo turns that tree into SQL. Where the tree says
something Neo cannot read with confidence, the calculation is **declined with a
reason** rather than compiled to a near-equivalent.

That rule is worth stating plainly, because it is the reason this list exists:

> A declined calculation is a visible gap. A wrongly compiled one is a wrong
> number in a report people have trusted for fifteen years.

Discoverer's own migration tools took the same line. `NOT IN` was never
compiled as `IN`, because that inverts the filter and produces a number that
looks perfectly reasonable and is wrong.

---

## The reasons

Each refusal carries one of these. They are listed most likely first.

### `UNFITTED_CODE`

**What it means.** The formula uses a built-in Discoverer function whose exact
form could not be established from the evidence.

Neo did not guess how these render. Every built-in it does compile was fitted
against 37 971 real formula pairs taken from your own workbooks — the stored
token tree beside the string Discoverer itself put on screen. A function that
never appeared in a pair Neo could read is refused rather than assumed.

**Which functions.** `CASE`, `WHEN`, `ELSE`, `IS NULL`, `IS NOT NULL`, `UPPER`,
`GREATEST`, and the analytic family (`FIRST_VALUE`, `OVER`, `PARTITION`,
`ORDER`, `ROW_NUMBER`, `NPASSORDERCOMP`).

**What to do.** Rewrite the calculation in Neo's formula editor. A `CASE` can
usually be written with `DECODE`, which is compiled.

### `UNRESOLVED_FUNCTION`

**What it means.** The formula calls a registered PL/SQL function, and no
matching function exists in Neo.

**What to do.** Register it under **Admin → Custom Functions**, matching the
name Discoverer used. See
[Custom Functions](../admin-guide/custom-functions.md).

### `UNRESOLVED_ELEMENT`

**What it means.** The formula refers to a column or a prompt that the workbook
no longer carries. The reference survived; the thing it pointed at did not.

**What to do.** Open the calculation and re-point it at a live column. This is
usually a Discoverer workbook that was edited after the column was removed.

### `INVALID_IDENTIFIER`

**What it means.** A column name, prompt name or function name that reached the
formula is not a legal Oracle identifier.

Neo rejects these instead of quoting them into safety. A name carrying a quote,
a semicolon or a bracket is either a metadata defect or an attempt to inject
SQL, and quoting it away would hide both.

**What to do.** Correct the name in **Admin → Metadata**. A package-qualified
function name (`PKG.CALC`) lands here too: register a single-name wrapper.

### `BAD_ARITY`

**What it means.** The number of arguments does not match anything Neo has
evidence for — for a built-in, any form seen in your estate; for a registered
function, the **Parameters** you defined for it.

**What to do.** For a registered function, check its parameter list is right.
For a built-in, the formula is likely damaged and should be rewritten.

### `UNREAGGREGABLE`

**What it means.** The calculation contains an aggregate that cannot be
re-totalled correctly across a join — `AVG`, `COUNT DISTINCT`, `STDDEV` or
`VARIANCE`.

Neo rewrites some queries to avoid double counting. These four cannot survive
that rewrite: an average of averages is not the average.

**What to do.** Move the aggregate up to the worksheet, or restrict the
worksheet to one folder so no rewrite is needed. The same reason on a whole
worksheet is covered in [refusals.md](refusals.md).

### `DATE_WITH_TIME`

**What it means.** A stored date carries a time, and Neo will not silently drop
it.

Dates in Discoverer are stored with six trailing digits for the time. Every one
of the 7 670 dates in this estate has them set to zero, so Neo compiles the
date and knows it has lost nothing. A date that did carry a time would be a
different value, and truncating it would change a result quietly.

**What to do.** Report it. This has not been seen in practice and Neo would
want to look at the workbook.

### `UNKNOWN_SEMANTICS`

**What it means.** The calculation uses a Discoverer feature whose result is
not visible in what Discoverer displayed, so there is nothing to derive the SQL
from.

In practice this is one thing: `2_Pass_Percentage`. Discoverer showed it as its
argument alone, so nothing in the evidence says what it actually computed.

**What to do.** Rewrite it as an explicit percentage calculation.

### `UNKNOWN_NODE`, `UNKNOWN_LITERAL_KIND`, `PARSE_FAILED`

**What it means.** The stored formula is not something Neo can read at all.

**What to do.** Report it with the workbook name. These indicate either a
Discoverer feature nobody has met yet or a damaged workbook, and Neo cannot
tell which without looking.

### `NOT_IN_ALLOWLIST`

**What it means.** The formula would generate a SQL function that is not on
Neo's list of functions it will emit.

**What to do.** Report it. Only a small, fixed set of Oracle functions may be
generated, and reaching this reason means a built-in was mapped to something
outside it — which is a defect in Neo, not in your metadata.

---

## What a refusal does *not* mean

- **It is not a data error.** Nothing about your data is wrong.
- **It does not hide the original.** The stored Discoverer token form is kept
  beside the compiled one, so a calculation declined today compiles the day the
  gap is closed, without re-running the migration.
- **It does not stop the worksheet.** Other columns still run.

---

**See Also:** [Why a worksheet was declined](refusals.md),
[Custom Functions](../admin-guide/custom-functions.md)
