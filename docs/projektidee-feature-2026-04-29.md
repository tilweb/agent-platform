# Projektidee — separate Datenentitaet inkl. Auftrag-Generierung und Dokumenten-Export

**Datum:** 2026-04-29
**Branch:** `demo/messe` (cherry-pick ausgehend von `main`)
**Plan:** `~/.claude/plans/woolly-popping-pony.md` (zwei Iterationen — Daten-Modell + Wizard, danach Tab-Integration + Export)

## Kontext und Motivation

Die Projektmanagement-App brauchte eine fruehere Stufe als den Projektauftrag: eine **Projektidee**, die Visionen, Treiber, Business Case und Risiken auf hoher Ebene erfasst, bevor (oder ohne dass) ein konkreter Auftrag entsteht. User-Anforderungen aus dem Auftragsgespraech:

- Projektidee als **separate Datenentitaet** (nicht als Status eines Auftrags) — Ideen ueberleben ihre abgeleiteten Auftraege, koennen mehrfach in verschiedene Auftraege muenden, oder gar nicht.
- **1:n-Beziehung**: eine Idee kann mehrere Auftraege erzeugen; abgeleitete Auftraege bleiben mit der Idee verknuepft.
- **Auto-Generierung** eines Auftrags aus der Idee mit Vor-Mapping, aber ohne stringente 1:1-Kopie — der Auftrag entwickelt sich nach dem Kontakt mit der Realitaet weiter.
- **Tabs nur wie im PDF-Vorlage** (5 Eingabe-Tabs + 1 Uebersicht): keine Roadmap, kein Personen-Tab, kein Vergleich. *"Die anderen Eingaben sind zu frueh bei einer Idee."*
- Tab "Kosten" aufgeteilt in **Investitionen + Nutzen** als separate Bloecke, **ROI darunter** als Saldo/Fazit.
- **Export als Dokument** explizit gefordert (Markdown / PDF / DOCX).

## Architektur-Entscheidungen

### Separate Entitaet statt Status-Erweiterung

Eine Idee in `projektmgmt.projektideen` mit eigener Tabelle, `projektauftraege` bekommt einen optionalen `idee_id`-FK. Begruendung:
- Eine Idee kann ohne Auftrag existieren, ein Auftrag ohne Idee — die Beziehung ist optional auf beiden Seiten.
- Loescht man eine Idee, bleibt der Auftrag bestehen (`idee_id` wird auf NULL gesetzt). Loescht man einen Auftrag, bleibt die Idee bestehen.
- Ein Status-Feld `idee → entwurf → genehmigt → ...` haette diesen Lifecycle nicht abgebildet (Aufträge entstehen *aus* Ideen, sind nicht *spaetere Versionen* davon).

### Mapping bei "Auftrag aus Idee erstellen"

| Idee | → | Auftrag |
|---|---|---|
| Stammdaten (Name, Treiber, PL, Datum, ...) | 1:1 | gleiche Felder |
| `business_case.investitionen` | → | `budget` mit `category='Investition'`, **positiver** Betrag |
| `business_case.nutzen` | → | `budget` mit `category='Nutzen'`, **negativer** Betrag (User erfasst positiv, ROI im Auftrag-Budget rechnet mit Vorzeichen) |
| `unternehmensrisiken` | → | `risks` (neue IDs) |
| Tasks, Milestones, Scope, Stakeholders | → | leer — werden im Auftrag erst detailliert |

`auftrag.idee_id = idee.id` wird gesetzt; in der Idee-Detail-Ansicht erscheinen abgeleitete Auftraege via JOIN als Liste.

### Wizard-Struktur (6 Tabs)

1. **Basis** — alle Stammdaten gemaess PDF (Projekt-ID, Name, Typ, Status, Treiber, Groesse, Prioritaet, Kurzbeschreibung, Datum, PL, Auftraggeber)
2. **Ziele** — eine Textarea (kein Erfolgskriterien-Block, wuerde den Auftrag duplizieren)
3. **Projektkontext** — Ausgangslage + Rahmenbedingungen
4. **Business Case** — zwei Bloecke (Investitionen + Nutzen), je positive Betraege; ROI-Saldo darunter mit Status-Badge (`erreicht (+)`, `Break-even`, `nicht erreicht`)
5. **Unternehmensrisiken** — leichter als Projektrisiken im Auftrag, kein Strategie/Status-Workflow; Typ-Optionen inkl. `chance` fuer Opportunities
6. **Uebersicht** — read-only Zusammenfassung + Liste abgeleiteter Auftraege

### Tab-Integration in ProjektePage

Statt einer separaten Sub-Page wird die Ideen-Liste **inline** im `ideen`-Tab von `ProjektePage` gerendert (`<IdeenPage embedded />`). Konsistent mit `statusberichte` und `einstellungen`. Header-Buttons (`Dokumente importieren`, `Neuer Projektauftrag`) werden bei `activeTab !== 'auftraege'` ausgeblendet — der Ideen-Tab fuegt eigenen `+ Neue Projektidee`-Button oben rechts ein.

`IdeenPage.jsx` unterstuetzt Embedded-Mode via `embedded`-Prop; Standalone-Route `/apps/projektmanagement/ideen` bleibt erhalten fuer Deep-Links / Bookmarks.

### Dokumenten-Export

Wiederverwendung der existierenden `documentGenerator`-Pipeline (`backend/src/services/documentGenerator/`), die bereits PDF (pdfmake), DOCX (docx-lib), XLSX (exceljs) erzeugt. Neu hinzugefuegt:

- **Markdown-Generator** (`markdownGenerator.ts`) — DocumentData → Markdown-String mit Pipe-Tables und keyvalue-Bullets. Generisch nutzbar, nicht idee-spezifisch.
- **Idee-Mapper** (`idee-mapper.ts`) — Projektidee → DocumentData. Folgt der Wizard-Reihenfolge (Basis → Kurzbeschreibung → Ziele → Kontext → Business Case + ROI → Risiken → abgeleitete Auftraege).
- **`md`-Format** in `DocumentFormat` Union, Switch in `generateDocument()`, MIME-Type `text/markdown; charset=utf-8`.
- **Endpoint** `GET /apps/projektmanagement/projektideen/:id/export/:format` (formats: `md`, `pdf`, `docx`, `json`). Pattern direkt vom Auftrag-Export uebernommen.
- Frontend: `ExportDropdown`-Komponente bereits vorhanden, unterstuetzte Formate sind via Prop konfigurierbar — `formats={['md', 'pdf', 'docx']}`.

XLSX/CSV bewusst weggelassen — eine Idee-Vision-Beschreibung profitiert nicht von Tabellen-Exporten.

## Geaenderte / neue Dateien

### Backend

- `backend/drizzle/0004_projektideen.sql` (neu) — `CREATE TABLE projektideen` + `ALTER TABLE projektauftraege ADD idee_id`
- `backend/drizzle/meta/_journal.json` (modifiziert) — Migration-Eintrag
- `backend/src/db/schema/projektmgmt.ts` (modifiziert) — `paProjektideen` + `ideeId` auf `paProjektauftraege`
- `backend/src/apps/projektmanagement/types.ts` (modifiziert) — `Projektidee`, `BusinessCaseItem`, `ProjektideeStatus`
- `backend/src/apps/projektmanagement/idee-storage.ts` (neu) — Drizzle CRUD, JOIN fuer abgeleitete Auftraege, ON-DELETE-NULL
- `backend/src/apps/projektmanagement/idee-service.ts` (neu) — Business-Logik inkl. `createAuftragFromIdee()`
- `backend/src/apps/projektmanagement/routes.ts` (modifiziert) — 7 Idee-Routen + Export-Endpoint
- `backend/src/services/documentGenerator/types.ts` (modifiziert) — `'md'` zu `DocumentFormat`
- `backend/src/services/documentGenerator/markdownGenerator.ts` (neu)
- `backend/src/services/documentGenerator/idee-mapper.ts` (neu)
- `backend/src/services/documentGenerator/index.ts` (modifiziert) — md-Branch + Re-Export

### Frontend

- `frontend/src/App.jsx` (modifiziert) — Routen `/apps/projektmanagement/ideen`, `/ideen/neu`, `/ideen/:id`
- `frontend/src/hooks/useProjektideen.js` (neu) — fetchIdeen, getIdee, createIdee, updateIdee, updateIdeeStep, deleteIdee, erstelleAuftragAusIdee
- `frontend/src/apps/projektmanagement/IdeenPage.jsx` (neu) — Liste, mit `embedded`-Prop
- `frontend/src/apps/projektmanagement/IdeeWizardPage.jsx` (neu) — 6-Step-Wizard + Export-Button
- `frontend/src/apps/projektmanagement/ProjektePage.jsx` (modifiziert) — Tab-Integration via `<IdeenPage embedded />`, Header-Buttons-Conditional
- `frontend/src/apps/projektmanagement/components/idee-steps/IdeeBasis.jsx` (neu)
- `frontend/src/apps/projektmanagement/components/idee-steps/IdeeZiele.jsx` (neu)
- `frontend/src/apps/projektmanagement/components/idee-steps/Projektkontext.jsx` (neu)
- `frontend/src/apps/projektmanagement/components/idee-steps/BusinessCase.jsx` (neu)
- `frontend/src/apps/projektmanagement/components/idee-steps/Unternehmensrisiken.jsx` (neu)
- `frontend/src/apps/projektmanagement/components/idee-steps/IdeeUebersicht.jsx` (neu)

## Verifikation

**Backend-Boot:** `bun --watch src/index.ts` laeuft fehlerfrei, Migration `0004_projektideen.sql` wird angewendet.

**Smoke (curl):**
```
POST /api/auth/login                          → 200, sets session cookie
POST /api/apps/projektmanagement/projektideen → 201, idee.id zurueck
GET  /projektideen/:id/export/md              → 200, text/markdown, gut formatiert
GET  /projektideen/:id/export/pdf             → 200, application/pdf, 2 Seiten
GET  /projektideen/:id/export/docx            → 200, MS Word 2007+
DELETE /projektideen/:id                      → 200, abgeleitete Auftraege bleiben
```

ROI-Berechnung verifiziert: Investitionen 57.000 €, Nutzen 115.000 €, Saldo 58.000 € (ROI erreicht).

**Frontend-Build:** `vite build` erfolgreich, IdeeWizardPage 36.38 kB / ProjektePage 48.34 kB.

**Browser-Smoke** (manuell): Tab "Projektideen" zeigt Card-Grid; Wizard speichert; Export-Dropdown laedt md/pdf/docx; Auftrag aus Idee erstellt mit korrektem Mapping; Loeschen der Idee laesst abgeleitete Auftraege bestehen.

## Out-of-Scope (bewusst vertagt)

- **Auftrag-Markdown-Export** — `format=md` zum bestehenden Auftrag-Endpoint hinzufuegen ist eine 1-Zeilen-Aenderung, kann als Folge-PR.
- **Branding im PDF** — aktuelles `pdfmake`-Standard-Layout ohne Cover-Page; kann spaeter mit Logo/Header/Footer fuer Stakeholder-Praesentationen ergaenzt werden.
- **Live-Preview im Wizard** — direkter Download statt Preview-Modal; Erweiterung wenn User-Feedback es anfordert.
- **Reconnect bei Connection-Drop** beim Idee-Speichern — Idee-Saves sind kurz, Auftrag-Generierung braucht keinen Stream.
