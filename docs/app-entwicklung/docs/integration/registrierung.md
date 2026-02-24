# Registrierung

Damit eine App in der Plattform sichtbar wird, muss sie an vier Stellen registriert werden: Registry-Eintrag, Backend-Route-Mount, Frontend-Route und Sidebar-Icon.

## 1. Registry-Eintrag

Die App-Registry liegt in `backend/src/apps/registry.ts`. Ergänzen Sie Ihren Eintrag in `getDefaultRegistry()`:

```typescript
function getDefaultRegistry(): AppsRegistry {
  return {
    apps: {
      // ... bestehende Apps ...

      'meine-app': {
        id: 'meine-app',
        name: 'Meine App',
        description: 'Kurzbeschreibung der App-Funktionalität',
        icon: 'default',
        version: '1.0.0',
        enabled: true,
        routes: [
          { path: '/apps/meine-app', component: 'MeineAppPage' },
          { path: '/apps/meine-app/:id', component: 'DetailPage' },
        ],
      },
    },
    appOrder: ['vertragsmanagement', 'projektmanagement', 'meine-app'],
  };
}
```

### AppConfig-Felder

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | `string` | Eindeutige ID (kebab-case). Bestimmt URL-Pfad und Daten-Verzeichnis |
| `name` | `string` | Anzeigename in der Sidebar |
| `description` | `string` | Kurzbeschreibung für die Apps-Verwaltung |
| `icon` | `string` | Icon-ID für `AppNavIcon` in der Sidebar |
| `version` | `string` | Versionsnummer (SemVer) |
| `enabled` | `boolean` | Ob die App standardmäßig aktiviert ist |
| `routes` | `AppRoute[]` | Frontend-Routen (informativ, Routing geschieht in App.jsx) |

> [!warning]
> Falls die Datei `backend/data/apps/registry.yaml` bereits existiert, wird `getDefaultRegistry()` nicht aufgerufen. Löschen Sie die YAML-Datei oder ergänzen Sie den Eintrag dort manuell.

## 2. Backend-Route mounten

In `backend/src/routes/apps.ts`:

```typescript
import { meineAppRoutes } from '../apps/meine-app/routes';

// Bei den App-specific Routes:
apps.route('/meine-app', meineAppRoutes);
```

## 3. Frontend-Route

In `frontend/src/App.jsx`:

```jsx
// Lazy-Import
const MeineAppPage = lazy(() => import('./apps/meine-app/MeineAppPage'));
const DetailPage = lazy(() => import('./apps/meine-app/DetailPage'));

// Routen
<Route path="/apps/meine-app" element={<MeineAppPage />} />
<Route path="/apps/meine-app/:id" element={<DetailPage />} />
```

## 4. Sidebar-Icon

Die Sidebar zeigt aktivierte Apps automatisch an. Das Icon wird über die `icon`-ID in der Registry bestimmt.

### Standard-Icon

Mit `icon: 'default'` wird das Standard-Raster-Icon (`AppsNavIcon`) verwendet. Das funktioniert sofort ohne Änderung an der Sidebar.

### Eigenes Icon

Für ein eigenes Icon erweitern Sie `AppNavIcon` in `frontend/src/components/Sidebar.jsx`:

```jsx
function AppNavIcon({ iconId }) {
  switch (iconId) {
    case 'contract':
      return <ContractNavIcon color={navIconColors.contract} />;
    case 'meine-app':
      return <MeineAppNavIcon color={navIconColors.apps} />;
    default:
      return <AppsNavIcon color={navIconColors.apps} />;
  }
}
```

Definieren Sie die Icon-Komponente mit dem Standard-Pattern (18x18, ViewBox 0 0 24 24, stroke):

```jsx
function MeineAppNavIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth="2">
      {/* SVG-Pfade */}
    </svg>
  );
}
```

Optional können Sie eine eigene Farbe in `navIconColors` definieren:

```javascript
const navIconColors = {
  // ... bestehende Farben ...
  meineApp: '#8b5cf6',  // z.B. Lila
};
```

## AppsContext

Der `AppsContext` stellt den App-Status global bereit. Die Sidebar liest `enabledApps` daraus, um die Navigation zu rendern:

```jsx
import { useApps } from '../../context/AppsContext';

function MyComponent() {
  const { apps, enabledApps, toggleApp, refresh } = useApps();
  // apps: alle Apps
  // enabledApps: nur aktivierte Apps
  // toggleApp(id): App aktivieren/deaktivieren
  // refresh(): Liste neu laden
}
```

Wenn ein Admin eine App über die Einstellungsseite aktiviert oder deaktiviert, aktualisiert sich die Sidebar sofort.

## Checkliste

- [ ] Registry-Eintrag in `getDefaultRegistry()` hinzugefügt
- [ ] `appOrder`-Array aktualisiert
- [ ] Backend-Routen in `apps.ts` gemountet
- [ ] Frontend-Routen in `App.jsx` registriert
- [ ] Lazy-Import für Frontend-Seiten vorhanden
- [ ] (Optional) Eigenes Sidebar-Icon definiert
