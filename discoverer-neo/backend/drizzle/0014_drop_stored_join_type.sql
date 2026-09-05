-- Phase 3.2, second half — remove what the new join model replaced.
--
-- 0013 added `join_predicates` and the four flags while leaving the old
-- columns in place, so the ten existing join rows survived that migration
-- untouched and could be inspected either side of it. The migrator now writes
-- the new shape, so the old columns are dead weight — and dead weight that
-- disagrees with live data is the hazard, not the disk space: two columns both
-- claiming to answer "what does this join match on?" is one more than can be
-- kept true.
--
-- `join_type` is dropped, NOT nulled. It is DERIVED from
-- `allow_master_no_detail` / `allow_detail_no_master` at query time (D-032).
-- Its stored value was never a reading: it came from `EUL4_KEY_CONS.KEY_TYPE`,
-- whose live domain is `FK`/`UK` — a constraint kind — so every one of the
-- estate's ten joins read `INNER` by accident. 0013 already carried whatever
-- the column held into the two flags, so nothing is lost here.
--
-- The column is NOT NULL, so its constraint has to go before it does.
--
-- `left_item_id` / `right_item_id` held the single item pair the old model
-- allowed. They are NULL on all ten migrated rows and always were: the source
-- cannot populate a single pair, which is the whole reason this phase exists.
-- The pair now lives on `join_predicates`, which can hold the three- and
-- four-column predicates this estate actually uses.
--
-- The `join_type` Postgres TYPE goes too, once no column uses it. It is
-- dropped by name rather than with CASCADE, so if some other column has picked
-- it up in the meantime this migration fails loudly instead of quietly
-- rewriting that column.

ALTER TABLE "joins" ALTER COLUMN "join_type" DROP NOT NULL;
--> statement-breakpoint

DROP INDEX IF EXISTS "joins_left_item_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "joins_right_item_idx";
--> statement-breakpoint

ALTER TABLE "joins"
  DROP COLUMN "join_type",
  DROP COLUMN "left_item_id",
  DROP COLUMN "right_item_id";
--> statement-breakpoint

DROP TYPE IF EXISTS "public"."join_type";
