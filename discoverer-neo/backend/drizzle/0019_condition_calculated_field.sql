-- Phase 5.3b / ARCH M4 — a condition can reference a calculated field.
--
-- `map_conditions.item_id` was NOT NULL with an FK to `items`, so a condition
-- could never point at a calculation — while the legacy spec supports exactly
-- that (one carve-out for aggregate calculated items, enforced in the SQL
-- generator, not here). Independent of the depth/NOT rewrite: this is a
-- reference change, not a tree.

ALTER TABLE "map_conditions"
  ALTER COLUMN "item_id" DROP NOT NULL,
  ADD COLUMN "calculated_field_id" uuid REFERENCES "map_calculated_fields"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "map_conditions_reference_ck"
    CHECK (("item_id" IS NOT NULL) <> ("calculated_field_id" IS NOT NULL));
