# PHASE 8.1 — Prove the production stack

**Model:** Sonnet · **Effort:** high

## Purpose

Run the production stack end to end for the first time, and make `/health` tell the truth.

> **The audited stack is the *development* overlay. No production hardening has ever run**
> (INF-03). `docker-compose.prod.yml` is multi-stage, non-root, resource-limited and
> healthchecked — **and has never been executed.**
>
> **`/health` returns `200 status:"ok"` even when Postgres and Redis are down** (INF-02).

## Scope

1. Run `docker-compose.prod.yml` end to end. Fix what breaks.
2. **Fix `/health`** so it reports red when a dependency is down.
3. Add an **Oracle boot-time version gate** (D-019): refuse to start against a server below
   12.1, loudly. **Do not build a capability table with one row** — the live server is 12.2 and
   `OFFSET/FETCH` is already correct.

## Prerequisites

Phase 0.1 (CI runs). Phase 6.4 (compose port publications fixed).

## Required files to read first

- `AUDIT_DETAILED_FINDINGS.md` — `INF-02`, `INF-03`, `INF-12`
- `docs/master-plan/DECISION_REGISTER.md` D-019
- `discoverer-neo/docker-compose.prod.yml`
- `discoverer-neo/nginx/`
- `backend/src/routes/health.ts`
- `backend/src/services/oracle-driver.ts` — the thick-mode fail-fast boot check
- `docs/deployment/docker.md`

## Required tooling

**Skills:** none. **Agents:** none.
**Plugins / MCPs:** `context-mode` (container logs), `context7` (current Docker and node
guidance).

## Implementation instructions

- **Run it before changing it.** Record every failure; several may be configuration, not code.
- `/health` must probe real dependencies. There are already real probes elsewhere in the
  codebase — reuse them. Distinguish **liveness** (the process is up) from **readiness**
  (dependencies are reachable); an orchestrator needs both, and conflating them is how INF-02
  happened.
- The Oracle version gate belongs at pool creation, and must **name the version it found and
  the minimum it needs.**
- **Thick mode is mandatory** for this estate — the pre-11g password verifier means thin mode
  cannot authenticate. Confirm the production image carries the Oracle Instant Client.

## Tests

- `/health` returns non-200 with Postgres stopped
- `/health` returns non-200 with Redis stopped
- Liveness and readiness are separately reportable
- The Oracle version gate refuses a simulated < 12.1 server, naming both versions
- The production compose starts, serves, and passes its own healthchecks

## Security checks

- **The production stack is the one that faces the network.** Confirm Phase 6.4's fixes hold
  here: no `0.0.0.0` Postgres or Redis, `/metrics` off the public listener, CORS allowlisted.
- Confirm the containers run **non-root** as the file claims.
- Confirm no default `ENCRYPTION_KEY` or `JWT_SECRET` can start it — Phase 0.2's guard should
  fire.

## Validation

```bash
cd discoverer-neo && docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
curl -sf http://localhost/health || echo "health failed"
docker compose -f docker-compose.prod.yml down
```

Stop Postgres, re-curl `/health`, confirm non-200.

## Acceptance criteria

- [ ] **`docker-compose.prod.yml` starts, serves and passes its healthchecks**
- [ ] `/health` is **red when Postgres or Redis is down**
- [ ] Liveness and readiness are distinguishable
- [ ] The Oracle version gate refuses < 12.1, naming both versions
- [ ] **No capability table was built**
- [ ] Containers run non-root
- [ ] Phase 0.2's config guard fires in the production image
- [ ] Phase 6.4's network fixes hold

## Documentation updates

- `docs/deployment/docker.md` — **the first accurate production run**, with the commands
- `docs/deployment/monitoring.md` — liveness vs readiness
- `docs/troubleshooting/` — what a red `/health` means

## Git checkpoint

Compose fixes; `/health`; the version gate. Push after each.

## Handover artefacts

- The working production run, with the commands that produced it
- A list of everything that had to be fixed to get there

## Explicitly out of scope

- Metrics content. Phase 8.2.
- Backups and Redis durability. Phase 8.3.
- Documentation reconciliation. Phase 8.4.

## Resume instructions

Read the checkpoint, run the production compose. If it serves and `/health` is honest, this
stage is done.

## TOKEN-BUDGET SAFE EXECUTION

1. **Run first, record failures, then fix.** The failure list scopes the work.
2. **No specialist agents.**
3. Use `context-mode` for container logs — they are voluminous.
4. Checkpoint the failure list immediately.
5. Commit coherently.
6. **Always `down` the stack before ending a session** — a dev machine left running a
   production compose is a surprise for the next session.
7. If interrupted, record which failures are fixed and whether the stack is running.
