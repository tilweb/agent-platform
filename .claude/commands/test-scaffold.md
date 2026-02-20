# Test-Scaffold

Generiere Test-Boilerplate für eine bestimmte Datei oder ein Modul.

## Argument: $ARGUMENTS (erforderlich)

Pfad zur Datei die getestet werden soll, z.B.:
- `backend/src/routes/chat.ts`
- `backend/src/services/memory.ts`
- `frontend/src/hooks/useChats.js`
- `backend/src/routes/` (alle Route-Dateien)

## Vorgehen

### Schritt 1: Zieldatei analysieren

Lies die angegebene Datei vollständig und identifiziere:

1. **Exportierte Funktionen/Klassen** — was muss getestet werden?
2. **Abhängigkeiten** — was muss gemockt werden?
3. **Seiteneffekte** — Dateisystem, API-Calls, Datenbank?
4. **Edge Cases** — Fehlerbehandlung, leere Eingaben, Grenzwerte?

### Schritt 2: Test-Strategie bestimmen

#### Für Backend Route-Dateien (`backend/src/routes/*.ts`)
- **API-Contract-Tests**: Request → Response Validierung
- **Auth-Tests**: Endpoint ohne Auth-Token → 401
- **Validation-Tests**: Ungültige Eingaben → 400 mit Fehlermeldung
- **Happy Path**: Korrekte Eingaben → erwartete Response
- **Framework**: `bun:test` mit `app.fetch()` für HTTP-Simulation

```typescript
import { test, expect, describe } from 'bun:test';
import app from '../index';

describe('GET /api/resource', () => {
  test('erfordert Authentifizierung', async () => {
    const res = await app.fetch(new Request('http://localhost/api/resource'));
    expect(res.status).toBe(401);
  });

  test('liefert Daten mit Auth', async () => {
    const res = await app.fetch(
      new Request('http://localhost/api/resource', {
        headers: { Cookie: 'session=valid-test-token' },
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('items');
  });
});
```

#### Für Backend Service-Dateien (`backend/src/services/*.ts`)
- **Unit-Tests**: Einzelne Funktionen isoliert testen
- **Mock File-System**: `Bun.file` Aufrufe mocken
- **Mock External APIs**: LLM-Calls, HTTP-Requests mocken
- **Framework**: `bun:test` mit `mock()`

```typescript
import { test, expect, describe, mock } from 'bun:test';
import { someFunction } from './service';

describe('someFunction', () => {
  test('verarbeitet leere Eingabe', () => {
    expect(someFunction('')).toEqual([]);
  });
});
```

#### Für Frontend Hook-Dateien (`frontend/src/hooks/*.js`)
- **Hinweis**: Frontend hat aktuell kein Test-Framework. Generiere Setup-Anweisungen.
- **Framework-Empfehlung**: vitest + @testing-library/react
- **Test-Fokus**: Hook-Behavior, API-Call-Reihenfolge, State-Management

### Schritt 3: Test-Datei generieren

Erstelle die Test-Datei im korrekten Verzeichnis:

- **Backend**: `backend/src/routes/__tests__/chat.test.ts` (oder `backend/src/services/__tests__/memory.test.ts`)
- **Frontend**: `frontend/src/hooks/__tests__/useChats.test.js`

#### Test-Struktur

```
describe('Modulname', () => {
  // Setup / Teardown
  beforeEach(() => { ... });
  afterEach(() => { ... });

  describe('Funktion/Endpoint', () => {
    test('Happy Path', () => { ... });
    test('Fehlerfall: ungültige Eingabe', () => { ... });
    test('Fehlerfall: nicht authentifiziert', () => { ... });
    test('Edge Case: leere Daten', () => { ... });
  });
});
```

#### Naming Convention
- Testbeschreibungen auf **Deutsch** (UI-Sprache)
- Variablennamen auf **Englisch** (Code-Sprache)

### Schritt 4: Setup-Anweisungen

Falls das Test-Setup noch nicht existiert:

#### Backend (bun:test — bereits verfügbar)
- Erstelle `__tests__/` Verzeichnis neben der Quelldatei
- Tests laufen mit `bun test`
- Keine zusätzliche Installation nötig

#### Frontend (vitest — Setup erforderlich)
Generiere Anweisungen:
```bash
cd frontend
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Und `vitest.config.js`:
```javascript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

### Schritt 5: Test ausführen

Nach dem Generieren:
1. **Backend**: `cd backend && bun test`
2. **Frontend**: `cd frontend && npx vitest run`

Prüfe ob die Tests kompilieren und grundsätzlich laufen (auch wenn sie initial feilen wegen fehlender Mocks).

## Wichtig

- Generiere **realistische Tests**, keine Platzhalter — die Tests sollen sofort nutzbar sein
- Teste den **öffentlichen Contract**, nicht die interne Implementierung
- Mocke Seiteneffekte (Dateisystem, APIs), teste keine echten externen Services
- Fokus auf die **kritischsten Pfade** zuerst (Auth, Validation, Happy Path)
- Pro Datei maximal **10-15 Tests** — Qualität vor Quantität
- Berücksichtige dass `data/` Verzeichnisse File-basierte Persistence sind — in Tests ein temporäres Verzeichnis verwenden
