CREATE TYPE "public"."color_palette" AS ENUM('default', 'navy');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "color_palette" "color_palette" DEFAULT 'navy' NOT NULL;