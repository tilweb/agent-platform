-- Phase 2-Chat: zusaetzliche Felder auf chat.chats fuer Summary/Sharing/Project-Scope,
-- color auf chat.folders, neue chat.folder_members-Tabelle (n:m).

ALTER TABLE "chat"."chats" ADD COLUMN IF NOT EXISTS "summary" text;--> statement-breakpoint
ALTER TABLE "chat"."chats" ADD COLUMN IF NOT EXISTS "keywords" jsonb;--> statement-breakpoint
ALTER TABLE "chat"."chats" ADD COLUMN IF NOT EXISTS "project_id" text;--> statement-breakpoint
ALTER TABLE "chat"."chats" ADD COLUMN IF NOT EXISTS "share_token" text;--> statement-breakpoint
ALTER TABLE "chat"."chats" ADD COLUMN IF NOT EXISTS "shared_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chat"."chats" DROP COLUMN IF EXISTS "folder_id";--> statement-breakpoint
DROP INDEX IF EXISTS "chats_folder_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chats_project_idx" ON "chat"."chats" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chats_share_idx" ON "chat"."chats" USING btree ("share_token");--> statement-breakpoint

ALTER TABLE "chat"."folders" ADD COLUMN IF NOT EXISTS "color" text;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "chat"."folder_members" (
	"chat_id" text NOT NULL,
	"folder_id" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat"."folder_members" ADD CONSTRAINT "chat_folder_members_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "chat"."chats"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat"."folder_members" ADD CONSTRAINT "chat_folder_members_folder_id_fk" FOREIGN KEY ("folder_id") REFERENCES "chat"."folders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_folder_members_chat_idx" ON "chat"."folder_members" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_folder_members_folder_idx" ON "chat"."folder_members" USING btree ("folder_id");
