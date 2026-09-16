# Incremental delta (`dn-migrate delta`)

A Discoverer Neo database holds one full migration. A second `run` is refused.
But the Discoverer estate keeps changing while Neo is validated. The delta
brings an already-migrated database up to date, and it writes only what
changed.

Code: `migrate/src/services/delta.ts`. Decision: D-080,
[`docs/decisions/delta-deletion-policy.md`](../decisions/delta-deletion-policy.md).

## Run it

Take a backup first. Every live delta needs one (D-078).

```bash
scripts/backup.sh
```

Preview. This reads the EUL and the target, and writes nothing:

```bash
npx dn-migrate delta --connection eul.json --target postgres://… --dry-run
```

Apply:

```bash
npx dn-migrate delta --connection eul.json --target postgres://…
```

On this deployment the EUL password is stored only in `data_sources`. So run it
from the backend container instead. It connects the way the migration API does,
and no password file is written:

```bash
docker exec discoverer-neo-backend sh -c 'cd /app/backend && /app/node_modules/.bin/tsx src/scripts/run-delta.ts <dataSourceId>'
docker exec discoverer-neo-backend sh -c 'cd /app/backend && /app/node_modules/.bin/tsx src/scripts/run-delta.ts <dataSourceId> --live'
```

Add `--json` for the full list of changed keys.

A live delta always ends by running the verifier ([`verify.md`](verify.md)). It
adds `--compile` when a worksheet was written, because a rewritten
worksheet's calculations have no compiled SQL until then. Set
`DN_MIGRATE_COMMIT` to the commit you run, so `migration_log` records it.

**Exit code 1** means the verifier found blockers, or the source lost an object
that the delta refused to delete. Both need a person.

## What "changed" means

EUL4 has created and updated dates on every table. They cannot drive a delta.
A delete removes the row and leaves no trace. A worksheet also changes when an
item it names appears or goes, and the worksheet's own date does not move
(`migrate/EUL_SCHEMA_GROUND_TRUTH.md` §7.13).

So the delta compares content:

1. It runs the full migration as a dry run. The rows it compares are exactly
   the rows a full run would write.
2. It groups the rows by source object. A worksheet is its map with its
   columns, conditions, parameters, calculations, layout, totals and page
   setup. A join includes its predicates, and a folder includes its business
   area shares.
3. It hashes each object. Every id is replaced by the source key it names
   (`item:300`, `map:<DOC_ID>:<worksheet GUID>`), so the hash is stable.
4. It compares each hash with `migration_objects`, the hashes recorded at the
   last run.

With the same migrator commit, a hash moves only when the source moved. A new
commit that writes different rows also moves hashes, and the delta applies
that too. `migration_log` records the commit of every run (`source-state`
rows, with the `VERSIONS` row), so you can always see which cause applies.

## What it writes

| Source object | Delta |
| --- | --- |
| New | Inserted |
| Changed | Updated **in place**. The top row keeps its id, and its child rows are replaced. |
| Deleted | **Refused and reported** (D-080) |
| Deleted grant | Deleted. Keeping it would leave access broader than the source. |
| Deleted user | Deactivated (`is_active = false`), for the same reason |

A changed worksheet keeps its `maps.id`. Its schedules, shares and export jobs
stay attached, and their `is_active` is never written. A delta does not touch
`schedules`. An operator-disabled schedule stays disabled.

The delta never overwrites these columns: a user's `email`, `password_hash`,
`must_change_password`, `role` and `is_active`, and a folder's
`data_source_id`. Neo owns them once the row exists. A new folder gets the one
data source the target's folders already use, or `--data-source-id`.

**Everything is one transaction**, and that includes the baseline. If any
statement fails, the target and `migration_objects` stay as they were, and
`migration_log` records `Delta rolled back`.

**Grants are checked on every delta.** Before commit, each grant written by the
migration service account must match a grant the source holds now: the same
user, business area and level. If one does not match, the delta rolls back
(Phase 5.1).

## Deleted source objects

The delta does not delete a folder, item, join, hierarchy, function, workbook
or worksheet. A worksheet can be scheduled or shared, and an item can be used
by a map that Neo users built. Each run reports the object as
`REFUSED DELETE <key>`, and logs it as a `WARN` in `migration_log`.

To finish the deletion, remove the object in Neo. There you can see what
depends on it. The next delta finds it gone from both sides and drops it from
the baseline.

## The first delta on a database

A database migrated before this feature has no baseline. The first delta
adopts one. It matches the target's rows to the replay by natural key:

| Table | Key |
| --- | --- |
| users | email |
| business areas, folders, item classes, functions | name |
| items | folder, name |
| joins | name, both folders |
| hierarchies | name, business area |
| workbooks | `source_id` |
| worksheets | workbook, worksheet GUID |
| grants | user, business area, level |

Then it hashes the target's own rows. Anything that differs from the replay is
applied as a change. A key that matches more than one row refuses the delta.

Adoption cannot see a rename that happened before the first delta. A folder
renamed in Discoverer after the original migration looks new, so it is
inserted beside the old one. Read the dry run's `added` count before the first
live delta.

### The first dry run on this estate (2026-09-16)

The delta adopted 12 013 source objects. No key was ambiguous, and nothing was
deleted. It found 1 263 changes. All of them come from migrator fixes made
after the database was migrated, not from new Discoverer edits:

- **1 238 items** have no `agg_function`. The current migrator writes the EUL's
  default aggregate (Phase 3.1).
- **24 worksheets** have join references that resolve to nothing
  (`map_layouts.source_attrs.joins[].joinIds: null`). They broke when the joins
  were re-imported on 2026-09-06.
- **The host business area** has the description of an older migrator.

### The first live delta on this estate (2026-09-16, commit `1f190b5`)

Backup first: `discoverer_neo_20260916-132802.dump.gz`. Then:

- **Applied** the 1 263 changes above, and recorded 12 013 baseline rows.
- **A second dry run found no change.** So the hashes are stable over a real
  replay, not only in the tests.
- **Nothing else moved.** Every `maps.id`, all 29 schedules (all still
  disabled) and all 60 grants were identical before and after. Items with an
  `agg_function`: 0 before, 1 238 after.
- **The verifier reported the same blockers before and after**, number for
  number. The pre-delta figures came from the backup, restored into a scratch
  database. So the delta caused none of them.
- **Rollback, on real Postgres.** On the restored copy, a trigger made the
  `maps` update fail after the business area and all 1 238 items were written.
  Afterwards no item had changed, `migration_objects` was empty, and
  `migration_log` held `Delta rolled back`.

The verifier still exits `COMPLETED_WITH_BLOCKERS` on this estate, so every
live delta exits 1 until those blockers are fixed. One of them is not a real
loss: the reconciliation concept *items on a folder with no business area*
compares the whole `items` table (9 626) with 0.

## Limits

- **Full read every time.** The delta reads the whole EUL and every migrated
  table. On this estate that takes about 36 seconds.
- **The EUL is the master.** A migrated object edited in Neo is overwritten
  when its source object changes. It is not overwritten before that.
- **A child row has no identity.** A changed worksheet's columns, conditions and
  calculations are deleted and written again. Their row ids change, and so does
  anything that pointed at them from outside the worksheet (none today). They
  lose their compiled SQL until the verifier's compile step runs.
- **Schedules are not in the delta.** New Discoverer batch reports still come
  in through `backend/src/scripts/import-schedules.ts`.
- **One-way only.** Neo never writes to the EUL.
