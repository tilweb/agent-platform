# Neue App erstellen

Dieses Tutorial führt Sie Schritt für Schritt durch die Erstellung einer minimalen App. Am Ende haben Sie eine funktionierende App mit Backend-API, Frontend-Seite und Sidebar-Eintrag.

## 1. Backend-Routen anlegen

Erstellen Sie das Verzeichnis `backend/src/apps/meine-app/` mit einer Route-Datei:

```typescript
// backend/src/apps/meine-app/routes.ts

import { Hono } from 'hono';

const meineApp = new Hono();

// GET /api/apps/meine-app/items
meineApp.get('/items', async (c) => {
  // Hier kommt die Logik — zunächst statische Daten
  return c.json({
    items: [
      { id: '1', title: 'Erster Eintrag', status: 'active' },
      { id: '2', title: 'Zweiter Eintrag', status: 'draft' },
    ],
  });
});

// GET /api/apps/meine-app/items/:id
meineApp.get('/items/:id', async (c) => {
  const id = c.req.param('id');
  return c.json({
    item: { id, title: `Eintrag ${id}`, status: 'active' },
  });
});

// POST /api/apps/meine-app/items
meineApp.post('/items', async (c) => {
  const body = await c.req.json();
  return c.json({ item: { id: Date.now().toString(), ...body } }, 201);
});

export { meineApp as meineAppRoutes };
```

## 2. Routen im Apps-Router mounten

Registrieren Sie die Routen in `backend/src/routes/apps.ts`:

```typescript
// Bestehende Imports ergänzen:
import { meineAppRoutes } from '../apps/meine-app/routes';

// Am Ende der Datei, bei den App-specific Routes:
apps.route('/meine-app', meineAppRoutes);
```

> [!tip]
> Alle App-Routen sind automatisch durch `authMiddleware` geschützt, da dieser auf `/*` im Apps-Router registriert ist.

## 3. Frontend-Seite erstellen

Erstellen Sie `frontend/src/apps/meine-app/MeineAppPage.jsx`:

```jsx
import { useState, useEffect, useCallback } from 'react';
import { theme } from '../../config/theme';
import { apiGet } from '../../utils/apiFetch';

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  title: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
  },
  content: {
    flex: 1,
    padding: theme.spacing['2xl'],
    overflow: 'auto',
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.md,
  },
  cardTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
};

export default function MeineAppPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiGet('/apps/meine-app/items');
      const data = await response.json();
      setItems(data.items || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Meine App</h1>
        <p style={styles.subtitle}>Beschreibung der App</p>
      </div>

      <div style={styles.content}>
        {loading ? (
          <div style={{ color: theme.colors.textMuted }}>Laden...</div>
        ) : (
          items.map((item) => (
            <div key={item.id} style={styles.card}>
              <div style={styles.cardTitle}>{item.title}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

## 4. Frontend-Route registrieren

Fügen Sie die Route in `frontend/src/App.jsx` ein:

```jsx
// Lazy-Import am Anfang der Datei
const MeineAppPage = lazy(() => import('./apps/meine-app/MeineAppPage'));

// Route innerhalb der <Routes> (neben den anderen App-Routen)
<Route path="/apps/meine-app" element={<MeineAppPage />} />
```

## 5. Registry-Eintrag hinzufügen

Registrieren Sie die App in `backend/src/apps/registry.ts` innerhalb von `getDefaultRegistry()`:

```typescript
'meine-app': {
  id: 'meine-app',
  name: 'Meine App',
  description: 'Kurzbeschreibung der App',
  icon: 'default',      // Icon-ID für die Sidebar
  version: '1.0.0',
  enabled: true,
  routes: [
    { path: '/apps/meine-app', component: 'MeineAppPage' },
  ],
},
```

Fügen Sie die ID auch in `appOrder` ein:

```typescript
appOrder: ['vertragsmanagement', 'projektmanagement', 'meine-app'],
```

> [!warning]
> Falls die Registry bereits als YAML-Datei unter `backend/data/apps/registry.yaml` existiert, müssen Sie den Eintrag dort manuell ergänzen oder die Datei löschen, damit sie aus den Defaults neu generiert wird.

## 6. Sidebar-Icon (optional)

Standardmäßig wird das Raster-Icon (`AppsNavIcon`) verwendet. Für ein eigenes Icon erweitern Sie die `AppNavIcon`-Funktion in `frontend/src/components/Sidebar.jsx`:

```jsx
function AppNavIcon({ iconId }) {
  switch (iconId) {
    case 'contract':
      return <ContractNavIcon color={navIconColors.contract} />;
    case 'meine-app':
      return <MeineAppIcon color={navIconColors.apps} />;
    default:
      return <AppsNavIcon color={navIconColors.apps} />;
  }
}
```

## Ergebnis

Nach dem Neustart beider Server sehen Sie:

1. **Sidebar**: „Meine App" erscheint unter dem Abschnitt „Apps"
2. **URL**: `/apps/meine-app` zeigt die Übersichtsseite
3. **API**: `GET /api/apps/meine-app/items` liefert die Daten

## Nächste Schritte

- [Seitenstruktur](../frontend/seitenstruktur.md) — Layout-Patterns und Detail-Seiten
- [Design-System](../frontend/design-system.md) — Theme und Styling-Regeln
- [Routen](../backend/routen.md) — REST-Patterns und Error-Handling
- [Persistenz](../backend/persistenz.md) — Daten speichern mit Bun.file
