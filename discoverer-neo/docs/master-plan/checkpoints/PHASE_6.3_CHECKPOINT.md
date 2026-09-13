# Phase 6.3 checkpoint — row-level security, fail-closed

## Status

| Item | State |
|---|---|
| The 7 depth-2 conditions investigated | Done — **not row-level security. This estate had none.** |
| `EUL4_ASM_POLICIES` | No RLS reader built (D-077). 1 row, 0 constraints: nothing to migrate as summary input either |
| RLS fails closed (D-090) | Done — `ROW_LEVEL_FAIL_MODE`, default `CLOSED`, on maps, exports, schedules and pick-lists |
| COMPLEX folder carrying a policy refuses (SEC-06) | Done — refuses for every user, naming the folder and the policy |
| Summary/RLS bypass invariant beside the plan type (D-021) | Done — updated for fail-closed; async job results now go only to the user who started them |

## Fail-closed (D-090)

`ROW_LEVEL_FAIL_MODE` — per policy type, and only `ROW_LEVEL` exists — defaults
to `CLOSED`. One function decides every refusal: `rowSecurityRefusal` in
`security.service.ts`, called by `resolveSecurityPredicates` (maps, exports,
schedules) and by `resolveLovSecurity` (lists of values), so the two data paths
cannot drift apart.

| Mode | A folder the user resolves no predicate for |
|---|---|
| `CLOSED` (default) | Refused by name, whoever the user is. No policy, no rows; removing, disabling or unassigning a policy only takes rows away |
| `OPEN` | Refused only when some active policy reaches it (D-116); otherwise unfiltered |

A refusal is a `FORBIDDEN` raised before any SQL is generated, so "zero rows"
is enforced as "no statement reaches Oracle": every test asserts the driver's
`execute` was never called. That is Phase 1.1's shape, kept on purpose — an
empty result reads as "no data" to whoever opens the report, while a refusal
names the folder.

**Admin bypass: none.** Admins bypass business-area grants, never row-level
security, in either mode. There is nothing to audit.

**Live consequence.** `security_policies` is empty on the live estate, so once
this is deployed every map, export, schedule and pick-list refuses for everyone
until policies exist. Write them first — a business-area rule `1 = 1` gives its
assignees every row — or set `ROW_LEVEL_FAIL_MODE=OPEN` until they are written.

### Hardening that rides with it

- **Predicates on write (R-15 / C-12).** `validatePredicate` now refuses
  unbalanced parentheses and `UNION` / `INTERSECT` / `MINUS` / `EXCEPT`.
  `1=1) OR (1=1` passed validation before this, and closed the generator's
  bracket: `AND (1=1) OR (1=1)` returns every row. Comments were already
  refused.
- **A quoting bypass, closed.** `stripStringLiterals` took the apostrophe in a
  quoted identifier such as `"x'"` for the start of a literal and blanked the
  real SQL up to the next quote, so `"x'" = 1 OR DBMS_LOCK.SLEEP(1) = 1 OR "'" = 1`
  passed the package scan. It now tracks both kinds of quote in one pass.
- **The generator re-checks the bracket** (`bracketingError`, called from
  `where-clause.ts`), so a stored predicate that predates the tightening still
  cannot escape.
- **The rewrite refuses a folder predicate that no branch reads**
  (`renderRewrite`) instead of dropping it.

## COMPLEX folders (SEC-06)

A COMPLEX folder inlines its custom SQL as a derived table, and a predicate is
ANDed onto the query around it, never into the tables that SQL reads.
`rowSecurityRefusal` therefore refuses a COMPLEX folder that any **active**
policy reaches — through a folder rule or a business-area rule — for every
user, covered or not, and names the folder and the policy. The check runs
before the coverage check, so the refusal a user sees is the structural one.

Under `CLOSED` a COMPLEX folder is unreadable: uncovered without a policy,
refused with one. Live impact is nil — `discoverer_neo` holds 212 folders, all
`TABLE` (2026-09-13). What lifts it is pushing predicates into the custom SQL's
own tables, provably; until then refusal is the honest answer.

Tests: `rls-conformance.test.ts` gate 13 — a folder rule and a business-area
rule each refuse by name, for the covered user and the uncovered one alike, and
with no policy the folder runs only in `OPEN` mode.

## The summary/RLS bypass invariant (D-021)

It was already written beside the plan type in `lib/sql/query-plan.ts` (Phase
3.3) and in `docs/developer-guide/architecture.md`. This stage updated both for
fail-closed — under `CLOSED` every folder is RLS-bearing — and pointed
`lib/metadata-cache.ts` at it, because the caching module is where the first
person adding a result cache will look.

**The premise "Neo has no result caching" was not quite true; it is now.** An
async execution keeps its result in memory, and
`GET /api/maps/:id/executions/:jobId` checked only that the caller could open
the map. Anyone who could open a public or shared map and held another user's
job id could collect rows filtered by that other user's row-level security —
the bypass in miniature. Job ids are random UUIDs, so it was hard to reach, not
impossible. The job now records its `userId`, and the status and cancel routes
answer `404` to anyone else (`map-execution-routes.test.ts`).

The list-of-values cache was already safe: it is skipped whenever a predicate
applies, which under `CLOSED` is every list a user may see.

## Validation

- `npm test -w backend`: 63 suites, 1 356 tests, all passing (2026-09-13, with
  all four changes in).
- `e2e/accessibility.spec.ts` › `/admin/security`: no axe violations, run
  against port 5174.
- `node scripts/i18n-check.mjs pt-PT fr-FR es-ES`: all checks pass.

**Resume check:** run `rls-conformance.test.ts`. Gate 12's "a user with no
policy sees NOTHING" must refuse, and no statement may reach Oracle.

## Verdict: this estate had no row-level security

Measured 2026-09-13, read-only, against the live EUL4 and the migrated target.

Discoverer 4.1 row-level security was a **mandatory folder condition** whose
predicate compares Oracle's `USER` (legacy-analysis §8.2). Every link in that
construction is absent here:

| Check | Result |
|---|---|
| Folder conditions of any kind — `EUL4_EXPRESSIONS.EXP_TYPE` | Only `CO` 6 967, `CI` 2 830, `JP` 10. No filter rows, so no mandatory condition exists |
| EUL expressions calling `UID` / `USER` / `USERENV` (`[1,69]` / `[1,70]` / `[1,71]`) | 0 / 0 / 0 |
| Folders over `ALL_USERS`, `DBA_USERS`, `USER_USERS` | 0 |
| Workbook condition trees (564 workbooks, `dump-condition-tokens.ts`) | 3 427 |
| ...calling `UID`, `USER` or `USERENV` | 0 |
| ...calling a custom PL/SQL function | 0 |
| ...by boolean depth | 0: 2 951 · 1: 474 · 2: **2** · ≥3: 0 |

The function ids come from Oracle's own `EUL4_FUNCTIONS` seed script inside
`DISCVR4\DCESQRES.DLL`: `(69,'UID')`, `(70,'USER')`, `(71,'USERENV')`.

**The two depth-2 trees** — legacy §7.5's "2 definitions, 7 instances", the
instances counted per worksheet. Shapes only; no values:

1. `OR( AND( IS NULL(item), >(item, literal) ), >=(date arithmetic over items, literal), >(function of items, literal) )`
   — date arithmetic. No identity anywhere.
2. `OR( AND( =(item, literal), =(item, literal), <=(item, parameter) ), AND( >(item, literal), =(item, literal) ) )`
   — the OR-of-AND-pairs shape RLS used, but every test compares an ordinary
   item to a literal or a parameter. No user is named.

Neither could have been security in any case: a workbook condition is not
mandatory, and any user who can edit the worksheet can switch it off.

**The target agrees.** No `map_conditions` row references an item or a
calculation that evaluates an identity function; the 16 items named like
"username" are plain columns and appear in no condition.

**Consequence.** Nothing migrates into `security_policies`. The business-area
grants and the `!migrat` sentinel carry the whole access-control burden brought
over from the source, and Neo's row-level security starts empty.

### How it was measured, and what was not kept

The token trees were dumped inside the backend container, analysed there by a
script that prints counts and value-free skeletons, and deleted. The EUL counts
came from a throwaway script that printed counts only, also deleted. No
predicate value, workbook name or condition text was read into this document.

### Found on the way — not RLS, and not fixed here

32 migrated maps mix `AND` and `OR` joins at the top level of their condition
block, and no condition group carries an `OR` inside it. `where-clause.ts`
renders that as `(a AND b OR c)`, which SQL reads as `(a AND b) OR c`. That is
right for the two depth-2 trees above, whose flattening happens to match SQL
precedence, and wrong for any worksheet that ANDs a flat `OR` condition with
another condition — the source means `a AND (b OR c)`. The estate has 7 depth-2
worksheet instances, so up to 25 of the 32 may return rows Discoverer did not.
Needs checking per worksheet against the source; it belongs to condition
fidelity (Phase 5.3 / D-072), not to this stage.
