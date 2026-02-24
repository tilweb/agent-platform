# Hooks

Jede App kapselt ihre Datenlogik in einem Custom Hook. Der Hook verwaltet State, API-Aufrufe und liefert Funktionen an die Komponenten.

## Standard-Pattern

Ein App-Hook kombiniert `useState`, `useCallback` und `useEffect` mit den `apiFetch`-Utilities:

```javascript
// frontend/src/hooks/useMyApp.js

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/apiFetch';

export function useMyApp() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Liste laden
  const fetchItems = useCallback(async (filters = {}) => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.search) params.set('search', filters.search);

      const query = params.toString();
      const url = `/apps/meine-app/items${query ? `?${query}` : ''}`;
      const response = await apiGet(url);

      if (!response.ok) {
        throw new Error('Laden fehlgeschlagen');
      }

      const data = await response.json();
      setItems(data.items || []);
    } catch (err) {
      console.error('Error fetching items:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Eintrag erstellen
  const createItem = useCallback(async (itemData) => {
    const response = await apiPost('/apps/meine-app/items', itemData);

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Erstellen fehlgeschlagen');
    }

    const data = await response.json();
    setItems((prev) => [...prev, data.item]);
    return data.item;
  }, []);

  // Eintrag aktualisieren
  const updateItem = useCallback(async (id, updates) => {
    const response = await apiPut(`/apps/meine-app/items/${id}`, updates);

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Aktualisieren fehlgeschlagen');
    }

    const data = await response.json();
    setItems((prev) =>
      prev.map((item) => (item.id === id ? data.item : item))
    );
    return data.item;
  }, []);

  // Eintrag löschen
  const deleteItem = useCallback(async (id) => {
    const response = await apiDelete(`/apps/meine-app/items/${id}`);

    if (!response.ok) {
      throw new Error('Löschen fehlgeschlagen');
    }

    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Initiales Laden
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return {
    items,
    isLoading,
    error,
    fetchItems,
    createItem,
    updateItem,
    deleteItem,
  };
}
```

## Verwendung in Komponenten

```jsx
import { useMyApp } from '../../hooks/useMyApp';
import { useToast } from '../../components/Toast';

export default function MyAppPage() {
  const { items, isLoading, fetchItems, createItem, deleteItem } = useMyApp();
  const toast = useToast();

  const handleCreate = async () => {
    try {
      await createItem({ title: 'Neuer Eintrag' });
      toast.success('Erstellt', 'Eintrag wurde erstellt');
    } catch (err) {
      toast.error('Fehler', err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteItem(id);
      toast.success('Gelöscht', 'Eintrag wurde entfernt');
    } catch (err) {
      toast.error('Fehler', err.message);
    }
  };

  // ...
}
```

## Konventionen

- **Dateiname**: `useMyApp.js` (camelCase mit `use`-Prefix)
- **Ablage**: `frontend/src/hooks/`
- **Error-Handling**: Fehler im Hook als State speichern (`setError`), in Komponenten über `toast` anzeigen
- **Optimistic Updates**: State vor der API-Antwort aktualisieren, bei Fehler zurückrollen
- **Kein globaler State**: Hooks verwalten lokalen Komponentenstate; nur `AppsContext` ist global

> [!tip]
> Alle Mutationsfunktionen (`createItem`, `updateItem`, `deleteItem`) sollten Promises zurückgeben, damit die Komponente `try/catch` nutzen und Toast-Feedback geben kann.
