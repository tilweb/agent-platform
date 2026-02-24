# Seitenstruktur

App-Seiten liegen unter `frontend/src/apps/<app-id>/` und werden als React-Komponenten implementiert. Diese Seite beschreibt die Verzeichnisstruktur, das Layout-Pattern und die Navigation zwischen Seiten.

## Verzeichnisstruktur

```
frontend/src/apps/<app-id>/
├── MyAppPage.jsx           # Hauptseite (Übersicht/Liste)
├── DetailPage.jsx          # Detail-Ansicht
├── CreatePage.jsx          # Erstellen-Seite (optional)
└── components/             # App-spezifische Komponenten
    ├── ItemCard.jsx
    └── FilterBar.jsx
```

## Seiten-Pattern

Jede Seite exportiert eine Default-Funktion und definiert Styles als Konstante am Dateianfang:

```jsx
import { theme } from '../../config/theme';

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
  content: {
    flex: 1,
    padding: theme.spacing['2xl'],
    overflow: 'auto',
  },
};

export default function MyAppPage() {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        {/* Titel + Aktions-Buttons */}
      </div>
      <div style={styles.content}>
        {/* Hauptinhalt */}
      </div>
    </div>
  );
}
```

## Header-Pattern

Der Standard-Header enthält Titel links und Aktions-Buttons rechts:

```jsx
const styles = {
  header: {
    padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
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
};
```

## Detail-Seiten mit Back-Link

Detail-Seiten verwenden `useParams` für die ID und einen Back-Link zur Übersicht:

```jsx
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '../../components/Icons';

export default function DetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button
          style={styles.backLink}
          onClick={() => navigate('/apps/meine-app')}
        >
          <ArrowLeftIcon /> Meine App
        </button>

        <div style={styles.headerContent}>
          <div style={styles.headerLeft}>
            <h1 style={styles.headerTitle}>Detail-Titel</h1>
            <div style={styles.headerSubtitle}>
              <span>Info</span>
              <span>|</span>
              <span style={styles.statusBadge}>Aktiv</span>
            </div>
          </div>
          <div style={styles.headerActions}>
            <button style={styles.actionButton}>Aktion</button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

Back-Link Style:

```javascript
backLink: {
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing.xs,
  fontSize: theme.typography.sizes.sm,
  color: theme.colors.primary,
  cursor: 'pointer',
  marginBottom: theme.spacing.lg,
  border: 'none',
  background: 'none',
  padding: 0,
  fontWeight: theme.typography.weights.medium,
},
```

## React Router Konfiguration

App-Routen werden in `frontend/src/App.jsx` als Lazy-Imports registriert:

```jsx
// Lazy-Imports
const MyAppPage = lazy(() => import('./apps/meine-app/MyAppPage'));
const DetailPage = lazy(() => import('./apps/meine-app/DetailPage'));

// Routen (innerhalb der bestehenden <Routes>)
<Route path="/apps/meine-app" element={<MyAppPage />} />
<Route path="/apps/meine-app/:id" element={<DetailPage />} />
```

> [!info]
> Alle App-Routen folgen dem Pattern `/apps/<app-id>/...`. Das Lazy-Loading sorgt dafür, dass App-Code erst geladen wird, wenn die Seite besucht wird.

## Navigation zwischen Seiten

Verwenden Sie `useNavigate` für programmatische Navigation und `Link` für statische Links:

```jsx
import { useNavigate, Link } from 'react-router-dom';

// Programmatisch (z.B. nach Erstellen)
const navigate = useNavigate();
navigate('/apps/meine-app/123');

// Als Link (z.B. in einer Liste)
<Link to={`/apps/meine-app/${item.id}`}>
  {item.title}
</Link>
```
