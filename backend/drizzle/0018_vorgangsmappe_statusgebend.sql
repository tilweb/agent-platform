-- Vorgangsmappe — document_types um `statusgebend` erweitern.
--
-- Wenn `statusgebend = true`, dann definiert ein Doc dieses Typs den
-- Vorgangs-Status (Wert aus dem DocuWare-Feld, das in config.yaml als
-- `status_field` konfiguriert ist; Cofermin-Default: BC_STATUS).

ALTER TABLE "vorgangsmappe"."document_types"
  ADD COLUMN IF NOT EXISTS "statusgebend" boolean NOT NULL DEFAULT false;
