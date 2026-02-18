# Frontend Guidelines

## Projektstruktur

```
src/
├── components/     # Wiederverwendbare UI-Komponenten
├── pages/          # Seiten-Komponenten (Route-Ziele)
├── hooks/          # Custom React Hooks
├── context/        # React Context Provider
├── config/         # Konfiguration (theme.js)
├── utils/          # Hilfsfunktionen (apiFetch.js)
```

## Styling

### Grundregeln
- **Inline-Styles** mit JavaScript Objects verwenden
- **Immer** `theme.js` Werte nutzen, keine hardcoded Farben/Abstände
- Styles als `const styles = {}` am Dateianfang definieren

```javascript
import { theme } from '../config/theme';

const styles = {
  container: {
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
  },
};
```

### Theme-Referenz
- Farben: `theme.colors.*` (primary, surface, text, textMuted, border, etc.)
- Abstände: `theme.spacing.*` (xs, sm, md, lg, xl, 2xl, 3xl)
- Schrift: `theme.typography.sizes.*`, `theme.typography.weights.*`
- Radien: `theme.borderRadius.*` (sm, md, lg, xl, full)
- Transitions: `theme.transitions.fast`

---

## UI-Komponenten

### Tabs (Standard: Pill-Style)

Referenz-Implementation: `ToolsPage.jsx`

```javascript
tabs: {
  display: 'flex',
  gap: theme.spacing.sm,
  marginBottom: theme.spacing.xl,
},
tab: {
  padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
  backgroundColor: 'transparent',
  border: 'none',
  borderRadius: theme.borderRadius.md,
  fontSize: theme.typography.sizes.sm,
  fontWeight: theme.typography.weights.medium,
  color: theme.colors.textMuted,
  cursor: 'pointer',
  transition: `all ${theme.transitions.fast}`,
},
tabActive: {
  backgroundColor: theme.colors.primaryLight,
  color: theme.colors.primary,
},
```

Hover-Handling:
```javascript
onMouseEnter={(e) => {
  if (!isActive) {
    e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
  }
}}
onMouseLeave={(e) => {
  if (!isActive) {
    e.currentTarget.style.backgroundColor = 'transparent';
  }
}}
```

### Buttons

**Primary Button:**
```javascript
{
  padding: `${theme.spacing.md} ${theme.spacing.lg}`,
  backgroundColor: theme.colors.primary,
  color: '#fff',
  border: 'none',
  borderRadius: theme.borderRadius.lg,
  fontSize: theme.typography.sizes.sm,
  fontWeight: theme.typography.weights.medium,
  cursor: 'pointer',
}
```

**Secondary/Cancel Button:**
```javascript
{
  padding: `${theme.spacing.md} ${theme.spacing.lg}`,
  backgroundColor: 'transparent',
  color: theme.colors.text,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.borderRadius.lg,
}
```

**Danger Button:**
```javascript
{
  backgroundColor: 'transparent',
  color: theme.colors.error,
  border: `1px solid ${theme.colors.error}30`,
}
```

### Cards

```javascript
{
  backgroundColor: theme.colors.surface,
  borderRadius: theme.borderRadius.xl,
  border: `1px solid ${theme.colors.border}`,
  padding: theme.spacing.xl,
  transition: `all ${theme.transitions.fast}`,
}
```

### Status Badges

```javascript
statusBadge: {
  fontSize: theme.typography.sizes.xs,
  padding: `${theme.spacing.xs} ${theme.spacing.md}`,
  borderRadius: theme.borderRadius.full,
  fontWeight: theme.typography.weights.medium,
},
// Varianten:
statusSuccess: {
  backgroundColor: theme.colors.successLight,
  color: theme.colors.success,
},
statusError: {
  backgroundColor: theme.colors.errorLight,
  color: theme.colors.error,
},
statusMuted: {
  backgroundColor: theme.colors.surfaceHover,
  color: theme.colors.textMuted,
},
```

### Modals

```javascript
modalOverlay: {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
},
modalContent: {
  backgroundColor: theme.colors.surface,
  borderRadius: theme.borderRadius.xl,
  maxWidth: '700px',
  width: '90%',
  maxHeight: '90vh',
  overflow: 'auto',
},
```

### Form Inputs

```javascript
input: {
  width: '100%',
  padding: theme.spacing.md,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.borderRadius.lg,
  fontSize: theme.typography.sizes.sm,
  backgroundColor: theme.colors.background,
  color: theme.colors.text,
  outline: 'none',
},
```

### Search & Filter Inputs (prominent)

Für prominente Such- und Filterfelder (z.B. Seitenheader) größere Dimensionen verwenden:

Referenz-Implementation: `SearchPage.jsx`, `ContractsPage.jsx`

```javascript
// Suchfeld (prominent)
searchInput: {
  flex: 1,
  padding: `${theme.spacing.md} ${theme.spacing.lg}`,
  fontSize: theme.typography.sizes.base,  // größer als sm
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.borderRadius.lg,
  backgroundColor: theme.colors.background,
  color: theme.colors.text,
  outline: 'none',
},

// Filter-Dropdown (prominent)
filterSelect: {
  padding: `${theme.spacing.md} ${theme.spacing.lg}`,
  fontSize: theme.typography.sizes.base,  // größer als sm
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.borderRadius.lg,
  backgroundColor: theme.colors.surface,
  color: theme.colors.text,
  cursor: 'pointer',
},
```

**Unterschied zu Standard Form Inputs:**
- `padding`: `md lg` statt `md` (mehr horizontaler Abstand)
- `fontSize`: `base` statt `sm` (bessere Lesbarkeit)

---

## API-Aufrufe

**Immer** `apiFetch` aus `utils/apiFetch.js` verwenden (inkludiert `credentials: 'include'`):

```javascript
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/apiFetch';

// Beispiele:
const data = await apiGet('/endpoint');
await apiPost('/endpoint', { key: 'value' });
await apiDelete('/endpoint/id');
```

---

## Seiten-Pattern

### Standalone-Seiten
Normaler Header mit Titel + Subtitle.

### Embedded-Seiten (in Settings)
`embedded` Prop unterstützen, Header bei `embedded={true}` ausblenden:

```javascript
export default function MyPage({ embedded = false }) {
  return (
    <div style={styles.container}>
      {!embedded && (
        <div style={styles.header}>
          <h1 style={styles.title}>Titel</h1>
          <p style={styles.subtitle}>Beschreibung</p>
        </div>
      )}
      {/* Content */}
    </div>
  );
}
```

---

## Vertikale Sidebar-Navigation

Für Seiten mit vielen Unterseiten/Tabs (z.B. Einstellungen) eine vertikale Sidebar links verwenden.

Referenz-Implementation: `SettingsPage.jsx`

### Design-Prinzipien

- **Kein Box-Layout**: Sidebar ohne weißen Hintergrund, direkt auf grauem Hintergrund
- **Kein Border**: Keine Trennlinie zwischen Sidebar und Content
- **Gruppierung**: Tabs in logische Gruppen unterteilen mit Überschriften
- **Kompakt**: Schmale Sidebar (240px), mehr Platz für Content

### Styles

```javascript
// Container: Flexbox horizontal
container: {
  display: 'flex',
  height: '100%',
},

// Sidebar: Transparent, kein Border
sidebar: {
  width: '240px',
  minWidth: '240px',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  paddingTop: theme.spacing.xl,
  paddingLeft: theme.spacing.lg,
},

// Header in Sidebar
sidebarHeader: {
  paddingLeft: theme.spacing.md,
  paddingBottom: theme.spacing.lg,
},

// Tabs Container
tabsContainer: {
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing.xs,
  padding: theme.spacing.md,
  overflowY: 'auto',
  flex: 1,
},

// Einzelner Tab
tab: {
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing.sm,
  padding: `${theme.spacing.sm} ${theme.spacing.md}`,
  fontSize: theme.typography.sizes.sm,
  fontWeight: theme.typography.weights.medium,
  color: theme.colors.textMuted,
  backgroundColor: 'transparent',
  border: 'none',
  borderRadius: theme.borderRadius.md,
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
},

// Aktiver Tab
tabActive: {
  backgroundColor: theme.colors.primaryLight,
  color: theme.colors.primary,
},

// Gruppen-Überschrift (Divider)
tabDivider: {
  padding: `${theme.spacing.lg} ${theme.spacing.md} ${theme.spacing.sm}`,
  fontSize: theme.typography.sizes.xs,
  fontWeight: theme.typography.weights.semibold,
  color: theme.colors.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginTop: theme.spacing.md,
},

// Content-Bereich
content: {
  flex: 1,
  overflow: 'auto',
  backgroundColor: theme.colors.background,
},

// Wrapper für eingebettete Seiten
embeddedPage: {
  height: '100%',
  padding: theme.spacing['2xl'],
  overflow: 'auto',
},
```

### Tab-Konfiguration mit Gruppen

```javascript
const TABS = [
  // User section
  { id: 'profile', label: 'Profil', icon: UserIcon },

  // Admin section - mit Divider
  { id: 'divider-users', type: 'divider', label: 'Benutzerverwaltung', adminOnly: true },
  { id: 'users', label: 'Benutzer', icon: UsersIcon, adminOnly: true },
  { id: 'groups', label: 'Gruppen', icon: GroupIcon, adminOnly: true },

  // System section - mit Divider
  { id: 'divider-system', type: 'divider', label: 'System', adminOnly: true },
  { id: 'providers', label: 'KI-Modelle', icon: ProvidersIcon, adminOnly: true },
  // ...
];

// Rendering
{visibleTabs.map((tab) => {
  if (tab.type === 'divider') {
    return <div key={tab.id} style={styles.tabDivider}>{tab.label}</div>;
  }
  return (
    <button key={tab.id} style={{...styles.tab, ...(isActive ? styles.tabActive : {})}}>
      <IconComponent style={styles.tabIcon} />
      <span style={styles.tabLabel}>{tab.label}</span>
    </button>
  );
})}
```

### Eingebettete Seiten

Seiten die in der Sidebar eingebettet werden, müssen:

1. **`embedded` Prop unterstützen**
2. **Eigenen Header ausblenden** wenn `embedded={true}`
3. **Embedded-Header anzeigen** mit Icon + Titel + Beschreibung
4. **Container-Padding entfernen** wenn embedded (Padding kommt vom Wrapper)

```javascript
export default function MyPage({ embedded = false }) {
  return (
    <div style={embedded ? { width: '100%' } : styles.container}>
      {!embedded && (
        <div style={styles.header}>
          <h1>Standalone Titel</h1>
        </div>
      )}

      {embedded && (
        <div style={{ marginBottom: theme.spacing.xl }}>
          <h2 style={{
            fontSize: theme.typography.sizes.lg,
            fontWeight: theme.typography.weights.semibold,
            display: 'flex', alignItems: 'center', gap: theme.spacing.sm
          }}>
            <MyIcon style={{ width: 20, height: 20, color: theme.colors.primary }} />
            Embedded Titel
          </h2>
          <p style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>
            Beschreibung
          </p>
        </div>
      )}

      {/* Content */}
    </div>
  );
}
```

---

## Icons

### Grundregel: Keine Emojis

**Verwende SVG-Icons statt Emojis.** Emojis werden nicht verwendet (Ausnahme: Länder-Flags für Lokalisierung).

### Zentrale Icon-Bibliothek

Icons werden aus `components/Icons.jsx` importiert:

```javascript
import { ChatIcon, DocumentIcon, SearchIcon } from '../components/Icons';
import { getContentTypeIcon, getProviderIcon } from '../components/Icons';

// Einzelnes Icon
<SearchIcon size={16} color={theme.colors.primary} />

// Content-Type basiert (chat, knowledge, confluence, gdrive, etc.)
{getContentTypeIcon('confluence', { size: 16 })}

// Provider basiert (für Connections)
{getProviderIcon('google-drive', { size: 24 })}
```

### Verfügbare Icons

| Icon | Verwendung |
|------|------------|
| `ChatIcon` | Chats, Nachrichten |
| `DocumentIcon` | Dokumente, Confluence |
| `FolderIcon` | Ordner, Google Drive |
| `FolderOpenIcon` | SharePoint |
| `BookIcon` | Knowledge Base, Wissen |
| `PaperclipIcon` | Anhänge, Dateien |
| `LinkIcon` | Links, Verbindungen |
| `TicketIcon` | Tickets, YouTrack |
| `UserIcon` | Benutzer, Profile |
| `ClipboardIcon` | Anweisungen, Listen |
| `TargetIcon` | Ziele, Kontext |
| `PlugIcon` | Tools, Integrationen |
| `SearchIcon` | Suche |
| `TableIcon` | Tabellen, Daten |
| `ListIcon` | Listen, Vorlagen |
| `ArrowLeftIcon` | Navigation zurück |
| `RobotIcon` | Agents, Bot |
| `LightningIcon` | Skills, Schnellaktionen |
| `BrainIcon` | KI-Modelle |
| `SparklesIcon` | Neu, Erstellen |
| `TrashIcon` | Löschen |
| `HelpCircleIcon` | Hilfe |
| `RefreshIcon` | Aktualisieren, Auto |
| `CodeIcon` | Code, Entwicklung |
| `PenIcon` | Schreiben, Bearbeiten |
| `BriefcaseIcon` | Business, Supervisor |
| `BarChartIcon` | Analyse, Statistik |
| `CircleIcon` | Status-Punkt |
| `SlashIcon` | Slash-Commands |

### Command Icons (Backend → Frontend)

Commands im Backend verwenden Icon-Identifier (strings), die im Frontend via `getCommandIcon()` zu SVG-Icons gemappt werden:

```javascript
// Backend (handlers.ts)
icon: 'robot'  // statt '🤖'

// Frontend (CommandPalette.jsx)
import { getCommandIcon } from './Icons';
{getCommandIcon(item.icon, { size: 16 })}
```

**Verfügbare Identifier:** `robot`, `lightning`, `clipboard`, `table`, `brain`, `sparkles`, `trash`, `help`, `refresh`, `search`, `code`, `pen`, `briefcase`, `chart`, `list`, `user`, `link`, `document`, `folder`, `book`, `target`, `plug`

### Neue Icons hinzufügen

Bei Bedarf neue Icons in `components/Icons.jsx` ergänzen:

```javascript
export function NewIcon({ size = 20, color = 'currentColor', style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" style={style}>
      {/* SVG paths */}
    </svg>
  );
}
```

---

## Navigation

### Back-Link (Detail → Übersicht)

Bei Detail-Seiten einen Back-Link oberhalb des Headers platzieren:

```javascript
// Style
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

// JSX
import { ArrowLeftIcon } from '../components/Icons';

<button style={styles.backLink} onClick={() => navigate('/uebersicht')}>
  <ArrowLeftIcon /> Übersicht-Titel
</button>
```

**Beispiele:**
- `<ArrowLeftIcon /> Knowledge Base` (in Collection-Detail)
- `<ArrowLeftIcon /> Tabellen` (in Tabellen-Detail)

---

## App Detail Header

Standard-Header für Detail-Seiten in Apps (z.B. Vertragsdetails, Projektauftrag-Editor).

Referenz-Implementation: `ContractDetail.jsx`, `WizardPage.jsx`

### Struktur

```
┌─────────────────────────────────────────────────────────────┐
│ ← App-Name (Back-Link)                                      │
│                                                             │
│ Titel (2xl, bold)                          [Action] [Action]│
│ Subtitle | Status-Badge | Zusatzinfo                        │
└─────────────────────────────────────────────────────────────┘
```

### Styles

```javascript
// Container
header: {
  padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`,
  borderBottom: `1px solid ${theme.colors.border}`,
},

// Back-Link (oben)
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

// Content-Bereich (Titel links, Actions rechts)
headerContent: {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
},

headerLeft: {
  flex: 1,
},

// Titel
headerTitle: {
  fontSize: theme.typography.sizes['2xl'],
  fontWeight: theme.typography.weights.bold,
  color: theme.colors.text,
  marginBottom: theme.spacing.sm,
},

// Subtitle mit Trennern und Status-Badge
headerSubtitle: {
  fontSize: theme.typography.sizes.base,
  color: theme.colors.textSecondary,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing.md,
},

// Status-Badge (im Subtitle)
statusBadge: {
  fontSize: theme.typography.sizes.xs,
  padding: `${theme.spacing.xs} ${theme.spacing.md}`,
  borderRadius: theme.borderRadius.full,
  fontWeight: theme.typography.weights.medium,
},

// Actions (rechts)
headerActions: {
  display: 'flex',
  gap: theme.spacing.md,
},

// Action-Button (Secondary)
actionButton: {
  padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
  backgroundColor: 'transparent',
  color: theme.colors.text,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.borderRadius.lg,
  fontSize: theme.typography.sizes.sm,
  fontWeight: theme.typography.weights.medium,
  cursor: 'pointer',
  transition: `all ${theme.transitions.fast}`,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing.sm,
},

// Primary Action
primaryButton: {
  backgroundColor: theme.colors.primary,
  color: '#fff',
  border: 'none',
},

// Delete Action
deleteButton: {
  color: theme.colors.error,
  borderColor: `${theme.colors.error}30`,
},
```

### JSX-Struktur

```jsx
<div style={styles.header}>
  {/* Back-Link */}
  <button style={styles.backLink} onClick={() => navigate('/apps/appname')}>
    <ArrowLeftIcon /> App-Name
  </button>

  <div style={styles.headerContent}>
    {/* Links: Titel + Subtitle */}
    <div style={styles.headerLeft}>
      <h1 style={styles.headerTitle}>Titel des Eintrags</h1>
      <div style={styles.headerSubtitle}>
        <span>Info 1</span>
        <span>|</span>
        <span style={{ ...styles.statusBadge, ...styles.statusActive }}>
          Status
        </span>
        <span>|</span>
        <span>Info 2</span>
      </div>
    </div>

    {/* Rechts: Actions */}
    <div style={styles.headerActions}>
      <button style={styles.actionButton}>
        <SomeIcon /> Aktion
      </button>
      <button style={{ ...styles.actionButton, ...styles.deleteButton }}>
        <TrashIcon /> Löschen
      </button>
      <button style={{ ...styles.actionButton, ...styles.primaryButton }}>
        <SaveIcon /> Speichern
      </button>
    </div>
  </div>
</div>
```

### Status-Badge Varianten

```javascript
// Entwurf/Draft
statusDraft: {
  backgroundColor: theme.colors.surfaceHover,
  color: theme.colors.textMuted,
},

// Aktiv
statusActive: {
  backgroundColor: theme.colors.primaryLight,
  color: theme.colors.primary,
},

// Abgeschlossen/Erfolg
statusCompleted: {
  backgroundColor: theme.colors.successLight,
  color: theme.colors.success,
},

// Warnung
statusWarning: {
  backgroundColor: theme.colors.warningLight,
  color: theme.colors.warning,
},

// Fehler/Abgebrochen
statusError: {
  backgroundColor: theme.colors.errorLight,
  color: theme.colors.error,
},
```

---

## Sprache

- UI-Texte: **Deutsch**
- Code/Variablen: **Englisch**
