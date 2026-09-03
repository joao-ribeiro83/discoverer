# PHASE 0.2 — Credential remediation, tier 0

**Model:** Opus · **Effort:** high

## Purpose

Remove the credential exposure. **174 Oracle data-source passwords and 5 user passwords sit
in `audit_log` in cleartext**, and the `ENCRYPTION_KEY` protecting every other stored
credential defaults to a string **published in this repository**. Nothing refuses to boot in
production with that default in force.

## Scope

1. **SEC-02** — the audit hook stores full request bodies and redacts only *exact* key names.
   `passwordEnc` (which the client sends as **plaintext** before the server encrypts it) and
   `newPassword` are not listed. Redact **by substring**: `password`, `secret`, `token`,
   `credential`.
2. **Purge** the existing cleartext rows from `audit_log`.
3. **F-03 / INF-08** — refuse to boot in `NODE_ENV=production` with a default
   `ENCRYPTION_KEY` or `JWT_SECRET`. Add both to `.env.example`.
4. Rotate the encryption key and **re-encrypt** stored Oracle credentials.
5. **INF-07** — TTL + boot sweep for the nine plaintext credential CSVs in
   `credential-file.service.ts`. Delete the existing nine.
6. **F-17** — remove the active seed data source carrying a placeholder credential.

## Prerequisites

Phase 0.1 complete — the work must have somewhere to go.

## Required files to read first

- `docs/master-plan/research/security-analysis.md` §4 Tier 0 — **the authoritative brief**
- `discoverer-neo/backend/src/plugins/audit.ts`
- `discoverer-neo/backend/src/config.ts` (~line 147)
- `discoverer-neo/backend/src/lib/encryption.ts`
- `discoverer-neo/backend/src/services/credential-file.service.ts`
- `discoverer-neo/.env.example`

## Required tooling

**Skills:** none. **Agents:** none.
**Plugins / MCPs:** `context-mode` (keep psql result sets out of context), `context7` (current
Node crypto / Fastify guidance).

## Implementation instructions

- **Redact by substring, case-insensitively**, on both keys and nested object keys. Test with
  `passwordEnc`, `newPassword`, `password`, `apiToken`, `dbCredential`.
- The purge is a **Drizzle migration**, not an ad-hoc script, so it runs on every environment.
- The boot guard belongs in `config.ts` and must **throw**, not warn. It applies only when
  `NODE_ENV === 'production'` so development stays frictionless.
- Key rotation needs a re-encryption path: decrypt with the old key, encrypt with the new,
  in one transaction. **Back up first** with `scripts/backup.sh`.
- The credential-file sweep runs on boot and on a timer.

## Tests

- A test asserting `passwordEnc` and `newPassword` are redacted from a captured request body
- A test asserting the app **throws on boot** in production with each default in turn
- A test asserting a credential file older than the TTL is removed by the sweep
- Re-run the full backend suite

## Security checks

- After the purge: `SELECT` over `audit_log` for each of the four substrings returns **zero**
  rows containing a credential value
- The new `ENCRYPTION_KEY` is **not** committed — `.env.example` carries a placeholder and a
  generation command only
- Confirm `GET /api/data-sources` still returns `hasPassword: boolean` and never ciphertext

## Validation

```bash
cd discoverer-neo && npm test --workspace backend
docker -c default exec discoverer-neo-postgres psql -U discoverer -d discoverer_neo \
  -c "SELECT count(*) FROM audit_log WHERE request_body::text ILIKE '%password%';"
```

## Acceptance criteria

- [ ] A test proves `passwordEnc` and `newPassword` are redacted
- [ ] **Zero cleartext credentials remain in `audit_log`**
- [ ] The app **fails to boot** in production with a default `ENCRYPTION_KEY` or `JWT_SECRET`
- [ ] Both variables are documented in `.env.example`
- [ ] Stored Oracle credentials are re-encrypted under a new key and still authenticate
- [ ] No credential CSV older than the TTL survives a boot
- [ ] The placeholder seed data source is gone

## Documentation updates

- `docs/deployment/configuration.md` — a key rotation runbook
- `docs/admin-guide/security.md` — the redaction policy
- Mirror into `es-ES`, `fr-FR`, `pt-PT`

## Git checkpoint

One commit per numbered scope item. **Commit the redactor fix before the purge migration** —
purging while the hook still writes cleartext re-creates the problem on the next request.

## Handover artefacts

- The rotation runbook
- A note in `MASTER_PLAN_GENERATION_CHECKPOINT.md` recording that Oracle credentials were
  rotated, and when

## Explicitly out of scope

- **SEC-11 read auditing.** It must land *after* this redaction is proven (D-093) — auditing
  more requests with an exact-match redactor would multiply the exposure
- Token lifecycle (SEC-01, SEC-12) — Phase 6.1
- IDOR (SEC-03) — Phase 6.2
- CORS, `/metrics`, CVEs — Phase 6.4

## Resume instructions

Read the checkpoint. Then run the `audit_log` count above: if it returns zero and the boot
guard test exists, this stage is done. Otherwise resume at the first unchecked acceptance
criterion.

## TOKEN-BUDGET SAFE EXECUTION

1. Work through the six scope items in order; each is independently committable.
2. **No parallel specialist execution.** This stage needs no agents.
3. Checkpoint after each commit.
4. Use `context-mode` for psql output — do not read result sets into context.
5. **Back up before rotating.** If the session dies mid-rotation, the checkpoint must say so.
6. Leave the working tree committed and the test suite green before stopping.
7. If interrupted mid-rotation, record in the checkpoint exactly which credentials were
   re-encrypted and which were not.
