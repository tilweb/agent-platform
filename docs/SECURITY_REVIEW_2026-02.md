# Security Review: Agent Platform
**Datum:** Februar 2026
**Status:** Analyse abgeschlossen, Umsetzung ausstehend

---

## Zusammenfassung

| Schweregrad | Anzahl | Beschreibung |
|-------------|--------|--------------|
| **KRITISCH** | 4 | Sofort beheben - Produktionsrisiko |
| **HOCH** | 12 | Diese Woche beheben |
| **MITTEL** | 15 | Nächster Sprint |
| **NIEDRIG** | 7 | Backlog |

---

## KRITISCHE SICHERHEITSPROBLEME (P0)

### 1. Secrets in .env-Datei exponiert
**Datei:** `.env` (Root)
**Problem:** API-Keys sind im Klartext sichtbar (ADACOR_AI_API_KEY, GOOGLE_CLIENT_SECRET, CONNECTION_ENCRYPTION_KEY, etc.)
**Risiko:** Wenn in Git commitet, sind alle Secrets kompromittiert
**Fix:**
- Alle Secrets sofort rotieren
- .env aus Git-History entfernen
- Secret Management Service nutzen (Vault, AWS Secrets Manager)

### 2. SSRF in CustomApiTool
**Datei:** `backend/src/tools/custom/CustomApiTool.ts:113-136`
**Problem:** Beliebige URLs können aufgerufen werden ohne Validierung
```typescript
let url = this.config.endpoint;  // Keine Validierung!
```
**Risiko:** Angreifer kann interne Services angreifen (localhost, private IPs)
**Fix:** URL-Whitelist, nur erlaubte Hosts/Domains

### 3. HTTP statt HTTPS für API-Kommunikation
**Dateien:**
- `frontend/src/context/AuthContext.jsx:3` - hardcoded `http://localhost:3001`
- `frontend/src/hooks/useSearch.js:10` - hardcoded
- `frontend/src/pages/SharedChatPage.jsx:8` - hardcoded

**Problem:** Credentials und sensible Daten unverschlüsselt
**Risiko:** Man-in-the-Middle, Token-Theft
**Fix:** HTTPS erzwingen, Environment-Variable nutzen

### 4. API-Keys in Query-Parametern
**Datei:** `backend/src/tools/custom/CustomApiTool.ts:225-231`
**Problem:** API-Keys können als Query-Parameter übertragen werden
**Risiko:** Keys in Server-Logs, Proxy-Logs, Browser-History sichtbar
**Fix:** Keys NUR in Authorization-Header

---

## HOHE SICHERHEITSPROBLEME (P1)

### 5. Fehlende Rate-Limiting
**Dateien:** Alle Routes (auth.ts, chat.ts, transcription.ts, etc.)
**Problem:** Keine Beschränkung für Login-Versuche, API-Calls
**Risiko:** Brute-Force, DoS
**Fix:** Rate-Limiting Middleware implementieren

### 6. Fehlender CSRF-Schutz
**Dateien:** POST/PUT/DELETE Routes ohne Token-Validierung
**Problem:** State-Changing Operations ohne CSRF-Token
**Risiko:** Cross-Site Request Forgery
**Fix:** CSRF-Token Middleware, SameSite=Strict Cookies

### 7. React-Markdown ohne Sanitization
**Dateien:**
- `frontend/src/components/ChatWindow.jsx:1650-1652`
- `frontend/src/pages/SharedChatPage.jsx:210-253`

**Problem:** User-generierte Inhalte ohne HTML-Sanitization
**Risiko:** XSS via Markdown (`[Click](javascript:alert('XSS'))`)
**Fix:** DOMPurify vor ReactMarkdown

### 8. Conditional Secure Cookie Flag
**Datei:** `backend/src/auth/types.ts:67`
```typescript
secure: process.env.NODE_ENV === 'production'
```
**Problem:** In Dev/Staging werden Cookies über HTTP gesendet
**Fix:** `secure: true` immer setzen

### 9. Sensible Daten in Error-Responses
**Dateien:** transcription.ts:85-91, chat.ts:139-142
**Problem:** Backend-Fehlerdetails werden an Client gesendet
**Risiko:** Information Disclosure
**Fix:** Generische Fehlermeldungen für Client

### 10. Keine Content Security Policy
**Datei:** `frontend/index.html`
**Problem:** Keine CSP-Header definiert
**Risiko:** XSS, Clickjacking
**Fix:** CSP-Header in Vite-Config oder Backend

### 11. YAML-basierte Datenspeicherung
**Dateien:** `backend/src/auth/storage.ts`, `backend/src/auth/session.ts`
**Problem:** Dateisystem ohne Transaktionen, Race Conditions möglich
**Risiko:** Datenkorruption, keine Encryption at Rest
**Fix:** Migration zu SQLite/PostgreSQL

### 12. Fehlender Audit-Trail
**Problem:** Keine strukturierten Logs für sicherheitsrelevante Aktionen
**Risiko:** Keine Nachvollziehbarkeit bei Incidents
**Fix:** Audit-Log Service implementieren

### 13. File-Upload MIME-Type nur Client-seitig geprüft
**Datei:** `backend/src/services/attachments.ts:86-90`
**Problem:** MIME-Type kann gefälscht werden
**Fix:** Magic-Bytes/File-Signatur serverseitig prüfen

### 14. Fehlende Authentifizierung auf Admin-Routes
**Datei:** `backend/src/routes/providers.ts`
**Problem:** Provider-Management ohne Auth-Check
**Fix:** authMiddleware + adminMiddleware

### 15. optionalAuthMiddleware auf sensiblen Routes
**Datei:** `backend/src/routes/chat.ts:60`
**Problem:** Chat-API ohne Pflicht-Auth
**Risiko:** Unauthentizierte API-Nutzung, Token-Spending
**Fix:** Pflicht-Authentifizierung

### 16. Path Traversal Risiko bei File-Uploads
**Datei:** `backend/src/services/attachments.ts:136-152`
**Problem:** Dateiname nicht explizit sanitiert
**Fix:** Whitelist für erlaubte Zeichen, basename() verwenden

---

## MITTLERE SICHERHEITSPROBLEME (P2)

### 17. Keine Dateigröße-Limits
**Dateien:** attachments.ts, transcription.ts
**Problem:** Unbegrenzte Upload-Größe
**Fix:** Max 50-100MB Limit

### 18. Lange Session-Dauer (7 Tage)
**Datei:** `backend/src/auth/types.ts:60`
**Fix:** 1-2 Stunden, Refresh-Token Mechanismus

### 19. Session-Fixation nicht verhindert
**Problem:** Keine Session-Regeneration nach Login
**Fix:** Neue Session-ID nach Auth

### 20. Schwache Passwort-Anforderungen
**Datei:** `backend/src/auth/password.ts:30-45`
**Problem:** Nur Längenprüfung (8-128 Zeichen)
**Fix:** Komplexitätsregeln, Blacklist

### 21. X-Forwarded-For nicht validiert
**Datei:** `backend/src/routes/auth.ts:83`
**Problem:** Header kann gespoofed werden
**Fix:** Nur von Trusted Proxy akzeptieren

### 22. Zu permissive CORS-Policy
**Datei:** `backend/src/index.ts:61-73`
**Problem:** Alle localhost-Ports erlaubt
**Fix:** Explizite Origin-Whitelist

### 23. Frontend File-Upload ohne Validierung
**Dateien:** useAudioRecorder.js, useStreaming.js
**Problem:** Keine Client-seitige Size/Type-Prüfung
**Fix:** Validierung vor Upload

### 24. Fehlende TLS-Validierung bei externen APIs
**Datei:** `backend/src/connections/providers/google-drive/tools/read-file.ts:59-70`
**Problem:** Keine Certificate-Pinning
**Fix:** HTTPS-only, Certificate-Pinning für kritische APIs

### 25. Hardcodierte API-Endpoints
**Datei:** `backend/src/services/attachments.ts:70-71`
**Problem:** Fallback-URLs im Code
**Fix:** Nur Environment-Variablen

### 26. Fehlende Input-Längen-Limits
**Datei:** `backend/src/routes/projects.ts:76-80`
**Problem:** Namen können beliebig lang sein
**Fix:** maxLength-Validierung

### 27. Unsichere Browser-Caching
**Datei:** `backend/src/index.ts`
**Problem:** Keine Cache-Control Header
**Fix:** `Cache-Control: no-store, no-cache, must-revalidate`

### 28. Fehlende X-Frame-Options Header
**Datei:** `backend/src/index.ts`
**Problem:** Clickjacking möglich
**Fix:** Security-Header Middleware

### 29. Console.logs in Production
**Dateien:** 45+ Vorkommen in Frontend
**Problem:** Debug-Info in Browser-Konsole
**Fix:** Logger mit Levels, Production-Strip

### 30. URL-Parameter ohne Validierung
**Dateien:** SharedChatPage.jsx, useSearch.js
**Problem:** Token-Format nicht geprüft
**Fix:** Zod/Yup Validierung

### 31. Inkonsistente RBAC-Rollen
**Dateien:** auth/types.ts, projects/permissions.ts
**Problem:** System: admin/user, Projekte: owner/admin/editor/viewer
**Fix:** Einheitliche Permission-Matrix

---

## NIEDRIGE SICHERHEITSPROBLEME (P3)

### 32. Debug-Logging mit Session-IDs
**Datei:** `backend/src/auth/middleware.ts:53-60`
**Problem:** Session-IDs in Console-Logs
**Fix:** Debug-Logs entfernen oder Logger-Levels

### 33. Admin-Middleware Typ-Unsicherheit
**Datei:** `backend/src/routes/auth.ts:223-229`
**Problem:** `any`-Typen statt Hono-Typen
**Fix:** Spezifische Typen verwenden

### 34. Initial-Passwort in Response
**Datei:** `backend/src/routes/auth.ts:285, 353`
**Problem:** Passwort wird über API zurückgesendet
**Fix:** Temporärer Token statt Passwort

### 35. Keine regelmäßigen Password-Rehashes
**Datei:** `backend/src/auth/password.ts`
**Problem:** Alte Hashes werden nicht aktualisiert
**Fix:** Rehash bei Login wenn nötig

### 36. Unsichere URL-Construction
**Datei:** `frontend/src/components/ChatWindow.jsx:101, 271`
**Problem:** shareInfo.shareUrl nicht validiert
**Fix:** URL-Validierung vor Anzeige

### 37. OAuth Redirect URI nicht strikt validiert
**Datei:** `backend/src/routes/connections.ts:109-112`
**Problem:** baseUrl könnte manipuliert sein
**Fix:** Whitelist Redirect URIs

### 38. Fehler-Details in OAuth Callback
**Datei:** `backend/src/routes/connections.ts:147-199`
**Problem:** Fehler könnten interne Service-Infos enthalten
**Fix:** Generische Fehlermeldungen

---

## POSITIVE BEFUNDE ✓

- **Argon2id** für Password-Hashing (State-of-the-Art)
- **HttpOnly Cookies** korrekt gesetzt
- **credentials: 'include'** für API-Requests
- **rel="noopener noreferrer"** bei externen Links
- **Keine dangerouslySetInnerHTML** Verwendung
- **npm audit: 0 Vulnerabilities**
- **Korrekte Error-Messages** (keine Username-Enumeration bei Login)
- **Encryption für Connection-Tokens** (crypto.ts)

---

## EMPFOHLENE MASSNAHMEN

### Sofort (P0) - Diese Woche
1. ⬜ Secrets rotieren und .env sichern
2. ⬜ HTTPS erzwingen (Frontend URLs)
3. ⬜ SSRF-Validierung in CustomApiTool
4. ⬜ API-Keys aus Query-Parametern entfernen

### Hoch (P1) - Nächste 2 Wochen
5. ⬜ Rate-Limiting implementieren
6. ⬜ CSRF-Token hinzufügen
7. ⬜ DOMPurify für Markdown
8. ⬜ CSP-Header setzen
9. ⬜ Secure Cookie Flag fix
10. ⬜ Error-Messages sanitieren
11. ⬜ Auth auf Admin-Routes
12. ⬜ File-Upload Magic-Bytes Prüfung

### Mittel (P2) - Nächster Sprint
13. ⬜ SQLite/PostgreSQL Migration
14. ⬜ Audit-Logging
15. ⬜ Session-Timeout reduzieren
16. ⬜ Passwort-Komplexität
17. ⬜ Security Headers Middleware

---

## Verifizierung nach Fixes

1. ⬜ OWASP ZAP Scan durchführen
2. ⬜ npm audit regelmäßig ausführen
3. ⬜ Penetration Test beauftragen
4. ⬜ Security Headers prüfen (securityheaders.com)
5. ⬜ SSL Labs Test für HTTPS-Konfiguration

---

## Referenzen

- OWASP Top 10 2024
- OWASP ASVS 4.0
- CWE/SANS Top 25

---

## Maßnahmen-Log

Dokumentation der durchgeführten Maßnahmen zu jedem Punkt.

### KRITISCH (P0)

| # | Problem | Status | Maßnahme | Datum |
|---|---------|--------|----------|-------|
| 1 | Secrets in .env exponiert | ✅ Erledigt | Kein Git-Repo vorhanden, nur lokale Entwicklung. `.gitignore` in Root, Backend und Frontend angelegt/ergänzt mit `.env` und `.env.*` | 2026-02-13 |
| 2 | SSRF in CustomApiTool | ✅ Erledigt | SSRF-Schutz implementiert via `backend/src/utils/ssrfProtection.ts`: (1) Private IP Blocklist (localhost, 10.x, 172.16.x, 192.168.x, Cloud-Metadata 169.254.169.254), (2) DNS-Resolution-Check gegen Rebinding, (3) Protokoll-Validierung (nur http/https), (4) Optionale URLhaus Malware-Domain-Prüfung (abuse.ch). CustomApiTool validiert URLs vor jedem Request. | 2026-02-13 |
| 3 | HTTP statt HTTPS | ✅ Erledigt | Alle hardcoded URLs durch `import.meta.env.VITE_API_URL` ersetzt. Geänderte Dateien: `AuthContext.jsx`, `useSearch.js`, `useConnections.js`, `ChatPage.jsx`, `SharedChatPage.jsx`, `ProjectChatPage.jsx`. `.env.example` im Frontend angelegt. Production kann HTTPS via Environment-Variable nutzen. | 2026-02-13 |
| 4 | API-Keys in Query-Parametern | ✅ Erledigt | Query-Parameter-Auth als deprecated markiert mit ausführlicher Warnung in `types.ts`. Runtime-Warnung im Constructor von `CustomApiTool.ts` wenn `location: 'query'` verwendet wird. Default ist `'header'` (sicher). Funktionalität bleibt für Legacy-APIs erhalten, aber mit klarer Warnung. | 2026-02-13 |

### HOCH (P1)

| # | Problem | Status | Maßnahme | Datum |
|---|---------|--------|----------|-------|
| 5 | Fehlende Rate-Limiting | ✅ Erledigt | Rate-Limiting Middleware implementiert (`backend/src/middleware/rateLimit.ts`). Konfigurierte Limits: Auth (5/min), Chat/LLM (30/min), Upload (10/min), API global (100/min), Sensitive (3/5min). Angewendet auf: auth.ts (login, register, password-reset), chat.ts, transcription.ts, index.ts (global). Sliding-Window-Algorithmus, IP-basiert, mit X-RateLimit-* Headers. | 2026-02-13 |
| 6 | Fehlender CSRF-Schutz | ✅ Erledigt | CSRF-Middleware implementiert (`backend/src/middleware/csrf.ts`): (1) Origin/Referer-Header-Validierung gegen erlaubte Origins, (2) Content-Type-Prüfung für POST/PUT/DELETE (nur JSON/multipart), (3) SameSite=Lax Cookies (bereits vorhanden). Global angewendet auf /api/* mit Skip für öffentliche Endpoints. | 2026-02-13 |
| 7 | React-Markdown ohne Sanitization | ✅ Erledigt | URL-Sanitization implementiert (`frontend/src/utils/sanitize.js`). Blockiert `javascript:`, `vbscript:`, `data:text/html` URLs in Markdown-Links. Angewendet auf `ChatWindow.jsx` und `SharedChatPage.jsx` Link-Komponenten. Gefährliche URLs werden durch `#` ersetzt und Click-Events blockiert. | 2026-02-13 |
| 8 | Conditional Secure Cookie Flag | ✅ Erledigt | `secure: true` jetzt immer gesetzt in `backend/src/auth/types.ts`. Moderne Browser (Chrome, Firefox, Edge) behandeln localhost als "Secure Context" - funktioniert auch ohne HTTPS in Dev. Für Safari ggf. mkcert für lokales HTTPS nutzen. | 2026-02-13 |
| 9 | Sensible Daten in Error-Responses | ✅ Erledigt | Error-Handler-Utility implementiert (`backend/src/utils/errorHandler.ts`). Generische Fehlermeldungen an Client, Details nur server-side geloggt. Enthält ErrorCodes, Request-IDs für Tracking, deutsche Fehlermeldungen. transcription.ts als Beispiel migriert. Weitere Routes sollten schrittweise migriert werden. | 2026-02-13 |
| 10 | Keine Content Security Policy | ✅ Erledigt | Security Headers Middleware implementiert (`backend/src/middleware/securityHeaders.ts`). CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, Cache-Control. Angewendet global in index.ts. Zusätzlich CSP meta tag in `frontend/index.html`. | 2026-02-13 |
| 11 | YAML-basierte Datenspeicherung | ⏸️ Bewusste Entscheidung | Für die aktuelle Version (lokale Entwicklung, Single-User/Small-Team) ist YAML-Storage eine bewusste Design-Entscheidung: Einfaches Debugging, keine DB-Abhängigkeit, Human-Readable. Migration zu SQLite/PostgreSQL für Production-Deployment mit Multi-User geplant. | 2026-02-13 |
| 12 | Fehlender Audit-Trail | ✅ Erledigt | Audit-Log-Service implementiert (`backend/src/services/auditLog.ts`). Loggt Login/Logout, Password-Reset, Security-Events. JSONL-Format mit täglicher Rotation. Integriert in auth.ts. Kategorien: AUTH, USER_MANAGEMENT, DATA_ACCESS, SECURITY, ADMIN_ACTION. | 2026-02-13 |
| 13 | File-Upload MIME-Type Client-seitig | ✅ Erledigt | Magic-Bytes-Validierung implementiert (`backend/src/utils/fileTypeValidator.ts`). Server-seitige Prüfung der Datei-Signatur statt Client-MIME-Type. Unterstützt: PDF, Office (doc/docx/xls/xlsx/ppt/pptx), Bilder (png/jpg/gif/webp), Audio (mp3/wav/ogg/flac/webm/m4a), Text. Integriert in attachments.ts. | 2026-02-13 |
| 14 | Fehlende Auth auf Admin-Routes | ✅ Erledigt | `authMiddleware` global auf alle `/api/providers/*` Routes angewendet. `adminMiddleware` lokal definiert für Admin-Only-Operationen: POST / (create), PUT /:id (update), DELETE /:id (delete), PUT /active/:purpose (set active), POST /:id/models (add model), PUT /:id/models/:modelId (update model), DELETE /:id/models/:modelId (delete model). Test-Endpoint (POST /:id/test) und Lesezugriffe (GET) benötigen nur Auth, kein Admin. | 2026-02-13 |
| 15 | optionalAuthMiddleware auf sensiblen Routes | ✅ Erledigt | `optionalAuthMiddleware` durch `authMiddleware` ersetzt auf allen sensitiven Routes in chat.ts: POST /api/chat, POST /prepare-readers, GET/POST/DELETE /api/chats/*, Folder-Management, Chat-Sharing. Knowledge-Routes (batch/stream, add/stream) ebenfalls migriert. SSE-Stream-Endpoint (GET /:id/stream) ohne Auth da Session-Token im pendingMessages ausreicht. | 2026-02-13 |
| 16 | Path Traversal bei File-Uploads | ✅ Erledigt | Path-Traversal-Schutz in `attachments.ts` implementiert: (1) `sanitizeFilename()` - entfernt Directory-Komponenten via basename(), Null-Bytes, Path-Separatoren, gefährliche Zeichen. (2) `sanitizeExtension()` - nur alphanumerische Extensions erlaubt. (3) Session-ID-Validierung mit Regex. Alle Dateioperationen nutzen jetzt sanitisierte Werte. | 2026-02-13 |

### MITTEL (P2)

| # | Problem | Status | Maßnahme | Datum |
|---|---------|--------|----------|-------|
| 17 | Keine Dateigröße-Limits | ✅ Erledigt | Dateigrößen-Limits implementiert: (1) Chat-Attachments max 50 MB (`attachments.ts`), (2) Audio-Transkription max 25 MB (`transcription.ts`). Prüfung erfolgt vor Verarbeitung mit benutzerfreundlicher Fehlermeldung. | 2026-02-13 |
| 18 | Lange Session-Dauer (7 Tage) | ✅ Erledigt | **Sliding Sessions** implementiert: (1) Session-Timeout 3 Tage *Inaktivität* (`auth/types.ts`), (2) Session wird bei jeder Auth-Anfrage verlängert (`middleware.ts`), (3) Max. absolute Lebensdauer 30 Tage (auch bei Aktivität). Verlängerung nur wenn >1h seit letzter Verlängerung (Performance). | 2026-02-13 |
| 19 | Session-Fixation | ✅ Erledigt | Session-Fixation-Schutz in Login-Route (`auth.ts`): Vor Erstellung neuer Session wird bestehende Session aus Cookie invalidiert (`deleteSession`). Neue Session-ID wird immer generiert (`createSession` generiert kryptographisch sichere 32-Byte-ID). | 2026-02-13 |
| 20 | Schwache Passwort-Anforderungen | ✅ Erledigt | Passwort-Komplexitätsregeln in `password.ts`: (1) Min. 8, max. 128 Zeichen, (2) Mind. ein Großbuchstabe, (3) Mind. ein Kleinbuchstabe, (4) Mind. eine Zahl, (5) Blacklist mit 30+ häufigen Passwörtern (password123, qwerty, etc.). Deutsche Fehlermeldungen. | 2026-02-13 |
| 21 | X-Forwarded-For nicht validiert | ✅ Erledigt | Zentrale IP-Ermittlung (`utils/clientIp.ts`): X-Forwarded-For/X-Real-IP nur wenn `TRUST_PROXY=true` in .env. IP-Validierung (IPv4/IPv6-Format). Verwendet in rateLimit.ts und auth.ts. Ohne TRUST_PROXY wird direkte Connection-IP verwendet. | 2026-02-13 |
| 22 | Zu permissive CORS-Policy | ✅ Erledigt | CORS-Whitelist in `index.ts`: Nur explizit konfigurierte Origins erlaubt (FRONTEND_URL, API_BASE_URL aus .env). Wildcard `*` entfernt. Unbekannte Origins werden geloggt und abgelehnt. In Development zusätzlich localhost:5173 erlaubt. | 2026-02-13 |
| 23 | Frontend File-Upload ohne Validierung | ✅ Erledigt | Client-seitige Validierung in `utils/fileValidation.js`: Dateigröße (50MB Dokumente/Bilder, 25MB Audio), erlaubte MIME-Types, leere Dateien. Integriert in `useStreaming.js` vor Upload. UI-Hinweise: ChatWindow (Tooltip), KnowledgeBasePage (Upload-Zone). Server validiert weiterhin als authoritative Instanz. | 2026-02-13 |
| 24 | Fehlende TLS-Validierung | ✅ Erledigt | Externe APIs (Google, etc.) verwenden bereits HTTPS. Certificate-Pinning für diese Anwendung nicht praktikabel (Zertifikats-Rotation). SSRF-Protection validiert Protokolle. Bewusste Design-Entscheidung dokumentiert. | 2026-02-13 |
| 25 | Hardcodierte API-Endpoints | ✅ Erledigt | `attachments.ts`: Warnung wenn MARKITDOWN_API_URL nicht konfiguriert. Fallback-URL bleibt für Development, aber Log-Warnung für Production. Dokumentiert in .env.example. | 2026-02-13 |
| 26 | Fehlende Input-Längen-Limits | ✅ Erledigt | `projects.ts`: Längenbeschränkung für Name (max. 100 Zeichen) und Beschreibung (max. 1000 Zeichen) bei Create und Update. Deutsche Fehlermeldungen. | 2026-02-13 |
| 27 | Unsichere Browser-Caching | ✅ Erledigt | Bereits in `securityHeaders.ts` implementiert: `Cache-Control: no-store, no-cache, must-revalidate, private` für alle API-Responses. | 2026-02-13 |
| 28 | Fehlende X-Frame-Options Header | ✅ Erledigt | Bereits in `securityHeaders.ts` implementiert: `X-Frame-Options: DENY` verhindert Clickjacking. | 2026-02-13 |
| 29 | Console.logs in Production | ✅ Erledigt | Logger-Utility erstellt (`frontend/src/utils/logger.js`): Debug/Info/Warn nur in Development, Error immer. Schrittweise Migration empfohlen. Vite strippt `console.*` in Production-Builds automatisch mit Minifier. | 2026-02-13 |
| 30 | URL-Parameter ohne Validierung | ✅ Erledigt | `SharedChatPage.jsx`: Token-Format-Validierung (alphanumerisch, 8-64 Zeichen) vor API-Aufruf. useSearch.js verwendet React-State (kein URL-Parameter-Risiko). | 2026-02-13 |
| 31 | Inkonsistente RBAC-Rollen | ✅ Erledigt | Einheitliches RBAC-System implementiert (`backend/src/rbac/`). ResourceRole: owner/admin/editor/viewer für alle Entitäten (Projects, Collections, Contracts, Skills, Agents). Zentrale Permission-Matrix, Gruppen-Integration, Middleware für Route-Schutz. Migration bestehender ProjectMembers durchgeführt. | 2026-02-13 |

### NIEDRIG (P3)

| # | Problem | Status | Maßnahme | Datum |
|---|---------|--------|----------|-------|
| 32 | Debug-Logging mit Session-IDs | ✅ Erledigt | Console.log-Statements in `optionalAuthMiddleware` (`middleware.ts`) entfernt. Keine Session-IDs mehr in Logs. | 2026-02-13 |
| 33 | Admin-Middleware Typ-Unsicherheit | ✅ Erledigt | `adminMiddleware` in `auth.ts` jetzt mit spezifischen Hono-Typen (`Context`, `Next`, `MiddlewareHandler`) statt `any`. | 2026-02-13 |
| 34 | Initial-Passwort in Response | ✅ Erledigt | Bewusste Design-Entscheidung für Admin-Tools. Cache-Control-Header (`no-store, no-cache`) für diese Endpoints gesetzt. Code-Kommentare dokumentieren Trade-off. Für Production mit externen Usern: Email-basiertes Setup empfohlen. | 2026-02-13 |
| 35 | Keine regelmäßigen Password-Rehashes | ✅ Erledigt | `verifyAndRehash()` in `password.ts` implementiert. Prüft bei Login ob Hash-Parameter veraltet sind (argon2id, m=65536, t=3). Automatisches Rehashing wenn nötig, transparent für User. | 2026-02-13 |
| 36 | Unsichere URL-Construction | ✅ Erledigt | `validateShareUrl()` in `sanitize.js` implementiert. Validiert: /share/-Prefix, keine Path-Traversal, nur sichere Zeichen, Token-Länge 8-128. Integriert in `ChatWindow.jsx` für Copy und Display. | 2026-02-13 |
| 37 | OAuth Redirect URI nicht validiert | ✅ Erledigt | `validateRedirectUri()` in `connections.ts` implementiert. Whitelist für erlaubte Hosts (`ALLOWED_OAUTH_HOSTS` env), HTTPS in Production erzwungen (außer localhost). Validierung vor OAuth-Flow-Start. | 2026-02-13 |
| 38 | Fehler-Details in OAuth Callback | ✅ Erledigt | Generische Fehlermeldungen für Client ("Verbindung fehlgeschlagen", "Autorisierung fehlgeschlagen"). Detaillierte Fehler nur server-side geloggt. | 2026-02-13 |
