# Review C — Security Challenge

**Method.** Two passes, sequential and non-overlapping, per §5.

- **C1 — threat identification.** `code-modernization:security-auditor`, given a tight file
  list and eight closed questions. It returned in full (85 497 tokens, 62 tool calls).
- **C2 — mitigation challenge.** Done **inline**, not delegated. C2's job is to ask whether the
  Master Plan actually mitigates C1's threats *and does so in the right order*; that requires
  the plan, the decision register and the phase prompts in one context, all of which the
  reviewing session already held. Delegating it would have meant re-reading 57 KB of plan into
  a fresh context to answer a question already answerable — the exact waste the tooling
  manifest's Rule 3 forbids.

**Every CRITICAL and HIGH below was re-verified against source by the reviewing session.** The
agent's claims were not taken at face value.

---

## Part 1 — Threats found

### C-01 · Row-level security fails OPEN when the user has no policy

- **Severity:** CRITICAL
- **Verified:** `backend/src/services/map-execution.service.ts:290-291`

```ts
const policies = await getUserPolicies(user.id, user.role);
if (policies.length === 0) return { predicates: [], bindParams: {} };
```

A user with no assigned policy executes with **no predicates at all** — every row of every
folder the map touches. This is Discoverer's own behaviour, and D-090 names it as *Neo's one
deliberate incompatibility*, so the plan knows. See C-08 for why knowing is not enough.

### C-02 · The security folder set has at least two blind spots, not one

- **Severity:** CRITICAL
- **Verified:** `map-execution.service.ts:293-295` vs `lib/sql/context.ts:24-33`,
  `lib/sql/from-clause.ts:104-126`, `types/sql.ts:34`

The security set is `def.items` ∪ `def.conditions`. Folders reach the emitted SQL by **three**
routes:

| Route | Mechanism | In the security set? |
| ----- | --------- | -------------------- |
| Selected items and conditions | `def.items`, `def.conditions` | ✅ yes |
| **Formula references** | `def.formulaItems` → `resolveFormulaReference` → `aliasFor` | ❌ **no** |
| **BFS join bridges** | `from-clause.ts:104-126` spanning tree over `def.joins` | ❌ **no** |

Review A found the first gap. C1 independently found the second, and added the detail that
makes it worse: `types/sql.ts:34` documents `def.joins` as **all joins available in the
business area**, not the map's own — so the BFS can pull in a folder the map never referenced.

**Why "it's only a bridge" is not a defence.** A bridge folder joined `INNER` **filters the
result set**: master rows with no matching bridge row are dropped. So a restrictive policy on
the bridge changes which rows the user sees — and its absence changes them the other way. The
folder affects the answer whether or not it contributes a column.

### C-03 · `POST /api/auth/refresh` has no preHandler, so revocation is structurally unreachable

- **Severity:** HIGH
- **Verified:** `backend/src/routes/auth.ts:143-200`

Three defects on one route:

1. **No `preHandler` at all** — the route options carry only `schema`. `isTokenBlacklisted` is
   wired into the `fastify.authenticate` decorator (`plugins/auth.ts:67-78`), which this route
   never invokes. **Logging out then refreshing the same token returns a fresh, un-blacklisted
   token.** Logout provides no revocation.
2. **Role is copied from the presented token**, never re-read:
   `reply.jwtSign({ sub: payload.sub, email: payload.email, role: payload.role })`. A demoted
   or deactivated user keeps their old role.
3. **The 7-day grace window resets on every refresh** (`auth.ts:189-193` compares
   `payload.exp + 7 days` against now, and the new token gets a fresh `exp`). A token refreshed
   weekly never expires.

### C-04 · Five `GET`-by-id routes return entities with no grant check

- **Severity:** HIGH
- **Verified:** all five carry `preHandler: [fastify.authenticate]` and nothing else

| Route | File:line |
| ----- | --------- |
| `GET /api/folders/:id` | `routes/folders.ts:196-200` |
| `GET /api/items/:id` | `routes/items.ts:175-180` |
| `GET /api/items/:id/descendants` | `routes/items.ts:531-537` |
| `GET /api/joins/:id` | `routes/joins.ts:151-186` |
| `GET /api/hierarchies/:id` | `routes/hierarchies.ts:142-177` |

Any authenticated user reads folder table names, item column names and data types, and join
column pairs for business areas they hold no grant on — the schema of the warehouse.

`GET /api/business-areas/:id` and `GET /api/data-sources/:id` **are** correctly gated
(`requireBusinessAreaAccess('VIEW')` and `authorize('ADMIN','MANAGER')` respectively).

### C-05 · A public map is a data-entitlement bypass

- **Severity:** HIGH
- **Verified:** `services/map.service.ts:794`, reached from `routes/map-execution.ts` via
  `loadMapWithAccess(request, reply, 'VIEW')`

```ts
if (map.isPublic && (action === 'VIEW' || action === 'EXPORT')) return true;
```

`VIEW` is the action every execute / export / history / status route gates on, and execution
runs live SQL. Flipping `isPublic` on one map grants every authenticated user real rows from
that business area — constrained only by RLS, which per C-01 may be nothing.

### C-06 · Both secrets have committed insecure defaults and nothing refuses to boot

- **Severity:** CRITICAL
- **Verified:** `backend/src/config.ts:52`, `config.ts:147`; `grep -n production config.ts`
  matches **only** the `NODE_ENV` enum at line 5

```
JWT_SECRET     : z.string().min(16).default('dev-only-insecure-secret-change-me')
ENCRYPTION_KEY : z.string().min(32).default('dev-only-insecure-encryption-key-change-me')
```

`lib/encryption.ts:10` derives the AES-256-GCM key from `ENCRYPTION_KEY` via `scryptSync`.
Both values are in this repository. An attacker forges an `ADMIN` token and decrypts every
stored Oracle credential.

### C-07 · `security_policy_rules.sqlPredicate` is raw SQL spliced into every WHERE

- **Severity:** LOW today · **rises to HIGH after Phase 6.3**
- **Verified:** `lib/sql/where-clause.ts:247-294`; write routes admin-gated at
  `routes/security.ts:198,236,281,350,396,442`

The predicate is stored SQL, substituted with alias replacement and a `;` check, not parsed.
That is deliberate and admin-only, so it is not a live vulnerability. But **after 6.3 makes RLS
fail closed, this string becomes the control the entire data-access model rests on**, and the
plan's *"SQL safety — already sound — protect it"* does not distinguish the two situations.

### Threats checked and NOT found

- **SQL injection on user input** — none. Identifiers are regex-validated and quoted
  (`lib/sql/identifiers.ts:13-33`); condition and parameter values are binds
  (`where-clause.ts:109,124,157,177`); the formula parser is an allowlist recursive-descent
  parser with literal escaping (`formula-parser.ts:370-468`). **The plan's claim that SQL
  safety is sound is verified correct.**
- **Export leakage** — `routes/export.ts:81-110` re-checks job ownership *and* current
  `canAccessMap` at download time, and `filePath` is excluded from the response shape
  (`export.ts:51-63`). **The plan's "exports already sound" is verified correct.**
- **Unbounded request-path accumulation** — sync path clamped by `clampSyncMaxRows`, async by
  `ASYNC_MAX_ROWS = 100_000` (`map-execution.service.ts:517-635`, `:846-954`). Note this does
  **not** clear BE-03, which concerns the process-local *result cache*, a different object.

---

## Part 2 — Does the plan mitigate them, and in the right order?

| Threat | Plan's answer | Phase | Verdict |
| ------ | ------------- | ----- | ------- |
| C-01 RLS fails open | D-090, fail-closed | **6.3** | ✅ correct fix · ❌ **five phases too late** |
| C-02 folder-set blind spots | *"Do not fix the security folder set"* | 1.1 prompt | ❌ **actively wrong** |
| C-03 refresh | SEC-01, SEC-12 | 6.1 | ⚠️ **understated** — misses the real defect |
| C-04 IDOR ×5 | SEC-03 | 6.2 | ✅ correct · ⚠️ incomplete list, late |
| C-05 public map | D-016 two gates | **1.1** | ✅ **correct and correctly placed** |
| C-06 secrets | D-092 | **0.2** | ✅ **correct and correctly placed** |
| C-07 `sqlPredicate` | *"already sound"* | — | ⚠️ **true today, false after 6.3** |

### C-08 · The plan makes 651 worksheets executable in Phase 1.1 and fixes fail-closed RLS in Phase 6.3

- **Severity:** CRITICAL
- **Type:** SEQUENCING

**Finding.** Today the estate is safe by accident: **zero of 923 worksheets execute**, so
C-01's fail-open costs nothing. Phase 1.1's entire purpose is to end that. Its acceptance is
*"~651 single-folder maps generate SQL."* From that commit until Phase 6.3 lands — through
Phases 2, 3, 4 and 5, the two largest in the plan — the system serves live warehouse rows with
row-level security that returns nothing for any user who has no policy, and skips policies on
formula-referenced and bridge folders for everyone.

The plan's §7 lists *"two ordering constraints"* for security. This is a third, and it is
larger than both.

**Why 6.3 is late is understandable but not sufficient.** A blanket fail-closed switch at 1.1
would break everything: `security_policy_rules` is empty in this estate, so "no policy ⇒ no
rows" means **all 923 maps return zero rows**. That is presumably why the plan defers it.

**The interim that costs nothing.** Fail closed **per policy-bearing folder**, not globally:

> If any folder in the query's *effective* folder set is targeted by at least one
> `security_policy_rules` row — for **any** user — and the executing user resolves no predicate
> for that folder, **refuse**, naming the folder.

Against today's empty policy table this is a **no-op** — zero behaviour change, all 651 maps
still run. It becomes correct automatically the moment the first policy is written, which is
exactly the moment the current code becomes dangerous. It is a few lines, and it belongs in
1.1 alongside the other three security changes that stage already carries.

**Recommendation.**
1. Add the per-folder interim above to **Phase 1.1**, as a fifth change in the same commit.
2. Keep 6.3 as the full fail-closed treatment and the COMPLEX-folder refusal.
3. Add to §7's ordering constraints: *"execution must not become reachable before RLS refuses
   on a policy-bearing folder it cannot resolve."*

### C-09 · The 1.1 prompt's folder-set instruction should be reversed

- **Severity:** CRITICAL (same defect as A-01, restated as a plan correction)
- **Type:** INCORRECT

`docs/master-plan/prompts/PHASE-01-01-the-scoping-commit.md:108-112` instructs:

> *"**Do not "fix" the security folder set to match the join path.**"*

The instruction's premise is sound — the Phase 3 planner will legitimately place folders in
FROM that carry no selected item, and widening the security set to the whole join path would
over-filter. But the conclusion is wrong, because C-02 shows the *narrow* set is also wrong,
in two ways, and one of them (`formulaItems`) puts a folder's **column values directly into
SELECT**.

**Recommendation.** Replace the instruction with the rule, not the set:

> **Any folder that can change the rows the user sees must resolve its policies, or the query
> refuses.** That includes every folder contributing a column (selected items, conditions, and
> **items reached through calculated-field references**) and every folder joined `INNER` into
> the path (which filters). It excludes a folder joined purely `OUTER` on the master side and
> contributing no column. Compute this once, as **a pure function of `MapDefinition`**, and
> use the same function for the security predicate set and for the planner (see A-02).

Add a gate test to 1.1: *a map whose calculated field references an item in an unselected,
policy-bearing folder must emit that folder's predicate or refuse.*

### C-10 · Phase 6.1's scope understates the refresh defect

- **Severity:** HIGH
- **Type:** INCORRECT / MISSING

6.1 reads: *"Refresh checks the logout blacklist and re-reads role and account status from the
database (SEC-01); separate revocable refresh tokens (SEC-12)."* That describes adding a call.
The actual state is that `POST /api/auth/refresh` **has no `preHandler`**, so no
authentication-plugin machinery runs on it at all, and the 7-day window is self-renewing.

**Recommendation.** Rewrite 6.1's scope to name all three, and rewrite its acceptance. The
plan's current gate — *"a deactivated user's refresh fails within one token lifetime"* — passes
if only defect 2 is fixed while a blacklisted token still refreshes. Add:
- *a token blacklisted by logout is rejected by `/api/auth/refresh`* — this is the gate that
  proves the preHandler exists;
- *a token cannot be refreshed indefinitely past its original issue* — the self-renewing
  window.

### C-11 · Entity scoping is scheduled after the UI that makes ids discoverable

- **Severity:** HIGH
- **Type:** SEQUENCING

C-04's five routes stay open through Phases 2–5. Phase 2.1 ships the Maps list, and 2.2 wires
Run — the first release where a non-admin user has a UI that surfaces folder and item ids at
all. The plan therefore increases discoverability of the ids in Phase 2 and closes the routes
in Phase 6.

The fix is a `preHandler` addition, and **the pattern already exists in this codebase** — the
maps routes use it, and `requireFolderAccess` / `requireOwnedEntityAccess` are already written
and exported in `middleware/business-area-auth.ts:141-190`. This is not new code; it is five
call sites.

**Recommendation.** Move SEC-03's entity scoping from 6.2 into **Phase 1.2**, which is already
editing route files for the `/api/maps` visibility change. Add the fifth route
(`GET /api/items/:id/descendants`) that 6.2's four-entity list omits. Leave SEC-04
(`custom_sql` validation on UPDATE) in 6.2.

### C-12 · `sqlPredicate` becomes load-bearing in 6.3 with no added validation

- **Severity:** MEDIUM
- **Type:** MISSING

**Recommendation.** Add to 6.3's scope: validate `sqlPredicate` on write — reject SQL comments
(`--`, `/*`), reject anything that closes the bracketing the generator adds, and add a test
that a predicate containing a `UNION` or a comment is refused at the API. Also record in the
6.3 documentation that **admin is the trust boundary for RLS content**, which the plan's
security programme table does not currently state anywhere.

---

## Environmental note, not a codebase finding

The C1 subagent reported that its tool-result stream contained instruction-shaped
`<system-reminder>` blocks (a context-tooling directive and a persona block) that did not come
from the code under audit, and that it disregarded them and continued under the orchestrator's
instructions. That is the correct handling. Recorded here only because a security review should
say when it saw instruction-shaped text it chose not to follow. No action required, and no
bearing on any finding above.
