---
name: api-audit
description: Prüfe die Konsistenz zwischen Frontend API-Calls und Backend-Endpoints.
argument-hint: "[orphaned-backend|orphaned-frontend|summary]"
---

# API-Audit

Prüfe die Konsistenz zwischen Frontend API-Calls und Backend-Endpoints.

## Argument: $ARGUMENTS (optional)

Standard: vollständiger Audit. Optionen: `orphaned-backend`, `orphaned-frontend`, `summary`

## Vorgehen

### Schritt 1: Backend-Endpoints inventarisieren

Lies `backend/src/index.ts` um alle gemounteten Route-Prefixe zu finden (`app.route('/api/...', ...)`).

Dann für jede Route-Datei in `backend/src/routes/*.ts`:

1. Extrahiere alle Endpoint-Definitionen: HTTP-Methode + Pfad
2. Notiere Parameter (`:id`, `:slug` etc.)
3. Notiere ob der Endpoint Auth erfordert (authMiddleware/optionalAuthMiddleware)

**Format:**
```
| Route-Datei | Methode | Pfad | Parameter | Auth |
|-------------|---------|------|-----------|------|
| chat.ts     | GET     | /api/chats | — | auth |
| chat.ts     | GET     | /api/chats/:id | id | auth |
```

### Schritt 2: Frontend API-Calls inventarisieren

Durchsuche alle Frontend-Dateien (`frontend/src/**/*.{js,jsx}`) nach:

1. `apiGet('...')` / `apiPost('...')` / `apiPut('...')` / `apiDelete('...')` / `apiPostForm('...')`
2. Extrahiere die URL und HTTP-Methode
3. Notiere die aufrufende Datei (Hook/Page/Component)
4. Ersetze Template-Variablen (`${id}`) durch Platzhalter (`:id`)

**Format:**
```
| Frontend-Datei | Methode | URL | Aufrufer |
|----------------|---------|-----|----------|
| useChats.js    | GET     | /api/chats | loadChats() |
| useChats.js    | GET     | /api/chats/:id | loadChat() |
```

### Schritt 3: Mapping erstellen

Matche Frontend-Calls mit Backend-Endpoints:

1. Normalisiere URLs (entferne Query-Parameter, ersetze IDs durch `:param`)
2. Matche nach Methode + Pfad-Pattern
3. Kategorisiere:
   - **Gematchte Paare** — Frontend-Call hat passendes Backend-Endpoint
   - **Verwaiste Backend-Endpoints** — Endpoint existiert, aber kein Frontend-Call gefunden
   - **Verwaiste Frontend-Calls** — API-Call im Frontend, aber kein passendes Backend-Endpoint

### Schritt 4: Analyse verwaister Endpoints

Für **verwaiste Backend-Endpoints**:
- Prüfe ob sie nur intern genutzt werden (von anderen Backend-Services, MCP, Agents)
- Prüfe ob sie zu einem Feature gehören das noch in Entwicklung ist
- Markiere als `intern`, `unused` oder `in-progress`

Für **verwaiste Frontend-Calls**:
- Prüfe ob die URL korrekt ist (Tippfehler?)
- Prüfe ob das Backend-Endpoint unter einem anderen Pfad existiert
- Markiere als `fehlendes-endpoint`, `tippfehler` oder `deprecated`

### Schritt 5: Zusammenfassung

```
## API-Audit Ergebnis

### Übersicht
- Backend-Endpoints gesamt: X
- Frontend API-Calls gesamt: X
- Gematchte Paare: X
- Verwaiste Backend-Endpoints: X
- Verwaiste Frontend-Calls: X

### Verwaiste Backend-Endpoints (kein Frontend-Call)
| Methode | Pfad | Route-Datei | Bewertung |
|---------|------|-------------|-----------|

### Verwaiste Frontend-Calls (kein Backend-Endpoint)
| Methode | URL | Frontend-Datei | Bewertung |
|---------|-----|----------------|-----------|

### Empfehlungen
1. ...
```

## Wichtig

- **Nur lesen, nicht ändern** — der Audit ist read-only
- Beachte dass manche Endpoints nur von MCP-Clients, Agents oder dem Backend selbst aufgerufen werden — das sind keine echten Waisen
- Template-Literals in Frontend-URLs korrekt normalisieren: `/api/chats/${chatId}` → `/api/chats/:chatId`
- Bei `$ARGUMENTS` = `orphaned-backend` nur verwaiste Backend-Endpoints zeigen
- Bei `$ARGUMENTS` = `orphaned-frontend` nur verwaiste Frontend-Calls zeigen
- Bei `$ARGUMENTS` = `summary` nur die Übersicht ohne Details
