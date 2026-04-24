# Public-API-Framework für Apps — Etappe 1

**Datum:** 2026-04-24
**Branch:** demo/messe
**Status:** Framework + erste Public-Function (`wzbar-matcher:classify`) live und E2E-verifiziert.

## Kontext

Apps im Workplace (wzbar-matcher, Vertragsmanagement, etc.) hatten bisher nur interne, session-gebundene REST-Routes. Für externe Integrationen (z.B. EMMA-Anbindung der IHK) fehlte ein einheitlicher, authentifizierter Weg.

Ziel dieses Frameworks: Jede App kann **deklarativ** Funktionen als Public-API freigeben; Auth, Rate-Limit, Input-Validation, Discovery und Audit kommen zentral. Später (Etappe 2) wird derselbe Function-Contract auch automatisch als Agent-Tool nutzbar sein.

## Entscheidungen

1. **Endpoint-Pfad**: `POST /api/public/v1/:appId/:functionId` (versioniert ab Tag 1).
2. **Auth**: `Authorization: Bearer <raw-key>`. Keys werden argon2id-gehasht persistiert; Raw-Wert wird nur einmal beim Anlegen ausgegeben.
3. **Scope-Modelle**: `service` / `org` / `user` — alle drei technisch gleichwertig; `service` ist der Default für Maschinenzugriffe.
4. **Permissions**: Strings der Form `app:<id>:<functionId>` mit Wildcards (`app:wzbar-matcher:*`, `app:*:*`).
5. **Rate-Limit**: pro Key, Konfiguration im Key-YAML (`requests`/`windowSec`). Bucket pro Key+Function kombiniert.
6. **Discovery**: `GET /api/public/v1/` — geschützt und scope-gefiltert. Integrator sieht nur, was er aufrufen darf. Nicht-auth'd Endpoint: nur `/health`.
7. **Sync JSON** für MVP — keine Webhooks/Callbacks.
8. **Audit**: append-only JSONL; kein Request/Response-Body (DSGVO-schonend).

## Architektur

```
Client (EMMA / Skript)
  │  Authorization: Bearer apk_<prefix>.<secret>
  ▼
POST /api/public/v1/wzbar-matcher/classify
  │
  │  Middleware-Stack:
  │    1. apiKeyAuth          — verifiziert Raw-Key → c.set('apiKey', ...)
  │    2. scopeCheck           — prüft permissions gegen app:appId:functionId
  │    3. apiKeyRateLimit      — per-key sliding window, Limits aus Key-YAML
  │    4. requestValidator     — JSON-Schema gegen Function.input
  │    5. Handler              — func.handler(input, ctx)
  │    6. writeAudit           — JSONL-Append
  │
  ▼
{ result: { primary: {...}, alternatives: [...] } }
```

## Datenmodell

### API-Key (`data/auth/api-keys/<id>.yaml`, gitignored)

```yaml
id: apk_eIYry09HBxx
label: "EMMA IHK-Integration"
hashedKey: $argon2id$...
prefix: Ay0ea1M                     # für O(1) lookup
scope:
  type: service
  serviceName: emma
permissions:
  - "app:wzbar-matcher:classify"
rateLimit:
  requests: 60
  windowSec: 60
createdAt: ...
createdBy: ...
lastUsedAt: null                    # debounced updates (1×/min/Key max)
expiresAt: null
isActive: true
revokedAt: null
```

**Raw-Key-Format:** `apk_<prefix8>.<secret22>` — der Prefix erlaubt O(1)-Lookup ohne alle Files zu lesen; der Secret-Teil wird via argon2id mit dem Prefix kombiniert gehasht.

### PublicFunction (in AppConfig)

```typescript
interface PublicFunction<TIn, TOut> {
  id: string;
  description: string;
  input: JsonSchema;
  output?: JsonSchema;
  defaultRateLimit?: { requests: number; windowSec: number };
  handler: (input: TIn, ctx: PublicFunctionContext) => Promise<TOut>;
}
```

`handler` ist bewusst eine Funktion (kein Route-Pfad) — damit kann in Etappe 2 dieselbe Function ohne HTTP-Umweg auch als Agent-Tool aufgerufen werden.

## Neue / geänderte Dateien

### Neu

- `backend/src/public-api/types.ts` — ApiKey, PublicFunction, JsonSchema, AuditEntry
- `backend/src/public-api/validator.ts` — minimaler JSON-Schema-Validator + `scopeMatches()`
- `backend/src/public-api/keys/storage.ts` — YAML-IO + prefix-Index mit mtime-invalidation (sync mit CLI-Prozessen)
- `backend/src/public-api/keys/service.ts` — createKey, verifyRawKey, revokeKey, touchLastUsed (debounced)
- `backend/src/public-api/middleware.ts` — apiKeyAuth + apiKeyRateLimit
- `backend/src/public-api/audit.ts` — JSONL-Append pro Monat
- `backend/src/public-api/router.ts` — Hono-Router (Health, Discovery, Dispatch)
- `backend/src/apps/wzbar-matcher/public-functions.ts` — classifyPublicFunction
- `scripts/api-keys.ts` — CLI (create, list, show, revoke)

### Geändert

- `backend/src/apps/types.ts` — AppConfig um optionales `publicFunctions` erweitert
- `backend/src/apps/wzbar-matcher/index.ts` — Function registriert
- `backend/src/index.ts` — Router gemountet unter `/api/public/v1`; CSRF skipPath für `/api/public/` ergänzt
- `.gitignore` — `data/auth/api-keys/`, `data/audit/api-public/`

### Wiederverwendet

- `hashPassword`, `verifyPassword` aus `backend/src/auth/password.ts` (Argon2id, memoryCost=65536, timeCost=3)
- YAML-IO-Muster aus `backend/src/auth/storage.ts`
- `getApps()` aus `backend/src/apps/registry.ts` (Function-Auflösung)
- `match()` aus `backend/src/apps/wzbar-matcher/service.ts` (Handler-Implementation)

## Fehler-Format

Alle Fehler-Antworten haben die Form:

```json
{ "error": "menschlich lesbare Nachricht", "code": "machine_code", "details?": [...] }
```

Mit `code` aus: `unauthorized` (401), `scope_denied` (403), `not_found` (404), `validation_failed` (400), `rate_limited` (429), `internal_error` (500).

## Verifikation

Backend gestartet, alle Pfade getestet:

| Test | Erwartung | Ergebnis |
|---|---|---|
| `GET /health` | 200, `{status:"ok"}` | ✅ |
| `GET /` ohne Key | 401 | ✅ |
| `GET /` mit Key (scope: `app:wzbar-matcher:*`) | 200, wzbar-matcher + classify mit Schema | ✅ |
| `GET /` mit Key (scope: `app:other:*`) | 200, `apps: []` | ✅ |
| `POST .../classify` mit falschem Key | 401 `unauthorized` | ✅ |
| `POST .../classify` ohne Auth-Header | 401 | ✅ |
| `POST .../classify` mit `{}` | 400 `validation_failed`, `details: [{path:"text", message:"is required"}]` | ✅ |
| `POST .../classify` mit invalid JSON | 400 `validation_failed` | ✅ |
| `POST .../nope` | 404 `not_found` | ✅ |
| `POST .../classify` mit Key ohne passender Permission | 403 `scope_denied` | ✅ |
| `POST .../classify` mit `{"text":"Gebäudereinigung allgemein"}` | 200, primary=8121 (95% Konfidenz) + Alternativen | ✅ |
| Response-Header `X-RateLimit-Limit/Remaining/Reset` | gesetzt | ✅ |
| CLI `revoke <id>` → sofort 401 bei folgendem Call | Invalidation sofort | ✅ |
| Audit-Log `data/audit/api-public/2026-04.jsonl` | jede Anfrage mit Status/Dauer persistiert | ✅ |

Beispiel-Request (EMMA-Integration):

```sh
curl -X POST https://<host>/api/public/v1/wzbar-matcher/classify \
  -H "Authorization: Bearer apk_eIYry09HBxx.SG6cwRRgAJa8F0n41rk91A" \
  -H "Content-Type: application/json" \
  -d '{"text":"Allgemeine Putz- und Reinigungsleistungen im Haushalt"}'
```

## Sicherheits-Überlegungen

- **Timing-Attack-Resistance**: Die Verify-Funktion läuft immer durch den Argon2id-Vergleich. Prefix-Lookup via Map (O(1)), aber vollständiger Hash-Vergleich nur bei gefundenem Prefix. Für Non-Existent-Prefixes fällt früh ab — das ist ein minimaler Timing-Unterschied, aber ohne Zugriff auf den Secret-Anteil nicht ausbeutbar.
- **CSRF**: `/api/public/` steht explizit in den `skipPaths` der globalen CSRF-Middleware. Der Bearer-Token-Flow ist gegen CSRF immun (Cookies werden nicht mitgeschickt).
- **Rate-Limit-Bypass**: Bucket-Key ist `keyId:appId:functionId`. Auch wenn mehrere IPs denselben Key benutzen, greift das Limit. IP-basierter Fallback existiert nicht — Keys sind die authoritative Einheit.
- **Revocation**: Der mtime-basierte Prefix-Index wird bei jedem Key-File-Write aktualisiert (inkl. `revokeKey()`). Backend erkennt revoked Keys innerhalb eines Requests.

## Aufrufe

```sh
# Key erstellen (MUSS nur einmal gemacht werden; Raw-Key sichern!)
bun run scripts/api-keys.ts create \
  --label "EMMA Integration" \
  --scope service --service-name emma \
  --permissions "app:wzbar-matcher:classify" \
  --rate 60/60

# Auflisten
bun run scripts/api-keys.ts list

# Widerrufen
bun run scripts/api-keys.ts revoke <id>

# Backend starten
/Users/andreasbachmann/.bun/bin/bun run --watch src/index.ts   # aus backend/
```

## Out-of-Scope (Etappe 2)

- UI in Einstellungen → "API-Keys" zum Anlegen/Widerrufen
- Automatische Agent-Tool-Registrierung für jede `publicFunction`
- OpenAPI-Export (Spec + Swagger-UI)
- Async-Functions via Webhook-Callback
- Per-Function-Quotas auf Tages-/Monats-Ebene
- Body-Size-Limits per Function
