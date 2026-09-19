-- Wohngeld GOV-3 — KI-Transparenzhinweis als Default-Textbaustein (AI Act Art. 13/14 DSGVO).
-- Idempotent (feste ID + ON CONFLICT DO NOTHING), wird von migrate() beim Boot angewendet.
-- So kann der Hinweis in Anschreiben/Bescheide eingefügt werden.

INSERT INTO "wohngeld"."textbausteine" ("id", "kategorie", "titel", "text") VALUES
  ('tb-seed-ki-transparenz', 'Allgemein', 'KI-Transparenzhinweis',
   'Bei der Bearbeitung Ihres Antrags wurde ein KI-gestützter Assistent zur Vollständigkeits- und Plausibilitätsprüfung eingesetzt. Es findet keine automatisierte Einzelentscheidung statt; die Entscheidung wurde von einer Sachbearbeiterin bzw. einem Sachbearbeiter getroffen.')
ON CONFLICT ("id") DO NOTHING;
