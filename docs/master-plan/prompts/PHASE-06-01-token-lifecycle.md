# PHASE 6.1 — Token lifecycle

**Model:** Opus · **Effort:** high

## Purpose

Stop a demoted, deactivated or deleted user keeping a live session for two weeks.

> **`/api/auth/refresh` never checks the logout blacklist and re-signs `role` from the incoming
> token rather than the database.** A demoted, deactivated or deleted user keeps a live session
> for **up to ~14 days**, at their *old* role.

## Scope

1. **SEC-01** — refresh checks the logout blacklist **and re-reads role and account status from
   the database** on every refresh.
2. **SEC-12** — the access token is currently its own refresh credential, giving a ~14-day
   effective lifetime. Introduce **separate, revocable refresh tokens** with independent
   storage.
3. **SEC-05** — no rate limiting and no account lockout on login. Add both.

## Prerequisites

Phase 0.2 (tier-0 credential work done).

## Required files to read first

- `docs/master-plan/research/security-analysis.md` §4 Tier 2 — **the authoritative brief**
- `AUDIT_DETAILED_FINDINGS.md` — `SEC-01`, `SEC-05`, `SEC-12`
- `backend/src/routes/auth.ts`
- `backend/src/plugins/auth.ts`
- `backend/src/services/user.service.ts`

## Required tooling

**Skills:** none. **Agents:** none.
**Plugins / MCPs:** `context7` (current Fastify auth and rate-limit plugin guidance —
training data will be stale), `typescript-lsp`.

## Implementation instructions

- **Refresh must be a database read, not a token re-sign.** Role, `is_active` and existence all
  come from `users`, every time.
- Refresh tokens live in Redis or Postgres with an explicit revocation path. Rotate on use.
- Rate limiting is per-IP **and** per-account — per-IP alone is trivially bypassed, per-account
  alone enables denial of service against a known user. Lockout must be temporary and
  logged.
- Keep the `!migrat` sentinel behaviour intact — migrated users must still **fail closed**.

## Tests

- A user deactivated after issuing a token **cannot refresh**
- A user demoted after issuing a token refreshes at the **new** role
- A logged-out token **cannot refresh**
- A revoked refresh token fails
- Refresh token rotation invalidates the previous one
- Rate limiting triggers after N attempts, per IP and per account
- Lockout expires
- A migrated user with the `!migrat` sentinel still cannot log in

## Security checks

This stage **is** a security check. Additionally:
- Confirm the blacklist is checked on **every** authenticated path, not only refresh.
- Confirm lockout cannot be used to deny service to an arbitrary account indefinitely.
- Confirm rate-limit state is not itself a credential-leak vector in logs.

## Validation

```bash
cd discoverer-neo && npm test --workspace backend
```

## Acceptance criteria

- [ ] **A deactivated user's refresh fails within one access-token lifetime, not fourteen days**
- [ ] Role is re-read from the database on refresh
- [ ] Refresh tokens are separate, revocable and rotated
- [ ] Login is rate-limited per IP and per account, with temporary lockout
- [ ] Lockout events are audited
- [ ] The `!migrat` sentinel still fails closed

## Documentation updates

- `docs/admin-guide/user-management.md` — deprovisioning now takes effect immediately
- `docs/api/authentication.md` — the refresh flow
- `docs/deployment/configuration.md` — rate-limit settings
- All four locales

## Git checkpoint

One commit per numbered item. Push after each.

## Handover artefacts

- The effective session lifetime after deprovisioning, measured

## Explicitly out of scope

- IDOR (SEC-03) and `custom_sql` validation (SEC-04). Phase 6.2.
- RLS. Phase 6.3.
- CORS, `/metrics`, CVEs, read auditing. Phase 6.4.

## Resume instructions

Read the checkpoint; if the deactivation test passes, this stage is done.

## TOKEN-BUDGET SAFE EXECUTION

1. Refresh → refresh tokens → rate limiting. Commit each.
2. **No specialist agents.**
3. Checkpoint after each commit.
4. Commit coherently; leave the backend suite green.
5. If interrupted, record which of the three items are complete.

---

## ⟐ CORRECTION — the refresh defect is bigger than the scope says (R-13 / C-03 / C-10)

v1.0's scope reads *"Refresh checks the logout blacklist and re-reads role and account status
from the database."* That describes **adding a call**. There are **three defects on one route**
(`routes/auth.ts:143-200`):

1. **`POST /api/auth/refresh` has no `preHandler` at all.** Its route options carry only
   `schema`. `isTokenBlacklisted` is wired into the `fastify.authenticate` decorator
   (`plugins/auth.ts:67-78`), which this route never invokes. **The blacklist is structurally
   unreachable, so logging out and immediately refreshing returns a fresh, un-blacklisted
   token. Logout provides no revocation at all.**
2. **The role is copied from the presented token** —
   `reply.jwtSign({ sub: payload.sub, email: payload.email, role: payload.role })` — and never
   re-read from the database.
3. **The 7-day grace window self-renews.** `auth.ts:189-193` compares `payload.exp + 7 days`
   against now, and the new token gets a fresh `exp`. **A token refreshed weekly never expires.**

### The acceptance criterion is also insufficient

*"A deactivated user's refresh fails within one token lifetime"* passes if **only defect 2** is
fixed, while a blacklisted token still refreshes freely. Add both:

- [ ] **A token blacklisted by logout is rejected by `POST /api/auth/refresh`.** This is the gate
      that proves the `preHandler` exists.
- [ ] **A token cannot be refreshed indefinitely past its original issue.** This closes the
      self-renewing window.
