CREATE TABLE "folder_business_areas" (
	"folder_id" uuid NOT NULL,
	"business_area_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "folder_business_areas_folder_id_business_area_id_pk" PRIMARY KEY("folder_id","business_area_id")
);
--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "item_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."item_type";--> statement-breakpoint
CREATE TYPE "public"."item_type" AS ENUM('CO', 'CI', 'CU', 'JI', 'HI', 'AG', 'FU');--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "item_type" SET DATA TYPE "public"."item_type" USING "item_type"::"public"."item_type";--> statement-breakpoint
DROP INDEX "hierarchy_levels_hierarchy_number_idx";--> statement-breakpoint
ALTER TABLE "hierarchy_levels" ALTER COLUMN "item_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "hierarchy_levels" ADD COLUMN "parent_level_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_role" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "folder_business_areas" ADD CONSTRAINT "folder_business_areas_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder_business_areas" ADD CONSTRAINT "folder_business_areas_business_area_id_business_areas_id_fk" FOREIGN KEY ("business_area_id") REFERENCES "public"."business_areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "folder_business_areas_ba_idx" ON "folder_business_areas" USING btree ("business_area_id");--> statement-breakpoint
ALTER TABLE "hierarchy_levels" ADD CONSTRAINT "hierarchy_levels_parent_level_id_hierarchy_levels_id_fk" FOREIGN KEY ("parent_level_id") REFERENCES "public"."hierarchy_levels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hierarchy_levels_parent_idx" ON "hierarchy_levels" USING btree ("parent_level_id");--> statement-breakpoint
CREATE INDEX "hierarchy_levels_hierarchy_number_idx" ON "hierarchy_levels" USING btree ("hierarchy_id","level_number");