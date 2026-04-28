CREATE SCHEMA "apps";
--> statement-breakpoint
CREATE SCHEMA "audit";
--> statement-breakpoint
CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE SCHEMA "chat";
--> statement-breakpoint
CREATE SCHEMA "connections";
--> statement-breakpoint
CREATE SCHEMA "custom_skills";
--> statement-breakpoint
CREATE SCHEMA "custom_tools";
--> statement-breakpoint
CREATE SCHEMA "extraction";
--> statement-breakpoint
CREATE SCHEMA "generated";
--> statement-breakpoint
CREATE SCHEMA "memory";
--> statement-breakpoint
CREATE SCHEMA "notifications";
--> statement-breakpoint
CREATE SCHEMA "tasks";
--> statement-breakpoint
CREATE SCHEMA "projects";
--> statement-breakpoint
CREATE SCHEMA "tables";
--> statement-breakpoint
CREATE SCHEMA "kb";
--> statement-breakpoint
CREATE SCHEMA "vertragsmgmt";
--> statement-breakpoint
CREATE SCHEMA "projektmgmt";
--> statement-breakpoint
CREATE SCHEMA "liefermgmt";
--> statement-breakpoint
CREATE SCHEMA "vsm";
--> statement-breakpoint
CREATE SCHEMA "wzbar";
--> statement-breakpoint
CREATE TABLE "apps"."registry" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"version" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"routes" jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit"."public_api" (
	"id" text PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"api_key_id" text,
	"scope_type" text,
	"scope_id" text,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"app_id" text,
	"function_id" text,
	"status" integer NOT NULL,
	"error_code" text,
	"duration_ms" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit"."usage_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"source" text,
	"provider_id" text,
	"model_id" text,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"total_tokens" integer,
	"metadata" jsonb,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"hashed_key" text NOT NULL,
	"prefix" text NOT NULL,
	"scope" jsonb NOT NULL,
	"permissions" jsonb NOT NULL,
	"rate_limit" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "api_keys_prefix_unique" UNIQUE("prefix")
);
--> statement-breakpoint
CREATE TABLE "auth"."group_members" (
	"group_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."oauth_states" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"provider" text NOT NULL,
	"state" text NOT NULL,
	"redirect_uri" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text,
	"ip_address" text
);
--> statement-breakpoint
CREATE TABLE "auth"."users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text,
	"display_name" text,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"preferences" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "chat"."attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text,
	"filename" text NOT NULL,
	"content_type" text,
	"size_bytes" integer,
	"s3_key" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat"."folders" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat"."chats" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text,
	"agent_id" text,
	"folder_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat"."messages" (
	"id" text PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"role" text NOT NULL,
	"content" jsonb NOT NULL,
	"tool_calls" jsonb,
	"tool_call_id" text,
	"name" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connections"."user_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"account" text,
	"encrypted_payload" text NOT NULL,
	"metadata" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_skills"."skills" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb NOT NULL,
	"body" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_tools"."tools" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extraction"."profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text,
	"name" text NOT NULL,
	"fields" jsonb NOT NULL,
	"guidelines" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extraction"."projects" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text,
	"profile_id" text,
	"name" text NOT NULL,
	"documents" jsonb,
	"result" jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generated"."exports" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"kind" text NOT NULL,
	"filename" text,
	"s3_key" text NOT NULL,
	"expires_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generated"."images" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"prompt" text,
	"provider_id" text,
	"model_id" text,
	"s3_key" text NOT NULL,
	"content_type" text DEFAULT 'image/png' NOT NULL,
	"size_bytes" integer,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory"."session" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory"."user" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications"."notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"payload" jsonb,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks"."task_results" (
	"task_id" text PRIMARY KEY NOT NULL,
	"result" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks"."tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"status" text NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"scheduled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects"."project_members" (
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects"."projects" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tables"."rows" (
	"id" text PRIMARY KEY NOT NULL,
	"table_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tables"."tables" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text,
	"name" text NOT NULL,
	"description" text,
	"schema" jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kb"."collections" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"activate_when" jsonb,
	"never_activate_when" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kb"."documents" (
	"id" text PRIMARY KEY NOT NULL,
	"collection_id" text NOT NULL,
	"filename" text NOT NULL,
	"title" text,
	"content_type" text,
	"size_bytes" integer,
	"s3_key_content" text,
	"s3_key_index" text,
	"meta_md" text,
	"keywords" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kb"."indexer_state" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"collection_id" text,
	"filename" text,
	"progress" integer DEFAULT 0 NOT NULL,
	"error" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vertragsmgmt"."schemas" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"fields" jsonb NOT NULL,
	"mapping" jsonb NOT NULL,
	"is_system" text DEFAULT 'false' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vertragsmgmt"."contracts" (
	"id" text PRIMARY KEY NOT NULL,
	"contract_type" text,
	"upload_filename" text NOT NULL,
	"uploaded_at" timestamp with time zone NOT NULL,
	"uploaded_by" text NOT NULL,
	"s3_key_document" text,
	"s3_key_original" text,
	"original_size_bytes" integer,
	"extracted" jsonb,
	"computed" jsonb,
	"obligations" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projektmgmt"."attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"pa_id" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text,
	"s3_key" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projektmgmt"."projektauftraege" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text,
	"name" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"data" jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projektmgmt"."statusberichte" (
	"id" text PRIMARY KEY NOT NULL,
	"pa_id" text NOT NULL,
	"report_date" timestamp with time zone NOT NULL,
	"data" jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projektmgmt"."vorlagen" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"data" jsonb NOT NULL,
	"is_system" text DEFAULT 'false' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "liefermgmt"."audit_plans" (
	"jahr" integer PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "liefermgmt"."audits" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text,
	"data" jsonb NOT NULL,
	"status" text,
	"scheduled_for" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "liefermgmt"."changelog" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text,
	"user_id" text,
	"action" text NOT NULL,
	"diff" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "liefermgmt"."documents" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text,
	"size_bytes" integer,
	"s3_key" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "liefermgmt"."suppliers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"data" jsonb NOT NULL,
	"status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vsm"."projekte" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text,
	"name" text NOT NULL,
	"data" jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wzbar"."matches" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"input_text" text NOT NULL,
	"result" jsonb NOT NULL,
	"retrieval_top_k" jsonb,
	"llm_model" text,
	"embedding_model" text,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "auth"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."group_members" ADD CONSTRAINT "group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."oauth_states" ADD CONSTRAINT "oauth_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat"."messages" ADD CONSTRAINT "messages_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "chat"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction"."projects" ADD CONSTRAINT "projects_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "extraction"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks"."task_results" ADD CONSTRAINT "task_results_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "tasks"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects"."project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables"."rows" ADD CONSTRAINT "rows_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "tables"."tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb"."documents" ADD CONSTRAINT "documents_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "kb"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projektmgmt"."attachments" ADD CONSTRAINT "attachments_pa_id_projektauftraege_id_fk" FOREIGN KEY ("pa_id") REFERENCES "projektmgmt"."projektauftraege"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projektmgmt"."statusberichte" ADD CONSTRAINT "statusberichte_pa_id_projektauftraege_id_fk" FOREIGN KEY ("pa_id") REFERENCES "projektmgmt"."projektauftraege"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liefermgmt"."audits" ADD CONSTRAINT "audits_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "liefermgmt"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liefermgmt"."changelog" ADD CONSTRAINT "changelog_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "liefermgmt"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liefermgmt"."documents" ADD CONSTRAINT "documents_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "liefermgmt"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_public_api_timestamp_idx" ON "audit"."public_api" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "audit_public_api_key_idx" ON "audit"."public_api" USING btree ("api_key_id");--> statement-breakpoint
CREATE INDEX "audit_public_api_app_fn_idx" ON "audit"."public_api" USING btree ("app_id","function_id");--> statement-breakpoint
CREATE INDEX "usage_log_user_idx" ON "audit"."usage_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "usage_log_timestamp_idx" ON "audit"."usage_log" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "usage_log_model_idx" ON "audit"."usage_log" USING btree ("provider_id","model_id");--> statement-breakpoint
CREATE INDEX "api_keys_prefix_idx" ON "auth"."api_keys" USING btree ("prefix");--> statement-breakpoint
CREATE INDEX "api_keys_active_idx" ON "auth"."api_keys" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "group_members_pk_idx" ON "auth"."group_members" USING btree ("group_id","user_id");--> statement-breakpoint
CREATE INDEX "group_members_user_idx" ON "auth"."group_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oauth_states_expires_idx" ON "auth"."oauth_states" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "auth"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "auth"."sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "users_username_idx" ON "auth"."users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "attachments_session_idx" ON "chat"."attachments" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "chat_folders_user_idx" ON "chat"."folders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chats_user_idx" ON "chat"."chats" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chats_folder_idx" ON "chat"."chats" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "chats_updated_idx" ON "chat"."chats" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "messages_chat_idx" ON "chat"."messages" USING btree ("chat_id","created_at");--> statement-breakpoint
CREATE INDEX "user_connections_user_provider_idx" ON "connections"."user_connections" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "custom_skills_enabled_idx" ON "custom_skills"."skills" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "custom_tools_enabled_idx" ON "custom_tools"."tools" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "extraction_profiles_owner_idx" ON "extraction"."profiles" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "extraction_projects_owner_idx" ON "extraction"."projects" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "extraction_projects_profile_idx" ON "extraction"."projects" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "exports_user_idx" ON "generated"."exports" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "exports_expires_idx" ON "generated"."exports" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "generated_images_user_idx" ON "generated"."images" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "session_memory_key_idx" ON "memory"."session" USING btree ("session_id","key");--> statement-breakpoint
CREATE INDEX "user_memory_user_key_idx" ON "memory"."user" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications"."notifications" USING btree ("user_id","is_read","created_at");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks"."tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_user_idx" ON "tasks"."tasks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tasks_scheduled_idx" ON "tasks"."tasks" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "project_members_pk_idx" ON "projects"."project_members" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE INDEX "project_members_user_idx" ON "projects"."project_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "projects_owner_idx" ON "projects"."projects" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "user_table_rows_table_idx" ON "tables"."rows" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "user_tables_owner_idx" ON "tables"."tables" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "kb_documents_collection_idx" ON "kb"."documents" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "kb_indexer_state_status_idx" ON "kb"."indexer_state" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contracts_uploaded_by_idx" ON "vertragsmgmt"."contracts" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "contracts_type_idx" ON "vertragsmgmt"."contracts" USING btree ("contract_type");--> statement-breakpoint
CREATE INDEX "pa_attachments_pa_idx" ON "projektmgmt"."attachments" USING btree ("pa_id");--> statement-breakpoint
CREATE INDEX "pa_owner_idx" ON "projektmgmt"."projektauftraege" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "pa_status_idx" ON "projektmgmt"."projektauftraege" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pa_statusberichte_pa_idx" ON "projektmgmt"."statusberichte" USING btree ("pa_id","report_date");--> statement-breakpoint
CREATE INDEX "audits_supplier_idx" ON "liefermgmt"."audits" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "lief_changelog_supplier_idx" ON "liefermgmt"."changelog" USING btree ("supplier_id","created_at");--> statement-breakpoint
CREATE INDEX "supplier_documents_supplier_idx" ON "liefermgmt"."documents" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "suppliers_name_idx" ON "liefermgmt"."suppliers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "suppliers_status_idx" ON "liefermgmt"."suppliers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "vsm_projekte_owner_idx" ON "vsm"."projekte" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "wzbar_matches_user_idx" ON "wzbar"."matches" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "wzbar_matches_created_idx" ON "wzbar"."matches" USING btree ("created_at");