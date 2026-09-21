-- Two product decisions, one migration:
--
-- 1. Portuguese is the default UI language for every account. The column
--    default flips, and every user still sitting on the old 'en' default is
--    moved too: 'en' was never a choice anyone made, it was what a new row got.
-- 2. Four more colour palettes (frontend/src/styles/palettes/*.css) join the
--    enum. ADD VALUE is not transactional-safe on old Postgres, hence one
--    statement per value.
ALTER TABLE "users" ALTER COLUMN "locale" SET DEFAULT 'pt-PT';--> statement-breakpoint
UPDATE "users" SET "locale" = 'pt-PT' WHERE "locale" = 'en';--> statement-breakpoint
ALTER TYPE "public"."color_palette" ADD VALUE IF NOT EXISTS 'forest';--> statement-breakpoint
ALTER TYPE "public"."color_palette" ADD VALUE IF NOT EXISTS 'wine';--> statement-breakpoint
ALTER TYPE "public"."color_palette" ADD VALUE IF NOT EXISTS 'ocean';--> statement-breakpoint
ALTER TYPE "public"."color_palette" ADD VALUE IF NOT EXISTS 'ochre';
