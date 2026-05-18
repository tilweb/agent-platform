# Projektmanagement — Portfolios + PMO-Dashboard (Phase D)

**Datum**: 2026-05-18
**Status**: Implementiert
**Worktrees**: main (Postgres) + demo/messe (YAML)

## Kontext

Phase D der PM-Restruktur (ursprünglich nach Phase C eingeplant, dann zugunsten
Phasen E/F verschoben). Die PM-App hatte bisher nur eine Single-Project-Sicht;
PMO-Leads brauchten eine Cross-Project-Sicht. Portfolios bringen die Gruppierung,
ein dediziertes Dashboard die KPI-Sicht.

## Best-Practice-Bezug

PMI/PMBOK-Portfolio-Governance kennt drei Layer: Strategic Alignment, Portfolio
Performance, Portfolio Risk. Diese Implementation adressiert primär Performance
und Risk. Strategic Alignment lebt als Markdown-Freitext im `strategy`-Feld;
strukturierte OKR/Value-Driver-Frameworks wären ein eigenes Vorhaben.

**Dashboard-Mapping**:
| Block | PMI/PMBOK-Hebel |
|---|---|
| KPI Health-Donut | Portfolio Performance Reporting |
| Phase-Mix Bar | Pipeline Balancing |
| Budget-Abweichung | EVM auf Portfolio-Ebene |
| Top-Risiken | Aggregated Portfolio Risk Register |
| Letzte SBs | Portfolio Status Reporting |

## Datenmodell

### Postgres (main) — Tabelle `projektmgmt.portfolios`

```
id            text PK
owner_id      text NULL
name          text NOT NULL
description   text NULL          — 1-2 Sätze (Listen-Subtitle)
strategy      text NULL          — Markdown
status        text NOT NULL DEFAULT 'active'   — 'active' | 'archived'
metadata      jsonb NULL
permissions   jsonb NULL
version       integer NOT NULL DEFAULT 1
created_at    timestamptz DEFAULT now()
updated_at    timestamptz DEFAULT now()
```

Indices: `portfolio_owner_idx`, `portfolio_status_idx`.

Drizzle-Migration `0014_portfolios.sql` (idempotent, läuft beim nächsten Boot
automatisch über `runMigrations()`).

### YAML (demo/messe)

`data/apps/projektmanagement/portfolios/{id}/metadata.yaml` — camelCase analog
`projekte/{id}/metadata.yaml`.

### Kardinalität

`paProjekte.portfolioId` (existiert seit Migration 0010) ist die einzige
Verknüpfung — **0..1**. Kein FK-Constraint, weil Portfolio-Löschen die Projekte
nicht kaskadierend mitlöschen soll (application-level cleanup im Service: setzt
`portfolio_id` der zugeordneten Projekte auf NULL).

N:m wäre über eine Linktabelle möglich; in der Praxis seltener Bedarf. Migration
zu N:m später ohne Datenverlust möglich.

## API

```
GET    /portfolios                              → Liste (?status=active|archived&limit&offset)
GET    /portfolios/:id                          → Detail
POST   /portfolios                              → Anlegen (App-Editor+)
PUT    /portfolios/:id                          → Update (Portfolio-Editor+, expectedVersion)
DELETE /portfolios/:id                          → Löschen (Portfolio-Owner)
GET    /portfolios/:id/projekte                 → Zugeordnete Projekte (RBAC-gefiltert)
GET    /portfolios/:id/projekte/available       → Projekte ohne Portfolio (für Add-Selector)
GET    /portfolios/:id/dashboard                → PMO-Dashboard-Aggregat
```

Alle Endpoints unter `/api/apps/projektmanagement/...`. Mount in `routes.ts`
via `projektmanagement.route('/', portfoliosRoutes)`.

## Permissions

`denyIfBelowPortfolioRole(userId, portfolioId, required)` in
`routes/_shared.ts` — analog `denyIfBelowAuftragRole`. Helper
`getEffectivePortfolioRole` in `permissions.ts` mit dynamic import auf
`portfolio-service` (verhindert circulare Dependency mit
`defaultOwnerPermissions`).

Effektive Rolle = MAX(App-Floor, Portfolio-Resource-Rolle, Ersteller-Fallback).

## PMO-Dashboard

`portfolio-dashboard-service.ts` ist die zentrale Aggregator-Logik. Eine
Funktion, eine Antwort:

```typescript
getPortfolioDashboard(portfolioId, userId) → {
  portfolio, projekte_total, projekte_aktiv, projekte_abgeschlossen,
  health: { gruen, gelb, rot, unbekannt },
  phase_mix: { initiation, planning, execution, closing, stopped, unbekannt },
  budget: { plan_total, ist_total, abweichung_pct },
  termine: { on_track, gefaehrdet, verspaetet, unbekannt },
  top_risiken: [ ... TOP 5 ],
  letzte_statusberichte: [ ... 1 pro Projekt ]
}
```

**RBAC-Filter passiert vor Aggregation**: nur Projekte, auf die der User
mindestens Auftrags-Viewer-Rolle hat, fließen in die Counts ein. Konsequenz:
zwei User sehen evtl. unterschiedliche Dashboards im gleichen Portfolio —
gewollt, sonst würden private Projekte in Health-Aggregate leaken.

**Risk-Score-Mapping**: `appConfig.probability`/`impact` liefert
'low'|'medium'|'high'. Im Service zentral als `SCORE_MAP` (low=1, medium=2,
high=3) — Top-Risiken sortiert nach Produkt P×A (Max 9). Bei späterer 5-Stufen-
Konfiguration einfach `SCORE_MAP` erweitern.

**Performance**: bei 50+ Projekten lädt der Aggregator 50× das letzte SB
(parallel via `Promise.all`). In der Praxis < 6 Projekte/Portfolio → unkritisch.
Bei späterer Production-Skalierung kann eine Materialized View hinzukommen.

## Frontend

### Liste

`ProjektePage.jsx` Tab "Portfolios" → `PortfolioList.jsx`. Card-Grid analog
Projekt-Cards, Status-Badge, "X Projekte"-Counter, "+ Portfolio"-Button mit
einfachem Create-Modal.

### Detail

Route: `/apps/projektmanagement/portfolios/:id` → `PortfolioDetail.jsx`.

Header analog `ContractDetail.jsx`: Back-Link, Titel, Status-Badge,
Projekt-Counter im Subtitle.

4 Tabs (URL-Sync via `?tab=`):
- **Übersicht** → `PortfolioDashboard.jsx` (= das PMO-Dashboard)
- **Projekte** → Tabelle der zugeordneten Projekte + "Projekt hinzufügen"-Modal
- **Strategie** → Markdown-Textarea für `description` + `strategy`
- **Einstellungen** → Name, Status (active/archived), ConfirmModal-Delete

### Dashboard-Charts

Zwei kompakte Inline-SVG-Komponenten:
- `HealthDonut.jsx` (~95 LOC): Donut-Chart Grün/Gelb/Rot/Unbekannt + Legende
  rechts. `total` in der Mitte.
- `PhaseMixBar.jsx` (~80 LOC): Horizontale Stacked-Bar mit 5 Phase-Segmenten +
  Legende darunter. Tooltips via `title`-Attribut.

**Keine Chart-Library** — die zwei Charts sind so simpel, dass `recharts`/
`chart.js` Overkill wäre und das Frontend-Bundle bläht.

### Verknüpfung Projekt ↔ Portfolio

`PortfolioAssignCard.jsx` lebt im **Übersicht-Tab** des Projekt-Detail
(`ProjektUebersichtPanel.jsx`). Zeigt aktuellen Portfolio-Name als Link oder
„Keinem Portfolio zugeordnet". Editor+ kann via Modal ändern.

**Nicht im Wizard-Basis-Tab**: Portfolio ist Identitäts-Feld am `paProjekte`
(nicht `paProjektauftraege`). Der Wizard editiert Inhalt, nicht Identität —
ein Selector dort hätte Hybrid-Save-Logik erfordert. Übersicht-Tab ist
thematisch konsistent (zeigt eh schon Status/Owner/Zeitraum).

## Critical Files

### Backend (beide Worktrees)
- `backend/src/db/schema/projektmgmt.ts` (main) — `paPortfolios` hinzu
- `backend/drizzle/0014_portfolios.sql` (main) — Migration
- `backend/drizzle/meta/_journal.json` (main) — idx 14
- `backend/src/apps/projektmanagement/types.ts` (beide) — Portfolio-Interfaces
- `backend/src/apps/projektmanagement/portfolio-service.ts` (beide) — **neu**, CRUD
- `backend/src/apps/projektmanagement/portfolio-dashboard-service.ts` (beide) — **neu**, Aggregator
- `backend/src/apps/projektmanagement/routes/portfolios.ts` (beide) — **neu**, CRUD + Dashboard
- `backend/src/apps/projektmanagement/routes/_shared.ts` (beide) — `denyIfBelowPortfolioRole` ergänzt
- `backend/src/apps/projektmanagement/permissions.ts` (beide) — `getEffectivePortfolioRole`
- `backend/src/apps/projektmanagement/projekt-service.ts` (beide) — `listProjekteByPortfolio` (+ demo/messe `listProjekteWithoutPortfolio`)
- `backend/src/apps/projektmanagement/routes.ts` (beide) — Mount

### Frontend (beide Worktrees)
- `frontend/src/hooks/useProjektmanagement.js` — Portfolio-API
- `frontend/src/App.jsx` — Route `/apps/projektmanagement/portfolios/:id`
- `frontend/src/apps/projektmanagement/ProjektePage.jsx` — `PortfoliosPlaceholder` raus, `PortfolioList` rein
- `frontend/src/apps/projektmanagement/PortfolioDetail.jsx` — **neu**, Header + 4 Tabs
- `frontend/src/apps/projektmanagement/components/portfolio/PortfolioList.jsx` — **neu**
- `frontend/src/apps/projektmanagement/components/portfolio/PortfolioDashboard.jsx` — **neu**, Dashboard
- `frontend/src/apps/projektmanagement/components/portfolio/PortfolioAssignCard.jsx` — **neu**, Übersicht-Karte
- `frontend/src/apps/projektmanagement/components/portfolio/HealthDonut.jsx` — **neu**, SVG-Donut
- `frontend/src/apps/projektmanagement/components/portfolio/PhaseMixBar.jsx` — **neu**, SVG-Bar
- `frontend/src/apps/projektmanagement/components/ProjektUebersichtPanel.jsx` — Portfolio-Karte einbinden
- `frontend/src/apps/projektmanagement/WizardPage.jsx` — `canEdit`/`onProjektUpdated` propagieren

## Verifikation

### Backend
```sh
curl -X POST /api/apps/projektmanagement/portfolios -d '{"name":"Digitalisierung 2026"}'
# → 201; { portfolio: { id, name, status: 'active', ... } }

curl -X PUT /api/apps/projektmanagement/projekte/<projektId> -d '{"portfolioId":"<pId>"}'
# → 200

curl /api/apps/projektmanagement/portfolios/<pId>/dashboard
# → 200; { dashboard: { portfolio, projekte_total, health, phase_mix, ... } }
```

### Frontend (Browser, Akzeptanzkriterien)

| Test | Erwartet |
|---|---|
| `/apps/projektmanagement?tab=portfolios` | Echte Liste (kein Phase-D-Placeholder) |
| Portfolio anlegen + 3 Projekte zuordnen | Card zeigt „3 Projekte", Detail-Seite öffnet |
| Übersicht-Tab des Portfolios | KPI-Reihe + Donut + Stacked-Bar + Top-Risiken + letzte SBs |
| Projekt-Detail → Übersicht | Portfolio-Karte zeigt Link / „Zuordnen"-Button |
| Portfolio löschen | ConfirmModal warnt, Projekte verlieren nur Zuordnung |
| Phasenmix mit gemischten Projekten | Bar-Segmente proportional, Counts in Legende |

## Bewusst out-of-scope

- Resource Management / Kapazitätsplanung
- Stage-Gate / Investment-Approval-Workflow
- Strategic Roadmap mit Time-Phasing
- N:m-Kardinalität Projekt ↔ Portfolio
- Portfolio-übergreifende Reports
- PDF-Export des Dashboards (Browser-Print funktioniert, Layout single-page)
- KI-Vorschläge auf Portfolio-Ebene
- Portfolio-Selector im Wizard-Basis-Tab (Identitäts-Felder gehören in
  Übersicht-Tab, nicht in den Inhalts-Wizard)

## Risiken / Stolpersteine

1. **Dashboard-Performance bei vielen Projekten**: Bei großer Portfolio-Größe
   (>50 Projekte) erzeugt der Aggregator viele Datenbank-Roundtrips. Heutige
   Demo-Daten unkritisch — bei Production-Rollout ggf. Materialized View.
2. **Risk-Score-Mapping** ist auf 3-Stufen-Config (`low`/`medium`/`high`)
   ausgelegt. Custom-Konfigurationen müssen `SCORE_MAP` in
   `portfolio-dashboard-service.ts` erweitern.
3. **Permission-Drift**: Portfolio-Rolle und Auftrag-Rolle können
   unterschiedlich sein — User mit Portfolio-Viewer aber ohne Auftrag-Zugriff
   sieht ein gefiltertes Dashboard ohne diese Projekte. Das ist gewollt; UI
   zeigt aktuell aber nicht explizit „X Projekte wegen RBAC ausgefiltert".
4. **Worktree-Drift**: Frontend ist 1:1 portierbar. Backend hat zwei separate
   Service-Implementierungen (Drizzle vs YAML), die identische API-Shapes
   bieten — Tests müssen in beiden Worktrees laufen.
