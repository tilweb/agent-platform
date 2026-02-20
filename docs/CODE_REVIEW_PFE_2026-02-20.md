# Code Review — PFE Branch

**Datum:** 2026-02-20
**Scope:** 30 Commits, ~15.000 Zeilen Diff (main..PFE)
**Methode:** 5 parallele Agents (Backend, Frontend, Infra, API-Contracts, Security)

---

## Zusammenfassung

| Severity | Anzahl | Top-Themen |
|----------|--------|------------|
| **CRITICAL** | 5 | XSS, Code Execution, fehlende Validierung, Helm/Docker Fehlconfig |
| **HIGH** | 10 | Memory Leak, fehlende Locks, Secret-Exposure, fehlende Auth |
| **MEDIUM** | 14 | Input-Validierung, Hook-Bugs, Design-Violations, Timeouts |
| **LOW** | 12 | Sync-in-Async, inkompletter Rename, fehlende Fallbacks |

### Top 5 Sofort-Massnahmen

1. **C1 — XSS im OAuth-Callback patchen** (Security-Critical, einfacher Fix)
2. **C2 — Plugin-Loader Path-Traversal verhindern** (Security-Critical)
3. **H1 — chatLocks Memory Leak fixen** (Production-Stability)
4. **H2 — Spaces Storage Mutex einbauen** (Data-Integrity)
5. **C4/C5 — Helm ConfigMap + Docker Volume-Mounts korrigieren** (Deployment-Critical)

---

## CRITICAL (5 Findings)

### C1. XSS in OAuth-Callback HTML
- **Datei:** `backend/src/routes/connections.ts:256`
- **Status:** [x] Gefixt
- **Issue:** Der `message`-Parameter wird unescaped in HTML eingebettet. Ein Angreifer kann via `message=<img src=x onerror=alert(1)>` JavaScript ausfuehren.
- **Fix:** `escapeHtml()` fuer HTML-Kontext, `escapeJs()` fuer JavaScript-Kontext, `postMessage` Origin von `'*'` auf `window.location.origin` eingeschraenkt (behebt auch M2).

### C2. Arbitrary Code Execution im Plugin-Loader
- **Datei:** `backend/src/plugins/loader.ts:99-113`
- **Status:** [x] Gefixt
- **Issue:** `import(entryPoint)` mit unkontrolliertem Pfad aus `manifest.yaml`. Path-Traversal (`../../../malicious.ts`) moeglich.
- **Fix:** Pfad normalisieren und validieren, dass er innerhalb des Plugin-Verzeichnisses bleibt:
  ```typescript
  const normalized = normalize(entryPoint);
  if (!normalized.startsWith(normalize(pluginDir) + sep)) {
    throw new Error('Invalid entryPoint: path outside plugin directory');
  }
  ```

### C3. `decryptData<T>()` ohne Runtime-Validierung
- **Datei:** `backend/src/connections/crypto.ts:227`
- **Status:** [x] Gefixt
- **Issue:** `JSON.parse(...) as T` ohne Pruefung. Im Gegensatz zu `decryptTokens()` (das validiert) wird hier blind gecastet. Korrupte/manipulierte Daten werden stillschweigend als gueltiges Objekt weitergereicht.
- **Fix:** Optionale Validierungsfunktion als Parameter akzeptieren:
  ```typescript
  export async function decryptData<T>(
    encrypted: EncryptedData,
    validate?: (parsed: unknown) => T
  ): Promise<T> {
    const parsed = JSON.parse(new TextDecoder().decode(plaintext));
    if (validate) return validate(parsed);
    return parsed as T;
  }
  ```

### C4. Helm ConfigMap: `PORT` statt `BACKEND_PORT`
- **Datei:** `helm/adacor-workplace/templates/configmap.yaml:9`
- **Status:** [x] Gefixt
- **Issue:** Backend liest `process.env.BACKEND_PORT`, aber die ConfigMap setzt `PORT`. Port-Konfiguration wird in Kubernetes ignoriert, Backend faellt auf Default 3001 zurueck.
- **Fix:** Key in ConfigMap von `PORT` zu `BACKEND_PORT` aendern.

### C5. Docker Compose: Widersprüchliche Volume-Mounts
- **Datei:** `docker-compose.yml:5-6`
- **Status:** [x] Gefixt
- **Issue:** `./data:/data` wird gemountet aber nie gelesen (Backend nutzt `/app/data`). `./backend/data:/app/data` ueberlagert. Das fuehrt zu Verwirrung und potenziell zu Datenverlust.
- **Fix:** Ungenutztes `./data:/data` Mount entfernen.

---

## HIGH (10 Findings)

### H1. `chatLocks` Memory Leak
- **Datei:** `backend/src/services/memory.ts:34-36`
- **Status:** [x] Gefixt
- **Issue:** Cleanup-Bedingung `chatLocks.get(sessionId) === undefined` ist **nie** wahr (Map enthaelt immer die resolved Promise). Locks werden nie aufgeraeumt — unbegrenztes Wachstum bei vielen Sessions.
- **Fix:** `myLock`-Referenz gespeichert, Vergleich `chatLocks.get(sessionId) === myLock` vor Delete.

### H2. Spaces Storage: Kein Mutex
- **Datei:** `backend/src/spaces/storage.ts`
- **Status:** [x] Gefixt
- **Issue:** Read-Modify-Write auf YAML-Dateien ohne Locking — im Gegensatz zu allen anderen Storage-Modulen (auth, connections, providers, apps, chats). Concurrent Requests koennen Daten ueberschreiben.
- **Fix:** `withSpaceLock(spaceId, fn)` + `withIndexLock(fn)` eingefuehrt fuer updateSpace, addSpaceMember, updateMemberRole, removeSpaceMember, updateSpaceSettings.

### H3. Spaces Migration: Regex-Injection + Stille Fehler
- **Datei:** `backend/src/spaces/storage.ts` (Top-level Migration)
- **Status:** [x] Gefixt
- **Issue:** `new RegExp(entry.name, 'g')` ohne Escaping — Verzeichnisnamen mit `.`, `+`, `*` matchen falsch. Leere `catch {}` Bloecke verschlucken alle Fehler.
- **Fix:** Regex-Metazeichen mit `escapedName` geescaped, alle 4 leeren `catch {}` durch `catch (err) { console.error(...) }` ersetzt.

### H4. Env-Variablen an MCP Runner ueber HTTP
- **Datei:** `backend/src/mcp/remote-connection.ts:59-88`
- **Status:** [x] Gefixt
- **Issue:** API-Keys und Secrets werden per HTTP POST an den Runner gesendet. Keine TLS-Erzwingung, keine Allowlist welche Env-Vars weitergeleitet werden duerfen.
- **Fix:** HTTPS-Warnung in Production (ausser lokale Netzwerke), Env-Var-Allowlist (`ENV_ALLOWLIST`) blockt unbekannte Variablen.

### H5. Docker: `default-dev-secret` als MCP Runner Secret
- **Datei:** `docker-compose.yml:15,33`
- **Status:** [x] Gefixt
- **Issue:** `MCP_RUNNER_SECRET=${MCP_RUNNER_SECRET:-default-dev-secret}` — hardcodierter Fallback. Ohne `.env`-Konfiguration ist der Runner quasi unauthentifiziert.
- **Fix:** `${MCP_RUNNER_SECRET:?Set MCP_RUNNER_SECRET in .env}` — fail-fast mit Fehlermeldung.

### H6. SpaceChatPage: Raw `fetch` statt `apiFetch`
- **Datei:** `frontend/src/pages/SpaceChatPage.jsx:228-238`
- **Status:** [x] Gefixt
- **Issue:** Einzige Stelle im Frontend die `fetch` direkt nutzt statt `apiPost`. Umgeht CSRF-Schutz und einheitliches Error-Handling.
- **Fix:** `apiFetch('/chat', {...})` mit Import — nutzt zentralen Base-URL und Credentials-Handling, kompatibel mit Streaming.

### H7. PluginConfigForm: Keine Required-Field-Validierung
- **Datei:** `frontend/src/components/PluginConfigForm.jsx:132-135`
- **Status:** [x] Gefixt
- **Issue:** Visuell markierte Pflichtfelder werden nicht vor Submit validiert. Leere API-Keys koennen gespeichert werden.
- **Fix:** `validationErrors` State + Pruefung aller required Fields vor `onSave()`, Fehlermeldung unter jedem Feld.

### H8. Helm: MCP Runner Secret `optional: true`
- **Datei:** `helm/adacor-workplace/templates/mcp-runner-deployment.yaml:47`
- **Status:** [x] Gefixt
- **Issue:** Ohne Secret startet der Runner unauthentifiziert. Jeder Pod im Cluster kann die Runner-API aufrufen.
- **Fix:** `optional: false` gesetzt.

### H9. Helm: MCP Runner ohne `readOnlyRootFilesystem`
- **Datei:** `helm/adacor-workplace/templates/mcp-runner-deployment.yaml:65-69`
- **Status:** [x] Gefixt
- **Issue:** Backend und Frontend haben `readOnlyRootFilesystem: true`, der Runner (der Drittanbieter-Code ausfuehrt) nicht.
- **Fix:** `readOnlyRootFilesystem: true` hinzugefuegt (emptyDir fuer /tmp und npm-cache bereits vorhanden).

### H10. Hardcodierte Pfade in test-writer/type-fixer Agents
- **Datei:** `.claude/agents/test-writer/test-writer.md`, `.claude/agents/type-fixer/type-fixer.md`
- **Status:** [x] Gefixt
- **Issue:** `/Users/pfend/github/agent-platform/...` statt `$CLAUDE_PROJECT_DIR`.
- **Fix:** Durch `$CLAUDE_PROJECT_DIR` ersetzt.

---

## MEDIUM (14 Findings)

### M1. `hexToBuffer` ohne Validierung
- **Datei:** `backend/src/connections/crypto.ts:30-36`
- **Status:** [x] Gefixt (mit C3)
- **Issue:** `parseInt(hex, 16)` gibt bei ungueltigem Input `NaN` zurueck, was still zu `0` wird. Keine Pruefung auf gueltige Hex-Zeichen oder gerade Laenge.
- **Fix:** Regex-Validierung (`/^[0-9a-f]*$/i`) und Laengenpruefung vor dem Parsen.

### M2. `postMessage('*')` Wildcard-Origin
- **Datei:** `backend/src/routes/connections.ts:263`
- **Status:** [x] Gefixt (mit C1)
- **Issue:** OAuth-Callback sendet postMessage mit `'*'` als Target-Origin. Erlaubt Cross-Origin-Interception.
- **Fix:** `window.location.origin` statt `'*'`.

### M3. OAuth Redirect-URI: Unvollstaendige Validierung
- **Datei:** `backend/src/routes/connections.ts:37-60`
- **Status:** [x] Gefixt
- **Issue:** Hostname nicht lowercase-normalisiert, Query-Parameter erlaubt, IDN-Domains nicht behandelt.
- **Fix:** `hostname.toLowerCase()` Normalisierung, `url.search`/`url.hash` Ablehnung hinzugefuegt.

### M4. Plugin-Loader: Glob ohne Symlink-Pruefung
- **Datei:** `backend/src/plugins/loader.ts:60-93`
- **Status:** [x] Gefixt
- **Issue:** Symlinks im Plugin-Verzeichnis koennten auf Dateien ausserhalb zeigen.
- **Fix:** `realpath()` Pruefung nach Path-Traversal-Check, verifiziert dass symlink-aufgeloester Pfad im Plugin-Dir bleibt.

### M5. Plugin-ConfigStorage: Race Condition
- **Datei:** `backend/src/plugins/configStorage.ts:40-65`
- **Status:** [x] Gefixt
- **Issue:** Concurrent Config-Saves koennen verschluesselte und unverschluesselte Werte mischen.
- **Fix:** `withConfigLock(path, fn)` per-Plugin File-Level Locking eingefuehrt.

### M6. `generateId()` nutzt `Math.random()`
- **Datei:** `backend/src/utils/id.ts`
- **Status:** [x] Gefixt
- **Issue:** `Math.random()` ist vorhersagbar. Space-IDs, User-IDs etc. sind berechenbar.
- **Fix:** `crypto.getRandomValues(new Uint8Array(4))` fuer kryptographisch sicheren Random-Anteil.

### M7. `loadYaml<T>()` castet ohne Validierung
- **Datei:** `backend/src/utils/yamlStorage.ts:30`
- **Status:** [x] Gefixt
- **Issue:** `parseYaml(text) as T` ohne Runtime-Pruefung. Korrupte YAML-Dateien werden als gueltiges Objekt weitergereicht.
- **Fix:** Optionaler `validate?: (data: unknown) => T` Parameter analog zu `decryptData<T>`. Null/undefined Guard hinzugefuegt.

### M8. CSRF blockt Multipart ohne Origin
- **Datei:** `backend/src/middleware/csrf.ts`
- **Status:** [x] Gefixt
- **Issue:** File-Uploads ohne Origin/Referer-Header werden jetzt mit 403 geblockt. Koennte API-Testing-Tools und Proxy-Setups brechen.
- **Fix:** Verhalten dokumentiert — Non-Browser-Clients (curl, Postman) muessen Origin-Header mitsenden fuer non-JSON Requests.

### M9. MCP Runner bekommt komplette `.env`
- **Datei:** `docker-compose.yml:29-30`
- **Status:** [x] Gefixt
- **Issue:** `env_file: .env` gibt dem Runner alle Secrets (LLM-Keys, Encryption-Keys, OAuth-Credentials). MCP-Server-Prozesse koennten diese lesen.
- **Fix:** `env_file` entfernt — Runner bekommt nur noch `MCP_RUNNER_SECRET` und `MCP_RUNNER_PORT` via `environment`-Block.

### M10. Docker Proxy: SSE-Timeout nur 120s
- **Datei:** `docker/proxy.conf:24`
- **Status:** [x] Gefixt
- **Issue:** `proxy_read_timeout 120s` — Agent-Loops und LLM-Anfragen koennen laenger dauern. Helm hat 3600s.
- **Fix:** Timeout auf `600s` erhoeht, `proxy_http_version 1.1` hinzugefuegt (behebt auch L6).

### M11. Hook `design-check.sh`: Pipeline-Bug
- **Datei:** `.claude/hooks/design-check.sh:37`
- **Status:** [x] Gefixt
- **Issue:** `grep -q ... | grep -v "theme.colors"` — `grep -q` produziert keinen Output, der zweite `grep` bekommt nichts. Theme-Filter wirkt nie.
- **Fix:** Pipeline korrigiert: `grep -E ... | grep -qv "theme\.colors"` — Output fliesst korrekt durch Filter.

### M12. Hook `design-check.sh`: `grep -P` nicht auf macOS
- **Datei:** `.claude/hooks/design-check.sh:51`
- **Status:** [x] Gefixt
- **Issue:** PCRE-Flag `-P` wird fuer Emoji-Check verwendet, ist aber auf macOS-Standard-grep nicht verfuegbar. Check schlaegt still fehl.
- **Fix:** `perl -C -ne` statt `grep -P` — perl ist auf macOS immer verfuegbar und unterstuetzt Unicode nativ.

### M13. SpaceChatPage: Hardcodierte Farben
- **Datei:** `frontend/src/pages/SpaceChatPage.jsx` (12+ Stellen)
- **Status:** [x] Gefixt
- **Issue:** `#9333ea`, `#ef4444` etc. direkt in Styles statt `theme.colors.*`.
- **Fix:** Alle Hex-Werte durch `theme.colors.*` oder dynamisches `color` (Space-Farbe) ersetzt. Send-Button Hover via `filter: brightness(0.85)` statt Hex.

### M14. PluginConfigForm: Native Checkbox statt Toggle-Icon
- **Datei:** `frontend/src/components/PluginConfigForm.jsx:142-153`
- **Status:** [x] Gefixt
- **Issue:** `<input type="checkbox">` statt `ToggleOnIcon`/`ToggleOffIcon` laut Frontend-CLAUDE.md.
- **Fix:** ToggleOnIcon/ToggleOffIcon SVG-Icons eingefuehrt, toggleButton Style mit Hover-Effekt.

---

## LOW (12 Findings)

### L1. `errorHandler.ts:161` — Status-Union unvollstaendig
- **Status:** [x] False Positive
- **Issue:** `as 400|401|403|404|429|500|502|503` fehlen 409, 422 etc.
- **Analyse:** Die Union deckt exakt alle Werte aus `ERROR_STATUS` ab. 409/422 werden nie verwendet. Kein Fix noetig.

### L2. `spaces/storage.ts` — `readFile`/`writeFile` statt `Bun.file`
- **Status:** [x] Gefixt
- **Issue:** Konvention ist `Bun.file`/`Bun.write`.
- **Fix:** Alle `readFile(path, 'utf-8')` durch `Bun.file(path).text()` und alle `writeFile(path, data, 'utf-8')` durch `Bun.write(path, data)` ersetzt. Import von `readFile`/`writeFile` entfernt.

### L3. `yamlStorage.ts:16-21` — Sync `mkdirSync` in async Funktion
- **Status:** [x] Gefixt (mit M7)
- **Issue:** Blockt Event Loop. `mkdir` aus `fs/promises` mit `recursive: true` verwenden.
- **Fix:** `mkdirSync` durch `await mkdir` aus `fs/promises` ersetzt.

### L4. `yamlStorage.ts:75-81` — Sync `unlinkSync` in async Funktion
- **Status:** [x] Gefixt (mit M7)
- **Issue:** Selbes Pattern wie L3. `unlink` aus `fs/promises` verwenden.
- **Fix:** `unlinkSync` durch `await unlink` aus `fs/promises` ersetzt.

### L5. `docker-compose.yml` — Kein `restart: unless-stopped`
- **Status:** [x] Gefixt
- **Issue:** Container bleiben nach Crash down.
- **Fix:** `restart: unless-stopped` bei allen 4 Services (backend, mcp-runner, frontend, proxy) ergaenzt.

### L6. `docker/proxy.conf` — Fehlendes `proxy_http_version 1.1`
- **Status:** [x] Gefixt (mit M10)
- **Issue:** SSE braucht HTTP/1.1 Keepalive durch nginx.

### L7. `helm/Chart.yaml` — `appVersion: "0.0.0"`
- **Status:** [x] Gefixt
- **Issue:** Image-Tags resolven zu `0.0.0`, das vermutlich nicht im Registry existiert.
- **Fix:** `appVersion` auf `"0.1.0"` gesetzt (gleich wie `version`).

### L8. `DocsPage.jsx` — `useNavigate()` ungenutzt
- **Status:** [x] False Positive
- **Issue:** Hook wird aufgerufen aber `navigate` nie verwendet.
- **Analyse:** `navigate` wird in `handleNavClick()` (Zeile 674) und als Prop an `FeatureGrid` verwendet. Kein Fix noetig.

### L9. `DocsPage.jsx` — Interne Links mit `<a href>` statt React Router
- **Status:** [x] Gefixt
- **Issue:** Voller Page Reload statt Client-Side Navigation.
- **Fix:** `<a href>` durch `<Link to>` aus react-router-dom ersetzt fuer interne .md-Links. `Link` importiert.

### L10. `DocsPage.jsx` — `clipboard.writeText()` Promise ignoriert
- **Status:** [x] Gefixt
- **Issue:** "Kopiert"-Feedback wird auch bei Fehler gezeigt.
- **Fix:** Promise mit `.then()` gehandelt — `setCopied(true)` nur bei Erfolg. `.catch(() => {})` fuer Fehlerfall.

### L11. `SpaceDetailPage.jsx:349` — Prop heisst noch `project=` statt `space=`
- **Status:** [x] Gefixt
- **Issue:** Inkompletter Rename. Funktional korrekt, aber verwirrend.
- **Fix:** Prop von `project={spaceContext}` auf `space={spaceContext}` umbenannt. ChatWindow-Prop ebenfalls von `project` auf `space` umbenannt.

### L12. `.env.example` — Aktiver Placeholder fuer Encryption Key
- **Status:** [x] Gefixt
- **Issue:** `CONNECTION_ENCRYPTION_KEY=your-256-bit-hex-key-here` ist kein gueltiger Hex-Key aber ein aktiver Wert. Wenn nicht geaendert, werden Tokens mit einem oeffentlich bekannten Key verschluesselt.
- **Fix:** Wert leer gelassen (`CONNECTION_ENCRYPTION_KEY=`). Kommentar darueber erklaert die Generierung.

---

## API Contracts

**Status: Alle korrekt.**

Alle 25 Space-Routes (GET/POST/PUT/DELETE) korrekt zwischen Frontend (`useSpaces.js`) und Backend (`routes/spaces.ts`) gemappt. Keine fehlenden Endpoints, keine Method-Mismatches, keine Path-Parameter-Inkonsistenzen.

---

## Positive Aenderungen (nicht-Issues)

Die folgenden Patterns sind signifikante Verbesserungen im Diff:

1. **SSE-Stream hat jetzt `authMiddleware`** — vorher unauthentifiziert
2. **FormData Type-Safety** — `instanceof File` statt `as File` Casts
3. **Zentralisierte Pfade** (`utils/paths.ts`) — eliminiert verstreute `resolve(process.cwd(), '../data/...')`
4. **Zentralisierte ID-Generierung** (`utils/id.ts`) — ersetzt Duplikate in 5+ Dateien
5. **`parseIntSafe`** — ersetzt rohes `parseInt` in Routes, verhindert NaN-Propagation
6. **`yamlStorage` Utility** — DRY fuer das YAML-CRUD-Pattern
7. **Plugin-System** — ersetzt hardcodierte Connection-Provider mit dynamischem System
8. **Mutex Locks** — eingefuehrt fuer Apps-Registry, Chat-Files, Folders, Providers, Connections, User-Storage
9. **`internalError` Handler** — standardisiert 500-Responses
10. **Token-Validierung nach Decryption** in `decryptTokens()` — verifiziert TokenSet-Struktur
11. **`API_BASE_URL` required fuer OAuth** — kein hardcodierter localhost-Fallback mehr
