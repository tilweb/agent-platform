# Services

Die Service-Schicht enthält die Business-Logik Ihrer App. Sie trennt die Verarbeitungslogik von den HTTP-Routen und dem Datenzugriff.

## Schichtenmodell

```
Routes (routes.ts)      → HTTP-Handler, Request/Response
    ↓
Service (service.ts)    → Business-Logik, Validierung
    ↓
Storage (storage.ts)    → Datei-Lesen/Schreiben
```

## Service-Pattern

```typescript
// backend/src/apps/meine-app/service.ts

import { loadItem, saveItem, deleteItemFile, listItemFiles } from './storage';

export interface ItemData {
  id: string;
  title: string;
  status: 'draft' | 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

/**
 * Alle Einträge auflisten
 */
export async function listItems(filters?: {
  status?: string;
  search?: string;
}): Promise<ItemData[]> {
  const items = await listItemFiles();

  let result = items;

  if (filters?.status) {
    result = result.filter((item) => item.status === filters.status);
  }

  if (filters?.search) {
    const term = filters.search.toLowerCase();
    result = result.filter((item) =>
      item.title.toLowerCase().includes(term)
    );
  }

  return result.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Eintrag anhand der ID laden
 */
export async function getItem(id: string): Promise<ItemData | null> {
  return loadItem(id);
}

/**
 * Neuen Eintrag erstellen
 */
export async function createItem(data: {
  title: string;
  status?: string;
}): Promise<ItemData> {
  const item: ItemData = {
    id: `item_${Date.now()}`,
    title: data.title,
    status: (data.status as ItemData['status']) || 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveItem(item);
  return item;
}

/**
 * Eintrag aktualisieren
 */
export async function updateItem(
  id: string,
  updates: Partial<ItemData>
): Promise<ItemData | null> {
  const item = await loadItem(id);
  if (!item) return null;

  const updated: ItemData = {
    ...item,
    ...updates,
    id,   // ID nicht überschreiben
    updatedAt: new Date().toISOString(),
  };

  await saveItem(updated);
  return updated;
}

/**
 * Eintrag löschen
 */
export async function deleteItem(id: string): Promise<boolean> {
  return deleteItemFile(id);
}
```

## Route → Service Verbindung

Die Route ruft den Service auf und formatiert die HTTP-Antwort:

```typescript
// backend/src/apps/meine-app/routes.ts

import { listItems, createItem, getItem } from './service';
import { internalError, validationError, notFoundError } from '../../utils/errorHandler';

meineApp.get('/items', async (c) => {
  try {
    const items = await listItems({
      status: c.req.query('status'),
      search: c.req.query('search'),
    });
    return c.json({ items });
  } catch (error) {
    return internalError(c, error);
  }
});

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

## LLM-Integration

Falls Ihre App KI-Funktionalität benötigt, können Sie den LLM-Service nutzen:

```typescript
import { callLLM } from '../../services/llm';

export async function analyzeContent(text: string): Promise<string> {
  const result = await callLLM({
    messages: [
      { role: 'system', content: 'Sie sind ein Analyse-Assistent.' },
      { role: 'user', content: `Analysieren Sie: ${text}` },
    ],
  });

  return result.content;
}
```

> [!info]
> Die LLM-Integration verwendet automatisch das konfigurierte Modell. Sie müssen keine Provider-Konfiguration selbst vornehmen.

## Konventionen

- **Eine Funktion pro Operation**: `createItem`, `getItem`, `updateItem`, `deleteItem`
- **Rückgabewerte**: Objekt bei Erfolg, `null` bei „nicht gefunden", Fehler werfen bei echten Fehlern
- **Keine HTTP-Logik**: Services kennen kein `Request`/`Response` — nur Datentypen
- **ID-Generierung**: `${prefix}_${Date.now()}` oder `${prefix}_${Date.now()}_${randomSuffix}`
