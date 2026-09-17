-- A migrated function was stored by its Discoverer label (`FUN_NAME`) only, so
-- the compiled SQL called `LABEL(args)`: not the package, not the owner, and on
-- 27 of the reference estate's 371 functions not even the database name. The
-- argument list and return type were dropped too.
--
-- These columns carry what Oracle actually calls —
-- `ext_owner.ext_package.ext_name@ext_db_link` — and the database it lives in.

ALTER TABLE "custom_functions" ADD COLUMN "ext_owner" varchar(128);--> statement-breakpoint
ALTER TABLE "custom_functions" ADD COLUMN "ext_package" varchar(128);--> statement-breakpoint
ALTER TABLE "custom_functions" ADD COLUMN "ext_name" varchar(128);--> statement-breakpoint
ALTER TABLE "custom_functions" ADD COLUMN "ext_db_link" varchar(128);--> statement-breakpoint
ALTER TABLE "custom_functions" ADD COLUMN "data_source_id" uuid;--> statement-breakpoint
ALTER TABLE "custom_functions" ADD CONSTRAINT "custom_functions_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE set null ON UPDATE no action;
