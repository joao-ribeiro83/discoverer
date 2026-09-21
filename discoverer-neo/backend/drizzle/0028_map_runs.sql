-- The run queue's store: every "run this map" request — live preview or
-- scheduled — becomes one map_runs row, and its result rows land in
-- map_run_batches (1 000 rows per JSONB batch, keyed by run_id + seq) instead
-- of an Oracle round trip on every export. scheduled_results.run_id lets a
-- schedule's history page point at the batches its run produced; schedules
-- gets its own retention column so BR_EXPIRY has somewhere to live.
CREATE TYPE "public"."run_kind" AS ENUM('LIVE', 'SCHEDULED');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "map_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"map_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"kind" "run_kind" NOT NULL,
	"schedule_id" uuid,
	"run_key" varchar(64) NOT NULL,
	"parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"calculated_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "run_status" DEFAULT 'QUEUED' NOT NULL,
	"columns" jsonb,
	"decoration" jsonb,
	"row_count" integer,
	"truncated" boolean DEFAULT false NOT NULL,
	"execution_time_ms" integer,
	"sql_text" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "map_run_batches" (
	"run_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"rows" jsonb NOT NULL,
	CONSTRAINT "map_run_batches_run_id_seq_pk" PRIMARY KEY("run_id","seq")
);
--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "result_retention_days" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_results" ADD COLUMN "run_id" uuid;--> statement-breakpoint
ALTER TABLE "map_runs" ADD CONSTRAINT "map_runs_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_runs" ADD CONSTRAINT "map_runs_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_runs" ADD CONSTRAINT "map_runs_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_run_batches" ADD CONSTRAINT "map_run_batches_run_id_map_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."map_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_results" ADD CONSTRAINT "scheduled_results_run_id_map_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."map_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "map_runs_user_status_created_idx" ON "map_runs" USING btree ("requested_by","status","created_at");--> statement-breakpoint
CREATE INDEX "map_runs_key_idx" ON "map_runs" USING btree ("run_key","status");--> statement-breakpoint
CREATE INDEX "map_runs_expires_idx" ON "map_runs" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "map_runs_map_idx" ON "map_runs" USING btree ("map_id");
