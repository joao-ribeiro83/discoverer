-- Phase 3.2 — model joins the way Discoverer does.
--
-- Before this migration a join was a folder pair plus ONE item pair, and a
-- `join_type` enum column. Three things were wrong with that:
--
--  1. `join_type` was fed from `EUL4_KEY_CONS.KEY_TYPE`, whose live domain is
--     `FK`/`UK` — a *constraint kind*, not a join type. All ten of the estate's
--     joins therefore read `INNER` by accident, not by reading. The real source
--     is the pair of outer-join flags added below, and `join_type` is now
--     DERIVED from them (D-032), so the column goes away in 0014.
--  2. A Discoverer join predicate is 1..n column pairs ANDed together, each
--     with its own operator. This estate runs five single-column joins, four
--     three-column and one four-column. A single item pair cannot hold that,
--     which is why all ten migrated joins have NULL item endpoints and
--     `sql-generator.ts` drops every one of them.
--  3. `one_to_one` and `mandatory` were not stored at all. The first is the
--     only input the fan-trap guard has (Oracle: fan-trap detection is its
--     ONLY effect); the second unlocks join trimming and summary eligibility.
--
-- This migration ADDS. `left_item_id`, `right_item_id` and `join_type` are
-- deliberately left in place so the ten existing rows survive it untouched;
-- 0014 drops them once the migrator writes the new shape.
--
-- Orientation is unchanged here and stays as `left_folder_id` = MASTER,
-- `right_folder_id` = DETAIL (D-040). The plan's handover query names those
-- columns `master_folder_id`/`detail_folder_id`; they were never renamed,
-- because A-05 established the folder columns were already correct and a
-- rename would ripple through the FROM clause, the security folder set and
-- the admin API for no gain.

ALTER TABLE "joins"
  ADD COLUMN "one_to_one" boolean DEFAULT false NOT NULL,
  ADD COLUMN "allow_master_no_detail" boolean DEFAULT false NOT NULL,
  ADD COLUMN "allow_detail_no_master" boolean DEFAULT false NOT NULL,
  ADD COLUMN "mandatory" boolean DEFAULT false NOT NULL,
  ADD COLUMN "predicate_formula" text;
--> statement-breakpoint

-- Carry the old enum across so no information is lost by the column's removal.
-- `FULL` maps to both flags set, which the derivation refuses (D-038) — that
-- is the intended outcome, not a defect: no vendor text describes the
-- combination and it is inexpressible in the Oracle 8 `(+)` syntax 4.1
-- targeted. `one_to_one` and `mandatory` have no old column to come from and
-- keep their defaults; `one_to_one = false` is "assume fanning" (D-033), the
-- safe direction. Their real values arrive with the next EUL import.
UPDATE "joins" SET
  "allow_master_no_detail" = ("join_type" IN ('LEFT', 'FULL')),
  "allow_detail_no_master" = ("join_type" IN ('RIGHT', 'FULL'));
--> statement-breakpoint

-- One row per column pair of a join's predicate, ANDed in `seq` order.
--
-- Item ids are nullable on purpose. A component whose item failed to migrate
-- must still occupy a row: dropping it would silently shorten the ON clause
-- from `a = b AND c = d` to `a = b`, which returns MORE rows than the source
-- did — a wrong number that looks right. A null endpoint refuses at generation
-- time instead.
CREATE TABLE "join_predicates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "join_id" uuid NOT NULL,
  "seq" integer NOT NULL,
  "left_item_id" uuid,
  "right_item_id" uuid,
  "operator" varchar(2) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "join_predicates"
  ADD CONSTRAINT "join_predicates_join_id_joins_id_fk"
  FOREIGN KEY ("join_id") REFERENCES "public"."joins"("id") ON DELETE cascade;
--> statement-breakpoint

ALTER TABLE "join_predicates"
  ADD CONSTRAINT "join_predicates_left_item_id_items_id_fk"
  FOREIGN KEY ("left_item_id") REFERENCES "public"."items"("id") ON DELETE set null;
--> statement-breakpoint

ALTER TABLE "join_predicates"
  ADD CONSTRAINT "join_predicates_right_item_id_items_id_fk"
  FOREIGN KEY ("right_item_id") REFERENCES "public"."items"("id") ON DELETE set null;
--> statement-breakpoint

-- The operator is spliced straight into generated SQL, so its domain is
-- closed in two places: the reader maps an `EUL4_FUNCTIONS.FUN_ID` onto one of
-- these six and refuses anything else, and this CHECK refuses it again. These
-- are exactly the six the Join Wizard offers (9.0.4/B10270_01.pdf p. 24-91).
ALTER TABLE "join_predicates"
  ADD CONSTRAINT "join_predicates_operator_check"
  CHECK ("operator" IN ('=', '<', '>', '<=', '>=', '<>'));
--> statement-breakpoint

CREATE INDEX "join_predicates_join_idx" ON "join_predicates" USING btree ("join_id");
--> statement-breakpoint
CREATE INDEX "join_predicates_left_item_idx" ON "join_predicates" USING btree ("left_item_id");
--> statement-breakpoint
CREATE INDEX "join_predicates_right_item_idx" ON "join_predicates" USING btree ("right_item_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "join_predicates_join_seq_uq" ON "join_predicates" USING btree ("join_id", "seq");
