# Code-Review Projektmanagement — Abschluss-Doku

**Datum**: 2026-05-18
**Status**: Erledigt (P0–P4)
**Zweck**: Konsolidierung der Befunde + Massnahmen aus der Code-Review nach Phasen A–F.

## Kontext

Nach Abschluss der Phasen A–F (Projekt-Entity, Tab-Container, Listen-Page,
Lessons Learned, Abschlussbericht) lief eine vollstaendige Code-Review der
PM-App. Drei parallele Explore-Agents lieferten Findings; drei davon waren
nach Verifikation falsch (siehe „Agent-Behauptungen FALSE" weiter unten).

Diese Doku beschreibt die *umgesetzten* Massnahmen — nicht die ungefilterten
Agent-Reports. Der detaillierte Plan-Eintrag mit Original-Findings lebte in
`.claude/plans/woolly-popping-pony.md` und wurde durch diese Doku abgeloest.

## Massnahmen-Inventar

| Prio | Massnahme | Status | Commit (main) |
|---|---|---|---|
| P0 | B1: `VersionConflictError` mit Entity statt String werfen | erledigt | `28eb55e` |
| P1 | DC1/DC2/DC3: Dead Code (ComingSoon, StatusberichteDashboard, topTabComingSoon) | erledigt | `28eb55e` |
| P1 | Tests fuer `resolveRole` (App-Floor + Override + Fallback) | erledigt | `28eb55e` |
| P2 | B4: AbortController + 30s-Timeout fuer LLM-Calls (`llm-utils.ts` + Tests) | erledigt | `6777f0f` |
| P2 | TD2: `routes.ts` in projekte / lessons-learned / abschluss / shared splitten | erledigt | `6777f0f` |
| P2 | Phase-B/C-, LL-, Abschluss-Doku nachgereicht | erledigt | `6777f0f` |
| P3 | B3: `selectedSbId` via `?sb=<id>` in URL synchronisiert | erledigt | `7b9b260` |
| P3 | B2: `expectedVersion` in finalize/reopen + Frontend-Conflict-Handling | erledigt | `7b9b260` |
| P3 | TD3: DB-seitiges Pagination + Status-Filter fuer `listProjektauftraege` | erledigt | `e741f31` |
| P4 | TD1: `paProjekte.lifecycle` aufgeraeumt + Migration `0013_drop_projekte_lifecycle` | erledigt | `0dee8bb` |
| P4 | TD5: Status-Felder-Doku (`projektmanagement-status-felder-2026-05-18.md`) | erledigt | `7b9b260` |

Alle Commits sind in beiden Worktrees gespiegelt (`main` = Postgres/Drizzle,
`demo/messe` = YAML/Bun). Cherry-Picks 1:1 ausser fuer:
- DB-Migrations (nur main)
- `routes.ts`-Split (main hatte den groesseren Refactor-Bedarf; demo/messe
  hat das gleiche Modul-Layout bekommen)
- PM-spezifische Docs (nur main per Konvention)

## Schluessel-Entscheidungen

### TD1 — Migration ist destruktiv aber sicher
Die `paProjekte.lifecycle`-Spalte wurde nicht mehr UI-gesetzt und driftete
seit Phase F still vom tatsaechlichen Projektstand weg (Wahrheit lebt jetzt
in `auftrag.project_status`). Migration `0013` ist idempotent (`DROP COLUMN
IF EXISTS` + `DROP INDEX IF EXISTS`). Frontend nutzt `projekt.lifecycle`
nirgends als Datenfeld — nur als CSS-/State-Variablen-Name, die als visuelle
Begriffe stehen bleiben.

### TD3 — Pagination ist opt-in
Pagination ist defense-in-depth, kein vollstaendiges Cursor-Modell. Der
Permission-Filter laeuft weiterhin nach dem DB-Fetch (RBAC kennt die jsonb-
Felder nicht). Folge: Fuer Nicht-App-Owner koennen paginierte Seiten sparser
sein als `limit` suggeriert. Clients sollen daher `pagination.hasMore` lesen,
nicht auf gefuellte Seiten vertrauen. Stats- und Internal-Aufrufer ohne
explizites `limit` laden weiter alle Rows (Behavior-Erhalt).

### B2 — VersionConflict in Status-Transitions optional
`finalizeAbschlussbericht`/`reopenAbschlussbericht` akzeptieren optionalen
`expectedVersion`-Parameter. Frontend uebergibt ihn aus dem letzten GET;
Server-Skripte (z.B. CLI-Migrationen) lassen ihn weg → Transition bleibt
idempotent.

### B3 — URL-State minimal-invasiv
`selectedSbId` wird via `?sb=<id>` synchronisiert, aber nur im Statusberichte-
Tab. Beim Tab-Wechsel wird der Parameter geraeumt — keine URL-Pollution
ausserhalb des SB-Kontexts.

## Agent-Behauptungen FALSE (Transparenz)

Drei Findings haben sich nach Verifikation als falsch herausgestellt — keine
davon hat zu einem unnoetigen Commit gefuehrt, weil sie in der Plan-Phase
ausgefiltert wurden. Dokumentiert hier, damit kuenftige Reviews die gleichen
Pseudo-Findings nicht erneut aufgreifen:

1. *„GET /projekte ohne Auth"* → falsch; `requireAppAccess` ist global gesetzt.
2. *„useEffect Infinite-Loop in AbschlussberichtView"* → falsch; `getAbschlussbericht`
   ist `useCallback`-gewrappt.
3. *„`project_status` wird nirgendwo gelesen"* → falsch; 8 Lesepfade nachgewiesen.

## Anschluss-Arbeit (out-of-scope dieser Review)

- Phase D (Portfolio-Entity) — bewusst verschoben, weil zuerst die
  Hierarchie-Schmerzpunkte adressiert werden mussten.
- A11y-Audit (htmlFor, role=tablist) — eigenstaendig wertvoll, separat zu
  planen.
- Cross-Project-Reports (z.B. „alle offenen Risiken aller aktiven Projekte")
  — eigenstaendiger PMO-Bedarf.
- Browser-Performance-Profiling fuer die 1480-Zeilen-WizardPage — kein
  verifizierter Bug, eher Optimierungspotential.

## Verifikation

Alle Massnahmen sind ueber `bun tsc --noEmit` typeclean (keine *neuen*
Errors in PM-Modulen; vorbestandene `instanceof`-Warnings und Buffer-Type-
Issues in `routes.ts` bleiben — gehoeren in ein separates Cleanup).

Tests:
- `permissions.test.ts` (28 Tests) — `resolveRole` mit App-Floor, Resource-
  Override, `created_by`-Fallback, alle Kombinationen.
- `llm-utils.test.ts` (6 Tests) — Timeout, Pass-Through, Error-Propagation.
