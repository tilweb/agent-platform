# Statusberichte fuer Projektmanagement App

**Datum**: 2026-03-27
**Scope**: Phase 1 — Tabs Basis und Ziele

## Kontext

Projektauftraege definieren den Rahmen. Nach Genehmigung (Status "active") beginnt die Durchfuehrung. Statusberichte dokumentieren den Fortschritt waehrend der Durchfuehrung. Sie referenzieren Daten aus dem Projektauftrag und ergaenzen Tracking-Felder.

## Entscheidungen

1. **Modus-Umschaltung**: Segmented Control im WizardPage Header wechselt zwischen Projektauftrag und Statusberichte. Kein Routing-Wechsel.
2. **Blade-Navigation**: Linke Sidebar im SB-Modus zeigt chronologische Liste aller Berichte mit Ampel-Punkt.
3. **Tabs frei navigierbar**: Keine sequenzielle Wizard-Logik, alle Tabs direkt klickbar.
4. **Criteria-Snapshot**: Erfolgskriterien werden bei Erstellung kopiert — Entkopplung bei spaeterer Aenderung im Auftrag.
5. **Pre-Fill**: Folgeberichte uebernehmen Tracking vom letzten Bericht. Ampel und Summary starten leer.
6. **Storage**: Statusberichte als YAML unter `{projektId}/statusberichte/`.
7. **Kein KnowledgePanel** im Statusbericht-Modus.

## Aenderungen

### Backend (4 Dateien)
- `types.ts`: Interfaces AmpelStatus, CriterionTracking, Statusbericht, StatusberichtDashboardEntry
- `storage.ts`: CRUD-Funktionen (generate ID, get/save/delete Statusberichte)
- `statusbericht-service.ts`: Neuer Service (create mit Pre-Fill, list, update, remove, dashboard)
- `routes.ts`: 6 Endpoints (CRUD unter projektauftraege/:id/statusberichte + Dashboard)

### Frontend (7 Dateien)
- `useProjektmanagement.js`: 6 neue Hook-Methoden
- `StatusberichtBasis.jsx`: Ampel-Toggle, Datum, Management Summary
- `StatusberichtZiele.jsx`: Read-only Ziele + Kriterien-Tracking (Fortschritt, Ampel, Bemerkung) + Drift-Erkennung
- `StatusberichtBlade.jsx`: Linke Sidebar mit Berichtsliste + Neuer-Bericht-Button
- `StatusberichteDashboard.jsx`: Aktive Projekte mit letzter Ampel fuer ProjektePage
- `WizardPage.jsx`: Mode-Toggle, SB-State, SB-Save, Layout-Umschaltung
- `ProjektePage.jsx`: Statusberichte-Tab aktiviert, Dashboard eingebunden

## API-Endpoints

```
POST   /projektauftraege/:id/statusberichte         # Erstellen
GET    /projektauftraege/:id/statusberichte         # Liste
GET    /projektauftraege/:id/statusberichte/:sbId   # Detail
PUT    /projektauftraege/:id/statusberichte/:sbId   # Update
DELETE /projektauftraege/:id/statusberichte/:sbId   # Loeschen (nur draft)
GET    /statusberichte/dashboard                     # Dashboard
```

## Datenmodell

```typescript
Statusbericht {
  id, projekt_id, nummer,
  ampel: 'gruen' | 'gelb' | 'rot',
  datum, management_summary,
  criteria_snapshot: string[],
  criteria_tracking: { fortschritt, ampel, bemerkung }[],
  status: 'draft' | 'final',
  created_at, updated_at, created_by
}
```
