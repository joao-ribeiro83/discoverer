-- Constrain `agg_function` to the set Neo can actually run.
--
-- `items.agg_function` and `map_items.agg_function` are `varchar(64)` with no
-- domain. They feed two things that are not display: `select-clause.ts`, which
-- throws on a name outside `SUM|COUNT|AVG|MIN|MAX`, and the fan-trap guard,
-- whose measure set is defined by aggregation. An unconstrained free-text
-- column feeding a correctness guard is the hazard closed here.
--
-- NULL stays legal and means "no aggregation" — Oracle's own `DETAIL`. The
-- five names are Neo's capability (`backend/src/lib/sql/formula-parser.ts`),
-- not Discoverer's vocabulary: `EDCBAggregateType` has sixteen members and
-- `/aggregate` six. `COUNT DISTINCT` is decoded by the migration and
-- deliberately not written, so it is deliberately not permitted here either.
--
-- `map_totals.agg_function` is left alone: it is written by a path with its own
-- established discipline (§7.12), and widening this change to it is Phase 3.x
-- work, not this one's.
--
-- NOT VALID is not used: both columns hold only NULL and a single `SUM` today,
-- so the constraint validates instantly against live data.

ALTER TABLE "items"
  ADD CONSTRAINT "items_agg_function_check"
  CHECK ("agg_function" IS NULL OR "agg_function" IN ('SUM', 'COUNT', 'AVG', 'MIN', 'MAX'));
--> statement-breakpoint

ALTER TABLE "map_items"
  ADD CONSTRAINT "map_items_agg_function_check"
  CHECK ("agg_function" IS NULL OR "agg_function" IN ('SUM', 'COUNT', 'AVG', 'MIN', 'MAX'));
