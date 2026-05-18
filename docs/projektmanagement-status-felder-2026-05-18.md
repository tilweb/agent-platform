# Projektmanagement — Status-Felder im Überblick

**Datum**: 2026-05-18
**Status**: Referenz
**Zweck**: Klarheit über die sechs nebeneinander existierenden Status-Felder in der PM-App.

## Kontext

Die PM-App hat sich über mehrere Phasen entwickelt; dabei sind verschiedene Status-Konzepte parallel entstanden. Sie sind nicht beliebig redundant — die meisten haben eine eigene Semantik —, aber das ist beim Lesen des Codes nicht offensichtlich. Diese Doku ist die Wahrheit darüber, was jedes Feld bedeutet und wer es wann setzt.

## Übersicht

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            STATUS-FELDER PRO ENTITY                          │
└─────────────────────────────────────────────────────────────────────────────┘

Projektidee              Projekt (paProjekte)         Projektauftrag
─────────────            ──────────────────           ──────────────
.status                  .lifecycle (Phase A,         .status         (Wizard-Phase)
  draft                    UI-mäßig deprecated)        draft
  review                   planning                    active
  approved                 active                      completed
  rejected                 closed                      cancelled
  archived                 cancelled                  .project_status  (PM-Phase, manuell)
                                                       initiation
                                                       planning
                                                       execution
                                                       closing
                                                       stopped


Statusbericht            Abschlussbericht
─────────────            ────────────────
.status                  .status
  draft                    draft
  final                    final
```

## Pro Feld: was es bedeutet + wer es setzt

### 1. `Projektidee.status`

| Werte | Bedeutung | Wer setzt? | Wo? |
|---|---|---|---|
| `draft` | Frischer Entwurf, noch nicht zur Prüfung | User (Default beim Anlegen) | Idee-Wizard |
| `review` | In Prüfung beim PMO | User | Idee-Wizard |
| `approved` | Freigegeben — kann zu Projekt promoted werden | User/PMO | Idee-Wizard |
| `rejected` | Abgelehnt — Idee wird nicht weiterverfolgt | User/PMO | Idee-Wizard |
| `archived` | Aus dem aktiven Workflow raus | User | Idee-Wizard |

**Verwendung**: Filter in der Ideen-Liste; `archived` blendet aus dem Default-View aus.

### 2. `Projekt.lifecycle` (paProjekte-Tabelle)

| Werte | Bedeutung |
|---|---|
| `planning` | Vor-Freigabe (Projekt ist angelegt, Auftrag in Vorbereitung) |
| `active` | Laufendes Projekt |
| `closed` | Abgeschlossen (mit Abschlussbericht final) |
| `cancelled` | Abgebrochen |

**Status**: In Phase A eingeführt als Kandidat für "die eine Wahrheit". In Phase F entschieden: `auftrag.project_status` ist stattdessen die UI-Wahrheit (siehe unten). `paProjekte.lifecycle` bleibt aus Backward-Compat im Schema, wird aber **nicht mehr UI-gesetzt**. Aufräum-Migration `0013_drop_lifecycle.sql` ist eingeplant (TD1).

**Wer setzt?** Phase-A-Migration (aus `auftrag.status`) und der `migrate-projekte`-Boot-Hook. Im aktuellen UI nicht mehr verändert.

### 3. `Projektauftrag.status`

| Werte | Bedeutung | Wer setzt? |
|---|---|---|
| `draft` | Wizard-Entwurf, noch nicht freigegeben | User (Default) |
| `active` | Auftrag freigegeben, Projekt läuft | User (Basis-Tab "Projektauftragsstatus") |
| `completed` | Auftrag erledigt | User |
| `cancelled` | Auftrag eingestellt | User |

**Semantik**: Beschreibt den **Auftrag selbst** (Freigabe-State), nicht das Projekt. Ein Auftrag mit `active` bedeutet: das Dokument ist freigegeben, das Projekt darf starten.

**Wo gepflegt?** Im Basis-Tab des Wizards als „Projektauftragsstatus"-Select. Config-Key in der App-Config: `order_status`.

### 4. `Projektauftrag.project_status`

| Werte | Bedeutung | Wer setzt? |
|---|---|---|
| `initiation` | Initiierungsphase | User |
| `planning` | Planungsphase | User |
| `execution` | Umsetzung läuft | User |
| `closing` | Abschluss-Phase | User (z.B. via Phase-F-Modal) |
| `stopped` | Gestoppt | User |

**Semantik**: Beschreibt die **aktuelle Projekt-Phase** im PMO-Sinne (Initiierung→Planung→Umsetzung→Abschluss). Orthogonal zu `auftrag.status` (Freigabe-State).

**Wo gepflegt?** Im Basis-Tab des Wizards als „Projektstatus"-Select. Config-Key: `project_status`.

**Konvention seit Phase F (Mai 2026)**: Das ist **die UI-Wahrheit** für „Wo steht das Projekt phasentechnisch?" — wird im Header und im Übersicht-Tab angezeigt.

### 5. `Statusbericht.status`

| Werte | Bedeutung | Wer setzt? |
|---|---|---|
| `draft` | Entwurf, editierbar | User (Default) |
| `final` | Veröffentlicht, read-only | User (explizite Aktion) |

**Semantik**: Workflow-State eines einzelnen SB.

### 6. `Abschlussbericht.status`

| Werte | Bedeutung | Wer setzt? |
|---|---|---|
| `draft` | Entwurf, editierbar | User (Default beim Anlegen) |
| `final` | Veröffentlicht, read-only (außer Owner reopens) | User (Phase-F „Als Final markieren") |

**Semantik**: Workflow-State des Abschlussberichts. Bei `final` wird zusätzlich `finalized_at` gesetzt.

**Lifecycle-Hook**: Beim Übergang draft → final öffnet das UI ein Modal mit `project_status`-Selectbox — der User kann z.B. „Abschluss" wählen, dann wird `auftrag.project_status: 'closing'` gesetzt.

## Orthogonalität — welche Felder sind unabhängig?

```
auftrag.status      ⟂  auftrag.project_status   (Freigabe vs PM-Phase)
auftrag.status      ⟂  statusbericht.status     (Auftrag vs SB-Workflow)
auftrag.status      ⟂  abschlussbericht.status  (Auftrag vs Abschluss-Workflow)
projekt.lifecycle   →  auftrag.project_status   (UI nutzt nur project_status)
projektidee.status  ⟂  alle anderen             (Pre-Projekt-Workflow)
```

## Code-Stellen

| Feld | Backend-Schema | Frontend-Anzeige |
|---|---|---|
| `Projektidee.status` | `paProjektideen.data->status` | `IdeenPage.jsx` Filter |
| `Projekt.lifecycle` | `paProjekte.lifecycle` (Spalte) | **nirgends** (deprecated seit Phase F) |
| `Projektauftrag.status` | `paProjektauftraege.status` (Spalte) | `ProjektePage.jsx` Filter; nicht mehr im WizardPage-Header |
| `Projektauftrag.project_status` | `paProjektauftraege.data->project_status` | `WizardPage.jsx` Header-Badge, `ProjektUebersichtPanel.jsx` Karte, Basis-Tab |
| `Statusbericht.status` | `paStatusberichte.data->status` | `StatusberichtBasis.jsx`, `StatusberichteDashboard.jsx` |
| `Abschlussbericht.status` | `paAbschlussberichte.status` (Spalte) | `AbschlussberichtView.jsx` Header-Badge |

## Häufige Verwechslungen

- **„Projektstatus" gemeint?** → `auftrag.project_status` (UI-Begriff, manuell)
- **„Wizard-Stand"?** → `auftrag.status` (draft/active/completed/cancelled)
- **„Lifecycle"?** → historischer Begriff aus Phase A; heute praktisch `auftrag.project_status`
- **„Abschluss-Status"?** → `abschlussbericht.status` (draft/final), nicht Projektstatus

## Ausblick

- **TD1**: `paProjekte.lifecycle`-Spalte mit Migration `0013_drop_lifecycle.sql` entfernen (eingeplant, niedrige Priorität)
- **Phase D Portfolio**: kommt ohne eigenen Status — Portfolios haben kein Lifecycle-Konzept
- **`Projektidee.status` + `Projektauftrag.status`** könnten langfristig zu einem einheitlichen Workflow-Modell harmonisiert werden, aber das ist out-of-scope für die laufenden Umbauten
