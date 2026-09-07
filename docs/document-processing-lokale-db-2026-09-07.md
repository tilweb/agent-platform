# Lokaler Datenbankabgleich – 7. September 2026

Die Datenbank `workplace_dev` auf `localhost:5432` wurde an den aktuellen Document-Processing-Code angepasst. Keine produktive oder entfernte Datenbank geändert.

Die lokale Drizzle-Historie enthielt bereits Einträge für 0035 und 0036, während `batch_runs.snapshot`, `evaluations`, `model_slots` und `jobs.generation` fehlten. Die zusätzliche additive Migration `0037_extraction_schema_reconcile.sql` ergänzt diese Strukturen und ist auch auf vollständig migrierten Installationen ausführbar. Bestehende Migrationseinträge wurden nicht verändert.

Ausgeführt mit expliziter lokaler Verbindung über `bun run db:migrate`. Drizzle hat Migration 0037 als Eintrag 39 protokolliert; der gespeicherte SHA-256 stimmt mit der SQL-Datei überein.

Vorherige vollständige Sicherung (Custom-Format, Dateirechte 0600):
`/private/tmp/workplace-dev-before-document-processing.ik494m/workplace_dev.dump`

Die Sicherung liegt in einem temporären Verzeichnis und ist kein dauerhaftes Backup.

Verifikation: Spalten, Tabellen und Migrationshash kontrolliert. Ein transaktionaler Schreibtest für Dataset, Snapshot, Evaluation, Job-Generation und Modellslot war erfolgreich. Sämtliche Testdaten wurden per ROLLBACK entfernt. Bestehende Anwendungsdaten wurden nicht gelöscht.

Dieser Schritt ersetzt keine Browser- oder Modellabnahme; er schließt die zuvor fehlende lokale Datenbankanpassung ab.
