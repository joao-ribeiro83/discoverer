-- Phase 5.2 — item classes (`EUL4_DOMAINS`).
--
-- An item class is ONE shared property bundle carrying THREE orthogonal
-- capabilities: a list of values, an alternative sort, and drill-to-detail
-- links. The source models the first two by which item column is populated
-- rather than by a flag (`DOM_IT_ID_LOV`, `DOM_IT_ID_RANK`), so this table
-- does the same; drill-to-detail has no source column at all and gets a real
-- boolean.
--
-- No value table. An LOV is `SELECT DISTINCT` against the customer's live
-- Oracle at prompt time — "the values are those values in the database column
-- on which the item is based". `cached` and `cardinality` are the source's own
-- cost hints and are honoured by the LOV service, not stored results.
--
-- `item_classes` and `items` reference each other, so the two foreign keys are
-- added after both tables exist.

CREATE TABLE "item_classes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  -- DOM_DEVELOPER_KEY: the source's stable export key.
  "developer_key" varchar(100),
  -- DOM_IT_ID_LOV. Non-null means this class provides a list of values.
  "source_item_id" uuid,
  -- DOM_IT_ID_RANK. Non-null means it provides an alternative sort.
  "sort_item_id" uuid,
  -- No source column; the existence of a shared class IS the drill link.
  "provides_drill_detail" boolean DEFAULT false NOT NULL,
  -- DOM_CACHED / DOM_CARDINALITY: how expensive the live LOV query is.
  "cached" boolean DEFAULT false NOT NULL,
  "cardinality" integer,
  "data_type" varchar(64),
  -- DOM_SYS_GENERATED.
  "system_generated" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "item_class_id" uuid;

-- Dropping a class must not delete the items that used it — they simply lose
-- the pick-list and fall back to their own column.
--> statement-breakpoint
ALTER TABLE "items"
  ADD CONSTRAINT "items_item_class_id_item_classes_id_fk"
  FOREIGN KEY ("item_class_id") REFERENCES "item_classes"("id") ON DELETE SET NULL;

-- Dropping the item a class reads from leaves the class without a LOV, which
-- is the same state as a class that never had one.
--> statement-breakpoint
ALTER TABLE "item_classes"
  ADD CONSTRAINT "item_classes_source_item_id_items_id_fk"
  FOREIGN KEY ("source_item_id") REFERENCES "items"("id") ON DELETE SET NULL;

--> statement-breakpoint
ALTER TABLE "item_classes"
  ADD CONSTRAINT "item_classes_sort_item_id_items_id_fk"
  FOREIGN KEY ("sort_item_id") REFERENCES "items"("id") ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

--> statement-breakpoint
CREATE INDEX "items_item_class_idx" ON "items" ("item_class_id");
--> statement-breakpoint
CREATE INDEX "item_classes_source_item_idx" ON "item_classes" ("source_item_id");
--> statement-breakpoint
CREATE INDEX "item_classes_sort_item_idx" ON "item_classes" ("sort_item_id");
