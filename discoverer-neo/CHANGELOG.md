# Changelog

All notable changes to Discoverer Neo. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the version
numbers follow [Semantic Versioning](https://semver.org/).

## How the version works

The version is `MAJOR.MINOR.PATCH`:

- **MAJOR** goes up when an upgrade breaks something that users or operators
  depend on: a removed feature, an incompatible API change, or a deployment
  change that needs manual work.
- **MINOR** goes up when a release adds a feature and nothing breaks.
- **PATCH** goes up when a release only fixes bugs.

Before 1.0.0 (the `0.x` versions), the app was not in production, so any
release could change anything.

Every workspace (`backend`, `frontend`, `migrate`) and the root carry the same
version. The backend reports it at `GET /health` and in the API docs, and the
sidebar shows it. A test fails if the manifests disagree. To release, add a
section below, then set the version everywhere from `discoverer-neo/`, and
regenerate the API spec (CI fails if `docs/api/openapi.yaml` is stale):

```bash
npm version 1.2.0 --workspaces --include-workspace-root --no-git-tag-version
npm run generate-spec --workspace @discoverer-neo/backend
```

**Versions 0.1.0 to 1.0.0 were assigned after the fact** (on 2026-09-25), from
the git history. Each one groups a finished phase of the build plan, and ends
at the commit named in its heading. The code carried `0.1.0` until 1.1.0.

## [2.1.1] — 2026-10-01 — the Maps page opens on All for admins

### Fixed

- An ADMIN or MANAGER who owned a few maps landed on the Maps page's "Mine"
  tab and saw only those, so the rest of the estate looked missing. Both roles
  see every map, so the page now opens on "All" for them. USER and VIEWER
  still open on "Mine" when they own maps.

## [2.1.0] — 2026-09-30 — the MANAGER role, corrected

**Why MINOR, not MAJOR:** the MANAGER loses rights below, but they were
granted by a misreading of what the role is for, not a feature anyone relied
on. This release corrects the role to what was intended.

### Changed
- A MANAGER can no longer change the data model. Every route that writes a
  business area, folder, item, join or hierarchy refuses a MANAGER with 403,
  whatever business-area grant they hold, and those five pages are ADMIN-only
  in the sidebar and router.
- Custom Functions and Data Sources are ADMIN-only: custom-function writes and
  database search, every data-source route, and the data-source table and
  introspect routes. Reading the custom-function list stays open to anyone
  signed in.
- On the Users page a MANAGER sees only MANAGER, USER and VIEWER accounts, and
  may now edit, activate and deactivate them, but not give the ADMIN role. An
  ADMIN account answers 404 to a MANAGER. Creating and deleting users and the
  credentials file stay ADMIN-only.
- A MANAGER keeps every map right: see, run, export, schedule, share, copy and
  change the owner of any map.

### Fixed
- Swagger and `docs/api/openapi.yaml` show the real app version, not a
  hardcoded 0.1.0.

### Build
- `npm run package` packs `discoverer-neo/` into `discoverer-neo.zip`, and
  local git hooks rebuild it on each version bump. The script runs under Node,
  so it works on Windows.
- `discoverer-neo/backups/` database dumps are no longer tracked.

### Documentation
- The MANAGER manuals lose their modelling, Custom Functions and Data Sources
  chapters and describe the new Users page, with new screenshots in all four
  locales. The admin guides and role tables match.

## [2.0.1] — 2026-09-30

### Fixed
- The sidebar shows Security, Audit Log and Migration to ADMIN only; their
  APIs refuse everyone else. `/admin/*` pages now have route guards: a USER or
  VIEWER who types one lands on the dashboard, and so does a MANAGER on
  Security, Audit Log or Migration.
- **Log out** now ends the session on the server (the access token is revoked
  and the refresh session deleted), not only in the browser.
- The Users page delete dialog says the delete is permanent and takes the
  user's schedules, runs and exports with it. It used to say "deactivate".
- A wrong current password on **Change password** no longer logs you out.
  `POST /api/auth/change-password` answers 400 for it, not 401.
- The Schedules map list no longer offers maps shared with you at
  **Can view**, which could never be scheduled.
- Administrators see the **SQL** and **Plan** buttons in the results panel
  again.

### Documentation
- Role manuals for ADMIN, MANAGER, USER and VIEWER, full and quick, in en,
  pt-PT, es-ES and fr-FR, with screenshots (`docs/user-guide/manual/`).

## [2.0.0] — 2026-09-30 — map access by role

**Why MAJOR:** users can lose maps they saw before (see "Who sees which map"
below), and two API answers changed: `GET /api/users/:id/maps` reports `ROLE`
where it said `GRANT`, and `GET /api/users/search` with an empty `q` now lists
every user instead of none.

**Before you upgrade:** find the users who saw maps only through a CREATE,
EDIT or DELETE grant on a business area. Share those maps with them, or make
them MANAGER. The Users page → map icon shows what each user can open.

### Added
- Business area grants: tick several users and grant them one level in one
  click. A note under the level says what it allows.
- Users page: the role field explains all four roles. The per-user map list
  shows each map's owner, and lets an ADMIN or MANAGER change or remove a
  share, or give the map to a new owner (`PUT /api/maps/:id/owner`).
- Share windows (map and workbook) list every user, each with **Can view /
  Can export / Can edit** buttons and ✕ to remove.
- Maps list: Workbook and Owner columns, and a Copy button.
- Joins: a join can match on several column pairs (ANDed), each with its own
  operator. The API takes `predicates: [...]` and returns them.
- A Back button on the map editor, the map viewer, and Schedules opened from
  a map.
- Helper balloons on most buttons.

### Changed
- **Who sees which map.** A business-area grant no longer shows maps; it only
  lets you read the area's data. A USER sees their own maps and the maps
  shared with them. A MANAGER sees, runs, exports, schedules and shares every
  map, but changes only their own. Anyone but a VIEWER may copy a map they can
  see. Users who relied on a CREATE/EDIT/DELETE grant to see an area's maps
  need a share now.
- A MANAGER can open the Users page (read-only) and each user's map list.
- Running a map from the editor now goes through the run queue: it shows on
  the Executions page, keeps its rows, and can be exported.
- Admin tables, Executions and Exports fit as many rows per page as the window
  holds.
- `GET /api/users/search` with an empty `q` lists every user.
- `GET /api/users/:id/maps`: the reason `GRANT` is now `ROLE` (a MANAGER sees
  every map by role), and each row carries `ownerId` and `ownerName`.

### Fixed
- A business-area permission check now uses the highest level a user holds.
  A user with two grant rows on one area could be refused at random.
- The sidebar version label had too little contrast (1.96:1).
- Maps page accessibility: the tabs now have a panel, and the two filter
  drop-downs have names. This had broken the E2E accessibility scan.

## [1.1.0] — 2026-09-25

### Added
- Copy a whole workbook under a new name ("Save as"). The copy is private to
  you, holds a copy of every worksheet, and keeps their order. The original
  does not change. (`POST /api/workbooks/:id/duplicate`)
- Delete a whole workbook. Its worksheets are soft-deleted, like a single map,
  so an administrator can restore them. (`DELETE /api/workbooks/:id`)
- An edit (pencil) button next to each worksheet in the workbook list.
- A filter on workbook and worksheet names above the workbook list.
- The app version, shown in the sidebar and reported by `GET /health`.

### Changed
- A copied map keeps its list of filters that were lost in migration.

### Documentation
- Regenerated API reference. It also adds five routes that it had missed.

## [1.0.0] — 2026-09-25 — first production release (`29f345f`)

### Added
- Serve Neo under `/discoverer-neo/`, behind the shared nginx proxy of
  Consulta Online, on the test and production servers.
- A guide for the USER role in four languages, and Word manuals with
  screenshots.

### Fixed
- The backend image installs the Oracle Instant Client from a local zip, and
  apt uses HTTPS, so the image builds on servers that block plain HTTP.

### Documentation
- `CORS_ALLOWED_ORIGINS`, and how to ship the whole project to a server.

## [0.10.0] — 2026-09-23 — run queue and interface polish (`89b586d`)

### Added
- A map-run queue. Each user's runs start in order, identical runs re-use a
  result, and a queued run can be cancelled. Result rows are stored and expire.
- A Runs history page.
- Scheduled runs go through the queue, and keep the retention period from
  Discoverer (`BR_EXPIRY`).
- Exports are built from stored run rows. Schedule history can export them.
- Portuguese as the default language, four colour palettes, a document header
  on exports, and an insert-variable menu.
- Draggable builder zones, PDF export options, and a folder wizard with views
  and comments.
- Re-import everything from the Migration page. Folder list pages with filters.
- Calculated fields compile after every migration. Folders and custom functions
  can be refreshed from Oracle.

### Changed
- Exports never query Oracle again. They use the stored run.
- The old in-memory query execution was removed.
- The Runs and Exports pages refresh on every visit, and every 30 seconds.

### Fixed
- The incremental migration no longer refuses shared workbooks, and handles
  re-imported rows.
- An export waits for its last progress write before it is marked complete.
- Run cancellation, and filename, heading and rounding errors in exports.
- Three QA issues: the run delete dialog wording, the time format in the
  viewer, and cancelling a queued run from the viewer.
- Accessibility: the builder splitters and the conditional-format value field.

### Security
- Closed a gap where an export did not check the user's right to export.

## [0.9.0] — 2026-09-18 — migration validation and cutover (`a3c5f0b`)

### Added
- Result equivalence: compare Neo's results with Discoverer's own saved output.
- Incremental migration ("delta"): apply only what changed in the EUL, and a
  script to run it with a verification after every run.
- A cutover runbook, rehearsed from start to end.
- Historical batch results from Discoverer are migrated into Neo.
- Activate and deactivate users on the Users page.
- Custom functions show their database source, and you can search the
  database for functions.
- Administrator views of a map's query and plan. Share a whole workbook. A
  MANAGER role that can pass maps on to other users.
- Conditions that compare against an expression are migrated. The ones that
  still cannot be migrated are recorded.
- The backend applies database migrations and creates the admin account on
  first start.

### Changed
- A query may run as long as it could in Discoverer.
- Oracle sessions use the number and date settings (NLS) that the migrated
  formulas were written for.

### Fixed
- Each migrated map gets only its own worksheet's conditions, parameters and
  calculations.
- Binding of literals, numbers, dates and lists inside compiled calculations
  and parameters.
- Oracle queries no longer starve the Postgres connections.
- Custom function references, round-year date tokens, and hidden items that
  only a calculation uses.
- An OR condition stays in brackets.
- nginx no longer strips `/api` from proxied requests.
- Keyboard support for re-ordering hierarchy levels.

### Security
- The first-start admin account no longer has a hard-coded password, and a
  race that could lose data was closed.

## [0.8.0] — 2026-09-15 — workbooks, schedules, exports and operations (`579c311`)

### Added
- Workbooks are read from the migration and shown above the Maps list.
- Scheduled reports from Discoverer are migrated, switched off by default.
- `CASE`/`WHEN`/`ELSE` in migrated calculations.
- Exports show the same group breaks, subtotals and grand totals as the screen.
  An export history page.
- Conditional formats ("exceptions"): create them and show them in results.
- Drill to detail. PDF export that uses the page setup from Discoverer.
- The Schedules list shows why a schedule would be refused.
- Oracle queue and pool metrics. Separate readiness and liveness health checks.
- Durable backups (Redis append-only file), with a proven restore.
- An API reference generated from the running server.

### Changed
- Oracle servers older than 12.1 are refused, with both versions named.

### Fixed
- Migrated calculations use their compiled SQL.
- Parameter references (`[8,n]`) resolve to the right bind name.
- Totals under `SELECT DISTINCT` count each row once.
- The production Docker Compose file starts.
- Pagination is stable on maps with no sort, the job registry has a limit, and
  the folder and item import runs in one transaction.

## [0.7.0] — 2026-09-14 — security hardening (`bc6e034`)

### Added
- A paginated list of tables for a data source.

### Fixed
- An OR condition in a migrated map is kept as one bracketed group.

### Security
- Refresh tokens are separate, rotate, and can be revoked. Logout is honoured.
- Login is rate-limited per address and per account, with lockout.
- Every "get by id" route checks access. Folder custom SQL is validated on
  update.
- Row-level security fails closed by default. A complex folder under a policy
  is refused.
- CORS allows only listed origins. `/metrics` is not on the public listener.
  Postgres and Redis are not published by the Compose file.
- Errors never show raw Oracle text. Each error has a correlation id.
- A data source that points at an unsafe host is refused, including DNS
  rebinding and mapped IPv6 addresses.
- Reads of EUL metadata are audited. CI fails on high or critical advisories.

## [0.6.0] — 2026-09-12 — migration fidelity (`97bdeef`)

### Added
- EUL 4 object links: grants and hierarchies.
- Item classes, and live lists of values in the parameter prompt.
- Migrated conditions keep negation, case sensitivity, and conditions on
  calculated fields.
- Title tokens (`&Date`, `&Time`, `&<parameter>`) are filled in when a map
  is shown.

### Fixed
- `verify-migration --compile` publishes its result.
- A date list of values shows one entry per day.

## [0.5.0] — 2026-09-11 — formula engine (`3f74fbd`)

### Added
- Discoverer's built-in functions, fitted against Oracle's own output.
- Registered PL/SQL functions can be called.
- A calculation can use another calculation.
- A compile check that sorts every calculation into compiled or refused, with
  a reason, and runs in CI. 93.71% of the estate compiles.

### Fixed
- Date literals include the century.
- A formula that mixes aggregates and plain columns groups correctly
  (no `ORA-00979`).
- Four calculated-field columns that the migration read and then dropped.

## [0.4.0] — 2026-09-06 — query engine (`d383607`)

### Added
- Default aggregates are read from the EUL.
- A join model: a pair of folders, their predicates, and four flags.
- A query planner that plans before it generates SQL, with five refusal rules,
  and a rewrite that avoids fan traps. The refusal shows before you press Run.
- A keyboard alternative to drag and drop in the builder.
- `dn-migrate` can reach an EUL whose account uses a 12c password verifier.

### Changed
- The joins were re-imported with the new model. FULL joins are no longer
  offered in the admin form.

## [0.3.0] — 2026-09-04 — foundations and first real screens (`44e9354`)

### Added
- A map's query scope comes from its folders, and data access is checked
  against it.
- Four migration "seam" tests, and `dn-migrate verify`.
- A working Maps list, real dashboard numbers, and an error boundary.
- A refused query is explained, not shown as an error.
- End-to-end tests in CI.

### Changed
- The backend and the migrator share one schema definition.
- CI runs, with coverage gates, and the backend passes lint.

### Fixed
- Saving a map no longer drops its totals and layout.
- The connection pool no longer leaks a slot on a timeout.

### Security
- The audit log hides credentials, and old credentials in it were purged.
- Production refuses the published default secrets.

## [0.2.0] — 2026-07-24 — languages and themes (`1d66ddc`)

### Added
- Language and theme preferences for each user, and a Settings page.
- English, European Portuguese, French and Spanish.
- Light, dark and high-contrast themes.
- Translated documentation.

## [0.1.0] — 2026-07-19 — first working build (`f620d0f`)

### Added
- Login and roles. Administration of business areas, folders, items, joins
  and hierarchies. The map builder and viewer. Queries against Oracle.
- Row-level security policies, and map sharing.
- EUL version detection, the EUL reader and assessment, the `dn-migrate` CLI,
  and a migration page.
- Audit logging, metadata caching, documentation, an OpenAPI spec, and a
  production Docker setup with health checks, backups, metrics and CI/CD.

[2.0.1]: https://github.com/joao-ribeiro83/discoverer/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/joao-ribeiro83/discoverer/compare/v1.1.0...v2.0.0
[1.1.0]: https://github.com/joao-ribeiro83/discoverer/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/joao-ribeiro83/discoverer/compare/v0.10.0...v1.0.0
[0.10.0]: https://github.com/joao-ribeiro83/discoverer/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/joao-ribeiro83/discoverer/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/joao-ribeiro83/discoverer/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/joao-ribeiro83/discoverer/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/joao-ribeiro83/discoverer/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/joao-ribeiro83/discoverer/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/joao-ribeiro83/discoverer/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/joao-ribeiro83/discoverer/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/joao-ribeiro83/discoverer/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/joao-ribeiro83/discoverer/releases/tag/v0.1.0
