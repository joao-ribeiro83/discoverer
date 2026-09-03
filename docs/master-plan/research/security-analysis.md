# Consolidated Security Model

**Produced:** 2026-09-02, **inline** (decision D-005). The forensic audit already enumerates
every finding with file:line, severity and remediation; Stage B independently found the two
it missed; Stage A corrected the one it misattributed. A specialist pass would restate
rather than discover — and two specialists have already died on the usage limit this
session.

**Sources:** `AUDIT_EXECUTIVE_SUMMARY.md` §6, `AUDIT_DETAILED_FINDINGS.md` (`SEC-*`, `INF-*`,
`F-03`, `F-16`, `F-17`), `research/architecture-analysis.md` B1–B2 and M3,
`research/legacy-analysis.md` §8.

---

## 1. Posture in one paragraph

**The SQL layer is disciplined; the failures are concentrated in secret handling, the token
lifecycle, and object-level authorisation.** That is a good shape to be in — those three are
tractable and bounded, whereas a leaky query builder would not be. But two of the four
serious issues are **credential exposure**, one of them unencrypted, and the encryption key
protecting the rest is published in this repository. Nothing refuses to boot in production
with either default in force.

---

## 2. Threat model

| # | Actor | Capability | What they get today |
| - | ----- | ---------- | ------------------- |
| T1 | Anyone with repository read access | Reads `config.ts` | The `ENCRYPTION_KEY` and `JWT_SECRET` defaults → **decrypts every stored Oracle password**, forges any JWT |
| T2 | Any authenticated user (18 non-admin accounts) | Calls `GET /api/{folders,items,joins,hierarchies}/{id}` | **The entire metadata layer**, including `custom_sql` and join topology, across business areas never granted (SEC-03) |
| T3 | Any authenticated user | Reads `audit_log` if granted, or exfiltrates the DB | **174 Oracle data-source passwords + 5 user passwords in cleartext** (SEC-02) |
| T4 | A demoted, deactivated or deleted user | Holds a valid token, calls `/api/auth/refresh` | A live session for up to **~14 days**, at their *old* role (SEC-01, SEC-12) |
| T5 | A user with a share on one map | Opens that map | Data from business areas they were never granted — **once the scoping fix lands** (Stage B, B-2) |
| T6 | Any user, once `business_area_id` is nullable | Executes any map | **Unfiltered rows** — BA-scoped RLS silently stops matching (Stage B, B-1) |
| T7 | Unauthenticated network peer | Reaches `:443/metrics`, or `:5432`/`:6379` on the compose host | Operational intelligence; direct DB and queue access (INF-09, INF-12) |
| T8 | Malicious website in a victim's browser | Cross-origin request with credentials | CORS reflects **any** origin (INF-13) |
| T9 | Offline attacker | Brute-forces the login endpoint | No rate limit, no lockout (SEC-05) |
| T10 | An admin | Creates a data source | Host/port interpolated into the Oracle connect descriptor → **SSRF**, admin-gated (SEC-10) |

---

## 3. Controls that are verified sound — PROTECT THESE

Any remediation must not regress them. Each was independently verified during the audit.

| Control | Where |
| ------- | ----- |
| **Every runtime value is a bind variable**, without exception | `lib/sql/*` |
| **Identifiers are *rejected*, not escaped**, when they contain quotes | `lib/sql/identifiers.ts` |
| **An `OR` in a user condition cannot escape a security predicate** — bracketing is unconditional and correct | `lib/sql/security-predicates.ts` |
| Formulas are parsed to an AST against an allowlist and re-emitted — **never string-spliced** | `lib/sql/formula-parser.ts` |
| Export downloads are ownership-gated with UUID-derived paths, **no path traversal** | `services/export.service.ts` |
| Migration routes are **all admin-gated** | `routes/migration.ts` |
| The API redacts credentials in responses — `hasPassword: boolean` only, never ciphertext or plaintext | `routes/data-sources.ts` |
| The `!migrat` sentinel for migrated users **fails closed** (verified live) | `migrate/src/services/temporary-password.ts` |
| The test suite **refuses to run against a non-`_test` database** | `backend/src/__tests__/test-database-guard.test.ts` |

**The one documented exception to "every value is a bind":** `explainSql` interpolates
`statementId` into a string literal behind a `^[A-Za-z0-9_]{1,30}$` guard
(`sql-generator.ts:139-149`). Acceptable as is. **The query planner must not add a second.**

---

## 4. Findings, consolidated and ordered

### Tier 0 — credential exposure. Fix before anything else touches production.

| ID | Finding | Fix |
| -- | ------- | --- |
| **SEC-02** | The audit hook stores full request bodies and redacts only *exact* key names. `passwordEnc` — which the client sends as **plaintext** before the server encrypts it — and `newPassword` are not in that list. **174 Oracle passwords + 5 user passwords sit in cleartext in `audit_log`.** Worse than the key problem: not encrypted at all. | Redact by **substring** (`password`, `secret`, `token`, `credential`), not exact match. Then **purge** the existing rows. Rotate every exposed Oracle credential. |
| **F-03** | `config.ts:147` defaults `ENCRYPTION_KEY` to a string **published in this repository**, and it appears in no `.env`, `.env.example` or compose file — so the default protects every stored Oracle password. `JWT_SECRET` has the same pattern. | Refuse to boot in production with either default (INF-08). Generate, document in `.env.example`, rotate, **re-encrypt** all stored credentials. Five lines plus a migration. |
| **INF-07** | Nine plaintext credential CSVs a week old on disk, written by the migration. | TTL + boot sweep in `credential-file.service.ts`. Delete the existing nine. |
| **INF-06 / INF-14** | A 20 MB dump containing `data_sources` is untracked and un-gitignored; ~40 MB of dumps in the tree. | `.gitignore` them, delete them. They are also unusable as backups (UTF-16 PowerShell artefacts PostgreSQL cannot read) — `scripts/backup.sh` is the real tool. |

### Tier 1 — authorisation. These are the two the audit missed.

| ID | Finding | Fix |
| -- | ------- | --- |
| **B-1** *(new)* | **Making `maps.business_area_id` nullable silently disables row-level security.** `map-execution.service.ts:296-305` matches BA-scoped rules by direct equality on that column; `null` never matches → the query runs **unfiltered**, with no error and a green suite, because `security_policy_rules` is empty. | Resolve BA-scoped rules against the **derived folder set**. **Ship in the same commit as the scoping change.** Add a test asserting a BA-scoped policy fires when `business_area_id IS NULL`. Until that test exists, the column stays `NOT NULL`. |
| **B-2** *(new)* | **`canAccessMap` has four grant paths and three return before any BA check** (`map.service.ts:786-813`: admin, owner, public). **Map sharing therefore becomes business-area grant escalation.** | Two gates. `canAccessMap` = "may you see this object". A new **unconditional** `assertDataEntitlement(userId, folderIds)` = "may you read this data", on every execute/export path, non-admin, no exceptions. Home: `middleware/business-area-auth.ts:99` — `resolveBusinessAreaId: => Promise<string \| null>` becomes `=> Promise<string[]>`, and `userHasPermission` becomes an all-of check. |
| **SEC-03** | **IDOR.** `GET` by id on folders, items, joins and hierarchies attaches only `authenticate` — no entity scoping. Any of the 18 non-admin accounts can read the whole metadata layer. | Attach the entity-scoping middleware to those four route groups. The pattern already exists in the maps routes. |
| **SEC-04** | `folders.custom_sql` validation is **skipped entirely on UPDATE**. | Apply the create-path validator to the update path. |

### Tier 2 — token lifecycle

| ID | Finding | Fix |
| -- | ------- | --- |
| **SEC-01** | `/api/auth/refresh` never checks the logout blacklist **and** re-signs `role` from the incoming token rather than the database. A demoted, deactivated or deleted user keeps a live session for ~14 days. | Check the blacklist; re-read role and account status from the database on every refresh. |
| **SEC-12** | The access token is its own refresh credential → ~14-day effective lifetime. | Separate refresh tokens with independent, revocable storage. |
| **SEC-05** | No rate limiting or account lockout on login. | Add both. |

### Tier 3 — RLS design. Correct the premise first.

| ID | Finding | Fix |
| -- | ------- | --- |
| **A-2** *(corrects the audit)* | **`EUL4_ASM_POLICIES` is Automated Summary Management, not row-level security.** Proven three ways (`eulasm.sql:1-2` grants `create any materialized view` / `global query rewrite`; the ASM chapter is ch. 13 "Managing summary folders"; `EUL.dtd:385-399` shows `ASMPolicy` constrains **folders and summary objects**, carries no user and no predicate, and is a **per-EUL singleton**). | **Do not build an RLS reader against it.** It would produce an empty policy set and a *false sense that RLS had been migrated*. Migrate it instead as **summary-folder input** — which folders the administrator excluded from summarisation. Low priority. |
| **A-2b** | **Real Discoverer 4.1 RLS** was a *mandatory advanced condition* whose predicate compares Oracle's `USER`, built on an item class over `SYS.ALL_USERS`: `(USER IN ('A','B') AND Region='West') OR (USER IN ('C') AND Region='East')`. | **Item classes are a dependency of migrating surviving RLS, not a cosmetic parameter feature.** The **7 depth-2 `OR`-of-`AND` conditions** measured in this estate are the first place to look for it. |
| **SEC-06** | RLS **fails open** with no policy, and COMPLEX folders bypass predicates structurally. | **Neo's one deliberate incompatibility with Discoverer must be to fail closed.** Discoverer's own RLS failed open by construction; do not reproduce that. Refuse to execute against a COMPLEX folder carrying a policy until the predicate can be proven injected. |
| **M3** | The **summary/RLS bypass invariant** has no documented home: a materialised view derived from an RLS-bearing folder contains only its creator's rows — *"the fastest path through the system is also the one that leaks."* Neo has no result cache today, so nothing leaks **yet**. | Record the invariant next to the query planner's plan type, so the first person to add a result cache or a rollup finds it. |

### Tier 4 — exposure surface and hygiene

| ID | Finding | Fix |
| -- | ------- | --- |
| **INF-13** | CORS reflects **any** origin with credentials. | Allowlist. |
| **INF-09** | `/metrics` proxied unauthenticated on the public TLS listener, against its own documented instruction. | Bind to the internal listener or authenticate it. |
| **INF-12** | `docker-compose.yml` is titled "Production" and publishes Postgres and Redis to `0.0.0.0`. | Remove the port publications; it is not the production file — `docker-compose.prod.yml` is, and has **never been run** (INF-03). |
| **SEC-07** | Raw Oracle `ORA-` text reaches any user who can execute a map. | Map to the existing `kind` taxonomy; log the detail server-side with a correlation id (BE-11). |
| **SEC-10** | Data-source host/port interpolated into the Oracle connect descriptor → SSRF. **Admin-gated**, which bounds it. | Validate host against an allowlist or a resolved-address check. |
| **SEC-11** | **Read operations are never audited**, so IDOR exfiltration leaves no trail. | Audit reads on the metadata routes at minimum. Note the interaction with SEC-02 — do not solve this before the redaction fix, or the fix multiplies the exposure. |
| **INF-05** | No dependency, image or secret scanning; **11 npm advisories live, 6 high**. | Add scanning to CI — which requires CI to run at all (INF-04). |
| **F-16** | A decryption failure surfaces as a bare unhandled 500. | Handle it; it is the signal that a key rotation went wrong. |
| **F-17** | An active seed data source with a placeholder credential sits in the real database. | Remove it. |

---

## 5. Sequencing

1. **Commit the tree and add a remote.** Every control below is worthless if the work is lost
   (DOC-04: no remote, 70 untracked paths).
2. **Tier 0**, in order: redact-by-substring → purge `audit_log` → production config guard →
   rotate and re-encrypt → delete credential CSVs and dumps.
3. **CI onto `master`** (INF-04) — nothing below is enforced until it runs.
4. **Tier 1 lands with the scoping commit**, not after it. B-1 and B-2 are *caused by* that
   change.
5. **Tier 2** independently — no dependency on the query work.
6. **Tier 3** with the metadata-fidelity phase, *after* A-2's correction is understood.
7. **Tier 4** with the operational-readiness phase.

**The rule that matters:** SEC-02's redaction fix must land **before** SEC-11's read
auditing. Auditing more requests while the redactor is still exact-match would multiply the
cleartext exposure rather than reduce it.
