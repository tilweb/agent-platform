# Routen

Backend-Routen für Apps werden als Hono-Router erstellt und im zentralen Apps-Router gemountet. Alle App-Routen sind automatisch durch die Auth-Middleware geschützt.

## Router erstellen

Erstellen Sie eine `routes.ts` im App-Verzeichnis:

```typescript
// backend/src/apps/meine-app/routes.ts

import { Hono } from 'hono';

const meineApp = new Hono();

export { meineApp as meineAppRoutes };
```

## REST-Patterns

### Liste (GET)

```typescript
meineApp.get('/items', async (c) => {
  try {
    const status = c.req.query('status');
    const search = c.req.query('search');

    const items = await listItems({ status, search });
    return c.json({ items });
  } catch (error) {
    return internalError(c, error);
  }
});
```

### Detail (GET)

```typescript
meineApp.get('/items/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const item = await getItem(id);

    if (!item) {
      return notFoundError(c, 'Eintrag');
    }

    return c.json({ item });
  } catch (error) {
    return internalError(c, error);
  }
});
```

### Erstellen (POST)

```typescript
meineApp.post('/items', async (c) => {
  try {
    const body = await c.req.json();

    if (!body.title) {
      return validationError(c, 'Titel ist erforderlich');
    }

    const item = await createItem(body);
    return c.json({ item }, 201);
  } catch (error) {
    return internalError(c, error);
  }
});
```

### Aktualisieren (PUT)

```typescript
meineApp.put('/items/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const item = await updateItem(id, body);

    if (!item) {
      return notFoundError(c, 'Eintrag');
    }

    return c.json({ item });
  } catch (error) {
    return internalError(c, error);
  }
});
```

### Löschen (DELETE)

```typescript
meineApp.delete('/items/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const deleted = await deleteItem(id);

    if (!deleted) {
      return notFoundError(c, 'Eintrag');
    }

    return c.json({ success: true });
  } catch (error) {
    return internalError(c, error);
  }
});
```

## Error-Handler-Utilities

Importieren Sie die Standard-Error-Handler aus `utils/errorHandler`:

```typescript
import {
  internalError,
  validationError,
  notFoundError,
  forbiddenError,
} from '../../utils/errorHandler';
```

| Funktion | HTTP-Status | Verwendung |
|----------|-------------|------------|
| `internalError(c, error)` | 500 | Unerwartete Fehler |
| `validationError(c, message)` | 400 | Ungültige Eingaben |
| `notFoundError(c, resource?)` | 404 | Ressource nicht gefunden |
| `forbiddenError(c, message?)` | 403 | Fehlende Berechtigung |

## Datei-Upload

Für Datei-Uploads verwenden Sie `c.req.formData()`:

```typescript
meineApp.post('/upload', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return validationError(c, 'Keine Datei hochgeladen');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    // buffer verarbeiten...

    return c.json({ success: true }, 201);
  } catch (error) {
    return internalError(c, error);
  }
});
```

## Router mounten

Registrieren Sie den Router in `backend/src/routes/apps.ts`:

```typescript
import { meineAppRoutes } from '../apps/meine-app/routes';

// Am Ende der Datei:
apps.route('/meine-app', meineAppRoutes);
```

Dadurch sind alle Endpunkte unter `/api/apps/meine-app/...` erreichbar.

## Authentifizierung

Der übergeordnete Apps-Router wendet `authMiddleware` auf alle Pfade an:

```typescript
apps.use('/*', authMiddleware);
```

Sie müssen keine eigene Auth-Middleware hinzufügen. Für Admin-Only-Endpunkte prüfen Sie die Rolle:

```typescript
import { getCurrentUser } from '../../auth';

meineApp.put('/items/:id/admin-action', async (c) => {
  const user = getCurrentUser(c);
  if (!user || user.role !== 'admin') {
    return forbiddenError(c, 'Admin-Rechte erforderlich');
  }
  // ...
});
```
