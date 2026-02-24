# Komponenten

Die Plattform stellt wiederverwendbare Komponenten bereit, die Sie in Ihren Apps nutzen können. Diese Seite dokumentiert die wichtigsten Bausteine.

## Select (Dropdown)

Für alle Dropdowns die zentrale `Select`-Komponente verwenden. Keine nativen `<select>`-Elemente.

```jsx
import Select from '../../components/Select';

// Mit options-Prop
<Select
  value={selectedType}
  onChange={(e) => setSelectedType(e.target.value)}
  options={[
    { value: 'all', label: 'Alle Typen' },
    { value: 'active', label: 'Aktiv' },
    { value: 'draft', label: 'Entwurf' },
  ]}
/>

// Mit Placeholder
<Select
  value={value}
  onChange={handler}
  placeholder="Bitte wählen..."
  options={options}
/>
```

## Toast-Notifications

Für Feedback bei Benutzeraktionen immer `useToast()` verwenden:

```jsx
import { useToast } from '../../components/Toast';

function MyComponent() {
  const toast = useToast();

  const handleSave = async () => {
    try {
      await apiPost('/apps/meine-app/items', data);
      toast.success('Gespeichert', 'Eintrag wurde erstellt');
    } catch (err) {
      toast.error('Fehler', err.message);
    }
  };
}
```

Verfügbare Methoden:

| Methode | Farbe | Auto-Hide |
|---------|-------|-----------|
| `toast.success(title, message)` | Grün | 5 Sekunden |
| `toast.error(title, message)` | Rot | 8 Sekunden |
| `toast.warning(title, message)` | Gelb | 5 Sekunden |
| `toast.info(title, message)` | Blau | 5 Sekunden |

> [!warning]
> Verwenden Sie niemals `alert()`, `window.confirm()` oder stille Operationen ohne Feedback.

## Icons

Icons werden als SVG-Komponenten aus `components/Icons.jsx` importiert:

```jsx
import { SearchIcon, DocumentIcon, TrashIcon } from '../../components/Icons';

<SearchIcon size={16} color={theme.colors.primary} />
<TrashIcon size={18} color={theme.colors.error} />
```

Für Backend-Commands gibt es `getCommandIcon()`:

```jsx
import { getCommandIcon } from '../../components/Icons';

// Rendert das passende SVG-Icon für eine Icon-ID
{getCommandIcon('robot', { size: 16 })}
```

Verfügbare Icon-IDs: `robot`, `lightning`, `clipboard`, `table`, `brain`, `sparkles`, `trash`, `help`, `refresh`, `search`, `code`, `pen`, `briefcase`, `chart`, `list`, `user`, `link`, `document`, `folder`, `book`, `target`, `plug`.

> [!tip]
> Keine Emojis in der UI verwenden (Ausnahme: Länder-Flags). Immer SVG-Icons aus `Icons.jsx`.

## Status-Badges

```javascript
const styles = {
  statusBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
  },
  statusActive: {
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
  },
  statusSuccess: {
    backgroundColor: theme.colors.successLight,
    color: theme.colors.success,
  },
  statusWarning: {
    backgroundColor: theme.colors.warningLight,
    color: theme.colors.warning,
  },
  statusError: {
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
  },
  statusMuted: {
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textMuted,
  },
};
```

```jsx
<span style={{ ...styles.statusBadge, ...styles.statusActive }}>
  Aktiv
</span>
```

## Cards

```javascript
card: {
  backgroundColor: theme.colors.surface,
  borderRadius: theme.borderRadius.xl,
  border: `1px solid ${theme.colors.border}`,
  padding: theme.spacing.xl,
  transition: `all ${theme.transitions.fast}`,
},
```

## Tabs (Pill-Style)

```javascript
const styles = {
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
};
```

## Buttons

**Primary:**
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

**Secondary:**
```javascript
{
  padding: `${theme.spacing.md} ${theme.spacing.lg}`,
  backgroundColor: 'transparent',
  color: theme.colors.text,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.borderRadius.lg,
}
```

**Danger:**
```javascript
{
  backgroundColor: 'transparent',
  color: theme.colors.error,
  border: `1px solid ${theme.colors.error}30`,
}
```

## Modals

```javascript
const styles = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    maxWidth: '700px',
    width: '90%',
    maxHeight: '90vh',
    overflow: 'auto',
  },
};
```

## Toggle (An/Aus)

Für Aktivieren/Deaktivieren immer die SVG Toggle-Icons verwenden:

```jsx
function ToggleOnIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
         stroke={theme.colors.success} strokeWidth="2">
      <rect x="1" y="5" width="22" height="14" rx="7" ry="7" />
      <circle cx="16" cy="12" r="3" fill={theme.colors.success} />
    </svg>
  );
}

function ToggleOffIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2">
      <rect x="1" y="5" width="22" height="14" rx="7" ry="7" />
      <circle cx="8" cy="12" r="3" />
    </svg>
  );
}
```

> [!warning]
> Keine CSS-Toggle-Switches, native Checkboxen oder eigene Varianten — immer diese SVG Toggle-Icons.

## Empty State

Für leere Listen einen informativen Platzhalter anzeigen:

```jsx
{items.length === 0 && !loading && (
  <div style={{
    textAlign: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
  }}>
    <p style={{
      fontSize: theme.typography.sizes.base,
      marginBottom: theme.spacing.md,
    }}>
      Noch keine Einträge vorhanden
    </p>
    <button style={styles.primaryButton} onClick={handleCreate}>
      Ersten Eintrag erstellen
    </button>
  </div>
)}
```
