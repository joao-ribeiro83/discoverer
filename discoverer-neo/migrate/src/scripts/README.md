# Verification harness for the workbook parser

Dev-only tools. **None of this is imported by the migration** — nothing here
is exported from `@discoverer-neo/migrate`'s package entry points (`.` /
`./testing`), and it needs things the migration never depends on: a 32-bit
Windows host and Oracle 8 client (`DISCVR4/d4wkdmp.exe`) for the corpus dump,
and a live connection to the source EUL for the differ. See
`DISCOVERER_NEO_WORKSHEET_FIDELITY_PLAN.md` (task W1) for why this exists —
every later worksheet-fidelity task is checked against this harness's report
rather than trusted on inspection.

## What's here

| File | What it does | Runs where |
| --- | --- | --- |
| `dump-corpus.ps1` | Batch-drives `DISCVR4\d4wkdmp.exe -f` over every workbook in a live EUL | Windows host |
| `../services/d4wkdmp-dump-parser.ts` | Parses `d4wkdmp -f` text output into structured entries | anywhere (pure) |
| `../services/d4wkdmp-differ.ts` | Compares a parsed dump against `parseWorkbookDocument`'s output for the same bytes | anywhere (pure) |
| `diff-corpus.ts` | CLI: reads dumped `.txt` files + live `DOC_DOCUMENT` bytes, runs the differ, prints an aggregate report | needs Oracle (Node + `oracledb`) |

## 1. Dump the corpus

Needs `E:\claude\discoverer\DISCVR4` set up per the plan's §2 recipe (seven
extra DLLs already in place — this script does not install them) and two
inputs, both produced from inside the **backend** container (it already has
`decrypt()` and a live Oracle connection to the data source):

```bash
docker compose exec backend npx tsx src/scripts/list-eul-documents.ts <dataSourceId> > /path/to/d4dumps/_manifest.json
docker compose exec backend npx tsx src/scripts/export-datasource-password.ts <dataSourceId> eul-dump.pw
```

The second command writes the password to the bind-mounted `credentials/`
directory (`docker-compose.dev.yml`'s `CREDENTIALS_DIR`), so it lands at
`discoverer-neo/credentials/eul-dump.pw` on the host — where `dump-corpus.ps1`
expects it.

Then, on the host:

```powershell
powershell -File migrate/src/scripts/dump-corpus.ps1 -Limit 5   # validate first
powershell -File migrate/src/scripts/dump-corpus.ps1            # then the full corpus
```

Idempotent: a workbook that already has `d4dumps\<docId>.txt` is skipped, so a
killed run can just be re-invoked. Every attempt is logged to
`d4dumps\_dump-run-log.jsonl`. The password is read into memory once and the
on-disk file is deleted immediately after — regenerate it if the run is
interrupted before it finishes.

**`export-datasource-password.ts` is a throwaway — deleted after use, not in
this repo.** It writes a live database password to disk in plaintext, so it
was removed (and the `.pw` file with it) once the corpus dump and the diff
run below no longer needed it. Recreate it if a future session needs the
password again — a few lines, following `list-eul-documents.ts`'s own
connection pattern in this same directory:

```ts
// backend/src/scripts/export-datasource-password.ts — THROWAWAY, do not commit.
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { dataSources } from '../db/schema.js';
import { decrypt } from '../lib/encryption.js';
import { credentialsDir } from '../services/credential-file.service.js';

const [ds] = await db.select().from(dataSources).where(eq(dataSources.id, process.argv[2]!)).limit(1);
await writeFile(join(credentialsDir(), process.argv[3]!), decrypt(ds!.passwordEnc!), { encoding: 'latin1', mode: 0o600, flag: 'wx' });
```

Run the same way: `docker compose exec backend npx tsx src/scripts/export-datasource-password.ts <dataSourceId> <fileName>`,
then delete it again once done. `list-eul-documents.ts` is NOT a throwaway
— it's read-only and carries no secret, kept alongside the other
`backend/src/scripts/*.ts` diagnostics.

## 2. Diff the corpus

`diff-corpus.ts` connects to Oracle **directly** (migrate's own
`services/oracle-client.ts`, not the backend's pool) — a plaintext password
file is enough, no `decrypt()` needed:

```bash
npx tsx src/scripts/diff-corpus.ts \
  --manifest /path/to/d4dumps/_manifest.json \
  --dumps-dir /path/to/d4dumps \
  --password-file /path/to/a-plaintext-password-file \
  [--limit N] [--report /path/to/report.json]
```

Only workbooks that already have a `.txt` dump are diffed, so this can be
re-run against a partial corpus while `dump-corpus.ps1` is still going in the
background.

### Offline: `--bytes-dir`

`--bytes-dir <path>` replaces `--password-file` and reads each workbook's bytes
from `<docId>.bin` on disk instead of from Oracle. Export the corpus once and
every later run needs no live source, no password and no thick-mode client —
which is how W2's before/after numbers were produced without holding a
connection to a customer database open for a day's work. A throwaway exporter,
run in the backend container the same way `list-eul-documents.ts` is:

```ts
// backend/src/scripts/export-workbook-bytes.ts — THROWAWAY, do not commit.
// Same connection preamble as list-eul-documents.ts, then, per DOC_ID:
const r = await connection.execute(
  `SELECT DOC_DOCUMENT FROM ${owner}.EUL4_DOCUMENTS WHERE DOC_ID = :id`, { id },
  { outFormat: 4002 });
writeFileSync(join(outDir, `${id}.bin`), r.rows[0].DOC_DOCUMENT);
```

The exported blobs are **customer report bodies** — keep them out of the repo
and off shared storage, and delete them when the run is done, exactly as
`d4dumps/` is treated. If the source needs Oracle Thick mode (pre-11g password verifier —
true for the 4.1/Oracle 8 source this was built against, `NJS-116` otherwise),
set `ORACLE_THICK_MODE=true` and `ORACLE_CLIENT_PATH` the same way the backend
does; the script checks the same two env vars.

This tool has no filesystem access to `d4dumps\` from inside a container (it
is not bind-mounted, deliberately — customer report metadata never needs a
mount). Running it from the backend dev container means copying the dumps in
first: `docker compose cp <d4dumps dir> backend:/tmp/d4dumps`, pointing
`--dumps-dir`/`--manifest` at `/tmp/d4dumps`, then removing that copy when
done (`docker compose exec backend rm -rf /tmp/d4dumps`).

### Correlation

- **`EUL Item Reference`** and **`EUL Function Reference`** carry an `IoId` in
  the dump — the only two classes the token language addresses by numeric id
  (`[6,n]` / `[2,n]`) — which is exactly the raw element's own sequential `id`.
  Exact, structural correlation.
- **`EUL Private Item`** (calculations) carries no `IoId`, but its `Id` field
  is the same `0x00dd` tag an item uses for its `EXP_ID` — just negative,
  since a calculation has no `EXPRESSIONS` row of its own — read directly
  rather than through `workbook-parser.ts`'s own `itemSourceId()` (which
  treats negative as absent, correctly, for its own callers). Exact per
  calculation; name is a fallback only for the rare element missing that
  field.
- **`EUL Private Filter`** (conditions) now correlate on `0x00fb`, the
  condition's own negative synthetic id — the same idea as the calculation key
  above, and what the dump prints as the filter's `Id`. That matches **3 331 of
  3 331** where name matching found 3 299. Name is the fallback.
- **`Parameter`** carries no id at all — Discoverer addresses those by name
  within a query — and is still correlated **by name**, best-effort. See the
  findings below before trusting a disagreement here.
- **`EUL Sort Item Reference`** and **`Query Request QRn`** correlate **by
  document position**: the dump prints them in element order and numbers query
  requests `QR1`, `QR2`, … accordingly.
- **`EUL Join Reference`** correlates on the EUL join id it prints as `Id`.
- Sheets correlate by position (`Sheet Number n` ↔ worksheet index `n-1`).

## Corpus dump results (2026-08-25)

558 workbooks in `EUL4_DOCUMENTS`; **544 dumped successfully (97.5%)**, all in
one background `dump-corpus.ps1` run, ~18s/workbook, 2h32m total. The 14
failures are a genuine Oracle-side error, not an environment problem:
`DCEException — Erro Interno da EUL: InvalidID — Falha ao tentar encontrar
elemento da EUL por id` ("failed trying to find an EUL element by id") — all
14 are orphaned alternate-named copies (`M65_V172`, `M04A_V022`, ... — no
`GD_`/`.DIS` decoration, unlike the other 544), consistent with dangling
internal references the live tool itself cannot resolve. `dump-corpus.ps1` is
idempotent, so re-running it would only retry these 14 and report the same
error rather than making progress — nothing to fix on this side.

## Findings from the full run (544/558 workbooks, 2026-08-25)

- **Items agree 99.9%** (29 591 / 29 611) on every field the parser produces,
  and **custom functions 100%** matched / 99.7% name-agree — the validation
  the plan's §1.1 called out, holding at full corpus scale. The few
  exceptions are worth naming rather than rounding away:
  - One workbook (`GD_M.M65_V13`) has every `IoId` the dump prints running
    exactly **one less** than the parser's element id for the same item
    (`IoId=1287` ↔ `element#1288`, `IoId=1299` ↔ `element#1300`, ...,
    consistently, only in that one file) — some earlier element in that
    specific workbook throws the two tools' numbering out of step by
    exactly one. Not chased further here; worth a look if `GD_M.M65_V13`
    specifically is ever migrated and spot-checked.
  - One workbook (`GD_M.M202_V02.DIS`) prints **zero** `EUL Item Reference`
    entries in the dump at all, while the parser found 60+ item elements —
    looks like every item this workbook shows has since been deleted from
    the EUL, and `-f` mode omits the reference entirely rather than printing
    a "not found" one (contrast with the ordinary case, where a deleted
    item's reference still prints with `*** Owning Folder not found ***`).
  - The 2 function-name disagreements both carry a parser-side name with a
    trailing `1` the dump's name lacks (`FUN_NUM_ENT_GRUPO1` vs
    `FUN_NUM_ENT_GRUPO`) — plausibly the `-f` EUL cross-check substituting
    the canonical catalog name where the workbook's own copy carries a
    local disambiguating suffix, the same shape as the calculation-name
    finding below but for custom functions instead.
- **Calculation names were not unique within a workbook, and the parser's
  dedup-by-name silently dropped the rest — fixed 2026-08-27.**
  `workbook-parser.ts`'s `collectCalculation` used to keep only the first
  `EUL Private Item` seen for a given name per worksheet. Across all 544
  dumped workbooks, a 95-workbook sub-sample showed 79% of entries sharing a
  name with another in the same workbook (typically the same calculation
  redefined once per month/period column with a different embedded literal
  date), 98% of those with a genuinely different formula — `map_calculated_
  fields` was losing most of a calculation's per-column variants, keeping
  only whichever came first. Dedup is now by element id, with a colliding
  name disambiguated as `"NAME #<elementId>"`; full writeup in
  `EUL_SCHEMA_GROUND_TRUTH.md` §7.7.

  **Verified against the live corpus.** The differ's own calculation
  correlation was upgraded to match: it now correlates on the calculation's
  negative synthetic id (`0x00dd`, the same field an item's `EXP_ID` uses,
  just negative — exact and unique, same idea as `IoId`) rather than name
  alone, since a name can now legitimately belong to several distinct
  calculations. Re-running the full 544-workbook corpus:
  `ioFormula` agreement went from **24.7% to 93.9%** (38 727 agree / 2 536
  disagree of 41 263 matched), and every one of the 38 727 exact-id matches
  agrees with zero exceptions. The residual 2 536 are, sampled and confirmed,
  entirely the *separate* still-open finding below (a calculation that
  references another calculation) — not a regression. Every other section
  (items, functions, private filters, parameters, sheets) came back
  numerically identical to the pre-fix run.
- **A calculation can reference another calculation, and the dump silently
  resolves it while the parser does not — still open, by design.** Oracle's
  dump recursively expands a calculation that references *another
  calculation* (`[6,n]` where element `n` is itself an `0x00dc` `EUL Private
  Item`, not a plain EUL column); `workbook-parser.ts`'s `tokens` field is the
  literal, unexpanded formula, and is byte-for-byte what the raw stream
  holds — confirmed by reading the referenced element directly. A downstream
  consumer (W2/W6, calculated-field migration) needs to walk this chain if it
  wants the fully-resolved formula Discoverer would evaluate; this is the
  entire remaining `ioFormula` gap above.
  Still open regardless of the fix above: **re-importing the maps already
  migrated under the old dedup** (`node migrate/src/services/map-reimport.ts`
  / `POST /api/migration/reimport-maps`) — a live decision for whoever owns
  that migration, not run automatically here.
- **Private filters: 99.0% matched (3 299 / 3 331), formula agreement 99.9%**
  among matches. The few `unmatchedParser` conditions are almost all
  `element#N ?` — a condition element with neither `CONDITION_SQL` nor
  `CONDITION_NAME` populated. These are suspected to be workbook-local
  placeholders for a **shared `EUL Filter Reference`** (a public/EUL-level
  filter, which this differ does not yet cross-check against `doc.conditions`
  at all) rather than a decode failure — not confirmed, flagged as a gap in
  the differ itself rather than the parser.
- **Parameters: 100% matched (3 784 / 3 784), 99.6% prompt agreement.** All 17
  disagreements trace to the same root cause as the calculation-name
  collision, in miniature: two parameters in one workbook whose `Name` is
  identical **after trimming trailing whitespace** (`"DATA FIM"` vs
  `"DATA FIM "`, confirmed directly in `GD_M.M59_V04`'s dump text) — both the
  parser and this differ trim before comparing, so the two collapse onto one
  and whichever prompt "wins" depends on iteration order. Real, but far
  rarer than the calculation case (17 instances vs. thousands) and not
  filed as its own task — worth remembering if `map_parameters` prompts are
  ever spot-checked against a workbook with this shape.
- **Sheets: 896/896 matched, names 100% agree.** Of 33 290 displayed items
  compared, 32 105 matched, 1 137 (3.4%) were dump-only, and 48 (0.14%)
  parser-only — a real, small gap worth explaining before W4 (layout) builds
  on it.

Full per-field tallies (agree / disagree / only-in-dump / only-in-parser) are
in `DumpDiffReport` — run `diff-corpus.ts --report` to get them for a specific
sample. `FIELDS_NOT_YET_PRODUCED` in `d4wkdmp-differ.ts` is the hand-maintained
list of dump fields the parser does not produce at all; W2 emptied it down to
two entries.

## Findings from the W2 re-run (544/544 workbooks, offline)

Full detail, per field and per class, is in `EUL_SCHEMA_GROUND_TRUTH.md` §7.8.
The headline changes to this harness's own report:

- **Element framing is now measured and reported.** 470 281 of 470 281 element
  bodies across the dumped corpus parse as a complete record sequence; none
  fall back to the resynchronizing scan. Every worksheet-model field depends on
  that, so it is the ceiling on everything below.
- **Calculations: 41 263/41 982 matched → 41 982/41 982, `IOFormula` 93.9 % →
  100 %.** The gap was calculations whose formula ran past 254 bytes, which the
  old one-byte string length could not read at all: 3 556 of them were dropped
  outright, and the dump entries then matched the wrong element by name.
- **The "dump expands a nested calculation reference" finding is withdrawn.**
  25 216 calculations reference another calculation and the dump prints every
  one unexpanded, byte-identical to the parser. See §7.8.16.
- **Private filters: 3 299/3 331 matched → 3 331/3 331**, and the "unmatched,
  suspected placeholder for a shared filter" note is resolved — they were
  conditions with no name to match on.
- **Sheet `Items :-`: 1 137 dump-only → 0.** That list is the sheet's *query*
  items, not its displayed columns; the differ now compares it against
  `queryItemRefs` and keeps the column comparison alongside it.
- **New sections**: sorts (3 775/3 775, `Direction` and `Item` both 100 %),
  query requests (896/896; `Distinct` 100 %, every usage list ≥ 99.7 %), joins
  (24/24, all fields 100 %), and the sheet's `Query(s) used` / `Filters :-` /
  `Joins :-` lists.
- Every residual disagreement is one of the shapes already recorded above: the
  single workbook `GD_M.M65_V13` whose `IoId`s run one low, and the
  parameter-name collisions. No new class of disagreement appeared.

## Findings from the W7 run (sorting)

Full detail is in `EUL_SCHEMA_GROUND_TRUTH.md` §7.11.

- **New section**: `Sort On (vs sort_direction/sort_order)` per sheet — the
  `Sort On …` lines inside a sheet's `Items :-`, against the order
  `map_items.sort_order` is written in. That empties
  `FIELDS_NOT_YET_PRODUCED`'s `Sheet` entry; only `Parameter`'s
  `Drill Segment Id` is left.
- **`sort_order` is confirmed by two independent printings.** Oracle prints the
  sort list both as `Sort Item Usage` in `Query Request QRn` and as `Sort On …`
  under the sheet. Over the dumped corpus they agree, in order, on **716 of the
  716 sheets that sort anything** — a text-only check that needs no workbook
  bytes.
- **183 of the corpus's 3 775 sorts (4.8 %) are on a workbook calculation**,
  which `map_items` cannot hold; those are reported, not migrated.
- **Crosstab sorting has no observable instance.** The one crosstab sheet in all
  available evidence (`DISCVR4/VIDSTR4.DIS` sheet 2) sorts nothing, and Oracle's
  own dump of it prints no sort line. See §7.11.
- The differ can be run offline on a single workbook with no live source, which
  is how the above was checked: stage `<docId>.bin` and `<docId>.txt` in one
  directory with a one-document `_manifest.json` and point `--manifest`,
  `--dumps-dir` and `--bytes-dir` at it. `VIDSTR4.DIS` plus
  `d4dumps/_VIDSTR4.sample.txt` is a complete, non-customer pair for this.
