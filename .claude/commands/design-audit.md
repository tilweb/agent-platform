# Design-Audit

Führe einen systematischen Design-Audit aller Frontend-Komponenten durch.

## Argument: $ARGUMENTS (optional)

Standard: alle Frontend-Dateien. Optionen: `pages`, `components`, `summary`

## Vorgehen

### Schritt 1: Design-Vorgaben laden

Lies `frontend/CLAUDE.md` vollständig — das ist die Single Source of Truth für alle UI-Patterns.

### Schritt 2: Alle Frontend-Dateien scannen

Durchsuche `frontend/src/pages/*.jsx` und `frontend/src/components/*.jsx` auf folgende Violations:

#### Kategorie A: Hardcoded Werte (Severity: HOCH)

Suche nach Patterns, die NICHT `theme.*` referenzieren:

1. **Hardcoded Farben**: Hex-Werte (`#14b8a6`, `#ef4444` etc.) die direkt in Styles stehen statt `theme.colors.*`
   - Erlaubt: `#fff`, `#000`, `transparent`, `currentColor`, Hex-Suffixe für Opacity (`${theme.colors.error}30`)
2. **Hardcoded Spacing**: Pixel-Werte (`16px`, `24px`) oder rem-Werte (`1rem`) direkt in Styles statt `theme.spacing.*`
   - Erlaubt: `0`, `1px`, `2px` (für Borders/minimale Offsets), `50%`, `100%`
3. **Hardcoded Font-Sizes**: Font-Größen die nicht `theme.typography.sizes.*` verwenden
4. **Hardcoded Border-Radius**: Werte die nicht `theme.borderRadius.*` verwenden
5. **Hardcoded Shadows**: Box-Shadow Werte die nicht `theme.shadows.*` verwenden

#### Kategorie B: Pattern-Violations (Severity: HOCH)

1. **CSS Toggle-Switches**: Eigene Toggle/Switch Implementierungen mit `position: relative/absolute` und beweglichem Dot — Standard ist `ToggleOnIcon`/`ToggleOffIcon`
2. **Native Checkboxen als Toggles**: `<input type="checkbox">` für Enable/Disable — Standard ist Toggle-Icon-Button
3. **CSS-Datei-Imports**: `import './styles.css'` oder ähnlich — Standard ist Inline-Styles
4. **Externe Icon-Libraries**: Font-Awesome, Material Icons, react-icons — Standard ist `Icons.jsx`

#### Kategorie C: Konsistenz-Violations (Severity: MITTEL)

1. **Emojis in UI**: Jede Emoji-Nutzung außer Länder-Flags
2. **Duplizierte Toggle-Icons**: `ToggleOnIcon`/`ToggleOffIcon` in mehreren Dateien statt zentral in `Icons.jsx`
3. **Inkonsistente Button-Styles**: Buttons die nicht dem Primary/Secondary/Danger Pattern entsprechen
4. **Inkonsistente Card-Styles**: Cards mit anderen borderRadius/padding als `theme.borderRadius.xl`/`theme.spacing.xl`
5. **fehlender `const styles = {}`**: Styles direkt inline statt in einem Style-Objekt am Dateianfang

#### Kategorie D: Verbesserungspotenzial (Severity: NIEDRIG)

1. **Nicht-zentralisierte Icons**: SVG-Icons direkt in Seiten definiert statt in `Icons.jsx`
2. **Hardcoded Transitions**: `150ms ease` statt `theme.transitions.fast`
3. **Inkonsistente Hover-States**: Fehlende oder anders implementierte Hover-Effekte

### Schritt 3: Ergebnis-Matrix

Erstelle eine Tabelle mit allen Findings:

```
| Datei | Kategorie | Severity | Zeile | Finding | Empfehlung |
|-------|-----------|----------|-------|---------|------------|
```

### Schritt 4: Zusammenfassung

Erstelle eine Zusammenfassung:

```
## Design-Audit Ergebnis

Geprüfte Dateien: X
Violations gesamt: X

| Severity | Anzahl |
|----------|--------|
| HOCH     | X      |
| MITTEL   | X      |
| NIEDRIG  | X      |

### Top-Priorities (HOCH Severity)
- ...

### Empfohlene Maßnahmen
1. ...
```

### Schritt 5: Zentralisierung prüfen

Prüfe speziell ob `ToggleOnIcon`/`ToggleOffIcon` in mehreren Dateien dupliziert sind und empfehle die Zentralisierung in `Icons.jsx`.

## Wichtig

- **Nur lesen, nicht ändern** — der Audit ist read-only
- Jedes Finding mit **exakter Datei und Zeilennummer** angeben
- Prüfe den **tatsächlichen Code**, nicht nur Patterns — false positives vermeiden
- Wenn `$ARGUMENTS` = `summary` ist, nur die Zusammenfassung ausgeben
