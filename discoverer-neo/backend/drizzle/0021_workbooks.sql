-- Phase 7.1a / ARCH R6 — model the workbook above its worksheets.
--
-- A 564-workbook estate arrived as 923 unrelated maps linked only by a name
-- prefix. `workbooks` is the aggregate; `maps.workbook_id` binds each
-- worksheet to it and `map_layouts.worksheet_index` orders them.
--
-- D-020: this table is outside the authorisation path. No share table is
-- added here; access stays per map and per folder.
--
-- Existing maps keep workbook_id NULL until a maps re-import fills it.

CREATE TABLE "workbooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"source_id" integer,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workbooks" ADD CONSTRAINT "workbooks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "workbooks_source_id_idx" ON "workbooks" USING btree ("source_id");
--> statement-breakpoint
ALTER TABLE "maps" ADD COLUMN "workbook_id" uuid;
--> statement-breakpoint
ALTER TABLE "maps" ADD CONSTRAINT "maps_workbook_id_workbooks_id_fk" FOREIGN KEY ("workbook_id") REFERENCES "public"."workbooks"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "maps_workbook_idx" ON "maps" USING btree ("workbook_id");
