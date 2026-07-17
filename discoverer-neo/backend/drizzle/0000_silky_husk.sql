CREATE TYPE "public"."condition_type" AS ENUM('PARAMETER', 'STATIC');--> statement-breakpoint
CREATE TYPE "public"."connection_type" AS ENUM('oracle', 'postgres');--> statement-breakpoint
CREATE TYPE "public"."execution_status" AS ENUM('SUCCESS', 'FAILED', 'TIMEOUT');--> statement-breakpoint
CREATE TYPE "public"."export_format" AS ENUM('XLSX', 'CSV');--> statement-breakpoint
CREATE TYPE "public"."export_status" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."folder_type" AS ENUM('TABLE', 'VIEW', 'DERIVED', 'COMPLEX', 'JOIN', 'SUMMARY');--> statement-breakpoint
CREATE TYPE "public"."function_type" AS ENUM('SQL', 'PLSQL', 'PACKAGE');--> statement-breakpoint
CREATE TYPE "public"."item_type" AS ENUM('CI', 'CU', 'CO', 'JI', 'HI', 'AG', 'FU');--> statement-breakpoint
CREATE TYPE "public"."join_type" AS ENUM('INNER', 'LEFT', 'RIGHT', 'FULL');--> statement-breakpoint
CREATE TYPE "public"."logic_operator" AS ENUM('AND', 'OR');--> statement-breakpoint
CREATE TYPE "public"."map_type" AS ENUM('TABLE', 'CROSSTAB', 'PAGE_DETAIL', 'CHART');--> statement-breakpoint
CREATE TYPE "public"."map_operator" AS ENUM('=', '<>', '>', '<', '>=', '<=', 'LIKE', 'IN', 'BETWEEN', 'IS_NULL');--> statement-breakpoint
CREATE TYPE "public"."permission_level" AS ENUM('CREATE', 'EDIT', 'DELETE', 'EXPORT', 'SCHEDULE', 'VIEW');--> statement-breakpoint
CREATE TYPE "public"."policy_type" AS ENUM('ROW_LEVEL');--> statement-breakpoint
CREATE TYPE "public"."share_permission_level" AS ENUM('VIEW', 'EDIT', 'EXPORT');--> statement-breakpoint
CREATE TYPE "public"."sort_direction" AS ENUM('ASC', 'DESC');--> statement-breakpoint
CREATE TYPE "public"."target_type" AS ENUM('BUSINESS_AREA', 'FOLDER');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'MANAGER', 'USER', 'VIEWER');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(128) NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"entity_id" uuid,
	"details" jsonb,
	"ip_address" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "business_areas_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "custom_functions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"function_type" "function_type" NOT NULL,
	"parameters" jsonb,
	"return_type" varchar(64),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"connection_type" "connection_type" NOT NULL,
	"host" varchar(255),
	"port" integer,
	"service_name" varchar(255),
	"sid" varchar(64),
	"username" varchar(255),
	"password_enc" text,
	"connection_string" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "data_sources_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "export_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"map_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"format" "export_format" NOT NULL,
	"status" "export_status" DEFAULT 'PENDING' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"file_path" varchar(1024),
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_area_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"folder_type" "folder_type" NOT NULL,
	"table_name" varchar(255),
	"table_owner" varchar(255),
	"custom_sql" text,
	"data_source_id" uuid,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hierarchies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"business_area_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hierarchy_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hierarchy_id" uuid NOT NULL,
	"level_name" varchar(255) NOT NULL,
	"item_id" uuid NOT NULL,
	"level_number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folder_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"item_type" "item_type" NOT NULL,
	"column_name" varchar(255),
	"formula" text,
	"data_type" varchar(64),
	"format_mask" varchar(255),
	"agg_function" varchar(64),
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"parent_item_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "joins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"left_folder_id" uuid NOT NULL,
	"right_folder_id" uuid NOT NULL,
	"left_item_id" uuid,
	"right_item_id" uuid,
	"join_type" "join_type" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "map_calculated_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"map_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"formula" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "map_conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"map_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"operator" "map_operator" NOT NULL,
	"value" text,
	"param_name" varchar(255),
	"condition_type" "condition_type" NOT NULL,
	"group_id" uuid,
	"logic_operator" "logic_operator" DEFAULT 'AND' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "map_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"map_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"display_name" varchar(255),
	"format_mask" varchar(255),
	"agg_function" varchar(64),
	"sort_direction" "sort_direction",
	"sort_order" integer,
	"column_width" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "map_parameters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"map_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"param_type" varchar(32) NOT NULL,
	"default_value" text,
	"is_required" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "map_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"map_id" uuid NOT NULL,
	"shared_with_user_id" uuid NOT NULL,
	"permission_level" "share_permission_level" NOT NULL,
	"shared_by" uuid NOT NULL,
	"shared_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"map_type" "map_type" NOT NULL,
	"business_area_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "query_execution_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"map_id" uuid,
	"executed_by" uuid,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"execution_time_ms" integer,
	"row_count" integer,
	"sql_text" text,
	"error_message" text,
	"status" "execution_status" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_parameters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid NOT NULL,
	"param_name" varchar(255) NOT NULL,
	"param_value" text
);
--> statement-breakpoint
CREATE TABLE "scheduled_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid NOT NULL,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"row_count" integer,
	"file_path" varchar(1024),
	"execution_time_ms" integer,
	"status" "execution_status" NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"map_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"cron_expression" varchar(255) NOT NULL,
	"timezone" varchar(128) DEFAULT 'UTC' NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"output_format" "export_format" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"policy_type" "policy_type" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_policy_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid NOT NULL,
	"user_id" uuid,
	"role_name" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "security_policy_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"target_type" "target_type" NOT NULL,
	"sql_predicate" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_business_area_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"business_area_id" uuid NOT NULL,
	"permission_level" "permission_level" NOT NULL,
	"granted_by" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'USER' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_areas" ADD CONSTRAINT "business_areas_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_areas" ADD CONSTRAINT "business_areas_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_business_area_id_business_areas_id_fk" FOREIGN KEY ("business_area_id") REFERENCES "public"."business_areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hierarchies" ADD CONSTRAINT "hierarchies_business_area_id_business_areas_id_fk" FOREIGN KEY ("business_area_id") REFERENCES "public"."business_areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hierarchy_levels" ADD CONSTRAINT "hierarchy_levels_hierarchy_id_hierarchies_id_fk" FOREIGN KEY ("hierarchy_id") REFERENCES "public"."hierarchies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hierarchy_levels" ADD CONSTRAINT "hierarchy_levels_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "joins" ADD CONSTRAINT "joins_left_folder_id_folders_id_fk" FOREIGN KEY ("left_folder_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "joins" ADD CONSTRAINT "joins_right_folder_id_folders_id_fk" FOREIGN KEY ("right_folder_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "joins" ADD CONSTRAINT "joins_left_item_id_items_id_fk" FOREIGN KEY ("left_item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "joins" ADD CONSTRAINT "joins_right_item_id_items_id_fk" FOREIGN KEY ("right_item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_calculated_fields" ADD CONSTRAINT "map_calculated_fields_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_conditions" ADD CONSTRAINT "map_conditions_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_conditions" ADD CONSTRAINT "map_conditions_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_items" ADD CONSTRAINT "map_items_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_items" ADD CONSTRAINT "map_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_parameters" ADD CONSTRAINT "map_parameters_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_shares" ADD CONSTRAINT "map_shares_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_shares" ADD CONSTRAINT "map_shares_shared_with_user_id_users_id_fk" FOREIGN KEY ("shared_with_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_shares" ADD CONSTRAINT "map_shares_shared_by_users_id_fk" FOREIGN KEY ("shared_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maps" ADD CONSTRAINT "maps_business_area_id_business_areas_id_fk" FOREIGN KEY ("business_area_id") REFERENCES "public"."business_areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maps" ADD CONSTRAINT "maps_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_execution_log" ADD CONSTRAINT "query_execution_log_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_execution_log" ADD CONSTRAINT "query_execution_log_executed_by_users_id_fk" FOREIGN KEY ("executed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_parameters" ADD CONSTRAINT "schedule_parameters_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_results" ADD CONSTRAINT "scheduled_results_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_policy_assignments" ADD CONSTRAINT "security_policy_assignments_policy_id_security_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."security_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_policy_assignments" ADD CONSTRAINT "security_policy_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_policy_rules" ADD CONSTRAINT "security_policy_rules_policy_id_security_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."security_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_business_area_grants" ADD CONSTRAINT "user_business_area_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_business_area_grants" ADD CONSTRAINT "user_business_area_grants_business_area_id_business_areas_id_fk" FOREIGN KEY ("business_area_id") REFERENCES "public"."business_areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_business_area_grants" ADD CONSTRAINT "user_business_area_grants_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_user_idx" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "business_areas_name_idx" ON "business_areas" USING btree ("name");--> statement-breakpoint
CREATE INDEX "business_areas_created_by_idx" ON "business_areas" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "data_sources_name_idx" ON "data_sources" USING btree ("name");--> statement-breakpoint
CREATE INDEX "export_jobs_map_idx" ON "export_jobs" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "export_jobs_requested_by_idx" ON "export_jobs" USING btree ("requested_by");--> statement-breakpoint
CREATE INDEX "export_jobs_status_idx" ON "export_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "folders_ba_idx" ON "folders" USING btree ("business_area_id");--> statement-breakpoint
CREATE INDEX "folders_data_source_idx" ON "folders" USING btree ("data_source_id");--> statement-breakpoint
CREATE INDEX "folders_created_by_idx" ON "folders" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "hierarchies_ba_idx" ON "hierarchies" USING btree ("business_area_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hierarchy_levels_hierarchy_number_idx" ON "hierarchy_levels" USING btree ("hierarchy_id","level_number");--> statement-breakpoint
CREATE INDEX "hierarchy_levels_item_idx" ON "hierarchy_levels" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "items_folder_idx" ON "items" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "items_parent_idx" ON "items" USING btree ("parent_item_id");--> statement-breakpoint
CREATE INDEX "items_created_by_idx" ON "items" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "joins_left_folder_idx" ON "joins" USING btree ("left_folder_id");--> statement-breakpoint
CREATE INDEX "joins_right_folder_idx" ON "joins" USING btree ("right_folder_id");--> statement-breakpoint
CREATE INDEX "joins_left_item_idx" ON "joins" USING btree ("left_item_id");--> statement-breakpoint
CREATE INDEX "joins_right_item_idx" ON "joins" USING btree ("right_item_id");--> statement-breakpoint
CREATE INDEX "map_calculated_fields_map_idx" ON "map_calculated_fields" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "map_conditions_map_idx" ON "map_conditions" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "map_conditions_item_idx" ON "map_conditions" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "map_items_map_idx" ON "map_items" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "map_items_item_idx" ON "map_items" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "map_parameters_map_idx" ON "map_parameters" USING btree ("map_id");--> statement-breakpoint
CREATE UNIQUE INDEX "map_shares_map_user_idx" ON "map_shares" USING btree ("map_id","shared_with_user_id");--> statement-breakpoint
CREATE INDEX "map_shares_user_idx" ON "map_shares" USING btree ("shared_with_user_id");--> statement-breakpoint
CREATE INDEX "maps_ba_idx" ON "maps" USING btree ("business_area_id");--> statement-breakpoint
CREATE INDEX "maps_created_by_idx" ON "maps" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "query_execution_log_map_idx" ON "query_execution_log" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "query_execution_log_user_idx" ON "query_execution_log" USING btree ("executed_by");--> statement-breakpoint
CREATE INDEX "query_execution_log_at_idx" ON "query_execution_log" USING btree ("executed_at");--> statement-breakpoint
CREATE INDEX "schedule_parameters_schedule_idx" ON "schedule_parameters" USING btree ("schedule_id");--> statement-breakpoint
CREATE INDEX "scheduled_results_schedule_idx" ON "scheduled_results" USING btree ("schedule_id");--> statement-breakpoint
CREATE INDEX "schedules_map_idx" ON "schedules" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "schedules_created_by_idx" ON "schedules" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "security_policy_assignments_policy_idx" ON "security_policy_assignments" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "security_policy_assignments_user_idx" ON "security_policy_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "security_policy_rules_policy_idx" ON "security_policy_rules" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "security_policy_rules_target_idx" ON "security_policy_rules" USING btree ("target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_ba_grants_user_ba_idx" ON "user_business_area_grants" USING btree ("user_id","business_area_id");--> statement-breakpoint
CREATE INDEX "user_ba_grants_ba_idx" ON "user_business_area_grants" USING btree ("business_area_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_parent_item_id_items_id_fk" FOREIGN KEY ("parent_item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;
