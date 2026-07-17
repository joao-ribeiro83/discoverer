ALTER TABLE "export_jobs" ADD COLUMN "row_count" integer;--> statement-breakpoint
CREATE INDEX "export_jobs_created_at_idx" ON "export_jobs" USING btree ("created_at");