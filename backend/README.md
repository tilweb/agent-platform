# Backend - Agent Platform

## System-Anforderungen

| Abhängigkeit | Version | Zweck |
|--------------|---------|-------|
| [Bun](https://bun.sh) | ≥ 1.0 | JavaScript Runtime |
| [ffmpeg](https://ffmpeg.org) | ≥ 5.0 | Audio-Konvertierung für Transkription |

### Installation der Abhängigkeiten

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt install ffmpeg
```

**Windows:**
```bash
winget install ffmpeg
# oder: choco install ffmpeg
```

## Installation

```bash
bun install
```

## Starten

```bash
bun run index.ts
```

---

## SSRF-Schutz (Custom API Tools)

Custom API Tools ermöglichen es Nutzern, beliebige externe APIs anzubinden. Um Server-Side Request Forgery (SSRF) zu verhindern, werden alle URLs vor der Ausführung validiert.

### Blockierte IP-Bereiche

Folgende IP-Bereiche werden automatisch blockiert:

| Bereich | Beschreibung |
|---------|--------------|
| `127.0.0.0/8` | Localhost |
| `10.0.0.0/8` | Private Class A |
| `172.16.0.0/12` | Private Class B |
| `192.168.0.0/16` | Private Class C |
| `169.254.0.0/16` | Link-Local (inkl. Cloud Metadata) |
| `0.0.0.0/8` | Current Network |
| `100.64.0.0/10` | Carrier-grade NAT |
| `224.0.0.0/4` | Multicast |
| `240.0.0.0/4` | Reserved |

### Blockierte Hosts

| Host | Grund |
|------|-------|
| `169.254.169.254` | AWS/GCP/Azure Metadata Service |
| `169.254.170.2` | AWS ECS Metadata |
| `fd00:ec2::254` | AWS Metadata (IPv6) |
| `localhost` | Loopback |
| `metadata.google.internal` | GCP Metadata |
| `kubernetes.default.svc` | Kubernetes API |

### Zusätzliche Schutzmaßnahmen

- **DNS-Resolution-Check:** Hostname wird aufgelöst und die resultierende IP gegen die Blocklist geprüft (verhindert DNS-Rebinding)
- **Protokoll-Validierung:** Nur `http://` und `https://` erlaubt
- **Optionale Malware-Domain-Prüfung:** Integration mit URLhaus (abuse.ch)

### Konfiguration (.env)

```bash
# URLhaus Malware-Domain-Check aktivieren (macht externe API-Anfrage)
SSRF_CHECK_MALWARE=false

# Localhost in Development erlauben (NICHT für Production!)
SSRF_ALLOW_LOCALHOST=false
```

### Beispiele

**Erlaubt:**
- `https://api.example.com/v1/data`
- `https://jsonplaceholder.typicode.com/posts`

**Blockiert:**
- `http://localhost:8080/admin` → Localhost blockiert
- `http://169.254.169.254/latest/meta-data/` → Cloud Metadata blockiert
- `http://10.0.0.1/internal-api` → Private Network blockiert
- `ftp://example.com/file` → Protokoll nicht erlaubt

### Quellcode

- Implementierung: `src/utils/ssrfProtection.ts`
- Integration: `src/tools/custom/CustomApiTool.ts`

---

## Rate Limiting

Schutz gegen Brute-Force-Angriffe und DoS durch IP-basiertes Rate Limiting mit Sliding-Window-Algorithmus.

### Konfigurierte Limits

| Route | Limit | Fenster | Beschreibung |
|-------|-------|---------|--------------|
| `/api/auth/login` | 5 | 1 min | Schutz gegen Brute-Force |
| `/api/auth/register` | 5 | 1 min | Spam-Schutz |
| `/api/auth/*/reset-password` | 3 | 5 min | Sensitive Operation |
| `/api/chat` | 30 | 1 min | LLM-Token-Schutz |
| `/api/transcribe` | 10 | 1 min | Upload/Whisper-Schutz |
| `/api/*` (global) | 100 | 1 min | Fallback für alle APIs |

### Response Headers

Bei jedem Request werden folgende Header gesetzt:

```
X-RateLimit-Limit: 100        # Maximum Requests im Fenster
X-RateLimit-Remaining: 95     # Verbleibende Requests
X-RateLimit-Reset: 45         # Sekunden bis Reset
```

### Rate Limit überschritten (HTTP 429)

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Try again in 45 seconds.",
  "retryAfter": 45
}
```

### Quellcode

- Implementierung: `src/middleware/rateLimit.ts`
- Anwendung: `src/routes/auth.ts`, `src/routes/chat.ts`, `src/routes/transcription.ts`, `src/index.ts`

---

## CSRF-Schutz

Schutz gegen Cross-Site Request Forgery durch mehrschichtige Validierung.

### Schutzmechanismen

1. **Origin-Header-Validierung**
   - Prüft `Origin`-Header gegen erlaubte Origins
   - Fallback auf `Referer`-Header wenn kein Origin vorhanden

2. **Content-Type-Validierung**
   - POST/PUT/PATCH nur mit `application/json` oder `multipart/form-data`
   - Verhindert einfache Form-Submissions von fremden Sites

3. **SameSite Cookies**
   - Session-Cookie mit `SameSite=Lax`
   - Verhindert Cookie-Übertragung bei Cross-Site POST-Requests

### Erlaubte Origins

| Umgebung | Origins |
|----------|---------|
| Development | `localhost:*`, `127.0.0.1:*` |
| Production | `FRONTEND_URL`, `API_BASE_URL` aus .env |

### Übersprungene Pfade

- `/api/shared/*` - Öffentlicher Zugriff auf geteilte Chats

### Fehler-Response (HTTP 403)

```json
{
  "error": "Forbidden",
  "message": "Invalid origin"
}
```

### Quellcode

- Implementierung: `src/middleware/csrf.ts`
- Anwendung: `src/index.ts` (global für `/api/*`)

---

## Error Handling

Sichere Fehlerbehandlung ohne Preisgabe interner Details.

### Prinzip

- **Client:** Erhält generische, benutzerfreundliche Fehlermeldung
- **Server:** Loggt vollständige Details inkl. Stack-Trace

### Error Response Format

```json
{
  "error": "Ein interner Fehler ist aufgetreten",
  "code": "INTERNAL_ERROR",
  "requestId": "m5x2k7-a3b9f2"
}
```

### Error Codes

| Code | HTTP Status | Beschreibung |
|------|-------------|--------------|
| `INTERNAL_ERROR` | 500 | Interner Serverfehler |
| `VALIDATION_ERROR` | 400 | Ungültige Eingabedaten |
| `NOT_FOUND` | 404 | Ressource nicht gefunden |
| `UNAUTHORIZED` | 401 | Nicht authentifiziert |
| `FORBIDDEN` | 403 | Zugriff verweigert |
| `RATE_LIMITED` | 429 | Zu viele Anfragen |
| `SERVICE_UNAVAILABLE` | 503 | Service nicht verfügbar |
| `EXTERNAL_SERVICE_ERROR` | 502 | Externer Service-Fehler |

### Verwendung

```typescript
import { internalError, validationError, serviceError } from '../utils/errorHandler';

// Validation error
return validationError(c, 'Ungültige E-Mail-Adresse');

// External service error
return serviceError(c, error, 'Whisper API');

// Internal error with context
return internalError(c, error, { operation: 'transcription' });
```

### Debug-Modus

In Development mit `DEBUG_ERRORS=true` werden zusätzliche Details zurückgegeben:

```json
{
  "error": "Ein interner Fehler ist aufgetreten",
  "code": "INTERNAL_ERROR",
  "requestId": "m5x2k7-a3b9f2",
  "debug": {
    "originalMessage": "Connection refused",
    "context": { "operation": "transcription" }
  }
}
```

### Quellcode

- Implementierung: `src/utils/errorHandler.ts`

---

## Security Headers

Automatisch gesetzte Sicherheits-Header für alle Responses.

### Gesetzte Header

| Header | Wert | Zweck |
|--------|------|-------|
| `Content-Security-Policy` | (siehe unten) | XSS-Schutz, Resource-Loading |
| `X-Frame-Options` | `DENY` | Clickjacking-Schutz |
| `X-Content-Type-Options` | `nosniff` | MIME-Sniffing verhindern |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS-Filter |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Referrer-Kontrolle |
| `Permissions-Policy` | `geolocation=(), microphone=(self)` | Browser-Features |
| `Cache-Control` | `no-store` (für /api/*) | Kein Caching sensibler Daten |

### Content-Security-Policy

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
connect-src 'self' https://api.adacor.ai;
object-src 'none';
frame-ancestors 'none';
```

### Konfiguration

```typescript
app.use('*', securityHeaders({
  connectSrc: ['https://api.adacor.ai'],  // Zusätzliche API-Endpoints
  allowInlineStyles: true,                 // Für React Inline-Styles
  reportOnly: false,                       // true für Test ohne Blocking
}));
```

### Quellcode

- Implementierung: `src/middleware/securityHeaders.ts`
- Anwendung: `src/index.ts`

---

## Audit Logging

Strukturiertes Logging sicherheitsrelevanter Aktionen für Compliance und Incident-Analyse.

### Log-Speicherort

```
data/audit/audit_YYYY-MM-DD.jsonl
```

Tägliche Rotation, JSONL-Format (eine JSON-Zeile pro Event).

### Event-Kategorien

| Kategorie | Beschreibung |
|-----------|--------------|
| `auth` | Login, Logout, Session-Events |
| `user_management` | User erstellen, löschen, Passwort ändern |
| `data_access` | Zugriff auf Chats, Knowledge, Connections |
| `admin_action` | Provider-Konfiguration, Settings |
| `security` | Rate-Limit, CSRF-Block, SSRF-Block |

### Log-Format

```json
{
  "id": "audit_m5x2k7_a3b9f2",
  "timestamp": "2026-02-13T14:30:00.000Z",
  "category": "auth",
  "action": "login_success",
  "userId": "user_123",
  "username": "admin",
  "ipAddress": "192.168.1.100",
  "success": true
}
```

### Verwendung

```typescript
import { auditLogin, auditSecurityEvent, AuditAction } from '../services/auditLog';

// Login audit
await auditLogin(true, 'username', ipAddress, userAgent);

// Security event
await auditSecurityEvent(AuditAction.RATE_LIMIT_EXCEEDED, ipAddress, { path: '/api/chat' });
```

### Logs abfragen

```typescript
import { searchAuditLogs, AuditCategory } from '../services/auditLog';

const logs = await searchAuditLogs({
  category: AuditCategory.AUTH,
  startDate: '2026-02-01',
  endDate: '2026-02-13',
});
```

### Quellcode

- Implementierung: `src/services/auditLog.ts`
- Integration: `src/routes/auth.ts`

---

This project was created using `bun init` in bun v1.3.7. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
