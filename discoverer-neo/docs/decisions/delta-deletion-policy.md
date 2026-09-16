# What a delta does with an object the source deleted (D-080)

**Date:** 2026-09-16 · **Status:** decided
**Context:** Phase 9.2, [`docs/migration/incremental-delta.md`](../migration/incremental-delta.md)

## The problem

The source can delete a folder, an item, a join, a workbook or a worksheet
between two deltas. In Neo, that object may have dependents that the EUL never
knew about:

- `schedules`, `map_shares` and `export_jobs` point at `maps.id`.
- `map_items`, `map_conditions` and `hierarchy_levels` point at `items.id`.
- Neo users can build their own maps on migrated items.

All of these foreign keys are `ON DELETE CASCADE`. One delete in the delta can
remove schedules and user-built columns without any warning.

## Options

| Option | Result |
| --- | --- |
| Delete in the target | Matches the source. Cascades silently into objects the EUL did not own. |
| Soft-delete | Needs an `is_active` meaning on every table, and every reader would have to respect it. Most tables do not have one. |
| **Refuse and report** | The object stays. Every delta reports it until a person removes it in Neo. |

## Decision

**Refuse and report.** The delta does not delete a folder, item, item class,
join, hierarchy, function, business area, workbook or worksheet. Each run
reports it by key (`REFUSED DELETE item:300`), logs a `WARN` to
`migration_log`, and exits 1.

To finish the deletion, remove the object in Neo. The next delta finds it gone
from both sides and drops it from the baseline.

This follows D-058: refuse rather than distort.

## Two exceptions, both for security

When a refused delete would leave access **broader** than the source, the
delta applies the delete:

- **A grant the source revoked is deleted.** A kept grant would give a user a
  business area that Discoverer no longer gives them.
- **A user the source deleted is deactivated** (`users.is_active = false`), not
  deleted. The account's maps and audit history stay.

Before commit, every delta also checks that each grant written by the migration
service account matches a grant the source holds now (Phase 5.1). If one does
not match, the delta rolls back.

## Consequence

During validation, Neo can hold objects that Discoverer has dropped. They are
listed on every run, so they are never forgotten silently.
