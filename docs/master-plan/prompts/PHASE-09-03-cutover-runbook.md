# PHASE 9.3 — Cutover runbook

**Model:** Sonnet · **Effort:** medium

## Purpose

Make the cutover rehearsed, reversible and boring.

## Scope

Write and **rehearse** the runbook.

1. **Migrate into a fresh database, promoted by connection-string switch — never in place**
   (D-078). Rollback is then switching back.
2. **`pg_dump` before every run**, via `scripts/backup.sh` (Phase 8.3 proved the restore).
3. **Record the source `EUL4_VERSIONS` state and the migrating commit SHA** in `migration_log`,
   for reproducibility.
4. **Keep the legacy Discoverer estate read-only-live through a parallel-run period.**
5. **Re-provision user credentials.** Legacy password hashes are **IMPOSSIBLE to migrate, and
   correctly so** (D-094) — `EUL4_EUL_USERS` holds Discoverer's own credentials, and Neo
   re-provisions with bcrypt behind the `!migrat` sentinel, which **fails closed** (verified).
   **Every user still carrying `must_change_password = true` needs a credential and a
   first-login path — query this count live at cutover time, do not assert a literal.**
   Phase 0.4's baseline measured 14 at the time of measurement
   (`docs/master-plan/research/baseline-counts.md`); no schema column marks "migrated"
   provenance, so this number moves as people complete first login and has no fixed value
   to design the runbook against — **17 does not match any measured population and should
   not be quoted.**
6. **Delete the UTF-16 dumps so nobody mistakes them for restore points** (INF-06), if still
   present.
7. **The MANUAL decisions**, surfaced and answered before cutover:
   - retention of the nine `EUL4_B*Q*R1` historical result tables (Phase 7.2)
   - the date-hierarchy regeneration decision (Phase 5.1, D-074)
   - any accepted result-set differences (Phase 9.1)

## Prerequisites

Phase 9.2. Phase 8.3 (a **verified** restore). Phase 9.1's equivalence report.

## Required files to read first

- `AUDIT_MIGRATION_ASSESSMENT.md` §9 — the rollback strategy
- `MASTER_IMPLEMENTATION_PLAN.md` §4 — the migration programme and the compatibility
  classification
- `docs/master-plan/DECISION_REGISTER.md` D-078, D-079, D-094
- `docs/master-plan/research/security-analysis.md`
- `discoverer-neo/scripts/backup.sh`, `restore.sh`
- `docs/deployment/`, `docs/migration/`

## Required tooling

**Skills:** none. **Agents:** none.
**Plugins / MCPs:** `context-mode`.

## Implementation instructions

- **Rehearse it end to end once**, into a scratch environment, and time each step. A runbook
  that has never been executed is a wish.
- Write it so **someone who was not in these sessions can execute it.** Exact commands, exact
  expected output, exact decision points. No "and then migrate".
- **Every step needs a rollback.** For each, state: how to tell it failed, and what to do.
- The parallel-run period needs a **defined exit criterion** — not "when everyone is happy".
  Propose one: N days with zero unexplained result-set mismatches on the top-M worksheets by
  usage.
- **Surface the three MANUAL decisions as blocking checkpoints**, not footnotes.

## Tests

- The runbook is executed end to end in a scratch environment
- The rollback is executed too — **switching back is tested, not assumed**
- Credential re-provisioning is walked through for at least one real migrated user
- The verifier passes after the rehearsed cutover

## Security checks

- **Credential re-provisioning is the largest security event of the cutover.** Temporary
  credentials must be delivered out of band, be single-use, and expire. The nine plaintext
  credential CSVs (INF-07) show how this has gone wrong before — the TTL sweep from Phase 0.2
  must be in force.
- Confirm the `!migrat` sentinel still blocks login for anyone not re-provisioned.
- Confirm the fresh target database has **no default `ENCRYPTION_KEY` or `JWT_SECRET`** —
  Phase 0.2's boot guard should refuse, but verify it in the rehearsal.
- **The legacy estate must be read-only during parallel run**, or the two diverge.

## Validation

Execute the rehearsal. Record timings and every deviation.

## Acceptance criteria

- [ ] **The runbook is rehearsed end to end at least once**, with timings recorded
- [ ] **The rollback is rehearsed too**
- [ ] Every step has a failure signal and a rollback action
- [ ] The parallel-run exit criterion is defined and measurable
- [ ] Credential re-provisioning is specified, rehearsed, and out-of-band
- [ ] The three MANUAL decisions are surfaced as **blocking checkpoints** and answered
- [ ] `migration_log` records the source version state and the commit SHA
- [ ] The UTF-16 dumps are gone
- [ ] The rehearsal confirms the production config guard fires

## Documentation updates

- `docs/deployment/` — **the runbook itself**
- `docs/migration/` — the cutover and rollback procedures
- `docs/admin-guide/user-management.md` — re-provisioning
- `docs/troubleshooting/` — what to do when a step fails
- All four locales

## Git checkpoint

The runbook; the rehearsal record; the MANUAL decisions. Push after each.

## Handover artefacts

- **The rehearsed runbook with real timings** — the deliverable
- The three MANUAL decisions, answered and recorded
- The parallel-run exit criterion

## Explicitly out of scope

- **Executing the real cutover.** That is a business decision on a business schedule.
- Decommissioning the legacy estate — **only after the retention decisions are honoured.**

## Resume instructions

Read the checkpoint and the runbook. If a rehearsal record with timings exists and the three
MANUAL decisions are answered, this stage is done.

## TOKEN-BUDGET SAFE EXECUTION

1. Draft the runbook, **then rehearse it**, then correct it from what actually happened.
2. **No specialist agents.**
3. Use `context-mode` for rehearsal output.
4. Checkpoint after each rehearsed step.
5. Commit coherently.
6. **Tear down the scratch environment** before ending the session.
7. If interrupted mid-rehearsal, record exactly which step you reached and whether the scratch
   environment is still up.
