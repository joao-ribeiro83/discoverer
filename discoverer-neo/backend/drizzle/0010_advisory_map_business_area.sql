-- D-013: `maps.business_area_id` becomes advisory (UI grouping only).
-- A map's query scope is derived from the folders its items and conditions
-- live in, plus everything reachable through joins. Existing values are kept.
ALTER TABLE "maps" ALTER COLUMN "business_area_id" DROP NOT NULL;