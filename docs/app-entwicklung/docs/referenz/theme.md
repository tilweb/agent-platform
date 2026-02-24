# Theme-Referenz

Vollständige Referenz aller Werte aus `frontend/src/config/theme.js`. Importieren Sie das Theme in jeder Komponente:

```javascript
import { theme } from '../../config/theme';
```

## Farben (`theme.colors`)

### Primärfarben

| Token | Wert | Beschreibung |
|-------|------|--------------|
| `primary` | `#14b8a6` | Primäraktionen, Links, aktive Elemente |
| `primaryHover` | `#0d9488` | Hover-Zustand von Primärelementen |
| `primaryLight` | `#ccfbf1` | Hintergrund aktiver Tabs, Badges |
| `primaryDark` | `#0f766e` | Dunkle Primärvariante |

### Hintergrund

| Token | Wert | Beschreibung |
|-------|------|--------------|
| `background` | `#f8fafc` | Seitenhintergrund |
| `surface` | `#ffffff` | Cards, Modals, Panels |
| `surfaceHover` | `#f1f5f9` | Hover auf Oberflächen |
| `surfaceElevated` | `#ffffff` | Erhöhte Elemente |

### Text

| Token | Wert | Beschreibung |
|-------|------|--------------|
| `text` | `#0f172a` | Überschriften, primärer Text |
| `textSecondary` | `#475569` | Fließtext, Beschreibungen |
| `textMuted` | `#94a3b8` | Labels, Platzhalter, deaktivierter Text |
| `textLight` | `#cbd5e1` | Sehr heller Text |

### Rahmen

| Token | Wert | Beschreibung |
|-------|------|--------------|
| `border` | `#e2e8f0` | Standard-Rahmen |
| `borderLight` | `#f1f5f9` | Leichter Rahmen |
| `borderFocus` | `#14b8a6` | Focus-Ring |

### Status

| Token | Wert | Light-Variante | Beschreibung |
|-------|------|----------------|--------------|
| `success` | `#10b981` | `#d1fae5` | Erfolg, aktiv |
| `warning` | `#f59e0b` | `#fef3c7` | Warnung, auslaufend |
| `error` | `#ef4444` | `#fee2e2` | Fehler, gelöscht |
| `info` | `#3b82f6` | `#dbeafe` | Information |

## Spacing (`theme.spacing`)

| Token | Wert | Pixel | Typische Verwendung |
|-------|------|-------|---------------------|
| `xs` | `0.25rem` | 4px | Micro-Abstände, Badge-Padding |
| `sm` | `0.5rem` | 8px | Kompakte Innen-Abstände |
| `md` | `0.75rem` | 12px | Standard-Padding |
| `lg` | `1rem` | 16px | Gruppen-Abstände |
| `xl` | `1.5rem` | 24px | Sektions-Padding |
| `2xl` | `2rem` | 32px | Seiten-Padding |
| `3xl` | `3rem` | 48px | Große Abstände |

## Typografie (`theme.typography`)

### Schriftfamilien

| Token | Wert |
|-------|------|
| `fontFamily` | `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` |
| `fontMono` | `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace` |

### Schriftgrößen (`theme.typography.sizes`)

| Token | Wert | Pixel | Verwendung |
|-------|------|-------|------------|
| `xs` | `0.75rem` | 12px | Labels, Badges, Hinweise |
| `sm` | `0.8125rem` | 13px | Kompakter Text, Nav-Items |
| `base` | `0.875rem` | 14px | Standard-Text, Eingabefelder |
| `md` | `1rem` | 16px | H4, größerer Text |
| `lg` | `1.125rem` | 18px | H3, Sidebar-Titel |
| `xl` | `1.25rem` | 20px | H2, Abschnitts-Titel |
| `2xl` | `1.5rem` | 24px | H1, Seiten-Titel |
| `3xl` | `1.875rem` | 30px | Hero-Titel |

### Schriftgewichte (`theme.typography.weights`)

| Token | Wert | Verwendung |
|-------|------|------------|
| `normal` | 400 | Fließtext |
| `medium` | 500 | Labels, Navigation |
| `semibold` | 600 | Überschriften, Badges |
| `bold` | 700 | Seiten-Titel |

### Zeilenhöhe (`theme.typography.lineHeight`)

| Token | Wert | Verwendung |
|-------|------|------------|
| `tight` | 1.25 | Überschriften |
| `normal` | 1.5 | Standard |
| `relaxed` | 1.625 | Fließtext, Beschreibungen |

## Border-Radius (`theme.borderRadius`)

| Token | Wert | Pixel | Verwendung |
|-------|------|-------|------------|
| `sm` | `0.25rem` | 4px | Inline-Code, kleine Tags |
| `md` | `0.5rem` | 8px | Buttons, Tabs, Inputs |
| `lg` | `0.75rem` | 12px | Cards, Panels |
| `xl` | `1rem` | 16px | Große Cards, Modals |
| `2xl` | `1.5rem` | 24px | Hero-Bereiche |
| `full` | `9999px` | Pill | Badges, Avatare |

## Schatten (`theme.shadows`)

| Token | Wert | Verwendung |
|-------|------|------------|
| `sm` | `0 1px 2px 0 rgb(0 0 0 / 0.05)` | Subtile Tiefe |
| `md` | `0 4px 6px -1px rgb(0 0 0 / 0.07), ...` | Cards, Hover |
| `lg` | `0 10px 15px -3px rgb(0 0 0 / 0.08), ...` | Dropdowns |
| `xl` | `0 20px 25px -5px rgb(0 0 0 / 0.1), ...` | Modals |
| `panel` | `0 25px 50px -12px rgb(0 0 0 / 0.15)` | Vollbild-Panels |

## Transitions (`theme.transitions`)

| Token | Wert | Verwendung |
|-------|------|------------|
| `fast` | `150ms ease` | Hover-Effekte, Farb-Übergänge |
| `normal` | `200ms ease` | Einblendungen, Slide |
| `slow` | `300ms ease` | Komplexe Animationen |

## Layout (`theme.layout`)

| Token | Wert | Beschreibung |
|-------|------|--------------|
| `sidebarWidth` | `240px` | Breite der Haupt-Sidebar |
| `headerHeight` | `64px` | Höhe der Header-Leiste |
| `maxContentWidth` | `900px` | Maximale Inhaltsbreite |
| `chatPanelWidth` | `400px` | Breite des Chat-Panels |
