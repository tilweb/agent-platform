# Kritisches Code Audit Report

**Datum:** 2026-02-18
**Scope:** Gesamte Codebase (Backend + Frontend)
**Geprüfte Dateien:** ~130 (95 Backend-TS, 35+ Frontend-JSX/JS)

## Zusammenfassung

| Kategorie | Kritisch | Hoch | Mittel | Niedrig |
|-----------|----------|------|--------|---------|
| Unauthentifizierte Endpunkte | 7 | 1 | 2 | 0 |
| Fehlende Input-Validierung | 2 | 4 | 3 | 1 |
| Race Conditions | 1 | 3 | 4 | 1 |
| Middleware-Abdeckung | 0 | 2 | 2 | 0 |
| Doppelter Code | 0 | 1 | 5 | 2 |
| Zirkuläre Abhängigkeiten | 0 | 0 | 1 | 4 |
| Fehlerbehandlung (Architektur) | 1 | 1 | 0 | 0 |
| Fehlerbehandlung (Inkonsistenzen) | 1 | 1 | 2 | 1 |
| Type-Safety Lücken | 1 | 4 | 5 | 2 |
| Verwaister Code | 0 | 1 | 3 | 3 |
| **Gesamt** | **13** | **18** | **27** | **14** |

---

## Bereich 1: Unauthentifizierte Endpunkte

### KRITISCH-1.1: `routes/tables.ts` — ALLE Endpunkte ohne Auth

**Datei:** `backend/src/routes/tables.ts`
**Zeilen:** 32-693 (32+ Endpunkte)

Kein `authMiddleware` Import oder `.use()` Aufruf. Alle CRUD-Operationen auf Tabellen (erstellen, lesen, ändern, löschen, Import/Export) sind vollständig offen.

**Empfehlung:** `tablesRoutes.use('/*', authMiddleware)` hinzufügen.

---

### KRITISCH-1.2: `routes/images.ts` — Bildgenerierung ohne Auth

**Datei:** `backend/src/routes/images.ts`
**Zeilen:** 23 (POST generate), 149 (DELETE), 94 (GET), 116 (GET metadata), 131 (GET list)

Jeder kann Bilder generieren (verursacht API-Kosten), auflisten und löschen.

**Empfehlung:** `imageRoutes.use('/*', authMiddleware)` hinzufügen.

---

### KRITISCH-1.3: `routes/chat.ts` — Skills/Tools/Custom-Tools komplett offen

**Datei:** `backend/src/routes/chat.ts`

| Sub-Router | Zeilen | Offene Endpunkte |
|------------|--------|------------------|
| `skillRoutes` | 1178-1343 | GET/POST/PUT/DELETE Skills (6 Endpoints) |
| `toolRoutes` | 1348-1513 | GET Tools, **PUT /:name/config** (Tool-Konfiguration ändern!) |
| `customToolRoutes` | 1518-1688 | CRUD + Test + Toggle (7 Endpoints, inkl. outbound HTTP-Requests) |

**Besonders kritisch:** `PUT /api/tools/:name/config` (Zeile 1482) erlaubt unauthentifiziert das Ändern von Tool-Konfigurationen inkl. API-Keys.

**Empfehlung:** Jedem Sub-Router `authMiddleware` per `.use()` voranstellen.

---

### KRITISCH-1.4: `routes/commands.ts` — Kommandoausführung ohne Auth

**Datei:** `backend/src/routes/commands.ts`
**Zeile:** 70 (`POST /execute`)

Beliebige Slash-Commands können ohne Authentifizierung ausgeführt werden.

**Empfehlung:** `commandRoutes.use('/*', authMiddleware)` hinzufügen.

---

### KRITISCH-1.5: `routes/apps.ts` — App-Verwaltung + Sub-App-Routes offen

**Datei:** `backend/src/routes/apps.ts`
**Zeilen:** 80 (`PUT /enable`), 100 (`PUT /disable`), 119-122 (Sub-Routes)

Alle Vertragsmanagement- und Projektmanagement-Routen der Sub-Apps sind ebenfalls ungeschützt.

**Empfehlung:** `appsRoutes.use('/*', authMiddleware)` hinzufügen.

---

### KRITISCH-1.6: `routes/transcription.ts` — Kostenpflichtiges STT ohne Auth

**Datei:** `backend/src/routes/transcription.ts`
**Zeile:** 82 (`POST /`)

Die Whisper-API wird ohne Authentifizierung aufgerufen. Nur `uploadRateLimit` schützt.

**Empfehlung:** `authMiddleware` hinzufügen.

---

### KRITISCH-1.7: `routes/chat.ts` — Chat-Suche und Zusammenfassungen ohne Auth

**Datei:** `backend/src/routes/chat.ts`
**Zeilen:** 523 (`GET /search` — durchsucht ALLE Chats), 614 (`POST /regenerate-all-summaries`)

**Empfehlung:** Beide Endpunkte mit `authMiddleware` schützen und nach `userId` filtern.

---

### HOCH-1.8: SSE-Stream ohne Auth

**Datei:** `backend/src/routes/chat.ts:319`

`GET /api/chat/:id/stream` hat kein `authMiddleware`. Verlässt sich darauf, dass Session-IDs unratbar sind. Das ID-Format (`session_${Date.now()}_${random7chars}`) ist teilweise vorhersagbar.

---

### MITTEL-1.9: Search-Routes mit `optionalAuthMiddleware`

**Datei:** `backend/src/routes/search.ts:16`

Alle Such-Endpunkte (inkl. Smart Search mit LLM-Calls) sind ohne Auth nutzbar, `userId` fällt auf `'default'` zurück.

---

### MITTEL-1.10: Attachments ohne Auth (Security-by-Obscurity)

**Datei:** `backend/src/routes/attachments.ts:22,61`

Attachment-Download verlässt sich auf "unratbare" IDs statt Auth. Leaking einer URL (Logs, Referrer) exponiert die Datei.

---

## Bereich 2: Fehlende Input-Validierung

### KRITISCH-2.1: Path Traversal in `routes/images.ts`

**Datei:** `backend/src/routes/images.ts`
**Zeilen:** 95, 117, 149

Image-ID aus URL-Parameter wird ohne Sanitisierung in `resolve(IMAGES_DIR, '${id}.${ext}')` verwendet. `resolve()` löst `..`-Komponenten auf.

```typescript
// Zeile 95 — Angreifer kann ../../etc/passwd senden
const path = resolve(IMAGES_DIR, `${id}.${ext}`);
```

**Empfehlung:** ID-Format per Regex validieren: `/^[a-zA-Z0-9_-]+$/`

---

### KRITISCH-2.2: Path Traversal in `routes/knowledge.ts`

**Datei:** `backend/src/routes/knowledge.ts`
**Zeilen:** 108, 235, 282 (mit `rm({recursive: true})`!), 313, 348, 421

`collectionId` aus URL-Parametern wird direkt in `join(KB_BASE, 'collections', collectionId, ...)` verwendet. Nur der POST-Create-Endpunkt (Zeile 142) validiert per Regex, GET/PUT/DELETE nicht.

**Zeile 282 ist besonders kritisch:** `rm({recursive: true})` mit unkontrolliertem Pfad könnte beliebige Verzeichnisse löschen.

**Empfehlung:** Collection-ID Regex-Validierung (`/^[a-z0-9_-]+$/`) für ALLE Endpunkte einführen.

---

### HOCH-2.3: `c.req.json()` ohne Validierung in `tables.ts`

**Datei:** `backend/src/routes/tables.ts`
**Zeilen:** 193, 218, 302, 322, 354, 584

Alle Type-Assertions (`as ColumnDefinition`, `as QueryOptions` etc.) sind reine Compile-Time-Checks, keine Runtime-Validierung. Beliebige JSON-Payloads werden akzeptiert.

---

### HOCH-2.4: `numberOfImages` unbegrenzt in Image-Generierung

**Datei:** `backend/src/routes/images.ts:28`

Parameter `numberOfImages` wird nicht validiert. Ein Angreifer könnte `numberOfImages: 1000` senden und API-Kosten verursachen.

---

### HOCH-2.5: Queue-Settings von jedem Auth-User änderbar

**Datei:** `backend/src/routes/tasks.ts:206`

`PUT /queue/settings` hat `authMiddleware` aber kein Admin-Check. Jeder angemeldete User kann Queue-Konfiguration ändern.

---

### HOCH-2.6: `formData.get('message') as string` ohne Null-Check

**Datei:** `backend/src/routes/chat.ts:89`

`formData.get()` kann `null` oder `File` zurückgeben. Cast zu `string` kann Runtime-Crash verursachen.

---

### MITTEL-2.7: `parseInt` ohne NaN-Check an 5+ Stellen

**Dateien:** `routes/tables.ts:282`, `routes/tasks.ts:120-153`, `routes/images.ts:133`, `routes/notifications.ts:29`

---

## Bereich 3: Race Conditions bei File-Persistenz

### KRITISCH-3.1: Kein Locking-Mechanismus in der gesamten Codebase

Eine Suche nach `lock`, `mutex`, `semaphore` ergibt null Treffer. **Jede** Read-Modify-Write Operation ist ungeschützt.

---

### HOCH-3.2: Task-Queue Race Condition

**Datei:** `backend/src/services/taskService.ts`
**Zeilen:** 527-604 (`enqueueTask`, `dequeueNextTask`, `updateTaskStatus`)

Die `queue.yaml` wird von mehreren Operationen gleichzeitig gelesen-modifiziert-geschrieben. Der Executor pollt alle 2 Sekunden (`taskExecutor.ts:56`). Bei gleichzeitigen Task-Abschlüssen kann die Queue korrupt werden: Tasks bleiben "active" stecken oder enqueue-Operationen gehen verloren.

**Empfehlung:** File-Level Locking mit `proper-lockfile` oder In-Memory-Queue mit Write-Ahead-Log.

---

### HOCH-3.3: Chat-History Race Condition

**Datei:** `backend/src/services/memory.ts`
**Zeilen:** 814-974 (`saveChatHistory`), 1040-1101 (`addChatMaterial`), 1599-1649 (`createShareLink`)

Gleichzeitiges Speichern einer neuen Nachricht, eines Task-Ergebnisses und einer Material-Ergänzung auf demselben Chat führt zu Datenverlust — der letzte Write gewinnt.

---

### HOCH-3.4: Chat-Folders als globale Shared Resource

**Datei:** `backend/src/services/memory.ts`
**Zeilen:** 1893-1960 (`saveChatFolders`, `createChatFolder`, `deleteChatFolder`)

Eine einzige `chat-folders.yaml` für alle User. Gleichzeitige Folder-Erstellung führt zu Verlust.

---

### MITTEL-3.5 bis 3.8: Weitere RMW-Races

| Datei | Operation | Impact |
|-------|-----------|--------|
| `services/providers.ts:79-116` | Provider-Config (Cache + File) | Config-Änderungen verloren |
| `auth/storage.ts:151-165` | User-Update | Profil-Änderungen verloren |
| `connections/storage.ts:105-149` | Token-Refresh vs Status-Update | Auth bricht |
| `apps/registry.ts:80` | App enable/disable | Aktion verloren |

---

## Bereich 4: Fehlerbehandlung

### KRITISCH-4.1: Kein globaler Error-Handler

**Datei:** `backend/src/index.ts`

Es gibt keinen `app.onError()` Handler. Ungefangene Fehler liefern Honos Default-Response (mit Stack-Traces in Dev).

**Empfehlung:**
```typescript
app.onError((err, c) => {
  console.error('[Unhandled]', err);
  return c.json({ error: 'Interner Serverfehler' }, 500);
});
```

---

### KRITISCH-4.2: `error.message` an Client in 85+ catch-Blöcken

**Dateien:** `routes/tasks.ts` (15x), `routes/tables.ts` (40+x), `routes/chat.ts` (30+x), `routes/agents.ts` (3x), `routes/images.ts` (1x)

Interne Fehlermeldungen (Dateipfade, Stack-Traces) werden direkt an den Client gesendet.

**Empfehlung:** Alle `c.json({ error: error.message })` durch `internalError(c, error)` aus dem existierenden `utils/errorHandler.ts` ersetzen.

---

### HOCH-4.3: Zentraler Error-Handler existiert, wird aber kaum genutzt

**Datei:** `backend/src/utils/errorHandler.ts`

Enthält `errorResponse()`, `internalError()`, `validationError()`, `notFoundError()`, `serviceError()`, `withErrorHandling()`. **Nur 2 von 20 Route-Dateien** (`transcription.ts`, `attachments.ts`) nutzen ihn.

---

### HOCH-4.4: Drei verschiedene Error-Response-Formate

| Format | Routes |
|--------|--------|
| `{ error: string }` | auth, chat, agents, knowledge, memory, tasks, tables, ... |
| `{ error, code, requestId }` | transcription, attachments |
| `{ success: false, error: string }` | images (generate), chat (custom tool test) |

---

### MITTEL-4.5: 205 Instanzen von `catch (error: any)`

Über alle Route-Dateien hinweg. TypeScript-Typsicherheit wird komplett umgangen.

**Empfehlung:** `catch (error: unknown)` verwenden + `error instanceof Error` Pattern.

---

### NIEDRIG-4.6: Gemischte Fehler-Sprache (EN/DE)

`routes/agents.ts` nutzt Deutsch ("Agent nicht gefunden"), `routes/tables.ts` Englisch ("Table not found").

---

## Bereich 5: Type-Safety Lücken

### KRITISCH-5.1: `formData.get('message') as string` ohne Check

**Datei:** `backend/src/routes/chat.ts:89`

Kann `null` oder `File` sein. Runtime-Crash möglich.

---

### HOCH-5.2: 55+ `getCurrentUserId(c)!` Non-null Assertions

**Dateien:** `routes/agents.ts` (6x), `routes/knowledge.ts` (8x), `routes/tasks.ts` (12x), `routes/notifications.ts` (7x), `routes/memory.ts` (8x), `routes/connections.ts` (4x), weitere...

Wenn Middleware fehlkonfiguriert wird, kein 401 sondern stiller Crash.

**Empfehlung:** `requireUserId(c)` Helper erstellen, der 401 zurückgibt statt zu crashen.

---

### HOCH-5.3: `JSON.parse() as TokenSet` in Crypto-Code

**Datei:** `backend/src/connections/crypto.ts:126`

Entschlüsselte Daten werden ohne Validierung als `TokenSet` gecastet. Sicherheitskritisch.

---

### HOCH-5.4: 13 `as any` Verwendungen

Wichtigste Stellen:
- `agents/loop.ts:313` — `(p as any).text` in ContentPart-Verarbeitung
- `routes/chat.ts:476-478` — `(event as any).fileId` für fehlendes Event-Type
- `routes/chat.ts:1504` — `(tool as any).updateConfig`

---

### HOCH-5.5: Admin-Middleware mit `(c: any, next: any)`

**Dateien:** `routes/providers.ts:36`, `routes/admin.ts:26`

Umgeht Honos Typsystem komplett. **Empfehlung:** `MiddlewareHandler` Type verwenden.

---

### MITTEL-5.6 bis 5.10: Weitere Type-Safety Issues

- 15+ `as SomeType` Assertions auf `c.req.json()` ohne Runtime-Validierung (tables, chat, providers, tasks)
- `c.req.query('status') as TaskStatus` — unkontrollierte String-Casts
- `JSON.parse(content) as SavedImageMetadata` ohne Validierung
- Audit-Log und Usage-Tracking parsen JSONL ohne Validierung

---

## Bereich 6: Zirkuläre Abhängigkeiten

### MITTEL-6.1: `taskExecutor.ts` importiert statisch aus `routes/tasks.ts`

**Datei:** `backend/src/services/taskExecutor.ts:17-22`

Ein Service importiert statisch aus einer Route-Datei — architekturelle Layer-Verletzung. Der umgekehrte Import (Route -> Service) nutzt bereits `await import()`.

**Empfehlung:** `broadcastTaskUpdate`, `notifyTaskStarted/Progress/Completed/Failed` nach `services/taskNotifications.ts` extrahieren.

---

### NIEDRIG-6.2 bis 6.5: Präventive Lazy Imports (korrekt)

5 Stellen nutzen `await import()` um potenzielle Zyklen zu vermeiden — `agents.ts`, `searchService.ts`, `documentImporter.ts`, `documentFetcher.ts`. Alle korrekt implementiert.

---

## Bereich 7: Middleware-Abdeckung

### HOCH-7.1: Kein Request-Body-Size-Limit

**Datei:** `backend/src/index.ts`

Kein `bodyLimit` Middleware. Angreifer können beliebig große JSON-Payloads senden -> OOM/Disk-Exhaustion.

**Empfehlung:** `app.use('*', bodyLimit({ maxSize: 10 * 1024 * 1024 }))` (10MB)

---

### HOCH-7.2: Kein spezifisches Rate-Limiting auf teuren Endpunkten

| Endpunkt | Kosten | Aktuelles Limit |
|----------|--------|-----------------|
| `POST /api/images/generate` | LLM API-Credits | Nur global 100/min (+ kein Auth!) |
| `POST /api/knowledge/.../stream` | Compute-intensiv | Nur global |
| `POST /api/commands/execute` | Beliebig | Nur global |

---

### MITTEL-7.3: CSRF-Bypass bei fehlendem Origin-Header

**Datei:** `backend/src/middleware/csrf.ts:171-184`

Ohne `Origin`/`Referer`-Header wird nur `Content-Type` geprüft. `multipart/form-data` (sendbar per HTML-Form) passiert.

---

### POSITIV: Middleware-Reihenfolge korrekt

Logger -> CORS -> Security Headers -> Rate Limit -> CSRF -> Routes. Korrekt implementiert.

### POSITIV: Security Headers global angewendet

CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy — alle korrekt.

---

## Bereich 8: Doppelter / Redundanter Code

### HOCH-8.1: YAML-Storage-Pattern 8+ mal dupliziert (~200 Zeilen)

**Betroffene Dateien:** `auth/storage.ts`, `auth/session.ts`, `connections/storage.ts`, `services/taskService.ts`, `services/userMemory.ts`, `projects/storage.ts`, `tables/storage.ts`, `services/notificationService.ts`, `tools/custom/storage.ts`

Jede Datei reimplementiert: `ensureDir()`, `getFilePath()`, `load()`, `save()`, `list()`, `delete()`.

**Empfehlung:** `backend/src/utils/yamlStorage.ts` erstellen:
```typescript
export function createYamlStore<T>(basePath: string) {
  return { ensureDir, load, save, list, remove, exists };
}
```

---

### MITTEL-8.2: ID-Generierung 18+ mal dupliziert (~50 Zeilen)

Das Pattern `${prefix}_${Date.now().toString(36)}_${Math.random()...substring(2,8)}` existiert in 18+ Dateien mit leicht unterschiedlichen Substring-Längen.

**Empfehlung:** `utils/id.ts` mit `generateId(prefix)` erstellen.

---

### MITTEL-8.3: Task-Ownership-Check 10x kopiert

**Datei:** `backend/src/routes/tasks.ts`
**Zeilen:** 320, 344, 377, 406, 438, 464, 498, 528, 558, 646

Identischer 6-Zeilen-Block in 10 Endpunkten.

**Empfehlung:** `requireTaskOwnership(c)` Middleware extrahieren.

---

### MITTEL-8.4: `formatDate` 7+ mal im Frontend dupliziert

**Dateien:** `KnowledgeBasePage.jsx:104`, `SharedChatPage.jsx:313`, `SettingsPage.jsx:374`, `ProjectOverview.jsx:118`, `ProjectCard.jsx:98`, `ProjectChatsSection.jsx:147`, `NotificationSlideOver.jsx:196`

**Empfehlung:** `frontend/src/utils/dateFormat.js` erstellen.

---

### MITTEL-8.5: Inkonsistente FS-APIs (Bun.file vs node:fs)

Manche Module nutzen `Bun.file`/`Bun.write`, andere `fs/promises`, 7 Stellen dynamisch `await import('fs')` für `unlinkSync`.

---

### NIEDRIG-8.6: `useConnections` nutzt `fetch` statt `apiFetch`

**Datei:** `frontend/src/hooks/useConnections.js:15,39,96,115`

---

## Bereich 9: Verwaister / Toter Code

### HOCH-9.1: 16 exportierte Funktionen ohne Consumer

| Datei | Funktion |
|-------|----------|
| `rbac/storage.ts` | `getUsersWithAccess`, `getGroupsWithAccess`, `getResourceOwner`, `transferOwnership`, `getResourceAccessEntry`, `updateAccessRole` (6 von 14 Exports ungenutzt!) |
| `connections/storage.ts` | `hasConnection`, `cleanupExpiredOAuthStates` |
| `auth/storage.ts` | `findUserByUsername`, `findUserByEmail` |
| `services/taskService.ts` | `getScheduledTasks`, `checkScheduledTasks`, `scheduleRetry` |
| `services/skills.ts` | `clearSkillsCache` |

---

### MITTEL-9.2: 3 verwaiste Dateien

| Datei | Status |
|-------|--------|
| `backend/src/rbac/migration.ts` | Nie importiert |
| `backend/src/rbac/run-migration.ts` | Nie importiert |
| `backend/src/skills/workflow.ts` | Nie importiert — komplett verwaist |

---

### MITTEL-9.3: 113-Zeilen Custom YAML-Parser statt `yaml` Package

**Datei:** `backend/src/services/agents.ts:88-201`

Handgeschriebener Frontmatter-Parser mit Debug-Logs. Das `yaml` Package ist bereits eine Dependency.

**Empfehlung:** 3-Zeilen-Implementierung mit `yaml.parse()`.

---

### MITTEL-9.4: Debug-Logs in Production

**Datei:** `backend/src/services/agents.ts:117,198,288,420-422`

5 `console.log`-Statements die bei jedem Agent-Load feuern.

---

### NIEDRIG-9.5: `getAgentFull()` triviale Wrapper-Funktion

**Datei:** `backend/src/services/agents.ts:717` — nur `return loadAgent(agentId)`.

---

### NIEDRIG-9.6: 1 TODO für unimplementiertes Feature

**Datei:** `backend/src/skills/workflow.ts:311` — `// TODO: Implement repeat counting`

---

## Priorisierte Handlungsempfehlungen

| # | Maßnahme | Impact | Aufwand | Betroffene Dateien |
|---|----------|--------|---------|-------------------|
| 1 | **`authMiddleware` zu 7 Route-Dateien hinzufügen** (tables, images, commands, apps, transcription, skills/tools/custom-tools in chat.ts) | KRITISCH — schließt ~50 offene Endpunkte | Klein (je 1 Zeile) | 5 Route-Dateien |
| 2 | **Path-Traversal-Schutz in images.ts und knowledge.ts** — ID-Regex-Validierung | KRITISCH — verhindert Lesen/Löschen beliebiger Dateien | Klein | 2 Dateien |
| 3 | **`app.onError()` Handler + `error.message` Leaking fixen** — Central Error Handler in allen Routes nutzen | KRITISCH+HOCH — verhindert Info-Disclosure, 85+ Stellen | Mittel | 18 Route-Dateien |
| 4 | **Body-Size-Limit Middleware** | HOCH — verhindert OOM/DoS | Klein (1 Zeile) | `index.ts` |
| 5 | **`requireUserId(c)` Helper** statt 55+ `getCurrentUserId(c)!` | HOCH — verhindert stille Crashes | Klein | 10+ Route-Dateien |
| 6 | **File-Locking für Task-Queue** (`queue.yaml`) | HOCH — verhindert Task-Korruption | Mittel | `taskService.ts` |
| 7 | **Rate-Limiting für Image-Generierung und Commands** | HOCH — verhindert API-Kosten-Missbrauch | Klein | 2 Route-Dateien |
| 8 | **`createYamlStore<T>()` Utility** — eliminiert ~200 Zeilen Duplikate | HOCH (DRY) | Mittel | 8+ Storage-Dateien |
| 9 | **Runtime-Validierung für `c.req.json()`** (Zod oder manuell) bei Tables und Chat | HOCH — verhindert Type-Confusion | Mittel | 3 Route-Dateien |
| 10 | **16 tote Exports + 3 verwaiste Dateien aufräumen** | MITTEL — reduziert Codebase-Komplexität | Klein | 6 Dateien |

---

## Metriken

- **Geschätzter redundanter Code:** ~460 Zeilen (200 YAML-Storage + 50 ID-Gen + 50 Task-Ownership + 60 formatDate + 100 Hook-Boilerplate)
- **Potenziell unsichere Endpunkte:** ~50 (ohne Auth)
- **Endpunkte ohne Input-Validierung:** ~25 (direkte `as Type` Casts auf User-Input)
- **Race-Condition-Kandidaten:** 9 Stellen (Task-Queue, Chat-History, Folders, Provider-Config, User-Updates, Connections, Knowledge, App-Registry, Sessions)
- **Zirkuläre Import-Ketten:** 1 (MITTEL: taskExecutor -> routes/tasks) + 5 präventive Lazy-Imports
- **Type-Safety Umgehungen:** 13 `as any` + 55+ `!` Assertions + 15 unvalidierte Type-Casts + 205 `catch (error: any)` = ~288 Stellen
- **Dead Code Kandidaten:** 16 ungenutzte Exports + 3 verwaiste Dateien + 5 Debug-Logs + 1 Wrapper-Funktion + 113-Zeilen Custom-Parser = ~24 Stellen
