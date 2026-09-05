-- Phase 3.3 — record what the fan-trap planner decided, on every execution.
--
-- `legacy-analysis.md` §1.11 step 10: *"Every query records which rule fired:
-- FLAT, REWRITE(n branches), or REFUSE(R1|R2|R3|R4|REAGG). This is not logging
-- — it is the only way §10 can prove the guard is live."*
--
-- This project's signature failure mode is a component that ships present,
-- unit-tested and structurally inert. A fan-trap guard is the worst possible
-- candidate for it: with `map_items.agg_function` null the measure set is
-- empty, every query classifies |M| = 0, every plan takes step 0's flat path,
-- and every unit test still passes — because they run against hand-built
-- fixtures rather than migrated maps.
--
-- One column answers it. If every row in this table reads `FLAT(NO_MEASURES)`,
-- the guard has never classified a real query and the measure set needs
-- repopulating (Phase 3.1). Nullable, because rows written before this
-- migration have no decision to record and inventing one would be a lie.

ALTER TABLE "query_execution_log"
  ADD COLUMN "plan_decision" varchar(64);
