# Extraktion: Kontrollierte Wertelisten als Ground Truth — Ausbau-Welle 6

**Datum:** 2026-08-03
**Status:** Implementiert (main/Scalingo + demo/messe/Railway)
**Plan-Referenz:** `~/.claude/plans/snug-gathering-ritchie.md`
**Fachkonzept:** `docs/fachkonzept-dokumenten-extraktion-2026-07-27.md` §14
**Vorgänger:** W5 API & Integration + fachliche Härtung (`docs/extraktion-api-integration-2026-08-03.md`)

## Kontext

W5 gab dem Feature Prüfregeln: Summen müssen aufgehen, ein Wert soll in einer Stammdaten-Tabelle
vorkommen. Was fehlte, war die häufigste Form von Wahrheit in Dokumenten-Projekten: Für sehr viele
Felder ist der **Wertevorrat vorab bekannt und endlich** — Einheiten, Statuscodes, Kostenstellen,
Dokumentarten, Lieferanten. Ohne hinterlegte Liste rät die Extraktion frei und liefert mal „Stk",
mal „Stück", mal „stk."; solange die Konfidenz hoch ist, fällt das niemandem auf, und die Daten sind
für jede nachgelagerte Auswertung unbrauchbar. Die `lookup`-Regel aus W5 schlägt erst *hinterher*
Alarm und kann nichts reparieren.

W6 hinterlegt die Liste **am Feld** und lässt sie an drei Stellen wirken:

| | Wirkung | Wo |
|---|---|---|
| **(a)** | Die zulässigen Werte stehen im Extraktions-Prompt | `pipeline-adapter.ts` → Feld-Hint |
| **(b)** | Ein eindeutig zuordenbarer Wert wird auf die kanonische Schreibweise gesetzt | `catalog.ts applyCatalogs` |
| **(c)** | Ein Wert außerhalb der Liste ist ein Befund und erzwingt „Zu prüfen" | W5-Triage-Mechanik |

## Produktentscheidungen

| Frage | Entscheidung |
|---|---|
| Prompt-Bindung | **weich** — Werte in der Feldbeschreibung, kein hartes `enum` |
| Mapping | eindeutige Treffer automatisch angleichen, protokolliert (`auto_map`, Default an) |
| Wertequelle | statische Liste am Feld **und** Tabellenspalte (Tables) |
| Matching | deterministisch: Normalisierung + Synonyme + knappe Tippfehler, kein LLM-Call |

### Warum weich statt `enum`

Ein hartes `enum` im Function-Schema erzwingt eine Antwort aus der Liste. Bei einem Dokument mit
einem echten Ausreißer bedeutet das: Das Modell **muss** einen falschen Wert liefern — der Fehler
wird unsichtbar statt sichtbar, und Effekt (c) könnte nie auslösen. Außerdem greift `enum` nur beim
Function-Calling; die Vision-Strategien arbeiten mit Freitext-JSON.

Der weiche Weg wirkt dagegen **überall ohne Strategie-Änderung**: Beide Prompt-Bauer rendern
`FieldDefinition.hint` — `extraction/schema-builder.ts` (Function-Calling) und
`services/extraction/extract-call.ts buildVisionJsonInstruction` (Vision). Der Adapter schreibt die
Werte dorthin, fertig:

```
Function-Schema:  "lieferant": { "type": "string", "description":
                    "Lieferant. Zulaessige Werte: Acme AG · Muster Bau GmbH · Nordlicht Handel KG.
                     Passt keiner davon, gib den im Dokument gefundenen Wert zurueck." }

Vision-JSON:      "lieferant": "Text"|null,  // Lieferant — Zulaessige Werte: Acme AG · …
```

Der E2E-Lauf hat genau das bestätigt: Bei „Lieferant: acme ag" und Einheit „Stück" lieferte das
Modell direkt „Acme AG" und „Stk" — und bei der Einheit „Sack" (nicht im Katalog) hat es **nicht**
in die Liste gezwungen, sondern den Ist-Wert gemeldet, der dann zum Befund wurde.

## Umsetzung

### Datenmodell (`learning/types.ts`) — ohne Migration

```ts
interface CatalogValue { value: string; synonyms?: string[] }
interface FieldCatalog {
  source: 'list' | 'table';
  values?: CatalogValue[];               // source 'list'
  table_id?: string; column_id?: string; // source 'table'
  severity?: 'error' | 'warn';           // Wirkung eines Ausreissers, Default 'error'
  auto_map?: boolean;                    // Default true
}
```
`catalog` hängt an `ProjectField` **und** `ProjectItemField` (Positions-Spalten wie „Einheit").
Feld-Definitionen liegen als Ganzes in `projects.fields` (jsonb) bzw. im `project.yaml` — das neue
Attribut reist ohne Schema-Änderung mit, ebenso durch Export/Import.

`RuleSeverity` bekam eine dritte Stufe `info`: das Protokoll einer Angleichung. `hasBlockingIssue`
prüft weiterhin nur auf `error`, damit eine reine Schreibweisen-Korrektur niemanden aufweckt.

### Matching (`learning/catalog.ts`)

`normalizeForMatch` faltet Umlaute, Groß-/Kleinschreibung, Interpunktion und Whitespace
(„Stück." → `stueck`). `matchCatalogValue` geht dann in vier Stufen vor, **jede nur bei genau einem
Kandidaten**:

1. **exakt** (normalisiert) — „acme ag" → „Acme AG"
2. **Synonym** — gepflegte Varianten je Wert („Stück", „St." → „Stk")
3. **Präfix/Enthalten** ab 6 Zeichen — „Muster Bau" → „Muster Bau GmbH"
4. **Tippfehler** — Levenshtein ≤ `max(1, ⌊len/8⌋)`, „Acmee AG" → „Acme AG"

Zwei gleich nahe Kandidaten ⇒ `ambiguous`: **kein** Mapping, stattdessen ein Befund mit den
Kandidaten im Text. Kein Treffer ⇒ Befund mit den drei nächstliegenden Werten als Hilfestellung.

`applyCatalogs` läuft über Skalare *und* Positions-Spalten, gleicht an (bei `auto_map`) und
protokolliert jede Ersetzung als `info`-Befund mit dem Rohwert — der geht also nie verloren.

### Verdrahtung

- `learning/service.ts extract()`: **erst Kataloge, dann Regeln** — die W5-Prüfregeln sehen den
  bereinigten Stand (ein Stammdaten-Lookup prüft den angeglichenen Wert, nicht die Rohform).
- `evaluateProjectRules` (nach einer menschlichen Korrektur) macht dasselbe: „Übernehmen & lernen"
  gleicht die korrigierten Werte ebenfalls an.
- `readTableColumn` (neu) ist die gemeinsame Basis von Regel-Lookup (braucht nur die Menge) und
  Katalog (braucht die Schreibweise); Werte je (Tabelle, Spalte) einmal pro Extraktion.
- `validateProjectFields` prüft Kataloge beim Speichern und Importieren mit.
- Public-API `projects.list` liefert `allowed_values` je Feld (statische Liste ausgerollt,
  Tabellen-Katalog als `table:<id>.<spalte>` benannt — Kataloge können sehr groß sein).

### UI

Im Feld-Editor (Anlegen *und* Einstellungen) je skalarem Feld und je Positions-Spalte ein
`CatalogEditor`: Quelle (`beliebig | Feste Liste | Aus Tabellenspalte`), bei fester Liste ein
Textfeld mit **einem Wert je Zeile** und Schreibvarianten nach `=`
(`Acme AG = acme, ACME Aktiengesellschaft`), dazu „automatisch angleichen" und die Wirkung einer
Abweichung. `ValidationIssues` rendert die neue Stufe `info` neutral-grau („Angeglichen: …").

## Verifikation

`bun test`: 271 im Scalingo-Worktree (25 neue), 247 im Railway-Worktree; `tsc` ohne neue Fehler,
beide Frontend-Builds grün.

**End-to-End (lokal, Port 3011, echte Modelle):**

1. **Prompt (a)** — Katalogwerte nachweislich in beiden Prompt-Pfaden (Function-Schema *und*
   Vision-JSON), inklusive Positions-Spalten. **Offen:** ein *ausgeführter* Vision-Lauf mit Katalog
   steht noch aus — der Adacor-Vision-Endpoint lief am 2026-08-04 in beide 45-s-Timeouts, ein
   Kontrolllauf **ohne** Katalog scheiterte identisch (später antwortete auch der Text-Endpoint
   nicht mehr auf ein triviales Prompt). Die Kataloge sind als Ursache damit ausgeschlossen; der
   Nachweis auf der Vision-Strecke ist nachzuholen, sobald der Endpoint wieder liefert.
2. **Modellverhalten** — Dokument mit „acme ag" / „Stück" → Modell liefert direkt „Acme AG" / „Stk".
   Einheit „Sack" (nicht im Katalog) wurde **nicht** in die Liste gezwungen → `error`-Befund,
   Datei auf „Zu prüfen". *(Der Gegenfall „nur `info`-Befunde ⇒ Datei bleibt `auto_ok`" ist über den
   Korrektur-Pfad belegt — dort blieb die Datei unblockiert —, als regulärer Batch-Lauf aber noch
   nicht gezeigt; siehe Endpoint-Ausfall unter Punkt 1.)*
3. **Mapping (b)** — Korrektur mit „ACME Aktiengesellschaft" und „stück" über den Live-Pfad:
   beide auf „Acme AG"/„Stk" angeglichen, zwei `info`-Befunde, gespeicherter Stand kanonisch.
4. **Tabellen-Katalog** — „muster bau" → „Muster Bau GmbH" (Präfix-Treffer) mit `info`-Protokoll.
5. **Fehlende Tabelle** — Quelle gelöscht → `warn` („nicht prüfbar"), keine Extraktion scheitert.
6. **`auto_map: false`** — Rohwert „muster bau" bleibt stehen, stattdessen `error`-Befund
   („weicht vom Katalogwert ab").

**Zwei Fehler, die die Verifikation gefunden hat** (beide gefixt, beide jetzt durch Tests gedeckt):
- Ein normalisiert-exakter Treffer („acme ag" ↔ „Acme AG") wurde übersprungen statt angeglichen —
  also genau der Hauptfall von (b).
- Die Katalog-Validierung wies zwei Schreibvarianten **desselben** Werts („Stück"/„Stueck") als
  Kollision ab; sie sind nur redundant. Jetzt kollidieren Synonyme nur noch über *verschiedene*
  Katalogwerte hinweg.

## Grenzen / Folge-Ideen

- **Tabellen-Kataloge landen nicht im Prompt** (nur in Mapping und Prüfung) — sie können tausende
  Zeilen haben. Für kleine Tabellen wäre ein „in den Prompt ausrollen bis N Werte" denkbar.
- **Kein LLM-Mapping**: Abkürzungen und Umschreibungen, die deterministisch nicht greifen
  („Nordlicht" statt „Nordlicht Handel KG" trifft über Präfix, „NHKG" nicht), brauchen ein
  gepflegtes Synonym.
- **Kataloge sind statisch gepflegt** — sie lernen (noch) nicht aus Korrekturen. Ein naheliegender
  Ausbau: Wird ein Ausreißer wiederholt auf denselben Katalogwert korrigiert, als Synonym vorschlagen.
- Der Prompt-Hint kappt bei 40 Werten; die Prüfung nutzt weiterhin den vollen Katalog.
