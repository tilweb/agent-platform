# API-Aufrufe

Alle API-Aufrufe im Frontend nutzen die Utilities aus `frontend/src/utils/apiFetch.js`. Diese stellen sicher, dass Cookies für die Session-Authentifizierung automatisch mitgesendet werden.

## Import

```javascript
import { apiGet, apiPost, apiPut, apiDelete, apiPostForm } from '../../utils/apiFetch';
```

## Verfügbare Funktionen

### `apiGet(endpoint)`

GET-Request für das Laden von Daten.

```javascript
const response = await apiGet('/apps/meine-app/items');
const data = await response.json();
// data.items → [{ id, title, ... }]
```

### `apiPost(endpoint, body)`

POST-Request mit JSON-Body für das Erstellen von Einträgen.

```javascript
const response = await apiPost('/apps/meine-app/items', {
  title: 'Neuer Eintrag',
  status: 'draft',
});
const data = await response.json();
// data.item → { id, title, status }
```

### `apiPut(endpoint, body)`

PUT-Request mit JSON-Body für Aktualisierungen.

```javascript
const response = await apiPut('/apps/meine-app/items/123', {
  title: 'Aktualisierter Titel',
});
const data = await response.json();
```

### `apiDelete(endpoint)`

DELETE-Request zum Löschen.

```javascript
const response = await apiDelete('/apps/meine-app/items/123');

if (!response.ok) {
  throw new Error('Löschen fehlgeschlagen');
}
```

### `apiPostForm(endpoint, formData)`

POST-Request mit FormData für Datei-Uploads. Setzt keinen `Content-Type`-Header — der Browser ergänzt ihn automatisch mit der Boundary.

```javascript
const formData = new FormData();
formData.append('file', selectedFile);
formData.append('type', 'document');

const response = await apiPostForm('/apps/meine-app/upload', formData);
const data = await response.json();
```

## Error-Handling

Alle Funktionen geben ein `Response`-Objekt zurück. Prüfen Sie `response.ok` vor dem Parsen:

```javascript
const response = await apiPost('/apps/meine-app/items', data);

if (!response.ok) {
  const errorData = await response.json();
  throw new Error(errorData.error || 'Unbekannter Fehler');
}

const result = await response.json();
```

## Vollständiges Beispiel

```javascript
import { apiGet, apiPost } from '../../utils/apiFetch';
import { useToast } from '../../components/Toast';

function MyComponent() {
  const toast = useToast();

  const handleSubmit = async (formData) => {
    try {
      const response = await apiPost('/apps/meine-app/items', formData);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Speichern fehlgeschlagen');
      }

      const data = await response.json();
      toast.success('Gespeichert', 'Eintrag wurde erstellt');
      return data.item;
    } catch (err) {
      toast.error('Fehler', err.message);
      throw err;
    }
  };
}
```

> [!info]
> Die Basis-URL (`/api`) wird automatisch von `apiFetch` ergänzt. Übergeben Sie nur den Pfad ab `/apps/...`.
