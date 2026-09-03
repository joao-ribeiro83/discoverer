# PHASE 8.4 — Documentation reconciliation

**Model:** Sonnet · **Effort:** high

## Purpose

Make the documentation true.

> **`docs/api/endpoints.md` is 51 % accurate: 23 phantom endpoints, 56 real ones undocumented**
> (DOC-05). Meanwhile Swagger is live and correct at `/api/docs`.
>
> **The 193 KB session plan's 200+ green checkmarks are acceptance criteria, not completion
> records** (DOC-01). **The one document claiming *verified* status is seven weeks stale, and
> wrong in the understating direction** (DOC-02).

## Scope

1. **Generate `docs/api/endpoints.md` from the live Swagger spec** rather than maintaining it
   by hand. `backend/src/plugins/swagger.ts:51` sets `routePrefix: '/api/docs'`;
   `/api/docs/json` returns the spec. `backend/package.json` already has a `generate-spec`
   script.
2. **Retire or clearly mark the stale planning documents**: `DISCOVERER_NEO_SESSION_PLAN.md`,
   `DISCOVERER_NEO_EXECUTION_PLAN.md`, `DISCOVERER_NEO_PLAN_REVIEW.md`,
   `DISCOVERER_NEO_SUMMARY.md`, `DISCOVERER_NEO_WORKSHEET_FIDELITY_PLAN.md`.
3. **Reconcile the whole `docs/` tree** against the code as it now stands, after eight phases
   of change.
4. Ensure all four locales stay in sync — `en`, `es-ES`, `fr-FR`, `pt-PT`.

## The rule for the stale plans

**Do not delete them.** They are evidence of prior reasoning (D-001). Move them to
`docs/archive/` with a header stating the date they were superseded and pointing at
`MASTER_IMPLEMENTATION_PLAN.md`.

**Add a header to each explaining that its checkmarks are acceptance criteria, not completion
records** — that misreading cost the project real time.

## Prerequisites

Phase 8.1. Ideally after Phases 5–7, so the documentation describes the finished system.

## Required files to read first

- `AUDIT_DETAILED_FINDINGS.md` — `DOC-01`, `DOC-02`, `DOC-05`
- `docs/master-plan/DECISION_REGISTER.md` D-001
- `backend/src/plugins/swagger.ts`, `backend/src/scripts/generate-spec.ts`
- `discoverer-neo/docs/` — the full tree
- `MASTER_IMPLEMENTATION_PLAN.md` §9 — the documentation programme

## Required tooling

**Skills:** none.
**Agents:** **this is the one stage where a specialist may genuinely help** — a documentation
reconciliation across `docs/**` × 4 locales is breadth that exceeds one context. If you use
one, run **exactly one, foreground, at a time**, and prefer **Haiku** for the mechanical
locale sweep.
**Plugins / MCPs:** `context-mode`.

## Implementation instructions

- **Generate, do not hand-maintain.** A hand-written endpoint list drifted to 51 % accuracy in
  weeks; it will do so again. Wire generation into CI so it cannot drift.
- Reconcile in this order: developer guide → API → admin guide → deployment → user guide →
  troubleshooting. Each phase from 0 to 7 should have updated its own docs; this stage catches
  what they missed and checks the whole for coherence.
- **The locale sweep is mechanical** — English first, then propagate. Do not translate
  creatively; match the existing register.
- Check that **no document still claims production readiness.** *"No production claim in any
  existing document survived contact with the running system."*

## Tests

- A CI check asserting `docs/api/endpoints.md` matches the live spec
- A locale-parity check: every key present in `en` exists in the other three

## Security checks

- **Documentation must not contain real credentials, hostnames or customer identifiers.** The
  audit found `admin@discoverer.local` / `admin123` documented as a seed value — acceptable for
  a seed, but confirm nothing real leaked into the tree.
- Do not document internal-only endpoints in a user-facing guide.

## Validation

```bash
cd discoverer-neo && npm run generate-spec --workspace backend
git diff --stat docs/
```

## Acceptance criteria

- [ ] **`docs/api/endpoints.md` is generated from the live spec and matches it**
- [ ] Generation is wired into CI so it cannot drift
- [ ] Stale plans are moved to `docs/archive/` with a superseded header
- [ ] **Each archived plan carries the "checkmarks are acceptance criteria" note**
- [ ] The `docs/` tree matches the code
- [ ] All four locales are in parity, with a check enforcing it
- [ ] **No document claims production readiness that the system has not demonstrated**
- [ ] No real credentials or customer identifiers in docs

## Documentation updates

This stage **is** the documentation update. Cover all ten categories: architecture,
development, API, migration, deployment, administration, user guide, security, operations,
troubleshooting.

## Git checkpoint

Generation; archival; per-guide reconciliation; the locale sweep. Push after each.

## Handover artefacts

- The endpoint accuracy before and after
- The list of archived documents

## Explicitly out of scope

- Rewriting the audit documents — they are a dated record and stay as they are.
- Deleting the stale plans. **Archive, do not delete.**

## Resume instructions

Read the checkpoint, run `generate-spec` and diff. Resume at the first unreconciled guide.

## TOKEN-BUDGET SAFE EXECUTION

1. Generation first — it closes the largest single gap.
2. **If you use a subagent for the locale sweep: exactly one, foreground, Haiku.** Never
   several.
3. Use `context-mode` when comparing large document sets.
4. Checkpoint after each guide.
5. Commit coherently.
6. If interrupted, record which guides are reconciled and which locales are behind.
