CREATE TYPE "public"."map_alignment" AS ENUM('LEFT', 'CENTER', 'RIGHT');--> statement-breakpoint
CREATE TYPE "public"."map_axis_edge" AS ENUM('ROW', 'COLUMN');--> statement-breakpoint
CREATE TYPE "public"."map_axis_type" AS ENUM('AXIS', 'MEASURE', 'PAGE');--> statement-breakpoint
CREATE TYPE "public"."map_format_target" AS ENUM('CELL', 'ROW');--> statement-breakpoint
CREATE TYPE "public"."map_orientation" AS ENUM('PORTRAIT', 'LANDSCAPE');--> statement-breakpoint
CREATE TYPE "public"."map_total_kind" AS ENUM('TOTAL', 'PERCENTAGE');--> statement-breakpoint
CREATE TYPE "public"."map_total_placement" AS ENUM('GRAND_TOTAL', 'AT_CHANGE');--> statement-breakpoint
CREATE TABLE "map_conditional_formats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"map_id" uuid NOT NULL,
	"name" varchar(255),
	"map_item_id" uuid,
	"target" "map_format_target" DEFAULT 'CELL' NOT NULL,
	"operator" "map_operator",
	"value" text,
	"background_color" varchar(32),
	"text_color" varchar(32),
	"is_bold" boolean DEFAULT false NOT NULL,
	"is_italic" boolean DEFAULT false NOT NULL,
	"is_underline" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "map_layouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"map_id" uuid NOT NULL,
	"worksheet_index" integer,
	"worksheet_guid" varchar(64),
	"title" text,
	"title_rtf" text,
	"title_html" text,
	"query_count" integer,
	"graph" jsonb,
	"source_element_id" integer,
	"source_attrs" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "map_page_setup" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"map_id" uuid NOT NULL,
	"orientation" "map_orientation",
	"scale_percent" integer,
	"header_left" text,
	"header_center" text,
	"header_right" text,
	"footer_left" text,
	"footer_center" text,
	"footer_right" text,
	"margin_top" numeric(6, 3),
	"margin_bottom" numeric(6, 3),
	"margin_left" numeric(6, 3),
	"margin_right" numeric(6, 3),
	"margin_header" numeric(6, 3),
	"margin_footer" numeric(6, 3),
	"print_grid_lines" boolean,
	"print_headings" boolean,
	"source_element_id" integer,
	"source_attrs" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "map_totals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"map_id" uuid NOT NULL,
	"kind" "map_total_kind" DEFAULT 'TOTAL' NOT NULL,
	"map_item_id" uuid,
	"map_calculated_field_id" uuid,
	"break_map_item_id" uuid,
	"agg_function" varchar(64),
	"placement" "map_total_placement",
	"label" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"source_element_id" integer,
	"source_attrs" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "map_calculated_fields" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "map_calculated_fields" ADD COLUMN "data_type" varchar(64);--> statement-breakpoint
ALTER TABLE "map_calculated_fields" ADD COLUMN "axis_type" "map_axis_type";--> statement-breakpoint
ALTER TABLE "map_calculated_fields" ADD COLUMN "format_mask" varchar(255);--> statement-breakpoint
ALTER TABLE "map_calculated_fields" ADD COLUMN "is_hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "map_calculated_fields" ADD COLUMN "source_identifier" varchar(64);--> statement-breakpoint
ALTER TABLE "map_calculated_fields" ADD COLUMN "source_element_id" integer;--> statement-breakpoint
ALTER TABLE "map_calculated_fields" ADD COLUMN "source_attrs" jsonb;--> statement-breakpoint
ALTER TABLE "map_items" ADD COLUMN "axis_type" "map_axis_type";--> statement-breakpoint
ALTER TABLE "map_items" ADD COLUMN "axis_edge" "map_axis_edge";--> statement-breakpoint
ALTER TABLE "map_items" ADD COLUMN "axis_order" integer;--> statement-breakpoint
ALTER TABLE "map_items" ADD COLUMN "is_hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "map_items" ADD COLUMN "data_type" varchar(64);--> statement-breakpoint
ALTER TABLE "map_items" ADD COLUMN "heading_format_mask" varchar(255);--> statement-breakpoint
ALTER TABLE "map_items" ADD COLUMN "alignment" "map_alignment";--> statement-breakpoint
ALTER TABLE "map_items" ADD COLUMN "word_wrap" boolean;--> statement-breakpoint
ALTER TABLE "map_items" ADD COLUMN "sort_rank" integer;--> statement-breakpoint
ALTER TABLE "map_items" ADD COLUMN "sort_group" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "map_items" ADD COLUMN "source_element_id" integer;--> statement-breakpoint
ALTER TABLE "map_items" ADD COLUMN "source_attrs" jsonb;--> statement-breakpoint
ALTER TABLE "maps" ADD COLUMN "select_distinct" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "map_conditional_formats" ADD CONSTRAINT "map_conditional_formats_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_conditional_formats" ADD CONSTRAINT "map_conditional_formats_map_item_id_map_items_id_fk" FOREIGN KEY ("map_item_id") REFERENCES "public"."map_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_layouts" ADD CONSTRAINT "map_layouts_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_page_setup" ADD CONSTRAINT "map_page_setup_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_totals" ADD CONSTRAINT "map_totals_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_totals" ADD CONSTRAINT "map_totals_map_item_id_map_items_id_fk" FOREIGN KEY ("map_item_id") REFERENCES "public"."map_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_totals" ADD CONSTRAINT "map_totals_map_calculated_field_id_map_calculated_fields_id_fk" FOREIGN KEY ("map_calculated_field_id") REFERENCES "public"."map_calculated_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_totals" ADD CONSTRAINT "map_totals_break_map_item_id_map_items_id_fk" FOREIGN KEY ("break_map_item_id") REFERENCES "public"."map_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "map_conditional_formats_map_idx" ON "map_conditional_formats" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "map_conditional_formats_item_idx" ON "map_conditional_formats" USING btree ("map_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "map_layouts_map_idx" ON "map_layouts" USING btree ("map_id");--> statement-breakpoint
CREATE UNIQUE INDEX "map_page_setup_map_idx" ON "map_page_setup" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "map_totals_map_idx" ON "map_totals" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "map_totals_item_idx" ON "map_totals" USING btree ("map_item_id");