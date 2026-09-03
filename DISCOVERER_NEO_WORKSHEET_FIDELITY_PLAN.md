# Worksheet Fidelity — Execution Plan

**Created:** 2026-08-25 · **Revised:** 2026-08-25 (after `d4wkdmp.exe` was made to run)
**Scope:** bring migrated maps up to what a Discoverer 4 worksheet actually holds.
**Background:** the workbook body (`EUL4_DOCUMENTS.DOC_DOCUMENT`) is already
decoded and migrating — see `discoverer-neo/migrate/EUL_SCHEMA_GROUND_TRUTH.md` §7.

---

## 1. What changed: we have Oracle's own decoder

`E:\claude\discoverer\DISCVR4\d4wkdmp.exe` — Oracle's workbook dump utility —
**now runs**, and dumps real workbooks out of the live EUL. This is the single
most important fact in this plan, because it turns the hardest task from
reverse engineering into *verification against a reference implementation*.

Getting there took seven missing DLLs and four environment variables; the exact
recipe is §2. Two structural discoveries came out of it:

- **`.DIS` files on disk are OLE compound documents** (magic `D0 CF 11 E0`).
  The `DOC_DOCUMENT` blob is the raw *inner stream*. That is why `FS` mode
  throws on a blob extracted from the database and **`DB` mode must be used**.
  (The parser was already reading the inner stream correctly — this only
  affects how the reference tool is driven.)
- The dump exposes an **`IoId`** for every element — the workbook-local element
  id. That is exactly the value the parser reads from tag `0x02bf`, so `IoId`
  is the **Rosetta stone**: it lets a dump line be matched to a byte offset,
  which is what makes field-by-field decoding tractable.

### 1.1 The reference output already validates the parser

Oracle's dump of `GD_M.M172_V01.DIS`, next to what the migration produced:

| Oracle `d4wkdmp` | Discoverer Neo (already migrated) |
| --- | --- |
| 6 `EUL Item Reference`, ids 241941–241946 | 6 `map_items`, same items, same order |
| `Identifier = NUC` / `Name = Nuc` | `items.name = 'Nuc'` |
| `Folder Name = M M172` | `folders.name = 'M M172'` |
| `Sheet Name = Folha 1`, GUID `{20F60964-…}` | map name, worksheet GUID |
| `IoId = 16, 24, 32, 40, 48, 56` | the `0x02bf` column→item references |

and on a calculation: `Id = -115` — **negative**, confirming the signed-id
handling that was added after the first live run.

### 1.2 What the dump gives us that we do not yet migrate

Straight from the reference output, per worksheet:

```
 EUL Sort Item Reference
        Item = EUL Item - M M172.Nuc
        Direction = 1
 Query Request QR1
        Distinct = 0
        Axis Item Usage    - Name = EUL Item - M M172.Nuc          ← axis vs measure
        Measure Item Usage - Name = Calculation - Profit SUM
        Sort Item Usage    - Name = Sort On …Nuc
        Filter Usage       - Name = EUL Filter - …
        Join Usage         - …
 EUL Private Item
        Id = -29860   Identifier = 223   DataType = 1
        Placement = 0   Hidden = 1   IsACalc = 1
        IOFormula = [2,20]([6,16],[6,17],[6,18],[5,1,"M"],…)
```

— i.e. **axis/measure classification, sort direction, `DISTINCT`, per-item
placement, hidden, data type, and the query-request grouping** (a sheet
references one or more `Query Request`s; two sheets can share one).

It also confirms the token language independently: `[2,20]` is a call to the
custom function at `IoId = 20`, which the dump names as
`GET_ATRIBUTOS_SINISTRO`.

---

## 2. Reproducible recipe for `d4wkdmp.exe`

**Verified working 2026-08-25.** Record this — it is not guessable.

**Files.** `E:\claude\discoverer\DISCVR4` must contain the original Discoverer
4 files plus these seven, which were missing (five came from `I:\orant\BIN`,
byte-identical):

```
SH31W32.DLL   std-2.1-vc5.0-mt.dll   thread-2.1-vc5.0-mt.dll   Cfx2032.dll
CORE40.DLL    NLSRTL33.DLL           ORA805.DLL
```

Do **not** copy the Oracle Net libraries (`N*80.dll`, `OTRACE80.dll`,
`nasns80.dll`) into that folder — mixing a partial Net8 set with the complete
one in `I:\orant\BIN` produced an access violation. Let them resolve from the
Oracle home via `PATH`.

**Environment.**

```powershell
$env:ORACLE_HOME = 'I:\orant'
$env:ORA_NLS33   = 'I:\orant\NLSRTL33\DATA'      # else ORA-12705
$env:NLS_LANG    = 'PORTUGUESE_PORTUGAL.WE8ISO8859P1'
$env:TNS_ADMIN   = 'E:\claude\discoverer\DISCVR4\tns'
$env:PATH        = 'E:\claude\discoverer\DISCVR4;I:\orant\BIN;' + $env:PATH
```

`TNS_ADMIN` holds a `tnsnames.ora` with the **current** host (the one in
`I:\orant\NET80\ADMIN` still points at the old `172.16.201.140`):

```
COSEC =
  (DESCRIPTION =
    (ADDRESS = (PROTOCOL = TCP)(HOST = 10.236.141.201)(PORT = 1530))
    (CONNECT_DATA = (SID = COSEC))
  )
```

**Invocation.** The working directory must be the Discoverer folder — the tool
loads `dceresUS.MSB` relative to it — and the mode must be `DB`:

```powershell
Start-Process -FilePath 'E:\claude\discoverer\DISCVR4\d4wkdmp.exe' `
  -ArgumentList '"GD_M.M172_V01.DIS"','out.txt','DB',"`"siid_testes/$pw@COSEC`"",'SIID_TESTES','-f' `
  -WorkingDirectory 'E:\claude\discoverer\DISCVR4' -NoNewWindow -Wait
```

`-f` adds the EUL cross-check (`*** Found in EUL by id ***`) and roughly
triples the output; use it.

**Credentials.** Decrypt the data source password transiently from the Neo
database — never leave it on disk:

```ts
// backend/src/scripts/<throwaway>.ts, run in the backend container
const [ds] = await db.select().from(dataSources).where(eq(dataSources.id, ID)).limit(1);
writeFileSync(OUT, decrypt(ds.passwordEnc), 'latin1');
```

Delete the file and the script afterwards. `*.pw` and `d4dumps/` are
git-ignored.

**Measured throughput.** 25 / 25 workbooks dumped successfully, ~18 s each
(process start and connection dominate). The full 558 is ≈ 2.8 h — run it as a
batch, once. Sample dumps are in `E:\claude\discoverer\d4dumps\` (ignored by
git — they are customer report metadata).

**Failure modes seen, and what they mean:**

| Symptom | Cause |
| --- | --- |
| `0xC0000135` at start | a DLL in the chain is missing |
| `0xC0000005` | mixed Oracle homes, or `NLS_LANG` unset |
| `ORA-12154` / `12222` / `12538` | `TNS_ADMIN` wrong, or the Net8 adapters are not on `PATH` |
| `ORA-12705` | `ORA_NLS33` not set |
| `dceresUS.MSB not found` | working directory is not the Discoverer folder |
| `0xE06D7363` (C++ exception) | `FS` mode on a raw DB blob — use `DB` mode |

---

## 3. Verdict: an extension, not a redesign

The container decode is solved and validated — 558/558 workbooks, 24 353 of
24 354 columns carrying an EUL `EXP_ID`, every condition operator recognized,
and now confirmed field-for-field against Oracle's own decoder. **Nothing built
so far should be thrown away.**

What is missing is (a) more fields inside elements the parser already locates,
(b) 13 element classes it currently walks past, and (c) — the only genuine
design change — **somewhere in Discoverer Neo to put any of it**. `map_items`
has no concept of an axis; `map_conditions` is a flat list and cannot express
Discoverer's filter tree; there is no table at all for totals, percentages,
exceptions or page setup.

### 3.1 Where we are

| | |
| --- | --- |
| Workbooks read | 558 |
| Worksheets → maps | 916 (one map per worksheet) |
| Columns (`map_items`) | 24 244 |
| Conditions (`map_conditions`) | 6 501 |
| Parameters (`map_parameters`) | 7 466 |
| Calculated fields (`map_calculated_fields`) | 11 801 |

Known losses: 837 condition instances (compound `AND`/`OR`, `NOT IN`), all
sort / axis / total / format information, and 110 columns naming items since
deleted from the EUL (unavoidable).

### 3.2 Element classes still ignored

| Class | Count | Reading |
| --- | ---: | --- |
| `0x0122`, `0x0258`, `0x0384`, `0x04b0`, `0x0d48` | **916 each** | *exactly one per worksheet* → layout / sort list / display settings |
| `0x0272` | 910 | ~one per worksheet |
| `0x0514`, `0x00f0` | 3 841 / 3 840 | ≈ parameter count — parameter detail |
| `0x0898` | 3 005 | likely exception / conditional-format ranges |
| `0x0578`, `0x05dc` | 2 017 each | paired, ~2 per worksheet |
| `0x0834`, `0x0190` | 558 each | *one per workbook* → page setup (`0x0840`–`0x0845`) |
| `0x0118` | 24 | **joins** (`0x0fa7`, `0x011a`, `0x0fa8`, `0x011b`) |
| `0x0320` | 104 320 | cell style (3 per column group) |

Plus unread numeric fields on `0x02bc` (column), `0x0c1c` (total) and
`0x00dc` (calculation: `0x00df`, `0x00e8`, `0x1000`, `0x1100`).

---

## 4. Task breakdown

| # | Task | Depends on | Model | Effort |
| --- | --- | --- | --- | --- |
| **W0** | Condition trees (`AND`/`OR`/`NOT`) | — | Opus 5 | high |
| **W1** | Reference corpus + parser/dump differ | — | Sonnet 5 | high |
| **W2** | Decode the rest, verified against the dumps | W1 | Opus 5 | high |
| **W3** | Neo schema for worksheet semantics | W2 | Opus 5 | high |
| **W4** | Layout: axis, measure, crosstab, hidden, distinct | W2, W3 | Opus 5 | high |
| **W5** | Sorting: direction, rank, group/break | W2, W3 | Opus 5 | high |
| **W6** | Totals, aggregations, percentages | W2, W3 | Opus 5 | high |
| **W7** | Item formats, page setup, joins | W2, W3 | Sonnet 5 | high |
| **W8** | Migration wiring + live re-import | W3–W7 | Opus 5 | high |
| **W9** | Query generation + UI + docs | W8 | Opus 5 | high |

**W0 goes first** — it needs no binary decoding (the tree is already in the
token form the parser reads) and it fixes the only known *correctness* loss:
837 conditions that silently do not filter.

**W1 before W2** — build the reference corpus and the differ first, so W2 is
verification rather than guesswork. W1 dropped from Opus/max to Sonnet/high
precisely because the reference tool now runs; W2 dropped from max to high for
the same reason.

W4–W7 are independent of each other and can run in parallel once W3 lands.

---

## 5. Task prompts

Self-contained; paste into a fresh Claude Code session in
`E:\claude\discoverer\discoverer-neo`. Every task ends with: `migrate`,
`backend` and `frontend` suites green, typecheck and lint clean on touched
files, and `EUL_SCHEMA_GROUND_TRUTH.md` updated with anything newly confirmed.

---

### W0 — Condition trees (`AND` / `OR` / `NOT`)

**Model:** Opus 5 · **Effort:** high · **Depends on:** nothing

> `migrate/src/services/workbook-parser.ts` decodes Discoverer workbook bodies
> out of `EUL4_DOCUMENTS.DOC_DOCUMENT`. Read
> `migrate/EUL_SCHEMA_GROUND_TRUTH.md` §7 first, especially §7.5 (the condition
> token language).
>
> Today a condition whose top-level operator is `[1,98]` (AND) or `[1,99]` (OR)
> is reported and **dropped** — `parseConditionTokens` returns `operator: null`
> and the runner skips it. On the live source that is 837 condition instances
> that silently do not filter. `NOT IN` (`[1,91]`) is dropped the same way.
>
> 1. Parse the token string into a real **tree**: `[1,op](arg, …)` where an arg
>    is another node, `[6,n]` (item element), `[8,n]` (parameter element) or
>    `[5,kind,"…"]` (literal). Handle nesting and quoted commas.
> 2. Measure the corpus before designing the target: how deep do the trees go,
>    what fraction are pure conjunctions? Write the numbers into the
>    ground-truth doc.
> 3. Neo's `map_conditions` (`backend/src/db/schema.ts`) is flat, with a
>    `group_id uuid` and a `logic_operator` enum. Decide whether that expresses
>    the trees actually present, or whether a `parent_id` self-reference is
>    needed. If the schema must change, write the Drizzle migration under
>    `backend/drizzle/` and mirror it in `migrate/src/db/schema.ts`.
> 4. Handle negation — Oracle's model has a per-node `IsNot`
>    (`DCBImportedFilterNode::IsNot` in `E:\claude\discoverer\DISCVR4\DCBIMPB.DLL`).
>    Never migrate a negated condition as its positive form.
> 5. Test via `migrate/src/testing/workbook-fixture.ts` (the encoder for the
>    same byte format). Report the new numbers.
>
> Keep the existing rule: an operator with no Neo equivalent is *reported*,
> never approximated.

---

### W1 — Reference corpus and parser/dump differ

**Model:** Sonnet 5 · **Effort:** high · **Depends on:** nothing

> Build the verification harness that every later task in this plan leans on.
>
> Oracle's own workbook decoder, `E:\claude\discoverer\DISCVR4\d4wkdmp.exe`,
> runs. **Read §2 of `E:\claude\discoverer\DISCOVERER_NEO_WORKSHEET_FIDELITY_PLAN.md`
> for the exact working recipe** — seven DLLs, four environment variables, `DB`
> mode not `FS`, working directory set to the Discoverer folder. It is not
> guessable; follow it literally. Sample output is in
> `E:\claude\discoverer\d4dumps\` (git-ignored; customer metadata — keep it
> that way).
>
> 1. **Dump the corpus.** Script the batch over all 558 workbooks in
>    `EUL4_DOCUMENTS` with `-f`, into `E:\claude\discoverer\d4dumps\`. Expect
>    ~18 s each, ≈ 2.8 h total — run it in the background and report the
>    success rate. Handle duplicate `DOC_NAME`s (they exist).
> 2. **Write a parser for the dump text** — it is regular: `EUL Item
>    Reference`, `EUL Private Item`, `EUL Filter Reference`, `EUL Sort Item
>    Reference`, `EUL Function Reference`, `Query Request QRn`, `Sheet Number
>    n`, each with indented `Key = Value` lines.
> 3. **Write the differ**: for each workbook, compare Oracle's dump against
>    `parseWorkbookDocument`. Correlate on **`IoId`** — the dump's element id is
>    the same value the parser reads from tag `0x02bf`. Report per field:
>    agree / disagree / only-in-dump / only-in-parser.
> 4. Land it as a **dev-only tool** (a script under `migrate/src/scripts/` or
>    similar), not a package export, and document how to run it. It must never
>    become a runtime dependency of the migration — it needs a 32-bit Windows
>    box and an Oracle 8 client.
> 5. Report the baseline: what the parser gets right today, and the exhaustive
>    list of fields present in the dump that it does not yet produce. That list
>    is the input to W2.

---

### W2 — Decode the rest of the worksheet model

**Model:** Opus 5 · **Effort:** high · **Depends on:** W1

> Extend the binary decoder in `migrate/src/services/workbook-parser.ts` to
> cover the worksheet model, **verifying every field against Oracle's reference
> dumps** using the differ built in task W1. Read
> `migrate/EUL_SCHEMA_GROUND_TRUTH.md` §7 (format, framing, the two integer
> fields already decoded) before starting.
>
> **Targets** — element classes present in the corpus and currently ignored.
> Five appear *exactly once per worksheet* (916), the signature of a layout /
> sort list / display-settings block: `0x0122`, `0x0258`, `0x0384`, `0x04b0`,
> `0x0d48`; then `0x0272` (910), `0x0514` (3 841), `0x00f0` (3 840), `0x0898`
> (3 005), `0x0578`/`0x05dc` (2 017 each), `0x0834`/`0x0190` (558 — per
> workbook), `0x0118` (24 — joins). Also unread: numeric fields on `0x02bc`,
> `0x0c1c`, and tags `0x00df`/`0x00e8`/`0x1000`/`0x1100` on `0x00dc`.
>
> **Fields to find** (the dump names them, so you know when you are right):
> axis vs measure usage, `Distinct`, `Placement`, `Hidden`, `DataType`, sort
> `Direction` and rank, the `Query Request` grouping and its link to sheets,
> aggregate function and placement on totals, item display width and alignment,
> join usage.
>
> **More evidence** — `E:\claude\discoverer\DISCVR4\DCBIMPB.DLL` exports
> Oracle's own class model (`DCBImportedSheet`, `DCBImportedItemSort`,
> `DCBImportedSummary`, `DCBImportedItemFormat`, `DCBImportedDisplaySettings`);
> extract the symbols with a regex over printable runs. `DCE.DLL`, `DCB.DLL`
> and `DIS4USR.EXE` carry the enum names (`EDCBAxisType`, `EDCBSortDirection`,
> `EDCBAggregateType`, `EDCBAggregateLocation`, `EDCBViewType`).
>
> **Deliverable.** Extend `EUL_SCHEMA_GROUND_TRUTH.md` §7 with, per class: its
> meaning, its fields (record type, tag, width, signedness, semantics) and the
> enum value tables — with confidence and evidence cited per field. A field you
> could not confirm goes in as *unconfirmed*, not guessed; that document's only
> value is that it is trustworthy. Land the decoding as a reader (extend
> `NUMERIC_TAGS` and the element model) with tests, even where nothing consumes
> it yet, and report differ agreement before and after.
>
> The format is **schema-driven** — the same record type byte means different
> widths under different classes — so resolve widths *per class* and keep the
> parser's resynchronizing behaviour: never advance by a width you are not sure
> of.

---

### W3 — Discoverer Neo schema for worksheet semantics

**Model:** Opus 5 · **Effort:** high · **Depends on:** W2

> Design and land the schema that can hold what a Discoverer 4 worksheet
> contains. Read `migrate/EUL_SCHEMA_GROUND_TRUTH.md` §7 (as updated by W2) for
> what has to be stored, and `backend/src/db/schema.ts` for what exists.
>
> Today `maps` + `map_items` + `map_conditions` + `map_parameters` +
> `map_calculated_fields` hold a flat column list and flat filters. They cannot
> express: a crosstab, which axis an item sits on, sort direction and rank,
> group/break sorting, totals and their placement, percentages, hidden items,
> `SELECT DISTINCT`, per-item display formats, page setup, or conditional
> formatting.
>
> Judgement calls that are yours, and must be written down:
> - Is `maps.map_type` (`TABLE | CROSSTAB | PAGE_DETAIL | CHART`) the right
>   home for `EDCBViewType`, or does layout need its own table?
> - Do axis and placement belong on `map_items`, or in a layout table?
> - Totals and percentages: one table with a kind discriminator, or two?
> - Discoverer's `Query Request` groups items and can be shared by two sheets.
>   Does Neo need that indirection, or does flattening per map lose nothing?
>
> Constraints:
> - Real Drizzle migrations under `backend/drizzle/` — do not hand-edit the
>   journal.
> - Mirror every new table in `migrate/src/db/schema.ts` and add it to
>   `TARGET_TABLES` / `TARGET_TABLE_ORDER` / `EMPTY_COUNTS`, and to
>   `migrate/src/testing/fake-writer.ts`.
> - Everything **nullable/optional**: a worksheet that uses none of it must
>   still migrate exactly as it does today.
> - Update `frontend/src/lib/types.ts` (`MigrationTable`) and the
>   `migration:tables.*` keys in **all four** locales; `node
>   scripts/i18n-check.mjs pt-PT es-ES fr-FR` must pass.
>
> Schema only — no parser or migration changes, existing suites still green.

---

### W4 — Layout: axis, measure, crosstab, hidden, distinct

**Model:** Opus 5 · **Effort:** high · **Depends on:** W2, W3

> Carry a worksheet's *layout* through the migration. Read
> `migrate/EUL_SCHEMA_GROUND_TRUTH.md` §7 and
> `migrate/src/services/workbook-parser.ts`.
>
> A worksheet is a table or a **crosstab** (`EDCBViewType`); its items sit on
> axes (`EDCBAxisType`) at a position, some are **hidden**, measures have their
> own position, and the sheet may be `SELECT DISTINCT`. Oracle's dump reports
> these as `Axis Item Usage`, `Measure Item Usage`, `Placement`, `Hidden` and
> `Distinct` — use the W1 differ to confirm every one.
>
> Extend `WorkbookColumn` / `ParsedWorksheet`, then `TransformedMapItem` /
> `TransformedWorkbook` in `migrate/src/services/transformers/`, then the
> runner (`migration-runner.ts`) and the re-import (`map-reimport.ts`) to write
> the columns W3 added. Build fixtures by extending
> `migrate/src/testing/workbook-fixture.ts` rather than hand-writing bytes.
>
> A worksheet whose layout cannot be decoded migrates exactly as it does today,
> with a warning — never a guessed axis.

---

### W5 — Sorting: direction, rank, group/break

**Model:** Opus 5 · **Effort:** high · **Depends on:** W2, W3

> Migrate worksheet sorting. Oracle's model is `DCBImportedItemSort`:
> **SortItem**, **SortDirection**, **Rank** (precedence) and **IsABreak** —
> group sorting, which the Discoverer 4i Plus User Guide documents as a
> distinct feature from simple table sorting and which these reports lean on
> heavily. The reference dumps show it as `EUL Sort Item Reference` with
> `Direction = n`, and `Sort Item Usage` inside each `Query Request`.
>
> `map_items` already has `sort_direction` and `sort_order` columns the
> migration has never populated; check what W3 added for break/group and use
> them. Wire parser → transformer → runner → re-import, with fixtures via
> `migrate/src/testing/workbook-fixture.ts`, and verify against the dumps with
> the W1 differ.
>
> Crosstab sorting differs from table sorting (`DCBViewMatrixSort` vs
> `DCBViewTableSort`). If only one is decodable, migrate that one and report
> the other.

---

### W6 — Totals, aggregations and percentages

**Model:** Opus 5 · **Effort:** high · **Depends on:** W2, W3

> Migrate worksheet totals. Oracle's model is `DCBImportedSummary`:
> **Function** (`EDCBAggregateType` — SUM/COUNT/AVG/MIN/MAX/…), **Label**,
> **MeasureItem**, **Placement** (`EDCBAggregateLocation`) and
> **PlacementItem** (total per group of X).
>
> The parser already finds the total elements (class `0x0c1c`, 19 319 in the
> corpus) and reads only their label (`0x0c21`) and a reference (`0x0fad`); W2
> decoded the rest. **Percentages are a separate Discoverer feature** (see
> `E:\claude\discoverer\4.1\Discoverer4iPlusUserGuide.pdf`, "Calculating
> Percentages") — establish whether they are a distinct element class or an
> aggregate type, and migrate them accordingly.
>
> This matters more than it looks: the source has whole worksheets named
> `… — TOTALIZADORES` whose entire content is totals. Wire parser →
> transformer → runner → re-import into the tables W3 added, with fixtures via
> `migrate/src/testing/workbook-fixture.ts`.

---

### W7 — Item formats, page setup, joins

**Model:** Sonnet 5 · **Effort:** high · **Depends on:** W2, W3

> Migrate the remaining worksheet detail, in value order:
> 1. **Item formats** (`DCBImportedItemFormat`) — display width, horizontal and
>    vertical alignment, word wrap, font style. The parser already locates the
>    format/font/style triple that follows every column (`0x0640` / `0x07d0` /
>    `0x0320`) and reads only the format mask.
> 2. **Page setup** (`DCBImportedDisplaySettings`) — left/center/right headers
>    and footers, margins, orientation, grid lines. Workbook-level class
>    `0x0834` already carries the header/footer strings (`0x0840`–`0x0845`).
> 3. **Joins** (`DCBImportedJoin`) — class `0x0118`, only 24 in the corpus
>    (`0x0fa7`, `0x011a`, `0x0fa8`, `0x011b`). Resolve to migrated `joins` rows
>    where possible; the dump reports them as `Join Usage`.
>
> Read `migrate/EUL_SCHEMA_GROUND_TRUTH.md` §7. Wire parser → transformer →
> runner → re-import into the columns W3 added, with fixtures via
> `migrate/src/testing/workbook-fixture.ts`. Anything undecodable is skipped
> with a warning, not defaulted.

---

### W8 — Migration wiring and live re-import

**Model:** Opus 5 · **Effort:** high · **Depends on:** W3–W7

> Bring the whole worksheet model through end to end and re-run it against the
> live source. Read `migrate/src/services/map-reimport.ts` (the maps-only
> re-import — a full re-migration is refused by design, one per database),
> `migrate/src/services/migration-runner.ts` and
> `docs/migration/migration-tool.md`.
>
> 1. Every field W4–W7 added must be written by **both** the full runner and
>    the re-import, and counted in `MapReimportCounts` / `TableCounts`.
> 2. Extend the assessment report (`migrate/src/services/assessment.ts`) so an
>    operator sees the new coverage before starting.
> 3. Surface the counts in `frontend/src/pages/MigrationPage.tsx` and all four
>    locales; `node scripts/i18n-check.mjs pt-PT es-ES fr-FR` must pass.
> 4. Dry-run against the live source, review, then run live. **Back up the map
>    tables first** (`pg_dump -t maps -t map_items …`) — the re-import deletes
>    and rebuilds every map in the "Migrated Workbooks" business area.
>    ```
>    docker compose exec backend npx tsx src/scripts/reimport-maps.ts <dataSourceId>
>    docker compose exec backend npx tsx src/scripts/reimport-maps.ts <dataSourceId> --live
>    ```
>    `migrate/` is not bind-mounted: `npm run build --workspace=migrate` and
>    redeploy first (see `docs/developer-guide/development.md`).
> 5. Report before/after counts, and spot-check several maps against Oracle's
>    reference dumps in `E:\claude\discoverer\d4dumps\`.

---

### W9 — Query generation, UI and documentation

**Model:** Opus 5 · **Effort:** high · **Depends on:** W8

> Make the migrated semantics *do* something — until now they are stored but
> unused.
>
> 1. **SQL generation** — `backend/src/lib/sql/` and
>    `backend/src/services/sql-generator.ts` must honour `SELECT DISTINCT`,
>    sort direction and rank (`ORDER BY`), group/break sorting, aggregate
>    totals, and hidden items (selected but not displayed when referenced by a
>    condition or sort).
> 2. **Rendering** — `frontend/src/pages/MapViewerPage.tsx` and
>    `MapBuilderPage.tsx` must render crosstabs, group breaks, totals rows and
>    per-item formats.
> 3. **Documentation** — `docs/migration/from-discoverer4.md` ("What Gets
>    Migrated"), `docs/migration/troubleshooting.md`, `docs/api/endpoints.md`,
>    `docs/user-guide/`, and the four locales. Say plainly what still does not
>    migrate.
>
> Large; if it needs splitting, split at the SQL/UI boundary and say so rather
> than half-doing both.

---

## 6. What will still not migrate

Be explicit with users, even after all of the above:

- **Graphs** — Discoverer's chart definitions. Neo has a `CHART` map type but
  no equivalent model.
- **Drill hierarchies** — depends on hierarchies migrating at all, which they
  do not: `EUL4_HIERARCHIES` has no business-area column and Neo requires one
  (`EUL_SCHEMA_GROUND_TRUTH.md` §4.2 item 6). Its own task.
- **Calculated field formulas as SQL** — they migrate as Discoverer's token
  language with item and parameter references resolved to names. Oracle's
  function-code table is not public; translating it would be guesswork. (The
  reference dump prints the same `IOFormula`, so it does not help here.)
- **Which worksheet used which condition** in a multi-worksheet workbook —
  Discoverer stores conditions per workbook and the file does not record the
  association.
- **Row-level security**, **scheduled reports**, **portlets**.
