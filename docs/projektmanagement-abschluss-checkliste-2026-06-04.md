# Projektmanagement — Abschluss-Checkliste

**Stand**: 2026-06-04 · **Branches**: main (Scalingo) + demo/messe (Railway)

Neuer Block im **Abschlussbericht**: eine **Checkliste** mit Aufgaben/Rahmen­bedingungen,
die beim Projektabschluss unternehmensspezifisch immer betrachtet werden müssen.
Pro Eintrag wird der Status über eine **Selectbox** gesetzt — **Erledigt**,
**Offen**, **Nicht anwendbar** (keine Checkboxen). Die Checklisten-**Items** sind in
den **App-Einstellungen** pflegbar. Der Block erscheint auch in den **Exporten**
(PDF/DOCX/XLSX).

---

## Datenmodell

- **Config** (in den Einstellungen pflegbar) → Key `abschluss_checkliste`:
  `Array<{ id: string; label: string }>` — die Item-Definitionen.
- **Bericht** → `AbschlussberichtData.checkliste`:
  `Array<{ id, label, status }>` mit `status: 'erledigt' | 'offen' | 'na'`.
  `label` wird als Snapshot mitgespeichert; `status` ist die User-Auswahl
  (Default `offen`).

Typen: `ChecklistStatus`, `ChecklistItemConfig`, `ChecklistItemState` in
`backend/src/apps/projektmanagement/types.ts`.

**Reconciliation**: View und Export iterieren über die **aktuellen Config-Items**
und ziehen den Status per `id` aus `data.checkliste` (Default `offen`). So
erscheinen neu konfigurierte Items automatisch als „Offen", und entfernte Items
verschwinden.

---

## Config-Persistenz (worktree-spezifisch)

Die Checklisten-Items müssen persistierbar sein. Die beiden Worktrees nutzen
unterschiedliche Storage-Backends — gleiches Verhalten, andere Implementierung:

| Worktree | Storage | Was geändert wurde |
|---|---|---|
| **main** (Postgres) | `getConfig`/`saveConfig` waren ein **No-op** | Echte Persistenz über `apps.registry.metadata.config` (jsonb). **Nebeneffekt**: die bestehenden „Auswahloptionen" persistieren jetzt auch (vorher verpufften sie). |
| **demo/messe** (YAML) | `getConfig`/`saveConfig` waren **bereits** funktionsfähig (Datei-basiert) | Nur das Default-Item `abschluss_checkliste` ergänzt. |

`getConfig` merged immer `{ ...DEFAULT_CONFIG, ...storedOverrides }` — neue
Default-Keys erscheinen also auch bei vorhandenen Overrides.

---

## Geänderte Dateien

**Backend**
- `apps/projektmanagement/types.ts` — Checklist-Typen + `checkliste`-Feld.
- `apps/projektmanagement/storage.ts` — Default-Items in `DEFAULT_CONFIG`;
  main zusätzlich echte `getConfig`/`saveConfig` (appsRegistry.metadata).
- `services/documentGenerator/index.ts` — `mapAbschlussberichtToDocument`: neue
  Tabellen-Section **„Checkliste Projektabschluss"** (Spalten „Aufgabe /
  Rahmenbedingung" + „Status" mit Farb-Dot: Erledigt=grün, Offen=amber,
  Nicht anwendbar=grau). Helper `getChecklistStatusCell`.

**Frontend**
- `apps/projektmanagement/components/AbschlussberichtView.jsx` — neuer
  `<Section>`-Block „Checkliste Projektabschluss" mit Selectbox pro Item;
  schreibt `draft.checkliste` (reconciled über die Config-Items).
- `apps/projektmanagement/components/Einstellungen.jsx` — neuer Tab
  **„Abschluss-Checkliste"** zum Pflegen der Items (Label + Hinzufügen/Entfernen,
  stabile auto-generierte `id`).

---

## Verhalten

- **Default-Items**: 8 generische Projektabschluss-Punkte sind vorbelegt (Doku
  archiviert, Ressourcen freigegeben, Verträge geschlossen, …) — sofort sichtbar,
  in den Einstellungen editier-/erweiterbar.
- **Leerer Zustand**: Sind keine Items konfiguriert, zeigt der Block einen Hinweis
  auf die Einstellungen.
- **Read-only**: Bei finalisiertem Bericht sind die Selectboxen disabled (wie die
  übrigen Felder).

---

## Verifikation

- Backend `tsc`: keine neuen Fehler in den geänderten Dateien (beide Worktrees).
- Frontend-Build grün (beide Worktrees).
- Export: die Checkliste rendert als Tabelle in PDF/DOCX/XLSX (über das generische
  `table`-Section-Modell mit RichCell-Dots).
</content>
