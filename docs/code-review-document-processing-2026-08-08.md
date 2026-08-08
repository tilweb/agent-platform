# Code-Review — Document Processing / Extraction

**Datum:** 2026-08-08
**Umfang:** gesamte Strecke — Engine (`services/extraction/`), Learning-Layer
(`extraction/learning/`), Segmentierung (`extraction/segmentation/`), Posteingang
(`extraction/inbox/`), Public-API (`public-api/`), HTTP-Routen (`routes/extraction-*.ts`),
Konverter (`services/documentConverter.ts`), Frontend (`ExtractionProjectsPage.jsx`).
**Methode:** statischer Durchgang + Live-Proben gegen das laufende Backend (Port 3001).
Jeder Befund mit Datei:Zeile; Live-verifizierte Befunde als **[live bestätigt]** markiert.
**Gültig für beide Worktrees** (`main` = Postgres, `../agent-platform-railway` = YAML),
sofern nicht anders vermerkt.

---

## Zusammenfassung (severity-sortiert)

| # | Sev | Befund | Datei:Zeile | Status |
|---|-----|--------|-------------|--------|
| 1 | **P0 Critical** | Gesamte Document-Processing-Fläche ohne Authentifizierung erreichbar | `routes/extraction-projects.ts`, `routes/extraction-inbox.ts`, `index.ts:359–361` | **✅ behoben** |
| 2 | **P1 High** | SSRF über Webhook-Ziel (nur Protokoll-Check) | `learning/webhook.ts:46` | **✅ behoben** |
| 3 | **P1 High** | Batch-Upload ohne Datei-Anzahl-/Größen-Limit, alles in RAM | `routes/extraction-projects.ts:426–468` | **✅ behoben** |
| 4 | **P2 Medium** | Batch-`tmpDir` wird nie gelöscht (Verzeichnis-Leak) | `learning/batch-service.ts:153` | **✅ behoben** |
| 5 | **P2 Medium** | Fire-and-forget-Batch ohne Watchdog → Run bleibt bei Crash „läuft" | `routes/extraction-projects.ts:463` | **✅ behoben** |
| 6 | **P2 Medium** | Triage löst Listen-Positionen in *repeatable* Segmenten nicht auf (verifiziert: Triage-Loch, kein reines Anzeigethema) | `extraction/learning/review.ts:77` | **✅ behoben** (inkl. Frontend-Zeilenboxen) |
| 7 | **P3 Low** | `/jobs/run-sync` immer 401 (kein Middleware setzt `userId`) | `routes/extraction-jobs.ts:44` | mit #1 mitbehoben |
| 8 | **P3 Low** | Temp-Namen via `Math.random()` statt `crypto.randomUUID()` | `routes/extraction-projects.ts:444` | **✅ behoben** |

> **Update 2026-08-08 (Runde 1):** Befunde 1–4 umgesetzt (beide Worktrees), Live-Probe + Tests grün.
> Befund 7 durch die Auth-Middleware aus #1 automatisch funktionsfähig.
>
> **Update 2026-08-08 (Runde 2):** Befunde 5, 6, 8 umgesetzt.
> - **#5** `recoverStaleRuns()` beim Backend-Start (verwaiste `pending`/`processing`-Läufe → `failed`),
>   eingehängt neben `recoverTasks`. Die per-Request-Timeouts (W9) begrenzen bereits einzelne LLM-Calls,
>   sodass ein Lauf ohne Crash nicht hängt — der Watchdog deckt den Crash-/Deploy-Fall ab.
> - **#6** Verifikation ergab: nicht nur Anzeige, sondern ein **Triage-Loch** — `resolveSegmentValue`
>   fing per Regex nur eine Klammer und lieferte für verschachtelte Listen-Pfade `undefined`, sodass
>   unsichere Positionszeilen in Segment-Profilen nie ein Review auslösten. Ersetzt durch einen
>   Pfad-Walker (Segment-Instanz 1-basiert, Listenzeile 0-basiert), 4 neue Tests. **Offen bleibt** die
>   Frontend-Darstellung der Positionszeilen mit eigenen Boxen in `SegmentReviewPane` (W10.2-Grenze).
> - **#8** `crypto.randomUUID()` für alle Temp-Pfade.
>
> **Update 2026-08-08 (Runde 3):** #6-Frontend nachgezogen — `SegmentReviewPane` rendert Listenfelder
> jetzt als Positions-Tabelle statt Wert-Blob. `ListItemsEditor` (read-only) um Zellen-Konfidenz +
> Box-Sprung erweitert (additiv, `keyPrefix` löst `key.fid[row].sub` auf); die Zeilen-Boxen lagen
> bereits im `boxes`-Objekt. Damit ist Befund #6 vollständig geschlossen.
> - **Nebenbefund** (railway-Variante): `getBatchRunFileDetail` gab `segments` nicht zurück (Typlücke,
>   Segment-Detail-Endpunkt dort ohne Segmente) — mitbehoben.

Gut umgesetzt (bewusst hervorgehoben): guided_json + `temperature:0`, OCR-Fusion als
deterministischer Zahlenprüfer, zentraler `documentConverter` **mit** SSRF-Allowlist,
strenge ID-/Segment-Validierung (`validators.ts`). Details unter „Positives".

---

## 1 — [P0, live bestätigt] Komplette Authentifizierungs-Lücke

**Datei:** `backend/src/routes/extraction-projects.ts`, `…/extraction-inbox.ts`,
`backend/src/index.ts:359–361`

Die Extraction-Router werden gemountet, ohne dass je eine `authMiddleware` greift:

```ts
// index.ts — global auf /api/* liegen NUR:
app.use('/api/*', apiRateLimit);          // :306
app.use('/api/*', csrfProtection({...}));  // :309
...
app.route('/api/extraction', extractionProjectRoutes);  // :359  — keine Auth
app.route('/api/extraction', extractionJobRoutes);      // :360
app.route('/api/extraction', extractionInboxRoutes);    // :361
```

`extraction-projects.ts` und `extraction-inbox.ts` enthalten **keinen einzigen**
`authMiddleware`- oder `getCurrentUserId`-Aufruf. Das etablierte Muster im Repo ist die
**Per-Router-Middleware** — z. B. `routes/agents.ts:25`:

```ts
agentRoutes.use('/*', authMiddleware);
```

Diese Zeile fehlt bei den Extraction-Routern. `getCurrentUserId(c)` liest nur
`c.get('userId')` (`auth/middleware.ts:113`), und dieses Feld wird ausschließlich von
`authMiddleware`/`optionalAuthMiddleware` gesetzt — die hier nirgends laufen.

**Live-Probe (laufendes Backend, ohne Session-Cookie):**

```
GET /api/extraction/projects  → 200   ← offen
GET /api/extraction/inbox     → 200   ← offen
GET /api/agents               → 401   ← korrekt geschützt
GET /api/users                → 401   ← korrekt geschützt
```

**Exponiert (unauthentifiziert, 15 schreibende Routen):** alle Profile lesen/anlegen/
ändern/löschen, **extrahierte Dokumentdaten inkl. Kunden-PII abrufen** (Rezepte,
Bewerbungs-/Ausweis-Auslesungen, Steuer-IDs — genau die Daten aus `docs/SplitDocuments`),
Batch-Upload starten, Trainings-/Beispiel-Daten, **Webhook-Ziel + Secret setzen** (→
Befund 2), Export/Import.

**Auswirkung:** vollständiger, nicht-authentifizierter Lese-/Schreibzugriff auf
personenbezogene Kundendaten. Das Backend ist internet-exponiert (Scalingo/Railway).
Höchste Priorität, Datenschutz-relevant (DSGVO). **Beide Worktrees betroffen.**

**Fix (minimal, konsistent mit dem Repo-Muster):**

```ts
// am Kopf von extraction-projects.ts und extraction-inbox.ts:
import { authMiddleware } from '../auth/middleware';
extractionProjectRoutes.use('/*', authMiddleware);
extractionInboxRoutes.use('/*', authMiddleware);
```

`extraction-jobs.ts` prüft `getCurrentUserId` bereits selbst (→ Befund 7) und wird durch
dieselbe Middleware endlich funktionsfähig. Danach Live-Probe wiederholen: alle drei
Präfixe müssen ohne Cookie 401 liefern.

---

## 2 — [P1] SSRF über das Webhook-Ziel

**Datei:** `backend/src/extraction/learning/webhook.ts:46`

```ts
export function isDeliverableUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch { return false; }
}
```

Es wird **nur das Protokoll** validiert — kein Block gegen interne Ziele. Ein Webhook auf
`http://169.254.169.254/latest/meta-data/…` (Cloud-Metadaten), `http://localhost:3001/…`
(eigene interne Routen) oder interne Service-Hosts wird akzeptiert. Nach jedem Batch-Lauf
`POST`t das Backend die Extraktionsdaten dorthin. `deliverWebhook` setzt `redirect:'manual'`
(gut), aber das ursprüngliche Ziel selbst ist ungefiltert.

Kette mit Befund 1: Ein unauthentifizierter Angreifer setzt `webhook.url` auf ein internes
Ziel (Secret wählt er selbst, HMAC schützt hier nichts) und löst einen Batch aus → das
Backend agiert als Proxy in die interne Infrastruktur.

**Kontrast:** `services/documentConverter.ts` macht es richtig — Allowlist
(`adacor.ai|localhost`) für ausgehende Konverter-Requests. Dieselbe Härtung fehlt beim
Webhook.

**Fix:** DNS-Auflösung des Hosts prüfen und private/link-local/loopback-Bereiche
(`127.0.0.0/8`, `10/8`, `172.16/12`, `192.168/16`, `169.254/16`, `::1`, `fc00::/7`) sowie
`localhost` blocken; optional Allowlist/Bestätigung analog Konverter.

---

## 3 — [P1] Batch-Upload ohne Limits, vollständig im RAM

**Datei:** `backend/src/routes/extraction-projects.ts:426–468`

`POST /projects/:id/batches` erzwingt **keine** Datei-Anzahl- oder Größen-Grenze. Zum
Vergleich: die Public-API begrenzt auf 20 Dateien / 10 MB / 25 MB gesamt — die UI-Route
auf nichts. Jede Datei wird komplett in den Speicher gelesen und geschrieben:

```ts
await Bun.write(tempPath, await file.arrayBuffer());  // :451 — ganze Datei in RAM
```

Danach `void runBatchExtraction(...)` fire-and-forget. In Kombination mit Befund 1
(unauthentifiziert) ist das ein einfacher DoS: ein Upload sehr vieler/großer Dateien füllt
RAM und `/tmp`. Fix: Anzahl-/Größen-Limits wie in der Public-API, Streaming statt
`arrayBuffer()`, frühe Ablehnung per `Content-Length`.

---

## 4 — [P2] Batch-`tmpDir` wird nie gelöscht

**Datei:** `backend/src/extraction/learning/batch-service.ts:153` /
Anlage in `routes/extraction-projects.ts:444`

Angelegt wird ein Sammelordner:

```ts
const tmpDir = `/tmp/extraction-batch/${Date.now()}_${Math.random()...}`;  // :444
```

Aufgeräumt werden nur die **einzelnen** Dateien:

```ts
files.map((f) => rm(f.tempPath, { force: true }).catch(() => {}))  // batch-service.ts:153
```

Der Eltern-Ordner bleibt als leeres Verzeichnis dauerhaft liegen → mit jedem Lauf ein
Verzeichnis mehr unter `/tmp/extraction-batch/`. Fix: im `finally` von
`runBatchExtraction` `rm(tmpDir, { recursive: true, force: true })`.

---

## 5 — [P2] Fire-and-forget-Batch ohne Watchdog

**Datei:** `backend/src/routes/extraction-projects.ts:463`

```ts
void runBatchExtraction(projectId, runId, inputFiles).catch((err) =>
  console.error('[batch-extract] runBatchExtraction error:', err),
);
```

Der Lauf-Status wird in der Verarbeitung gesetzt; stürzt der Prozess ab oder wird neu
gestartet (Deploy, OOM), bleibt der Run dauerhaft auf „läuft" — kein Timeout, kein
Recovery beim Start. Bewusste Design-Grenze der aktuellen Stufe, aber die Frontend-Polling-
Schleife läuft dann endlos. Empfehlung: Run-Timeout + „verwaiste laufende Läufe beim
Backend-Start auf `error` setzen".

---

## 6 — [P2, plausibel — am echten Lauf verifizieren] Listen-Positionen in *repeatable* Segmenten

**Datei:** `backend/src/extraction/segmentation/segment-extract.ts:157–165`

Beim Anheben der Konfidenzen/Boxen in den Segment-Namespace wird nur das
Skalar-Gruppen-Präfix `felder.` entfernt:

```ts
const prefix = `${PROJECT_FIELD_GROUP}.`;                 // "felder."
for (const [path, conf] of Object.entries(result.fieldConfidences)) {
  const flat = path.startsWith(prefix) ? path.slice(prefix.length) : path;
  fieldConfidences[`${key}.${flat}`] = conf;              // key = "typ[2]"
}
```

Listen-Felder werden vom Pipeline-Adapter aber als **eigene** Gruppe geführt (nicht unter
`felder`, siehe `pipeline-adapter.ts:100–121`). Deren Item-Pfade sehen aus wie
`positionen[0].menge`. Ergebnis-Schlüssel wird dann `typ[2].positionen[0].menge` — ein
Pfad mit **zwei** Klammer-Ebenen. Die Review-Auflösung (`resolveSegmentValue`, `review.ts`)
zerlegt aber nur **eine** Instanz-Klammer. Für Positionszeilen innerhalb eines repeatable
Segmenttyps (genau der Sanitätshaus-Rezept-Fall: mehrere Rezepte × mehrere Positionen)
könnten Box-Sprung/Konfidenz-Anzeige im Review daher leer bleiben.

Kein Datenverlust — die Werte stehen in `data` — sondern ein Review-Anzeige-Defekt.
**Vor dem Fix an einem echten repeatable-Segment-Profil mit Listenfeld reproduzieren**;
falls bestätigt, `resolveSegmentValue`/Namespacing um die zweite Klammer-Ebene erweitern.

---

## 7 — [P3] `/jobs/run-sync` ist derzeit unbenutzbar

**Datei:** `backend/src/routes/extraction-jobs.ts:44`

```ts
const userId = getCurrentUserId(c);
if (!userId) return c.json({ error: 'Authentication required' }, 401);
```

Da (Befund 1) keine Middleware `userId` setzt, liefert dieser Debug-Endpoint **immer** 401
— auch für eingeloggte Nutzer. Fällt im Normalbetrieb nicht auf (die UI nutzt die
Projekt-Routen). Nach dem Middleware-Fix aus Befund 1 funktioniert er wieder wie gedacht.
Reiner Konsistenz-Hinweis.

---

## 8 — [P3] Temp-Namen via `Math.random()`

**Datei:** `backend/src/routes/extraction-projects.ts:244, 309, 444`

`Date.now()_Math.random().toString(36)` als Verzeichnis-/Datei-Diskriminator. Kein
Sicherheitsproblem (Dateinamen werden mit `safeName` saniert, Zeile 449), aber unter Last
nicht kollisionssicher. `crypto.randomUUID()` wäre sauberer und ist ohne neue Dependency
verfügbar.

---

## Positives (bewusst so gelassen)

- **Deterministik & Schema-Zwang:** `temperature:0` + gesetztes `max_tokens`
  (`EXTRACTION_SAMPLING`) und guided_json (`extract-call.ts`) — am Adacor-Endpunkt
  gemessen wirksam. Beseitigt die W7-Befunde „fiktive Konfidenz" / „Freitext-JSON".
- **OCR-Fusion** (`fusion.ts`) als kostenloser, deterministischer Zahlenprüfer inkl.
  DE-Zahlformat und Duplikat-Anker — der eigentliche Qualitätshebel, sauber isoliert.
- **Konverter-Konsolidierung** (`documentConverter.ts`) **mit** SSRF-Allowlist an allen
  Call-Sites — vorbildlich; genau diese Härtung fehlt nur noch beim Webhook (Befund 2).
- **Eingabe-Validierung** (`validators.ts`): ID-Regex `^[a-z0-9][a-z0-9-]*$`, Segment-/
  Regel-/Feld-Prüfung auf Create **und** Update (Rules werden auf PUT gegen den künftigen
  Feldstand geprüft, `extraction-projects.ts:134–145`) — konsistent.
- **Profil-Transfer** (`transfer.ts`): PII-frei per Default, Webhook nie im Bundle,
  Beispiele nur per Opt-in — datenschutzbewusst.

---

## Empfohlene Reihenfolge

1. **Sofort:** Befund 1 (Auth-Middleware, beide Worktrees) — Einzeiler je Router, danach
   Live-Probe (alle drei Präfixe → 401 ohne Cookie).
2. **Kurzfristig:** Befund 2 (Webhook-SSRF-Blocklist) + Befund 3 (Upload-Limits) — beide
   verlieren nach 1 an Angriffsfläche, bleiben aber gültig (SSRF auch für eingeloggte
   Nutzer, Limits gegen versehentliche Massen-Uploads).
3. **Aufräumen:** 4, 5, 8.
4. **Verifizieren, dann ggf. fixen:** Befund 6 an einem echten repeatable-Segment-Profil.
