# PHASE 6.4 — Exposure surface and dependency hygiene

**Model:** Sonnet · **Effort:** medium

## Purpose

Close the remaining exposure surface and clear the dependency backlog.

## Scope

| ID | Finding | Fix |
| -- | ------- | --- |
| **INF-13** | **CORS reflects any origin with credentials** | Allowlist |
| **INF-09** | `/metrics` proxied **unauthenticated on the public TLS listener**, against its own documented instruction | Bind internal, or authenticate |
| **INF-12** | `docker-compose.yml` is titled "Production" and publishes **Postgres and Redis to `0.0.0.0`** | Remove the port publications. It is not the production file — `docker-compose.prod.yml` is |
| **SEC-07** | Raw Oracle `ORA-` text reaches any user who can execute a map | Map to the `kind` taxonomy; log detail server-side |
| **BE-11** | The `kind` taxonomy covers one endpoint; **no correlation id reaches the client** | Extend the taxonomy; add a correlation id |
| **SEC-10** | Data-source host/port interpolated into the Oracle connect descriptor — **SSRF**, admin-gated | Validate host against an allowlist or a resolved-address check |
| **SEC-11** | **Read operations are never audited**, so IDOR exfiltration leaves no trail | Audit reads on the metadata routes |
| **INF-05** | **No dependency, image or secret scanning; 11 advisories live, 6 high** | Add scanning to CI; clear the advisories |
| **F-16** | A decryption failure surfaces as a **bare unhandled 500** | Handle it — it is the signal a key rotation went wrong |
| **F-14** | `/api/data-sources/{id}/tables` returns **404 KB unpaginated** | Paginate |

## The one hard ordering rule

> **SEC-11's read auditing must land AFTER Phase 0.2's redaction fix is proven** (D-093).
>
> Auditing more requests while the redactor is still exact-match would **multiply** the
> cleartext exposure rather than reduce it. Confirm Phase 0.2's substring redaction is in place
> and tested before enabling read auditing.

## Prerequisites

Phase 6.3. **Phase 0.2 verified** — check that the redaction test exists and passes.

## Required files to read first

- `docs/master-plan/research/security-analysis.md` §4 Tier 4 and §5 — **the authoritative
  brief**
- `docs/master-plan/DECISION_REGISTER.md` D-093
- `backend/src/plugins/{cors,audit,metrics}.ts`
- `backend/src/services/oracle-connection-pool.ts` — the connect descriptor
- `backend/src/middleware/` — the `kind` taxonomy
- `discoverer-neo/nginx/`
- `discoverer-neo/docker-compose.yml`
- `.github/workflows/ci.yml`

## Required tooling

**Skills:** none. **Agents:** none.
**Plugins / MCPs:** `context7` (**essential** — CVE remediation and current plugin guidance;
training data will be stale), `security-guidance` (this is its phase).

## Implementation instructions

- **Verify Phase 0.2 first.** Run its redaction test. If it does not exist or does not pass,
  **stop and fix that before touching SEC-11.**
- CORS: an explicit origin allowlist from config, never a reflector. Credentials require an
  exact origin match.
- The correlation id should flow request → log → client error response, so a user can quote it.
- SSRF: the host allowlist belongs in configuration. This is admin-gated, which bounds it —
  do not over-engineer, but do not skip it.
- Advisories: `npm audit` and upgrade. **Where a fix is a major version bump, use `context7` to
  check for breaking changes before upgrading.** Record anything deliberately not upgraded,
  with the reason.

## Tests

- CORS rejects an unlisted origin with credentials
- `/metrics` is unreachable from the public listener
- An Oracle error surfaces as a `kind`, not raw `ORA-` text, with a correlation id
- A hostile data-source host is rejected
- A metadata read is audited — **and the audited body contains no credential**
- A decryption failure returns a handled error
- `/tables` paginates
- CI fails on a high advisory

## Security checks

The whole stage. Additionally:
- **After enabling read auditing, re-run Phase 0.2's cleartext query** over `audit_log` and
  confirm it is still zero.
- Confirm the correlation id is not itself sensitive.

## Validation

```bash
cd discoverer-neo && npm test --workspace backend && npm audit --audit-level=high
```

```sql
SELECT count(*) FROM audit_log WHERE request_body::text ILIKE '%password%';  -- must be 0
```

## Acceptance criteria

- [ ] CORS uses an allowlist
- [ ] `/metrics` is off the public listener
- [ ] `docker-compose.yml` no longer publishes Postgres and Redis to `0.0.0.0`
- [ ] Oracle errors surface as `kind` + correlation id
- [ ] A hostile host is rejected
- [ ] **Reads are audited, and the cleartext count is still zero**
- [ ] Decryption failure is handled
- [ ] `/tables` paginates
- [ ] **0 high advisories; scanning runs in CI**
- [ ] Anything not upgraded is recorded with a reason

## Documentation updates

- `docs/deployment/{configuration,ssl,monitoring}.md`
- `docs/admin-guide/audit-logging.md` — read auditing
- `docs/troubleshooting/` — correlation ids
- All four locales

## Git checkpoint

One commit per finding. Push after each.

## Handover artefacts

- The advisory count before and after, with any deliberate exceptions
- Confirmation that the cleartext count is still zero after read auditing

## Explicitly out of scope

- Proving `docker-compose.prod.yml`. Phase 8.1.
- Metrics content. Phase 8.2.
- Redis durability. Phase 8.3.

## Resume instructions

Read the checkpoint; resume at the first unchecked finding.

## TOKEN-BUDGET SAFE EXECUTION

1. **Verify Phase 0.2's redaction first.** Then work the table top to bottom.
2. **No specialist agents.**
3. Route bulk dependency upgrades to a **Haiku** sub-agent if they sprawl — one agent.
4. Checkpoint after each finding.
5. Commit coherently; leave CI green.
6. If interrupted, record which findings are closed and the current advisory count.
