# Storage-Architektur — Postgres (Scalingo) + Object Storage (Flow.swiss)

**Datum:** 2026-04-29
**Status:** Phase 1 (Foundation) abgeschlossen — Schema und Bucket existieren, aber noch kein Modul nutzt sie. Phase 2 (Modul-für-Modul-Migration weg von YAML-Files) folgt in eigenen Sessions.

## Hintergrund

Wir verlassen Railway zugunsten einer rein europäischen Hosting-Konstellation:
- **Scalingo** (Paris, France — ISO 27001 + HDS) als PaaS-Host und Postgres-Provider
- **Flow.swiss** (Schweiz, S3-kompatibel — DSGVO + EU-EWR-konform) für Binary/Blob-Daten

Der bisherige Stack persistierte alles als YAML/JSON-Files unter `data/`. Scalingo hat **kein persistentes Filesystem**, daher muss alles, was über einen Container-Restart hinaus erhalten bleiben soll, in eine externe Persistenz wandern: strukturierte Daten in Postgres, Binärdaten in S3.

## Storage-Klassifikation

Jede der bisher per YAML/JSON gespeicherten Daten wandert in eine von vier Kategorien:

| Kategorie | Wohin | Beispiele |
|---|---|---|
| **DB** (Postgres) | Scalingo Postgres-Addon | Users, Sessions, API-Keys, Audit-Logs, App-Metadaten |
| **S3** (Flow Object Storage) | `workplace-poc-demo` Bucket | Original-PDFs, Bilder, Anhänge, KB-Quelldokumente |
| **Hybrid** | Metadaten in DB, Bytes in S3 | Verträge, Dokumente, Knowledge-Base-Dokumente |
| **Code-Asset** | Im Docker-Image (Build-Time) | System-Skills, System-Agents, Provider-Config |

Die vollständige Mapping-Tabelle (welche YAML-Datei wohin wandert) liegt in der vorigen Plan-Session und wird bei Phase 2 modulweise abgearbeitet.

## DB-Schema-Übersicht

Drizzle ORM mit `postgres-js` als Driver. Pro Themenbereich ein dediziertes Postgres-Schema (`auth.users`, `chat.messages`, `apps.registry`, …) — verbessert Auffindbarkeit und macht Spalten-Konflikte unmöglich.

| Schema | Tabellen | Zweck |
|---|---|---|
| `auth` | users, sessions, oauth_states, groups, group_members, api_keys | Authentifizierung + API-Keys |
| `audit` | public_api, usage_log | Audit-Logs der Public-API + LLM-Usage |
| `chat` | folders, chats, messages, attachments | Chat-System (Attachments via S3) |
| `memory` | user, session | Long-/short-term Memory |
| `connections` | user_connections | OAuth-Tokens externer Provider (verschlüsselt) |
| `notifications` | notifications | User-Notifications |
| `tasks` | tasks, task_results | Task-Queue |
| `projects` | projects, project_members | Generische Projekt-Container |
| `extraction` | profiles, projects | Extraktions-Pipelines |
| `tables` | tables, rows | User-defined Tabellen (JSONB-Rows) |
| `custom_tools` | tools | Custom REST-API-Tools (User-definiert) |
| `custom_skills` | skills | Custom Skills (User-definiert) |
| `kb` | collections, documents, indexer_state | Knowledge-Base (Hybrid: meta_md in DB, content/index in S3) |
| `apps` | registry | App-Registrierung (Admin-Toggle, ENV-Filter zur Laufzeit) |
| `vertragsmgmt` | schemas, contracts | Vertragsmanagement (Original-Files in S3) |
| `projektmgmt` | projektauftraege, statusberichte, vorlagen, attachments | Projektmanagement |
| `liefermgmt` | suppliers, documents, audits, audit_plans, changelog | Lieferantenmanagement |
| `vsm` | projekte | Value Stream Mapping (Diagramm-Daten als JSONB) |
| `wzbar` | matches | WZ-Branchen-Matcher Audit-Trail |
| `generated` | images, exports | KI-generierte Bilder, Document-Exports (Bytes in S3) |

**Konventionen:**
- IDs als `text` (kompatibel mit den Bestands-Formaten wie `user_<ts>_<rand>`, `apk_...`)
- Timestamps als `timestamp({withTimezone: true, mode: 'string'})` → ISO-Strings, deckt sich mit den heutigen YAML-Datums-Werten
- Komplexe verschachtelte Strukturen (Diagramme, Erfolg-Kriterien-Listen, Memory-Items) als `jsonb`
- Foreign Keys mit `ON DELETE CASCADE` wo logisch (z.B. messages → chats)
- Indexe auf häufigen Lookup-Spalten (`username`, `prefix` für api_keys, `userId`, `sessionId`)

## S3-Bucket-Layout

Ein Bucket pro Customer-Service (Default `workplace-poc-demo`, per ENV `FLOW_S3_BUCKET` überschreibbar). Innerhalb des Buckets:

```
<bucket>/
├── users/<userId>/<path>                                # File-Tools
├── chat-uploads/<sessionId>/<file>                      # Chat-Anhänge
├── kb/<collectionId>/<docId>/content.md                 # Knowledge-Base-Inhalte
├── kb/<collectionId>/<docId>/INDEX.md                   # KB-Indexe (große Docs)
├── kb/incoming/<uploadId>/<filename>                    # Quarantäne, TTL
├── generated-images/<imageId>.png                       # KI-Bilder
├── exports/<exportId>.<format>                          # Doc-Exports, mit TTL
├── apps/vertragsmanagement/<contractId>/document.md     # Konvertierter Vertrag
├── apps/vertragsmanagement/<contractId>/original.<ext>  # Original-PDF/DOCX
├── apps/projektmanagement/<paId>/anhaenge/<filename>    # Projektauftrag-Anhänge
└── apps/lieferantenmanagement/<supplierId>/<docId>/<file>
```

**Zentrale Konvention:** Pfade werden in `backend/src/storage/paths.ts` als Helper-Funktionen definiert. Kein Modul hardcoded eigene Pfade.

**Zugriff:** Nur via Backend, nie direkter Frontend-Zugriff. Frontend bekommt bei Bedarf eine Signed URL (Default 5 Min TTL) — damit ist jeder Read im Backend-Audit-Log sichtbar.

## Migration-Workflow (Phase 2 — ausstehend)

Modulweise mit Dual-Write-Pattern, damit jederzeit Rollback möglich ist:

1. **Drizzle-Schema** ist bereits da (Phase 1).
2. Pro Modul (Auth zuerst, dann Audit, Chat, Apps, KB, Rest):
   - **Read von beiden** Quellen: erst DB versuchen, Fallback auf YAML.
   - **Write in beide** Quellen synchron: DB + YAML parallel.
   - Daten-Migrations-Skript läuft einmal: alle existierenden YAML-Files in DB/S3 spiegeln.
   - Nach Verifikations-Phase: YAML-Reads aus dem Code entfernen.
   - Nach längerer Stabilität: YAML-Writes entfernen → Volume kann verkleinert werden / wegfallen.
3. Reihenfolge nach Risikoprofil: Auth → Audit/Usage → Apps (klein) → Chat → KB → Rest.

## ENV-Variablen-Referenz

```sh
# Postgres (Scalingo Addon)
SCALINGO_POSTGRES=postgres://user:pass@host:port/dbname?sslmode=prefer

# Flow.swiss S3
FLOW_S3_ENDPOINT=https://os.alp1.flow.swiss
FLOW_S3_MASTER=<access-key>
FLOW_S3_SECRET=<secret-key>
FLOW_S3_BUCKET=workplace-poc-demo            # optional, Default ist ok für Demo
```

Existing ENVs bleiben unangetastet (CONNECTION_ENCRYPTION_KEY für OAuth-Tokens, ADACOR_AI_API_KEY etc.).

## Local-Dev-Setup

**Bevorzugt:** Direkt gegen Scalingo-Postgres (von Production) entwickeln — aber Scalingo's DB ist nur über `scalingo db-tunnel` von außen erreichbar:

```sh
scalingo --app <app-name> db-tunnel SCALINGO_POSTGRES_URL
# öffnet localhost:10000
# dann SCALINGO_POSTGRES auf den lokalen Tunnel zeigen
```

**Alternativ:** Lokales Postgres (Docker) für isolierte Dev:

```sh
docker run -d --name workplace-pg -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:16
# .env: SCALINGO_POSTGRES=postgres://postgres:dev@localhost:5432/postgres
```

Migration läuft per `bun run db:migrate` (oder automatisch beim Backend-Start in `initialize()`).

S3 (Flow.swiss) ist von überall erreichbar — keine Tunnel nötig. Optional kann lokal eine MinIO-Instanz genutzt werden, indem `FLOW_S3_ENDPOINT` umgebogen wird.

## Verifikation Phase 1 (heute, 2026-04-29)

| Test | Ergebnis |
|---|---|
| Drizzle-Schema generiert (`drizzle-kit generate`) | ✅ — 605-zeilige `0000_little_junta.sql`, 18 Schemas, ~40 Tabellen |
| S3-Bucket erreichbar | ✅ — `ensureBucket()` legt `workplace-poc-demo` an |
| S3-Roundtrip (put/get/delete) | ✅ — funktioniert gegen `os.alp1.flow.swiss` |
| Postgres-Migration | ⏳ — läuft beim ersten Scalingo-Container-Start automatisch (Scalingo-DB von außen nicht erreichbar) |
| Backend startet ohne Regression | ✅ — alle bisherigen Endpoints unverändert (DB/S3 nicht in Read-Pfaden) |

## Out-of-Scope für Phase 1

- Daten-Migration (bestehende YAML-Files → DB/S3)
- Modul-Refactoring (Auth, Chat, Apps lesen weiterhin aus YAML)
- S3-Lifecycle-Rules (Auto-Delete für `exports/`, `kb/incoming/`)
- Postgres-GIN-Indexe für JSONB-Filter (z.B. `user_table_rows.data`)
- Performance-Tuning, Connection-Pooling-Sizing
- Backup-/Restore-Strategie über Scalingo's Standard-Daily-Backups hinaus

## Aufrufe

```sh
# Migration generieren (lokal nach Schema-Änderung)
bun run db:generate           # erzeugt backend/drizzle/<NN>_<name>.sql

# Migration anwenden (beim Container-Start automatisch in initialize())
bun run db:migrate            # nur lokal mit DB-Tunnel sinnvoll

# Drizzle Studio (GUI)
bun run db:studio             # öffnet https://local.drizzle.studio

# Schema synchronisieren ohne Migrations (DEV ONLY!)
bun run db:push
```

## Aktuelle Datei-Struktur

```
backend/
├── drizzle/
│   ├── 0000_little_junta.sql                # Initial-Migration
│   └── meta/                                # drizzle-kit Snapshot
├── src/
│   ├── db/
│   │   ├── client.ts                        # postgres-js Client (lazy)
│   │   ├── index.ts                         # Drizzle-Wrapper
│   │   ├── migrate.ts                       # runMigrations() für initialize()
│   │   └── schema/
│   │       ├── index.ts                     # Re-Exports aller Module
│   │       ├── auth.ts                      # users, sessions, ...
│   │       ├── audit.ts
│   │       ├── chat.ts
│   │       ├── memory.ts
│   │       ├── connections.ts
│   │       ├── notifications.ts
│   │       ├── tasks.ts
│   │       ├── projects.ts
│   │       ├── extraction.ts
│   │       ├── tables.ts
│   │       ├── custom_tools.ts
│   │       ├── custom_skills.ts
│   │       ├── kb.ts
│   │       ├── apps.ts
│   │       ├── vertragsmgmt.ts
│   │       ├── projektmgmt.ts
│   │       ├── liefermgmt.ts
│   │       ├── vsm.ts
│   │       ├── wzbar.ts
│   │       └── generated.ts
│   └── storage/
│       ├── s3.ts                            # S3Client + Helper + ensureBucket
│       └── paths.ts                         # zentrale Pfad-Konventionen
└── package.json                             # neue scripts: db:generate/migrate/push/studio

drizzle.config.ts                            # top-level — lädt backend/.env manuell
```
