-- Phase 7.2 — record the fan-trap planner's pre-flight decision on a
-- migrated schedule, same one-line format as query_execution_log.plan_decision
-- (0015). A migrated schedule is always disabled on import regardless of
-- what the planner says; these columns are how an operator sees *why* one
-- would refuse before trying to enable it, without re-running the planner.
--
-- Nullable: a schedule created directly in Neo is planned fresh on every
-- run and never gets a resting decision recorded here.

ALTER TABLE "schedules"
  ADD COLUMN "planner_decision" varchar(64);

ALTER TABLE "schedules"
  ADD COLUMN "planner_refusal_detail" text;
