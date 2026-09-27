# Antrag-Kern — Herauslösen aus der Wohngeld-App (Spec, 2026-09-27)

Schritt 1 aus `docs/antragspruefung-architektur-konzept-2026-09-27.md`. Ziel: eine fachfreie
Bibliothek, die Wohngeld und künftig Grundsicherung gemeinsam nutzen. **Wohngeld verhält sich
danach exakt wie vorher** — keine Migration, keine UI-Änderung, keine neuen Dependencies.

## Leitplanken

1. **Bibliothek, kein Framework.** Fabriken und Funktionen, die eine App aufruft. Keine Registry,
   kein konfigurationsgetriebenes Rendering.
2. **Jede App behält ihr eigenes DB-Schema** (getrennte Stellen, getrennte Sozialdaten). Der Kern
   liefert Tabellen-*Fabriken* (`auditLogTabelle(schema, praefix)`); die App ruft sie in ihrem
   Schema auf. Für Wohngeld erzeugen die Fabriken exakt die bestehenden Tabellen- und Indexnamen
   → keine Migration.
3. **Keine Fachbegriffe im Kern:** keine Dokumenttypen, keine Vorgangsfelder, keine `WOHNGELD_*`-
   Variablen, kein „wohngeld" in Texten. Alles Fachliche kommt als Parameter (Labels, Env-Präfix,
   Log-Präfix, Hooks).
4. **Wohngeld-Dateien werden dünne Adapter.** `apps/wohngeld/audit.ts` instanziiert den Kern und
   exportiert dieselben Namen wie bisher → die 13 Routen-Dateien bleiben unverändert. Umbau der
   Importe nur, wo es ohnehin nötig ist.
5. **Naht für einen späteren gemeinsamen Posteingang:** keine Spalte „Antragsart" (jede App hat
   ihre eigene Tabelle), sondern eine programmatisch aufrufbare Einlieferung je App
   (`posteingang.einliefern(dateien, meta)`), die heute die HTTP-Route und künftig ein
   vorgeschalteter Eingang nutzt.

## Ort

- Backend: `backend/src/apps/_antrag-kern/`
- Frontend: `frontend/src/apps/_antrag-kern/`

## Wellen

### K1 — Backend-Grundlagen (fachfrei, geringes Risiko)

| Kern-Modul | Herkunft | Form |
|---|---|---|
| `ids.ts` | `genId`/`nowIso` aus wohngeld/storage.ts | as-is |
| `datum.ts` | `plusTage`, `istUeberfaellig`, `tageBisFrist` (fristen.ts), `addJahre`/`toUtcDay` (retention.ts) | as-is, zusammengeführt |
| `concurrency.ts` | wohngeld/concurrency.ts | as-is (Dedupe der Kopien in echoloop/projektmanagement: später, nicht hier) |
| `audit.ts` | wohngeld/audit.ts + Audit-Teil von storage.ts + routes/audit.ts | `auditLogTabelle(schema, praefix)`, `createAuditStore(tabelle)`, `createAudit({ store, logPraefix })` mit generischem `ObjektTyp extends string`; reine Helfer (`diffFelder`, `auditEintraegeToCsv`, …) as-is; `createAuditRoutes({ store, guards })` |
| `ki-verbrauch.ts` | wohngeld/ki-verbrauch.ts | `kiVerbrauchTabelle(schema, praefix)`, `createKiVerbrauch({ tabelle, labels, logPraefix })`; `fasseZusammen` + Typen generisch |
| `aufbewahrung.ts` | wohngeld/retention.ts | Konfiguration statt Env: `{ jahre, jahreAbgelehnt, abschlussStatus }`; struktureller Typ `{ aufbewahrungBis?, legalHold? }` |
| `rollen.ts` | routes/_shared.ts | `denyIfNotAppEditor`, `denyIfNotAppOwner`, `getAppRole`, `darfEntscheiden` as-is; `vierAugenAktiv(envPraefix)`; `createDenyIfVorgangEingeschraenkt(getVorgang)` |

Die Wohngeld-Module `audit.ts`, `ki-verbrauch.ts`, `retention.ts`, `fristen.ts`,
`concurrency.ts`, `routes/_shared.ts`, `routes/audit.ts` werden Adapter (gleiche Exporte).
`db/schema/wohngeld.ts` erzeugt `wgAuditLog`/`wgKiVerbrauch` über die Fabriken.
Bestehende Tests wandern mit (reine Helfer) bzw. bleiben am Adapter.

### K2 — Posteingang-Mechanik

- `posteingang/typen.ts`: `PosteingangDatei<TTyp, TAnalyse>`, Status, Quelle (+ `'weiterleitung'`).
- `posteingang/zustand.ts`: Zustandsmaschine + Hashes (aus posteingang-helpers.ts);
  `leiteBetreffAb` bleibt in Wohngeld.
- `posteingang/fortschritt.ts`: as-is.
- `posteingang/split.ts`: Env-Präfix + Dateiablage über `SplitDeps` injiziert.
- `dateiablage.ts`: `createDateiablage({ appId, logPraefix })` (S3-Schlüssel über neues
  `s3Paths.appUpload(appId, …)`, für Wohngeld identischer Pfad `apps/wohngeld/uploads/…`).
- `posteingang/tabelle.ts` + `store.ts`: `posteingangTabelle(schema, praefix)`,
  `createPosteingangStore(tabelle)`.
- `posteingang/routen.ts`: `createPosteingangRoutes({ store, ablage, audit, kiVerbrauch, guards,
  analysiere(dateien, melder, userId), werteUmschlagAus(dateien, betreff), zuordnen(c, eingang, body) })`
  mit den generischen Endpunkten (ingest, Liste, Detail, Datei/Vorschau/Seite, analysieren im
  Hintergrund, trennung, verwerfen, patch, delete, ki-verbrauch) und `einliefern()` als Funktion.
  Fachlich bleiben in Wohngeld: Erkennung (DP-Profil), Match, `verteileDokumente`, Upload am Vorgang.

### K3 — Frontend-Bausteine (parallel zu K1 möglich)

- `konstanten.js`: `ACCENT`, `ACCENT_LIGHT`, `PRUEF_*`-Labels (Wohngeld-`api.js` re-exportiert).
- `AntragKernContext` (`{ api: { getRegeln, getKiVerbrauch, getPosteingangKiVerbrauch } }`),
  bereitgestellt von der Wohngeld-App → kein Prop-Drilling.
- As-is: PanelSection, SektionCard (+FeldGrid), FeldStatusMark, NotizPanel, SeitenVorschau,
  RegelDetails, AuswertungsFortschritt, Helfer `feldStatusMap.js`, `fortschritt.js`,
  `markdownText.js` (+Test).
- Über Context: PruefschrittItem, RegelKatalog, KiVerbrauch.
- Über Props: ExtraktionsBaum (`analyseLabels`, `pflichtangaben`).
- Bleiben in Wohngeld: StatusBadge, GesetzAntwort, alle Seiten.
- Keyframes `wg-pulse`/`wg-fortschritt` bleiben unverändert (Umbenennung wäre reine Kosmetik).

### K4 — Feldstatus und Notizen

- `feldstatus.ts`: `feldStatusTabelle(schema, praefix, vorgangIdRef)`, `createFeldStatusStore`,
  `createFeldstatusRoutes({ store, guards, audit, beiVerwerfen, beiBestaetigt, nachAenderung })`;
  Wohngeld liefert die Hooks (Feld leeren, Einkommen übernehmen, Lernbeispiele, Auto-Prüfung).
- `notizen.ts`: `notizenTabelle(...)`, `createNotizenStore`, `createNotizenRoutes({ store, vorgangExistiert, guards, audit })`.
- `feldstatus-mapping.ts` und `auskunft-export.ts` bleiben in Wohngeld.

## Verifikation je Welle

- `bun test src/apps src/services` grün (Wohngeld-Tests unverändert, verschobene Tests grün).
- Typecheck: keine neuen Fehler in `apps/_antrag-kern` und `apps/wohngeld`.
- **Lese-Schnappschuss vorher/nachher:** Skript liest gegen die lokale Dev-DB Audit-Einträge,
  KI-Verbrauch, Posteingang-Liste, Feldstatus, Notizen eines Demo-Vorgangs über die öffentlichen
  Funktionen; Ausgabe vor und nach dem Umbau muss identisch sein.
- Fabrik-Gleichheit: Test, dass die Fabriken für Wohngeld dieselben Tabellen-/Indexnamen und
  Spalten liefern wie bisher (über `getTableConfig`).
- Frontend: Lint + `vite build` grün.
- **Grep-Wächter:** Test, der sicherstellt, dass `apps/_antrag-kern` keine Fachbegriffe enthält
  (`wohngeld`, `WoGG`, `WOHNGELD_`) und nichts aus `apps/wohngeld` importiert.

## Nicht-Ziele

- Dedupe der Concurrency-Kopien in echoloop/projektmanagement.
- Generische Checker-Engine, Einkommenslogik, Vorgangsseite, Fall-Chat.
- Umbenennen von Wohngeld-Tabellen oder CSS-Keyframes.
