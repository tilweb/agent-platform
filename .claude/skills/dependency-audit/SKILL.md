---
name: dependency-audit
description: Prüfe alle Dependencies auf Sicherheitslücken, veraltete Versionen und Lizenzprobleme.
argument-hint: "[security|outdated|licenses|summary]"
---

# Dependency-Audit

Prüfe alle Dependencies auf Sicherheitslücken, veraltete Versionen und Lizenzprobleme.

## Argument: $ARGUMENTS (optional)

Standard: vollständiger Audit. Optionen: `security` (nur Sicherheitslücken), `outdated` (nur veraltete Packages), `licenses` (nur Lizenzprüfung), `summary` (nur Übersicht)

## Vorgehen

### Schritt 1: Package-Inventar

Lies die Dependency-Listen:

1. **Backend**: `backend/package.json` — `dependencies` und `devDependencies`
2. **Frontend**: `frontend/package.json` — `dependencies` und `devDependencies`
3. Zähle jeweils die Anzahl der Packages

### Schritt 2: Sicherheitsaudit

Führe Security-Audits für beide Projekte aus:

**Frontend:**
```bash
cd frontend && npm audit --json 2>/dev/null || true
```

**Backend (Bun):**
```bash
cd backend && bun pm ls 2>/dev/null || true
```

Hinweis: `bun audit` existiert nicht nativ. Als Alternative:
- Lies `backend/bun.lock` oder `backend/node_modules/.package-lock.json`
- Prüfe bekannte CVEs für die wichtigsten Backend-Dependencies manuell (Hono, yaml, argon2, etc.)

Kategorisiere Findings:
- **KRITISCH**: Remote Code Execution, Auth Bypass
- **HOCH**: XSS, SQL Injection, Path Traversal
- **MITTEL**: DoS, Information Disclosure
- **NIEDRIG**: Sonstige

### Schritt 3: Veraltete Packages

**Frontend:**
```bash
cd frontend && npm outdated --json 2>/dev/null || true
```

**Backend:**
```bash
cd backend && bun outdated 2>/dev/null || true
```

Kategorisiere:
- **Major-Update verfügbar**: Breaking Changes möglich — prüfen
- **Minor-Update verfügbar**: Neue Features, abwärtskompatibel
- **Patch-Update verfügbar**: Bugfixes — sofort aktualisieren

Besonderes Augenmerk auf:
- Frameworks (Hono, React, Vite) — Major-Updates erfordern Migrationsaufwand
- Security-relevante Packages (argon2, jose) — immer aktuell halten
- Dev-Dependencies (TypeScript, ESLint) — niedriger Priorität

### Schritt 4: Lizenzprüfung

Prüfe die Lizenzen der Direct-Dependencies (nicht transitive):

1. Lies `package.json` beider Projekte
2. Für jede Dependency: Prüfe das `license`-Feld in `node_modules/<pkg>/package.json`
3. Kategorisiere:
   - **Permissive (OK)**: MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD
   - **Copyleft (Warnung)**: GPL, LGPL, AGPL, MPL — können Lizenzpflichten auslösen
   - **Unbekannt**: Kein License-Feld oder unübliche Lizenz — manuell prüfen

### Schritt 5: Zusammenfassung

```
## Dependency-Audit Ergebnis

### Übersicht
- Backend Dependencies: X (davon Y devDependencies)
- Frontend Dependencies: X (davon Y devDependencies)

### Sicherheit
| Severity | Backend | Frontend | Details |
|----------|---------|----------|---------|
| KRITISCH | X | X | ... |
| HOCH | X | X | ... |
| MITTEL | X | X | ... |
| NIEDRIG | X | X | ... |

### Veraltete Packages
| Package | Aktuell | Verfügbar | Typ | Projekt |
|---------|---------|-----------|-----|---------|
| hono | 3.x | 4.x | Major | Backend |
| react | 19.0.0 | 19.1.0 | Minor | Frontend |

### Lizenzen
- Permissive: X Packages
- Copyleft: X Packages (Details unten)
- Unbekannt: X Packages

### Handlungsempfehlungen
1. [Priorität 1: Security-Patches sofort einspielen]
2. [Priorität 2: Veraltete Security-Packages updaten]
3. [Priorität 3: Minor/Patch-Updates sammeln und einspielen]
```

## Wichtig

- **Nur lesen und prüfen, nicht ändern** — der Audit ist read-only
- Bei `npm audit` Findings: Prüfe ob der betroffene Code-Pfad tatsächlich genutzt wird
- Transitive Dependencies nur bei KRITISCH/HOCH reporten
- Bei `$ARGUMENTS` = `summary` nur die Übersicht und Handlungsempfehlungen zeigen
