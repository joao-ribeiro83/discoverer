# PHASE 0.1 — Commit the tree and wire CI

**Model:** Sonnet · **Effort:** medium

## Purpose

Make the project's work durable. **70 paths are untracked, there is no git remote, and CI has
never run because its workflows trigger on `main` while the repository is on `master`.** One
`git clean` ends the most valuable work in this project — a reverse-engineered `.DIS` decoder
validated against Oracle's own tooling.

**This is the entry point of the entire Master Implementation Plan. Nothing else is safe
until it is done.**

## Scope

1. Review all untracked paths and classify: commit / ignore / delete.
2. `.gitignore` the ~40 MB of database dumps, `storage/`, `backups/`, `credentials/`.
3. Delete the junk path `discoverer-neo/frontend/[A-Z][a-z][a-zA-Z` (a botched glob written as
   a filename).
4. Commit the deletion of `.claude/agents/` and `.claude/skills/` (2 706 staged deletions).
5. Commit everything else.
6. Add a git remote.
7. Repoint `.github/workflows/ci.yml` and `docker.yml` from `main` to `master` — **or** rename
   the branch. Make CI actually run.
8. Correct `CLAUDE.md`, which still describes `.claude/agents/` and `.claude/skills/` as
   present on disk.

## Prerequisites

None. This is the first stage.

## Required files to read first

- `MASTER_IMPLEMENTATION_PLAN.md` §1 and Phase 0
- `docs/master-plan/research/codebase-inventory.md` §1 — the full untracked list
- `discoverer-neo/.github/workflows/ci.yml`
- `discoverer-neo/.gitignore`
- `CLAUDE.md` (repository root)

## Required tooling

**Skills:** none. **Agents:** none — this is single-context work.
**Plugins / MCPs:** git via Bash. `github` MCP if its auth is fixed; otherwise use `gh` CLI
via Bash.

## Implementation instructions

- Run `git status --porcelain` and work through the list. **Do not blind-commit.**
- **Commit, do not ignore:** `backend/src/lib/sql/totals.ts`, all of `backend/src/scripts/`,
  `backend/src/services/credential-file.service.ts`, the `__tests__` additions,
  `drizzle/0005..0009*.sql` + their `meta/*_snapshot.json`,
  `frontend/src/components/data-table/CrosstabTable.tsx`, `worksheet-rows.ts`,
  `admin/FolderSharingDialog.tsx`, the frontend test additions, `docs/decisions/`,
  `docs/migration/user-credentials.md`, `discoverer-neo/CLAUDE.md`, all eight `AUDIT_*.md`,
  and every `docs/master-plan/` artefact.
- **Ignore:** `*.sql` dumps at the repo root of `discoverer-neo/` (`backup-before-reset.sql`,
  `map_tables_backup.sql`), `backups/`, `storage/`, `credentials/`.
- **Do not `git add -A` blindly** — the credential CSVs must never be committed.
- Prefer several coherent commits (ignores; deletions; source; docs) over one.

## Tests

Run before committing and confirm they still pass after:

```bash
cd discoverer-neo && npm run typecheck --workspaces
```

## Security checks

- **Grep every file you are about to commit for credentials before committing.** Nine
  plaintext credential CSVs exist on disk (INF-07). They must be ignored or deleted, never
  committed.
- `.env` must remain ignored. `.env.example` must contain no real values.
- Confirm no `*.sql` dump containing the `data_sources` table enters the history — a 20 MB one
  is untracked today (INF-06).

## Validation

```bash
git status --porcelain          # nothing unexpected
git remote -v                   # non-empty
git log --oneline -5
```

Then push and confirm a CI run appears and passes.

## Acceptance criteria

- [ ] `git status --porcelain` shows nothing unexpected
- [ ] `git remote -v` is non-empty and the branch is pushed
- [ ] **A CI run exists and passes** — typecheck, lint, and all three test suites
- [ ] No credential file and no database dump is in the history
- [ ] `CLAUDE.md` no longer claims `.claude/agents/` and `.claude/skills/` are on disk

## Documentation updates

- `CLAUDE.md` — correct the agents/skills description
- `discoverer-neo/README.md` — add the remote and the CI badge if one exists

## Git checkpoint

Several commits, then push. **The push is the deliverable** — a local commit with no remote
does not satisfy this stage.

## Handover artefacts

- The pushed branch
- A passing CI run URL recorded in `MASTER_PLAN_GENERATION_CHECKPOINT.md`

## Explicitly out of scope

- Any source change beyond deleting the junk filename
- Credential rotation — that is 0.2
- Fixing failing tests — one backend test fails (F-23); it is 1.3's problem. If it blocks CI,
  mark it skipped **with a comment citing F-23**, do not delete it

## Resume instructions

Read `MASTER_PLAN_GENERATION_CHECKPOINT.md`, then `git status --porcelain` and
`git remote -v`. If the remote exists and CI is green, this stage is done — go to
`PHASE-00-02-credential-remediation.md`.

## TOKEN-BUDGET SAFE EXECUTION

1. Work incrementally — classify paths in groups, commit each group.
2. **Do not run specialist agents in parallel.** This stage needs none at all.
3. Checkpoint after each commit.
4. Persist any surprise (an unexpected file, a secret found) into
   `MASTER_PLAN_GENERATION_CHECKPOINT.md` immediately.
5. Commit coherent changes; never leave a half-classified working tree.
6. Leave a resumable state: if you stop, `git status` must be self-explanatory.
7. If interrupted, write what remains unclassified into the checkpoint before the session ends.

---

## ⟐ CORRECTIONS from the plan review (A-10 / A-11 / D-07)

### 1. This stage is split in two. Commit the additions FIRST.

`git status --porcelain` shows **74 untracked paths** (not 70) **and 2 705 deletions already
staged** — the `.claude/agents/` and `.claude/skills/` removals, which v1.0 never mentioned.
v1.0's acceptance (*"nothing unexpected"*) forces both into one commit.

**Worse, the two governing documents disagree.** `CLAUDE.md` — project instructions, and
therefore authoritative for any session — describes `.claude/skills/` as a **live asset**
(*"Find one by reading `.claude/skills/SKILL_INDEX.md` on demand"*) and `.claude/agents-off/` as
recoverable by renaming. The tooling manifest says **REMOVE**. A session is told by one file to
preserve what another tells it to delete, and the deletion is 2 705 files with **no remote
history behind it**.

- **0.1a (this stage).** Commit the **additions** — the 74 untracked paths, `.gitignore`
  (including `d4dumps/`, `storage/`, `backups/`, `credentials/`), the junk-path deletion, the
  remote, and CI. **Durability must not be blocked on a policy question.**
- **0.1b (next stage).** Commit the `.claude/` deletion **together with the `CLAUDE.md`
  correction**, so the tree is never self-contradictory.

### 2. `docker.yml` has no branch filter to repoint

v1.0 says *"repoint `.github/workflows/{ci,docker}.yml` from `main` to `master`"*. Verified:
`ci.yml:5` and `ci.yml:7` carry `branches: [main]` and do need it. **`docker.yml` carries no
`branches:` key at all** — it triggers on `release: types: [published]` and `workflow_dispatch`.
There is nothing to repoint, and it cannot supply this stage's green run. **Scope is `ci.yml`
only.**

### 3. Turn coverage on while you are in the workflow file (D-07 / R-24)

There is **no `coverageThreshold` in any of the three workspaces**, no `--coverage` in any
script, and CI never measures it — the committed `coverage/` artefact is a stale local run
reporting lines 75.38% and **branches 56.1%**. Add `--coverage` to the three CI test steps, set
a **branch** threshold at the measured baseline in each workspace, and delete the committed
artefact so a stale number cannot be quoted again.
