-- Posteingang / Eingangsstrecke (Welle 4): Uploads + Teil-Dokumente.
-- PDF-Bytes (Original + Teile) liegen in S3 (extraction-inbox/{uploadId}/...),
-- hier nur Metadaten + Klassifikation + kleines Vorschau-PNG.

CREATE TABLE IF NOT EXISTS "extraction"."inbox_uploads" (
  "id"          text PRIMARY KEY NOT NULL,
  "filename"    text NOT NULL,
  "mime_type"   text,
  "page_count"  integer,
  "status"      text NOT NULL DEFAULT 'processing',  -- processing|ready|failed
  "error"       text,
  "note"        text,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "extraction"."inbox_parts" (
  "id"                text PRIMARY KEY NOT NULL,
  "upload_id"         text NOT NULL REFERENCES "extraction"."inbox_uploads"("id") ON DELETE CASCADE,
  "part_index"        integer NOT NULL DEFAULT 0,
  "page_from"         integer NOT NULL DEFAULT 1,
  "page_to"           integer NOT NULL DEFAULT 1,
  "filename"          text NOT NULL,
  "status"            text NOT NULL DEFAULT 'unassigned',  -- unassigned|auto_routed|routed
  "classification"    jsonb,
  "target_project_id" text,
  "batch_run_id"      text,
  "preview_data_uri"  text,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"        timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "extraction_inbox_parts_upload_idx"
  ON "extraction"."inbox_parts" ("upload_id");
