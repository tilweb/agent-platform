# Extraktion: Posteingang / Eingangsstrecke (Splitten → Klassifizieren → Routen) — Ausbau-Welle 4

**Datum:** 2026-07-29
**Status:** Implementiert (main/Scalingo + demo/messe/Railway)
**Plan-Referenz:** `.claude/plans/dapper-wondering-oasis.md` (5-Wellen-Roadmap, W4)
**Fachkonzept:** `docs/fachkonzept-dokumenten-extraktion-2026-07-27.md` §14

## Kontext

Bisher galt: ein Projekt = ein Dokumenttyp, und der Anwender ordnet manuell zu. Der reale
Eingangsstrom ist aber gemischt — Scanner-Stapel und Sammel-PDFs mit mehreren Dokumenten
in einer Datei. Welle 4 baut die fehlende Stufe davor: einen **Posteingang**, der
Sammel-Scans **an Dokumentgrenzen trennt** (Vision-Seitenpaar-Urteil, erprobter Prompt aus
`docs/document-split/`), jedes Teil-Dokument **klassifiziert** (welches Extraktionsprojekt?)
und sichere Treffer **automatisch routet** (Batch-Lauf im Zielprojekt — dort greift die
W3-Review-Triage als zweites Netz). Damit wird aus dem Extraktions-Werkzeug eine
**Dokumenten-Eingangsstrecke**.

**Produktentscheidungen:** Auto-Routing ab Konfidenz ≥ 0.8 (`INBOX_AUTO_ROUTE_THRESHOLD`);
Mehrseiten-PDFs werden **immer** auf Grenzen geprüft (kein Opt-in — wer Einzeldokumente
hat, nutzt weiter den Batch-Tab des Projekts direkt).

## Wie es funktioniert

### Pipeline je Upload (fire-and-forget, `extraction/inbox/service.ts`)
1. **Original sichern** (Store) → PDF? Seitenzahl via `pdfinfo` (Fehler → `failed` mit
   klarer Meldung). Nicht-PDF-Bilder werden als Ein-Teil-Upload direkt klassifiziert.
2. **Split**: Seiten @150 dpi rendern → je Übergang ein Vision-Urteil (System-Prompt =
   eingebetteter `SPLIT_PROMPT`; „Page A" = letzte Seite des laufenden Clusters, „Page B"
   = erste des nächsten; Antwort exakt `true`/`false`). **Konservativ**: nur ein klares
   „true" trennt; unklare Antworten und Call-Fehler bedeuten „kein Schnitt" (falsch
   zusammengelassene Dokumente sind im Zielprojekt korrigierbar, falsch getrennte nicht).
   Parallelität `INBOX_SPLIT_CONCURRENCY` (2); Seiten-Cap `INBOX_MAX_PAGES` (60, darüber
   1 Teil + Hinweis).
3. **Teil-PDFs bauen**: neues Engine-Modul `services/extraction/pdf-split.ts` —
   `pdfseparate -f/-l` + `pdfunite` (poppler; in Aptfile/Dockerfile bereits enthalten).
   Fallbacks statt Hard-Fail: Splitter fehlt oder scheitert (z.B. verschlüsseltes PDF)
   → ein Teil (Originaldokument) + `note`.
4. **Klassifikation** (`inbox/classify.ts`): 1 Vision-Call auf die erste Seite je Teil
   gegen den Projekt-Katalog (id, Name, Beschreibung, Feld-Labels) mit strengen
   Confidence-Regeln (0.9/0.7/0.5-Stufen, „lieber niedrige Confidence als falsche
   Sicherheit" — Muster `classifyContract`). Freitext-JSON; Parsing mit Fallbacks
   (unbekannte ID → null + Konfidenz < 0.5, Clamping, Alternativen auf valide IDs
   gefiltert, max. 3).
5. **Auto-Routing**: Teile mit `project_id` + Konfidenz ≥ Schwelle werden **je Projekt zu
   einem Batch-Lauf gebündelt** (`createBatchRun` + `void runBatchExtraction` —
   vollständige Wiederverwendung der W1–W3-Strecke inkl. Review-Triage und Audit).
   Projekt-Existenz wird unmittelbar vor dem Routing geprüft (gelöscht → Teil bleibt
   `unassigned`). Rest: `unassigned` mit Vorschlag → manuelle Zuordnung
   (`routePart`, Route `POST /inbox/:id/parts/:partId/route`).
6. Kleines Vorschau-PNG je Teil (40 dpi, Seite 1, ~10–30 KB) für die UI.

### Persistenz (`inbox/store.ts` — die einzige divergente Datei)
- **Scalingo**: Metadaten in Postgres (Migration `0027`: `extraction.inbox_uploads` +
  `inbox_parts` mit echter FK-Cascade); PDF-Bytes (Original + Teile) in **S3** unter
  `extraction-inbox/{uploadId}/…` (neue `s3Paths.inboxOriginal/inboxPart` — das
  Scalingo-Dateisystem ist ephemeral, wartende Teile müssen Redeploys überleben).
  `deleteUpload` räumt DB (Cascade) + S3 (`listObjectsByPrefix`) ab.
- **Railway**: `data/extraction-inbox/{uploadId}/upload.yaml` (Metadaten + Teile inline)
  + `original.<ext>` + `parts/{partId}.pdf`; `deleteUpload` = Verzeichnis löschen.

### API (`routes/extraction-inbox.ts`, unter `/api/extraction`)
`POST /inbox` (Multi-Upload, je Datei ein Eintrag, 50-MB-Cap → 413, antwortet sofort;
**`split=false`** behandelt jede Datei als EIN Dokument — ohne Grenzprüfung und ohne die
LLM-Aufrufe je Seitenübergang; UI-Häkchen „Sammel-Scans an Dokumentgrenzen trennen", Default an,
ergänzt 2026-08-05 für Quellen, die ohnehin je Vorgang eine Datei liefern) ·
`GET /inbox` (Liste inkl. Teilen; führt den Stale-Sweep aus: processing älter 30 min →
failed „Verarbeitung unterbrochen") · `GET /inbox/:id` · `POST
/inbox/:id/parts/:partId/route` ({project_id}; 404/409-Fälle) · `DELETE /inbox/:id`.

### UI (`ExtractionProjectsPage.jsx`)
- Header-Button **„Posteingang (n)"** auf der Projektliste (n = laufende Uploads +
  unzugeordnete Teile); neue Ansicht (view `'inbox'`).
- Multi-Dropzone (PDF + Bilder), Upload-Liste mit Status-Badges + Polling (2,5 s solange
  etwas verarbeitet wird), `error`/`note`-Anzeige, Löschen je Eingang.
- Aufklappbar je Eingang: Teil-Zeilen mit **Thumbnail**, „Seiten X–Y", Klassifikation
  (Projektname + % + Alternativen); `unassigned` → Projekt-Auswahl (vorbelegt mit dem
  Vorschlag) + **„Zuordnen & verarbeiten"**; geroutet → „→ Projekt · Lauf gestartet
  (automatisch)" als Link in die Projekt-Detailansicht.

## Wichtige Designentscheidungen

- **Konservatives Split-Urteil** — Nicht-Trennen ist reparierbar, falsches Trennen nicht.
- **Auto-Routing als Default, W3 als Netz** — die Review-Triage im Zielprojekt markiert
  schwache Extraktionen ohnehin als „Zu prüfen"; deshalb ist automatisches Routing ab
  0.8 vertretbar.
- **Bündelung je Projekt** — ein Batch-Lauf pro Zielprojekt und Upload statt Lauf-Spam.
- **Eingebetteter Prompt** statt docs/-Datei — Deployment-Realität (Railway-Image).
- **S3 für Scalingo** — einzige persistente Binär-Ablage neben Postgres; bytea wäre
  möglich gewesen, S3 ist aber bereits etabliert (imageStorage) und querybar per Prefix.

## Verifikation

- **Tests:** 152 Backend-Tests grün, davon 16 neue (`split.test.ts`: Ranges aus Grenzen
  inkl. Randfälle/Längen-Mismatch, konservatives Verdikt-Parsing; `classify.test.ts`:
  Parsing/Fallbacks/Clamping/Alternativen, Teil-Dateinamen). tsc ohne neue Fehler,
  Frontend-Builds beide grün.
- **E2E (lokal, Port 3011, Scalingo-Worktree, Vision = Adacor-Default):**
  Test-Sammel-PDF aus zwei hauseigenen Dokumenten (Rechnung + Lieferschein via
  `generateDocument` + `pdfunite`) hochgeladen → Split erkannte die Grenze (2 Teile,
  Seiten 1–1/2–2), beide mit **0.95** korrekt klassifiziert, **automatisch geroutet**;
  beide Ziel-Batch-Läufe `completed` mit korrekt extrahierten Feldern und Review
  `auto_ok` — die Kette W4 → W1 (Felder) → W2 (Audit) → W3 (Triage) ist geschlossen.
  Kaputtes PDF → `failed` mit deutscher Meldung. DELETE entfernte alle S3-Objekte
  (vorher 3, nachher 0). Migration 0027 lief beim Boot.
- **Railway:** 9 Dateien 1:1 gespiegelt + YAML/FS-Store neu; 152 Tests grün;
  Store-Smoke-Roundtrip (Upload/Teile/Bytes/Delete) bestätigt.

## Grenzen / Folge-Ideen

- Seitenübergreifend **verschränkte** Dokumente (A-B-A) erkennt der lineare Split nicht.
- Klassifikation nutzt nur die erste Seite je Teil (Kosten-Nutzen-Abwägung).
- Kein Auto-Preview für Nicht-PDF-Bilder (v1; Klassifikation läuft trotzdem).
- W5-Kandidaten: E-Mail-/Watchfolder-Eingang, Posteingang per API + Webhooks,
  Sammel-Aktionen („alle Vorschläge übernehmen").
- **Nachtrag 2026-08-05:** Für Quellen mit „eine Datei = ein Vorgang" (z.B. ein RPA-Roboter, der
  je Lieferschein scannt) gibt es jetzt `split=false`. Gemessen an einem 3-seitigen Lieferschein:
  ohne Trennung ein Teil über alle Seiten; **mit** Trennung ebenfalls ein Teil — der konservative
  Splitter hat den Mehrseiter also nicht zerschnitten.
