# Phase 6.2 checkpoint — object-level authorisation

## Status

| Item | State |
|---|---|
| SEC-03 — the five entity `GET`-by-id routes gated | Already closed in Phase 1.2; confirmed still gated |
| SEC-03 — every `GET /:id` route scoped, enforced by a test | Done — `backend/src/__tests__/get-by-id-scoping.test.ts` |
| SEC-04 — `custom_sql` validated on UPDATE with the create-path function | Done — `assertValidFolderSql`, called from `create` and `update` |

## SEC-04

`folder.service.update` had no SQL check. Create's inline block is now
`assertValidFolderSql(folderType, customSql)`, called by both. Update validates
the folder as it will be *after* the write — the body's type/SQL, falling back
to the stored row — so a PUT that changes only the type to COMPLEX is caught
too. The route maps the error to `400`, as create does.

Tests (`folders.test.ts` › SQL validation › on UPDATE): five hostile payloads,
each sent to POST and PUT, must both 400 with an identical message and leave
the stored SQL unchanged; type-to-COMPLEX without SQL is refused; a valid
SELECT update succeeds.

Live impact measured: `discoverer_neo` holds 212 folders, all TABLE, zero
COMPLEX. The frontend sends `customSql` on every folder edit, so a stored
COMPLEX folder failing the validator would become uneditable — there are none.

## Routes audited

Every `fastify.get` route whose path carries a `:param`, across all 20 route
files. **None needed fixing in this stage.** The five that did —
`/api/folders/:id`, `/api/items/:id`, `/api/items/:id/descendants`,
`/api/joins/:id`, `/api/hierarchies/:id` — were fixed in Phase 1.2 and are
still gated; `business-area-entity-auth.test.ts` "Entity GET-by-id routes are
grant-scoped" covers them behaviourally.

| Route | Gate |
|---|---|
| `/api/business-areas/:id`, `/:id/grants`, `/:id/users` | `requireBusinessAreaAccess('VIEW')` |
| `/api/business-areas/:baId/folders`, `/joins`, `/hierarchies`, `/maps` | `requireBusinessAreaAccess('VIEW')` |
| `/api/folders/:id`, `/api/folders/:id/business-areas` | `requireFolderAccess('VIEW')` |
| `/api/folders/:folderId/items`, `/api/folders/:folderId/joins/suggestions` | `requireFolderAccess('VIEW')` |
| `/api/items/:id`, `/:id/values`, `/:id/descendants` | `requireItemAccess('VIEW')` |
| `/api/joins/:id` | `requireJoinAccess('VIEW')` |
| `/api/hierarchies/:id` | `requireHierarchyAccess('VIEW')` |
| `/api/data-sources/:id`, `/api/data-sources/:dsId/tables` | `authorize('ADMIN','MANAGER')` |
| `/api/maps/:id`, `/:id/export`, `/:id/shares`, `/:id/history`, `/:id/executions/:jobId` | `loadMapWithAccess` in handler |
| `/api/maps/:mapId/schedules` | `canAccessMap(…, 'SCHEDULE')` in handler |
| `/api/schedules/:id`, `/:id/history`, `/:id/results/:resultId/download` | `loadOwnSchedule` in handler |
| `/api/exports/:jobId`, `/:jobId/download` | `loadOwnJob` in handler |
| `/api/audit/entity/:type/:id`, `/api/audit/user/:id` | admin only |
| `/api/migration/jobs/:jobId` | admin only |
| `/api/security/policies/:id`, `/:id/assignments` | admin only |
| `/api/users/:id` | admin only |
| `/api/custom-functions/:id` | **authenticate only — accepted.** `custom_functions` has no business-area column; the list route already returns every row to any signed-in user. Listed in the test's `UNSCOPED` with that reason. |

The scan's ceiling: it matches gate names as text inside each registration
block, so a gate named only in a comment would pass. The behavioural suite is
the backstop for the entity routes.

## Entitlement semantics

The prompt asks for all-of. What Phase 1.1 actually shipped, and recorded as a
deviation in its commit (`c143dc8`), is **all-of across folders, any-of within
one folder's business areas** — sharing a folder into a new area must widen
access, not revoke it from everyone already using it. A single-entity route
touches one folder, so the any-of-within rule is the one that applies. Left
unchanged; no new semantics introduced.

## Migration service account

Unaffected. It is deliberately unable to log in (`docs/migration/user-credentials.md`)
and the migrator writes through `migrate/`, never through these routes or
`folder.service.update`. Admin bypass is unchanged, so `/api/migration/*` runs
as before.

## Deferred, by design

- **SEC-11 read auditing** — Phase 6.4. It must land after Phase 0.2's
  redaction is proven (D-093). An IDOR read today still leaves no trail; the
  gate now refuses it instead.
- **`docs/api/endpoints.md`** — the 403 behaviour is recorded as a note in the
  Folders section, not rewritten. Phase 8.4 regenerates the file.

## Resume

Attempt a cross-BA `GET /api/folders/:id` as a non-admin; expect 403. Run
`npx jest src/__tests__/get-by-id-scoping.test.ts` in `backend/`.
