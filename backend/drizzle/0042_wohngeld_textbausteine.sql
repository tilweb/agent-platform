-- Wohngeld Welle 3 — Textbausteine für Anforderungsschreiben (WP6).
-- Idempotent (IF NOT EXISTS + ON CONFLICT DO NOTHING), wird von migrate() beim Boot angewendet.

CREATE TABLE IF NOT EXISTS "wohngeld"."textbausteine" (
  "id"         text PRIMARY KEY NOT NULL,
  "kategorie"  text NOT NULL DEFAULT 'Allgemein',
  "titel"      text NOT NULL DEFAULT '',
  "text"       text NOT NULL DEFAULT '',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "wg_textbaustein_kategorie_idx" ON "wohngeld"."textbausteine" ("kategorie");

-- Sinnvolle Default-Bausteine (idempotent über feste IDs).
INSERT INTO "wohngeld"."textbausteine" ("id", "kategorie", "titel", "text") VALUES
  ('tb-seed-miete-aktuell', 'Miete', 'Aktuelle Mietbescheinigung',
   'Bitte reichen Sie eine aktuelle Mietbescheinigung bzw. eine Bestätigung des Vermieters über die derzeitige Höhe der Bruttokaltmiete ein.'),
  ('tb-seed-miete-zahlung', 'Miete', 'Nachweis der Mietzahlung',
   'Bitte legen Sie einen Nachweis der letzten Mietzahlung(en) vor (z. B. Kontoauszug der letzten drei Monate, aus dem die Mietabbuchung hervorgeht).'),
  ('tb-seed-eink-verdienst', 'Einkommen', 'Verdienstbescheinigung',
   'Bitte lassen Sie die beigefügte Verdienstbescheinigung von Ihrem Arbeitgeber ausfüllen und reichen Sie diese zusammen mit den Gehaltsabrechnungen der letzten zwölf Monate ein.'),
  ('tb-seed-eink-rente', 'Einkommen', 'Aktueller Rentenbescheid',
   'Bitte reichen Sie den aktuellen Rentenbescheid bzw. die aktuelle Rentenanpassungsmitteilung ein, aus der die Rentenart und die Höhe hervorgehen.'),
  ('tb-seed-allg-frist', 'Allgemein', 'Fristsetzung',
   'Bitte reichen Sie die angeforderten Unterlagen innerhalb der genannten Frist ein. Sollten die Unterlagen nicht fristgerecht eingehen, muss über Ihren Antrag nach Aktenlage entschieden werden.'),
  ('tb-seed-allg-rueckfragen', 'Allgemein', 'Rückfragen',
   'Für Rückfragen stehen wir Ihnen gerne zur Verfügung. Bitte geben Sie bei allen Schreiben Ihre Antrags-Nummer an.')
ON CONFLICT ("id") DO NOTHING;
