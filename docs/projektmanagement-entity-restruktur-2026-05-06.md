# Projektmanagement Entity-Restruktur — Phase A

**Datum**: 2026-05-06
**Status**: Phase A abgeschlossen (Backend, beide Worktrees)
**Folge-Phasen**: B (Frontend-Tabs), C (Listen-Page), D (Portfolio), E (Lessons Learned + Abschluss)

## Kontext

Die PM-App ist organisch gewachsen: erst `Projektauftrag`, dann `Projektidee`, dann `Statusberichte`. Geplant sind `Lessons Learned`, `Abschlussbericht` und `Portfolio`. Heute ist `paProjektauftraege` *de facto* das Projekt — das passt nicht zur Vision (Projekt = Identitaet + Lifecycle; Auftrag/SB/LL/Abschluss = Sub-Resources).

Symptome: `WizardPage.jsx` (44 KB) traegt einen Mode-Toggle "Projektauftrag / Statusbericht"; `ProjektePage.jsx` zeigt 4 parallele Tabs (Ideen/Auftraege/Statusberichte/Abschluss), die eigentlich Sub-Views eines Projekts sein sollten.

Plan: bevor neue Sub-Entities dazukommen, eine saubere Hierarchie etablieren. Phase A liefert die Backend-Entity `Projekt` parallel zu `Projektauftrag` — IDs werden 1:1 uebernommen, alte URLs/Bookmarks bleiben gueltig.

## Entscheidungen

Im Plan-Mode mit dem User geklaert:

1. **Migrations-IDs**: 1:1 uebernehmen — kein Linkbruch fuer User-Bookmarks.
2. **Portfolio-Kardinalitaet**: ein Projekt in 0..1 Portfolio (kein n:m).
3. **Projektname**: lebt am `Projekt` (Identitaet), nicht am Auftrag (Inhalt).
4. **Lifecycle-Uebergaenge**: explizit setzbar + Auto-Vorschlaege via `suggestLifecycleTransition()` (in Phase A noch Stub, befuellt sich in Phase E).

## Datenmodell

```
Portfolio (Phase D)  ────────────►  Projekt (Phase A)
                                       │
Projektidee  ──promote──►  Projekt    │
                                       ├── Projektauftrag (Phase B-FK-Umzug)
                                       ├── Statusberichte (Phase B-FK-Umzug)
                                       ├── Lessons Learned (Phase E)
                                       └── Abschlussbericht (Phase E)
```

`Projekt`-Felder (minimal):

```typescript
interface Projekt {
  id: string;                  // 1:1 mit Projektauftrag-ID (nach Migration)
  name: string;                // Identitaet (nicht mehr am Auftrag)
  lifecycle: 'planning' | 'active' | 'closed' | 'cancelled';
  portfolioId?: string;        // 0..1, Phase D
  ideeId?: string;             // Herkunft, optional
  ownerId?: string;
  metadata?: Record<string, any>;
  permissions?: ResourcePermissions;
  version: number;             // Optimistic-Concurrency
  createdAt: string;
  updatedAt: string;
}
```

## Aenderungen Phase A

### main (Postgres + Drizzle)

| Datei | Aenderung |
|-------|-----------|
| `backend/src/db/schema/projektmgmt.ts` | Neue Tabelle `projektmgmt.projekte` + 4 Indexes (owner/lifecycle/portfolio/idee) |
| `backend/drizzle/0010_projekt_entity.sql` | Manual CREATE TABLE-Migration (drizzle-kit generate scheiterte am TTY-Prompt) |
| `backend/drizzle/meta/_journal.json` | Journal-Eintrag idx 10 |
| `backend/src/apps/projektmanagement/types.ts` | `Projekt`, `ProjektCreateInput`, `ProjektUpdateInput`, `ProjektLifecycle`, `PROJEKT_LIFECYCLE_VALUES` |
| `backend/src/apps/projektmanagement/projekt-service.ts` | **NEU** — CRUD via Drizzle + Optimistic-Concurrency-Compare-and-Swap |
| `backend/src/apps/projektmanagement/routes.ts` | Neue Endpoints `GET/POST/PUT/DELETE /projekte[/:id]` |
| `backend/scripts/migrate-projekte.ts` | **NEU** — idempotentes Migrations-Script (Auftrag → Projekt, gleiche ID) |

Migration verifiziert: erster Lauf legte 6 Projekte an, zweiter Lauf 0/6 skipped (idempotent).

### demo/messe (YAML + Bun)

| Datei | Aenderung |
|-------|-----------|
| `backend/src/apps/projektmanagement/types.ts` | Gleiche Interfaces wie main (camelCase, bewusst abweichend von snake_case-Konvention bei Auftrag/Idee — neue Entity, kein Legacy) |
| `backend/src/apps/projektmanagement/projekt-service.ts` | **NEU** — CRUD ueber `data/apps/projektmanagement/projekte/{id}/metadata.yaml` mit `withLock` + `VersionConflictError` |
| `backend/src/apps/projektmanagement/routes.ts` | Identische Endpoints wie main — gleiche API-Shape, Frontend-Cherry-pick passt 1:1 |
| `backend/scripts/migrate-projekte.ts` | **NEU** — Idempotent, behandelt fehlendes `projektauftraege/`-Verzeichnis ohne Crash |

Migration verifiziert: leere Datenbasis → 0/0 Created/Skipped, zweiter Lauf identisch (kein Crash).

## API-Form

Gleicher Endpunkt-Shape auf beiden Worktrees:

```
GET    /api/apps/projektmanagement/projekte          → { projekte: Projekt[] }
GET    /api/apps/projektmanagement/projekte/:id      → { projekt: Projekt }
POST   /api/apps/projektmanagement/projekte          { name, ... } → { projekt }
PUT    /api/apps/projektmanagement/projekte/:id      { ..., expectedVersion? } → { projekt }
DELETE /api/apps/projektmanagement/projekte/:id      → { success: true }
```

`PUT` mappt `VersionConflictError` auf HTTP 409 mit `{ error: 'version_conflict', current: Projekt }`.

`POST` und `DELETE` erfordern App-Rolle `owner` oder `editor` (`denyIfNotAppEditor`). `GET` erbt vom `requireAppAccess`-Middleware.

## Migrations-Strategie

- **Phase A** (durch): Projekt-Entity parallel zu Projektauftrag, 1:1-IDs.
- **Phase B** (Frontend): `ProjectDetailPage` mit Tab-Container; `WizardPage`-Mode-Toggle raus.
- **Phase C** (Listen-Page): Tabs `Projekte | Ideen | Portfolios | Einstellungen` (Statusberichte/Abschluss als Top-Level verschwinden).
- **Phase D**: `Portfolio`-Entity (Tabelle/YAML + Routes + Frontend).
- **Phase E**: `LessonsLearned` + `Abschlussbericht` (jeweils als Sub-Resource am Projekt).
- **Spaeter**: Sub-Resource-FKs von `paProjektauftraege.id` auf `paProjekte.id` umziehen — bewusst noch nicht in Phase A, weil die IDs identisch sind und die alten FKs nicht brechen.

## Verifikation

```sh
# main
/Users/andreasbachmann/.bun/bin/bun run backend/scripts/migrate-projekte.ts
# → erste Ausfuehrung: 6 created
# → zweite Ausfuehrung: 0 created, 6 skipped

# demo/messe
cd /Users/andreasbachmann/Documents/Development/AgentWork/agent-platform-railway
/Users/andreasbachmann/.bun/bin/bun run backend/scripts/migrate-projekte.ts
# → 0 created, 0 skipped (keine Auftrags-Daten lokal)
```

TS-Check auf beiden Worktrees: keine neuen Fehler durch Phase A; nur die pre-existing Fehler in `analysis.ts`, `lieferantenmanagement/service.ts`, `loop.ts` etc.

## Offene Punkte

- Commits + Push auf beide Branches (`main` + `demo/messe`) — wartet auf User-Bestaetigung.
- Phase B Frontend folgt in separatem Plan.
- Spaeter ggf. `idee-service.createAuftragFromIdee` umbenennen in `promoteIdeeToProjekt` und so abaendern, dass es zuerst ein Projekt anlegt und dann den Auftrag. Aktuell keine Aenderung — die Idee→Auftrag-Brueche werden in Phase B angegangen.
