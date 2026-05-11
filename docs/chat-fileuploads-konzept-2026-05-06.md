# Konzept: Chat-Fileuploads (Dokumente, Bilder, Audio)

**Stand**: 2026-05-06 · **Branch**: main (Scalingo-Deploy) · **Zielgruppe**: Developer-Onboarding

Dieses Dokument beschreibt End-to-End, wie File-Uploads im Chat funktionieren — vom Klick im Browser über Backend-Verarbeitung bis zum Zugriff durch Agents. Ziel: ein neuer Developer kann nach dem Lesen einen Bug fixen oder eine neue Datei-Art hinzufügen, ohne sich erst durch 700 Zeilen Service-Code zu lesen.

> **Branch-Hinweis**: Dieser Branch (`main`) speichert die **Chat-History** in Postgres (Drizzle ORM, Tabellen `chats`/`messages`/`chat_folders`). Die **Datei-Bytes** der Attachments liegen weiterhin auf Disk in `data/chat-uploads/`. Der Demo-Branch (`demo/messe`, Railway) hat die gleiche Disk-Struktur, aber YAML-Files für die Chat-History — siehe dort `docs/chat-fileuploads-konzept-2026-05-06.md` für die YAML-Variante.

---

## 1. Big Picture

```
┌────────────────────────┐
│ Browser                │
│ ChatWindow.jsx         │  ─── 1. <input type=file> | DnD | MediaRecorder ─────┐
│  ├─ useAudioRecorder   │                                                       │
│  └─ AudioPlayer        │                                                       │
└────────────────────────┘                                                       │
                                                                                 ▼
                                                              ┌──────────────────────────────┐
                                                              │ POST /api/chat (multipart)   │
                                                              │ routes/chat.ts               │
                                                              └──────────────────────────────┘
                                                                          │
                                                                          ▼ je File
                                                              ┌──────────────────────────────┐
                                                              │ services/attachments.ts      │
                                                              │  processUpload(sessionId, f) │
                                                              │   ├─ validateUpload (magic)  │
                                                              │   ├─ writeFile(original.ext) │
                                                              │   ├─ document → Markitdown   │
                                                              │   ├─ image    → base64       │
                                                              │   └─ audio    → ffmpeg+Whisper│
                                                              └──────────────────────────────┘
                                                                          │
                                                                          ▼
                                                              ┌───────────────────────────────────────┐
                                                              │ ../data/chat-uploads/{sid}/{aid}/     │
                                                              │   ├─ original.<ext>                   │
                                                              │   ├─ content.md   (nur document)      │
                                                              │   ├─ transcription.txt (nur audio)    │
                                                              │   └─ metadata.json   (Index)          │
                                                              └───────────────────────────────────────┘
                                ▲                                 ▲
                                │                                 │
   ┌────────────────────────────┴─────────────┐      ┌────────────┴───────────────┐
   │ routes/attachments.ts (Browser-Retrieval)│      │ tools/special/             │
   │  GET /api/chats/:cid/attachments/:aid    │      │  read-chat-attachment.ts   │
   │  GET .../attachments/:aid/stream (Range) │      │  ─ Agent Tool              │
   │  GET .../attachments/:aid/metadata (auth)│      │  liefert content/base64/   │
   └──────────────────────────────────────────┘      │  transcription je nach Typ │
                                                     └────────────────────────────┘
```

Vier Datenflüsse:
1. **Upload** — Browser → `/api/chat` Multipart → Service verarbeitet pro Typ
2. **Pre-Analysis (Documents+Images)** — Agent-Loop ruft pro Asset einen dedizierten Sub-Agent mit dem vollständigen Content im Context (siehe §4.5). Resultate landen in einer Section des Supervisor-System-Prompts, statt dass der Supervisor Tool-Roundtrips machen muss.
3. **Anzeige** — Browser → `/api/chats/:cid/attachments/:aid[/stream]` (Browser holt Datei zum Rendern)
4. **Agent-Zugriff (Fallback)** — Agent ruft `read_chat_attachment`-Tool → Service liest aus Disk. Heute nur noch Ausnahmefall, weil die Pre-Analysis aus (2) die meisten Fragen abdeckt.

Persistenz ist **vollständig File-System-basiert** (keine DB für Attachments). Manifest pro Attachment: `metadata.json`. Chat-History als YAML-Files (`data/chats/*.yaml`).

---

## 2. Frontend

### 2.1 Upload-Komponente
`frontend/src/components/ChatWindow.jsx`

| Was | Wo | Hinweise |
|---|---|---|
| Konstanten + Type-Guards | um Z. 2293 | `SUPPORTED_FORMATS_TEXT`, `isDocumentType`, `isImageType`, `isAudioType`, `isSupportedFileType`. Frontend-Liste muss synchron zur Backend-Liste in `attachments.ts` (Z. 51–90) bleiben |
| Klick-Upload | `handleFileInputChange()` | Validiert je File via `isSupportedFileType(file.type)`, sammelt in `pendingAttachments`-State |
| Drag-and-Drop | `handleDragOver/Leave/Drop` | Über das gesamte ChatWindow |
| Audio-Aufnahme | `handleRecordClick()` | Triggert den `useAudioRecorder`-Hook (Mic-Permission, MediaRecorder) |
| Anhang-Chips | `PendingAttachments`-Renderer | Vor Versand sichtbar, Audio-Chips mit STT-Sprach-Dropdown |
| Anhänge im Verlauf | `MessageAttachments`-Renderer | `<AudioPlayer/>` für Audio + Transkript-Block · `<img>` für Bilder mit Lightbox · Download-Link für Dokumente |

> **Frontend-Validierung ist nur UX**. Echte MIME-Validierung passiert serverseitig per Magic-Bytes (siehe 4.2). Wer Frontend-Limits umgeht, scheitert am Server.

### 2.2 Audio-Aufnahme
`frontend/src/hooks/useAudioRecorder.js`

- MIME-Fallback-Reihenfolge: **MP4/M4A → OGG → WebM** (WebM hat schlechtere Whisper-Kompatibilität — die Reihenfolge minimiert Konvertierungs-Aufwand auf dem Server).
- `MediaRecorder.start(1000)` produziert 1-Sekunden-Slices.
- Output: ein `File`-Objekt mit Namen `recording-${Date.now()}.{ext}`, der danach durch denselben Upload-Pfad wie ein angefügtes File läuft.

### 2.3 Audio-Player
`frontend/src/components/AudioPlayer.jsx` rendert `<audio src={streamUrl}>` mit `streamUrl = /api/chats/{chatId}/attachments/{aid}/stream`. Der Browser sendet beim Seek automatisch Range-Header — die Backend-Route bedient das (siehe 5.2).

---

## 3. Upload-Endpoint

`backend/src/routes/chat.ts` — POST `/api/chat`

Erwartet **Multipart-FormData** mit folgenden Feldern:

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `message` | nein | User-Text (kann auch leer sein, wenn nur File) |
| `files` | nein, mehrfach | Hochgeladene Dateien (`formData.getAll('files')`) |
| `sessionId` | ja | Chat-Session-ID — bestimmt Storage-Pfad |
| `skillId` | nein | Triggert direkten Skill-Aufruf statt Supervisor |
| `agentId` | nein | Vorgewählter Agent |
| `autoRoute` | nein | `'false'` deaktiviert Supervisor-Routing |
| `projectId` | nein | Verknüpfung mit Projekt (Projektmanagement-App) |
| `readers` | nein | JSON-Array externer Inhalts-Quellen (Wissensbasis-Refs etc.) |
| `modelOverride` | nein | JSON `{ providerId, modelId }` für Per-Chat-Modell-Wahl |

Pro File wird `attachmentsService.processUpload(sessionId, file)` aufgerufen. Fehler bei einer Datei brechen die Verarbeitung der anderen **nicht** ab — wird nur geloggt und als Fehler-Antwort zurückgegeben. Erfolgreich verarbeitete Attachments werden über `setPendingAttachments()` (`memory.ts`) zwischengespeichert und beim Erstellen der nächsten User-Message via `popPendingAttachments()` an die Message angehängt (siehe 6).

Der Endpoint akzeptiert auch reines JSON (ohne Files) — derselbe Pfad, kein FormData-Parsing.

### 3.1 Limits am Upload-Endpoint

Die POST-Route ist mit drei Schutzschichten gegen Memory-Spikes und Runaway-Clients verdrahtet:

| Schicht | Wert | Wo | Verhalten bei Verletzung |
|---|---|---|---|
| **Hono `bodyLimit`-Middleware** (vor Form-Parsing) | 220 MB Request-Body | `routes/chat.ts` Pre-Handler | 413 `Request zu groß. Maximum: 220 MB` |
| **Anzahl Files** | 10 pro Request | `MAX_FILES_PER_REQUEST` in `routes/chat.ts` | 400 `Zu viele Dateien. Maximum: 10 pro Nachricht.` |
| **Gesamtgröße der Files** | 200 MB Summe | `MAX_TOTAL_UPLOAD_SIZE` in `routes/chat.ts` | 400 `Gesamtgröße der Anhänge zu groß. Maximum: 200 MB.` |
| **Pro File** | 50 MB | `MAX_FILE_SIZE` in `services/attachments.ts` | Throw `Datei zu groß. Maximum: 50 MB` (in `processUpload`) |

`bodyLimit` (Hono-Middleware) blockt die Request bevor `formData()` den Body in den RAM lädt — der eigentliche Schutz vor RAM-Exhaustion. Die anwendungs-Layer-Checks geben dem Frontend dazu klare Fehlermeldungen pro Limit-Art.

---

## 4. Service: `services/attachments.ts`

### 4.1 Storage-Layout
```
../data/chat-uploads/                    # UPLOADS_BASE (Z. 16)
  {sessionId}/                           # validiert /^[a-zA-Z0-9_-]+$/
    {attachmentId}/                      # att-{UUIDv4}
      original.<ext>                     # Datei wie hochgeladen, sanitisierte Endung
      content.md                         # nur document — Markitdown-Output
      transcription.txt                  # nur audio — Whisper-Text
      metadata.json                      # ChatAttachment-JSON (Z. 22–39)
```

Konstanten: `UPLOADS_BASE = join(DATA_BASE, 'chat-uploads')` (Z. 15–16). `DATA_BASE = resolve(process.cwd(), '../data')` — also relativ zum Backend-Workdir, **nicht** absolut. Beim Container-Deploy entsprechend mounten.

### 4.2 Verarbeitungs-Pipeline
`processUpload(sessionId, file)` (Z. 366 ff.):

1. **Size-Check** (Z. 368) — hart 50 MB.
2. **ID-Generation** (Z. 159–166) — `att-${randomUUID()}` (UUIDv4 mit ~122 Bit Entropy). Alte IDs aus früheren Versionen (`att-{ts}-{rand6}`) bleiben lesbar — Storage behandelt IDs als Opaque-Strings.
3. **Filename-Sanitizing** (Z. 128 ff.) — `basename`, Null-Byte-Stripping, gefährliche Zeichen → `_`, Fallback `unnamed_file`.
4. **Magic-Byte-Validierung** (`utils/fileTypeValidator.ts`) — vergleicht echte Bytes gegen `file.type`-Behauptung. Mismatch wird **nur geloggt**, der erkannte MIME-Typ wird verwendet. Das schlägt fehl bei Datei-Typen, die der Validator nicht kennt — dann wirft `validateUpload` und der Upload bricht ab.
5. **Session-ID-Validation** gegen Path-Traversal: Regex `/^[a-zA-Z0-9_-]+$/`.
6. **Verzeichnis anlegen + Original schreiben** (Z. 408 ff.).
7. **Typ-spezifische Verarbeitung**:
   - `document` → Markitdown-API (Z. 187 ff.), `.md`/`.txt` werden direkt eingelesen
   - `image` → Base64-Data-URL (Z. 236), in `metadata.json` eingebettet
   - `audio` → ffmpeg-Konvertierung (falls nötig) + Whisper-API (Z. 269 ff.)
8. **Seitenanzahl schätzen** für Dokumente: `ceil(markdown.length / 3000)`.
9. **Metadata persistieren**.

Fehler in Schritt 7 sind **nicht-fatal** — bei Konvertierungs-Fehler wird der Original-Inhalt zurückgegeben (Doc) bzw. ein Platzhalter-Text als Transkription gespeichert (Audio). Das Attachment selbst landet immer auf Disk.

### 4.3 Markitdown (Dokument-Konversion)
**Externe API**, kein lokales Tool. Konfiguration:
```env
MARKITDOWN_API_URL=https://api.adacor.ai/v1/documentMarkdown/
ADACOR_AI_API_KEY=...
```

> **Hardening (security-review M13)**: Der Constructor (Z. 99–113) validiert `MARKITDOWN_API_URL` gegen eine **Allowlist** — nur Hostnames `*.adacor.ai`, `adacor.ai`, `localhost` oder `127.0.0.1`. Andere URLs werfen beim App-Start. Verhindert SSRF, falls jemand versehentlich eine interne URL setzt.

> **Timeout**: 120s via `AbortSignal.timeout(MARKITDOWN_TIMEOUT_MS)` (`attachments.ts:24`). Beim Timeout wirft der Service `Markitdown API Timeout nach 120s` — der Upload-Pfad fängt das ab und liefert den Original-Text als Fallback.

Default-URL ist Adacor-spezifisch (Z. 100). Ohne explizite `MARKITDOWN_API_URL` wird der Default genommen + Warnung geloggt. Der Endpoint nimmt **PUT mit FormData (`document` Feld)**, gibt Plain-Text-Markdown zurück.

### 4.4 Audio-Transkription
`transcribeAudio()` (Z. 269 ff.):

1. STT-Provider aus `loadProvidersConfig()` (`data/config/providers.yaml`) — `active.stt.provider_id` + `model_id`.
2. Wenn Browser-Format → **ffmpeg-Konvertierung zu MP3**:
   ```sh
   ffmpeg -y -i <input> -vn -ar 16000 -ac 1 -b:a 128k <output>.mp3
   ```
   Die Liste der Browser-Formate ist `FORMATS_NEEDING_CONVERSION` (Z. 93): `webm/ogg/mp4/m4a` (audio + video Varianten). Konvertierungs-Fehler → Fallback auf Original-Datei.
3. **Multipart-POST** an `${baseUrl}/transcriptions`:
   - `file` (Blob)
   - `model` — **Pflicht für Adacor**
   - `language=de` — hart auf Deutsch
4. Response: `{ text: "..." }` → wird als `transcription` zurückgegeben.

**Timeout**: 300s via `AbortSignal.timeout(WHISPER_TIMEOUT_MS)` (`attachments.ts:25`). Beim Timeout wird ein Platzhalter `[Fehler bei der Transkription: Whisper API Timeout nach 300s]` als Transkript gespeichert — die Audiodatei selbst bleibt erhalten.

Synchron im Upload-Pfad — der HTTP-Request blockiert, bis das Transkript da ist. Bei längeren Audios kann das mehrere Sekunden dauern; das Frontend zeigt einen Spinner.

### 4.5 Document-Pre-Analysis (Sub-Agent pro Doc)

Lebt im **Agent-Loop**, nicht im Service. Implementiert in `backend/src/agents/loop.ts`:

| Funktion | Z. | Zweck |
|---|---|---|
| `analyzeDocumentsAutomatically()` | ~518 | Orchestriert pro Doc einen Sub-Agent-Call, parallel mit Concurrency-Cap |
| `analyzeOneDocument()` | ~607 | Baut System-Prompt mit Volltext + User-Frage, ruft `llmService.streamChat`, parst Relevanz |

**Motivation**: Vor diesem Feature wurde der Doc-Markdown in `buildSupervisorPrompt` hart auf **15 000 Zeichen (~5 Seiten)** gekürzt. Bei 200-seitigen PDFs sah der Supervisor nur die ersten 5 Seiten und merkte's nicht. Stiller Datenverlust.

**Neuer Flow** (gerufen in `runAgentLoop` direkt nach `analyzeImagesAutomatically`):

```
für jedes Document-Attachment:
  if size < 15k chars        → inline direkt im Supervisor-Prompt
  elif size < 480k chars     → dedizierter Sub-Agent-Call mit Volltext (~120k Tokens Input)
  elif size >= 480k chars    → Sub-Agent-Call mit auf 480k gekürztem Doc + Warning
  if mehr als 5 große Docs   → restliche werden nur als Metadaten gelistet
```

**Constants in `loop.ts`** (gleich nach den Imports):
```ts
const DOC_INLINE_THRESHOLD = 15000;        // < diese Schwelle: inline ohne Sub-Agent
const DOC_MAX_CONTENT_LENGTH = 480000;     // > diese Schwelle: Doc wird gekürzt
const DOC_MAX_CONCURRENT = 3;              // parallele Sub-Agents
const DOC_MAX_PER_REQUEST = 5;             // Hard-Cap pro User-Message
```

**Sub-Agent-Prompt** (in `analyzeOneDocument`): System-Prompt enthält den Doc-Volltext + die User-Frage, fordert eine streng strukturierte Antwort:

```
## Relevanz: hoch | mittel | niedrig
## Zusammenfassung
## Schlüsselstellen   (bis zu 5 wörtliche Zitate)
## Antwort auf User-Frage
```

Wird mit **demselben Chat-Modell** ausgeführt (Adacor Qwen 30B 128k Context). Output-Cap ~2k Tokens. Usage wird als `source: 'document_analysis'` getrackt.

**Result-Aggregation**: alle Sub-Agent-Outputs landen in einer Section `## Hochgeladene Dokumente`, die in den Supervisor-System-Prompt als `documentAnalysisSection` injiziert wird — parallel zur `imageAnalysisSection`. Der Supervisor sieht damit für jedes Doc eine fundierte Analyse mit Zitaten **und** den Hinweis, **direkt aus dieser Analyse zu antworten** statt zu delegieren.

**SSE-Events ans Frontend**: pro Sub-Agent ein `document_analysis_start`-Event (mit `filename`, `pages`, `truncated`) und nach Abschluss ein `document_analysis_end` (mit `durationMs`, `relevance`). In `useStreaming.js` werden die in Thinking-Steps übersetzt; `ChatWindow.jsx` zeigt während der Analyse einen Status-Indikator pro Doc.

**Anti-Retry-Schutz** (gegen Endlos-Delegations-Loops): in `runAgentLoop` zählt eine `delegationFingerprints`-Map pro Supervisor-Session, wie oft (target_agent, task_anfang) bereits delegiert wurde. Ab der 3. Wiederholung mit identischen Argumenten gibt der Delegation-Callback eine harte Fehler-Antwort zurück, bevor überhaupt ein LLM-Call passiert. `DELEGATION_RETRY_LIMIT = 2`.

**Supervisor-Prompt** (`data/agents/supervisor/config.md`): ganz oben steht eine neue **ABSOLUTE PRIORITÄT — HOCHGELADENE DOKUMENTE**-Regel, die _über_ der "delegiere immer"-Regel rangiert. Bei vorhandener Pre-Analysis: direkt antworten, nicht delegieren — und zwar an **keinen** Agent (verhindert den Workaround „delegier halt an einen anderen").

---

## 5. Datenabruf für den Browser

`backend/src/routes/attachments.ts`, gemountet unter `/api/chats` (`backend/src/index.ts:202`).

### 5.1 Routes auf einen Blick

| Route | Auth | Use-Case |
|---|---|---|
| `GET /:chatId/attachments/:attachmentId` | **keine** | Klassischer Download/Anzeige (Bilder, PDFs in neuem Tab) |
| `GET /:chatId/attachments/:attachmentId/stream` | **keine** | Audio-Player (Range-Requests für Seek) |
| `GET /:chatId/attachments/:attachmentId/metadata` | `authMiddleware` | Metadaten ohne Datei-Inhalt (UI-Bedarf) |

Die ersten beiden Routes haben **keinen Auth-Check**, weil Browser bei `<img src>` und `<audio src>` keine Cookies senden würden. Sicherheits-Modell: **Unguessable IDs** + **Hardened Content-Disposition**.

**Attachment-IDs** sind UUIDv4 (`att-{uuid}`, ~122 Bit Entropy) — Enumeration durch Brute-Force ist praktisch ausgeschlossen.

> **Content-Disposition-Hardening** (`utils/contentDisposition.ts`): Der `inline`-Disposition-Wert ist nur für eine **kleine Allowlist** von Mimetypes erlaubt: `application/pdf`, `image/png`, `image/jpeg`, `image/jpg`, `image/webp`, `image/gif`. Alles andere — auch `text/html`, `image/svg+xml`, `application/javascript` — bekommt `Content-Disposition: attachment` und wird vom Browser als Download behandelt. Das verhindert Stored-XSS via hochgeladenes HTML/SVG. Filename wird zusätzlich RFC-5987-konform escaped (UTF-8-Variante + ASCII-Fallback).

> **Stolperstein**: Trotz "Range-Support" wird die Datei **vollständig in den Speicher gelesen** und nur ein `subarray` zurückgegeben. Bei großen Audios (mehrere MB) und vielen parallelen Playern → Memory-Spike. Echtes Streaming via `createReadStream` wäre die richtige Lösung — bleibt für später.

### 5.2 Range-Streaming (Audio-Seek)
Die `/stream`-Route parst `Range: bytes=<start>-<end>`-Header und antwortet mit HTTP 206 + `Content-Range`/`Accept-Ranges`. Der Browser nutzt das automatisch beim Seek im `<audio>`-Element.

---

## 6. Persistenz im Chat-Verlauf

`backend/src/services/memory.ts:182–199`

```ts
interface MessageAttachment {
  id: string;
  type: 'document' | 'image' | 'audio';
  filename: string;
  mimeType: string;
  url?: string;            // /api/chats/{chatId}/attachments/{attachmentId}
  transcription?: string;  // nur audio
  preview?: string;        // nur document — kurzer Markdown-Auszug
}

interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
  attachments?: MessageAttachment[];
}
```

Attachments hängen als Array an einer Message. Der **Inhalt** (PDF-Bytes, Audio-Bytes) wird **nicht** in der Chat-History dupliziert — nur `id`, `filename`, `transcription`, `preview`. Der Volltext lebt ausschließlich auf Disk unter `chat-uploads/`.

> **Stolperstein**: Wird ein Chat gelöscht, bleiben die Attachment-Dateien liegen. Es gibt eine `cleanupSessionAttachments()`-Funktion im Service, aber **kein Cron**, das sie aufruft. Manuelles Cleanup oder Disk-Quotas erforderlich.

> **Branch-Unterschied**: dieser Branch (`demo/messe`, Railway-Deploy) speichert die Chat-History als YAML-Files. Auf `main` (Scalingo) liegt sie in Postgres via `chatStorage.ts` — Schema und Verhalten siehe dort. Die Datei-Bytes der Attachments liegen auf beiden Branches identisch auf Disk in `data/chat-uploads/{sid}/{aid}/`.

---

## 7. Agent-Tool: `read_chat_attachment`

`backend/src/tools/special/read-chat-attachment.ts`

Damit Agents (z.B. `chat-document-reader`, `vision-analyzer`) auf hochgeladene Dateien zugreifen können.

**Parameter**:
```json
{
  "attachment_id": "att-86d3b6d1-1234-...",
  "format": "full" | "summary" | "metadata"   // optional, default "full"
}
```

**Session-Lookup**: erst `context.parentSessionId` (für delegierte Agents), dann `context.sessionId`. Wenn beides fehlt, sucht `getAttachment()` blind durch **alle** Session-Verzeichnisse — funktioniert, ist aber langsam (siehe `attachments.ts:493 ff.`).

**Rückgabe** je Typ (jeweils JSON-String):
- `document` → `{ success, attachment_id, filename, type, content, totalLength }` (Markdown-Volltext oder erste 2000 Zeichen bei `summary`)
- `image` → `{ success, base64, mimeType }` — Data-URL, geht direkt ins Vision-LLM
- `audio` → `{ success, transcription, mimeType }`

Vision-Bilder werden nicht zwingend über das Tool geschickt, sondern können auch direkt im Agent-Loop als `ImageContentPart` an das LLM gehängt werden (`backend/src/services/llm.ts` `createMultimodalContent`). Das Tool ist primär ein Fallback, wenn ein Agent gezielt ein Bild **textuell** beschreiben oder Metadaten lesen will.

**Document Full-Content-Cap**: bei `format: "full"` und `attachment.type === 'document'` wird der Output bei >360 KB (~90k Tokens) gekappt mit einem Truncations-Hinweis im Result-JSON (`truncated: true, cap: 368640`). Sicherheitsnetz gegen Provider-413, falls ein Agent versucht, das volle 200k-Token-PDF als Tool-Result an die nächste LLM-Iteration zu hängen. Empfohlen ist `format: "summary"` oder das Vertrauen auf die Pre-Analysis (§4.5).

---

## 8. Stolpersteine + Betriebshinweise

| Symptom | Ursache | Fix |
|---|---|---|
| 413 `Request zu groß. Maximum: 220 MB` | Browser sendet >220 MB FormData (z.B. 50× 5MB-File) | `MAX_REQUEST_BODY_SIZE` in `routes/chat.ts` höher setzen oder weniger Files anhängen |
| 400 `Zu viele Dateien. Maximum: 10 pro Nachricht.` | >10 Files in einer Message | `MAX_FILES_PER_REQUEST` in `routes/chat.ts` höher setzen oder splitten |
| 400 `Gesamtgröße der Anhänge zu groß. Maximum: 200 MB.` | Summe der File-Sizes >200 MB | `MAX_TOTAL_UPLOAD_SIZE` höher setzen oder kleinere Files |
| Supervisor delegiert in Endlos-Schleife an irgendeinen Agent für ein Doc, das er schon analysiert hat | Prompt-Modell ignoriert die Pre-Analysis-Section und greift auf die "delegiere immer"-Regel zurück | Anti-Retry-Schutz greift nach 3 identischen Calls. Prüfen: `documentAnalysisSection` wirklich im Supervisor-Prompt? Supervisor-Config aktualisiert? Backend voll neugestartet (Agent-Cache)? |
| Antwort basiert nur auf ersten Seiten eines großen PDFs | Sub-Agent-Analyse war zu schwach oder fehlte | Backend-Log: gibt's `[AgentLoop] Auto-analyzed N document(s)`? Falls 0: Doc-Markdown war `<15k` und ging inline. Falls 1: Analyse-Qualität an `analyzeOneDocument`-System-Prompt tunen. |
| Document >480k Zeichen — Analyse partial | `DOC_MAX_CONTENT_LENGTH` Cap | UI zeigt "[gekürzt]"-Badge. Für State-of-the-Art Long-Doc-Reader: Phase 2 (chunked streaming reader mit "composing notebook" — nicht implementiert). |
| `read_chat_attachment` mit `format: "full"` liefert "[... Dokument wurde nach 368640 Zeichen gekuerzt ...]" | 360k-Cap im Tool greift | Beabsichtigt — schützt vor Provider-413. Agent soll auf Pre-Analysis zurückgreifen oder `format: "summary"` nutzen. |
| Mehr als 5 Dokumente hochgeladen, nur 5 werden analysiert | `DOC_MAX_PER_REQUEST` Cap | Restliche werden als Metadaten gelistet; Supervisor kann via `read_chat_attachment` mit `format: "summary"` nachladen. `DOC_MAX_PER_REQUEST` höher setzen, falls regelmäßig gebraucht. |
| `Markitdown API Timeout nach 120s` | Markitdown-Backend hängt oder PDF zu komplex | Service-Status der Markitdown-API prüfen; ggf. `MARKITDOWN_TIMEOUT_MS` anheben |
| `Whisper API Timeout nach 300s` | Audio extrem lang oder Whisper-Backend hängt | Audio splitten; ggf. `WHISPER_TIMEOUT_MS` anheben |
| App crasht beim Start mit `MARKITDOWN_API_URL host "..." is not on the allowlist` | URL zeigt nicht auf adacor.ai oder localhost | Allowlist-Änderung in `attachments.ts:99–113` oder env auf erlaubte URL setzen |
| `ffmpeg conversion failed` beim Audio-Upload | `ffmpeg` nicht im PATH | `which ffmpeg` prüfen. Lokal: `brew install ffmpeg`. Scalingo-Deploy installiert ffmpeg via Custom-Buildpack |
| `Spracherkennung nicht konfiguriert` | `data/config/providers.yaml` hat kein `active.stt` | Settings-UI → Provider/Modelle → STT-Provider aktivieren |
| `API-Key für Spracherkennung nicht konfiguriert` | env-Variable aus `provider.api_key_env` fehlt | `.env` ergänzen, Prozess neu starten |
| Markitdown gibt 401 | `ADACOR_AI_API_KEY` falsch oder leer | `.env` prüfen — gleicher Key wie für Adacor-LLM |
| Upload schlägt mit `Ungültiger Dateityp` fehl, obwohl Endung passt | Magic-Bytes stimmen nicht mit Endung überein (z.B. umbenannte Datei) | Original-Datei wiederherstellen oder neuen Typ in `fileTypeValidator.ts` aufnehmen |
| Audio-Seek im Player ruckelt / hängt | Memory-Spike durch Voll-Lesen der Datei pro Range-Request | Bei Auffälligkeit auf echtes File-Streaming umstellen (`createReadStream`) |
| Frontend lädt Audio nicht | AttachmentID falsch oder Datei fehlt auf Disk | `data/chat-uploads/{sid}/{aid}/` prüfen; Stream-Route ist auth-frei, also Cookies sind nicht das Problem |
| Disk läuft voll | Keine automatische Bereinigung; Pending-Uploads ohne abgeschickte Message bleiben stehen | `cleanupSessionAttachments()` per Cron ergänzen oder Disk-Quota (offen — siehe „Wo erweitern") |
| User lädt SVG hoch und es wird heruntergeladen statt angezeigt | Content-Disposition-Hardening — `image/svg+xml` ist **bewusst nicht** in der Inline-Allowlist (Stored-XSS-Risiko) | Erwartetes Verhalten. Wenn SVG inline gerendert werden soll, vorher serverseitig zu PNG konvertieren |
| Agent findet Attachment nicht | `context.sessionId` fehlt → blinde Volltextsuche aller Sessions | Sicherstellen, dass das Tool über den Tool-Loop mit `ToolContext` aufgerufen wird |
| WebM-Audio aus Browser hat MIME `video/webm` statt `audio/webm` | MediaRecorder-Verhalten im Browser | Wird automatisch behandelt: beide MIME-Typen sind in `FORMATS_NEEDING_CONVERSION` (Z. 93) |
| User lädt Files hoch, schließt Tab vor Senden | `pendingAttachments` In-Memory geht verloren beim Server-Restart | Bewusst akzeptiert; alternativ: Pending-Attachments in Postgres persistieren |

### Wo erweitern?
- **Neuen Datei-Typ supporten**: in `attachments.ts` MIME-Liste (Z. 51–90) + `fileTypeValidator.ts` Magic-Bytes + Frontend `SUPPORTED_FORMATS_TEXT` in `ChatWindow.jsx`. Plus Verarbeitung in `processUpload()` (Z. 425 ff.). Bei inline-renderbaren Typen: prüfen, ob sie in die `INLINE_SAFE_MIME`-Allowlist von `contentDisposition.ts` aufgenommen werden sollen.
- **Andere STT-Engine** (Whisper-Selfhost, Deepgram, …): nur `data/config/providers.yaml`-Eintrag + ggf. abweichende Multipart-Felder in `transcribeAudio()`.
- **Größere Files**: `MAX_FILE_SIZE` in `attachments.ts` UND ggf. `MAX_REQUEST_BODY_SIZE` / `MAX_TOTAL_UPLOAD_SIZE` in `routes/chat.ts` anpassen — alle drei Schichten greifen. Dazu: Vision-LLM-Limit (`max_images_per_request: 4`), Whisper-Provider-Limit (typisch 25 MB), und Range-Stream-Memory-Spike skaliert linear.
- **Cleanup-Job**: `cleanupSessionAttachments()` auf einen Cron oder beim Chat-Delete-Hook. Idealerweise zusammen mit dem `chats`-Delete in `chatStorage.ts:233`.
- **Vision-Image-Resize**: derzeit kein Pre-Resize, große JPEGs gehen 1:1 ans Vision-LLM. Mit `sharp` (neue Dep) ließe sich auf z.B. 2048×2048 begrenzen → spart Tokens und reduziert Provider-Ablehnungen.
- **Long-Document-Streaming-Reader (Phase 2)**: für Docs >480k Zeichen wäre ein Pattern wie "lies in Chunks und führe ein composing notebook" (Anthropic Constitutional Reading) sauberer als die jetzige Hard-Truncation. Nicht implementiert, aber Architektur-kompatibel — neue Funktion `analyzeOneDocumentChunked()` neben `analyzeOneDocument()`.
- **Document-Analyse-Cache**: bei Folge-Frage zum gleichen Doc wird neu analysiert. Disk- oder In-Memory-Cache mit Key `(attachmentId, userMessage-Hash)` wäre trivial, lohnt aber erst bei wiederkehrenden Fragen.
- **Provider-Slot `document_analysis`**: aktuell wird das Chat-LLM verwendet. Eigener Slot in `providers.yaml` würde billigere/schnellere Modelle für die Doc-Analyse erlauben — z.B. ein Long-Context-Modell für Phase 2.

---

## 9. End-to-End-Beispiel: Audio-Sprachnachricht

Was passiert, wenn ein User auf das Mic-Icon klickt, 5 Sekunden spricht, „Senden" drückt:

1. **Browser**: `useAudioRecorder` startet `MediaRecorder` (z.B. Output `audio/webm`). Stop → Blob → File `recording-{ts}.webm`.
2. **Browser**: User drückt Senden. `ChatWindow` baut `FormData` mit `message` + `files` + `sessionId` und sendet POST `/api/chat`.
3. **Backend `routes/chat.ts`**: parst FormData, ruft `attachmentsService.processUpload(sessionId, file)`.
4. **Service Z. 366 ff.**: Size-Check → Magic-Byte-Validation erkennt `audio/webm` → `getFileType()` → `'audio'` → ID `att-{UUIDv4}` → Verzeichnis anlegen → `original.webm` schreiben.
5. **Service Z. 439–449**: `transcribeAudio()`:
   - `FORMATS_NEEDING_CONVERSION.includes('audio/webm')` → `true`
   - ffmpeg konvertiert zu temp-`.mp3`
   - Adacor-Whisper-API mit `model=…` + `language=de`
   - Response `{ text: "Heute ist Mittwoch." }`
   - `transcription.txt` schreiben, temp-MP3 löschen
6. **Service Z. 460 ff.**: `metadata.json` schreiben mit `type: 'audio'`, `transcription: "Heute ist Mittwoch."`.
7. **`routes/chat.ts`**: `setPendingAttachments(sessionId, [...], userId)` legt das Attachment-Manifest in die In-Memory-Map. Agent-Loop startet, der LLM-Call sieht direkt das Transkript im Context (eingehängt beim User-Turn).
8. **Beim Persistieren der User-Message**: `popPendingAttachments()` zieht das Manifest, `chatStorage.saveChat()` schreibt die Message in Postgres mit `metadata.attachments = [...]`.
9. **Browser**: nach Antwort wird der Chat-Verlauf via `loadChat()` neu geladen. `MessageAttachments` rendert `<AudioPlayer src=/api/chats/{cid}/attachments/{aid}/stream />` + Transkript-Block.

Dasselbe Schema gilt für Bilder (Schritt 5 → Base64) und Dokumente (Schritt 5 → Markitdown).

---

## 10. Datei-Index für schnelles Springen

```
backend/
  src/routes/chat.ts                               # Multipart-Endpoint
    bodyLimit + Hardening-Konstanten (MAX_REQUEST_BODY_SIZE / MAX_FILES_PER_REQUEST / MAX_TOTAL_UPLOAD_SIZE)
    File-Validation nach Form-Parsing
  src/routes/attachments.ts                        # Retrieval/Stream/Metadata
  src/services/attachments.ts                      # 670+ Zeilen
    Z. 19-25    Limits + Timeouts (MAX_FILE_SIZE, MARKITDOWN_TIMEOUT_MS, WHISPER_TIMEOUT_MS)
    Z. 22-39    ChatAttachment-Type
    Z. 51-90    MIME-Listen
    Z. 93       FORMATS_NEEDING_CONVERSION
    Z. 99-113   Markitdown-URL Allowlist (constructor)
    Z. 128-146  sanitizeFilename
    Z. 159-166  generateAttachmentId (UUIDv4)
    Z. 187-230  convertToMarkdown (Markitdown)
    Z. 236-239  imageToBase64
    Z. 245-263  convertToMp3 (ffmpeg)
    Z. 269-360  transcribeAudio (Whisper)
    Z. 366-485  processUpload (Hauptpfad)
    Z. 490-540  getAttachment (Lookup)
  src/services/chatStorage.ts                      # Postgres-Persistenz
    Z. 20-28    MessageAttachment-Type (re-exported)
    Z. 30-36    ChatHistoryMessage-Type
    Z. 100-115  rowToMessage (DB → App)
    Z. 169-230  saveChat (App → DB, attachments im messages.metadata)
    Z. 233-238  deleteChat (löscht Chat-Rows; Disk-Files bleiben)
  src/services/memory.ts                           # Pending-Attachments-Map + Sessions
    Z. 27       pendingAttachments-Map (userId::sessionId-Key)
    Z. 40-50    set/popPendingAttachments
    Z. 184-202  MessageAttachment + ChatHistoryMessage (lokale Re-Defs)
  src/services/llm.ts                              # createMultimodalContent (Vision)
  src/agents/loop.ts                               # Agent-Loop + Pre-Analysis
    Z. ~352-477  analyzeImagesAutomatically (Vision-Pre-Processing)
    Z. ~487-505  Document-Konstanten (DOC_INLINE_THRESHOLD, DOC_MAX_CONTENT_LENGTH, DOC_MAX_CONCURRENT, DOC_MAX_PER_REQUEST)
    Z. ~518-605  analyzeDocumentsAutomatically (orchestriert Sub-Agents pro Doc)
    Z. ~607-680  analyzeOneDocument (System-Prompt + LLM-Call pro Doc)
    Z. ~990-1080 buildSupervisorPrompt (Metadata-only für Documents)
    Z. ~1722+    runAgentLoop (ruft Pre-Analysis, baut fullSystemPrompt mit documentAnalysisSection)
    Z. ~2080+    delegationCallback + delegationFingerprints (Anti-Retry-Schutz, DELEGATION_RETRY_LIMIT)
  src/tools/special/read-chat-attachment.ts        # Agent-Tool (mit 360k Full-Cap)
  src/utils/fileTypeValidator.ts                   # Magic-Byte-Check
  src/utils/contentDisposition.ts                  # Inline-Allowlist + RFC-5987-Filename
  src/db/schema/chat.ts                            # chats/messages/chat_folders Tables
  src/services/usageTracking.ts                    # source-Enum (incl. 'document_analysis')
data/agents/supervisor/config.md                   # Supervisor-Prompt
  ABSOLUTE PRIORITÄT — HOCHGELADENE DOKUMENTE      # über der "delegiere immer"-Regel
  ANTI-RETRY-SCHUTZ                                # Prompt-Level-Stopp nach 2 identischen Fehlern
frontend/
  src/components/ChatWindow.jsx
    um Z. 2293  MIME-Konstanten + Type-Guards
    um Z. 2675  MessageAttachments (Render im Verlauf)
    um Z. 2758  PendingAttachments (vor Versand)
    um Z. 3304  Klick-Upload + Drag-and-Drop
    um Z. 3361  Audio-Aufnahme-Trigger
    Cases:      document_analysis / document_analysis_complete (Status-Block + Icon + Label)
  src/components/AudioPlayer.jsx
  src/hooks/useAudioRecorder.js
  src/hooks/useStreaming.js                        # SSE-Listener
    document_analysis_start / _end → addThinkingStep → Status im Chat
data/
  chat-uploads/                                    # Storage-Wurzel (UPLOADS_BASE)
  config/providers.yaml                            # STT-Provider-Konfig
```
