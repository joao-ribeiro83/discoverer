# Phase 8.4 checkpoint — documentation reconciliation

## Status

| Item | State |
|---|---|
| `docs/api/endpoints.md` generated from live Swagger (DOC-05) | Done — 51% → 100% by construction; regenerating twice is idempotent |
| `docs/api/openapi.yaml` regenerated from the same spec | Done — it was stale (14 paths missing) but not fabricated, unlike endpoints.md |
| Generation wired into CI so it cannot drift again | Done — `.github/workflows/ci.yml` backend job runs `generate-spec` and `git diff --exit-code` on `docs/api/` |
| 5 stale plans archived, not deleted (D-001) | Done — moved to `docs/archive/`, each with a superseded header naming DOC-01 |
| Dangling references to the old repo-root paths fixed | Done — `discoverer-neo/CLAUDE.md`, `migrate/EUL_SCHEMA_GROUND_TRUTH.md`, `migrate/src/scripts/README.md`, `migrate/src/services/d4wkdmp-differ.ts` |
| Phantom endpoint in prose docs (not just endpoints.md) | Found and fixed — `admin-guide/oracle-introspection.md`'s automation example called a nested `business-areas/:baId/folders/:folderId/introspect` route that never existed; the real route is `POST /api/data-sources/{dsId}/introspect`. Fixed in all 4 locales |
| Locale parity: admin-guide, user-guide | Already complete — no gap found |
| Locale parity: troubleshooting | Was missing 4 of 6 files per locale (formula-refusals, health-check, oracle-pool-and-queues, recovery) — translated into es-ES, fr-FR, pt-PT (12 files) |
| Locale-parity check wired into CI | Done — `scripts/docs-i18n-check.mjs`, run in the frontend CI job beside the existing i18n check |
| No production-readiness claims left in `docs/` | Checked — none found |
| No real credentials/hostnames in live docs | Checked — `docs/deployment/configuration.md`'s dev-only defaults are clearly labeled and boot-refused in production; no other credential-shaped strings found |

## What generation actually changed

`backend/src/scripts/generate-spec.ts` now does three things from one `app.swagger()`
call instead of one: writes `openapi-spec.json` (gitignored, unchanged), `docs/api/openapi.yaml`,
and a new hand-rolled `docs/api/endpoints.md` renderer that groups by tag and prints a type
sketch (not a fabricated example) for every request body and response, since the schemas carry
no `example` values to reuse honestly. 84 paths, 127 operations today — more than the audit's
"114 routes" because that count was taken straight from route files seven commits ago; several
routes (e.g. `/health` and `/api/health` both existing) are real, not doc bugs.

## What the reconciliation pass did **not** do, on purpose

- Did not translate `developer-guide/`, `api/`, `deployment/`, `migration/`, `decisions/` or the
  master-plan into the three locales. That was never the existing convention — only
  `admin-guide/`, `user-guide/` and `troubleshooting/` have locale trees at all, which reads as a
  deliberate scope (end-user/admin-facing docs get localized; engineering/ops docs don't). The
  new parity check only enforces parity within that existing scope; extending localization to new
  categories is a product decision this phase didn't have standing to make unilaterally.
- Did not rewrite `AUDIT_DETAILED_FINDINGS.md` or edit the archived plans' body content — both
  explicitly out of scope. The archived plans' pre-existing private-network IP addresses
  (`docs/archive/DISCOVERER_NEO_WORKSHEET_FIDELITY_PLAN.md`, dated 2026-08-25, RFC1918 ranges)
  were left untouched as historical evidence rather than redacted; flagging here rather than
  acting unilaterally on someone else's migration notes.
- Did not line-by-line audit every one of the ~60 English docs against the code. Most guides
  carry recent mtimes from the phases that own them (5.x, 6.x, 7.x, 8.1–8.3) and updated
  themselves as they shipped; this phase's grep-based sweep for known drift patterns (phantom
  routes, stale stats, production-readiness claims) found one real bug (the introspection
  example above) and no others.
