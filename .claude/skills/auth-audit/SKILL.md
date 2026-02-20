---
name: auth-audit
description: Fuehre ein fokussiertes Auth-Audit aller Backend-Endpunkte durch.
argument-hint: "[route-scope]"
---

Fuehre ein fokussiertes Auth-Audit aller Backend-Endpunkte durch.

Optionaler Scope: $ARGUMENTS (default: alle Routes)

---

## Vorgehen

1. Lies `backend/src/index.ts` um alle gemounteten Routes zu identifizieren
2. Analysiere **jede** Route-Datei in `backend/src/routes/`
3. Erstelle eine vollstaendige Endpunkt-Matrix
4. Bewerte jedes Finding

---

## Pruefschritte pro Route-Datei

### A) Import-Check
- Wird `authMiddleware` aus `../../auth/middleware` importiert?
- Wird stattdessen `optionalAuthMiddleware` verwendet? (Warnung)
- Wird gar keine Auth importiert? (Kritisch)

### B) Anwendungs-Check
- **Router-Level**: `.use('/*', authMiddleware)` — schuetzt alle Endpunkte
- **Per-Endpoint**: `router.get('/path', authMiddleware, handler)` — schuetzt einzelne Endpunkte
- **Kein Schutz**: Handler ohne Auth-Middleware

### C) RBAC-Check (wo anwendbar)
- Wird `requireRole` oder `adminMiddleware` NACH `authMiddleware` angewendet?
- RBAC ohne vorheriges Auth = kritischer Fehler

### D) Bewusste Ausnahmen identifizieren
Folgende Endpunkte SOLLEN offen sein:
- `/health` — Health-Check
- `/api/auth/login`, `/register`, `/logout`, `/me`, `/status` — Auth-Bootstrap
- `/api/shared/:token` — Oeffentlicher Chat-Zugriff (Token-basiert)
- `/api/connections/:id/callback` — OAuth-Callback (State-validiert)

Alle anderen offenen Endpunkte muessen begruendet sein.

---

## Output-Format

### Endpunkt-Matrix

Erstelle eine vollstaendige Tabelle:

```
| Route-Datei | Pfad | Methode | Auth | RBAC | Bewertung |
|-------------|------|---------|------|------|-----------|
| agents.ts | /api/agents/* | ALL | .use() authMiddleware | — | OK |
| auth.ts | /api/auth/login | POST | keine | — | Bewusst offen |
| mcp.ts | /api/mcp/* | ALL | KEINE | — | KRITISCH |
```

Auth-Werte: `authMiddleware`, `optionalAuth`, `keine`
Bewertung: `OK`, `Bewusst offen`, `Warnung`, `KRITISCH`

### Zusammenfassung

```
Geprueft: X Route-Dateien, Y Endpunkte
Geschuetzt: X Endpunkte
Bewusst offen: X Endpunkte
Warnung: X Endpunkte
KRITISCH: X Endpunkte (= SOFORT FIXEN)
```

### Handlungsempfehlungen

Fuer jedes KRITISCH/Warnung-Finding:
1. Datei + Zeilennummer
2. Welche Endpunkte betroffen sind
3. Konkreter Fix (Code-Vorschlag)

---

## Wichtige Regeln

- **Vollstaendig sein**: JEDE Route-Datei pruefen, JEDEN Endpunkt listen
- **Keine Annahmen**: Nicht annehmen dass Auth "woanders" angewendet wird — pruefen
- **index.ts lesen**: Pruefen welche Route-Prefix Zuordnungen existieren
- **Sub-Router beachten**: chat.ts exportiert mehrere Sub-Router (chatRoutes, skillRoutes, toolRoutes, etc.) — jeden einzeln pruefen
