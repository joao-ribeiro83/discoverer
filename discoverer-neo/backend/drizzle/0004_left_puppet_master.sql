CREATE TYPE "public"."locale" AS ENUM('en', 'pt-PT', 'fr-FR', 'es-ES');--> statement-breakpoint
CREATE TYPE "public"."theme" AS ENUM('light', 'dark', 'high-contrast');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "locale" "locale" DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "theme" "theme" DEFAULT 'light' NOT NULL;