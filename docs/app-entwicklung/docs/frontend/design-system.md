# Design-System

Alle Frontend-Komponenten verwenden das zentrale Theme aus `frontend/src/config/theme.js`. Hardcodierte Werte für Farben, Abstände oder Schriftgrößen sind nicht erlaubt.

## Theme importieren

```javascript
import { theme } from '../../config/theme';
```

## Inline-Styles

Styles werden als JavaScript-Objekte am Dateianfang definiert. Es werden keine CSS-Dateien, CSS-Frameworks oder CSS-in-JS-Bibliotheken verwendet.

```javascript
const styles = {
  container: {
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
  },
  title: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
};
```

## Farben

| Token | Wert | Verwendung |
|-------|------|------------|
| `theme.colors.primary` | `#14b8a6` | Primäraktionen, Links, aktive Elemente |
| `theme.colors.primaryHover` | `#0d9488` | Hover-Zustand von Primärelementen |
| `theme.colors.primaryLight` | `#ccfbf1` | Hintergrund aktiver Tabs/Badges |
| `theme.colors.background` | `#f8fafc` | Seitenhintergrund |
| `theme.colors.surface` | `#ffffff` | Cards, Modals, Container |
| `theme.colors.surfaceHover` | `#f1f5f9` | Hover-Zustand von Oberflächen |
| `theme.colors.text` | `#0f172a` | Überschriften, primärer Text |
| `theme.colors.textSecondary` | `#475569` | Fließtext, Beschreibungen |
| `theme.colors.textMuted` | `#94a3b8` | Labels, Platzhalter |
| `theme.colors.border` | `#e2e8f0` | Rahmen, Trennlinien |
| `theme.colors.success` | `#10b981` | Erfolg-Status |
| `theme.colors.warning` | `#f59e0b` | Warnungen |
| `theme.colors.error` | `#ef4444` | Fehler |
| `theme.colors.info` | `#3b82f6` | Informationen |

Für Hintergründe von Status-Badges gibt es jeweils die `*Light`-Variante (`successLight`, `warningLight`, `errorLight`, `infoLight`).

## Spacing

| Token | Wert | Pixel |
|-------|------|-------|
| `theme.spacing.xs` | `0.25rem` | 4px |
| `theme.spacing.sm` | `0.5rem` | 8px |
| `theme.spacing.md` | `0.75rem` | 12px |
| `theme.spacing.lg` | `1rem` | 16px |
| `theme.spacing.xl` | `1.5rem` | 24px |
| `theme.spacing['2xl']` | `2rem` | 32px |
| `theme.spacing['3xl']` | `3rem` | 48px |

## Typografie

**Schriftgrößen:**

| Token | Wert | Pixel |
|-------|------|-------|
| `theme.typography.sizes.xs` | `0.75rem` | 12px |
| `theme.typography.sizes.sm` | `0.8125rem` | 13px |
| `theme.typography.sizes.base` | `0.875rem` | 14px |
| `theme.typography.sizes.md` | `1rem` | 16px |
| `theme.typography.sizes.lg` | `1.125rem` | 18px |
| `theme.typography.sizes.xl` | `1.25rem` | 20px |
| `theme.typography.sizes['2xl']` | `1.5rem` | 24px |
| `theme.typography.sizes['3xl']` | `1.875rem` | 30px |

**Schriftgewichte:**

| Token | Wert |
|-------|------|
| `theme.typography.weights.normal` | 400 |
| `theme.typography.weights.medium` | 500 |
| `theme.typography.weights.semibold` | 600 |
| `theme.typography.weights.bold` | 700 |

## Border-Radius

| Token | Wert | Pixel |
|-------|------|-------|
| `theme.borderRadius.sm` | `0.25rem` | 4px |
| `theme.borderRadius.md` | `0.5rem` | 8px |
| `theme.borderRadius.lg` | `0.75rem` | 12px |
| `theme.borderRadius.xl` | `1rem` | 16px |
| `theme.borderRadius['2xl']` | `1.5rem` | 24px |
| `theme.borderRadius.full` | `9999px` | Pill-Form |

## Transitions

| Token | Wert | Verwendung |
|-------|------|------------|
| `theme.transitions.fast` | `150ms ease` | Hover, Farb-Übergänge |
| `theme.transitions.normal` | `200ms ease` | Einblendungen |
| `theme.transitions.slow` | `300ms ease` | Komplexe Animationen |

## Hover-Handling

Hover-Effekte werden über `onMouseEnter`/`onMouseLeave`-Events gesteuert:

```jsx
<div
  style={styles.card}
  onMouseEnter={(e) => {
    e.currentTarget.style.borderColor = theme.colors.primary;
    e.currentTarget.style.boxShadow = theme.shadows.md;
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.borderColor = theme.colors.border;
    e.currentTarget.style.boxShadow = 'none';
  }}
>
  Card-Inhalt
</div>
```

## Verbotene Patterns

| Verboten | Richtig |
|----------|---------|
| `color: '#14b8a6'` | `color: theme.colors.primary` |
| `padding: '16px'` | `padding: theme.spacing.lg` |
| `fontSize: '14px'` | `fontSize: theme.typography.sizes.base` |
| CSS-Dateien | Inline-Styles mit `const styles = {}` |
| Tailwind/Bootstrap | `theme.js`-Werte |
