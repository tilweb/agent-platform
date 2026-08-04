# Extraktion: API & Integration + fachliche Härtung — Ausbau-Welle 5

**Datum:** 2026-08-03
**Status:** Implementiert (main/Scalingo + demo/messe/Railway)
**Plan-Referenz:** `~/.claude/plans/snug-gathering-ritchie.md`
**Fachkonzept:** `docs/fachkonzept-dokumenten-extraktion-2026-07-27.md` §14
**Vorgänger:** W1 Line-Items · W2 Eval-Harness · W3 Review-Workflow · W4 Posteingang

## Kontext

Nach W1–W4 war das Feature fachlich rund: Positionsdaten abbilden (W1), den Lern-Loop messbar
machen (W2), ihn im Betrieb füttern (W3), gemischte Eingangsstapel aufbrechen (W4). Drei Lücken
blieben:

1. **Das Tool wusste nicht, ob ein Ergebnis fachlich plausibel ist.** Geprüft wurden Typ/Format
   (Validator) und Konfidenz (Review-Triage). Eine Rechnung, deren Positionen nicht zum
   Gesamtbetrag summieren, galt bei hoher Konfidenz als „auto_ok" — genau der Fehler, den die
   Konfidenz strukturell nicht sehen kann.
2. **Es war von außen nicht ansprechbar.** Jede Verarbeitung brauchte einen Menschen in der UI;
   Dimension (a) „API" aus §8 des Fachkonzepts existierte nur als einzelne Extract-Route ohne
   Schlüssel, Stapel oder Rückkanal.
3. **Der Einstieg war Handarbeit** — Feldliste tippen, Typen raten, Positionstabellen selbst
   modellieren.

Dazu kam eine Betriebsschuld (Seitenbilder in der Datenzeile) und eine Schwäche des Lern-Loops
(Beispielauswahl ignoriert den Dokumenttyp).

## Produktentscheidungen (mit dem Auftraggeber festgelegt)

| Frage | Entscheidung |
|---|---|
| Reihenfolge der Welle | Fachnutzen zuerst: Prüfregeln → Schema-Inferenz → API/Webhooks → Seitenbilder → Ähnlichkeits-Few-Shot |
| Form des API-Zugangs | Function der Public-API (JSON + base64), **nicht** eigener REST-Zweig — Auth/Rate-Limit/Audit/OpenAPI nicht duplizieren |
| Rückmeldung | `callback_url` je Anfrage **plus** Projekt-Default, HMAC-SHA256-signiert, 3 Zustellversuche |
| Wirkung eines Regel-Befunds | erzwingt „Zu prüfen" (unabhängig von der Konfidenz) + Klartext-Anzeige |

## Die fünf Bausteine

### 1 · Fachliche Prüfregeln (`learning/rules.ts`, Migration 0029)

Zwei Regeltypen je Projekt (`project.rules`), konfigurierbar in den Projekt-Einstellungen:

- **Summen-Check** — Positions-Spalte summiert (Toleranz, Default 0,01) auf ein skalares Zielfeld.
- **Stammdaten-Abgleich** — Feldwert muss in einer Spalte einer **Tabelle** (Tables) vorkommen.

Bewusst *kein* Befund, wenn Zielfeld oder Liste leer sind — sonst wird jedes unvollständige
Dokument zum Alarm und die Regel verliert ihre Aussagekraft. Nicht ladbare Wertequelle → `warn`
statt falscher Sicherheit. Ein `error`-Befund hebt die Batch-Datei über `computeReviewStatus`
auf `needs_review`, unabhängig von der Konfidenz; nach „Übernehmen & lernen" werden die Befunde
gegen den korrigierten Stand **neu bewertet**.

Die Auswertung ist frei von Storage-Zugriffen (Wertequelle als Callback) — das ist der
Andockpunkt für W6 (s. u.).

### 2 · Schema-Inferenz (`learning/schema-infer.ts`)

Dropzone im Anlege-Dialog: ein LLM-Call liest ein Beispieldokument und schlägt Projektname,
Beschreibung und Feldliste vor — inklusive Positionstabelle als `list`-Feld. `parseInferredFields`
ist pur und **verwirft aggressiv** (ungültige Typen, Listen ohne Spalten, verschachtelte Listen,
Duplikat-IDs; Cap 30 Felder) und lässt den Vorschlag zur Sicherheit durch `validateProjectFields` —
ein kleinerer, sauberer Entwurf ist besser als ein halbgarer. Neu ist `ingestPlainText`: kein
Textlayer → erste Seiten rendern und per Vision beschreiben, damit auch **Scans** taugen.

### 3 · API-Batch + Webhooks (`extraction/public-functions.ts`, Migration 0030)

Vier Functions unter `/api/public/v1/extraktion/…`: `projects.list`, `extract` (synchron),
`batch.create` (bis 20 Dokumente, antwortet sofort), `batch.get`. Intern läuft **exakt die
UI-Strecke** (`createBatchRun` + `runBatchExtraction`) — Review-Triage, Audit und Prüfregeln
greifen unverändert.

Zwei Entscheidungen sind erklärungsbedürftig:

- **Virtuelle App statt Registry-Eintrag.** Das Public-API-Framework liest Functions aus der
  App-Registry. Ein echter Eintrag hätte über `Sidebar.jsx` einen Navigationspunkt auf
  `/apps/extraktion` erzeugt, der ins Leere führt, plus eine DB-Zeile, die ein Admin versehentlich
  deaktivieren kann. `public-api/virtual-apps.ts` hält solche Apps im Code; `listPublicApps()`
  ersetzt `getApps()` in Router, OpenAPI und Permissions-Katalog. Abschaltbar per
  `EXTRACTION_PUBLIC_API=0`.
- **`PublicFunctionError` im Framework.** Fachliche Fehler kamen beim Integrator als generischer
  500 `internal_error` an — an dem kann er nichts reparieren. Handler können jetzt Status + Klartext
  durchreichen (413 `payload_too_large`, 404 `not_found`, 400 `invalid_request`); alles Übrige
  bleibt ein 500 ohne Interna. Gilt für alle Apps, nicht nur die Extraktion.

Webhook: `callback_url` je Anfrage, sonst Projekt-Default (greift auch für UI-Läufe). Header
`X-Workplace-Signature: sha256=<hmac>` über den exakten Rumpf, Schlüssel je Projekt; 3 Versuche
(0/2/8 s), 10 s Timeout, `redirect: 'manual'`, 4xx ohne Wiederholung. Zustellstand am Lauf und als
Badge in der Lauf-Liste. Das Webhook-Ziel wandert **nicht** ins Export-Paket — eine weitergegebene
Vorlage würde sonst fremde Läufe an den falschen Empfänger melden.

### 4 · Seitenbilder raus aus der Datenzeile (`learning/page-store.ts`)

Gemessen an Bestandsläufen: **1,2–1,3 MB pro Dokument** lagen als base64 in der `detail`-Spalte —
in jedem Backup, jeder Replikation, obwohl sie nur beim Aufklappen einer Zeile gebraucht werden.
Jetzt: Bytes außerhalb, Referenz in der Zeile → **552 Byte** im Vergleichsfall.

Ausgeliefert wird über eine **Proxy-Route** (`…/files/:fileId/pages/:page`), nicht über signierte
S3-URLs: die CSP der Plattform erlaubt `img-src 'self' data: blob:` — eine Fremd-URL wäre im
Browser blockiert. Fail-Soft: ohne verfügbare Ablage (lokale Entwicklung ohne S3) oder bei
Schreibfehlern bleibt das Bild inline. **Kein Backfill** — Altläufe zeigen ihre Bilder unverändert.

### 5 · Ähnlichkeits-Few-Shot (`learning/similarity.ts`, Migration 0031)

Die bisherige Auswahl („Korrekturen zuerst, dann jung") trägt bei **einem** Dokumenttyp. Bei
mehreren füttert sie den Prompt mit Beispielen ohne Bezug. Jetzt wird das Anfragedokument per
Embedding verglichen; die ähnlichsten (bis 3, ab Score 0,5) kommen zuerst, danach die bisherige
Ordnung. Bewusst **kein** reines Ähnlichkeits-Ranking — die Korrektur-zuerst-Ordnung ist das, was
den Lern-Loop informativ macht.

Erster Nutzer des längst konfigurierten, aber ungenutzten Embedding-Modells
(`multilingual-e5-large`, 1024 Dim.). Embedding entsteht beim Speichern; fehlende werden im
Hintergrund nachgetragen (max. 20, mit Lock). Ohne Modell, bei hängendem Dienst oder mit
`EXTRACTION_SIMILARITY_FEWSHOT=0` bleibt exakt das alte Verhalten. Das Zeitlimit des
Embedding-Aufrufs steuert `EXTRACTION_EMBED_TIMEOUT_MS` (Default 8000) — läuft es ab, gilt das
Embedding als nicht verfügbar und die Auswahl fällt zurück, ohne die Extraktion zu verzögern.

## Persistenz & Divergenz

| Datum | Scalingo (Postgres/S3) | Railway (YAML/Volume) |
|---|---|---|
| Prüfregeln | `projects.rules` jsonb (0029) | `project.yaml` |
| Regel-Befunde | `batch_run_files.validations` jsonb (0029) | Datei-Record |
| Webhook-Ziel | `projects.webhook` jsonb (0030) | `project.yaml` |
| Webhook-Zustellstand | `batch_runs.webhook_*` (0030) | `run.yaml` |
| Seitenbilder | S3 `extraction-pages/{runId}/{fileId}/p{n}.png` | `data/extraction-batch-pages/…` |
| Beispiel-Embedding | `examples.embedding` jsonb (0031) | Beispiel-YAML |

Divergente Dateien sind jetzt **fünf**: `batch-runs.ts`, `examples.ts`, `projects.ts`,
`inbox/store.ts` und neu `page-store.ts`. Alles andere ist zwischen den Worktrees byte-identisch.

## Verifikation

Je Baustein ein Commit; alle Läufe lokal auf Port 3011 gegen echte Modelle.

1. **Prüfregeln** — Testrechnung mit falscher Summe (Positionen 1.500,50 vs. Gesamtbetrag 2.100,00)
   und unbekanntem Lieferanten erzeugte beide Befunde. Entscheidender Test: mit **Review-Schwelle
   0,1** (Feld-Konfidenzen 0,5–0,7 — die Triage könnte nicht auslösen) stand die Datei trotzdem auf
   „Zu prüfen". Korrektur per „Übernehmen & lernen" → 0 Befunde. Export/Import überträgt die Regeln.
2. **Schema-Inferenz** — Lieferschein → 11 Felder vorgeschlagen (Datum als `date`, Gewicht/Menge als
   `number`, „Lieferung vollständig" als `boolean`, Positionen als Liste mit 5 Spalten). Das daraus
   angelegte Projekt extrahierte das Dokument vollständig korrekt (3 Positionen, 2.080 kg).
3. **API** — Discovery und `openapi.json` listen die vier Functions; `batch.create` mit zwei
   Dokumenten + `callback_url` → Lauf durchgelaufen, Webhook eingetroffen, **Signatur vom Empfänger
   unabhängig nachgerechnet = identisch**, Regel-Befund und `needs_review` im Payload. Der
   Projekt-Default-Webhook feuerte auch für einen UI-Lauf. 21 Dokumente → 413 mit Klartext,
   unbekannter Lauf → 404, Key ohne passenden Scope → 403.
4. **Seitenbilder** — Vision-Lauf über ein Test-PDF: `detail` 552 Byte statt >1 MB, Seiten-Route
   liefert das PNG (1654×2339), Boxen und Werte korrekt, S3-Objekt vorhanden (82 KB) und nach dem
   Löschen des Laufs weg. Ein Bestandslauf mit 1,17 MB `dataUri` zeigt seine Bilder weiterhin.
5. **Ähnlichkeits-Few-Shot** — Projekt mit zwei Dokumenttypen (3 Rechnungen, 3 Arbeitszeugnisse):
   Rechnungs-Anfrage → nur Rechnungs-Beispiele, Zeugnis-Anfrage → nur Zeugnis-Beispiele; ohne
   Anfragetext bzw. mit Kill-Switch dieselbe Auswahl wie vorher. Backfill: 2 geleerte Embeddings
   automatisch nachgezogen.

**Tests:** 246 im Scalingo-Worktree (68 neue), 222 im Railway-Worktree; `tsc` ohne neue Fehler,
beide Frontend-Builds grün.

## Grenzen / Folge-Ideen

- **API nimmt nur base64**, keine URLs (SSRF-Fläche) und keinen multipart-Upload — große Scan-Stapel
  laufen weiter über den Posteingang in der UI.
- **Webhook-Ziele sind nicht eingeschränkt** (auch interne Adressen). Das ist für On-Prem-Empfänger
  gewollt; die URL setzt nur, wer Projekt-Einstellungen oder einen API-Key hat.
- **Die API-Functions sind keine Agenten-Tools.** Technisch möglich (`AppFunctionTool` registriert
  Registry-Apps automatisch), bewusst nicht getan: vier selten gebrauchte Einträge in der Tool-Liste
  jedes Agenten kosten Kontext. Nachrüstbar, wenn ein Agent das braucht.
- **Kein Backfill der Seitenbilder** — Altläufe bleiben groß, bis sie gelöscht werden.
- **Ähnlichkeit braucht Dokumenttext**: Bei Scans ohne Markitdown-Text greift die alte Auswahl.
- **Nächste Ausbaustufe W6** — kontrollierte Wertelisten als Ground Truth (s. Fachkonzept §14):
  je Feld eine endliche Liste zulässiger Werte, die (a) in den Prompt geht, (b) das Ergebnis
  normalisiert und (c) Abweichungen als Prüfregel-Befund meldet. Die `lookup`-Regel aus W5 ist
  bereits so geschnitten, dass W6 dieselbe Wertequelle nutzen kann.
